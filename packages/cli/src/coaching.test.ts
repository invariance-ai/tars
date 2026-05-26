import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { captureEvent, defaultConfig, saveConfig, tarsPaths, type NormalizedEvent, type TarsPaths } from "@invariance/tars-core";

import { hookCommand } from "./commands/hook.js";

/**
 * End-to-end of the pipe-back loop: seed clean history, then run the hook on a fresh
 * prompt and assert coaching is injected to stdout for injectable surfaces only.
 */

const t = (m: number) => new Date(Date.UTC(2026, 0, 1, 0, m)).toISOString();

function cleanSession(paths: TarsPaths, salt: string, id: string): void {
  const evs: NormalizedEvent[] = [
    { kind: "prompt_submit", surface: "claude", sessionId: id, prompt: "Goal: add X.\n1. a\n2. b\nIt should pass tests (acceptance).", at: t(0) },
    { kind: "tool_action", surface: "claude", sessionId: id, action: "read", at: t(1) },
    { kind: "tool_action", surface: "claude", sessionId: id, action: "read", at: t(2) },
    { kind: "tool_action", surface: "claude", sessionId: id, action: "edit", path: "/p.ts", at: t(3) },
    { kind: "tool_action", surface: "claude", sessionId: id, action: "test", at: t(4), failed: false },
    { kind: "session_end", surface: "claude", sessionId: id, status: "completed", at: t(5) },
  ];
  for (const e of evs) captureEvent(paths, salt, e);
}

function withStdin(json: unknown): void {
  // hook reads stdin via readStdinJson; simulate a piped JSON document.
  const stream = Readable.from([Buffer.from(JSON.stringify(json))]);
  Object.defineProperty(process, "stdin", { value: stream, configurable: true });
}

describe("hook coaching injection", () => {
  let paths: TarsPaths;
  let out: string;
  let writeSpy: { mockRestore: () => void };

  beforeEach(() => {
    const root = mkdtempSync(join(tmpdir(), "tars-coach-"));
    paths = tarsPaths(root);
    const cfg = defaultConfig(["claude", "cursor"]);
    saveConfig(paths, cfg);
    // three clean sessions → enough signal to coach
    for (const id of ["a", "b", "c"]) cleanSession(paths, cfg.salt, id);
    // route the hook to this repo
    process.env.TARS_TEST_ROOT = root;
    vi.spyOn(process, "cwd").mockReturnValue(root);
    out = "";
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(((chunk: unknown) => {
      out += String(chunk);
      return true;
    }) as never);
  });

  afterEach(() => {
    writeSpy.mockRestore();
    vi.restoreAllMocks();
    delete process.env.TARS_TEST_ROOT;
  });

  it("injects coaching on a bare claude prompt", async () => {
    withStdin({ hook_event_name: "UserPromptSubmit", session_id: "new1", prompt: "fix it" });
    await hookCommand("claude");
    expect(out).toContain("[tars] Orchestration coach");
  });

  it("stays silent for cursor (observe-only surface)", async () => {
    withStdin({ hook_event_name: "beforeSubmitPrompt", conversation_id: "new2", prompt: "fix it" });
    await hookCommand("cursor");
    expect(out).toBe("");
  });
});

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { captureEvent } from "./capture.js";
import { newSalt } from "./hashing.js";
import { tarsPaths } from "./paths.js";
import { readSession } from "./session.js";
import { sessionFile } from "./paths.js";

function freshPaths() {
  const root = mkdtempSync(join(tmpdir(), "tars-test-"));
  return tarsPaths(root);
}

describe("captureEvent (golden redaction)", () => {
  it("never writes raw prompt text, only structure", () => {
    const paths = freshPaths();
    const salt = newSalt();
    const secretPrompt = "fix login; my key is sk-abcdefghijklmnopqrstuvwxyz123 and path /Users/jane/app.ts";
    const { key } = captureEvent(paths, salt, {
      kind: "prompt_submit",
      surface: "claude",
      sessionId: "s1",
      prompt: secretPrompt,
      at: "2026-01-01T00:00:00.000Z",
    });
    const raw = readFileSync(sessionFile(paths, key), "utf8");
    expect(raw).not.toContain("sk-abcdefghij");
    expect(raw).not.toContain("/Users/jane");
    expect(raw).not.toContain("fix login");
    expect(raw).not.toContain("s1"); // the native session id is never written either
    const recs = readSession(paths, key);
    expect(recs[0]!.t).toBe("framing");
  });

  it("keeps the same on-disk key across separate captures of one session", () => {
    const paths = freshPaths();
    const salt = newSalt();
    const a = captureEvent(paths, salt, { kind: "prompt_submit", surface: "claude", sessionId: "abc", prompt: "x", at: "2026-01-01T00:00:00.000Z" });
    const b = captureEvent(paths, salt, { kind: "session_end", surface: "claude", sessionId: "abc", status: "completed", at: "2026-01-01T00:01:00.000Z" });
    expect(a.key).toBe(b.key);
    expect(readSession(paths, a.key)).toHaveLength(2);
  });

  it("hashes paths and never stores the raw path", () => {
    const paths = freshPaths();
    const { key } = captureEvent(paths, newSalt(), {
      kind: "tool_action",
      surface: "cursor",
      sessionId: "s2",
      action: "edit",
      path: "/Users/jane/secret/app.ts",
      at: "2026-01-01T00:01:00.000Z",
    });
    const raw = readFileSync(sessionFile(paths, key), "utf8");
    expect(raw).not.toContain("/Users/jane");
    expect(raw).not.toContain("secret/app.ts");
    const rec = readSession(paths, key)[0]!;
    expect(rec.t).toBe("action");
    if (rec.t === "action") expect(rec.pathHash).toMatch(/^[a-f0-9]{16}$/);
  });
});

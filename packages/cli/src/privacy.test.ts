import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { dispatch } from "@invariance/tars-adapters";
import { captureEvent, newSalt, tarsPaths } from "@invariance/tars-core";

/**
 * Privacy-regression gate: drive adversarial payloads through the REAL path
 * (adapter dispatch → capture → disk) and assert that no sensitive literal ever
 * appears in any stored byte. This is the test the CI workflow exists to run.
 */
describe("privacy regression (adapter → capture → disk)", () => {
  const SECRETS = [
    "sk-abcdefghijklmnopqrstuvwxyz123",
    "ghp_0123456789abcdefghijABCDEFGHIJ0123",
    "jane.doe@example.com",
    "/Users/jane/secret/project/app.ts",
    "implement the secret billing flow",
    "conv_native_session_4242",
  ];

  it("stores none of the adversarial literals", () => {
    const paths = tarsPaths(mkdtempSync(join(tmpdir(), "tars-priv-")));
    const salt = newSalt();

    const payloads: Array<["claude" | "codex" | "cursor", unknown]> = [
      ["claude", { hook_event_name: "UserPromptSubmit", session_id: "conv_native_session_4242", prompt: "implement the secret billing flow with key sk-abcdefghijklmnopqrstuvwxyz123, ping jane.doe@example.com" }],
      ["claude", { hook_event_name: "PostToolUse", session_id: "conv_native_session_4242", tool_name: "Edit", tool_input: { file_path: "/Users/jane/secret/project/app.ts" } }],
      ["claude", { hook_event_name: "PostToolUse", session_id: "conv_native_session_4242", tool_name: "Bash", tool_input: { command: "deploy --token=ghp_0123456789abcdefghijABCDEFGHIJ0123" } }],
      ["cursor", { hook_event_name: "afterFileEdit", conversation_id: "conv_native_session_4242", file_path: "/Users/jane/secret/project/app.ts" }],
      ["claude", { hook_event_name: "Stop", session_id: "conv_native_session_4242" }],
    ];

    for (const [surface, payload] of payloads) {
      const ev = dispatch(surface, payload);
      if (ev) captureEvent(paths, salt, ev);
    }

    const files = readdirSync(paths.sessionsDir);
    expect(files.length).toBeGreaterThan(0);
    const allBytes = files.map((f) => readFileSync(join(paths.sessionsDir, f), "utf8")).join("\n");

    for (const secret of SECRETS) {
      expect(allBytes).not.toContain(secret);
    }
  });
});

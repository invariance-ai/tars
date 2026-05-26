import { describe, expect, it } from "vitest";

import { dispatch } from "./index.js";

describe("dispatch", () => {
  it("maps Claude UserPromptSubmit/PostToolUse/Stop", () => {
    expect(dispatch("claude", { hook_event_name: "UserPromptSubmit", prompt: "do X" })?.kind).toBe("prompt_submit");
    const action = dispatch("claude", {
      hook_event_name: "PostToolUse",
      tool_name: "Edit",
      tool_input: { file_path: "/a/b.ts" },
    });
    expect(action?.kind).toBe("tool_action");
    if (action?.kind === "tool_action") expect(action.action).toBe("edit");
    expect(dispatch("claude", { hook_event_name: "Stop" })?.kind).toBe("session_end");
  });

  it("detects a failed Claude Bash test via exit code", () => {
    const ev = dispatch("claude", {
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_input: { command: "npm test" },
      tool_response: { exit_code: 1 },
    });
    expect(ev?.kind).toBe("tool_action");
    if (ev?.kind === "tool_action") {
      expect(ev.action).toBe("shell");
      expect(ev.failed).toBe(true);
      expect(ev.command).toBe("npm test");
    }
  });

  it("maps Codex apply_patch to edit", () => {
    const ev = dispatch("codex", { hook_event_name: "PostToolUse", tool_name: "apply_patch", tool_input: { path: "/x.ts" } });
    if (ev?.kind === "tool_action") expect(ev.action).toBe("edit");
  });

  it("maps Cursor lifecycle events and preserves stop status", () => {
    expect(dispatch("cursor", { hook_event_name: "beforeSubmitPrompt", prompt: "hi" })?.kind).toBe("prompt_submit");
    expect(dispatch("cursor", { hook_event_name: "afterFileEdit", file_path: "/x.ts" })?.kind).toBe("tool_action");
    const stop = dispatch("cursor", { hook_event_name: "stop", status: "aborted" });
    expect(stop?.kind).toBe("session_end");
    if (stop?.kind === "session_end") expect(stop.status).toBe("aborted");
  });

  it("ignores irrelevant events (keeps capture lean)", () => {
    expect(dispatch("claude", { hook_event_name: "PreToolUse" })).toBeUndefined();
    expect(dispatch("claude", { hook_event_name: "Notification" })).toBeUndefined();
    expect(dispatch("cursor", { hook_event_name: "afterShellExecution" })).toBeUndefined();
  });
});

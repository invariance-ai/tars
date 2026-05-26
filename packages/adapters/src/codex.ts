import type { Action, NormalizedEvent } from "@invariance/tars-core";

/**
 * Codex hook payloads (JSON on stdin). Codex exposes the same event family as Claude
 * Code (`UserPromptSubmit`, `PostToolUse`, `Stop`) plus a `turn_id`/`permission_mode`.
 * As elsewhere, only tool-relevant events are normalized; everything else is dropped.
 */

interface CodexPayload {
  hook_event_name?: string;
  session_id?: string;
  prompt?: string;
  tool_name?: string;
  tool_input?: { path?: string; file_path?: string; command?: string; [k: string]: unknown };
  tool_result?: { exit_code?: number; success?: boolean; [k: string]: unknown };
}

function classify(name: string | undefined, command: string | undefined): Action {
  if (name === "apply_patch" || name === "edit") return "edit";
  if (name === "write_file" || name === "create_file") return "write";
  if (name === "read_file" || name === "search") return "read";
  if (name === "shell" || name === "bash" || command) return "shell";
  return "other";
}

export function fromCodex(payload: CodexPayload): NormalizedEvent | undefined {
  const at = new Date().toISOString();
  const sessionId = payload.session_id ?? "default";

  switch (payload.hook_event_name) {
    case "UserPromptSubmit":
      return { kind: "prompt_submit", surface: "codex", sessionId, prompt: payload.prompt ?? "", at };
    case "PostToolUse": {
      const command = payload.tool_input?.command;
      const exit = payload.tool_result?.exit_code;
      const failed = payload.tool_result?.success === false || (typeof exit === "number" && exit !== 0);
      const path = payload.tool_input?.path ?? payload.tool_input?.file_path;
      return {
        kind: "tool_action",
        surface: "codex",
        sessionId,
        action: classify(payload.tool_name, command),
        ...(path ? { path } : {}),
        ...(command ? { command } : {}),
        failed,
        at,
      };
    }
    case "Stop":
      return { kind: "session_end", surface: "codex", sessionId, status: "completed", at };
    default:
      return undefined;
  }
}

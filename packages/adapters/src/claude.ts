import type { Action, NormalizedEvent } from "@invariance/tars-core";

/**
 * Claude Code hook payloads (delivered as JSON on stdin).
 *
 * We only act on tool-relevant events — `UserPromptSubmit` (how the task is framed),
 * `PostToolUse` (the tool calls themselves), and `Stop` (session end). Anything else
 * is ignored, so chit-chat turns are never logged. The native `session_id` is passed
 * through; the capture layer hashes it (with the per-repo salt) before it touches disk.
 */

interface ClaudePayload {
  hook_event_name?: string;
  session_id?: string;
  prompt?: string;
  tool_name?: string;
  tool_input?: { file_path?: string; command?: string; [k: string]: unknown };
  tool_response?: { success?: boolean; exit_code?: number; [k: string]: unknown };
}

function classifyTool(name: string | undefined): Action {
  switch (name) {
    case "Edit":
    case "MultiEdit":
      return "edit";
    case "Write":
    case "NotebookEdit":
      return "write";
    case "Read":
    case "Glob":
    case "Grep":
      return "read";
    case "Bash":
      return "shell";
    default:
      return "other";
  }
}

export function fromClaude(payload: ClaudePayload): NormalizedEvent | undefined {
  const at = new Date().toISOString();
  const sessionId = payload.session_id ?? "default";

  switch (payload.hook_event_name) {
    case "UserPromptSubmit":
      return { kind: "prompt_submit", surface: "claude", sessionId, prompt: payload.prompt ?? "", at };
    case "PostToolUse": {
      const action = classifyTool(payload.tool_name);
      const command = payload.tool_input?.command;
      const exit = payload.tool_response?.exit_code;
      const failed = payload.tool_response?.success === false || (typeof exit === "number" && exit !== 0);
      return {
        kind: "tool_action",
        surface: "claude",
        sessionId,
        action,
        ...(payload.tool_input?.file_path ? { path: payload.tool_input.file_path } : {}),
        ...(command ? { command } : {}),
        failed,
        at,
      };
    }
    case "Stop":
      return { kind: "session_end", surface: "claude", sessionId, status: "completed", at };
    default:
      return undefined;
  }
}

import type { NormalizedEvent } from "@invariance/tars-core";

/**
 * Cursor hook payloads (`.cursor/hooks.json`, JSON on stdin). Cursor uses distinct
 * lifecycle event names and — usefully — gives us an explicit completion `status`
 * on `stop`, so the clean-stop signal is observed rather than inferred. These hooks
 * are observe-only (stdout can't steer Cursor); tars only observes, so that's fine.
 */

interface CursorPayload {
  hook_event_name?: "beforeSubmitPrompt" | "afterFileEdit" | "stop" | string;
  conversation_id?: string;
  generation_id?: string;
  prompt?: string;
  file_path?: string;
  status?: "completed" | "aborted" | "error";
}

export function fromCursor(payload: CursorPayload): NormalizedEvent | undefined {
  const at = new Date().toISOString();
  const sessionId = payload.conversation_id ?? "default";

  switch (payload.hook_event_name) {
    case "beforeSubmitPrompt":
      return { kind: "prompt_submit", surface: "cursor", sessionId, prompt: payload.prompt ?? "", at };
    case "afterFileEdit":
      return {
        kind: "tool_action",
        surface: "cursor",
        sessionId,
        action: "edit",
        ...(payload.file_path ? { path: payload.file_path } : {}),
        failed: false,
        at,
      };
    case "stop":
      return {
        kind: "session_end",
        surface: "cursor",
        sessionId,
        status: payload.status ?? "completed",
        at,
      };
    default:
      return undefined;
  }
}

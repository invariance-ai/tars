/**
 * The surface-agnostic event model.
 *
 * Every adapter (Claude Code, Codex, Cursor) normalizes its native hook payload
 * into one of these three shapes so the rest of core never needs to know which
 * agent produced it. Raw, un-redacted strings may appear on these structs — they
 * are the *input* to the redaction pipeline and must never be persisted directly.
 */

export type Surface = "claude" | "codex" | "cursor" | "manual";

/** Coarse tool-action category. The only action taxonomy adapters may emit. */
export type Action = "edit" | "write" | "read" | "test" | "shell" | "other";

/** The human is framing/originating a task (e.g. Claude `UserPromptSubmit`). */
export interface PromptSubmitEvent {
  kind: "prompt_submit";
  surface: Surface;
  sessionId: string;
  /** Raw prompt text — redacted before anything is stored. */
  prompt: string;
  at: string; // ISO timestamp
}

/** The agent took an action on the human's behalf (edit/write/read/test/shell). */
export interface ToolActionEvent {
  kind: "tool_action";
  surface: Surface;
  sessionId: string;
  /** Coarse action category derived by the adapter. */
  action: Action;
  /** Raw path, if any — hashed before storage. */
  path?: string;
  /** Did this action surface an error/failure (e.g. test non-zero exit). */
  failed?: boolean;
  /** For shell/test actions, the raw command — scanned + dropped before storage. */
  command?: string;
  at: string; // ISO timestamp
}

/** The session ended. Carries the agent's own completion signal where available. */
export interface SessionEndEvent {
  kind: "session_end";
  surface: Surface;
  sessionId: string;
  /** Cursor gives this directly; others inferred. */
  status: "completed" | "aborted" | "error";
  at: string; // ISO timestamp
}

export type NormalizedEvent =
  | PromptSubmitEvent
  | ToolActionEvent
  | SessionEndEvent;

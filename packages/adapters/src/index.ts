import type { NormalizedEvent, Surface } from "@invariance/tars-core";

import { fromClaude } from "./claude.js";
import { fromCodex } from "./codex.js";
import { fromCursor } from "./cursor.js";

export { fromClaude, fromCodex, fromCursor };

/** Read a full JSON document from stdin (how every agent delivers hook payloads). */
export async function readStdinJson(): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

/**
 * Normalize a raw payload for a given surface into a tars event. Returns undefined
 * for events we intentionally ignore (anything not tied to tool calls / framing),
 * which keeps capture token-efficient — only valuable orchestration signal is kept.
 */
export function dispatch(surface: Surface, payload: unknown): NormalizedEvent | undefined {
  const p = (payload ?? {}) as Record<string, unknown>;
  switch (surface) {
    case "claude":
      return fromClaude(p);
    case "codex":
      return fromCodex(p);
    case "cursor":
      return fromCursor(p);
    default:
      return undefined;
  }
}

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { Surface } from "@invariance/tars-core";

/**
 * Writes (and removes) tars hook blocks into each agent's config, idempotently and
 * non-destructively: existing hooks are preserved, ours are de-duplicated by command.
 *
 * We register only on tool-relevant lifecycle events — prompt framing, tool calls, and
 * session end — so nothing else is ever invoked. That keeps capture to valuable
 * orchestration signal and avoids per-message overhead.
 */

const CMD = (s: Surface) => `tars hook ${s}`;

function readJson(file: string): any {
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function writeJson(file: string, data: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

/** Append a command hook to an event group unless an identical command already exists. */
function addHook(groups: any[], command: string, matcher?: string): any[] {
  const list = Array.isArray(groups) ? groups : [];
  const already = list.some((g) => (g?.hooks ?? []).some((h: any) => h?.command === command));
  if (already) return list;
  const entry: any = { hooks: [{ type: "command", command }] };
  if (matcher) entry.matcher = matcher;
  return [...list, entry];
}

function removeHook(groups: any[], command: string): any[] {
  if (!Array.isArray(groups)) return [];
  return groups
    .map((g) => ({ ...g, hooks: (g?.hooks ?? []).filter((h: any) => h?.command !== command) }))
    .filter((g) => (g.hooks ?? []).length > 0);
}

// ---- Claude Code: .claude/settings.json ----
function claudeFile(root: string) {
  return join(root, ".claude", "settings.json");
}
export function installClaude(root: string): string {
  const file = claudeFile(root);
  const cfg = readJson(file);
  cfg.hooks ??= {};
  cfg.hooks.UserPromptSubmit = addHook(cfg.hooks.UserPromptSubmit, CMD("claude"));
  cfg.hooks.PostToolUse = addHook(cfg.hooks.PostToolUse, CMD("claude"), "Edit|Write|MultiEdit|Read|Grep|Glob|Bash|NotebookEdit");
  cfg.hooks.Stop = addHook(cfg.hooks.Stop, CMD("claude"));
  writeJson(file, cfg);
  return file;
}
export function uninstallClaude(root: string): void {
  const file = claudeFile(root);
  if (!existsSync(file)) return;
  const cfg = readJson(file);
  if (!cfg.hooks) return;
  for (const ev of ["UserPromptSubmit", "PostToolUse", "Stop"]) {
    if (cfg.hooks[ev]) cfg.hooks[ev] = removeHook(cfg.hooks[ev], CMD("claude"));
  }
  writeJson(file, cfg);
}

// ---- Codex: .codex/hooks.json ----
function codexFile(root: string) {
  return join(root, ".codex", "hooks.json");
}
export function installCodex(root: string): string {
  const file = codexFile(root);
  const cfg = readJson(file);
  cfg.hooks ??= {};
  cfg.hooks.UserPromptSubmit = addHook(cfg.hooks.UserPromptSubmit, CMD("codex"));
  cfg.hooks.PostToolUse = addHook(cfg.hooks.PostToolUse, CMD("codex"), "apply_patch|shell|write_file|read_file");
  cfg.hooks.Stop = addHook(cfg.hooks.Stop, CMD("codex"));
  writeJson(file, cfg);
  return file;
}
export function uninstallCodex(root: string): void {
  const file = codexFile(root);
  if (!existsSync(file)) return;
  const cfg = readJson(file);
  if (!cfg.hooks) return;
  for (const ev of ["UserPromptSubmit", "PostToolUse", "Stop"]) {
    if (cfg.hooks[ev]) cfg.hooks[ev] = removeHook(cfg.hooks[ev], CMD("codex"));
  }
  writeJson(file, cfg);
}

// ---- Cursor: .cursor/hooks.json ----
function cursorFile(root: string) {
  return join(root, ".cursor", "hooks.json");
}
export function installCursor(root: string): string {
  const file = cursorFile(root);
  const cfg = readJson(file);
  cfg.version ??= 1;
  cfg.hooks ??= {};
  cfg.hooks.beforeSubmitPrompt = addHook(cfg.hooks.beforeSubmitPrompt, CMD("cursor"));
  cfg.hooks.afterFileEdit = addHook(cfg.hooks.afterFileEdit, CMD("cursor"));
  cfg.hooks.stop = addHook(cfg.hooks.stop, CMD("cursor"));
  writeJson(file, cfg);
  return file;
}
export function uninstallCursor(root: string): void {
  const file = cursorFile(root);
  if (!existsSync(file)) return;
  const cfg = readJson(file);
  if (!cfg.hooks) return;
  for (const ev of ["beforeSubmitPrompt", "afterFileEdit", "stop"]) {
    if (cfg.hooks[ev]) cfg.hooks[ev] = removeHook(cfg.hooks[ev], CMD("cursor"));
  }
  writeJson(file, cfg);
}

export function installSurface(root: string, surface: Surface): string | undefined {
  if (surface === "claude") return installClaude(root);
  if (surface === "codex") return installCodex(root);
  if (surface === "cursor") return installCursor(root);
  return undefined;
}

export function uninstallSurface(root: string, surface: Surface): void {
  if (surface === "claude") uninstallClaude(root);
  else if (surface === "codex") uninstallCodex(root);
  else if (surface === "cursor") uninstallCursor(root);
}

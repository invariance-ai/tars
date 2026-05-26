import { readFileSync } from "node:fs";
import kleur from "kleur";

import { captureEvent, requireConfig, sessionNonce } from "@invariance/tars-core";

import { resolvePaths } from "../root.js";
import { writeDigest } from "./shared.js";

/**
 * Manual capture for sessions without a live hook (or to annotate). Reads a prompt from
 * --prompt-file or stdin, runs it through the same redaction pipeline, and closes the
 * session. Surface is "manual". Only structure is stored — never the prompt text.
 */
export async function captureCommand(opts: { promptFile?: string; root?: string }): Promise<void> {
  const paths = resolvePaths(opts.root);
  const cfg = requireConfig(paths);

  let prompt = "";
  if (opts.promptFile && opts.promptFile !== "-") {
    prompt = readFileSync(opts.promptFile, "utf8");
  } else if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const c of process.stdin) chunks.push(c as Buffer);
    prompt = Buffer.concat(chunks).toString("utf8");
  }

  const sessionId = sessionNonce();
  const now = new Date().toISOString();
  captureEvent(paths, cfg.salt, { kind: "prompt_submit", surface: "manual", sessionId, prompt, at: now });
  captureEvent(paths, cfg.salt, { kind: "session_end", surface: "manual", sessionId, status: "completed", at: now });

  writeDigest(paths, cfg);
  console.log(kleur.green("captured") + " a manual session (structure only) and refreshed the digest.");
}

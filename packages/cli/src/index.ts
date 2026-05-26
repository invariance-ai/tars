#!/usr/bin/env node
import { Command } from "commander";

import type { Surface } from "@invariance/tars-core";

import { TARS_VERSION } from "./root.js";
import { captureCommand } from "./commands/capture.js";
import { digestCommand } from "./commands/digest.js";
import { hookCommand } from "./commands/hook.js";
import { initCommand } from "./commands/init.js";
import { signupCommand } from "./commands/signup.js";
import { statusCommand } from "./commands/status.js";
import { uploadCommand } from "./commands/upload.js";
import { wipeCommand } from "./commands/wipe.js";

const program = new Command();

program
  .name("tars")
  .description("Anonymous, opt-in orchestration telemetry for AI coding agents.")
  .version(TARS_VERSION);

program
  .command("init")
  .description("Set up tars in this repo and install agent hooks")
  .option("--surface <list>", "comma-separated: claude,codex,cursor (default: all)")
  .option("--root <path>", "repo root (default: auto-detected)")
  .action((opts) => initCommand(opts));

program
  .command("hook <surface>")
  .description("Hook entry point invoked by an agent (reads a JSON event on stdin)")
  .action(async (surface: string) => {
    await hookCommand(surface as Surface);
    process.exit(0); // never let a non-zero status disrupt the agent
  });

program
  .command("capture")
  .description("Manually capture a session (reads a prompt from --prompt-file or stdin)")
  .option("--prompt-file <path>", "file to read the prompt from, or '-' for stdin")
  .option("--root <path>", "repo root")
  .action((opts) => captureCommand({ promptFile: opts.promptFile, root: opts.root }));

program
  .command("digest")
  .description("Recompute the local, exportable digest (no network)")
  .option("--print", "print the digest to stdout")
  .option("--out <path>", "also write the digest to this path")
  .option("--json", "emit machine-readable stats + session summaries")
  .option("--root <path>", "repo root")
  .action((opts) => digestCommand(opts));

program
  .command("signup")
  .description("Sign up with GitHub (anonymous) to enable opt-in upload")
  .option("--root <path>", "repo root")
  .action((opts) => signupCommand(opts));

program
  .command("upload")
  .description("Preview and opt-in upload pending positive sessions")
  .option("--dry-run", "preview exactly what would be sent, send nothing")
  .option("--yes", "skip the confirmation prompt")
  .option("--root <path>", "repo root")
  .action((opts) => uploadCommand({ dryRun: opts.dryRun, yes: opts.yes, root: opts.root }));

program
  .command("status")
  .description("Show consent state, capture counts, and the repo fingerprint")
  .option("--json", "emit JSON")
  .option("--root <path>", "repo root")
  .action((opts) => statusCommand(opts));

program
  .command("wipe")
  .description("Delete tars data: --local, --remote, or --all (default: --local)")
  .option("--local", "clear on-disk capture (sessions, outbox, digest)")
  .option("--remote", "purge your uploaded rows server-side")
  .option("--all", "both, plus remove hooks + credentials and reset consent")
  .option("--root <path>", "repo root")
  .action((opts) => wipeCommand(opts));

program.parseAsync(process.argv);

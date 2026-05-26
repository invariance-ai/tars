import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { installClaude, installCursor, uninstallClaude } from "./install.js";

function freshRoot(): string {
  return mkdtempSync(join(tmpdir(), "tars-install-"));
}

describe("hook install", () => {
  it("installs Claude hooks on tool-relevant events only", () => {
    const root = freshRoot();
    const file = installClaude(root);
    const cfg = JSON.parse(readFileSync(file, "utf8"));
    expect(Object.keys(cfg.hooks).sort()).toEqual(["PostToolUse", "Stop", "UserPromptSubmit"]);
    expect(cfg.hooks.PostToolUse[0].hooks[0].command).toBe("tars hook claude");
    expect(cfg.hooks.PostToolUse[0].matcher).toContain("Edit");
  });

  it("is idempotent and preserves foreign hooks", () => {
    const root = freshRoot();
    mkdirSync(join(root, ".claude"), { recursive: true });
    writeFileSync(
      join(root, ".claude", "settings.json"),
      JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "other-tool" }] }] } }),
    );
    installClaude(root);
    installClaude(root); // twice — must not duplicate
    const cfg = JSON.parse(readFileSync(join(root, ".claude", "settings.json"), "utf8"));
    const stopCommands = cfg.hooks.Stop.flatMap((g: any) => g.hooks.map((h: any) => h.command));
    expect(stopCommands).toContain("other-tool");
    expect(stopCommands.filter((c: string) => c === "tars hook claude")).toHaveLength(1);
  });

  it("uninstall removes only tars hooks", () => {
    const root = freshRoot();
    installClaude(root);
    uninstallClaude(root);
    const cfg = JSON.parse(readFileSync(join(root, ".claude", "settings.json"), "utf8"));
    const all = Object.values(cfg.hooks).flatMap((groups: any) =>
      (groups as any[]).flatMap((g) => g.hooks.map((h: any) => h.command)),
    );
    expect(all).not.toContain("tars hook claude");
  });

  it("Cursor install sets version and lifecycle hooks", () => {
    const root = freshRoot();
    const file = installCursor(root);
    const cfg = JSON.parse(readFileSync(file, "utf8"));
    expect(cfg.version).toBe(1);
    expect(Object.keys(cfg.hooks).sort()).toEqual(["afterFileEdit", "beforeSubmitPrompt", "stop"]);
  });
});

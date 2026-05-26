import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clearCredentials, loadCredentials, saveCredentials } from "./credentials.js";

describe("credentials", () => {
  let prev: string | undefined;

  beforeEach(() => {
    prev = process.env.TARS_CONFIG_HOME;
    process.env.TARS_CONFIG_HOME = mkdtempSync(join(tmpdir(), "tars-cred-"));
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.TARS_CONFIG_HOME;
    else process.env.TARS_CONFIG_HOME = prev;
  });

  it("round-trips and stores tokens 0600", () => {
    expect(loadCredentials()).toBeUndefined();
    saveCredentials({ contributorId: "abc", accessToken: "tok" });
    const loaded = loadCredentials();
    expect(loaded?.contributorId).toBe("abc");

    const file = join(process.env.TARS_CONFIG_HOME!, "credentials.json");
    expect(statSync(file).mode & 0o777).toBe(0o600);
  });

  it("clears credentials", () => {
    saveCredentials({ contributorId: "abc", accessToken: "tok" });
    clearCredentials();
    expect(loadCredentials()).toBeUndefined();
  });
});

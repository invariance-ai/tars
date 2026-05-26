import { createServer } from "node:http";
import { exec } from "node:child_process";

import { authClient, resolveEndpoint, type TarsEndpoint } from "./client.js";
import { saveCredentials, type Credentials } from "./credentials.js";

/**
 * GitHub signup via Supabase Auth using a loopback PKCE flow — the standard,
 * browser-free-ish pattern for CLIs:
 *
 *   1. Ask Supabase for a GitHub authorize URL (PKCE, redirect to a local loopback).
 *   2. Open it; the user authorizes with GitHub.
 *   3. A one-shot local server catches the `?code=...` redirect.
 *   4. Exchange the code for a Supabase session.
 *   5. Call `tars_get_or_create_contributor()` to mint/fetch the opaque contributor UUID.
 *
 * The GitHub identity stays inside Supabase `auth.users`; the CLI only ever learns the
 * opaque UUID and a session token. Re-identification is server-side and RLS-forbidden.
 */

function openBrowser(url: string): void {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  exec(`${cmd} "${url}"`, () => {
    /* if it fails, the URL is also printed for manual open */
  });
}

interface LoopbackResult {
  code: string;
  port: number;
}

function awaitLoopback(): Promise<LoopbackResult> & { url: () => string } {
  let port = 0;
  const promise = new Promise<LoopbackResult>((resolve, reject) => {
    const server = createServer((req, res) => {
      const u = new URL(req.url ?? "/", `http://localhost:${port}`);
      const code = u.searchParams.get("code");
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<html><body><h2>tars: signed in. You can close this tab.</h2></body></html>");
      server.close();
      if (code) resolve({ code, port });
      else reject(new Error("No authorization code returned from GitHub."));
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr && typeof addr === "object") port = addr.port;
    });
  });
  return Object.assign(promise, { url: () => `http://127.0.0.1:${port}` });
}

export interface SignupResult {
  contributorId: string;
}

export async function signup(endpoint: TarsEndpoint = resolveEndpoint()): Promise<SignupResult> {
  if (!endpoint.anonKey) {
    throw new Error("No Supabase anon key configured. Set TARS_SUPABASE_URL and TARS_SUPABASE_ANON_KEY.");
  }
  const supabase = authClient(endpoint);
  const loopback = awaitLoopback();
  const redirectTo = loopback.url();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo, skipBrowserRedirect: true, scopes: "read:user" },
  });
  if (error || !data?.url) throw new Error(`Could not start GitHub sign-in: ${error?.message ?? "unknown"}`);

  console.log(`\nOpening GitHub sign-in… if it doesn't open, visit:\n${data.url}\n`);
  openBrowser(data.url);

  const { code } = await loopback;
  const { data: session, error: exErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exErr || !session.session) throw new Error(`Sign-in failed: ${exErr?.message ?? "no session"}`);

  const accessToken = session.session.access_token;
  const bound = authClient(endpoint);
  await bound.auth.setSession({ access_token: accessToken, refresh_token: session.session.refresh_token });

  const { data: contributorId, error: rpcErr } = await bound.rpc("tars_get_or_create_contributor");
  if (rpcErr || typeof contributorId !== "string") {
    throw new Error(`Could not provision contributor id: ${rpcErr?.message ?? "unexpected response"}`);
  }

  const creds: Credentials = {
    contributorId,
    accessToken,
    refreshToken: session.session.refresh_token,
    expiresAt: session.session.expires_at,
  };
  saveCredentials(creds);
  return { contributorId };
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client factory.
 *
 * The CLI talks to Supabase with the public anon key plus the contributor's user JWT,
 * so every read/write is subject to RLS (a contributor can only insert/delete their own
 * rows and can never read the corpus). The service role key is never shipped or used here.
 */

export interface TarsEndpoint {
  url: string;
  anonKey: string;
}

// Public defaults for the hosted tars backend; overridable for local dev / self-hosting.
const DEFAULT_URL = "https://tars.useinvariance.com";
const DEFAULT_ANON_KEY = "";

export function resolveEndpoint(): TarsEndpoint {
  return {
    url: process.env.TARS_SUPABASE_URL ?? DEFAULT_URL,
    anonKey: process.env.TARS_SUPABASE_ANON_KEY ?? DEFAULT_ANON_KEY,
  };
}

/** An anonymous client used to drive the OAuth/PKCE login flow. */
export function authClient(endpoint: TarsEndpoint = resolveEndpoint()): SupabaseClient {
  return createClient(endpoint.url, endpoint.anonKey, {
    auth: { flowType: "pkce", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** A client bound to a contributor's session token — all calls flow through RLS. */
export function userClient(accessToken: string, endpoint: TarsEndpoint = resolveEndpoint()): SupabaseClient {
  return createClient(endpoint.url, endpoint.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

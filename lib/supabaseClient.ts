import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client (public anon key + RLS).
 *
 * IMPORTANT: returns a SINGLETON. Creating a fresh browser client per component
 * spins up multiple GoTrueClient instances that share the same cookie/storage.
 * When the access token expires, several instances try to refresh at once and
 * refresh-token rotation invalidates the session for the others — which logged
 * users out at random (e.g. after check-out). One instance = no refresh races.
 */
let browserClient: SupabaseClient | undefined;

export function createClient(): SupabaseClient {
  if (browserClient) return browserClient;
  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return browserClient;
}

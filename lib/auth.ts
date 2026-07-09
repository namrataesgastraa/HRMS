import { createClient } from "./supabaseServer";
import type { Profile } from "./types";

export interface CurrentUser {
  id: string;
  email: string | null;
  profile: Profile | null;
}

/**
 * Server-side helper: the authenticated user + their profile row, or null if
 * not signed in. Use in Server Components / Server Actions.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? null,
    profile: (profile as Profile | null) ?? null,
  };
}

/** Home route for a role. */
export function homePathForRole(role: string | undefined): string {
  return role === "admin" ? "/admin" : "/dashboard";
}

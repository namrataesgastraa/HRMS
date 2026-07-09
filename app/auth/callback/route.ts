import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";

/**
 * OAuth (Google) callback. Exchanges the returned code for a session cookie,
 * then hands off to the app — the proxy takes it from there (new users with an
 * incomplete profile are routed to /onboarding exactly like email sign-ups).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}

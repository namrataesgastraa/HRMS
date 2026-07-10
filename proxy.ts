import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Next 16 renamed the `middleware` file convention to `proxy` (same behavior).
// This is the auth guard described as "middleware" in the build spec.

/** Routes reachable without authentication. */
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth",
  "/icon",
  "/apple-icon",
  "/manifest.webmanifest",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

export async function proxy(request: NextRequest) {
  // Start with a passthrough response we can attach refreshed cookies to.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const url = request.nextUrl.clone();

  // Build a redirect that CARRIES the (possibly refreshed) auth cookies from
  // `response`. Returning a bare NextResponse.redirect() would drop a token
  // refresh that happened during getUser(), corrupting the session.
  const redirect = (to: URL) => {
    const res = NextResponse.redirect(to);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  // 1. Unauthenticated → allow public routes, else send to /login.
  if (!user) {
    if (isPublic(pathname)) return response;
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", pathname);
    return redirect(url);
  }

  // Authenticated: look up role + onboarding status.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, profile_completed")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "employee";
  const completed = profile?.profile_completed ?? false;
  const home = role === "admin" ? "/admin" : "/dashboard";

  // 2. Signed-in users shouldn't sit on /login → bounce to their home.
  if (pathname === "/login") {
    url.pathname = home;
    url.search = "";
    return redirect(url);
  }

  // 3. Employees may not access /admin/*.
  if (pathname.startsWith("/admin") && role !== "admin") {
    url.pathname = "/dashboard";
    return redirect(url);
  }

  // 4. Employees with incomplete profiles are forced to /onboarding.
  if (role !== "admin" && !completed && pathname !== "/onboarding") {
    url.pathname = "/onboarding";
    return redirect(url);
  }

  // 5. Already-onboarded employees shouldn't revisit /onboarding.
  if (completed && pathname === "/onboarding") {
    url.pathname = "/dashboard";
    return redirect(url);
  }

  return response;
}

export const config = {
  // Run on everything except static assets and files with an extension.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

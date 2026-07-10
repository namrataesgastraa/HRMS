"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/ui/Logo";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") === "oauth"
      ? "Google sign-in didn't complete. Please try again."
      : null,
  );

  async function signInWithGoogle() {
    setError(null);
    setGoogleLoading(true);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) {
      setGoogleLoading(false);
      setError(
        /provider is not enabled/i.test(oauthError.message)
          ? "Google sign-in isn't enabled yet. Ask your admin to turn it on."
          : oauthError.message,
      );
    }
    // On success the browser redirects to Google; nothing else to do here.
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword(
      { email: email.trim(), password },
    );

    if (signInError || !data.user) {
      setLoading(false);
      setError(
        signInError?.message?.toLowerCase().includes("invalid")
          ? "Incorrect email or password. Please try again."
          : signInError?.message ?? "Unable to sign in. Please try again.",
      );
      return;
    }

    // Route by role + onboarding status.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, profile_completed")
      .eq("id", data.user.id)
      .single();

    const redirectedFrom = params.get("redirectedFrom");
    let target = "/dashboard";
    if (profile?.role === "admin") target = "/admin";
    else if (!profile?.profile_completed) target = "/onboarding";
    else if (redirectedFrom && !redirectedFrom.startsWith("/admin"))
      target = redirectedFrom;

    router.replace(target);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@esgastraa.com"
        leftIcon={<Mail className="h-4 w-4" />}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <div className="relative">
        <Input
          label="Password"
          type={showPw ? "text" : "password"}
          autoComplete="current-password"
          placeholder="••••••••"
          leftIcon={<Lock className="h-4 w-4" />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          type="button"
          onClick={() => setShowPw((s) => !s)}
          aria-label={showPw ? "Hide password" : "Show password"}
          className="absolute right-3 top-[34px] text-gray-400 transition-colors hover:text-dark-base"
        >
          {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      <div className="-mt-2 text-right">
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-electric-violet hover:underline"
        >
          Forgot password?
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      <Button type="submit" fullWidth size="lg" loading={loading}>
        Sign in
      </Button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-gray-200" />
        <span className="text-xs font-medium text-gray-400">or</span>
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      {/* Google OAuth */}
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={googleLoading}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-dark-base transition-colors hover:bg-gray-50 disabled:opacity-60"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
          />
        </svg>
        {googleLoading ? "Redirecting…" : "Continue with Google"}
      </button>

      <p className="text-center text-sm text-gray-500">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-semibold text-electric-violet hover:underline"
        >
          Create one
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen">
      {/* Brand panel (desktop) */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-dark-base p-12 text-white lg:flex">
        <div className="absolute inset-0 opacity-20 bg-gradient-primary" aria-hidden />
        <div className="relative rounded-2xl bg-white/95 px-4 py-3 shadow-soft w-fit">
          <Logo className="h-10" />
        </div>
        <div className="relative">
          <h1 className="text-4xl font-extrabold leading-tight">
            Attendance, tasks &amp; team —
            <br />
            <span className="text-gradient-primary">one workspace.</span>
          </h1>
          <p className="mt-4 max-w-sm text-white/60">
            Mark attendance, log daily proof of work, and stay in sync with the
            team. Built for the ESG Astraa crew.
          </p>
        </div>
        <p className="relative text-xs text-white/30">
          © {" "}
          {/* year rendered client-safe */}
          ESG Astraa · Internal HRMS
        </p>
      </div>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo className="h-10" />
          </div>
          <h2 className="text-2xl font-bold text-dark-base">Welcome back</h2>
          <p className="mb-8 mt-1 text-sm text-gray-500">
            Sign in to your ESG Astraa account.
          </p>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

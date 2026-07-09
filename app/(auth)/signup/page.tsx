"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, User, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/ui/Logo";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);

    // NOTE: role is intentionally NOT sent — new accounts are always employees.
    // Admins are promoted separately (see migration 0004 hardening the trigger).
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });

    setLoading(false);

    if (signUpError) {
      setError(
        /already registered|exists/i.test(signUpError.message)
          ? "An account with this email already exists. Try signing in."
          : signUpError.message,
      );
      return;
    }

    // If email confirmation is required, there's no session yet.
    if (!data.session) {
      setConfirmSent(true);
      return;
    }
    // Otherwise (auto-confirm on) → straight into onboarding.
    router.replace("/onboarding");
    router.refresh();
  }

  if (confirmSent) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
        <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-dark-base">Check your email</h1>
          <p className="mt-2 text-sm text-gray-500">
            We sent a confirmation link to{" "}
            <span className="font-medium text-dark-base">{email}</span>. Click it
            to activate your account, then sign in.
          </p>
          <Link href="/login" className="mt-6 block">
            <Button fullWidth>Back to sign in</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-dark-base p-12 text-white lg:flex">
        <div className="absolute inset-0 bg-gradient-primary opacity-20" aria-hidden />
        <div className="relative w-fit rounded-2xl bg-white/95 px-4 py-3 shadow-soft">
          <Logo className="h-10" />
        </div>
        <div className="relative">
          <h1 className="text-4xl font-extrabold leading-tight">
            Join the <span className="text-gradient-primary">team workspace.</span>
          </h1>
          <p className="mt-4 max-w-sm text-white/60">
            Create your account to mark attendance, log daily work, and stay in
            sync with the ESG Astraa team.
          </p>
        </div>
        <p className="relative text-xs text-white/30">ESG Astraa · Internal HRMS</p>
      </div>

      {/* Form */}
      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo className="h-10" />
          </div>
          <h2 className="text-2xl font-bold text-dark-base">Create your account</h2>
          <p className="mb-8 mt-1 text-sm text-gray-500">
            It only takes a minute.
          </p>

          <form onSubmit={onSubmit} className="space-y-5">
            <Input
              label="Full name"
              placeholder="Jane Doe"
              leftIcon={<User className="h-4 w-4" />}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
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
                autoComplete="new-password"
                placeholder="At least 8 characters"
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

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-600">
                {error}
              </div>
            )}

            <Button type="submit" fullWidth size="lg" loading={loading}>
              Create account
            </Button>

            <p className="text-center text-sm text-gray-500">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-electric-violet hover:underline"
              >
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}

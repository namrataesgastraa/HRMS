"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/ui/Logo";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: rErr } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/reset-password` },
    );
    setLoading(false);
    if (rErr) {
      setError(rErr.message);
      return;
    }
    setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Logo className="h-10" />
        </div>

        {sent ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-card">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-bold text-dark-base">Check your email</h1>
            <p className="mt-2 text-sm text-gray-500">
              If an account exists for{" "}
              <span className="font-medium text-dark-base">{email}</span>, we sent
              a link to reset your password. It expires shortly.
            </p>
            <Link href="/login" className="mt-6 block">
              <Button fullWidth>Back to sign in</Button>
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-dark-base">Forgot password?</h1>
            <p className="mb-8 mt-1 text-sm text-gray-500">
              Enter your email and we&apos;ll send you a reset link.
            </p>
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
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-600">
                  {error}
                </div>
              )}
              <Button type="submit" fullWidth size="lg" loading={loading}>
                Send reset link
              </Button>
              <Link
                href="/login"
                className="flex items-center justify-center gap-1.5 text-sm font-medium text-gray-500 hover:text-dark-base"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </Link>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

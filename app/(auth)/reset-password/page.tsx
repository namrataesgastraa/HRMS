"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/ui/Logo";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();

  const [ready, setReady] = useState<boolean | null>(null); // recovery session?
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (!settled) {
        settled = true;
        setReady(ok);
      }
    };

    // The client processes the recovery link (?code=… or #token) on load and
    // fires an auth event once the recovery session is established.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish(true);
    });

    // If a link carried an explicit error, surface "expired" immediately.
    const params = new URLSearchParams(
      window.location.hash.replace(/^#/, "") + "&" + window.location.search.replace(/^\?/, ""),
    );
    if (params.get("error") || params.get("error_code")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(
        params.get("error_description")?.replace(/\+/g, " ") ??
          "This reset link is invalid or has expired.",
      );
      finish(false);
    }

    // Session may already be present (client processed URL before listener).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) finish(true);
    });

    // Otherwise give the client time to exchange the token, then decide.
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      finish(!!data.session);
    }, 3000);

    return () => {
      clearTimeout(t);
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (pw !== pw2) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const { error: uErr } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (uErr) {
      setError(uErr.message);
      return;
    }
    setDone(true);
    await supabase.auth.signOut();
    setTimeout(() => router.replace("/login"), 1600);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Logo className="h-10" />
        </div>

        {done ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-card">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-bold text-dark-base">Password updated</h1>
            <p className="mt-2 text-sm text-gray-500">
              Redirecting you to sign in…
            </p>
          </div>
        ) : ready === false ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-card">
            <h1 className="text-xl font-bold text-dark-base">Link expired</h1>
            <p className="mt-2 text-sm text-gray-500">
              This reset link is invalid or has expired. Request a new one.
            </p>
            <Link href="/forgot-password" className="mt-6 block">
              <Button fullWidth>Request a new link</Button>
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-dark-base">Set a new password</h1>
            <p className="mb-8 mt-1 text-sm text-gray-500">
              Choose a strong password you don&apos;t use elsewhere.
            </p>
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="relative">
                <Input
                  label="New password"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  leftIcon={<Lock className="h-4 w-4" />}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
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
              <Input
                label="Confirm new password"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Re-enter password"
                leftIcon={<Lock className="h-4 w-4" />}
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                required
              />
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-600">
                  {error}
                </div>
              )}
              <Button
                type="submit"
                fullWidth
                size="lg"
                loading={loading}
                disabled={ready === null}
              >
                Update password
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

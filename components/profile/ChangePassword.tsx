"use client";

import { useMemo, useState } from "react";
import { KeyRound, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

/** Lets a signed-in user change their own password. */
export function ChangePassword() {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (pw.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "error" });
      return;
    }
    if (pw !== pw2) {
      toast({ title: "Passwords don't match", variant: "error" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't update password", description: error.message, variant: "error" });
      return;
    }
    setPw("");
    setPw2("");
    toast({ title: "Password updated ✓", variant: "success" });
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-electric-violet" />
        <h2 className="text-base font-bold text-dark-base">Change password</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="relative">
          <Input
            label="New password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-3 top-[34px] text-gray-400 transition-colors hover:text-dark-base"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <Input
          label="Confirm new password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Re-enter password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
        />
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={save} loading={saving} disabled={!pw || !pw2}>
          Update password
        </Button>
      </div>
    </div>
  );
}

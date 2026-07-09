"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";

/** Standalone sign-out button (used on screens without the full app shell). */
export function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={signOut}
      leftIcon={<LogOut className="h-4 w-4" />}
    >
      Sign out
    </Button>
  );
}

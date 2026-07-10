"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { AppShell } from "@/components/ui/AppShell";
import { useUnreadChat } from "@/lib/useUnreadChat";
import { useUnreadMeetings } from "@/lib/useUnreadMeetings";
import type { UserRole } from "@/lib/constants";

interface Props {
  role: UserRole;
  user?: { name?: string | null; email?: string | null; avatarUrl?: string | null };
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Client wrapper around <AppShell> that wires sign-out to the Supabase browser
 * client. Server pages pass the already-resolved role/user down.
 */
export function AppShellClient({ role, user, title, actions, children }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const unreadChat = useUnreadChat();
  const unreadMeetings = useUnreadMeetings();

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <AppShell
      role={role}
      user={user}
      title={title}
      actions={actions}
      onSignOut={signOut}
      unreadChat={unreadChat}
      unreadMeetings={unreadMeetings}
    >
      {children}
    </AppShell>
  );
}

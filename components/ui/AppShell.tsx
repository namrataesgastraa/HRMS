"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/constants";

export interface AppShellProps {
  role: UserRole;
  user?: { name?: string | null; email?: string | null; avatarUrl?: string | null };
  title?: string;
  actions?: React.ReactNode;
  onSignOut?: () => void;
  unreadChat?: number;
  unreadMeetings?: number;
  children: React.ReactNode;
}

/**
 * The role-aware application shell: persistent sidebar on desktop, slide-in
 * drawer on mobile, and a sticky top bar. Wrap employee/admin pages with this.
 */
export function AppShell({
  role,
  user,
  title,
  actions,
  onSignOut,
  unreadChat,
  unreadMeetings,
  children,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          role={role}
          user={user}
          onSignOut={onSignOut}
          unreadChat={unreadChat}
          unreadMeetings={unreadMeetings}
          className="fixed inset-y-0 left-0"
        />
      </div>
      <div className="hidden w-64 shrink-0 lg:block" aria-hidden />

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-40 lg:hidden",
          drawerOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <div
          className={cn(
            "absolute inset-0 bg-dark-base/50 transition-opacity",
            drawerOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setDrawerOpen(false)}
          aria-hidden
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 transition-transform duration-200",
            drawerOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <Sidebar
            role={role}
            user={user}
            onSignOut={onSignOut}
            onNavigate={() => setDrawerOpen(false)}
            unreadChat={unreadChat}
            unreadMeetings={unreadMeetings}
          />
        </div>
      </div>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav
          title={title}
          user={user}
          actions={actions}
          onMenuClick={() => setDrawerOpen(true)}
          unreadChat={role === "admin" ? 0 : unreadChat}
          unreadMeetings={unreadMeetings}
        />
        <main className="pb-safe flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

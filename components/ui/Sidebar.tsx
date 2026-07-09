"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { navForRole } from "@/lib/nav";
import type { UserRole } from "@/lib/constants";
import { Avatar } from "./Avatar";
import { Logo } from "./Logo";

export interface SidebarProps {
  role: UserRole;
  user?: { name?: string | null; email?: string | null; avatarUrl?: string | null };
  onNavigate?: () => void;
  onSignOut?: () => void;
  className?: string;
}

/** Dark-base app sidebar with role-aware nav + user footer. */
export function Sidebar({
  role,
  user,
  onNavigate,
  onSignOut,
  className,
}: SidebarProps) {
  const pathname = usePathname();
  const items = navForRole(role);

  const isActive = (href: string) =>
    pathname === href || (href !== "/admin" && pathname.startsWith(href + "/"));

  return (
    <aside
      className={cn(
        "pt-safe flex h-full w-64 flex-col bg-dark-base text-white",
        className,
      )}
    >
      {/* Brand */}
      <div className="px-5 py-5">
        <div className="w-fit rounded-xl bg-white/95 px-3 py-2 shadow-soft">
          <Logo className="h-7" />
        </div>
        <p className="mt-2 text-[11px] uppercase tracking-wide text-white/40">
          {role === "admin" ? "Admin" : "Employee"}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-2">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-gradient-primary text-white shadow-soft"
                  : "text-white/60 hover:bg-white/5 hover:text-white",
              )}
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <Link
            href={role === "admin" ? "/admin/employees" : "/profile"}
            onClick={onNavigate}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg transition-colors hover:opacity-80"
          >
            <Avatar name={user?.name} src={user?.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold">
                {user?.name ?? "—"}
              </p>
              <p className="truncate text-xs text-white/40">
                {user?.email ?? ""}
              </p>
            </div>
          </Link>
          <button
            onClick={onSignOut}
            aria-label="Sign out"
            className="rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

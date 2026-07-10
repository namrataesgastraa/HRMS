"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "./Avatar";
import { NotificationBell } from "./NotificationBell";
import { titleForPath } from "@/lib/nav";

export interface TopNavProps {
  title?: string;
  user?: { name?: string | null; avatarUrl?: string | null };
  onMenuClick?: () => void;
  actions?: React.ReactNode;
}

/** Mobile/top header — shows the hamburger on small screens plus page title. */
export function TopNav({ title, user, onMenuClick, actions }: TopNavProps) {
  const pathname = usePathname();
  const heading = title ?? titleForPath(pathname);
  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-gray-100 bg-white/90 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4">
        <button
          onClick={onMenuClick}
          aria-label="Open menu"
          className="rounded-lg p-2 text-dark-base transition-colors hover:bg-gray-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="truncate text-base font-bold text-dark-base">{heading}</h1>
        <div className="ml-auto flex items-center gap-2">
          {actions}
          <NotificationBell />
          <Link
            href="/profile"
            aria-label="Open my profile"
            className="rounded-full transition-opacity hover:opacity-80"
          >
            <Avatar name={user?.name} src={user?.avatarUrl} size="sm" />
          </Link>
        </div>
      </div>
    </header>
  );
}

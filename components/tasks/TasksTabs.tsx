"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Daily Tasks", href: "/tasks/today" },
  { label: "Plans", href: "/tasks/plan" },
  { label: "Assigned", href: "/tasks/assigned" },
  { label: "History", href: "/tasks/history" },
];

export function TasksTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-6 inline-flex rounded-xl border border-gray-100 bg-white p-1 shadow-card">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              active
                ? "bg-gradient-primary text-white shadow-soft"
                : "text-gray-500 hover:text-dark-base",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

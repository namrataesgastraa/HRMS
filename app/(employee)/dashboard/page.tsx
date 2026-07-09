"use client";

import Link from "next/link";
import { MapPin, ListTodo, MessagesSquare } from "lucide-react";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { TodayStatusCard } from "@/components/dashboard/TodayStatusCard";
import { Card } from "@/components/ui";

const QUICK_LINKS = [
  { href: "/attendance", label: "Attendance", desc: "Check in / out", icon: MapPin },
  { href: "/tasks", label: "Tasks", desc: "Log daily proof", icon: ListTodo },
  { href: "/chat", label: "Team chat", desc: "Message the team", icon: MessagesSquare },
];

export default function DashboardPage() {
  const { id, fullName } = useCurrentUser();
  const firstName = fullName?.split(" ")[0];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark-base">
          Welcome back{firstName ? `, ${firstName}` : ""} 👋
        </h1>
        <p className="text-sm text-gray-500">Here&apos;s your day at a glance.</p>
      </div>

      <TodayStatusCard uid={id} />

      <div className="grid gap-4 sm:grid-cols-3">
        {QUICK_LINKS.map((l) => (
          <Link key={l.href} href={l.href}>
            <Card className="flex h-full items-center gap-3 p-5 transition-shadow hover:shadow-soft">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-violet/10 text-electric-violet">
                <l.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-dark-base">{l.label}</p>
                <p className="text-sm text-gray-500">{l.desc}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

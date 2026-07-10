"use client";

import Link from "next/link";
import {
  MapPin,
  ListTodo,
  MessagesSquare,
  UsersRound,
  Gauge,
  ChevronRight,
} from "lucide-react";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { TodayStatusCard } from "@/components/dashboard/TodayStatusCard";
import { Card } from "@/components/ui";

const QUICK_LINKS = [
  { href: "/attendance", label: "Attendance", desc: "Check in / out", icon: MapPin },
  { href: "/tasks", label: "Tasks", desc: "Log daily proof", icon: ListTodo },
  { href: "/chat", label: "Team chat", desc: "Message the team", icon: MessagesSquare },
];

export default function DashboardPage() {
  const { id, fullName, role, department } = useCurrentUser();
  const firstName = fullName?.split(" ")[0];
  const isManager = role === "manager";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark-base">
          Welcome back{firstName ? `, ${firstName}` : ""} 👋
        </h1>
        <p className="text-sm text-gray-500">Here&apos;s your day at a glance.</p>
      </div>

      {isManager && (
        <Link href="/team">
          <Card className="flex items-center gap-4 border-electric-violet/30 bg-electric-violet/5 p-5 transition-shadow hover:shadow-soft">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary text-white">
              <UsersRound className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-dark-base">My Team</p>
              <p className="text-sm text-gray-500">
                {department ? `${department} department` : "Your team"} —
                attendance, tasks &amp; plans
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-electric-violet" />
          </Card>
        </Link>
      )}

      {isManager && (
        <Link href="/evaluation">
          <Card className="flex items-center gap-4 border-cool-blue/30 bg-cool-blue/5 p-5 transition-shadow hover:shadow-soft">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary text-white">
              <Gauge className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-dark-base">Evaluation</p>
              <p className="text-sm text-gray-500">
                Review &amp; rate your team&apos;s daily performance
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-cool-blue" />
          </Card>
        </Link>
      )}

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

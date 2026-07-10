"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { startOfDay } from "date-fns";
import {
  Users,
  MapPin,
  Clock,
  AlertTriangle,
  MessagesSquare,
} from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/LoadingSkeleton";

interface Overview {
  totalEmployees: number;
  checkedIn: number;
  pct: number;
  pendingProof: number;
  anomalies: number;
  recent: {
    id: string;
    content: string;
    created_at: string;
    name: string;
  }[];
}

function uniq(ids: (string | null)[]): Set<string> {
  return new Set(ids.filter(Boolean) as string[]);
}

export function AdminOverview() {
  const supabase = useMemo(() => createClient(), []);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: async (): Promise<Overview> => {
      const dayStart = startOfDay(new Date()).toISOString();
      const [emps, att, logs, msgs] = await Promise.all([
        supabase.from("profiles").select("id").eq("role", "employee"),
        supabase
          .from("attendance")
          .select("profile_id, status, is_mock_location, distance_meters")
          .gte("check_in_time", dayStart),
        supabase
          .from("daily_task_logs")
          .select("profile_id")
          .gte("submitted_at", dayStart),
        supabase
          .from("messages")
          .select("id, content, created_at, sender:profiles!messages_sender_id_fkey(full_name)")
          .is("recipient_id", null)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const totalEmployees = emps.data?.length ?? 0;
      const attRows = att.data ?? [];
      const checkedInSet = uniq(attRows.map((r) => r.profile_id));
      const submittedSet = uniq((logs.data ?? []).map((r) => r.profile_id));
      const pendingProof = [...checkedInSet].filter(
        (id) => !submittedSet.has(id),
      ).length;
      const anomalies = attRows.filter(
        (r) =>
          r.is_mock_location ||
          r.status === "late" ||
          (r.distance_meters ?? 0) > 150,
      ).length;

      const recent = (
        (msgs.data ?? []) as unknown as Array<{
          id: string;
          content: string;
          created_at: string;
          sender: { full_name: string | null } | { full_name: string | null }[] | null;
        }>
      ).map((m) => ({
        id: m.id,
        content: m.content,
        created_at: m.created_at,
        name:
          (Array.isArray(m.sender) ? m.sender[0]?.full_name : m.sender?.full_name) ??
          "Unknown",
      }));

      return {
        totalEmployees,
        checkedIn: checkedInSet.size,
        pct: totalEmployees
          ? Math.round((checkedInSet.size / totalEmployees) * 100)
          : 0,
        pendingProof,
        anomalies,
        recent,
      };
    },
  });

  const tiles = [
    {
      label: "Present today",
      value: data ? `${data.pct}%` : "—",
      sub: data ? `${data.checkedIn}/${data.totalEmployees} employees` : "",
      icon: MapPin,
      color: "text-success bg-success/10",
      href: "/admin/attendance",
    },
    {
      label: "Pending proof",
      value: data?.pendingProof ?? "—",
      sub: "checked in, not submitted",
      icon: Clock,
      color: "text-amber-600 bg-amber-100",
      href: "/admin/tasks",
    },
    {
      label: "Anomalies today",
      value: data?.anomalies ?? "—",
      sub: "late / far / mock GPS",
      icon: AlertTriangle,
      color: "text-red-500 bg-red-100",
      href: "/admin/attendance",
    },
    {
      label: "Employees",
      value: data?.totalEmployees ?? "—",
      sub: "total on roll",
      icon: Users,
      color: "text-electric-violet bg-electric-violet/10",
      href: "/admin/employees",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href}>
            <div className="h-full rounded-2xl border border-gray-100 bg-white p-5 shadow-card transition-shadow hover:shadow-soft">
              <div
                className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${t.color}`}
              >
                <t.icon className="h-5 w-5" />
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-extrabold text-dark-base">
                  {t.value}
                </p>
              )}
              <p className="text-sm font-medium text-dark-base">{t.label}</p>
              <p className="text-xs text-gray-400">{t.sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent chat */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-card">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
          <MessagesSquare className="h-5 w-5 text-electric-violet" />
          <h2 className="text-base font-bold text-dark-base">
            Recent chat activity
          </h2>
        </div>
        <div className="divide-y divide-gray-50">
          {isLoading ? (
            <div className="p-5">
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : !data || data.recent.length === 0 ? (
            <p className="p-5 text-sm text-gray-400">No messages yet.</p>
          ) : (
            data.recent.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                <Avatar name={m.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-dark-base">{m.name}</p>
                  <p className="truncate text-sm text-gray-500">{m.content}</p>
                </div>
                <span className="shrink-0 text-xs text-gray-400">
                  {new Date(m.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

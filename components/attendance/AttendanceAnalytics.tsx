"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Clock } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { monthOptions, yearOptions, monthRange, MONTHS } from "@/lib/dates";
import { CHECKOUT_WINDOW } from "@/lib/constants";
import type { AttendanceRecord } from "@/lib/types";
import { Select } from "@/components/ui/Select";
import { SkeletonCard } from "@/components/ui/LoadingSkeleton";

interface Props {
  /** When set, analytics are locked to this one employee (no picker). */
  uid?: string;
  title?: string;
  /**
   * Show an employee picker (admin/manager view) so the whole team OR a single
   * person can be charted. Ignored when `uid` is set.
   */
  allowEmployeePicker?: boolean;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  present: { label: "Present", color: "#22C55E" },
  late: { label: "Late", color: "#F59E0B" },
  wfh: { label: "Work from home", color: "#2E94F3" },
  absent: { label: "Absent", color: "#EF4444" },
};

/** Hours between two ISO timestamps, or 0. */
function hoursBetween(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  const h = (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;
  return h > 0 && h < 24 ? h : 0;
}

export function AttendanceAnalytics({
  uid,
  title,
  allowEmployeePicker = false,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth());
  const [picked, setPicked] = useState<string>(""); // "" = all employees

  const pickerOn = allowEmployeePicker && !uid;

  // Employee list for the picker (admin/manager only).
  const { data: people } = useQuery({
    queryKey: ["analytics", "people"],
    enabled: pickerOn,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as { id: string; full_name: string | null }[];
    },
  });

  const filterUid = uid ?? (picked || undefined);

  const { data, isLoading } = useQuery({
    queryKey: ["attendance", "analytics", filterUid ?? "all", year, month],
    queryFn: async (): Promise<AttendanceRecord[]> => {
      const { start, end } = monthRange(year, month);
      let q = supabase
        .from("attendance")
        .select("*")
        .gte("check_in_time", start)
        .lt("check_in_time", end);
      if (filterUid) q = q.eq("profile_id", filterUid);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AttendanceRecord[];
    },
  });

  const stats = useMemo(() => {
    const rows = data ?? [];
    const counts: Record<string, number> = {
      present: 0,
      late: 0,
      wfh: 0,
      absent: 0,
    };
    // Weekly working hours (week of month = ceil(day / 7)), up to 5 buckets.
    const weeks = [0, 0, 0, 0, 0];
    let totalHours = 0;
    for (const r of rows) {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
      const h = hoursBetween(r.check_in_time, r.check_out_time);
      if (h > 0 && r.check_in_time) {
        const wk = Math.min(4, Math.ceil(new Date(r.check_in_time).getDate() / 7) - 1);
        weeks[wk] += h;
        totalHours += h;
      }
    }
    return { counts, weeks, totalHours, total: rows.length };
  }, [data]);

  const statusEntries = (["present", "late", "wfh", "absent"] as const)
    .map((k) => ({ key: k, ...STATUS_META[k], count: stats.counts[k] ?? 0 }))
    .filter((e) => e.count > 0);
  const maxStatus = Math.max(1, ...statusEntries.map((e) => e.count));
  const maxWeek = Math.max(1, ...stats.weeks);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-electric-violet" />
          <h2 className="text-base font-bold text-dark-base">
            {title ?? "Attendance analytics"}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {pickerOn && (
            <div className="w-48">
              <Select
                value={picked}
                onChange={(e) => setPicked(e.target.value)}
                options={[
                  { label: "All employees", value: "" },
                  ...(people ?? []).map((p) => ({
                    label: p.full_name ?? "—",
                    value: p.id,
                  })),
                ]}
              />
            </div>
          )}
          <div className="w-36">
            <Select
              value={String(month)}
              onChange={(e) => setMonth(Number(e.target.value))}
              options={monthOptions().filter((o) => o.value !== "")}
            />
          </div>
          <div className="w-24">
            <Select
              value={String(year)}
              onChange={(e) => setYear(Number(e.target.value))}
              options={yearOptions(now.getFullYear())}
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <SkeletonCard />
      ) : stats.total === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">
          No attendance recorded for {MONTHS[month]} {year}.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Status distribution */}
          <div>
            <p className="mb-3 text-sm font-semibold text-dark-base">
              Attendance breakdown
            </p>
            <div className="space-y-3">
              {statusEntries.map((e) => (
                <div key={e.key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-600">{e.label}</span>
                    <span className="font-semibold text-dark-base">{e.count}</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(e.count / maxStatus) * 100}%`,
                        backgroundColor: e.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-gray-400">
              {stats.total} record{stats.total > 1 ? "s" : ""} in {MONTHS[month]}{" "}
              {year}
            </p>
          </div>

          {/* Weekly working hours */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-dark-base">
                Weekly working hours
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-electric-violet">
                <Clock className="h-3.5 w-3.5" />
                {stats.totalHours.toFixed(1)} h total
              </span>
            </div>
            <div className="flex h-40 items-end gap-3">
              {stats.weeks.map((h, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-gray-500">
                    {h > 0 ? `${h.toFixed(1)}` : ""}
                  </span>
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-lg bg-gradient-primary transition-all"
                      style={{
                        height: `${Math.max(h > 0 ? 6 : 0, (h / maxWeek) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-gray-400">W{i + 1}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-400">
              Hours = check-out − check-in. Standard day ends{" "}
              {CHECKOUT_WINDOW.startHour - 12}–{CHECKOUT_WINDOW.endHour - 12} PM.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

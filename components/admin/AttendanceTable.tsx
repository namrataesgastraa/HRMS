"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, ShieldAlert, Clock, Home } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRow } from "@/components/ui/LoadingSkeleton";
import { formatDistance } from "@/lib/geolocation";
import { monthOptions, yearOptions, monthRange } from "@/lib/dates";
import { STANDARD_WORK_HOURS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Hours worked + 9-hour completion (admin/manager visibility). */
function HoursCell({
  checkIn,
  checkOut,
}: {
  checkIn: string | null;
  checkOut: string | null;
}) {
  if (!checkIn || !checkOut)
    return <span className="text-xs text-gray-300">—</span>;
  const h =
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 3_600_000;
  if (!(h > 0 && h < 24)) return <span className="text-xs text-gray-300">—</span>;
  const t = Math.round(h * 60);
  const label = t < 60 ? `${t}m` : t % 60 === 0 ? `${t / 60}h` : `${Math.floor(t / 60)}h ${t % 60}m`;
  const ok = h >= STANDARD_WORK_HOURS;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-semibold",
        ok ? "bg-success/15 text-success" : "bg-amber-100 text-amber-700",
      )}
      title={`${label} worked · ${STANDARD_WORK_HOURS}h expected`}
    >
      {label} {ok ? "✓" : `/ ${STANDARD_WORK_HOURS}h`}
    </span>
  );
}

interface Row {
  id: string;
  profile_id: string;
  check_in_time: string | null;
  check_out_time: string | null;
  distance_meters: number | null;
  is_mock_location: boolean;
  status: string;
  accuracy_meters: number | null;
  ip_address: string | null;
  device_id: string | null;
  source: string | null;
  risk_flags: string[] | null;
  profile:
    | { full_name: string | null; employee_id: string | null; avatar_url: string | null }
    | { full_name: string | null; employee_id: string | null; avatar_url: string | null }[]
    | null;
}

function prof(r: Row) {
  return Array.isArray(r.profile) ? r.profile[0] : r.profile;
}

const FAR_THRESHOLD = 150;

export function AttendanceTable() {
  const supabase = useMemo(() => createClient(), []);
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | null>(now.getMonth());
  const [employee, setEmployee] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "attendance", year, month],
    queryFn: async (): Promise<Row[]> => {
      const { start, end } = monthRange(year, month);
      const { data, error } = await supabase
        .from("attendance")
        .select(
          "id, profile_id, check_in_time, check_out_time, distance_meters, is_mock_location, status, accuracy_meters, ip_address, device_id, source, risk_flags, profile:profiles(full_name, employee_id, avatar_url)",
        )
        .gte("check_in_time", start)
        .lt("check_in_time", end)
        .order("check_in_time", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  // Employee dropdown — EVERYONE who can mark attendance (employees + managers;
  // filtering by role='employee' previously hid managers from the picker).
  const { data: employees } = useQuery({
    queryKey: ["admin", "employee-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as { id: string; full_name: string | null }[];
    },
    staleTime: 5 * 60_000, // refresh so new joiners appear
  });

  const employeeOptions = useMemo(
    () => [
      { label: "All employees", value: "" },
      ...(employees ?? []).map((e) => ({
        label: e.full_name ?? "—",
        value: e.id,
      })),
    ],
    [employees],
  );

  const filtered = useMemo(
    () => (data ?? []).filter((r) => !employee || r.profile_id === employee),
    [data, employee],
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="w-36">
          <Select
            value={month === null ? "" : String(month)}
            onChange={(e) =>
              setMonth(e.target.value === "" ? null : Number(e.target.value))
            }
            options={monthOptions()}
          />
        </div>
        <div className="w-24">
          <Select
            value={String(year)}
            onChange={(e) => setYear(Number(e.target.value))}
            options={yearOptions(now.getFullYear())}
          />
        </div>
        <div className="w-56">
          <Select
            value={employee}
            onChange={(e) => setEmployee(e.target.value)}
            options={employeeOptions}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
        {isLoading ? (
          <div>
            <SkeletonRow cols={5} />
            <SkeletonRow cols={5} />
            <SkeletonRow cols={5} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No attendance records"
              message="Nothing matches your filters for this period."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="px-5 py-3 font-semibold">Employee</th>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">In / Out</th>
                  <th className="px-5 py-3 font-semibold">Hours</th>
                  <th className="px-5 py-3 font-semibold">Distance</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((r) => {
                  const p = prof(r);
                  const wfh = r.status === "wfh";
                  const far = !wfh && (r.distance_meters ?? 0) > FAR_THRESHOLD;
                  return (
                    <tr key={r.id} className="hover:bg-gray-50/60">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={p?.full_name} src={p?.avatar_url} size="sm" />
                          <div>
                            <p className="font-medium text-dark-base">
                              {p?.full_name ?? "—"}
                            </p>
                            <p className="text-xs text-gray-400">
                              {p?.employee_id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {r.check_in_time
                          ? format(new Date(r.check_in_time), "dd MMM yyyy")
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {r.check_in_time
                          ? format(new Date(r.check_in_time), "hh:mm a")
                          : "—"}{" "}
                        /{" "}
                        {r.check_out_time
                          ? format(new Date(r.check_out_time), "hh:mm a")
                          : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <HoursCell checkIn={r.check_in_time} checkOut={r.check_out_time} />
                      </td>
                      <td
                        className={
                          far
                            ? "px-5 py-3 font-medium text-red-500"
                            : "px-5 py-3 text-gray-600"
                        }
                      >
                        {wfh
                          ? "—"
                          : r.distance_meters != null
                            ? formatDistance(r.distance_meters)
                            : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <Badge
                          variant={
                            r.status === "late"
                              ? "late"
                              : r.status === "absent"
                                ? "absent"
                                : wfh
                                  ? "info"
                                  : "present"
                          }
                        >
                          {r.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {(r.risk_flags ?? []).map((f) => (
                            <span
                              key={f}
                              title={`${f.replace(/_/g, " ")} · IP ${r.ip_address ?? "?"} · ±${
                                r.accuracy_meters != null
                                  ? Math.round(r.accuracy_meters)
                                  : "?"
                              }m · ${r.source ?? "?"}`}
                              className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600"
                            >
                              {f.replace(/_/g, " ")}
                            </span>
                          ))}
                          {wfh && (
                            <span title="Work from home" className="text-cool-blue">
                              <Home className="h-4 w-4" />
                            </span>
                          )}
                          {r.is_mock_location && (
                            <span title="Mock location" className="text-red-500">
                              <ShieldAlert className="h-4 w-4" />
                            </span>
                          )}
                          {far && (
                            <span title="Far from office" className="text-red-500">
                              <AlertTriangle className="h-4 w-4" />
                            </span>
                          )}
                          {r.status === "late" && (
                            <span title="Late" className="text-amber-500">
                              <Clock className="h-4 w-4" />
                            </span>
                          )}
                          {!wfh &&
                            !r.is_mock_location &&
                            !far &&
                            r.status !== "late" && (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

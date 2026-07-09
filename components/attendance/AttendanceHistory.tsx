"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarX, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import type { AttendanceRecord } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRow } from "@/components/ui/LoadingSkeleton";
import { formatDistance } from "@/lib/geolocation";
import { monthOptions, yearOptions, monthRange } from "@/lib/dates";

function timeOf(iso: string | null): string {
  return iso ? format(new Date(iso), "hh:mm a") : "—";
}

function statusVariant(s: string) {
  if (s === "late") return "late" as const;
  if (s === "absent") return "absent" as const;
  if (s === "wfh") return "info" as const;
  return "present" as const;
}

export function AttendanceHistory({ uid }: { uid: string }) {
  const supabase = useMemo(() => createClient(), []);
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | null>(now.getMonth());

  const { data, isLoading } = useQuery({
    queryKey: ["attendance", "history", uid, year, month],
    queryFn: async (): Promise<AttendanceRecord[]> => {
      const { start, end } = monthRange(year, month);
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("profile_id", uid)
        .gte("check_in_time", start)
        .lt("check_in_time", end)
        .order("check_in_time", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AttendanceRecord[];
    },
  });

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-card">
      <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-dark-base">
            Attendance history
          </h2>
          <p className="text-sm text-gray-500">Your past records</p>
        </div>
        <div className="flex gap-2">
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
        </div>
      </div>

      {isLoading ? (
        <div>
          <SkeletonRow cols={4} />
          <SkeletonRow cols={4} />
          <SkeletonRow cols={4} />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="p-5">
          <EmptyState
            icon={CalendarX}
            title="No records for this period"
            message="Try a different month or year."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3 font-semibold">Date</th>
                <th className="px-5 py-3 font-semibold">Check in</th>
                <th className="px-5 py-3 font-semibold">Check out</th>
                <th className="px-5 py-3 font-semibold">Distance</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/60">
                  <td className="px-5 py-3 font-medium text-dark-base">
                    {r.check_in_time
                      ? format(new Date(r.check_in_time), "EEE, dd MMM")
                      : "—"}
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {timeOf(r.check_in_time)}
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {timeOf(r.check_out_time)}
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    <span className="inline-flex items-center gap-1.5">
                      {r.status === "wfh"
                        ? "—"
                        : r.distance_meters != null
                          ? formatDistance(r.distance_meters)
                          : "—"}
                      {r.is_mock_location && (
                        <ShieldAlert
                          className="h-3.5 w-3.5 text-red-500"
                          aria-label="Mock location"
                        />
                      )}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

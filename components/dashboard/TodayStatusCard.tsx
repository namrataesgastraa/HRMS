"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { startOfDay } from "date-fns";
import { MapPin, CheckCircle2, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import type { AttendanceRecord } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/LoadingSkeleton";

function fmt(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";
}

export function TodayStatusCard({ uid }: { uid: string }) {
  const supabase = useMemo(() => createClient(), []);

  const { data, isLoading } = useQuery({
    queryKey: ["attendance", "today", uid],
    queryFn: async (): Promise<AttendanceRecord | null> => {
      const dayStart = startOfDay(new Date()).toISOString();
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("profile_id", uid)
        .gte("check_in_time", dayStart)
        .order("check_in_time", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data?.[0] as AttendanceRecord) ?? null;
    },
  });

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
      <p className="text-sm font-semibold text-gray-500">Today</p>

      {isLoading ? (
        <Skeleton className="mt-3 h-8 w-40" />
      ) : !data ? (
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-bold text-dark-base">Not checked in</p>
            <p className="text-sm text-gray-500">
              Mark your attendance when you reach the office.
            </p>
          </div>
          <Link href="/attendance">
            <Button leftIcon={<MapPin className="h-4 w-4" />}>
              Mark attendance
            </Button>
          </Link>
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 shrink-0 text-success" />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-dark-base">
                  Checked in · {fmt(data.check_in_time)}
                </p>
                <Badge variant={data.status === "late" ? "late" : "present"}>
                  {data.status}
                </Badge>
              </div>
              <p className="text-sm text-gray-500">
                {data.check_out_time
                  ? `Checked out · ${fmt(data.check_out_time)}`
                  : "Don't forget to check out at end of day."}
              </p>
            </div>
          </div>
          {!data.check_out_time && (
            <Link href="/attendance">
              <Button variant="secondary" leftIcon={<LogOut className="h-4 w-4" />}>
                Check out
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

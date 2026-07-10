"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ListTodo, Paperclip, Clock } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { openStoredFile } from "@/lib/storage";
import { STORAGE_BUCKETS } from "@/lib/constants";
import { monthOptions, yearOptions, monthRange } from "@/lib/dates";
import type { TaskEntry } from "@/lib/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/LoadingSkeleton";
import { Select } from "@/components/ui/Select";

export function TaskHistory({ uid }: { uid: string }) {
  const supabase = useMemo(() => createClient(), []);
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | null>(now.getMonth());

  const { data, isLoading } = useQuery({
    queryKey: ["daily_task_logs", "history", uid, year, month],
    queryFn: async (): Promise<TaskEntry[]> => {
      const { start, end } = monthRange(year, month);
      const { data, error } = await supabase
        .from("daily_task_logs")
        .select("*")
        .eq("profile_id", uid)
        .gte("created_at", start)
        .lt("created_at", end)
        .order("day_number", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TaskEntry[];
    },
  });

  const byDay = useMemo(() => {
    const map = new Map<number, TaskEntry[]>();
    (data ?? []).forEach((t) => {
      const arr = map.get(t.day_number) ?? [];
      arr.push(t);
      map.set(t.day_number, arr);
    });
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [data]);

  const filters = (
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
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-dark-base">Task history</h2>
          <p className="text-sm text-gray-500">Your daily submissions</p>
        </div>
        {filters}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="No tasks for this period"
          message="Try a different month or year — your daily submissions appear here, grouped by day."
        />
      ) : (
        <div className="space-y-4">
      {byDay.map(([dayNum, tasks]) => {
        const when = tasks[0].submitted_at ?? tasks[0].created_at;
        return (
        <div
          key={dayNum}
          className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card"
        >
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-dark-base">Day {dayNum}</p>
              {when && (
                <p className="mt-0.5 text-xs font-medium text-gray-500">
                  {format(new Date(when), "EEEE, dd MMM yyyy")}
                </p>
              )}
            </div>
            <p className="shrink-0 text-xs text-gray-400">
              {tasks.length} task{tasks.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="space-y-3">
            {tasks.map((t) => {
              const ts = t.submitted_at ?? t.created_at;
              return (
              <div
                key={t.id}
                className="rounded-xl border border-gray-100 bg-gray-50/60 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-dark-base">
                    {t.task_title}
                  </p>
                  {ts && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      {format(new Date(ts), "dd MMM · hh:mm a")}
                      {t.is_late && (
                        <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          Late
                        </span>
                      )}
                    </span>
                  )}
                </div>
                {t.description && (
                  <p className="mt-0.5 text-sm text-gray-600">{t.description}</p>
                )}
                {t.proof_files && t.proof_files.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {t.proof_files.map((f, i) => (
                      <button
                        key={i}
                        onClick={() =>
                          openStoredFile(supabase, STORAGE_BUCKETS.proofOfWork, f)
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium hover:bg-gray-50"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        <span className="max-w-[140px] truncate">
                          {f.filename}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </div>
        );
      })}
        </div>
      )}
    </div>
  );
}

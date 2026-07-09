"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ListTodo, Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { openStoredFile } from "@/lib/storage";
import { STORAGE_BUCKETS } from "@/lib/constants";
import type { TaskEntry } from "@/lib/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/LoadingSkeleton";

export function TaskHistory({ uid }: { uid: string }) {
  const supabase = useMemo(() => createClient(), []);

  const { data, isLoading } = useQuery({
    queryKey: ["daily_task_logs", "history", uid],
    queryFn: async (): Promise<TaskEntry[]> => {
      const { data, error } = await supabase
        .from("daily_task_logs")
        .select("*")
        .eq("profile_id", uid)
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


  if (isLoading)
    return (
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );

  if (!data || data.length === 0)
    return (
      <EmptyState
        icon={ListTodo}
        title="No tasks logged yet"
        message="Your daily task submissions will appear here, grouped by day."
      />
    );

  return (
    <div className="space-y-4">
      {byDay.map(([dayNum, tasks]) => (
        <div
          key={dayNum}
          className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card"
        >
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-sm font-bold text-dark-base">Day {dayNum}</p>
            <p className="text-xs text-gray-400">
              {tasks[0].submitted_at
                ? format(new Date(tasks[0].submitted_at), "dd MMM yyyy")
                : ""}{" "}
              · {tasks.length} task{tasks.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="space-y-3">
            {tasks.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-gray-100 bg-gray-50/60 p-3"
              >
                <p className="text-sm font-semibold text-dark-base">
                  {t.task_title}
                </p>
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
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

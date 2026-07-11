"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { History, Paperclip, ChevronDown, ChevronUp } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { openStoredFile } from "@/lib/storage";
import { STORAGE_BUCKETS } from "@/lib/constants";
import type { TaskLogHistory } from "@/lib/types";
import { Spinner } from "@/components/ui/Spinner";

/**
 * Shows the "Updated" marker for an edited task and, on click, the full
 * append-only history of previous versions (text + proof at each point).
 */
export function TaskHistoryViewer({
  taskLogId,
  editCount,
}: {
  taskLogId: string;
  editCount: number;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["task_history", taskLogId],
    enabled: open,
    queryFn: async (): Promise<TaskLogHistory[]> => {
      const { data, error } = await supabase
        .from("daily_task_log_history")
        .select("*")
        .eq("task_log_id", taskLogId)
        .order("snapshot_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TaskLogHistory[];
    },
  });

  if (editCount <= 0) return null;

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-200"
        title="This task was edited"
      >
        <History className="h-3 w-3" />
        Updated{editCount > 1 ? ` ×${editCount}` : ""}
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {open && (
        <div className="mt-2 space-y-2 rounded-xl border border-amber-100 bg-amber-50/50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
            Previous versions
          </p>
          {isLoading ? (
            <Spinner className="h-4 w-4 text-amber-600" />
          ) : !data || data.length === 0 ? (
            <p className="text-xs text-gray-400">No history recorded.</p>
          ) : (
            <ul className="space-y-2">
              {data.map((h) => (
                <li key={h.id} className="rounded-lg border border-amber-100 bg-white p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-dark-base">
                      {h.task_title ?? "—"}
                    </span>
                    <span className="shrink-0 text-[10px] text-gray-400">
                      {h.action === "deleted" ? "deleted" : "edited"} ·{" "}
                      {format(new Date(h.snapshot_at), "dd MMM yyyy, hh:mm a")}
                    </span>
                  </div>
                  {h.description && (
                    <p className="mt-0.5 text-xs text-gray-600">{h.description}</p>
                  )}
                  {h.proof_files && h.proof_files.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {h.proof_files.map((f, i) => (
                        <button
                          key={i}
                          onClick={() =>
                            openStoredFile(supabase, STORAGE_BUCKETS.proofOfWork, f)
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[11px] hover:bg-gray-50"
                        >
                          <Paperclip className="h-3 w-3" />
                          <span className="max-w-[120px] truncate">{f.filename}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { History } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { monthOptions, yearOptions, monthRange, MONTHS } from "@/lib/dates";
import type { EvaluationEvent } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Select } from "@/components/ui/Select";
import { SkeletonCard } from "@/components/ui/LoadingSkeleton";
import { scoreMeta, type Subject } from "./shared";

interface Props {
  scope: "admin" | "manager";
  evaluatorId: string;
  department: string | null;
}

export function EvaluationHistory({ scope, evaluatorId, department }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | null>(now.getMonth());
  const [picked, setPicked] = useState<string>("");

  const { data: subjects } = useQuery({
    queryKey: ["evaluation", "subjects", scope, department],
    queryFn: async (): Promise<Subject[]> => {
      let q = supabase
        .from("profiles")
        .select("id, full_name, avatar_url, department, employee_id");
      if (scope === "admin") q = q.eq("role", "manager");
      else q = q.eq("role", "employee").eq("department", department ?? "___none___");
      const { data, error } = await q.order("full_name");
      if (error) throw error;
      return (data ?? []) as Subject[];
    },
  });

  const subjectById = useMemo(() => {
    const m = new Map<string, Subject>();
    (subjects ?? []).forEach((s) => m.set(s.id, s));
    return m;
  }, [subjects]);

  const { data, isLoading } = useQuery({
    queryKey: ["evaluation", "history", evaluatorId, picked || "all", year, month],
    queryFn: async (): Promise<EvaluationEvent[]> => {
      const { start, end } = monthRange(year, month);
      let q = supabase
        .from("evaluation_events")
        .select("*")
        .eq("evaluator_id", evaluatorId)
        .gte("eval_date", start.slice(0, 10))
        .lt("eval_date", end.slice(0, 10));
      if (picked) q = q.eq("subject_id", picked);
      const { data, error } = await q
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as EvaluationEvent[];
    },
  });

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-electric-violet" />
          <h2 className="text-base font-bold text-dark-base">
            Evaluation history
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="w-48">
            <Select
              value={picked}
              onChange={(e) => setPicked(e.target.value)}
              options={[
                { label: "Everyone", value: "" },
                ...(subjects ?? []).map((s) => ({
                  label: s.full_name ?? "—",
                  value: s.id,
                })),
              ]}
            />
          </div>
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
        <SkeletonCard />
      ) : !data || data.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">
          No evaluation activity{" "}
          {month === null ? `in ${year}` : `for ${MONTHS[month]} ${year}`}.
        </p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {data.map((ev) => {
            const s = subjectById.get(ev.subject_id);
            const m = scoreMeta(ev.score);
            return (
              <li key={ev.id} className="flex items-center gap-3 py-3">
                <Avatar name={s?.full_name} src={s?.avatar_url} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-dark-base">
                    {s?.full_name ?? "—"}
                  </p>
                  <p className="truncate text-xs text-gray-400">
                    For {format(new Date(ev.eval_date + "T00:00:00"), "dd MMM yyyy")}
                    {" · rated "}
                    {format(new Date(ev.created_at), "dd MMM, hh:mm a")}
                    {ev.checked_count != null
                      ? ` · ${ev.checked_count} task${ev.checked_count === 1 ? "" : "s"} checked`
                      : ""}
                  </p>
                  {ev.note && (
                    <p className="mt-0.5 truncate text-xs italic text-gray-500">
                      “{ev.note}”
                    </p>
                  )}
                </div>
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold text-white"
                  style={{ backgroundColor: m.color }}
                >
                  {ev.score}%
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { monthOptions, yearOptions, monthRange, MONTHS } from "@/lib/dates";
import type { Evaluation } from "@/lib/types";
import { Select } from "@/components/ui/Select";
import { SkeletonCard } from "@/components/ui/LoadingSkeleton";
import { BarChart, LineChart } from "@/components/ui/MiniCharts";
import { scoreMeta, type Subject } from "./shared";

interface Props {
  scope: "admin" | "manager";
  evaluatorId: string;
  department: string | null;
}

export function EvaluationAnalytics({ scope, evaluatorId, department }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth());
  const [picked, setPicked] = useState<string>(""); // "" = everyone (averages)

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

  const { data, isLoading } = useQuery({
    queryKey: ["evaluation", "analytics", evaluatorId, picked || "all", year, month],
    queryFn: async (): Promise<Evaluation[]> => {
      const { start, end } = monthRange(year, month);
      let q = supabase
        .from("evaluations")
        .select("*")
        .eq("evaluator_id", evaluatorId)
        .gte("eval_date", start.slice(0, 10))
        .lt("eval_date", end.slice(0, 10));
      if (picked) q = q.eq("subject_id", picked);
      const { data, error } = await q.order("eval_date");
      if (error) throw error;
      return (data ?? []) as Evaluation[];
    },
  });

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    (subjects ?? []).forEach((s) => m.set(s.id, s.full_name ?? "—"));
    return m;
  }, [subjects]);

  // Bars: per-day scores when a subject is picked; per-subject averages otherwise.
  const bars = useMemo(() => {
    const rows = data ?? [];
    if (picked) {
      return rows
        .slice()
        .sort((a, b) => a.eval_date.localeCompare(b.eval_date))
        .map((r) => ({
          label: format(new Date(r.eval_date + "T00:00:00"), "dd MMM"),
          value: r.score,
        }));
    }
    const bySubject = new Map<string, number[]>();
    rows.forEach((r) => {
      const arr = bySubject.get(r.subject_id) ?? [];
      arr.push(r.score);
      bySubject.set(r.subject_id, arr);
    });
    return [...bySubject.entries()].map(([id, scores]) => ({
      label: (nameById.get(id) ?? "—").split(" ")[0],
      value: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }));
  }, [data, picked, nameById]);

  const avg =
    bars.length > 0
      ? Math.round(bars.reduce((a, b) => a + b.value, 0) / bars.length)
      : 0;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-electric-violet" />
          <h2 className="text-base font-bold text-dark-base">
            Evaluation analytics
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="w-48">
            <Select
              value={picked}
              onChange={(e) => setPicked(e.target.value)}
              options={[
                {
                  label: scope === "admin" ? "All managers (avg)" : "All team (avg)",
                  value: "",
                },
                ...(subjects ?? []).map((s) => ({
                  label: s.full_name ?? "—",
                  value: s.id,
                })),
              ]}
            />
          </div>
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
      ) : bars.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">
          No ratings recorded for {MONTHS[month]} {year}.
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-500">
            {picked ? "Daily performance trend" : "Average score per person"} ·{" "}
            <span className="font-semibold text-dark-base">avg {avg}%</span>
          </p>
          {picked ? (
            <LineChart
              data={bars.map((b) => ({
                label: b.label,
                value: b.value,
                color: scoreMeta(b.value).color,
              }))}
            />
          ) : (
            <BarChart
              data={bars.map((b) => ({
                label: b.label,
                value: b.value,
                color: scoreMeta(b.value).color,
              }))}
            />
          )}
        </>
      )}
    </div>
  );
}

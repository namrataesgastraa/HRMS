"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  Search,
  Gauge,
  Paperclip,
  CheckCircle2,
  Circle,
  Save,
  Clock,
  Lock,
} from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { openStoredFile } from "@/lib/storage";
import { STORAGE_BUCKETS } from "@/lib/constants";
import type { TaskEntry, AttendanceRecord, Evaluation } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/LoadingSkeleton";
import { useToast } from "@/components/ui/Toast";
import { EvaluationAnalytics } from "./EvaluationAnalytics";
import { scoreMeta, type Subject } from "./shared";
import { cn } from "@/lib/utils";

interface Props {
  scope: "admin" | "manager";
  evaluatorId: string;
  department: string | null;
}

export function EvaluationClient({ scope, evaluatorId, department }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<"evaluate" | "analytics">("evaluate");
  const [subject, setSubject] = useState<Subject | null>(null);
  const [search, setSearch] = useState("");

  const { data: subjects, isLoading } = useQuery({
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

  const filtered = (subjects ?? []).filter((s) =>
    (s.full_name ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const tabBtn = (active: boolean) =>
    cn(
      "rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
      active
        ? "bg-gradient-primary text-white shadow-soft"
        : "text-gray-500 hover:text-dark-base",
    );

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-xl border border-gray-100 bg-white p-1 shadow-card">
        <button onClick={() => { setTab("evaluate"); }} className={tabBtn(tab === "evaluate")}>
          Evaluate
        </button>
        <button onClick={() => setTab("analytics")} className={tabBtn(tab === "analytics")}>
          Analytics
        </button>
      </div>

      {tab === "analytics" ? (
        <EvaluationAnalytics
          scope={scope}
          evaluatorId={evaluatorId}
          department={department}
        />
      ) : subject ? (
        <SubjectEvaluation
          subject={subject}
          evaluatorId={evaluatorId}
          supabase={supabase}
          onBack={() => setSubject(null)}
        />
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
          <div className="mb-4">
            <h2 className="text-base font-bold text-dark-base">
              {scope === "admin"
                ? "Evaluate managers"
                : "Evaluate your team"}
            </h2>
            <p className="text-sm text-gray-500">
              {scope === "admin"
                ? "Pick a manager to review their day and rate performance."
                : "Pick a team member to review their day and rate performance."}
            </p>
          </div>
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people…"
              className="h-10 w-full rounded-xl border border-gray-200 pl-9 pr-3 text-sm focus:border-electric-violet focus:outline-none focus:ring-2 focus:ring-electric-violet/30"
            />
          </div>

          {isLoading ? (
            <SkeletonCard />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Gauge}
              title={scope === "admin" ? "No managers yet" : "No team members"}
              message={
                scope === "admin"
                  ? "Promote employees to managers to evaluate them."
                  : "No employees are in your department yet."
              }
            />
          ) : (
            <ul className="divide-y divide-gray-50">
              {filtered.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => setSubject(s)}
                    className="flex w-full items-center gap-3 px-1 py-3 text-left hover:bg-gray-50"
                  >
                    <Avatar name={s.full_name} src={s.avatar_url} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-dark-base">
                        {s.full_name ?? "—"}
                      </p>
                      <p className="truncate text-xs text-gray-400">
                        {s.employee_id ?? ""}
                        {s.department ? ` · ${s.department}` : ""}
                      </p>
                    </div>
                    <Gauge className="h-4 w-4 text-gray-300" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* -------- One subject: pick a date, review tasks, rate -------------------- */
function SubjectEvaluation({
  subject,
  evaluatorId,
  supabase,
  onBack,
}: {
  subject: Subject;
  evaluatorId: string;
  supabase: ReturnType<typeof createClient>;
  onBack: () => void;
}) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [date, setDate] = useState(today);

  const range = useMemo(() => {
    const start = new Date(date + "T00:00:00");
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }, [date]);

  const tasksQ = useQuery({
    queryKey: ["evaluation", "tasks", subject.id, date],
    queryFn: async (): Promise<TaskEntry[]> => {
      const { data, error } = await supabase
        .from("daily_task_logs")
        .select("*")
        .eq("profile_id", subject.id)
        .gte("created_at", range.start)
        .lt("created_at", range.end)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TaskEntry[];
    },
  });

  const attQ = useQuery({
    queryKey: ["evaluation", "att", subject.id, date],
    queryFn: async (): Promise<AttendanceRecord | null> => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("profile_id", subject.id)
        .gte("check_in_time", range.start)
        .lt("check_in_time", range.end)
        .order("check_in_time", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data?.[0] as AttendanceRecord) ?? null;
    },
  });

  const evalQ = useQuery({
    queryKey: ["evaluation", "existing", evaluatorId, subject.id, date],
    queryFn: async (): Promise<Evaluation | null> => {
      const { data, error } = await supabase
        .from("evaluations")
        .select("*")
        .eq("evaluator_id", evaluatorId)
        .eq("subject_id", subject.id)
        .eq("eval_date", date)
        .maybeSingle();
      if (error) throw error;
      return (data as Evaluation) ?? null;
    },
  });

  const loading = tasksQ.isLoading || attQ.isLoading || evalQ.isLoading;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Avatar name={subject.full_name} src={subject.avatar_url} size="sm" />
          <div>
            <p className="text-sm font-bold text-dark-base">{subject.full_name}</p>
            <p className="text-xs text-gray-400">
              {subject.employee_id}
              {subject.department ? ` · ${subject.department}` : ""}
            </p>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Evaluation date
          </label>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 rounded-xl border border-gray-200 px-3 text-sm focus:border-electric-violet focus:outline-none focus:ring-2 focus:ring-electric-violet/30"
          />
        </div>
      </div>

      {loading ? (
        <SkeletonCard />
      ) : (
        <DailyEval
          key={`${subject.id}-${date}`}
          tasks={tasksQ.data ?? []}
          attendance={attQ.data ?? null}
          existing={evalQ.data ?? null}
          subject={subject}
          evaluatorId={evaluatorId}
          evalDate={date}
          supabase={supabase}
        />
      )}
    </div>
  );
}

/* -------- The checkable task list + slider (remounts per subject/date) ----- */
function DailyEval({
  tasks,
  attendance,
  existing,
  subject,
  evaluatorId,
  evalDate,
  supabase,
}: {
  tasks: TaskEntry[];
  attendance: AttendanceRecord | null;
  existing: Evaluation | null;
  subject: Subject;
  evaluatorId: string;
  evalDate: string;
  supabase: ReturnType<typeof createClient>;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(existing?.checked_task_ids ?? []),
  );
  const [score, setScore] = useState<number>(existing?.score ?? 50);
  const [note, setNote] = useState(existing?.note ?? "");
  const [saving, setSaving] = useState(false);

  const allChecked =
    tasks.length === 0 || tasks.every((t) => checked.has(t.id));
  const meta = scoreMeta(score);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function openProof(f: Parameters<typeof openStoredFile>[2]) {
    const ok = await openStoredFile(supabase, STORAGE_BUCKETS.proofOfWork, f);
    if (!ok) toast({ title: "Couldn't open file", variant: "error" });
  }

  async function save() {
    setSaving(true);
    try {
      const { error } = await supabase.from("evaluations").upsert(
        {
          evaluator_id: evaluatorId,
          subject_id: subject.id,
          eval_date: evalDate,
          score,
          checked_task_ids: [...checked],
          note: note.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "evaluator_id,subject_id,eval_date" },
      );
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["evaluation"] });
      toast({ title: `Rated ${score}% — saved`, variant: "success" });
    } catch (err) {
      toast({
        title: "Couldn't save rating",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Attendance summary for the day */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 text-sm shadow-card">
        {attendance ? (
          <>
            <Badge
              variant={
                attendance.status === "late"
                  ? "late"
                  : attendance.status === "wfh"
                    ? "info"
                    : "present"
              }
              dot
            >
              {attendance.status}
            </Badge>
            <span className="inline-flex items-center gap-1 text-gray-500">
              <Clock className="h-3.5 w-3.5" />
              In{" "}
              {attendance.check_in_time
                ? format(new Date(attendance.check_in_time), "hh:mm a")
                : "—"}{" "}
              · Out{" "}
              {attendance.check_out_time
                ? format(new Date(attendance.check_out_time), "hh:mm a")
                : "—"}
            </span>
          </>
        ) : (
          <span className="text-gray-400">No attendance recorded this day.</span>
        )}
      </div>

      {/* Tasks to check */}
      <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-dark-base">
            Tasks on {format(new Date(evalDate + "T00:00:00"), "EEE, dd MMM yyyy")}
          </h3>
          <span className="text-xs text-gray-400">
            {checked.size}/{tasks.length} checked
          </span>
        </div>

        {tasks.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">
            No tasks were logged on this day.
          </p>
        ) : (
          <div className="space-y-2.5">
            {tasks.map((t) => {
              const isChecked = checked.has(t.id);
              return (
                <div
                  key={t.id}
                  className={cn(
                    "rounded-xl border p-3 transition-colors",
                    isChecked
                      ? "border-success/30 bg-success/5"
                      : "border-gray-100 bg-gray-50/60",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-dark-base">
                        {t.task_title}
                      </p>
                      {t.description && (
                        <p className="mt-0.5 text-sm text-gray-600">
                          {t.description}
                        </p>
                      )}
                      {t.proof_files && t.proof_files.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {t.proof_files.map((f, i) => (
                            <button
                              key={i}
                              onClick={() => openProof(f)}
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
                    <button
                      onClick={() => toggle(t.id)}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
                        isChecked
                          ? "bg-success text-white"
                          : "border border-gray-200 text-gray-500 hover:bg-gray-100",
                      )}
                    >
                      {isChecked ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                      {isChecked ? "Checked" : "Check"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rating slider */}
      <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-dark-base">
            Performance rating
          </h3>
          {existing && (
            <span className="text-xs text-gray-400">
              Last saved: {existing.score}%
            </span>
          )}
        </div>

        {!allChecked ? (
          <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
            <Lock className="h-4 w-4 shrink-0" />
            Check every task above to unlock the rating slider.
          </p>
        ) : (
          <>
            <div className="mb-3 flex items-baseline gap-2">
              <span
                className="text-4xl font-extrabold"
                style={{ color: meta.color }}
              >
                {score}
                <span className="text-lg">%</span>
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                style={{ backgroundColor: meta.color }}
              >
                {meta.label}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              className="w-full accent-electric-violet"
              style={{ accentColor: meta.color }}
            />
            <div className="mt-1 flex justify-between text-[11px] text-gray-400">
              <span>0</span>
              <span>50</span>
              <span>100</span>
            </div>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Private note (optional) — only you can see this."
              className="mt-4 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-electric-violet focus:outline-none focus:ring-2 focus:ring-electric-violet/30"
            />

            <div className="mt-3 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs text-gray-400">
                <Lock className="h-3.5 w-3.5" />
                Private — {subject.full_name?.split(" ")[0] ?? "they"} can&apos;t see this.
              </p>
              <Button
                onClick={save}
                loading={saving}
                leftIcon={<Save className="h-4 w-4" />}
              >
                {existing ? "Update rating" : "Save rating"}
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

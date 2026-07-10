"use client";

import { useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { MessageSquarePlus, Paperclip, Download } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { openStoredFile } from "@/lib/storage";
import { notifyEvent } from "@/lib/notify";
import { STORAGE_BUCKETS } from "@/lib/constants";
import { monthOptions, yearOptions, monthRange } from "@/lib/dates";
import type { StoredFile } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/LoadingSkeleton";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

interface JoinedProfile {
  full_name: string | null;
  employee_id: string | null;
  avatar_url: string | null;
}
interface Comment {
  id: string;
  comment: string;
  created_at: string;
}
interface LogRow {
  id: string;
  profile_id: string;
  task_title: string;
  description: string | null;
  day_number: number;
  proof_files: StoredFile[] | null;
  submitted_at: string | null;
  plan: { plan_number: number } | { plan_number: number }[] | null;
  profile: JoinedProfile | JoinedProfile[] | null;
  comments: Comment[] | null;
}
interface PlanRow {
  id: string;
  submitted_at: string;
  plan_content: { milestones?: { week: string; goal: string }[] } | null;
  profile: JoinedProfile | JoinedProfile[] | null;
}

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export function TaskReview({ adminUid }: { adminUid: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<"logs" | "plans">("logs");

  return (
    <div>
      <div className="mb-6 inline-flex rounded-xl border border-gray-100 bg-white p-1 shadow-card">
        {(["logs", "plans"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              tab === t
                ? "bg-gradient-primary text-white shadow-soft"
                : "text-gray-500 hover:text-dark-base",
            )}
          >
            {t === "logs" ? "Daily submissions" : "90-day plans"}
          </button>
        ))}
      </div>

      {tab === "logs" ? (
        <DailyLogs supabase={supabase} adminUid={adminUid} />
      ) : (
        <Plans supabase={supabase} />
      )}
    </div>
  );
}

/* ---- Daily logs + comments ------------------------------------------------ */
function DailyLogs({
  supabase,
  adminUid,
}: {
  supabase: SupabaseClient;
  adminUid: string;
}) {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | null>(now.getMonth());

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "task_logs", year, month],
    queryFn: async (): Promise<LogRow[]> => {
      const { start, end } = monthRange(year, month);
      const { data, error } = await supabase
        .from("daily_task_logs")
        .select(
          "id, profile_id, task_title, description, day_number, proof_files, submitted_at, plan:thirty_day_plans(plan_number), profile:profiles(full_name, employee_id, avatar_url), comments:admin_comments(id, comment, created_at)",
        )
        .gte("created_at", start)
        .lt("created_at", end)
        .order("submitted_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as LogRow[];
    },
  });

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
        <p className="text-sm text-gray-500">Daily submissions by employees</p>
        {filters}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="No submissions for this period"
          message="Try a different month or year."
        />
      ) : (
        data.map((log) => (
          <LogCard
            key={log.id}
            log={log}
            supabase={supabase}
            adminUid={adminUid}
          />
        ))
      )}
    </div>
  );
}

function LogCard({
  log,
  supabase,
  adminUid,
}: {
  log: LogRow;
  supabase: SupabaseClient;
  adminUid: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const p = one(log.profile);

  async function openProof(file: StoredFile) {
    const ok = await openStoredFile(supabase, STORAGE_BUCKETS.proofOfWork, file);
    if (!ok) toast({ title: "Couldn't open file", variant: "error" });
  }

  async function addComment() {
    const text = comment.trim();
    if (!text) return;
    setSaving(true);
    const { error } = await supabase.from("admin_comments").insert({
      task_log_id: log.id,
      admin_id: adminUid,
      comment: text,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Comment failed", description: error.message, variant: "error" });
      return;
    }
    notifyEvent({
      kind: "comment",
      subjectProfileId: log.profile_id,
      message: `On "${log.task_title}" (Day ${log.day_number}): ${text}`,
    });
    setComment("");
    await queryClient.invalidateQueries({ queryKey: ["admin", "task_logs"] });
    toast({ title: "Comment added", variant: "success" });
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={p?.full_name} src={p?.avatar_url} size="sm" />
          <div>
            <p className="text-sm font-semibold text-dark-base">
              {p?.full_name ?? "—"}
            </p>
            <p className="text-xs text-gray-400">
              {p?.employee_id} ·{" "}
              {log.submitted_at
                ? format(new Date(log.submitted_at), "EEE, dd MMM yyyy · hh:mm a")
                : "—"}
            </p>
          </div>
        </div>
        <Badge variant="info">
          {one(log.plan) ? `Plan ${one(log.plan)!.plan_number} · ` : ""}Day{" "}
          {log.day_number}
        </Badge>
      </div>

      <p className="mt-3 text-sm font-semibold text-dark-base">
        {log.task_title}
      </p>
      {log.description && (
        <p className="mt-1 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
          {log.description}
        </p>
      )}

      {log.proof_files && log.proof_files.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {log.proof_files.map((f, i) => (
            <button
              key={i}
              onClick={() => openProof(f)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-dark-base transition-colors hover:bg-gray-50"
            >
              <Paperclip className="h-3.5 w-3.5" />
              <span className="max-w-[160px] truncate">{f.filename}</span>
              <Download className="h-3.5 w-3.5 text-gray-400" />
            </button>
          ))}
        </div>
      )}

      {/* Existing comments */}
      {log.comments && log.comments.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-gray-50 pt-3">
          {log.comments.map((c) => (
            <div
              key={c.id}
              className="rounded-lg bg-electric-violet/5 p-2.5 text-sm text-dark-base"
            >
              <p className="mb-0.5 text-xs font-medium text-electric-violet">
                Admin · {format(new Date(c.created_at), "dd MMM")}
              </p>
              {c.comment}
            </div>
          ))}
        </div>
      )}

      {/* Add comment */}
      <div className="mt-3 flex items-center gap-2">
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addComment();
          }}
          placeholder="Add a comment…"
          className="h-10 flex-1 rounded-xl border border-gray-200 px-3 text-sm focus:border-electric-violet focus:outline-none focus:ring-2 focus:ring-electric-violet/30"
        />
        <Button
          size="sm"
          onClick={addComment}
          loading={saving}
          disabled={!comment.trim()}
          leftIcon={<MessageSquarePlus className="h-4 w-4" />}
        >
          Comment
        </Button>
      </div>
    </div>
  );
}

/* ---- 90-day plans --------------------------------------------------------- */
function Plans({ supabase }: { supabase: SupabaseClient }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "task_plans"],
    queryFn: async (): Promise<PlanRow[]> => {
      const { data, error } = await supabase
        .from("task_plans")
        .select(
          "id, submitted_at, plan_content, profile:profiles(full_name, employee_id)",
        )
        .order("submitted_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as PlanRow[];
    },
  });

  if (isLoading)
    return (
      <div className="space-y-4">
        <SkeletonCard />
      </div>
    );

  if (!data || data.length === 0)
    return (
      <EmptyState
        title="No plans yet"
        message="Employees' 90-day plans will appear here."
      />
    );

  return (
    <div className="space-y-4">
      {data.map((plan) => {
        const p = one(plan.profile);
        return (
          <div
            key={plan.id}
            className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card"
          >
            <div className="mb-3 flex items-center gap-2.5">
              <Avatar name={p?.full_name} size="sm" />
              <div>
                <p className="text-sm font-semibold text-dark-base">
                  {p?.full_name ?? "—"}
                </p>
                <p className="text-xs text-gray-400">
                  {p?.employee_id} ·{" "}
                  {format(new Date(plan.submitted_at), "dd MMM yyyy")}
                </p>
              </div>
            </div>
            <ul className="space-y-2">
              {(plan.plan_content?.milestones ?? []).map((m, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="shrink-0 font-semibold text-electric-violet">
                    {m.week || `#${i + 1}`}
                  </span>
                  <span className="text-gray-600">{m.goal}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

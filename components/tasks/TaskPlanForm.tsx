"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Target,
  Lock,
  CheckCircle2,
  CalendarRange,
  Upload,
  FileText,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { uploadUserFiles, openStoredFile } from "@/lib/storage";
import { STORAGE_BUCKETS } from "@/lib/constants";
import type { TaskPlan, ThirtyDayPlan, StoredFile } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { SkeletonCard } from "@/components/ui/LoadingSkeleton";
import { useToast } from "@/components/ui/Toast";

const PLAN_RANGES = ["Days 1–30", "Days 31–60", "Days 61–90"];

export function TaskPlanForm({ uid }: { uid: string }) {
  const supabase = useMemo(() => createClient(), []);

  const masterQuery = useQuery({
    queryKey: ["task_plans", uid],
    queryFn: async (): Promise<TaskPlan | null> => {
      const { data, error } = await supabase
        .from("task_plans")
        .select("*")
        .eq("profile_id", uid)
        .order("submitted_at", { ascending: true })
        .limit(1);
      if (error) throw error;
      return (data?.[0] as TaskPlan) ?? null;
    },
  });

  const plansQuery = useQuery({
    queryKey: ["thirty_day_plans", uid],
    queryFn: async (): Promise<ThirtyDayPlan[]> => {
      const { data, error } = await supabase
        .from("thirty_day_plans")
        .select("*")
        .eq("profile_id", uid)
        .order("plan_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ThirtyDayPlan[];
    },
  });

  if (masterQuery.isLoading || plansQuery.isLoading) return <SkeletonCard />;

  const master = masterQuery.data ?? null;
  const plans = plansQuery.data ?? [];
  const nextPlanNumber = plans.length + 1;

  return (
    <div className="space-y-8">
      {/* 90-day master plan — uploaded once */}
      {!master ? (
        <PlanUpload
          icon={Target}
          title="90-Day Master Plan"
          hint="Upload your quarter plan (any file — PDF, sheet, doc)."
          onUpload={async (file) => {
            const [stored] = await uploadUserFiles(
              supabase,
              STORAGE_BUCKETS.proofOfWork,
              uid,
              [file],
              "plan",
            );
            const { error } = await supabase.from("task_plans").insert({
              profile_id: uid,
              plan_content: { file: stored },
              submitted_at: new Date().toISOString(),
            });
            if (error) throw error;
          }}
          invalidateKey={["task_plans"]}
        />
      ) : (
        <PlanCard
          supabase={supabase}
          icon={Target}
          title="90-Day Master Plan"
          subtitle={`Uploaded ${format(new Date(master.submitted_at), "dd MMM yyyy")} · one-time`}
          file={master.plan_content?.file}
        />
      )}

      {/* Three sequential 30-day plans */}
      <div>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-400">
          30-Day Plans
        </h3>
        <div className="space-y-4">
          {[1, 2, 3].map((n) => {
            const existing = plans.find((p) => p.plan_number === n);
            const isNext = n === nextPlanNumber && !!master;
            if (existing)
              return (
                <PlanCard
                  key={n}
                  supabase={supabase}
                  icon={CalendarRange}
                  title={`30-Day Plan ${n}`}
                  subtitle={PLAN_RANGES[n - 1]}
                  file={existing.content?.file}
                />
              );
            if (isNext)
              return (
                <PlanUpload
                  key={n}
                  icon={CalendarRange}
                  title={`30-Day Plan ${n}`}
                  hint={`${PLAN_RANGES[n - 1]} · upload your plan for this window.`}
                  highlight
                  onUpload={async (file) => {
                    const [stored] = await uploadUserFiles(
                      supabase,
                      STORAGE_BUCKETS.proofOfWork,
                      uid,
                      [file],
                      "plan",
                    );
                    const { error } = await supabase
                      .from("thirty_day_plans")
                      .insert({
                        profile_id: uid,
                        plan_number: n,
                        content: { file: stored },
                      });
                    if (error) throw error;
                  }}
                  invalidateKey={["thirty_day_plans"]}
                />
              );
            return (
              <LockedPlanCard
                key={n}
                planNumber={n}
                range={PLAN_RANGES[n - 1]}
                reason={
                  !master
                    ? "Upload your 90-day master plan first"
                    : `Complete Plan ${n - 1} first`
                }
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---- upload card ---------------------------------------------------------- */
function PlanUpload({
  icon: Icon,
  title,
  hint,
  onUpload,
  invalidateKey,
  highlight = false,
}: {
  icon: typeof Target;
  title: string;
  hint: string;
  onUpload: (file: File) => Promise<void>;
  invalidateKey: string[];
  highlight?: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!file) return;
    setSaving(true);
    try {
      await onUpload(file);
      await queryClient.invalidateQueries({ queryKey: invalidateKey });
      toast({ title: `${title} uploaded!`, variant: "success" });
      setFile(null);
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={
        highlight
          ? "rounded-2xl border-2 border-electric-violet/30 bg-white p-6 shadow-card"
          : "rounded-2xl border border-gray-100 bg-white p-6 shadow-card"
      }
    >
      <div className="mb-1 flex items-center gap-2">
        <Icon className="h-5 w-5 text-electric-violet" />
        <h2 className="text-base font-bold text-dark-base">{title}</h2>
      </div>
      <p className="mb-4 text-sm text-gray-500">{hint}</p>

      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50/60 px-4 py-8 text-center transition-colors hover:border-electric-violet/40">
        <Upload className="h-6 w-6 text-gray-400" />
        <span className="text-sm text-gray-500">
          {file ? "Change file" : "Tap to choose a file"}
        </span>
        <input
          type="file"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>

      {file && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-3 py-2 text-sm">
          <FileText className="h-4 w-4 text-gray-400" />
          <span className="flex-1 truncate">{file.name}</span>
        </div>
      )}

      <Button
        className="mt-4"
        fullWidth
        disabled={!file || saving}
        loading={saving}
        onClick={submit}
      >
        Upload plan
      </Button>
    </div>
  );
}

/* ---- read-only card ------------------------------------------------------- */
function PlanCard({
  supabase,
  icon: Icon,
  title,
  subtitle,
  file,
}: {
  supabase: ReturnType<typeof createClient>;
  icon: typeof Target;
  title: string;
  subtitle: string;
  file?: StoredFile;
}) {
  const { toast } = useToast();
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-5 w-5 text-electric-violet" />
        <h3 className="text-base font-bold text-dark-base">{title}</h3>
        <CheckCircle2 className="ml-auto h-5 w-5 text-success" />
      </div>
      <p className="mb-3 text-xs text-gray-400">{subtitle}</p>
      {file ? (
        <button
          onClick={async () => {
            const ok = await openStoredFile(
              supabase,
              STORAGE_BUCKETS.proofOfWork,
              file,
            );
            if (!ok) toast({ title: "Couldn't open file", variant: "error" });
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-dark-base hover:bg-gray-50"
        >
          <FileText className="h-4 w-4 text-gray-400" />
          <span className="max-w-[220px] truncate">{file.filename}</span>
          <ExternalLink className="h-3.5 w-3.5 text-cool-blue" />
        </button>
      ) : (
        <p className="text-sm text-gray-400">No file.</p>
      )}
    </div>
  );
}

function LockedPlanCard({
  planNumber,
  range,
  reason,
}: {
  planNumber: number;
  range: string;
  reason: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 p-5">
      <Lock className="h-5 w-5 text-gray-300" />
      <div>
        <p className="text-sm font-semibold text-gray-400">
          30-Day Plan {planNumber} <span className="font-normal">· {range}</span>
        </p>
        <p className="text-xs text-gray-400">{reason}</p>
      </div>
    </div>
  );
}

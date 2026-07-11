"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { startOfDay } from "date-fns";
import confetti from "canvas-confetti";
import { Plus, CalendarRange, Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import {
  uploadUserFiles,
  linksToStoredFiles,
  openStoredFile,
} from "@/lib/storage";
import { STORAGE_BUCKETS } from "@/lib/constants";
import { notifyEvent } from "@/lib/notify";
import type { ThirtyDayPlan, TaskEntry, AttendanceRecord } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import {
  ProofFilesInput,
  emptyProof,
  type ProofDraft,
} from "@/components/ui/ProofFilesInput";

export function DailyTaskForm({ uid }: { uid: string }) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [day, setDay] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [proof, setProof] = useState<ProofDraft>(emptyProof);
  const [submitting, setSubmitting] = useState(false);

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

  const activePlan = useMemo(() => {
    const plans = plansQuery.data ?? [];
    return plans.length ? plans[plans.length - 1] : null;
  }, [plansQuery.data]);

  const tasksQuery = useQuery({
    queryKey: ["daily_task_logs", uid, activePlan?.id],
    enabled: !!activePlan,
    queryFn: async (): Promise<TaskEntry[]> => {
      const { data, error } = await supabase
        .from("daily_task_logs")
        .select("*")
        .eq("profile_id", uid)
        .eq("thirty_day_plan_id", activePlan!.id)
        .is("deleted_at", null)
        .order("day_number", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TaskEntry[];
    },
  });

  const dayRange = useMemo(() => {
    if (!activePlan) return [];
    const start = (activePlan.plan_number - 1) * 30 + 1;
    return Array.from({ length: 30 }, (_, i) => start + i);
  }, [activePlan]);

  // Group existing tasks by day.
  const byDay = useMemo(() => {
    const map = new Map<number, TaskEntry[]>();
    (tasksQuery.data ?? []).forEach((t) => {
      const arr = map.get(t.day_number) ?? [];
      arr.push(t);
      map.set(t.day_number, arr);
    });
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [tasksQuery.data]);

  const hasProof = proof.files.length > 0 || proof.links.length > 0;

  async function addTask() {
    if (!activePlan || day === null || !title.trim() || !hasProof) return;
    setSubmitting(true);
    try {
      const uploaded = proof.files.length
        ? await uploadUserFiles(
            supabase,
            STORAGE_BUCKETS.proofOfWork,
            uid,
            proof.files,
            "proof",
          )
        : [];
      const proofFiles = [...uploaded, ...linksToStoredFiles(proof.links)];
      // Link today's attendance if the employee has checked in.
      const dayStart = startOfDay(new Date()).toISOString();
      const { data: att } = await supabase
        .from("attendance")
        .select("id")
        .eq("profile_id", uid)
        .gte("check_in_time", dayStart)
        .limit(1);
      const attendanceId = (att?.[0] as AttendanceRecord | undefined)?.id ?? null;

      const { error } = await supabase.from("daily_task_logs").insert({
        profile_id: uid,
        thirty_day_plan_id: activePlan.id,
        day_number: day,
        task_title: title.trim(),
        description: description.trim() || null,
        proof_files: proofFiles,
        attendance_id: attendanceId,
      });
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["daily_task_logs"] });
      notifyEvent({
        kind: "task",
        message: `Logged Day ${day}: "${title.trim()}"${description.trim() ? ` — ${description.trim()}` : ""}`,
      });
      confetti({
        particleCount: 90,
        spread: 65,
        origin: { y: 0.7 },
        colors: ["#7516EA", "#2E94F3", "#22C55E"],
      });
      toast({ title: "Task logged 🎉", variant: "success" });
      setTitle("");
      setDescription("");
      setProof(emptyProof);
    } catch (err) {
      toast({
        title: "Couldn't log task",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (plansQuery.isLoading)
    return (
      <div className="flex items-center justify-center gap-3 rounded-2xl border border-gray-100 bg-white p-10 text-gray-500 shadow-card">
        <Spinner className="h-5 w-5 text-electric-violet" /> Loading…
      </div>
    );

  if (!activePlan)
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-card">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-electric-violet/10 text-electric-violet">
          <CalendarRange className="h-6 w-6" />
        </div>
        <p className="font-semibold text-dark-base">No active 30-day plan</p>
        <p className="max-w-xs text-sm text-gray-500">
          Submit your master plan and 30-Day Plan 1 to start logging daily tasks.
        </p>
        <Link href="/tasks/plan">
          <Button size="sm">Go to Plans</Button>
        </Link>
      </div>
    );

  const canAdd =
    day !== null && title.trim().length > 0 && hasProof && !submitting;

  return (
    <div className="space-y-6">
      {/* Add-task form */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <CalendarRange className="h-5 w-5 text-electric-violet" />
          <h2 className="text-lg font-bold text-dark-base">
            Log a task · Plan {activePlan.plan_number}
          </h2>
          <span className="ml-auto text-xs text-gray-400">
            Days {(activePlan.plan_number - 1) * 30 + 1}–
            {activePlan.plan_number * 30}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          <Select
            label="Day"
            placeholder="Select"
            value={day === null ? "" : String(day)}
            onChange={(e) => setDay(e.target.value ? Number(e.target.value) : null)}
            options={dayRange.map((d) => ({ label: `Day ${d}`, value: String(d) }))}
          />
          <Input
            label="Task"
            placeholder="e.g. Build the login page"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="mt-4">
          <Textarea
            label="Description"
            rows={2}
            placeholder="What did you do?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Proof per task (files, camera, or links) */}
        <div className="mt-4">
          <ProofFilesInput value={proof} onChange={setProof} required />
        </div>

        <Button
          className="mt-5"
          fullWidth
          size="lg"
          disabled={!canAdd}
          loading={submitting}
          onClick={addTask}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          Add task
        </Button>
      </div>

      {/* Existing tasks grouped by day */}
      {byDay.length > 0 && (
        <div className="space-y-4">
          {byDay.map(([dayNum, tasks]) => (
            <div
              key={dayNum}
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card"
            >
              <p className="mb-3 text-sm font-bold text-dark-base">
                Day {dayNum}
                <span className="ml-2 font-normal text-gray-400">
                  {tasks.length} task{tasks.length > 1 ? "s" : ""}
                </span>
              </p>
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
                      <p className="mt-0.5 text-sm text-gray-600">
                        {t.description}
                      </p>
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
      )}
    </div>
  );
}

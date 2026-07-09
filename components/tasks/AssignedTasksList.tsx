"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ClipboardList, Clock, CheckCircle2, Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import {
  uploadUserFiles,
  linksToStoredFiles,
  openStoredFile,
} from "@/lib/storage";
import { STORAGE_BUCKETS } from "@/lib/constants";
import type { AssignedTask } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/LoadingSkeleton";
import { useToast } from "@/components/ui/Toast";
import {
  ProofFilesInput,
  emptyProof,
  type ProofDraft,
} from "@/components/ui/ProofFilesInput";

export function AssignedTasksList({ uid }: { uid: string }) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [now] = useState(() => Date.now());
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [proof, setProof] = useState<ProofDraft>(emptyProof);
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["assigned_tasks", uid],
    queryFn: async (): Promise<AssignedTask[]> => {
      const { data, error } = await supabase
        .from("assigned_tasks")
        .select("*")
        .eq("profile_id", uid)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AssignedTask[];
    },
  });

  async function submitDone(task: AssignedTask) {
    setSubmitting(true);
    try {
      const uploaded = proof.files.length
        ? await uploadUserFiles(
            supabase,
            STORAGE_BUCKETS.proofOfWork,
            uid,
            proof.files,
            "assigned-proof",
          )
        : [];
      const proofFiles = [...uploaded, ...linksToStoredFiles(proof.links)];
      const { error } = await supabase
        .from("assigned_tasks")
        .update({ status: "done", proof_files: proofFiles })
        .eq("id", task.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["assigned_tasks"] });
      toast({ title: "Task completed ✓", variant: "success" });
      setCompletingId(null);
      setProof(emptyProof);
    } catch (err) {
      toast({
        title: "Couldn't submit",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) return <SkeletonCard />;

  if (!data || data.length === 0)
    return (
      <EmptyState
        icon={ClipboardList}
        title="No assigned tasks"
        message="Tasks your admin assigns to you will show up here."
      />
    );

  return (
    <div className="space-y-4">
      {data.map((t) => {
        const overdue =
          t.status === "pending" && t.deadline
            ? new Date(t.deadline).getTime() < now
            : false;
        const completing = completingId === t.id;
        return (
          <div
            key={t.id}
            className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-electric-violet" />
                <p className="font-bold text-dark-base">{t.title}</p>
              </div>
              <Badge
                variant={
                  t.status === "done" ? "submitted" : overdue ? "absent" : "info"
                }
              >
                {t.status === "done" ? "Done" : overdue ? "Overdue" : "Assigned"}
              </Badge>
            </div>
            {t.message && <p className="mt-2 text-sm text-gray-600">{t.message}</p>}

            {/* Files the admin attached */}
            {t.attachments && t.attachments.length > 0 && (
              <div className="mt-2">
                <p className="mb-1 text-xs font-medium text-gray-400">
                  Attached by admin
                </p>
                <div className="flex flex-wrap gap-2">
                  {t.attachments.map((f, i) => (
                    <button
                      key={i}
                      onClick={() =>
                        openStoredFile(supabase, STORAGE_BUCKETS.taskAttachments, f)
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-cool-blue/30 bg-cool-blue/5 px-2.5 py-1 text-xs font-medium text-cool-blue hover:bg-cool-blue/10"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      <span className="max-w-[160px] truncate">{f.filename}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
              {t.assigned_for && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {format(new Date(t.assigned_for), "dd MMM, hh:mm a")}
                </span>
              )}
              {t.deadline && (
                <span className={overdue ? "font-medium text-red-500" : undefined}>
                  Due {format(new Date(t.deadline), "dd MMM yyyy, hh:mm a")}
                </span>
              )}
            </div>

            {/* Submitted proof */}
            {t.status === "done" && t.proof_files && t.proof_files.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {t.proof_files.map((f, i) => (
                  <button
                    key={i}
                    onClick={() =>
                      openStoredFile(supabase, STORAGE_BUCKETS.proofOfWork, f)
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium hover:bg-gray-50"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    <span className="max-w-[160px] truncate">{f.filename}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Complete flow */}
            {t.status === "pending" &&
              (completing ? (
                <div className="mt-4 space-y-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                  <ProofFilesInput
                    value={proof}
                    onChange={setProof}
                    label="Upload proof of work"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      loading={submitting}
                      onClick={() => submitDone(t)}
                      leftIcon={<CheckCircle2 className="h-4 w-4" />}
                    >
                      Submit &amp; mark done
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setCompletingId(null);
                        setProof(emptyProof);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  className="mt-4"
                  size="sm"
                  variant="secondary"
                  leftIcon={<CheckCircle2 className="h-4 w-4" />}
                  onClick={() => {
                    setCompletingId(t.id);
                    setProof(emptyProof);
                  }}
                >
                  Mark done
                </Button>
              ))}
          </div>
        );
      })}
    </div>
  );
}

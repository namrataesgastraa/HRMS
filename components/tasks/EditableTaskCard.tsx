"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Clock, Paperclip, Pencil, Trash2, X, Save } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import {
  openStoredFile,
  uploadUserFiles,
  linksToStoredFiles,
} from "@/lib/storage";
import { STORAGE_BUCKETS } from "@/lib/constants";
import type { TaskEntry, StoredFile } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import {
  ProofFilesInput,
  emptyProof,
  type ProofDraft,
} from "@/components/ui/ProofFilesInput";
import { TaskHistoryViewer } from "./TaskHistoryViewer";

/** Owner-editable daily task: edit text/proof or soft-delete; history preserved. */
export function EditableTaskCard({ task, uid }: { task: TaskEntry; uid: string }) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.task_title);
  const [description, setDescription] = useState(task.description ?? "");
  const [existingProof, setExistingProof] = useState<StoredFile[]>(
    task.proof_files ?? [],
  );
  const [newProof, setNewProof] = useState<ProofDraft>(emptyProof);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const ts = task.submitted_at ?? task.created_at;

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["daily_task_logs"] });

  async function save() {
    if (!title.trim()) {
      toast({ title: "Task title is required", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      const uploaded = newProof.files.length
        ? await uploadUserFiles(
            supabase,
            STORAGE_BUCKETS.proofOfWork,
            uid,
            newProof.files,
            "proof",
          )
        : [];
      const proof = [
        ...existingProof,
        ...uploaded,
        ...linksToStoredFiles(newProof.links),
      ];
      const { error } = await supabase
        .from("daily_task_logs")
        .update({
          task_title: title.trim(),
          description: description.trim() || null,
          proof_files: proof,
        })
        .eq("id", task.id);
      if (error) throw error;
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ["task_history", task.id] });
      setEditing(false);
      setNewProof(emptyProof);
      toast({ title: "Task updated", variant: "success" });
    } catch (err) {
      toast({
        title: "Couldn't update",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function softDelete() {
    setDeleting(true);
    const { error } = await supabase
      .from("daily_task_logs")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", task.id);
    setDeleting(false);
    if (error) {
      toast({ title: "Couldn't delete", description: error.message, variant: "error" });
      return;
    }
    await refresh();
    toast({ title: "Task deleted", variant: "success" });
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-electric-violet/30 bg-white p-3">
        <div className="space-y-3">
          <Input
            label="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            label="Description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {existingProof.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-semibold text-dark-base">Current proof</p>
              <ul className="flex flex-wrap gap-2">
                {existingProof.map((f, i) => (
                  <li
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs"
                  >
                    <Paperclip className="h-3.5 w-3.5 text-gray-400" />
                    <span className="max-w-[120px] truncate">{f.filename}</span>
                    <button
                      onClick={() => setExistingProof((p) => p.filter((_, j) => j !== i))}
                      className="text-gray-400 hover:text-red-500"
                      aria-label="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ProofFilesInput value={newProof} onChange={setNewProof} label="Add proof" />
          <div className="flex gap-2">
            <Button size="sm" loading={saving} onClick={save} leftIcon={<Save className="h-4 w-4" />}>
              Save changes
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={saving}
              onClick={() => {
                setEditing(false);
                setTitle(task.task_title);
                setDescription(task.description ?? "");
                setExistingProof(task.proof_files ?? []);
                setNewProof(emptyProof);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-dark-base">{task.task_title}</p>
        </div>
        {ts && (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-gray-400">
            <Clock className="h-3 w-3" />
            {format(new Date(ts), "dd MMM · hh:mm a")}
            {task.is_late && (
              <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                Late
              </span>
            )}
          </span>
        )}
      </div>

      {task.description && (
        <p className="mt-0.5 text-sm text-gray-600">{task.description}</p>
      )}

      {task.proof_files && task.proof_files.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {task.proof_files.map((f, i) => (
            <button
              key={i}
              onClick={() => openStoredFile(supabase, STORAGE_BUCKETS.proofOfWork, f)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium hover:bg-gray-50"
            >
              <Paperclip className="h-3.5 w-3.5" />
              <span className="max-w-[140px] truncate">{f.filename}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <TaskHistoryViewer taskLogId={task.id} editCount={task.edit_count} />
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          {confirmDel ? (
            <span className="inline-flex items-center gap-1">
              <button
                onClick={softDelete}
                disabled={deleting}
                className="rounded-lg bg-red-500 px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Confirm"}
              </button>
              <button
                onClick={() => setConfirmDel(false)}
                className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
              >
                No
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmDel(true)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  FileText,
  ExternalLink,
  Paperclip,
  ClipboardPlus,
  History,
  CalendarCheck,
  ListTodo,
  User,
  Clock,
} from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import {
  openStoredFile,
  uploadPublicFiles,
  linksToStoredFiles,
} from "@/lib/storage";
import { STORAGE_BUCKETS } from "@/lib/constants";
import { notifyEvent } from "@/lib/notify";
import { Trash2, UsersRound } from "lucide-react";
import {
  ProofFilesInput,
  emptyProof,
  type ProofDraft,
} from "@/components/ui/ProofFilesInput";
import type {
  Profile,
  EducationEntry,
  StoredFile,
  AttendanceRecord,
  TaskEntry,
  AuditEntry,
  AssignedTask,
} from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

type Tab = "overview" | "attendance" | "tasks" | "activity";

export function AdminEmployeeDetail({
  employeeId,
  adminUid,
  scope = "admin",
}: {
  employeeId: string;
  adminUid: string;
  scope?: "admin" | "manager";
}) {
  const isAdminScope = scope === "admin";
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [assignOpen, setAssignOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "employee", employeeId],
    queryFn: async () => {
      const [profileRes, detailsRes, attRes, tasksRes, auditRes, assignedRes] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("id", employeeId).single(),
          supabase
            .from("employee_details")
            .select("*")
            .eq("profile_id", employeeId)
            .maybeSingle(),
          supabase
            .from("attendance")
            .select("*")
            .eq("profile_id", employeeId)
            .order("check_in_time", { ascending: false })
            .limit(60),
          supabase
            .from("daily_task_logs")
            .select("*")
            .eq("profile_id", employeeId)
            .order("day_number", { ascending: false })
            .order("created_at", { ascending: true }),
          supabase
            .from("profile_audit_log")
            .select("*")
            .eq("profile_id", employeeId)
            .order("created_at", { ascending: false })
            .limit(30),
          supabase
            .from("assigned_tasks")
            .select("*")
            .eq("profile_id", employeeId)
            .order("created_at", { ascending: false }),
        ]);
      return {
        profile: profileRes.data as Profile | null,
        details: detailsRes.data,
        attendance: (attRes.data ?? []) as AttendanceRecord[],
        tasks: (tasksRes.data ?? []) as TaskEntry[],
        audit: (auditRes.data ?? []) as AuditEntry[],
        assigned: (assignedRes.data ?? []) as AssignedTask[],
      };
    },
  });

  async function openFile(bucket: string, file: StoredFile) {
    const ok = await openStoredFile(supabase, bucket, file);
    if (!ok) toast({ title: "Couldn't open file", variant: "error" });
  }

  async function toggleManager(prof: Profile) {
    const nextRole = prof.role === "manager" ? "employee" : "manager";
    const dept = prof.department ?? data?.details?.department ?? null;
    if (nextRole === "manager" && !dept) {
      toast({
        title: "Set a department first",
        description: "This employee needs a department before becoming its manager.",
        variant: "error",
      });
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ role: nextRole, department: dept })
      .eq("id", prof.id);
    if (error) {
      toast({ title: "Couldn't update role", description: error.message, variant: "error" });
      return;
    }
    await queryClient.invalidateQueries({
      queryKey: ["admin", "employee", employeeId],
    });
    toast({
      title:
        nextRole === "manager"
          ? `Now manager of ${dept}`
          : "Reverted to employee",
      variant: "success",
    });
  }

  async function deleteDocument(doc: StoredFile) {
    if (!confirm(`Delete "${doc.filename}"? This can't be undone.`)) return;
    try {
      if (doc.type !== "link") {
        await supabase.storage
          .from(STORAGE_BUCKETS.employeeDocuments)
          .remove([doc.url]);
      }
      const remaining = (data?.details?.documents ?? []).filter(
        (d: StoredFile) => d.url !== doc.url,
      );
      const { error } = await supabase
        .from("employee_details")
        .update({ documents: remaining })
        .eq("profile_id", employeeId);
      if (error) throw error;
      await queryClient.invalidateQueries({
        queryKey: ["admin", "employee", employeeId],
      });
      toast({ title: "Document deleted", variant: "success" });
    } catch (err) {
      toast({
        title: "Couldn't delete",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      });
    }
  }

  if (isLoading)
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
        <Spinner className="h-5 w-5 text-electric-violet" /> Loading…
      </div>
    );

  const p = data?.profile;
  if (!p)
    return <p className="text-sm text-gray-500">Employee not found.</p>;

  const details = data?.details;
  const education = (details?.education ?? []) as EducationEntry[];
  const documents = (details?.documents ?? []) as StoredFile[];

  const TABS: { key: Tab; label: string; icon: typeof User }[] = [
    { key: "overview", label: "Overview", icon: User },
    { key: "attendance", label: "Attendance", icon: CalendarCheck },
    { key: "tasks", label: "Tasks", icon: ListTodo },
    { key: "activity", label: "Activity", icon: History },
  ];

  return (
    <div className="space-y-6">
      <Link
        href={isAdminScope ? "/admin/employees" : "/team"}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-dark-base"
      >
        <ArrowLeft className="h-4 w-4" />{" "}
        {isAdminScope ? "Back to employees" : "Back to team"}
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-card sm:flex-row sm:items-center">
        <Avatar name={p.full_name} src={p.avatar_url} size="lg" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-dark-base">
              {p.full_name ?? "—"}
            </h1>
            {p.role === "admin" && <Badge variant="info">admin</Badge>}
          </div>
          <p className="text-sm text-gray-500">
            {p.employee_id} · {details?.designation ?? "—"} ·{" "}
            {details?.department ?? "—"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={p.profile_completed ? "submitted" : "pending"}>
              {p.profile_completed ? "Onboarded" : "Pending"}
            </Badge>
            {p.role === "manager" && (
              <Badge variant="info">manager · {p.department ?? "—"}</Badge>
            )}
            <Badge variant={p.can_chat ? "present" : "neutral"}>
              {p.can_chat ? "Chat on" : "Chat off"}
            </Badge>
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          {isAdminScope && p.role !== "admin" && (
            <Button
              variant={p.role === "manager" ? "secondary" : "primary"}
              leftIcon={<UsersRound className="h-4 w-4" />}
              onClick={() => toggleManager(p)}
            >
              {p.role === "manager" ? "Remove manager" : "Make manager"}
            </Button>
          )}
          <Button
            variant="secondary"
            leftIcon={<ClipboardPlus className="h-4 w-4" />}
            onClick={() => setAssignOpen(true)}
          >
            Assign task
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 shadow-card">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
              tab === t.key
                ? "bg-gradient-primary text-white shadow-soft"
                : "text-gray-500 hover:text-dark-base",
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Section title="Personal">
              <Detail label="Phone" value={details?.phone} />
              <Detail label="Personal email" value={details?.personal_email} />
              <Detail label="Age" value={details?.age ? `${details.age}` : null} />
              <Detail label="Address" value={details?.address} />
              <Detail label="Emergency contact" value={details?.emergency_contact} />
            </Section>
            <Section title="Employment">
              <Detail label="Designation" value={details?.designation} />
              <Detail label="Department" value={details?.department} />
              <Detail label="Joining date" value={details?.joining_date} />
              <Detail label="Reporting manager" value={details?.reporting_manager} />
            </Section>
          </div>

          <Section title="Education">
            {education.length === 0 ? (
              <p className="text-sm text-gray-400">None on file.</p>
            ) : (
              <ul className="space-y-1.5">
                {education.map((e, i) => (
                  <li key={i} className="text-sm text-dark-base">
                    {e.degree}, {e.institution}{" "}
                    <span className="text-gray-400">({e.year})</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {isAdminScope && (
          <Section title="Documents">
            {documents.length === 0 ? (
              <p className="text-sm text-gray-400">No documents uploaded.</p>
            ) : (
              <ul className="space-y-2">
                {documents.map((d, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 rounded-xl border border-gray-100 p-3"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-dark-base">
                        {d.category ?? "Document"}
                      </p>
                      <p className="truncate text-xs text-gray-400">
                        {d.filename}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        openFile(STORAGE_BUCKETS.employeeDocuments, d)
                      }
                      className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-cool-blue hover:underline"
                    >
                      View <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteDocument(d)}
                      aria-label="Delete document"
                      className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          )}
        </div>
      )}

      {/* Attendance */}
      {tab === "attendance" && (
        <Section title={`Attendance · ${data!.attendance.length} recent`}>
          {data!.attendance.length === 0 ? (
            <p className="text-sm text-gray-400">No records.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {data!.attendance.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-dark-base">
                    {a.check_in_time
                      ? format(new Date(a.check_in_time), "EEE, dd MMM yyyy")
                      : "—"}
                  </span>
                  <span className="text-gray-500">
                    {a.check_in_time
                      ? format(new Date(a.check_in_time), "hh:mm a")
                      : "—"}{" "}
                    →{" "}
                    {a.check_out_time
                      ? format(new Date(a.check_out_time), "hh:mm a")
                      : "—"}
                  </span>
                  <Badge
                    variant={
                      a.status === "late"
                        ? "late"
                        : a.status === "wfh"
                          ? "info"
                          : a.status === "absent"
                            ? "absent"
                            : "present"
                    }
                  >
                    {a.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Tasks — grouped by day, per-task proof with View */}
      {tab === "tasks" && <TasksByDay tasks={data!.tasks} onOpen={openFile} />}

      {/* Activity — audit log + assigned tasks */}
      {tab === "activity" && (
        <div className="space-y-4">
          <Section title="Edit history (audit log)">
            {data!.audit.length === 0 ? (
              <p className="text-sm text-gray-400">No edits recorded.</p>
            ) : (
              <ul className="space-y-2">
                {data!.audit.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 text-sm">
                    <History className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
                    <div>
                      <p className="text-dark-base">{a.summary ?? "Profile updated"}</p>
                      <p className="text-xs text-gray-400">
                        {format(new Date(a.created_at), "dd MMM yyyy, hh:mm a")}
                        {a.edited_by === employeeId ? " · by employee" : " · by admin"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Assigned tasks">
            {data!.assigned.length === 0 ? (
              <p className="text-sm text-gray-400">None assigned.</p>
            ) : (
              <ul className="space-y-2">
                {data!.assigned.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-xl border border-gray-100 p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-dark-base">{t.title}</span>
                      <Badge variant={t.status === "done" ? "submitted" : "pending"}>
                        {t.status}
                      </Badge>
                    </div>
                    {t.attachments && t.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {t.attachments.map((f, i) => (
                          <button
                            key={`a-${i}`}
                            onClick={() =>
                              openFile(STORAGE_BUCKETS.taskAttachments, f)
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-0.5 text-xs hover:bg-gray-50"
                          >
                            <Paperclip className="h-3 w-3" /> attachment
                          </button>
                        ))}
                      </div>
                    )}
                    {t.status === "done" &&
                      t.proof_files &&
                      t.proof_files.length > 0 && (
                        <div className="mt-2">
                          <span className="text-xs text-gray-400">Proof: </span>
                          {t.proof_files.map((f, i) => (
                            <button
                              key={`p-${i}`}
                              onClick={() =>
                                openFile(STORAGE_BUCKETS.proofOfWork, f)
                              }
                              className="mr-1.5 inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-0.5 text-xs text-cool-blue hover:bg-gray-50"
                            >
                              <Paperclip className="h-3 w-3" />
                              <span className="max-w-[120px] truncate">
                                {f.filename}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}

      <AssignTaskModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        employeeId={employeeId}
        employeeName={p.full_name ?? "employee"}
        adminUid={adminUid}
      />
    </div>
  );
}

/* ---- helpers -------------------------------------------------------------- */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-card">
      <h2 className="mb-4 text-sm font-bold text-dark-base">{title}</h2>
      {children}
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="mb-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-dark-base">{value || "—"}</p>
    </div>
  );
}

function TasksByDay({
  tasks,
  onOpen,
}: {
  tasks: TaskEntry[];
  onOpen: (bucket: string, file: StoredFile) => void;
}) {
  const byDay = useMemo(() => {
    const map = new Map<number, TaskEntry[]>();
    tasks.forEach((t) => {
      const arr = map.get(t.day_number) ?? [];
      arr.push(t);
      map.set(t.day_number, arr);
    });
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [tasks]);

  if (tasks.length === 0)
    return <Section title="Tasks"><p className="text-sm text-gray-400">No tasks logged.</p></Section>;

  return (
    <div className="space-y-4">
      {byDay.map(([day, dayTasks]) => {
        const when = dayTasks[0].submitted_at ?? dayTasks[0].created_at;
        return (
        <div key={day} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-dark-base">Day {day}</p>
              {when && (
                <p className="mt-0.5 text-xs font-medium text-gray-500">
                  {format(new Date(when), "EEEE, dd MMM yyyy")}
                </p>
              )}
            </div>
            <span className="shrink-0 text-xs text-gray-400">
              {dayTasks.length} task{dayTasks.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-3">
            {dayTasks.map((t) => {
              const ts = t.submitted_at ?? t.created_at;
              return (
              <div key={t.id} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-dark-base">{t.task_title}</p>
                  {ts && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      {format(new Date(ts), "dd MMM · hh:mm a")}
                      {t.is_late && (
                        <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          Late
                        </span>
                      )}
                    </span>
                  )}
                </div>
                {t.description && (
                  <p className="mt-0.5 text-sm text-gray-600">{t.description}</p>
                )}
                {t.proof_files && t.proof_files.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {t.proof_files.map((f, i) => (
                      <button
                        key={i}
                        onClick={() => onOpen(STORAGE_BUCKETS.proofOfWork, f)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium hover:bg-gray-50"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        <span className="max-w-[140px] truncate">{f.filename}</span>
                        <ExternalLink className="h-3 w-3 text-gray-400" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </div>
        );
      })}
    </div>
  );
}

function AssignTaskModal({
  open,
  onClose,
  employeeId,
  employeeName,
  adminUid,
}: {
  open: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  adminUid: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [assignedFor, setAssignedFor] = useState("");
  const [deadline, setDeadline] = useState("");
  const [attach, setAttach] = useState<ProofDraft>(emptyProof);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const uploaded = attach.files.length
        ? await uploadPublicFiles(
            supabase,
            STORAGE_BUCKETS.taskAttachments,
            adminUid,
            attach.files,
          )
        : [];
      const attachments = [...uploaded, ...linksToStoredFiles(attach.links)];
      const { error } = await supabase.from("assigned_tasks").insert({
        admin_id: adminUid,
        profile_id: employeeId,
        title: title.trim(),
        message: message.trim() || null,
        assigned_for: assignedFor ? new Date(assignedFor).toISOString() : null,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        attachments: attachments.length ? attachments : null,
      });
      if (error) throw error;
      notifyEvent({
        kind: "assigned",
        subjectProfileId: employeeId,
        message: `"${title.trim()}"${message.trim() ? ` — ${message.trim()}` : ""}${deadline ? ` (due ${new Date(deadline).toLocaleString()})` : ""}`,
      });
      await queryClient.invalidateQueries({
        queryKey: ["admin", "employee", employeeId],
      });
      toast({ title: `Task assigned to ${employeeName}`, variant: "success" });
      setTitle("");
      setMessage("");
      setAssignedFor("");
      setDeadline("");
      setAttach(emptyProof);
      onClose();
    } catch (err) {
      toast({
        title: "Couldn't assign",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Assign a task to ${employeeName}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} disabled={!title.trim()}>
            Assign
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Task title"
          placeholder="e.g. Prepare Q3 ESG report"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <Textarea
          label="Message / details"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-dark-base">
              Time
            </label>
            <input
              type="datetime-local"
              value={assignedFor}
              onChange={(e) => setAssignedFor(e.target.value)}
              className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm focus:border-electric-violet focus:outline-none focus:ring-2 focus:ring-electric-violet/30"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-dark-base">
              Deadline
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm focus:border-electric-violet focus:outline-none focus:ring-2 focus:ring-electric-violet/30"
            />
          </div>
        </div>

        {/* Optional attachment the employee can view */}
        <ProofFilesInput
          value={attach}
          onChange={setAttach}
          label="Attach a file or link (optional)"
        />
      </div>
    </Modal>
  );
}

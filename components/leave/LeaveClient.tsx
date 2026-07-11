"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, differenceInCalendarDays } from "date-fns";
import {
  CalendarDays,
  Plus,
  X,
  Check,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { monthOptions, yearOptions, monthRange } from "@/lib/dates";
import type { LeaveRequest } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/LoadingSkeleton";
import { useToast } from "@/components/ui/Toast";
import { LeaveCalendar, type CalEntry } from "./LeaveCalendar";
import { cn } from "@/lib/utils";

type JoinedProfile = { full_name: string | null; avatar_url: string | null };
interface LeaveRow extends LeaveRequest {
  requester: JoinedProfile | JoinedProfile[] | null;
}

interface Props {
  scope: "admin" | "manager" | "employee";
  uid: string;
  department: string | null;
}

const LEAVE_TYPES = [
  "Casual",
  "Sick",
  "Earned / Paid",
  "Work from home",
  "Unpaid",
  "Other",
];

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const statusBadge = (s: LeaveRequest["status"]) =>
  s === "approved" ? "submitted" : s === "rejected" ? "absent" : "pending";

export function LeaveClient({ scope, uid, department }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const canReview = scope === "admin" || scope === "manager";
  const [tab, setTab] = useState<"mine" | "review" | "calendar">("mine");
  const [creating, setCreating] = useState(false);

  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | null>(now.getMonth());
  const [statusFilter, setStatusFilter] = useState<string>("");

  const SELECT =
    "*, requester:profiles!leave_requests_profile_id_fkey(full_name, avatar_url)";

  const { data, isLoading } = useQuery({
    queryKey: ["leaves", uid],
    queryFn: async (): Promise<LeaveRow[]> => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select(SELECT)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LeaveRow[];
    },
  });

  const all = data ?? [];
  const inPeriod = (r: LeaveRow) => {
    if (month === null) return new Date(r.start_date).getFullYear() === year;
    const { start, end } = monthRange(year, month);
    return r.start_date >= start.slice(0, 10) && r.start_date < end.slice(0, 10);
  };
  const matchStatus = (r: LeaveRow) => !statusFilter || r.status === statusFilter;

  const mine = all.filter((r) => r.profile_id === uid && inPeriod(r) && matchStatus(r));
  const toReview = all.filter(
    (r) => r.profile_id !== uid && matchStatus(r),
  );
  const calEntries: CalEntry[] = all
    .filter((r) => r.status !== "rejected")
    .map((r) => ({
      start: r.start_date,
      end: r.end_date,
      status: r.status,
      name: one(r.requester)?.full_name ?? "Someone",
    }));

  const tabBtn = (active: boolean) =>
    cn(
      "rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
      active ? "bg-gradient-primary text-white shadow-soft" : "text-gray-500 hover:text-dark-base",
    );

  const filters = (
    <div className="flex flex-wrap gap-2">
      <div className="w-36">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { label: "All statuses", value: "" },
            { label: "Pending", value: "pending" },
            { label: "Approved", value: "approved" },
            { label: "Rejected", value: "rejected" },
          ]}
        />
      </div>
      <div className="w-36">
        <Select
          value={month === null ? "" : String(month)}
          onChange={(e) => setMonth(e.target.value === "" ? null : Number(e.target.value))}
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-base">Leave</h1>
          <p className="text-sm text-gray-500">
            Request time off and track approvals.
          </p>
        </div>
        {!creating && tab === "mine" && (
          <Button onClick={() => setCreating(true)} leftIcon={<Plus className="h-4 w-4" />}>
            Request leave
          </Button>
        )}
      </div>

      {creating && (
        <RequestForm
          uid={uid}
          department={department}
          scope={scope}
          supabase={supabase}
          onClose={() => setCreating(false)}
        />
      )}

      <div className="inline-flex flex-wrap rounded-xl border border-gray-100 bg-white p-1 shadow-card">
        <button onClick={() => setTab("mine")} className={tabBtn(tab === "mine")}>
          My requests
        </button>
        {canReview && (
          <button onClick={() => setTab("review")} className={tabBtn(tab === "review")}>
            To review{toReview.filter((r) => r.status === "pending").length > 0
              ? ` (${toReview.filter((r) => r.status === "pending").length})`
              : ""}
          </button>
        )}
        <button onClick={() => setTab("calendar")} className={tabBtn(tab === "calendar")}>
          Calendar
        </button>
      </div>

      {tab !== "calendar" && <div className="flex justify-end">{filters}</div>}

      {isLoading ? (
        <SkeletonCard />
      ) : tab === "calendar" ? (
        <div className="space-y-3">
          <div className="flex justify-end">
            <div className="flex gap-2">
              <div className="w-36">
                <Select
                  value={String(month ?? now.getMonth())}
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
          <LeaveCalendar year={year} month={month ?? now.getMonth()} entries={calEntries} />
        </div>
      ) : tab === "review" ? (
        toReview.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Nothing to review" message="Leave requests sent to you appear here." />
        ) : (
          <div className="space-y-3">
            {toReview.map((r) => (
              <LeaveCard key={r.id} r={r} uid={uid} supabase={supabase} canReview />
            ))}
          </div>
        )
      ) : mine.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No leave requests"
          message="Request time off with the button above."
        />
      ) : (
        <div className="space-y-3">
          {mine.map((r) => (
            <LeaveCard key={r.id} r={r} uid={uid} supabase={supabase} />
          ))}
        </div>
      )}
    </div>
  );
}

/* -------- Card ------------------------------------------------------------- */
function LeaveCard({
  r,
  uid,
  supabase,
  canReview = false,
}: {
  r: LeaveRow;
  uid: string;
  supabase: ReturnType<typeof createClient>;
  canReview?: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const p = one(r.requester);
  const days =
    differenceInCalendarDays(new Date(r.end_date), new Date(r.start_date)) + 1;

  async function decide(status: "approved" | "rejected") {
    setBusy(true);
    const { error } = await supabase
      .from("leave_requests")
      .update({
        status,
        review_note: note.trim() || null,
        reviewed_by: uid,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", r.id);
    setBusy(false);
    if (error) {
      toast({ title: "Couldn't update", description: error.message, variant: "error" });
      return;
    }
    void fetch("/api/leaves/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leaveId: r.id, kind: "decision" }),
      keepalive: true,
    }).catch(() => {});
    await queryClient.invalidateQueries({ queryKey: ["leaves"] });
    toast({ title: `Leave ${status}`, variant: "success" });
  }

  async function cancel() {
    setBusy(true);
    const { error } = await supabase.from("leave_requests").delete().eq("id", r.id);
    setBusy(false);
    if (error) {
      toast({ title: "Couldn't cancel", description: error.message, variant: "error" });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["leaves"] });
    toast({ title: "Request cancelled", variant: "success" });
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {canReview && <Avatar name={p?.full_name} src={p?.avatar_url} size="sm" />}
          <div>
            {canReview && (
              <p className="text-sm font-semibold text-dark-base">{p?.full_name ?? "—"}</p>
            )}
            <p className="text-sm font-bold text-dark-base">{r.leave_type} leave</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
              <Clock className="h-3.5 w-3.5" />
              {format(new Date(r.start_date), "dd MMM yyyy")} –{" "}
              {format(new Date(r.end_date), "dd MMM yyyy")} · {days} day{days > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Badge variant={statusBadge(r.status)} dot>
          {r.status}
        </Badge>
      </div>

      {r.reason && (
        <p className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">{r.reason}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-400">
        Sent to:
        {r.to_admin && <span className="rounded-full bg-gray-100 px-2 py-0.5">Admin</span>}
        {r.to_manager && <span className="rounded-full bg-gray-100 px-2 py-0.5">Manager</span>}
      </div>

      {r.review_note && (
        <p className="mt-2 text-xs italic text-gray-500">Note: “{r.review_note}”</p>
      )}

      {/* Actions */}
      {canReview && r.status === "pending" ? (
        <div className="mt-4 space-y-2 border-t border-gray-50 pt-3">
          <Input
            placeholder="Optional note to the employee…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" loading={busy} onClick={() => decide("approved")} leftIcon={<Check className="h-4 w-4" />}>
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              loading={busy}
              onClick={() => decide("rejected")}
              leftIcon={<X className="h-4 w-4" />}
            >
              Reject
            </Button>
          </div>
        </div>
      ) : !canReview && r.status === "pending" ? (
        <div className="mt-4 border-t border-gray-50 pt-3">
          <Button size="sm" variant="ghost" loading={busy} onClick={cancel}>
            Cancel request
          </Button>
        </div>
      ) : (
        r.status !== "pending" && (
          <p
            className={cn(
              "mt-3 inline-flex items-center gap-1.5 text-xs font-medium",
              r.status === "approved" ? "text-success" : "text-red-500",
            )}
          >
            {r.status === "approved" ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <XCircle className="h-3.5 w-3.5" />
            )}
            {r.status === "approved" ? "Approved" : "Rejected"}
            {r.reviewed_at ? ` · ${format(new Date(r.reviewed_at), "dd MMM")}` : ""}
          </p>
        )
      )}
    </div>
  );
}

/* -------- Request form ----------------------------------------------------- */
function RequestForm({
  uid,
  department,
  scope,
  supabase,
  onClose,
}: {
  uid: string;
  department: string | null;
  scope: "admin" | "manager" | "employee";
  supabase: ReturnType<typeof createClient>;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [type, setType] = useState(LEAVE_TYPES[0]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [toAdmin, setToAdmin] = useState(true);
  const [toManager, setToManager] = useState(!!department && scope !== "manager");
  const [saving, setSaving] = useState(false);

  const canManager = !!department && scope !== "manager"; // managers have no manager above

  async function submit() {
    if (!start || !end) {
      toast({ title: "Pick your dates", variant: "error" });
      return;
    }
    if (end < start) {
      toast({ title: "End date can't be before start date", variant: "error" });
      return;
    }
    if (!toAdmin && !toManager) {
      toast({ title: "Choose a recipient", description: "Send to Admin, your Manager, or both.", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("leave_requests")
        .insert({
          profile_id: uid,
          leave_type: type,
          start_date: start,
          end_date: end,
          reason: reason.trim() || null,
          to_admin: toAdmin,
          to_manager: toManager && canManager,
          department,
        })
        .select("id")
        .single();
      if (error || !data) throw error ?? new Error("failed");

      void fetch("/api/leaves/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaveId: data.id, kind: "request" }),
        keepalive: true,
      }).catch(() => {});

      await queryClient.invalidateQueries({ queryKey: ["leaves"] });
      toast({ title: "Leave requested ✓", description: "Your request was sent.", variant: "success" });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: "Couldn't submit",
        description: /does not exist|schema cache/i.test(msg)
          ? "Leave feature needs a database update (migration 0018)."
          : msg,
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-electric-violet/30 bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-dark-base">Request leave</h2>
        <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Leave type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          options={LEAVE_TYPES.map((t) => ({ label: t, value: t }))}
        />
        <div className="hidden sm:block" />
        <div>
          <label className="mb-1 block text-sm font-medium text-dark-base">From</label>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm focus:border-electric-violet focus:outline-none focus:ring-2 focus:ring-electric-violet/30"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-dark-base">To</label>
          <input
            type="date"
            value={end}
            min={start || undefined}
            onChange={(e) => setEnd(e.target.value)}
            className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm focus:border-electric-violet focus:outline-none focus:ring-2 focus:ring-electric-violet/30"
          />
        </div>
        <Textarea
          label="Reason"
          className="sm:col-span-2"
          rows={3}
          placeholder="Briefly, why you need this leave"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      <div className="mt-4">
        <p className="mb-2 text-sm font-medium text-dark-base">Send request to</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setToAdmin((v) => !v)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors",
              toAdmin
                ? "border-electric-violet bg-electric-violet/5 text-electric-violet"
                : "border-gray-200 text-gray-500 hover:bg-gray-50",
            )}
          >
            <span className={cn("flex h-4 w-4 items-center justify-center rounded border", toAdmin ? "border-electric-violet bg-electric-violet text-white" : "border-gray-300")}>
              {toAdmin && "✓"}
            </span>
            Admin
          </button>
          <button
            type="button"
            disabled={!canManager}
            onClick={() => setToManager((v) => !v)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-40",
              toManager
                ? "border-electric-violet bg-electric-violet/5 text-electric-violet"
                : "border-gray-200 text-gray-500 hover:bg-gray-50",
            )}
            title={canManager ? undefined : "No department manager set for you"}
          >
            <span className={cn("flex h-4 w-4 items-center justify-center rounded border", toManager ? "border-electric-violet bg-electric-violet text-white" : "border-gray-300")}>
              {toManager && "✓"}
            </span>
            Department manager
          </button>
        </div>
        {!canManager && (
          <p className="mt-1 text-xs text-gray-400">
            {scope === "manager"
              ? "As a manager, your leave goes to the admin."
              : "No department manager on record — sending to admin."}
          </p>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} loading={saving} leftIcon={<CalendarDays className="h-4 w-4" />}>
          Submit request
        </Button>
      </div>
    </div>
  );
}

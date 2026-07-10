"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isAfter } from "date-fns";
import {
  Video,
  Plus,
  Calendar,
  Clock,
  LinkIcon,
  Lock,
  User,
  Users,
  Trash2,
  X,
  Search,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import type { Meeting } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/LoadingSkeleton";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

interface Person {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  department: string | null;
}

interface MeetingRow extends Meeting {
  host: { full_name: string | null; avatar_url: string | null } | null;
  attendees: { profile_id: string }[] | null;
}

interface Props {
  scope: "admin" | "manager" | "employee";
  uid: string;
  department: string | null;
}

const canCreate = (s: Props["scope"]) => s === "admin" || s === "manager";

export function MeetingsClient({ scope, uid, department }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["meetings", uid],
    queryFn: async (): Promise<MeetingRow[]> => {
      const { data, error } = await supabase
        .from("meetings")
        .select(
          "*, host:profiles!meetings_host_id_fkey(full_name, avatar_url), attendees:meeting_attendees(profile_id)",
        )
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MeetingRow[];
    },
  });

  const now = new Date();
  const upcoming = (data ?? []).filter((m) => isAfter(new Date(m.scheduled_at), now));
  const past = (data ?? []).filter((m) => !isAfter(new Date(m.scheduled_at), now));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-base">Meetings</h1>
          <p className="text-sm text-gray-500">
            {canCreate(scope)
              ? "Schedule meetings and invite your team."
              : "Meetings you've been invited to."}
          </p>
        </div>
        {canCreate(scope) && !creating && (
          <Button onClick={() => setCreating(true)} leftIcon={<Plus className="h-4 w-4" />}>
            New meeting
          </Button>
        )}
      </div>

      {creating && (
        <CreateMeeting
          scope={scope}
          uid={uid}
          department={department}
          supabase={supabase}
          onClose={() => setCreating(false)}
        />
      )}

      {isLoading ? (
        <SkeletonCard />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          icon={Video}
          title="No meetings yet"
          message={
            canCreate(scope)
              ? "Schedule your first team meeting with the button above."
              : "When you're invited to a meeting, it'll appear here."
          }
        />
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">
                Upcoming
              </h2>
              {upcoming.map((m) => (
                <MeetingCard key={m.id} m={m} uid={uid} supabase={supabase} upcoming />
              ))}
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">
                Past
              </h2>
              {past.map((m) => (
                <MeetingCard key={m.id} m={m} uid={uid} supabase={supabase} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* -------- Meeting card ----------------------------------------------------- */
function MeetingCard({
  m,
  uid,
  supabase,
  upcoming = false,
}: {
  m: MeetingRow;
  uid: string;
  supabase: ReturnType<typeof createClient>;
  upcoming?: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isHost = m.host_id === uid;
  const count = m.attendees?.length ?? 0;

  async function remove() {
    const { error } = await supabase.from("meetings").delete().eq("id", m.id);
    if (error) {
      toast({ title: "Couldn't cancel", description: error.message, variant: "error" });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["meetings"] });
    toast({ title: "Meeting cancelled", variant: "success" });
  }

  return (
    <div
      className={cn(
        "rounded-2xl border bg-white p-5 shadow-card",
        upcoming ? "border-electric-violet/20" : "border-gray-100 opacity-90",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-white">
            <Video className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-dark-base">{m.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {format(new Date(m.scheduled_at), "EEE, dd MMM yyyy")}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {format(new Date(m.scheduled_at), "hh:mm a")}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {count} invited
              </span>
            </div>
          </div>
        </div>
        {upcoming ? (
          <Badge variant="present" dot>
            Upcoming
          </Badge>
        ) : (
          <Badge variant="absent">Ended</Badge>
        )}
      </div>

      {m.description && (
        <p className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
          {m.description}
        </p>
      )}

      {(m.access_username || m.access_password) && (
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-600">
          {m.access_username && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-gray-50 px-2.5 py-1">
              <User className="h-3.5 w-3.5 text-gray-400" />
              {m.access_username}
            </span>
          )}
          {m.access_password && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-gray-50 px-2.5 py-1">
              <Lock className="h-3.5 w-3.5 text-gray-400" />
              {m.access_password}
            </span>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Avatar name={m.host?.full_name} src={m.host?.avatar_url} size="sm" />
          Hosted by {m.host?.full_name ?? "—"}
        </div>
        <div className="flex items-center gap-2">
          {isHost && (
            <button
              onClick={remove}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium text-red-500 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Cancel
            </button>
          )}
          {m.meeting_link && (
            <a href={m.meeting_link} target="_blank" rel="noopener noreferrer">
              <Button size="sm" leftIcon={<LinkIcon className="h-4 w-4" />}>
                Join
                <ExternalLink className="ml-1 h-3.5 w-3.5" />
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------- Create meeting form --------------------------------------------- */
function CreateMeeting({
  scope,
  uid,
  department,
  supabase,
  onClose,
}: {
  scope: "admin" | "manager" | "employee";
  uid: string;
  department: string | null;
  supabase: ReturnType<typeof createClient>;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [link, setLink] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: people } = useQuery({
    queryKey: ["meetings", "candidates", scope, department],
    queryFn: async (): Promise<Person[]> => {
      let q = supabase
        .from("profiles")
        .select("id, full_name, avatar_url, role, department")
        .neq("id", uid);
      if (scope === "manager") q = q.eq("department", department ?? "___none___");
      const { data, error } = await q.order("full_name");
      if (error) throw error;
      return (data ?? []) as Person[];
    },
  });

  const filtered = (people ?? []).filter((p) =>
    (p.full_name ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function create() {
    if (!title.trim() || !when || selected.size === 0) {
      toast({
        title: "Missing details",
        description: "Add a title, date/time, and at least one member.",
        variant: "error",
      });
      return;
    }
    setSaving(true);
    try {
      const { data: meeting, error } = await supabase
        .from("meetings")
        .insert({
          host_id: uid,
          title: title.trim(),
          description: description.trim() || null,
          meeting_link: link.trim() || null,
          access_username: username.trim() || null,
          access_password: password.trim() || null,
          scheduled_at: new Date(when).toISOString(),
          department: scope === "manager" ? department : null,
        })
        .select("id")
        .single();
      if (error || !meeting) throw error ?? new Error("failed");

      const rows = [...selected].map((pid) => ({
        meeting_id: meeting.id,
        profile_id: pid,
      }));
      const { error: aErr } = await supabase.from("meeting_attendees").insert(rows);
      if (aErr) throw aErr;

      // Fire email invites (fire-and-forget).
      void fetch("/api/meetings/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: meeting.id }),
        keepalive: true,
      }).catch(() => {});

      await queryClient.invalidateQueries({ queryKey: ["meetings"] });
      toast({ title: "Meeting scheduled ✓", description: "Invites sent.", variant: "success" });
      onClose();
    } catch (err) {
      const raw =
        err instanceof Error
          ? err.message
          : err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : typeof err === "string"
              ? err
              : JSON.stringify(err);
      let description = raw || "Please try again.";
      if (/schema cache|does not exist|find the table|PGRST205/i.test(raw)) {
        description =
          "The meetings database update isn't live yet. Run migration 0014, then wait ~30s for Supabase to refresh (or run: NOTIFY pgrst, 'reload schema';).";
      } else if (/row-level security|violates row-level|permission denied/i.test(raw)) {
        description =
          "Permission blocked by the database. Managers can only invite members of their own department — check the department values match.";
      }
      console.error("meeting create failed:", raw);
      toast({ title: "Couldn't schedule", description, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-electric-violet/30 bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-dark-base">New meeting</h2>
        <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Title"
          placeholder="Weekly sync"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="sm:col-span-2"
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-dark-base">
            Date &amp; time
          </label>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm focus:border-electric-violet focus:outline-none focus:ring-2 focus:ring-electric-violet/30"
          />
        </div>
        <Input
          label="Meeting link"
          placeholder="https://meet.google.com/…"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
        <Input
          label="Access username (optional)"
          placeholder="If required"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Input
          label="Access password (optional)"
          placeholder="If required"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Textarea
          label="Agenda / notes (optional)"
          placeholder="What's this meeting about?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="sm:col-span-2"
        />
      </div>

      {/* Member picker */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-dark-base">
            Invite {scope === "manager" ? "team members" : "members"}
          </label>
          <span className="text-xs text-gray-400">{selected.size} selected</span>
        </div>
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people…"
            className="h-10 w-full rounded-xl border border-gray-200 pl-9 pr-3 text-sm focus:border-electric-violet focus:outline-none focus:ring-2 focus:ring-electric-violet/30"
          />
        </div>
        <div className="max-h-56 divide-y divide-gray-50 overflow-y-auto rounded-xl border border-gray-100">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-sm text-gray-400">No people found.</p>
          ) : (
            filtered.map((p) => {
              const on = selected.has(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50"
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-md border",
                      on
                        ? "border-electric-violet bg-electric-violet text-white"
                        : "border-gray-300",
                    )}
                  >
                    {on && "✓"}
                  </span>
                  <Avatar name={p.full_name} src={p.avatar_url} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-dark-base">
                      {p.full_name ?? "—"}
                    </span>
                    <span className="block truncate text-xs text-gray-400">
                      {p.role}
                      {p.department ? ` · ${p.department}` : ""}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={create} loading={saving} leftIcon={<Video className="h-4 w-4" />}>
          Schedule &amp; invite
        </Button>
      </div>
    </div>
  );
}

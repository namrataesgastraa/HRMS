"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format, isSameDay } from "date-fns";
import { Send, Lock, MessagesSquare } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { Avatar } from "@/components/ui/Avatar";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

interface Props {
  uid: string;
  userName: string;
  canChat: boolean;
  userAvatar?: string | null;
  department?: string | null;
}

interface ChatMessage {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  senderName: string;
  senderAvatar: string | null;
  department: string | null;
}

type SenderJoin =
  | { full_name: string | null; avatar_url: string | null }
  | { full_name: string | null; avatar_url: string | null }[]
  | null;

function pickSender(s: SenderJoin) {
  return Array.isArray(s) ? (s[0] ?? null) : s;
}

export function ChatClient({
  uid,
  userName,
  canChat,
  userAvatar,
  department,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [channel, setChannel] = useState<"global" | "dept">("global");

  const nameCache = useRef<Map<string, string>>(new Map());
  const avatarCache = useRef<Map<string, string | null>>(new Map());
  const bottomRef = useRef<HTMLDivElement>(null);

  // Initial load — last 100 messages, oldest first.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("messages")
        .select(
          "id, content, created_at, sender_id, department, sender:profiles(full_name, avatar_url)",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (!active) return;
      if (error) {
        setLoading(false);
        return;
      }
      const rows = ((data ?? []) as unknown as Array<{
        id: string;
        content: string;
        created_at: string;
        sender_id: string;
        department: string | null;
        sender: SenderJoin;
      }>)
        .map((r) => {
          const s = pickSender(r.sender);
          return {
            id: r.id,
            content: r.content,
            created_at: r.created_at,
            sender_id: r.sender_id,
            department: r.department ?? null,
            senderName: s?.full_name ?? "Unknown",
            senderAvatar: s?.avatar_url ?? null,
          };
        })
        .reverse();
      rows.forEach((r) => {
        nameCache.current.set(r.sender_id, r.senderName);
        avatarCache.current.set(r.sender_id, r.senderAvatar);
      });
      setMessages(rows);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [supabase]);

  // Realtime — append new inserts.
  useEffect(() => {
    const chan = supabase
      .channel("public:messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const row = payload.new as {
            id: string;
            content: string;
            created_at: string;
            sender_id: string;
            department: string | null;
          };
          let name: string;
          let avatar: string | null;
          if (row.sender_id === uid) {
            name = userName;
            avatar = userAvatar ?? null;
          } else {
            const cached = nameCache.current.get(row.sender_id);
            if (cached) {
              name = cached;
              avatar = avatarCache.current.get(row.sender_id) ?? null;
            } else {
              const { data } = await supabase
                .from("profiles")
                .select("full_name, avatar_url")
                .eq("id", row.sender_id)
                .single();
              name = data?.full_name ?? "Unknown";
              avatar = data?.avatar_url ?? null;
              nameCache.current.set(row.sender_id, name);
              avatarCache.current.set(row.sender_id, avatar);
            }
          }
          setMessages((prev) =>
            prev.some((m) => m.id === row.id)
              ? prev
              : [
                  ...prev,
                  {
                    id: row.id,
                    content: row.content,
                    created_at: row.created_at,
                    sender_id: row.sender_id,
                    department: row.department ?? null,
                    senderName: name,
                    senderAvatar: avatar,
                  },
                ],
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chan);
    };
  }, [supabase, uid, userName, userAvatar]);

  // Which department value the active channel writes/reads.
  const channelDept = channel === "dept" ? department ?? null : null;

  // Messages visible in the active channel.
  const shown = messages.filter((m) =>
    channel === "global" ? m.department == null : m.department === department,
  );

  // Auto-scroll to latest.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, channel]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft("");
    // Optimistic: insert + return the row and append immediately (the realtime
    // echo is deduped by id), so the message shows instantly.
    const { data, error } = await supabase
      .from("messages")
      .insert({ sender_id: uid, content: text, department: channelDept })
      .select("id, content, created_at, sender_id, department")
      .single();
    setSending(false);
    if (error || !data) {
      setDraft(text);
      toast({
        title: "Message not sent",
        description: error?.message ?? "Please try again.",
        variant: "error",
      });
      return;
    }
    nameCache.current.set(uid, userName);
    avatarCache.current.set(uid, userAvatar ?? null);
    setMessages((prev) =>
      prev.some((m) => m.id === data.id)
        ? prev
        : [
            ...prev,
            {
              id: data.id,
              content: data.content,
              created_at: data.created_at,
              sender_id: data.sender_id,
              department: data.department ?? null,
              senderName: userName,
              senderAvatar: userAvatar ?? null,
            },
          ],
    );
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
      {/* Header + channel tabs */}
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-2.5">
        <MessagesSquare className="h-5 w-5 shrink-0 text-electric-violet" />
        <div className="flex gap-1">
          <button
            onClick={() => setChannel("global")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
              channel === "global"
                ? "bg-gradient-primary text-white shadow-soft"
                : "text-gray-500 hover:text-dark-base",
            )}
          >
            Global
          </button>
          {department && (
            <button
              onClick={() => setChannel("dept")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                channel === "dept"
                  ? "bg-gradient-primary text-white shadow-soft"
                  : "text-gray-500 hover:text-dark-base",
              )}
            >
              {department}
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-1 overflow-y-auto scrollbar-thin px-4 py-4">
        {loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-gray-400">
            <Spinner className="h-5 w-5 text-electric-violet" />
            Loading messages…
          </div>
        ) : shown.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-gray-400">
            <MessagesSquare className="h-8 w-8" />
            <p className="text-sm">
              {channel === "dept"
                ? `No messages in ${department} yet — say hello 👋`
                : "No messages yet — say hello 👋"}
            </p>
          </div>
        ) : (
          shown.map((m, i) => {
            const mine = m.sender_id === uid;
            const prev = shown[i - 1];
            const showDay =
              !prev || !isSameDay(new Date(prev.created_at), new Date(m.created_at));
            return (
              <div key={m.id}>
                {showDay && (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
                      {format(new Date(m.created_at), "EEEE, dd MMM")}
                    </span>
                  </div>
                )}
                <div
                  className={cn(
                    "flex items-end gap-2",
                    mine ? "justify-end" : "justify-start",
                  )}
                >
                  {!mine && (
                    <Avatar name={m.senderName} src={m.senderAvatar} size="sm" />
                  )}
                  <div className={cn("max-w-[75%]", mine && "items-end")}>
                    {!mine && (
                      <p className="mb-0.5 ml-1 text-xs font-medium text-gray-500">
                        {m.senderName}
                      </p>
                    )}
                    <div
                      className={cn(
                        "rounded-2xl px-3.5 py-2 text-sm",
                        mine
                          ? "rounded-br-sm bg-gradient-primary text-white"
                          : "rounded-bl-sm bg-gray-100 text-dark-base",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {m.content}
                      </p>
                    </div>
                    <p
                      className={cn(
                        "mt-0.5 text-[10px] text-gray-400",
                        mine ? "text-right mr-1" : "ml-1",
                      )}
                    >
                      {format(new Date(m.created_at), "hh:mm a")}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-gray-100 p-3">
        {canChat ? (
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Type a message…"
              className="max-h-32 flex-1 resize-none rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-electric-violet focus:outline-none focus:ring-2 focus:ring-electric-violet/30"
            />
            <button
              onClick={send}
              disabled={!draft.trim() || sending}
              aria-label="Send message"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-white transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-gray-50 py-3 text-sm text-gray-500">
            <Lock className="h-4 w-4" />
            Chat access is managed by your admin. You can read messages but
            can&apos;t post.
          </div>
        )}
      </div>
    </div>
  );
}

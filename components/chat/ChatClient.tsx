"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format, isSameDay } from "date-fns";
import {
  Send,
  Lock,
  MessagesSquare,
  Smile,
  Plus,
  X,
  FileText,
  ArrowLeft,
  Search,
  Download,
  Image as ImageIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { uploadChatFiles } from "@/lib/storage";
import type { StoredFile } from "@/lib/types";
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
  recipient_id: string | null;
  department: string | null;
  attachments: StoredFile[] | null;
  senderName: string;
  senderAvatar: string | null;
}

interface Contact {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
}

type SenderJoin =
  | { full_name: string | null; avatar_url: string | null }
  | { full_name: string | null; avatar_url: string | null }[]
  | null;

const pickSender = (s: SenderJoin) => (Array.isArray(s) ? (s[0] ?? null) : s);

const EMOJIS = [
  "😀","😁","😂","🤣","😊","😍","😎","😅","🤔","😴",
  "👍","👎","🙏","👏","🙌","👌","💪","🤝","👋","🔥",
  "🎉","🥳","✅","❌","💯","❤️","⭐","💡","🚀","📌",
  "📎","📷","📄","📅","⏰","☕","😢","😮","😇","🙈",
];

function Dot({ count }: { count: number }) {
  return (
    <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function ChatClient({ uid, userName, canChat, userAvatar, department }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [view, setView] = useState<"global" | "dept" | "direct">("global");
  const [peer, setPeer] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  // Per-peer "last read" timestamps (ms) → drives DM unread badges.
  const readKey = `chat-lastread-${uid}`;
  const [lastRead, setLastRead] = useState<Record<string, number>>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(readKey) : null;
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  function markRead(peerId: string) {
    setLastRead((prev) => {
      const next = { ...prev, [peerId]: Date.now() };
      try {
        localStorage.setItem(readKey, JSON.stringify(next));
        // Let the nav badge (useUnreadChat) recompute immediately.
        window.dispatchEvent(new Event("chat:read"));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const nameCache = useRef<Map<string, string>>(new Map());
  const avatarCache = useRef<Map<string, string | null>>(new Map());
  const bottomRef = useRef<HTMLDivElement>(null);

  // Initial load: everything RLS lets me see (global + my dept + my DMs).
  // NOTE: messages has two FKs to profiles (sender_id, recipient_id), so the
  // sender embed MUST hint the sender_id FK or the join is ambiguous and fails.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("messages")
        .select(
          "id, content, created_at, sender_id, recipient_id, department, attachments, sender:profiles!messages_sender_id_fkey(full_name, avatar_url)",
        )
        .order("created_at", { ascending: true })
        .limit(2000);
      if (error) console.error("chat load failed:", error.message);
      if (!active) return;
      const rows = ((data ?? []) as unknown as Array<
        Partial<Omit<ChatMessage, "senderName" | "senderAvatar">> & {
          id: string;
          content: string;
          created_at: string;
          sender_id: string;
          sender: SenderJoin;
        }
      >).map((r) => {
        const s = pickSender(r.sender);
        return {
          id: r.id,
          content: r.content,
          created_at: r.created_at,
          sender_id: r.sender_id,
          recipient_id: r.recipient_id ?? null,
          department: r.department ?? null,
          attachments: r.attachments ?? null,
          senderName: s?.full_name ?? "Unknown",
          senderAvatar: s?.avatar_url ?? null,
        };
      });
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

  // Contacts for the Direct picker (loaded once).
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, role")
        .neq("id", uid)
        .order("full_name");
      if (active) setContacts((data ?? []) as Contact[]);
    })();
    return () => {
      active = false;
    };
  }, [supabase, uid]);

  // Realtime: append new inserts I can see.
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
            recipient_id: string | null;
            department: string | null;
            attachments: StoredFile[] | null;
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
                    recipient_id: row.recipient_id ?? null,
                    department: row.department ?? null,
                    attachments: row.attachments ?? null,
                    senderName: name,
                    senderAvatar: avatar,
                  },
                ],
          );

          // Pop a notification for messages from others that aren't in the
          // conversation currently open on screen.
          if (row.sender_id !== uid) {
            const key = row.recipient_id
              ? row.recipient_id === uid
                ? row.sender_id
                : row.recipient_id
              : row.department
                ? "dept"
                : "global";
            const relevant = row.recipient_id ? row.recipient_id === uid : true;
            if (relevant && key === activeKeyRef.current) {
              // Already looking at this conversation → keep it read (clears the
              // nav badge too) instead of notifying.
              markRead(key);
            } else if (relevant) {
              const preview = row.content?.trim()
                ? row.content.trim().slice(0, 90)
                : row.attachments && row.attachments.length
                  ? "📎 Sent an attachment"
                  : "New message";
              const scope = row.recipient_id
                ? "Direct message"
                : row.department
                  ? row.department
                  : "Team chat";
              toast({ title: `💬 ${name} · ${scope}`, description: preview });
            }
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(chan);
    };
    // markRead is a stable closure (only uses setState/readKey) — omit to avoid
    // tearing down the realtime subscription on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, uid, userName, userAvatar, toast]);

  const shown = messages.filter((m) => {
    if (view === "global") return !m.recipient_id && !m.department;
    if (view === "dept") return !m.recipient_id && m.department === department;
    // direct
    if (!peer || !m.recipient_id) return false;
    return (
      (m.sender_id === uid && m.recipient_id === peer.id) ||
      (m.sender_id === peer.id && m.recipient_id === uid)
    );
  });

  // The conversation currently open — its key is always treated as "read".
  // Keys: "global", "dept", or a peer's id (for direct messages).
  const activeKey =
    view === "global" ? "global" : view === "dept" ? "dept" : peer ? peer.id : "__none__";
  const activeKeyRef = useRef(activeKey);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    activeKeyRef.current = activeKey;
  }, [activeKey]);

  // Unread counts per conversation key (messages from others, newer than last
  // read, excluding whichever conversation is currently open).
  const unreadByKey = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of messages) {
      if (m.sender_id === uid) continue;
      let key: string;
      if (m.recipient_id) {
        if (m.recipient_id !== uid) continue; // a DM not addressed to me
        key = m.sender_id;
      } else if (m.department) {
        if (m.department !== department) continue;
        key = "dept";
      } else {
        key = "global";
      }
      if (key === activeKey) continue;
      if (new Date(m.created_at).getTime() > (lastRead[key] ?? 0)) {
        map[key] = (map[key] ?? 0) + 1;
      }
    }
    return map;
  }, [messages, uid, department, lastRead, activeKey]);

  const globalUnread = unreadByKey["global"] ?? 0;
  const deptUnread = unreadByKey["dept"] ?? 0;
  const unreadByPeer: Record<string, number> = {};
  for (const [k, v] of Object.entries(unreadByKey)) {
    if (k !== "global" && k !== "dept") unreadByPeer[k] = v;
  }
  const totalUnread = Object.values(unreadByPeer).reduce((a, b) => a + b, 0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, view, peer]);

  // Switch channel, persisting a "read up to now" marker for the one we leave so
  // messages seen there don't resurface as unread.
  function switchView(next: "global" | "dept" | "direct") {
    markRead(activeKey);
    setView(next);
    setPeer(null);
  }
  function leavePeer() {
    if (peer) markRead(peer.id);
    setPeer(null);
  }

  async function send() {
    const text = draft.trim();
    if ((!text && files.length === 0) || sending) return;
    if (view === "direct" && !peer) return;
    setSending(true);
    setShowEmoji(false);
    try {
      const attachments = files.length
        ? await uploadChatFiles(supabase, uid, files)
        : null;
      const { data, error } = await supabase
        .from("messages")
        .insert({
          sender_id: uid,
          content: text,
          department: view === "dept" ? department : null,
          recipient_id: view === "direct" ? peer!.id : null,
          attachments,
        })
        .select(
          "id, content, created_at, sender_id, recipient_id, department, attachments",
        )
        .single();
      if (error || !data) throw error ?? new Error("failed");
      nameCache.current.set(uid, userName);
      avatarCache.current.set(uid, userAvatar ?? null);
      setMessages((prev) =>
        prev.some((m) => m.id === data.id)
          ? prev
          : [
              ...prev,
              {
                ...(data as ChatMessage),
                recipient_id: data.recipient_id ?? null,
                department: data.department ?? null,
                attachments: (data.attachments as StoredFile[]) ?? null,
                senderName: userName,
                senderAvatar: userAvatar ?? null,
              },
            ],
      );
      setDraft("");
      setFiles([]);
    } catch (err) {
      toast({
        title: "Message not sent",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const filteredContacts = contacts
    .filter((c) =>
      (c.full_name ?? "").toLowerCase().includes(contactSearch.toLowerCase()),
    )
    .sort((a, b) => {
      const ua = unreadByPeer[a.id] ?? 0;
      const ub = unreadByPeer[b.id] ?? 0;
      if (ua !== ub) return ub - ua; // unread conversations first
      return (a.full_name ?? "").localeCompare(b.full_name ?? "");
    });

  function openPeer(c: Contact) {
    setPeer(c);
    markRead(c.id);
  }

  const showContactPicker = view === "direct" && !peer;
  const tabBtn = (active: boolean) =>
    cn(
      "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
      active ? "bg-gradient-primary text-white shadow-soft" : "text-gray-500 hover:text-dark-base",
    );

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
      {/* Header + tabs */}
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5">
        {view === "direct" && peer ? (
          <>
            <button
              onClick={leavePeer}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
              aria-label="Back to contacts"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <Avatar name={peer.full_name} src={peer.avatar_url} size="sm" />
            <p className="text-sm font-bold text-dark-base">{peer.full_name}</p>
          </>
        ) : (
          <div className="flex gap-1">
            <button
              onClick={() => switchView("global")}
              className={cn(tabBtn(view === "global"), "relative inline-flex items-center gap-1.5")}
            >
              Global
              {globalUnread > 0 && <Dot count={globalUnread} />}
            </button>
            {department && (
              <button
                onClick={() => switchView("dept")}
                className={cn(tabBtn(view === "dept"), "relative inline-flex items-center gap-1.5")}
              >
                {department}
                {deptUnread > 0 && <Dot count={deptUnread} />}
              </button>
            )}
            <button
              onClick={() => switchView("direct")}
              className={cn(tabBtn(view === "direct"), "relative inline-flex items-center gap-1.5")}
            >
              Direct
              {totalUnread > 0 && <Dot count={totalUnread} />}
            </button>
          </div>
        )}
      </div>

      {/* Contact picker for Direct */}
      {showContactPicker ? (
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="sticky top-0 bg-white p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder="Search people…"
                className="h-10 w-full rounded-xl border border-gray-200 pl-9 pr-3 text-sm focus:border-electric-violet focus:outline-none focus:ring-2 focus:ring-electric-violet/30"
              />
            </div>
          </div>
          {filteredContacts.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-400">No people found.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {filteredContacts.map((c) => {
                const unread = unreadByPeer[c.id] ?? 0;
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => openPeer(c)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                    >
                      <Avatar name={c.full_name} src={c.avatar_url} size="sm" />
                      <span
                        className={cn(
                          "flex-1 text-sm text-dark-base",
                          unread > 0 ? "font-bold" : "font-medium",
                        )}
                      >
                        {c.full_name ?? "—"}
                      </span>
                      {unread > 0 && (
                        <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                          {unread}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 space-y-1 overflow-y-auto scrollbar-thin px-4 py-4">
            {loading ? (
              <div className="flex h-full items-center justify-center gap-2 text-gray-400">
                <Spinner className="h-5 w-5 text-electric-violet" /> Loading…
              </div>
            ) : shown.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-gray-400">
                <MessagesSquare className="h-8 w-8" />
                <p className="text-sm">
                  {view === "direct" && peer
                    ? `Say hi to ${peer.full_name} 👋`
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
                    <div className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
                      {!mine && <Avatar name={m.senderName} src={m.senderAvatar} size="sm" />}
                      <div className="max-w-[75%]">
                        {!mine && view !== "direct" && (
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
                          {m.content && (
                            <p className="whitespace-pre-wrap break-words">{m.content}</p>
                          )}
                          {m.attachments && m.attachments.length > 0 && (
                            <div className={cn("flex flex-col gap-1.5", m.content ? "mt-2" : "")}>
                              {m.attachments.map((f, k) => (
                                <a
                                  key={k}
                                  href={f.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={`Open ${f.filename}`}
                                  className={cn(
                                    "inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                                    mine
                                      ? "bg-white/20 text-white hover:bg-white/30"
                                      : "bg-white text-dark-base ring-1 ring-gray-200 hover:bg-gray-50",
                                  )}
                                >
                                  {f.type?.startsWith("image/") ? (
                                    <ImageIcon className="h-4 w-4 shrink-0" />
                                  ) : (
                                    <FileText className="h-4 w-4 shrink-0" />
                                  )}
                                  <span className="max-w-[180px] truncate">{f.filename}</span>
                                  <Download
                                    className={cn(
                                      "h-3.5 w-3.5 shrink-0",
                                      mine ? "text-white/80" : "text-cool-blue",
                                    )}
                                  />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                        <p className={cn("mt-0.5 text-[10px] text-gray-400", mine ? "mr-1 text-right" : "ml-1")}>
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
              <>
                {/* pending attachments */}
                {files.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {files.map((f, i) => (
                      <span
                        key={`${f.name}-${i}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs"
                      >
                        <FileText className="h-3.5 w-3.5 text-gray-400" />
                        <span className="max-w-[120px] truncate">{f.name}</span>
                        <button
                          onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                          className="text-gray-400 hover:text-red-500"
                          aria-label="Remove"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {showEmoji && (
                  <div className="mb-2 grid grid-cols-10 gap-1 rounded-xl border border-gray-100 bg-white p-2 shadow-soft">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        onClick={() => setDraft((d) => d + e)}
                        className="rounded-md p-1 text-lg hover:bg-gray-100"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-1.5">
                  {/* attach */}
                  <label className="flex h-11 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100" aria-label="Attach">
                    <Plus className="h-5 w-5" />
                    <input
                      type="file"
                      multiple
                      accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.zip,.txt"
                      className="hidden"
                      onChange={(e) =>
                        setFiles((p) => [...p, ...Array.from(e.target.files ?? [])])
                      }
                    />
                  </label>
                  {/* emoji */}
                  <button
                    onClick={() => setShowEmoji((s) => !s)}
                    className="flex h-11 w-10 shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100"
                    aria-label="Emoji"
                  >
                    <Smile className="h-5 w-5" />
                  </button>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onKeyDown}
                    rows={1}
                    placeholder={
                      view === "direct" && peer
                        ? `Message ${peer.full_name}…`
                        : "Type a message…"
                    }
                    className="max-h-32 flex-1 resize-none rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-electric-violet focus:outline-none focus:ring-2 focus:ring-electric-violet/30"
                  />
                  <button
                    onClick={send}
                    disabled={(!draft.trim() && files.length === 0) || sending}
                    aria-label="Send"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-white transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {sending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-gray-50 py-3 text-sm text-gray-500">
                <Lock className="h-4 w-4" />
                Chat access is managed by your admin — you can read but can&apos;t post.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

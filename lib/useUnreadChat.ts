"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";

interface MsgMeta {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  department: string | null;
  created_at: string;
}

/**
 * Total unread chat messages for the signed-in user, across Global, their
 * Department, and any Direct conversations. Drives the badge on the Chat nav
 * item so waiting messages are visible from anywhere (e.g. the dashboard).
 *
 * "Read" state is shared with <ChatClient> via the same localStorage key
 * (`chat-lastread-<uid>`); ChatClient dispatches a `chat:read` window event when
 * a conversation is opened/read so this recomputes live.
 */
export function useUnreadChat(): number {
  const { id: uid, department } = useCurrentUser();
  const supabase = useMemo(() => createClient(), []);
  const readKey = `chat-lastread-${uid}`;

  const [msgs, setMsgs] = useState<MsgMeta[]>([]);
  const [reads, setReads] = useState<Record<string, number>>({});

  // Keep the read markers in sync with ChatClient (same tab + across tabs).
  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem(readKey);
        setReads(raw ? JSON.parse(raw) : {});
      } catch {
        setReads({});
      }
    };
    load();
    window.addEventListener("chat:read", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("chat:read", load);
      window.removeEventListener("storage", load);
    };
  }, [readKey]);

  // Initial fetch of message metadata the user is allowed to see (RLS-filtered).
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, sender_id, recipient_id, department, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (active && data) setMsgs(data as MsgMeta[]);
    })();
    return () => {
      active = false;
    };
  }, [supabase]);

  // Live updates.
  useEffect(() => {
    const chan = supabase
      .channel("unread:messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const r = payload.new as MsgMeta;
          setMsgs((prev) => (prev.some((m) => m.id === r.id) ? prev : [r, ...prev]));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(chan);
    };
  }, [supabase]);

  return useMemo(() => {
    let count = 0;
    for (const m of msgs) {
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
      if (new Date(m.created_at).getTime() > (reads[key] ?? 0)) count++;
    }
    return count;
  }, [msgs, uid, department, reads]);
}

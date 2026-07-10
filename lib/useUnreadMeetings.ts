"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";

/**
 * Count of upcoming meetings created since the user last opened the Meetings
 * page — drives the red badge on the Meetings nav item. "Seen" state is stored
 * in localStorage (`meetings-lastseen-<uid>`); the Meetings page dispatches a
 * `meetings:seen` event so this clears live. Refreshes when a new notification
 * arrives (meeting invites create notifications, which are realtime).
 */
export function useUnreadMeetings(): number {
  const { id: uid } = useCurrentUser();
  const supabase = useMemo(() => createClient(), []);
  const [count, setCount] = useState(0);

  const seenKey = `meetings-lastseen-${uid}`;

  const recompute = useCallback(async () => {
    let lastSeen = 0;
    try {
      lastSeen = Number(localStorage.getItem(seenKey) ?? 0);
    } catch {
      lastSeen = 0;
    }
    const nowIso = new Date().toISOString();
    const { data } = await supabase
      .from("meetings")
      .select("id, created_at, scheduled_at")
      .gte("scheduled_at", nowIso)
      .limit(200);
    const n = (data ?? []).filter(
      (m) => new Date(m.created_at as string).getTime() > lastSeen,
    ).length;
    setCount(n);
  }, [supabase, seenKey]);

  useEffect(() => {
    // recompute is async — setState happens after await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recompute();
    const onSeen = () => setCount(0);
    window.addEventListener("meetings:seen", onSeen);
    window.addEventListener("storage", recompute);

    // A meeting invite inserts a notification (realtime) — refetch on any.
    const chan = supabase
      .channel("unread:meetings")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => recompute(),
      )
      .subscribe();

    return () => {
      window.removeEventListener("meetings:seen", onSeen);
      window.removeEventListener("storage", recompute);
      supabase.removeChannel(chan);
    };
  }, [recompute, supabase]);

  return count;
}

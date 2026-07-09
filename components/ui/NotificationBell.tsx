"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabaseClient";
import type { AppNotification } from "@/lib/types";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.read).length;

  // Resolve current user, then load notifications.
  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active || !user) return;
      setUid(user.id);
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (active) setItems((data ?? []) as AppNotification[]);
    })();
    return () => {
      active = false;
    };
  }, [supabase]);

  // Realtime: new notifications for this user.
  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `profile_id=eq.${uid}`,
        },
        (payload) => {
          setItems((prev) => [payload.new as AppNotification, ...prev]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, uid]);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function markAllRead() {
    const unreadIds = items.filter((n) => !n.read).map((n) => n.id);
    if (!unreadIds.length) return;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
  }

  async function openItem(n: AppNotification) {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      await supabase.from("notifications").update({ read: true }).eq("id", n.id);
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative rounded-lg p-2 text-dark-base transition-colors hover:bg-gray-100"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-electric-violet px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 animate-scale-in overflow-hidden rounded-xl border border-gray-100 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
            <p className="text-sm font-bold text-dark-base">Notifications</p>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-medium text-electric-violet hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto scrollbar-thin">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">
                No notifications yet.
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={cn(
                    "flex w-full gap-3 border-b border-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-50",
                    !n.read && "bg-electric-violet/5",
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      n.read ? "bg-transparent" : "bg-electric-violet",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-dark-base">
                      {n.title}
                    </span>
                    {n.body && (
                      <span className="block truncate text-sm text-gray-500">
                        {n.body}
                      </span>
                    )}
                    <span className="mt-0.5 block text-xs text-gray-400">
                      {formatDistanceToNow(new Date(n.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

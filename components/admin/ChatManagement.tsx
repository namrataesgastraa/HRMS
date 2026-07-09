"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabaseClient";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRow } from "@/components/ui/LoadingSkeleton";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

interface Row {
  id: string;
  full_name: string | null;
  employee_id: string | null;
  role: string;
  can_chat: boolean;
  avatar_url: string | null;
}

function Toggle({
  on,
  disabled,
  onChange,
}: {
  on: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
        on ? "bg-success" : "bg-gray-300",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          on ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function ChatManagement() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pending, setPending] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "chat-mgmt"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, employee_id, role, can_chat, avatar_url")
        .order("employee_id", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  async function toggle(row: Row) {
    setPending(row.id);
    const { error } = await supabase
      .from("profiles")
      .update({ can_chat: !row.can_chat })
      .eq("id", row.id);
    setPending(null);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "error" });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["admin", "chat-mgmt"] });
    toast({
      title: `Chat ${row.can_chat ? "disabled" : "enabled"} for ${row.full_name ?? "user"}`,
      variant: "success",
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
      {isLoading ? (
        <div>
          <SkeletonRow cols={3} />
          <SkeletonRow cols={3} />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="p-5">
          <EmptyState title="No users" message="No accounts yet." />
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {data.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-5 py-3.5">
              <Avatar name={r.full_name} src={r.avatar_url} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium text-dark-base">
                  {r.full_name ?? "—"}
                  {r.role === "admin" && <Badge variant="info">admin</Badge>}
                </p>
                <p className="text-xs text-gray-400">{r.employee_id}</p>
              </div>
              <span className="text-xs font-medium text-gray-400">
                {r.can_chat ? "Can chat" : "Muted"}
              </span>
              <Toggle
                on={r.can_chat}
                disabled={pending === r.id}
                onChange={() => toggle(r)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

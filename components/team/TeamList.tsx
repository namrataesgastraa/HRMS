"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRow } from "@/components/ui/LoadingSkeleton";

interface Member {
  id: string;
  full_name: string | null;
  employee_id: string | null;
  avatar_url: string | null;
  role: string;
}

export function TeamList({
  department,
  selfId,
}: {
  department: string | null;
  selfId: string;
}) {
  const supabase = useMemo(() => createClient(), []);

  const { data, isLoading } = useQuery({
    queryKey: ["team", department],
    enabled: !!department,
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, employee_id, avatar_url, role")
        .eq("department", department!)
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Member[];
    },
  });

  if (!department)
    return (
      <EmptyState
        title="No department set"
        message="Set your department in your profile to manage a team."
      />
    );

  const members = (data ?? []).filter((m) => m.id !== selfId);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
      {isLoading ? (
        <div>
          <SkeletonRow cols={3} />
          <SkeletonRow cols={3} />
        </div>
      ) : members.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title="No team members yet"
            message={`No one else is in ${department}.`}
          />
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {members.map((m) => (
            <li key={m.id}>
              <Link
                href={`/team/${m.id}`}
                className="group flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/60"
              >
                <Avatar name={m.full_name} src={m.avatar_url} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-dark-base">
                    {m.full_name ?? "—"}
                    {m.role === "manager" && <Badge variant="info">manager</Badge>}
                  </p>
                  <p className="text-xs text-gray-400">{m.employee_id}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-electric-violet" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

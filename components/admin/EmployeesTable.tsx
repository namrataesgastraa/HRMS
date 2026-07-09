"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRow } from "@/components/ui/LoadingSkeleton";

interface EmployeeRow {
  id: string;
  full_name: string | null;
  employee_id: string | null;
  role: string;
  profile_completed: boolean;
  avatar_url: string | null;
  details:
    | { designation: string | null; department: string | null }
    | { designation: string | null; department: string | null }[]
    | null;
}

function detailOf(r: EmployeeRow) {
  return Array.isArray(r.details) ? r.details[0] : r.details;
}

export function EmployeesTable() {
  const supabase = useMemo(() => createClient(), []);
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "employees"],
    queryFn: async (): Promise<EmployeeRow[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, employee_id, role, profile_completed, avatar_url, details:employee_details(designation, department)",
        )
        .order("employee_id", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EmployeeRow[];
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data.filter((r) => {
      const d = detailOf(r);
      return [r.full_name, r.employee_id, d?.department, d?.designation]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(term));
    });
  }, [data, q]);

  return (
    <div className="space-y-4">
      <div className="max-w-sm">
        <Input
          placeholder="Search name, ID, department…"
          leftIcon={<Search className="h-4 w-4" />}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
        {isLoading ? (
          <div>
            <SkeletonRow cols={4} />
            <SkeletonRow cols={4} />
            <SkeletonRow cols={4} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No employees found"
              message={q ? "Try a different search." : "No employees on roll yet."}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="px-5 py-3 font-semibold">Employee</th>
                  <th className="px-5 py-3 font-semibold">ID</th>
                  <th className="px-5 py-3 font-semibold">Department</th>
                  <th className="px-5 py-3 font-semibold">Designation</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((r) => {
                  const d = detailOf(r);
                  return (
                    <tr key={r.id} className="group hover:bg-gray-50/60">
                      <td className="px-5 py-3">
                        <Link
                          href={`/admin/employees/${r.id}`}
                          className="flex items-center gap-3"
                        >
                          <Avatar name={r.full_name} src={r.avatar_url} size="sm" />
                          <span className="font-medium text-dark-base">
                            {r.full_name ?? "—"}
                            {r.role === "admin" && (
                              <Badge variant="info" className="ml-2">
                                admin
                              </Badge>
                            )}
                          </span>
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {r.employee_id ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {d?.department ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {d?.designation ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <Badge
                          variant={r.profile_completed ? "submitted" : "pending"}
                        >
                          {r.profile_completed ? "Onboarded" : "Pending"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/admin/employees/${r.id}`}
                          className="inline-flex text-gray-300 transition-colors group-hover:text-electric-violet"
                          aria-label="View employee"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

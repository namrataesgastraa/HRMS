"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { AdminEmployeeDetail } from "@/components/admin/AdminEmployeeDetail";

export default function TeamMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { id: managerId, role } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (role !== "manager" && role !== "admin") router.replace("/dashboard");
  }, [role, router]);

  if (role !== "manager" && role !== "admin") return null;

  return (
    <div className="mx-auto max-w-4xl">
      <AdminEmployeeDetail employeeId={id} adminUid={managerId} scope="manager" />
    </div>
  );
}

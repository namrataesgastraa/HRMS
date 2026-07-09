"use client";

import { use } from "react";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { AdminEmployeeDetail } from "@/components/admin/AdminEmployeeDetail";

export default function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { id: adminUid } = useCurrentUser();

  return (
    <div className="mx-auto max-w-4xl">
      <AdminEmployeeDetail employeeId={id} adminUid={adminUid} />
    </div>
  );
}

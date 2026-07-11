"use client";

import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { LeaveClient } from "@/components/leave/LeaveClient";

export default function AdminLeavePage() {
  const { id, department } = useCurrentUser();
  return (
    <div className="mx-auto max-w-3xl">
      <LeaveClient scope="admin" uid={id} department={department} />
    </div>
  );
}

"use client";

import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { LeaveClient } from "@/components/leave/LeaveClient";

export default function LeavePage() {
  const { id, role, department } = useCurrentUser();
  return (
    <div className="mx-auto max-w-3xl">
      <LeaveClient
        scope={role === "manager" ? "manager" : "employee"}
        uid={id}
        department={department}
      />
    </div>
  );
}

"use client";

import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { AttendanceClient } from "@/components/attendance/AttendanceClient";
import { AttendanceHistory } from "@/components/attendance/AttendanceHistory";

export default function AttendancePage() {
  const { id } = useCurrentUser();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <AttendanceClient uid={id} />
      <AttendanceHistory uid={id} />
    </div>
  );
}

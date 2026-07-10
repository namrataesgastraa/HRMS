"use client";

import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { AttendanceClient } from "@/components/attendance/AttendanceClient";
import { AttendanceHistory } from "@/components/attendance/AttendanceHistory";
import { AttendanceAnalytics } from "@/components/attendance/AttendanceAnalytics";

export default function AttendancePage() {
  const { id } = useCurrentUser();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <AttendanceClient uid={id} />
      <AttendanceAnalytics uid={id} title="My attendance analytics" />
      <AttendanceHistory uid={id} />
    </div>
  );
}

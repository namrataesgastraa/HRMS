"use client";

import { AttendanceTable } from "@/components/admin/AttendanceTable";
import { AttendanceAnalytics } from "@/components/attendance/AttendanceAnalytics";

export default function AdminAttendancePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark-base">Attendance overview</h1>
        <p className="text-sm text-gray-500">
          All check-ins · anomalies flagged (late, far, mock GPS).
        </p>
      </div>
      <AttendanceAnalytics title="Team attendance analytics" />
      <AttendanceTable />
    </div>
  );
}

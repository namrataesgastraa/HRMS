"use client";

import { EmployeesTable } from "@/components/admin/EmployeesTable";

export default function AdminEmployeesPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark-base">Employees</h1>
        <p className="text-sm text-gray-500">
          Everyone on roll — search and open a profile.
        </p>
      </div>
      <EmployeesTable />
    </div>
  );
}

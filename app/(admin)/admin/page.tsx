"use client";

import { AdminOverview } from "@/components/admin/AdminOverview";

export default function AdminOverviewPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark-base">Admin overview</h1>
        <p className="text-sm text-gray-500">Today at ESG Astraa</p>
      </div>
      <AdminOverview />
    </div>
  );
}

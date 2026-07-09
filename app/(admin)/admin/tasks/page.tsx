"use client";

import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { TaskReview } from "@/components/admin/TaskReview";

export default function AdminTasksPage() {
  const { id } = useCurrentUser();
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark-base">Task review</h1>
        <p className="text-sm text-gray-500">
          Daily submissions and 90-day plans across the team.
        </p>
      </div>
      <TaskReview adminUid={id} />
    </div>
  );
}

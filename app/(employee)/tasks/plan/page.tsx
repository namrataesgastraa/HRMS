"use client";

import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { TasksTabs } from "@/components/tasks/TasksTabs";
import { TaskPlanForm } from "@/components/tasks/TaskPlanForm";

export default function TasksPlanPage() {
  const { id } = useCurrentUser();
  return (
    <div className="mx-auto max-w-2xl">
      <TasksTabs />
      <TaskPlanForm uid={id} />
    </div>
  );
}

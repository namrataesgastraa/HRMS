"use client";

import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { TasksTabs } from "@/components/tasks/TasksTabs";
import { DailyTaskForm } from "@/components/tasks/DailyTaskForm";

export default function TasksTodayPage() {
  const { id } = useCurrentUser();
  return (
    <div className="mx-auto max-w-2xl">
      <TasksTabs />
      <DailyTaskForm uid={id} />
    </div>
  );
}

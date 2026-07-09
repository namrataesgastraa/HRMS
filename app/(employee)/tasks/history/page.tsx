"use client";

import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { TasksTabs } from "@/components/tasks/TasksTabs";
import { TaskHistory } from "@/components/tasks/TaskHistory";

export default function TasksHistoryPage() {
  const { id } = useCurrentUser();
  return (
    <div className="mx-auto max-w-2xl">
      <TasksTabs />
      <TaskHistory uid={id} />
    </div>
  );
}

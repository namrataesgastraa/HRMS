"use client";

import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { TasksTabs } from "@/components/tasks/TasksTabs";
import { AssignedTasksList } from "@/components/tasks/AssignedTasksList";

export default function TasksAssignedPage() {
  const { id } = useCurrentUser();
  return (
    <div className="mx-auto max-w-2xl">
      <TasksTabs />
      <AssignedTasksList uid={id} />
    </div>
  );
}

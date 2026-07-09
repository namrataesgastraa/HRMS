import { redirect } from "next/navigation";

// /tasks → default to the daily log.
export default function TasksIndex() {
  redirect("/tasks/today");
}

/**
 * Fire-and-forget email notification. Never blocks or throws into the UI —
 * the user's action succeeds regardless of whether the email sends.
 */
export function notifyEvent(input: {
  kind: "attendance" | "task" | "plan" | "assigned" | "comment";
  message: string;
  subjectProfileId?: string;
}): void {
  try {
    void fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

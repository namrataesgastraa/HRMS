"use client";

import { useEffect } from "react";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { MeetingsClient } from "@/components/meetings/MeetingsClient";

export default function AdminMeetingsPage() {
  const { id, department } = useCurrentUser();

  useEffect(() => {
    try {
      localStorage.setItem(`meetings-lastseen-${id}`, String(Date.now()));
      window.dispatchEvent(new Event("meetings:seen"));
    } catch {
      /* ignore */
    }
  }, [id]);

  return (
    <div className="mx-auto max-w-3xl">
      <MeetingsClient scope="admin" uid={id} department={department} />
    </div>
  );
}

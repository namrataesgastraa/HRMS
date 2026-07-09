"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { TeamList } from "@/components/team/TeamList";

export default function TeamPage() {
  const { id, role, department } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (role !== "manager" && role !== "admin") router.replace("/dashboard");
  }, [role, router]);

  if (role !== "manager" && role !== "admin") return null;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark-base">My Team</h1>
        <p className="text-sm text-gray-500">
          {department ? `${department} department` : "No department set"} —
          attendance, tasks & plans for everyone who reports to you.
        </p>
      </div>
      <TeamList department={department} selfId={id} />
    </div>
  );
}

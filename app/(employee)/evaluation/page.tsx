"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { EvaluationClient } from "@/components/evaluation/EvaluationClient";

export default function EvaluationPage() {
  const { id, role, department } = useCurrentUser();
  const router = useRouter();

  // Evaluation is manager/admin only — bounce plain employees.
  useEffect(() => {
    if (role === "employee") router.replace("/dashboard");
  }, [role, router]);

  if (role === "employee") return null;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark-base">Evaluation</h1>
        <p className="text-sm text-gray-500">
          Review your team&apos;s daily work and rate their performance. Ratings are
          private — the person rated can&apos;t see them.
        </p>
      </div>
      <EvaluationClient scope="manager" evaluatorId={id} department={department} />
    </div>
  );
}

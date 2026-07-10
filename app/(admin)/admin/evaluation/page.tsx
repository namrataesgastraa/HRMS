"use client";

import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { EvaluationClient } from "@/components/evaluation/EvaluationClient";

export default function AdminEvaluationPage() {
  const { id } = useCurrentUser();
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark-base">Evaluation</h1>
        <p className="text-sm text-gray-500">
          Review managers&apos; daily work and rate their performance. Ratings are
          private — the person rated can&apos;t see them.
        </p>
      </div>
      <EvaluationClient scope="admin" evaluatorId={id} department={null} />
    </div>
  );
}

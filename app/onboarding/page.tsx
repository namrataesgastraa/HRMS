import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { OnboardingForm } from "@/components/onboarding/OnboardingForm";

// Real multi-step onboarding (Phase 3). The proxy already forces incomplete
// employees here and bounces completed ones away.
export default async function OnboardingPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:py-12">
      <OnboardingForm
        uid={current.id}
        employeeId={current.profile?.employee_id ?? "—"}
        initialFullName={current.profile?.full_name ?? ""}
        initialEmail={current.email ?? ""}
      />
    </main>
  );
}

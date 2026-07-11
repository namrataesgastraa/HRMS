"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { ProfileEditForm } from "@/components/profile/ProfileEditForm";
import { ChangePassword } from "@/components/profile/ChangePassword";
import { SkeletonCard } from "@/components/ui/LoadingSkeleton";
import type { StoredFile, EducationEntry } from "@/lib/types";

export default function ProfilePage() {
  const { id, fullName, avatarUrl } = useCurrentUser();
  const supabase = useMemo(() => createClient(), []);

  const { data: details, isLoading } = useQuery({
    queryKey: ["employee_details", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_details")
        .select("*")
        .eq("profile_id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark-base">My profile</h1>
        <p className="text-sm text-gray-500">
          Update your details anytime — changes are logged for HR.
        </p>
      </div>

      {isLoading ? (
        <SkeletonCard />
      ) : (
        <>
          <ProfileEditForm
            uid={id}
            initial={{
              full_name: fullName ?? "",
              avatar_url: avatarUrl,
              dob: details?.dob ?? "",
              phone: details?.phone ?? "",
              personal_email: details?.personal_email ?? "",
              address: details?.address ?? "",
              emergency_contact: details?.emergency_contact ?? "",
              designation: details?.designation ?? "",
              department: details?.department ?? "",
              joining_date: details?.joining_date ?? "",
              reporting_manager: details?.reporting_manager ?? "",
              education: (details?.education ?? []) as EducationEntry[],
              documents: (details?.documents ?? []) as StoredFile[],
            }}
          />
          <ChangePassword />
        </>
      )}
    </div>
  );
}

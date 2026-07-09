import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AppShellClient } from "@/components/AppShellClient";
import { CurrentUserProvider } from "@/components/providers/CurrentUserProvider";

// Shared shell + user context for all employee pages. Fetched once here; pages
// read the user from context (client-side), so navigation is instant.
export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  const role = current.profile?.role ?? "employee";

  return (
    <CurrentUserProvider
      value={{
        id: current.id,
        fullName: current.profile?.full_name ?? null,
        avatarUrl: current.profile?.avatar_url ?? null,
        email: current.email,
        role,
        canChat: current.profile?.can_chat ?? false,
        department: current.profile?.department ?? null,
      }}
    >
      <AppShellClient
        role={role}
        user={{
          name: current.profile?.full_name,
          email: current.email,
          avatarUrl: current.profile?.avatar_url,
        }}
      >
        {children}
      </AppShellClient>
    </CurrentUserProvider>
  );
}

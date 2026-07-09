import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AppShellClient } from "@/components/AppShellClient";
import { CurrentUserProvider } from "@/components/providers/CurrentUserProvider";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  if (current.profile?.role !== "admin") redirect("/dashboard");

  return (
    <CurrentUserProvider
      value={{
        id: current.id,
        fullName: current.profile?.full_name ?? null,
        avatarUrl: current.profile?.avatar_url ?? null,
        email: current.email,
        role: "admin",
        canChat: current.profile?.can_chat ?? true,
        department: current.profile?.department ?? null,
      }}
    >
      <AppShellClient
        role="admin"
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

import { redirect } from "next/navigation";
import { getCurrentUser, homePathForRole } from "@/lib/auth";

// No landing page — go straight to the app.
export default async function Home() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  redirect(homePathForRole(current.profile?.role));
}

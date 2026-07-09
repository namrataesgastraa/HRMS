import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { sendMail, emailTemplate } from "@/lib/email";

export const runtime = "nodejs";

const APP_URL = "https://esg-astraa-hrms.vercel.app";

interface Profile {
  id: string;
  full_name: string | null;
  role: string;
  department: string | null;
  email: string | null;
}

/**
 * Fire-and-forget notification endpoint. Called by the app after an action.
 * Routing: an employee's activity → their department manager; a manager's
 * activity → admin. Assigned tasks / comments → the affected employee + their
 * manager/admin.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let payload: {
    kind?: string;
    message?: string;
    subjectProfileId?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const kind = payload.kind ?? "activity";
  const message = payload.message ?? "";

  const { data: actor } = await supabase
    .from("profiles")
    .select("id, full_name, role, department, email")
    .eq("id", user.id)
    .single<Profile>();
  if (!actor) return NextResponse.json({ ok: true });

  // The person the event is about (defaults to the actor).
  let subject = actor;
  if (payload.subjectProfileId && payload.subjectProfileId !== actor.id) {
    const { data: s } = await supabase
      .from("profiles")
      .select("id, full_name, role, department, email")
      .eq("id", payload.subjectProfileId)
      .single<Profile>();
    if (s) subject = s;
  }

  // Supervisor of a profile: manager of their dept if employee, else admin.
  async function supervisorEmail(p: Profile): Promise<string | null> {
    if (p.role === "employee" && p.department) {
      const { data: mgr } = await supabase
        .from("profiles")
        .select("email")
        .eq("role", "manager")
        .eq("department", p.department)
        .not("id", "eq", p.id)
        .limit(1)
        .maybeSingle<{ email: string | null }>();
      if (mgr?.email) return mgr.email;
    }
    return process.env.EMAIL_ADMIN ?? null;
  }

  const recipients: string[] = [];
  const directed = kind === "assigned" || kind === "comment";
  if (directed) {
    if (subject.email) recipients.push(subject.email); // the affected employee
    const sup = await supervisorEmail(subject);
    if (sup) recipients.push(sup);
  } else {
    const sup = await supervisorEmail(actor); // actor's own activity → supervisor
    if (sup) recipients.push(sup);
  }

  if (recipients.length === 0) return NextResponse.json({ ok: true, skipped: true });

  const actorName = actor.full_name ?? "Someone";
  const subjectName = subject.full_name ?? "an employee";

  const headingMap: Record<string, string> = {
    attendance: `Attendance update — ${actorName}`,
    task: `Daily task logged — ${actorName}`,
    plan: `Plan uploaded — ${actorName}`,
    assigned: `New task assigned to ${subjectName}`,
    comment: `New comment for ${subjectName}`,
    activity: `Update from ${actorName}`,
  };

  await sendMail(
    recipients,
    headingMap[kind] ?? headingMap.activity,
    emailTemplate({
      heading: headingMap[kind] ?? headingMap.activity,
      actor: actorName,
      body: message || "An update was recorded in the HRMS.",
      link: APP_URL,
    }),
  );

  return NextResponse.json({ ok: true });
}

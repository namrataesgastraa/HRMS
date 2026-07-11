import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { sendMail, emailTemplate } from "@/lib/email";

export const runtime = "nodejs";

const APP_URL = "https://esg-astraa-hrms.vercel.app";

/**
 * Emails leave-request recipients (admins and/or the department manager) when a
 * request is created, and the requester when it's decided. Runs with the
 * caller's session; RLS ensures they can only read leaves they're party to.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let leaveId: string | undefined;
  let kind: "request" | "decision" = "request";
  try {
    ({ leaveId, kind } = await req.json());
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!leaveId) return NextResponse.json({ ok: false }, { status: 400 });

  const { data: leave } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("id", leaveId)
    .single();
  if (!leave) return NextResponse.json({ ok: true, skipped: true });

  const { data: requester } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", leave.profile_id)
    .maybeSingle<{ full_name: string | null; email: string | null }>();
  const who = requester?.full_name ?? "An employee";

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  const period = `${fmt(leave.start_date)} → ${fmt(leave.end_date)}`;

  if (kind === "decision") {
    if (!requester?.email) return NextResponse.json({ ok: true, skipped: true });
    await sendMail(
      [requester.email],
      `Leave ${leave.status}: ${leave.leave_type}`,
      emailTemplate({
        heading: `Your leave was ${leave.status}`,
        actor: "ESG Astraa HRMS",
        body: `Your <b>${leave.leave_type}</b> leave (${period}) was <b>${leave.status}</b>.${
          leave.review_note ? `<br/>Note: ${leave.review_note}` : ""
        }`,
        link: `${APP_URL}/leave`,
      }),
    );
    return NextResponse.json({ ok: true });
  }

  // kind === "request" → email admins and/or the department manager.
  const recipients: string[] = [];
  if (leave.to_admin) {
    const { data: admins } = await supabase
      .from("profiles")
      .select("email")
      .eq("role", "admin");
    (admins ?? []).forEach((a) => a.email && recipients.push(a.email as string));
  }
  if (leave.to_manager && leave.department) {
    const { data: mgrs } = await supabase
      .from("profiles")
      .select("email")
      .eq("role", "manager")
      .eq("department", leave.department)
      .neq("id", leave.profile_id);
    (mgrs ?? []).forEach((m) => m.email && recipients.push(m.email as string));
  }
  if (recipients.length === 0) return NextResponse.json({ ok: true, skipped: true });

  await sendMail(
    recipients,
    `Leave request: ${who} — ${leave.leave_type}`,
    emailTemplate({
      heading: `Leave request from ${who}`,
      actor: who,
      body: `<b>${leave.leave_type}</b> leave requested for <b>${period}</b>.${
        leave.reason ? `<br/>Reason: ${leave.reason}` : ""
      }`,
      link: `${APP_URL}${leave.to_admin ? "/admin/leave" : "/leave"}`,
    }),
  );

  return NextResponse.json({ ok: true, sent: recipients.length });
}

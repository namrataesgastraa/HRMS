import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { sendMail, emailTemplate } from "@/lib/email";

export const runtime = "nodejs";

const APP_URL = "https://esg-astraa-hrms.vercel.app";

/**
 * Emails every invitee of a meeting with the details (link + optional
 * credentials). Runs with the caller's session — RLS ensures only the host or
 * an admin can read the meeting + attendees, so a random user can't spam.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let meetingId: string | undefined;
  try {
    ({ meetingId } = await req.json());
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!meetingId) return NextResponse.json({ ok: false }, { status: 400 });

  const { data: meeting } = await supabase
    .from("meetings")
    .select(
      "id, title, description, meeting_link, access_username, access_password, scheduled_at, host_id",
    )
    .eq("id", meetingId)
    .single();
  if (!meeting) return NextResponse.json({ ok: true, skipped: true });

  const { data: attendees } = await supabase
    .from("meeting_attendees")
    .select("profile:profiles(full_name, email)")
    .eq("meeting_id", meetingId);

  const emails = (attendees ?? [])
    .map((a) => {
      const p = a.profile as
        | { full_name: string | null; email: string | null }
        | { full_name: string | null; email: string | null }[]
        | null;
      const one = Array.isArray(p) ? p[0] : p;
      return one?.email ?? null;
    })
    .filter((e): e is string => !!e);

  const { data: host } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", meeting.host_id)
    .maybeSingle<{ full_name: string | null }>();

  if (emails.length === 0) return NextResponse.json({ ok: true, skipped: true });

  const when = new Date(meeting.scheduled_at).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const bodyParts = [
    `<b>When:</b> ${when} (IST)`,
    meeting.meeting_link
      ? `<b>Link:</b> <a href="${meeting.meeting_link}">${meeting.meeting_link}</a>`
      : "",
    meeting.access_username ? `<b>Username:</b> ${meeting.access_username}` : "",
    meeting.access_password ? `<b>Password:</b> ${meeting.access_password}` : "",
    meeting.description ? `<br/>${meeting.description}` : "",
  ].filter(Boolean);

  await sendMail(
    emails,
    `Meeting invite: ${meeting.title}`,
    emailTemplate({
      heading: `📅 ${meeting.title}`,
      actor: host?.full_name ?? "ESG Astraa",
      body: bodyParts.join("<br/>"),
      link: meeting.meeting_link || APP_URL,
    }),
  );

  return NextResponse.json({ ok: true, sent: emails.length });
}

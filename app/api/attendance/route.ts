import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

/**
 * Secure attendance endpoint. The client CANNOT write to `attendance` directly
 * any more (RLS revoked) — every check-in/out goes through here and then through
 * a SECURITY DEFINER function that re-validates the geofence inside the DB.
 *
 * The IP and user-agent are read from the REQUEST on the server, so they can't
 * be forged by the caller.
 */
function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: {
    action?: "check-in" | "wfh" | "check-out";
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    isMock?: boolean;
    deviceId?: string;
    source?: string;
    attendanceId?: string;
    checkOutAt?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const ip = clientIp(req);
  const ua = req.headers.get("user-agent");

  try {
    if (body.action === "check-in") {
      const { data, error } = await supabase.rpc("record_check_in", {
        p_lat: body.latitude,
        p_lng: body.longitude,
        p_accuracy: body.accuracy,
        p_is_mock: !!body.isMock,
        p_device_id: body.deviceId ?? null,
        p_ip: ip,
        p_user_agent: ua,
        p_source: body.source ?? "web",
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true, record: data });
    }

    if (body.action === "wfh") {
      const { data, error } = await supabase.rpc("record_wfh", {
        p_device_id: body.deviceId ?? null,
        p_ip: ip,
        p_user_agent: ua,
        p_source: body.source ?? "web",
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true, record: data });
    }

    if (body.action === "check-out") {
      const { data, error } = await supabase.rpc("record_check_out", {
        p_attendance_id: body.attendanceId,
        p_check_out: body.checkOutAt ?? null,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true, record: data });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Attendance failed" },
      { status: 500 },
    );
  }
}

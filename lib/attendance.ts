"use client";

/**
 * Client helpers for the SECURE attendance flow.
 *
 * The browser can no longer write to the `attendance` table (RLS revoked).
 * Everything goes through /api/attendance, which captures the real client IP +
 * user-agent server-side and calls a SECURITY DEFINER function that re-checks
 * the geofence inside the database. The client is never trusted.
 */

/** Stable per-device id (helps spot one device checking in for many accounts). */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem("esga-device-id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("esga-device-id", id);
    }
    return id;
  } catch {
    return "unknown";
  }
}

/** Native (APK) is more trustworthy than the web — mock GPS is detectable there. */
export async function detectSource(): Promise<"native" | "web"> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor?.isNativePlatform?.() ? "native" : "web";
  } catch {
    return "web";
  }
}

interface AttendanceBody {
  action: "check-in" | "wfh" | "check-out";
  latitude?: number;
  longitude?: number;
  accuracy?: number | null;
  isMock?: boolean;
  deviceId?: string;
  source?: string;
  attendanceId?: string;
  checkOutAt?: string;
}

/** POST to the secure endpoint; throws with the server's reason on rejection. */
export async function postAttendance(body: AttendanceBody): Promise<unknown> {
  const res = await fetch("/api/attendance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (json as { error?: string }).error || "Attendance could not be recorded.",
    );
  }
  return json;
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { startOfDay, format } from "date-fns";
import {
  MapPin,
  RefreshCw,
  ShieldAlert,
  Clock,
  LogOut,
  LogIn,
  CheckCircle2,
  Home,
  AlertTriangle,
} from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import {
  getCurrentPosition,
  nearestOffice,
  type GeoPosition,
} from "@/lib/geolocation";
import {
  CHECKOUT_WINDOW,
  CHECKIN_CHAT_MESSAGE,
  CHECKOUT_CHAT_MESSAGE,
} from "@/lib/constants";
import { notifyEvent } from "@/lib/notify";
import { postAttendance, getDeviceId, detectSource } from "@/lib/attendance";
import type { OfficeLocation, AttendanceRecord } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { RadiusIndicator, RadiusLegend } from "./RadiusIndicator";
import { cn } from "@/lib/utils";

interface Props {
  uid: string;
}

/** 24h hour → "7:00 PM" style label. */
function fmtHour(h: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:00 ${period}`;
}

/** Decimal hours → "8h 5m" / "48m" / "8h". */
function formatHM(hours: number): string {
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Prompt to backfill a missed check-out. The employee enters the time they left
 * on that (past) day; hours for that day are only counted once this is saved.
 */
function MissedCheckoutCard({ record }: { record: AttendanceRecord }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const checkIn = record.check_in_time ? new Date(record.check_in_time) : null;
  const [time, setTime] = useState(
    `${String(CHECKOUT_WINDOW.startHour).padStart(2, "0")}:00`,
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!checkIn) return;
    const [h, m] = time.split(":").map(Number);
    const out = new Date(checkIn);
    out.setHours(h, m, 0, 0);
    if (out <= checkIn) {
      toast({
        title: "Check-out must be after check-in",
        description: `You checked in at ${format(checkIn, "hh:mm a")}.`,
        variant: "error",
      });
      return;
    }
    setSaving(true);
    try {
      await postAttendance({
        action: "check-out",
        attendanceId: record.id,
        checkOutAt: out.toISOString(),
      });
    } catch (err) {
      setSaving(false);
      toast({
        title: "Couldn't save",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      });
      return;
    }
    setSaving(false);
    await queryClient.invalidateQueries({ queryKey: ["attendance"] });
    toast({
      title: "Check-out time saved",
      description: "That day's hours are now counted.",
      variant: "success",
    });
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-card">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="flex-1">
          <p className="text-sm font-bold text-dark-base">Missed check-out</p>
          <p className="mt-0.5 text-xs text-amber-700">
            {checkIn
              ? `You checked in on ${format(checkIn, "EEE, dd MMM")} at ${format(checkIn, "hh:mm a")} but never checked out.`
              : "A previous day has no check-out."}{" "}
            Enter your check-out time — until then this day&apos;s hours aren&apos;t
            counted.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="h-10 rounded-xl border border-amber-300 bg-white px-3 text-sm focus:border-electric-violet focus:outline-none focus:ring-2 focus:ring-electric-violet/30"
            />
            <Button size="sm" loading={saving} onClick={save}>
              Save check-out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AttendanceClient({ uid }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Offices to geofence against.
  const officesQuery = useQuery({
    queryKey: ["offices"],
    queryFn: async (): Promise<OfficeLocation[]> => {
      const { data, error } = await supabase
        .from("office_locations")
        .select("*");
      if (error) throw error;
      return (data ?? []) as OfficeLocation[];
    },
    staleTime: Infinity, // office coords rarely change — never refetch on nav
  });

  // Today's attendance row (if any).
  const todayQuery = useQuery({
    queryKey: ["attendance", "today", uid],
    queryFn: async (): Promise<AttendanceRecord | null> => {
      const dayStart = startOfDay(new Date()).toISOString();
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("profile_id", uid)
        .gte("check_in_time", dayStart)
        .order("check_in_time", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data?.[0] as AttendanceRecord) ?? null;
    },
  });

  // Prior days where the employee checked in but never checked out — they must
  // enter the missed check-out time before those days' hours can be counted.
  const missedQuery = useQuery({
    queryKey: ["attendance", "missed", uid],
    queryFn: async (): Promise<AttendanceRecord[]> => {
      const dayStart = startOfDay(new Date()).toISOString();
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("profile_id", uid)
        .is("check_out_time", null)
        .not("check_in_time", "is", null)
        .neq("status", "absent")
        .lt("check_in_time", dayStart)
        .order("check_in_time", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as AttendanceRecord[];
    },
  });

  // Re-locate on demand (Refresh / Retry buttons — user events).
  const locate = useCallback(async () => {
    setLocating(true);
    setGeoError(null);
    try {
      const pos = await getCurrentPosition();
      setPosition(pos);
    } catch (err) {
      setGeoError(
        err instanceof Error ? err.message : "Unable to get your location.",
      );
    } finally {
      setLocating(false);
    }
  }, []);

  // Initial locate on mount — state updates happen after await (not synchronous).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const pos = await getCurrentPosition();
        if (active) setPosition(pos);
      } catch (err) {
        if (active)
          setGeoError(
            err instanceof Error ? err.message : "Unable to get your location.",
          );
      } finally {
        if (active) setLocating(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const offices = officesQuery.data ?? [];
  const nearest = useMemo(
    () => (position ? nearestOffice(position, offices) : null),
    [position, offices],
  );

  const today = todayQuery.data ?? null;
  const alreadyCheckedIn = !!today;
  const alreadyCheckedOut = !!today?.check_out_time;

  // No time-of-day restriction — employees can check in any time; only the
  // geofence (and mock-location) gate whether the button is enabled.
  const canCheckIn = !!nearest?.within && !position?.isMock && !alreadyCheckedIn;

  // Post an automatic message to the GLOBAL chat. Best-effort — never blocks or
  // fails attendance (e.g. if the user's chat is disabled, the insert is a no-op).
  async function postChat(content: string) {
    try {
      await supabase
        .from("messages")
        .insert({ sender_id: uid, content, department: null, recipient_id: null });
    } catch {
      /* ignore — attendance already succeeded */
    }
  }

  async function handleCheckIn() {
    if (!nearest || !position) return;
    setSubmitting(true);
    try {
      // The SERVER re-computes the distance from the office and rejects anything
      // outside the geofence — the client's own math is never trusted. Check-in
      // has no time-of-day restriction; the timestamp is simply recorded.
      await postAttendance({
        action: "check-in",
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        isMock: position.isMock,
        deviceId: getDeviceId(),
        source: await detectSource(),
      });
      await queryClient.invalidateQueries({ queryKey: ["attendance"] });
      void postChat(CHECKIN_CHAT_MESSAGE);
      notifyEvent({
        kind: "attendance",
        message: `Checked in at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · ${Math.round(nearest.distanceMeters)} m from office.`,
      });
      toast({
        title: "You're checked in!",
        description: `Marked present · ${Math.round(nearest.distanceMeters)} m from office.`,
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Check-in failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCheckOut() {
    if (!today) return;
    setSubmitting(true);
    try {
      await postAttendance({ action: "check-out", attendanceId: today.id });
      await queryClient.invalidateQueries({ queryKey: ["attendance"] });
      void postChat(CHECKOUT_CHAT_MESSAGE);
      const workedMs = today.check_in_time
        ? Date.now() - new Date(today.check_in_time).getTime()
        : 0;
      const worked = formatHM(workedMs / 3_600_000);
      const early = new Date().getHours() < CHECKOUT_WINDOW.startHour;
      toast({
        title: early ? "Checked out early" : "Checked out. See you tomorrow!",
        description: `You worked ${worked} today.${
          early
            ? ` Standard check-out is ${fmtHour(CHECKOUT_WINDOW.startHour)}–${fmtHour(CHECKOUT_WINDOW.endHour)}.`
            : ""
        }`,
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Check-out failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  // WFH — no geofence/location required (CLAUDE.md B5).
  async function handleWfh() {
    setSubmitting(true);
    try {
      await postAttendance({
        action: "wfh",
        deviceId: getDeviceId(),
        source: await detectSource(),
      });
      await queryClient.invalidateQueries({ queryKey: ["attendance"] });
      void postChat(CHECKIN_CHAT_MESSAGE);
      notifyEvent({ kind: "attendance", message: "Marked as Working From Home today." });
      toast({
        title: "Marked as working from home",
        description: "Have a productive day!",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Couldn't mark WFH",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  // ---- Render ----
  const loading = locating || officesQuery.isLoading || todayQuery.isLoading;
  const missed = missedQuery.data ?? [];

  return (
    <div className="space-y-6">
      {missed.map((rec) => (
        <MissedCheckoutCard key={rec.id} record={rec} />
      ))}

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-dark-base">Mark attendance</h2>
        <button
          onClick={locate}
          disabled={locating}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", locating && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Already checked in banner */}
      {alreadyCheckedIn && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-success/20 bg-success/5 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-dark-base">
              Checked in at{" "}
              {today && new Date(today.check_in_time!).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            {alreadyCheckedOut && (
              <p className="text-xs text-gray-500">
                Checked out at{" "}
                {new Date(today!.check_out_time!).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
          <Badge
            variant={
              today?.status === "late"
                ? "late"
                : today?.status === "wfh"
                  ? "info"
                  : "present"
            }
            dot
          >
            {today?.status}
          </Badge>
        </div>
      )}

      {/* Loading */}
      {loading && !position && (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-gray-500">
          <Spinner className="h-6 w-6 text-electric-violet" />
          <p className="text-sm">Getting your location…</p>
        </div>
      )}

      {/* Geolocation error */}
      {!loading && geoError && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-6 text-center">
          <MapPin className="h-6 w-6 text-red-500" />
          <p className="text-sm font-medium text-red-600">{geoError}</p>
          <p className="text-xs text-red-500/80">
            Enable location access for this app/site, then try again.
          </p>
          <Button variant="secondary" size="sm" onClick={locate}>
            Retry
          </Button>
        </div>
      )}

      {/* No offices configured */}
      {!loading && !geoError && offices.length === 0 && (
        <p className="rounded-xl bg-amber-50 p-4 text-center text-sm text-amber-700">
          No office location is configured yet. Ask your admin to add one.
        </p>
      )}

      {/* Main status */}
      {!loading && !geoError && position && nearest && (
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <RadiusIndicator
              distanceMeters={nearest.distanceMeters}
              radiusMeters={nearest.office.radius_meters}
              within={nearest.within}
            />
          </div>

          <div className="flex-1 space-y-3">
            <div>
              <p className="text-sm text-gray-500">{nearest.office.name}</p>
              <div className="mt-1">
                {nearest.within ? (
                  <Badge variant="present" dot>
                    Within range
                  </Badge>
                ) : (
                  <Badge variant="absent" dot>
                    Outside range
                  </Badge>
                )}
              </div>
            </div>

            <RadiusLegend />

            {position.accuracy != null && (
              <p className="text-xs text-gray-400">
                GPS accuracy ±{Math.round(position.accuracy)} m
              </p>
            )}

            {/* Guardrail messages */}
            {position.isMock && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-red-500">
                <ShieldAlert className="h-3.5 w-3.5" />
                Mock location detected — check-in blocked.
              </p>
            )}
            {/* Action */}
            <div className="pt-1">
              {!alreadyCheckedIn ? (
                <>
                  <Button
                    fullWidth
                    size="lg"
                    disabled={!canCheckIn}
                    loading={submitting}
                    onClick={handleCheckIn}
                    leftIcon={<LogIn className="h-4 w-4" />}
                  >
                    {nearest.within ? "Mark present" : "Move closer to check in"}
                  </Button>
                </>
              ) : !alreadyCheckedOut ? (
                <>
                  <Button
                    fullWidth
                    size="lg"
                    variant="secondary"
                    loading={submitting}
                    onClick={handleCheckOut}
                    leftIcon={<LogOut className="h-4 w-4" />}
                  >
                    Check out
                  </Button>
                  <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs text-gray-400">
                    <Clock className="h-3.5 w-3.5" />
                    Standard check-out: {fmtHour(CHECKOUT_WINDOW.startHour)}–
                    {fmtHour(CHECKOUT_WINDOW.endHour)}
                  </p>
                </>
              ) : (
                <p className="text-center text-sm font-medium text-success">
                  Attendance complete for today ✓
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Work from home — no location required (B5) */}
      {!loading && !alreadyCheckedIn && (
        <div className="mt-5 flex flex-col gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-dark-base">
              Working from home today?
            </p>
            <p className="text-xs text-gray-500">
              No location check — just log your WFH day.
            </p>
          </div>
          <Button
            variant="secondary"
            loading={submitting}
            onClick={handleWfh}
            leftIcon={<Home className="h-4 w-4" />}
          >
            Mark WFH
          </Button>
        </div>
      )}
      </div>
    </div>
  );
}

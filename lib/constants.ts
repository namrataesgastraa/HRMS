/**
 * App-wide constants: brand tokens (mirrored from CLAUDE.md Section 3),
 * attendance defaults, and task rules. Keep design tokens here in sync with
 * tailwind.config.ts and app/globals.css.
 */

export const BRAND = {
  darkBase: "#232234",
  electricViolet: "#7516EA",
  coolBlue: "#2E94F3",
  white: "#FFFFFF",
  success: "#22C55E",
  gradient: "linear-gradient(135deg, #7516EA 0%, #2E94F3 100%)",
} as const;

/** Default geofence radius when an office row has none set (see CLAUDE.md §7). */
export const DEFAULT_OFFICE_RADIUS_METERS = 75;

/** Hours after check-in before "Submit Proof of Work" unlocks (CLAUDE.md §4.4). */
export const PROOF_OF_WORK_UNLOCK_HOURS = 8;

/** Sensible office-hours window for check-in (guards stale GPS caches, §7.6). */
export const CHECK_IN_WINDOW = { startHour: 6, endHour: 22 } as const;

/** Check-ins at/after this local hour are marked "late". */
export const LATE_THRESHOLD_HOUR = 10;

/** Supabase Storage bucket names. */
export const STORAGE_BUCKETS = {
  employeeDocuments: "employee-documents",
  proofOfWork: "proof-of-work",
  avatars: "avatars",
  taskAttachments: "task-attachments",
  chatFiles: "chat-files",
} as const;

/** Celebratory on-time submission messages (CLAUDE.md §4.5). */
export const CELEBRATION_MESSAGES = [
  "🎉 Great job — task completed on time!",
  "✅ Nailed it! See you tomorrow.",
  "💪 Another day, another win logged.",
] as const;

export type UserRole = "employee" | "manager" | "admin";
export type AttendanceStatus = "present" | "late" | "absent" | "wfh";

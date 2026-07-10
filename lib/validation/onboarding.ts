import { z } from "zod";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const educationEntrySchema = z.object({
  degree: z.string().min(1, "Required"),
  institution: z.string().min(1, "Required"),
  year: z.string().regex(/^\d{4}$/, "Enter a 4-digit year"),
});

export const onboardingSchema = z.object({
  // Personal
  full_name: z.string().min(2, "Enter your full name"),
  dob: z.string().min(1, "Select your date of birth"),
  phone: z
    .string()
    .min(7, "Enter a valid phone number")
    .regex(/^[+\d][\d\s-]{6,19}$/, "Digits only (you may start with +)"),
  personal_email: z
    .string()
    .optional()
    .refine((v) => !v || EMAIL_RE.test(v), "Enter a valid email"),
  address: z.string().optional(),
  emergency_contact: z.string().optional(),
  // Employment
  designation: z.string().optional(),
  department: z.string().optional(),
  department_other: z.string().optional(),
  joining_date: z.string().optional(),
  reporting_manager: z.string().optional(),
  // Education (repeatable)
  education: z.array(educationEntrySchema).optional(),
});

export type OnboardingValues = z.infer<typeof onboardingSchema>;

/** Field groups validated when advancing each step. */
export const STEP_FIELDS: (keyof OnboardingValues)[][] = [
  ["full_name", "dob", "phone", "personal_email", "address", "emergency_contact"],
  ["designation", "department", "joining_date", "reporting_manager"],
  ["education"],
  [], // Documents — files handled outside RHF
  [], // Review
];

export const DEPARTMENTS = [
  "Operations & Client Deliverables",
  "Research & Content",
  "Digital Marketing",
] as const;

export const OTHER_DEPARTMENT = "Other";

export const DEPARTMENT_OPTIONS = [
  ...DEPARTMENTS.map((d) => ({ label: d, value: d })),
  { label: "Other (please specify)", value: OTHER_DEPARTMENT },
];

/**
 * Final department string to store: when "Other" is chosen, use the specified
 * text; otherwise the selected option. Empty → null.
 */
export function resolveDepartment(
  department?: string,
  other?: string,
): string | null {
  if (department === OTHER_DEPARTMENT) return other?.trim() || null;
  return department?.trim() || null;
}

/** Whole-years age from an ISO date string (yyyy-mm-dd). */
export function ageFromDob(dob: string): number | null {
  if (!dob) return null;
  const b = new Date(dob);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

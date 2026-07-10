export interface Subject {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  department: string | null;
  employee_id: string | null;
}

/** Score (0–100) → color + label used across evaluation UI + charts. */
export function scoreMeta(score: number) {
  if (score >= 70) return { color: "#22C55E", label: "Strong" };
  if (score >= 40) return { color: "#F59E0B", label: "Fair" };
  return { color: "#EF4444", label: "Needs work" };
}

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Record a profile edit in profile_audit_log: who, when, and which fields
 * changed. `changes` is a map of field → { from, to } for the changed fields.
 */
export async function logProfileEdit(
  supabase: SupabaseClient,
  profileId: string,
  editedBy: string,
  changes: Record<string, { from: unknown; to: unknown }>,
): Promise<void> {
  const fields = Object.keys(changes);
  if (fields.length === 0) return;
  const summary =
    fields.length <= 4
      ? `Updated ${fields.join(", ")}`
      : `Updated ${fields.length} fields`;
  await supabase.from("profile_audit_log").insert({
    profile_id: profileId,
    edited_by: editedBy,
    summary,
    changes,
  });
}

/** Diff two flat records, returning only changed keys as { from, to }. */
export function diffRecords(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    const a = before[key] ?? null;
    const b = after[key] ?? null;
    if (a !== b) out[key] = { from: a, to: b };
  }
  return out;
}

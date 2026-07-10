-- ============================================================================
-- Meetings: soft-cancel so history is preserved (cancelled meetings stay
-- visible in the History view instead of being hard-deleted).
-- ============================================================================

alter table public.meetings
  add column if not exists cancelled_at timestamptz;

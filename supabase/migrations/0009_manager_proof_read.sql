-- ============================================================================
-- ESG Astraa HRMS — Managers can read their team's proof-of-work files
-- The proof-of-work bucket read policy only allowed the owner or an admin, so
-- a manager opening a team member's proof got "couldn't open the file". This
-- extends read to managers of the file owner's department. File paths are
-- `<owner_uid>/<file>`, so the first folder is the owner's profile id.
-- (Plan files also live in this bucket, so they're covered too.)
-- ============================================================================

drop policy if exists proof_read on storage.objects;
create policy proof_read on storage.objects
  for select using (
    bucket_id = 'proof-of-work'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
      or public.is_manager_of(((storage.foldername(name))[1])::uuid)
    )
  );

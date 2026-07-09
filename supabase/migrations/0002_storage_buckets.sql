-- ============================================================================
-- ESG Astraa HRMS — Storage buckets + policies
-- Buckets: employee-documents (onboarding IDs/photo) and proof-of-work (daily).
-- Both are PRIVATE; the app serves files via signed URLs.
-- File path convention: `<user_uid>/<filename>` so RLS can scope by folder.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('employee-documents', 'employee-documents', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('proof-of-work', 'proof-of-work', false)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- employee-documents: a user manages files under their own uid/ folder;
-- admins can read everything.
-- ----------------------------------------------------------------------------
drop policy if exists employee_docs_read on storage.objects;
create policy employee_docs_read on storage.objects
  for select using (
    bucket_id = 'employee-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

drop policy if exists employee_docs_write on storage.objects;
create policy employee_docs_write on storage.objects
  for insert with check (
    bucket_id = 'employee-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists employee_docs_update on storage.objects;
create policy employee_docs_update on storage.objects
  for update using (
    bucket_id = 'employee-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists employee_docs_delete on storage.objects;
create policy employee_docs_delete on storage.objects
  for delete using (
    bucket_id = 'employee-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- ----------------------------------------------------------------------------
-- proof-of-work: same pattern — owner-scoped writes, admin can read all.
-- ----------------------------------------------------------------------------
drop policy if exists proof_read on storage.objects;
create policy proof_read on storage.objects
  for select using (
    bucket_id = 'proof-of-work'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

drop policy if exists proof_write on storage.objects;
create policy proof_write on storage.objects
  for insert with check (
    bucket_id = 'proof-of-work'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists proof_delete on storage.objects;
create policy proof_delete on storage.objects
  for delete using (
    bucket_id = 'proof-of-work'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

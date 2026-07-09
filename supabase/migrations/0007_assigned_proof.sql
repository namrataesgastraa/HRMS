-- ============================================================================
-- ESG Astraa HRMS — Assigned-task proof + attachments
-- - proof_files: employee's proof of work when completing an assigned task.
-- - attachments: files/links the ADMIN attaches when assigning (employee views).
-- Attachments live in a PUBLIC bucket so the assignee can open them (admin
-- isn't the owner of the employee's private folders).
-- ============================================================================

alter table public.assigned_tasks
  add column if not exists proof_files jsonb;

alter table public.assigned_tasks
  add column if not exists attachments jsonb;

-- Public bucket for task attachments (unguessable UUID paths).
insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', true)
on conflict (id) do nothing;

drop policy if exists task_attach_read on storage.objects;
create policy task_attach_read on storage.objects
  for select using (bucket_id = 'task-attachments');

drop policy if exists task_attach_write on storage.objects;
create policy task_attach_write on storage.objects
  for insert with check (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists task_attach_delete on storage.objects;
create policy task_attach_delete on storage.objects
  for delete using (
    bucket_id = 'task-attachments'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

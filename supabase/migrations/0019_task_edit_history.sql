-- ============================================================================
-- ESG Astraa HRMS — Daily task edit / delete with full history
-- - Employees can edit or delete (soft) their daily tasks.
-- - Every edit/delete snapshots the PREVIOUS version into a history table, so
--   the original date/time, text and proof-of-work are always preserved.
-- - `edit_count` + `updated_at` power an "Updated" marker in the UI.
-- ============================================================================

alter table public.daily_task_logs
  add column if not exists updated_at timestamptz,
  add column if not exists edit_count int not null default 0,
  add column if not exists deleted_at timestamptz;

create table if not exists public.daily_task_log_history (
  id uuid primary key default gen_random_uuid(),
  task_log_id uuid not null references public.daily_task_logs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('updated','deleted')),
  task_title text,
  description text,
  proof_files jsonb,
  day_number int,
  snapshot_at timestamptz not null default now()
);

create index if not exists idx_task_history_log
  on public.daily_task_log_history (task_log_id, snapshot_at desc);
create index if not exists idx_task_history_profile
  on public.daily_task_log_history (profile_id);

alter table public.daily_task_log_history enable row level security;

-- Read the history: the owner, admins, or the owner's department manager.
drop policy if exists task_history_select on public.daily_task_log_history;
create policy task_history_select on public.daily_task_log_history
  for select using (
    profile_id = auth.uid()
    or public.is_admin()
    or public.is_manager_of(profile_id)
  );
-- Inserts happen ONLY through the SECURITY DEFINER trigger below.

-- Snapshot the old row on every content edit or soft-delete, and maintain
-- edit_count / updated_at. Runs as definer so it can write the history table.
create or replace function public.log_task_log_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Soft delete: record the final state as a 'deleted' snapshot.
  if new.deleted_at is not null and old.deleted_at is null then
    insert into public.daily_task_log_history
      (task_log_id, profile_id, action, task_title, description, proof_files, day_number)
    values (old.id, old.profile_id, 'deleted', old.task_title, old.description,
            old.proof_files, old.day_number);
    return new;
  end if;

  -- Content edit: snapshot the PREVIOUS version, bump counters.
  if new.task_title is distinct from old.task_title
     or new.description is distinct from old.description
     or coalesce(new.proof_files::text,'') is distinct from coalesce(old.proof_files::text,'')
  then
    insert into public.daily_task_log_history
      (task_log_id, profile_id, action, task_title, description, proof_files, day_number)
    values (old.id, old.profile_id, 'updated', old.task_title, old.description,
            old.proof_files, old.day_number);
    new.updated_at := now();
    new.edit_count := coalesce(old.edit_count, 0) + 1;
  end if;

  return new;
end; $$;

drop trigger if exists on_task_log_change on public.daily_task_logs;
create trigger on_task_log_change
  before update on public.daily_task_logs
  for each row execute function public.log_task_log_change();

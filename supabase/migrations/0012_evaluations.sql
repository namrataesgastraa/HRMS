-- ============================================================================
-- ESG Astraa HRMS — Performance evaluations
-- - Admin evaluates managers (all departments); managers evaluate employees of
--   their own department.
-- - One score (0–100) per evaluator, per subject, per day.
-- - PRIVATE: the person being rated (subject) can NEVER read their score, and a
--   manager can never read the admin's rating of them. Evaluators see only the
--   evaluations they authored; admins additionally get oversight of all.
-- Requires helpers from 0008: is_admin(), is_manager_of(uuid).
-- ============================================================================

create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  evaluator_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.profiles(id) on delete cascade,
  eval_date date not null,
  score int not null check (score >= 0 and score <= 100),
  checked_task_ids jsonb,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (evaluator_id, subject_id, eval_date)
);

create index if not exists idx_evaluations_subject
  on public.evaluations (subject_id, eval_date);
create index if not exists idx_evaluations_evaluator
  on public.evaluations (evaluator_id, eval_date);

alter table public.evaluations enable row level security;

-- Read: your own evaluations, or admin oversight. Subjects are never included,
-- so employees/managers cannot see how they were rated.
drop policy if exists evaluations_select on public.evaluations;
create policy evaluations_select on public.evaluations
  for select using (
    evaluator_id = auth.uid() or public.is_admin()
  );

-- Write: you author it, and you're allowed to evaluate that subject
-- (admin → anyone; manager → members of their department).
drop policy if exists evaluations_insert on public.evaluations;
create policy evaluations_insert on public.evaluations
  for insert with check (
    evaluator_id = auth.uid()
    and (public.is_admin() or public.is_manager_of(subject_id))
  );

drop policy if exists evaluations_update on public.evaluations;
create policy evaluations_update on public.evaluations
  for update using (evaluator_id = auth.uid())
  with check (
    evaluator_id = auth.uid()
    and (public.is_admin() or public.is_manager_of(subject_id))
  );

drop policy if exists evaluations_delete on public.evaluations;
create policy evaluations_delete on public.evaluations
  for delete using (evaluator_id = auth.uid());

-- ============================================================================
-- ESG Astraa HRMS — Evaluation activity log (append-only history)
-- Every time an evaluator saves/updates a rating, a row is recorded here so the
-- full history is preserved (the `evaluations` table only keeps the latest).
-- Same privacy model as evaluations: authors + admins read; subjects never.
-- Requires helpers from 0008: is_admin(), is_manager_of(uuid).
-- ============================================================================

create table if not exists public.evaluation_events (
  id uuid primary key default gen_random_uuid(),
  evaluator_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.profiles(id) on delete cascade,
  eval_date date not null,
  score int not null check (score >= 0 and score <= 100),
  checked_count int,
  note text,
  created_at timestamptz default now()
);

create index if not exists idx_eval_events_evaluator
  on public.evaluation_events (evaluator_id, created_at desc);
create index if not exists idx_eval_events_subject
  on public.evaluation_events (subject_id, eval_date);

alter table public.evaluation_events enable row level security;

-- Read: your own log, or admin oversight. Subjects are never included.
drop policy if exists eval_events_select on public.evaluation_events;
create policy eval_events_select on public.evaluation_events
  for select using (evaluator_id = auth.uid() or public.is_admin());

-- Insert only (append-only): you author, and may evaluate that subject.
drop policy if exists eval_events_insert on public.evaluation_events;
create policy eval_events_insert on public.evaluation_events
  for insert with check (
    evaluator_id = auth.uid()
    and (public.is_admin() or public.is_manager_of(subject_id))
  );

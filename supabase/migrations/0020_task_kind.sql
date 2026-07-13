-- ============================================================================
-- Daily task classification: 'planned' (part of the 90/30-day plan) vs 'extra'
-- (ad-hoc work not in the plan/sheet). Lets admin/manager see how much planned
-- vs extra work an employee has done.
-- ============================================================================

alter table public.daily_task_logs
  add column if not exists task_kind text not null default 'planned'
    check (task_kind in ('planned','extra'));

create index if not exists idx_task_kind
  on public.daily_task_logs (profile_id, task_kind);

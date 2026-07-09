-- ============================================================================
-- ESG Astraa HRMS — Round 2 Phase B
-- New task-sheet hierarchy, WFH attendance, profile photos + editing/audit,
-- admin task assignment, and in-app notifications.
--
-- ⚠️ DESTRUCTIVE: recreates daily_task_logs + admin_comments (test data wiped,
--    as confirmed). task_plans (90-day master) is preserved.
-- ============================================================================

-- ---- B4: profile photo -----------------------------------------------------
alter table public.profiles add column if not exists avatar_url text;

-- ---- B5: Work-from-home attendance status ----------------------------------
alter table public.attendance drop constraint if exists attendance_status_check;
alter table public.attendance add constraint attendance_status_check
  check (status in ('present','late','absent','wfh'));

-- ---- B1: 30-day plans ------------------------------------------------------
create table if not exists public.thirty_day_plans (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  plan_number int not null check (plan_number between 1 and 3),
  content jsonb,          -- { outline: [{ title, detail }] }
  created_at timestamptz not null default now(),
  unique (profile_id, plan_number)
);

-- ---- B1: redesigned daily task entries (one row per TASK) -------------------
drop table if exists public.admin_comments cascade;
drop table if exists public.daily_task_logs cascade;

create table public.daily_task_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  thirty_day_plan_id uuid references public.thirty_day_plans(id) on delete set null,
  day_number int not null,                 -- global day 1..90
  task_title text not null,
  description text,
  proof_files jsonb,                        -- per-task proof [{url,type,filename}]
  attendance_id uuid references public.attendance(id) on delete set null,
  is_late boolean not null default false,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.admin_comments (
  id uuid primary key default gen_random_uuid(),
  task_log_id uuid not null references public.daily_task_logs(id) on delete cascade,
  admin_id uuid not null references public.profiles(id) on delete cascade,
  comment text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_logs_profile on public.daily_task_logs(profile_id);
create index if not exists idx_task_logs_plan on public.daily_task_logs(thirty_day_plan_id);
create index if not exists idx_task_logs_day on public.daily_task_logs(profile_id, day_number);
create index if not exists idx_thirty_plans_profile on public.thirty_day_plans(profile_id);
create index if not exists idx_comments_tasklog on public.admin_comments(task_log_id);

-- ---- B3: profile edit audit log --------------------------------------------
create table if not exists public.profile_audit_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  edited_by uuid references public.profiles(id) on delete set null,
  summary text,
  changes jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_profile on public.profile_audit_log(profile_id, created_at desc);

-- ---- B6: assigned tasks + notifications ------------------------------------
create table if not exists public.assigned_tasks (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text,
  assigned_for timestamptz,   -- suggested time to do it
  deadline timestamptz,
  status text not null default 'pending' check (status in ('pending','done')),
  created_at timestamptz not null default now()
);
create index if not exists idx_assigned_profile on public.assigned_tasks(profile_id, status);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'info',
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notif_profile on public.notifications(profile_id, read);

-- Auto-notify the assignee when a task is assigned (definer bypasses notif RLS).
create or replace function public.notify_on_task_assign()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (profile_id, type, title, body, link)
  values (new.profile_id, 'task_assigned', 'New task assigned',
          new.title, '/tasks/assigned');
  return new;
end; $$;

drop trigger if exists on_task_assigned on public.assigned_tasks;
create trigger on_task_assigned
  after insert on public.assigned_tasks
  for each row execute function public.notify_on_task_assign();

-- ---- B4: avatars (PUBLIC bucket so photos render everywhere) ----------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects
  for select using (bucket_id = 'avatars');
drop policy if exists avatars_write on storage.objects;
create policy avatars_write on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects
  for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects
  for delete using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.thirty_day_plans  enable row level security;
alter table public.daily_task_logs   enable row level security;
alter table public.admin_comments    enable row level security;
alter table public.profile_audit_log enable row level security;
alter table public.assigned_tasks    enable row level security;
alter table public.notifications     enable row level security;

drop policy if exists thirty_day_plans_rw on public.thirty_day_plans;
create policy thirty_day_plans_rw on public.thirty_day_plans
  for all using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

drop policy if exists daily_task_logs_rw on public.daily_task_logs;
create policy daily_task_logs_rw on public.daily_task_logs
  for all using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

drop policy if exists admin_comments_select on public.admin_comments;
create policy admin_comments_select on public.admin_comments
  for select using (
    public.is_admin()
    or exists (select 1 from public.daily_task_logs t
               where t.id = task_log_id and t.profile_id = auth.uid())
  );
drop policy if exists admin_comments_write on public.admin_comments;
create policy admin_comments_write on public.admin_comments
  for all using (public.is_admin())
  with check (public.is_admin() and admin_id = auth.uid());

drop policy if exists audit_select on public.profile_audit_log;
create policy audit_select on public.profile_audit_log
  for select using (profile_id = auth.uid() or public.is_admin());
drop policy if exists audit_insert on public.profile_audit_log;
create policy audit_insert on public.profile_audit_log
  for insert with check (profile_id = auth.uid() or public.is_admin());

drop policy if exists assigned_select on public.assigned_tasks;
create policy assigned_select on public.assigned_tasks
  for select using (profile_id = auth.uid() or public.is_admin());
drop policy if exists assigned_admin_write on public.assigned_tasks;
create policy assigned_admin_write on public.assigned_tasks
  for all using (public.is_admin())
  with check (public.is_admin() and admin_id = auth.uid());
drop policy if exists assigned_update_status on public.assigned_tasks;
create policy assigned_update_status on public.assigned_tasks
  for update using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists notif_select on public.notifications;
create policy notif_select on public.notifications
  for select using (profile_id = auth.uid());
drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications
  for update using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
-- notifications are inserted only by the SECURITY DEFINER trigger.

-- Realtime for live notification badge.
do $$ begin
  begin alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then null; end;
end $$;

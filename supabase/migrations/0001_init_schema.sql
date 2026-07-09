-- ============================================================================
-- ESG Astraa HRMS — Initial schema (CLAUDE.md Section 5)
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- Implements: tables, employee_id sequence, new-user trigger, RLS + policies,
-- privilege-change guard, updated_at triggers, and realtime publication.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Employee ID sequence  →  ESGA-0001, ESGA-0002, ...
-- ----------------------------------------------------------------------------
create sequence if not exists public.employee_id_seq start 1;

create or replace function public.next_employee_id()
returns text
language sql
volatile
as $$
  select 'ESGA-' || lpad(nextval('public.employee_id_seq')::text, 4, '0');
$$;

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

-- profiles (mirrors auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'employee' check (role in ('employee','admin')),
  full_name text,
  employee_id text unique,
  profile_completed boolean not null default false,
  can_chat boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.employee_details (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  age int,
  phone text,
  personal_email text,
  address text,
  emergency_contact text,
  designation text,
  department text,
  joining_date date,
  reporting_manager text,
  education jsonb,   -- array of {degree, institution, year}
  documents jsonb,   -- array of {url, type, filename}
  updated_at timestamptz not null default now()
);

create table if not exists public.office_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  radius_meters int not null default 20,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  office_id uuid references public.office_locations(id),
  check_in_time timestamptz,
  check_out_time timestamptz,
  check_in_lat double precision,
  check_in_lng double precision,
  distance_meters double precision,
  is_mock_location boolean not null default false,
  status text not null default 'present' check (status in ('present','late','absent')),
  created_at timestamptz not null default now()
);

create table if not exists public.task_plans (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  plan_content jsonb,
  submitted_at timestamptz not null default now()
);

create table if not exists public.daily_task_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  attendance_id uuid references public.attendance(id) on delete set null,
  task_description text,
  proof_files jsonb,  -- array of {url, type, filename}
  submitted_at timestamptz,
  is_late boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_comments (
  id uuid primary key default gen_random_uuid(),
  task_log_id uuid not null references public.daily_task_logs(id) on delete cascade,
  admin_id uuid not null references public.profiles(id) on delete cascade,
  comment text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_attendance_profile on public.attendance(profile_id);
create index if not exists idx_attendance_checkin on public.attendance(check_in_time);
create index if not exists idx_task_logs_profile on public.daily_task_logs(profile_id);
create index if not exists idx_task_plans_profile on public.task_plans(profile_id);
create index if not exists idx_comments_tasklog on public.admin_comments(task_log_id);
create index if not exists idx_messages_created on public.messages(created_at);

-- ----------------------------------------------------------------------------
-- Helper: is_admin()  (SECURITY DEFINER avoids RLS recursion on profiles)
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ----------------------------------------------------------------------------
-- Auto-create a profile row when a new auth user is created
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, employee_id, role)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    public.next_employee_id(),
    coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'employee')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Guard: non-admins may not change privileged columns on their own profile
-- ----------------------------------------------------------------------------
create or replace function public.enforce_profile_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.role        := old.role;
    new.can_chat    := old.can_chat;
    new.employee_id := old.employee_id;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_enforce_update on public.profiles;
create trigger profiles_enforce_update
  before update on public.profiles
  for each row execute function public.enforce_profile_update_rules();

-- ----------------------------------------------------------------------------
-- updated_at maintenance for employee_details
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists employee_details_set_updated on public.employee_details;
create trigger employee_details_set_updated
  before update on public.employee_details
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles          enable row level security;
alter table public.employee_details  enable row level security;
alter table public.office_locations  enable row level security;
alter table public.attendance        enable row level security;
alter table public.task_plans        enable row level security;
alter table public.daily_task_logs   enable row level security;
alter table public.admin_comments    enable row level security;
alter table public.messages          enable row level security;

-- ---- profiles --------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());

-- Own row is updatable, but the trigger above reverts privileged columns for
-- non-admins. Admins can update any row (e.g. toggle can_chat / role).
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
-- (No INSERT policy: rows are created by the SECURITY DEFINER trigger only.)

-- ---- employee_details ------------------------------------------------------
drop policy if exists employee_details_rw on public.employee_details;
create policy employee_details_rw on public.employee_details
  for all using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

-- ---- office_locations ------------------------------------------------------
-- Any authenticated user may read offices (needed to compute geofence).
drop policy if exists office_locations_select on public.office_locations;
create policy office_locations_select on public.office_locations
  for select using (auth.uid() is not null);

-- Only admins may create/update/delete offices.
drop policy if exists office_locations_write on public.office_locations;
create policy office_locations_write on public.office_locations
  for all using (public.is_admin()) with check (public.is_admin());

-- ---- attendance ------------------------------------------------------------
drop policy if exists attendance_rw on public.attendance;
create policy attendance_rw on public.attendance
  for all using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

-- ---- task_plans ------------------------------------------------------------
drop policy if exists task_plans_rw on public.task_plans;
create policy task_plans_rw on public.task_plans
  for all using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

-- ---- daily_task_logs -------------------------------------------------------
drop policy if exists daily_task_logs_rw on public.daily_task_logs;
create policy daily_task_logs_rw on public.daily_task_logs
  for all using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

-- ---- admin_comments --------------------------------------------------------
-- Employees may read comments left on their own task logs; admins read all.
drop policy if exists admin_comments_select on public.admin_comments;
create policy admin_comments_select on public.admin_comments
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.daily_task_logs t
      where t.id = task_log_id and t.profile_id = auth.uid()
    )
  );

-- Only admins may write comments, and only as themselves.
drop policy if exists admin_comments_write on public.admin_comments;
create policy admin_comments_write on public.admin_comments
  for all using (public.is_admin())
  with check (public.is_admin() and admin_id = auth.uid());

-- ---- messages (company-wide chat) ------------------------------------------
-- Everyone authenticated can read the channel.
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select using (auth.uid() is not null);

-- Post only as yourself, and only if chat is enabled for you (or you're admin).
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert with check (
    sender_id = auth.uid()
    and (
      public.is_admin()
      or coalesce((select can_chat from public.profiles where id = auth.uid()), false)
    )
  );

-- Delete your own message; admins can moderate (delete any).
drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages
  for delete using (sender_id = auth.uid() or public.is_admin());

-- ============================================================================
-- Realtime — chat + live admin attendance dashboard
-- ============================================================================
do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.attendance;
  exception when duplicate_object then null;
  end;
end $$;

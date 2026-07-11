-- ============================================================================
-- ESG Astraa HRMS — Leave requests
-- - Employees request leave and route it to Admin, their department Manager, or
--   both. Recipients get an in-app notification (+ email via the app), and the
--   requester is notified when it's approved/rejected.
-- Requires helpers from 0008: is_admin(), is_manager_of(uuid), my_department().
-- ============================================================================

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  leave_type text not null,
  start_date date not null,
  end_date date not null,
  reason text,
  to_admin boolean not null default false,
  to_manager boolean not null default false,
  department text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles(id),
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_leave_profile on public.leave_requests (profile_id, start_date);
create index if not exists idx_leave_dept on public.leave_requests (department, start_date);

alter table public.leave_requests enable row level security;

-- Read: your own; admins see those sent to admin; the dept manager sees those
-- sent to manager for their department.
drop policy if exists leave_select on public.leave_requests;
create policy leave_select on public.leave_requests
  for select using (
    profile_id = auth.uid()
    or (to_admin and public.is_admin())
    or (to_manager and public.is_manager_of(profile_id))
  );

-- Create: only for yourself, and at least one recipient chosen.
drop policy if exists leave_insert on public.leave_requests;
create policy leave_insert on public.leave_requests
  for insert with check (
    profile_id = auth.uid() and (to_admin or to_manager)
  );

-- Update: the requester may edit/cancel while pending; a valid reviewer may
-- decide (admin if sent to admin, dept manager if sent to manager).
drop policy if exists leave_update on public.leave_requests;
create policy leave_update on public.leave_requests
  for update using (
    profile_id = auth.uid()
    or (to_admin and public.is_admin())
    or (to_manager and public.is_manager_of(profile_id))
  );

drop policy if exists leave_delete on public.leave_requests;
create policy leave_delete on public.leave_requests
  for delete using (profile_id = auth.uid() or public.is_admin());

-- Notify recipients when a request is created (SECURITY DEFINER bypasses RLS).
create or replace function public.notify_on_leave_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; who text;
begin
  select full_name into who from public.profiles where id = new.profile_id;
  if new.to_admin then
    for r in select id from public.profiles where role = 'admin' loop
      insert into public.notifications (profile_id, type, title, body, link)
      values (r.id, 'leave', 'Leave request',
        coalesce(who,'An employee') || ' requested ' || new.leave_type || ' leave',
        '/admin/leave');
    end loop;
  end if;
  if new.to_manager and new.department is not null then
    for r in select id from public.profiles
             where role = 'manager' and department = new.department and id <> new.profile_id loop
      insert into public.notifications (profile_id, type, title, body, link)
      values (r.id, 'leave', 'Leave request',
        coalesce(who,'A team member') || ' requested ' || new.leave_type || ' leave',
        '/leave');
    end loop;
  end if;
  return new;
end; $$;

drop trigger if exists on_leave_request on public.leave_requests;
create trigger on_leave_request
  after insert on public.leave_requests
  for each row execute function public.notify_on_leave_request();

-- Notify the requester when the decision changes.
create or replace function public.notify_on_leave_decision()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('approved','rejected') then
    insert into public.notifications (profile_id, type, title, body, link)
    values (new.profile_id, 'leave', 'Leave ' || new.status,
      'Your ' || new.leave_type || ' leave request was ' || new.status || '.', '/leave');
  end if;
  return new;
end; $$;

drop trigger if exists on_leave_decision on public.leave_requests;
create trigger on_leave_decision
  after update on public.leave_requests
  for each row execute function public.notify_on_leave_decision();

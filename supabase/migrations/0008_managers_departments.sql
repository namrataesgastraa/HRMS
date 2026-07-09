-- ============================================================================
-- ESG Astraa HRMS — Managers, departments & department chat
-- - Adds a 'manager' role (admin = superadmin promotes employees to manager).
-- - profiles.department: a manager manages everyone in their department; those
--   employees "report" to the manager, who can see their attendance/tasks/plans
--   and assign them tasks.
-- - messages.department: chat has a global channel (department null) and a
--   per-department channel.
-- ============================================================================

-- ---- role + department -----------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('employee','manager','admin'));

alter table public.profiles add column if not exists department text;

-- Backfill department from employee_details for existing users.
update public.profiles p
set department = d.department
from public.employee_details d
where d.profile_id = p.id and p.department is null;

-- ---- helper functions (SECURITY DEFINER → no RLS recursion) -----------------
create or replace function public.my_department()
returns text language sql stable security definer set search_path = public as $$
  select department from public.profiles where id = auth.uid();
$$;

-- Is the current user a manager of the department that `target` belongs to?
create or replace function public.is_manager_of(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.profiles me
    join public.profiles tgt on tgt.id = target
    where me.id = auth.uid()
      and me.role = 'manager'
      and me.department is not null
      and tgt.department is not distinct from me.department
  );
$$;

-- ============================================================================
-- RLS — let managers READ their department members' data (writes stay owner/admin)
-- ============================================================================

-- employee_details
drop policy if exists employee_details_rw on public.employee_details;
drop policy if exists employee_details_select on public.employee_details;
drop policy if exists employee_details_write on public.employee_details;
create policy employee_details_select on public.employee_details
  for select using (
    profile_id = auth.uid() or public.is_admin() or public.is_manager_of(profile_id)
  );
create policy employee_details_write on public.employee_details
  for all using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

-- attendance
drop policy if exists attendance_rw on public.attendance;
drop policy if exists attendance_select on public.attendance;
drop policy if exists attendance_write on public.attendance;
create policy attendance_select on public.attendance
  for select using (
    profile_id = auth.uid() or public.is_admin() or public.is_manager_of(profile_id)
  );
create policy attendance_write on public.attendance
  for all using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

-- task_plans
drop policy if exists task_plans_rw on public.task_plans;
drop policy if exists task_plans_select on public.task_plans;
drop policy if exists task_plans_write on public.task_plans;
create policy task_plans_select on public.task_plans
  for select using (
    profile_id = auth.uid() or public.is_admin() or public.is_manager_of(profile_id)
  );
create policy task_plans_write on public.task_plans
  for all using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

-- thirty_day_plans
drop policy if exists thirty_day_plans_rw on public.thirty_day_plans;
drop policy if exists thirty_day_plans_select on public.thirty_day_plans;
drop policy if exists thirty_day_plans_write on public.thirty_day_plans;
create policy thirty_day_plans_select on public.thirty_day_plans
  for select using (
    profile_id = auth.uid() or public.is_admin() or public.is_manager_of(profile_id)
  );
create policy thirty_day_plans_write on public.thirty_day_plans
  for all using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

-- daily_task_logs
drop policy if exists daily_task_logs_rw on public.daily_task_logs;
drop policy if exists daily_task_logs_select on public.daily_task_logs;
drop policy if exists daily_task_logs_write on public.daily_task_logs;
create policy daily_task_logs_select on public.daily_task_logs
  for select using (
    profile_id = auth.uid() or public.is_admin() or public.is_manager_of(profile_id)
  );
create policy daily_task_logs_write on public.daily_task_logs
  for all using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

-- admin_comments — managers may read/comment on their team's task logs
drop policy if exists admin_comments_select on public.admin_comments;
create policy admin_comments_select on public.admin_comments
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.daily_task_logs t
      where t.id = task_log_id
        and (t.profile_id = auth.uid() or public.is_manager_of(t.profile_id))
    )
  );
drop policy if exists admin_comments_write on public.admin_comments;
create policy admin_comments_write on public.admin_comments
  for all using (
    public.is_admin()
    or exists (
      select 1 from public.daily_task_logs t
      where t.id = task_log_id and public.is_manager_of(t.profile_id)
    )
  )
  with check (admin_id = auth.uid());

-- assigned_tasks — managers can assign to (and see) their department members
drop policy if exists assigned_select on public.assigned_tasks;
create policy assigned_select on public.assigned_tasks
  for select using (
    profile_id = auth.uid() or public.is_admin() or public.is_manager_of(profile_id)
  );
drop policy if exists assigned_admin_write on public.assigned_tasks;
drop policy if exists assigned_write on public.assigned_tasks;
create policy assigned_write on public.assigned_tasks
  for all using (public.is_admin() or public.is_manager_of(profile_id))
  with check (
    (public.is_admin() or public.is_manager_of(profile_id)) and admin_id = auth.uid()
  );
-- (assigned_update_status for the assignee stays as-is.)

-- ============================================================================
-- Department chat channel
-- ============================================================================
alter table public.messages add column if not exists department text;

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select using (
    department is null
    or public.is_admin()
    or department = public.my_department()
  );

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert with check (
    sender_id = auth.uid()
    and (
      public.is_admin()
      or coalesce((select can_chat from public.profiles where id = auth.uid()), false)
    )
    and (department is null or department = public.my_department())
  );

-- ============================================================================
-- ESG Astraa HRMS — Data inspection queries
-- Run these in the Supabase SQL Editor (service role → bypasses RLS, shows ALL
-- rows for every user). Run a whole section, or a single statement.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. OVERVIEW — row counts for every table at a glance
-- ----------------------------------------------------------------------------
select 'profiles'         as table_name, count(*) from public.profiles
union all select 'employee_details', count(*) from public.employee_details
union all select 'office_locations', count(*) from public.office_locations
union all select 'attendance',       count(*) from public.attendance
union all select 'task_plans',        count(*) from public.task_plans
union all select 'daily_task_logs',   count(*) from public.daily_task_logs
union all select 'admin_comments',    count(*) from public.admin_comments
union all select 'messages',          count(*) from public.messages
order by table_name;


-- ----------------------------------------------------------------------------
-- 1. RAW DUMPS — every record in every table
-- ----------------------------------------------------------------------------
select * from public.profiles         order by created_at;
select * from public.employee_details order by updated_at desc;
select * from public.office_locations order by name;
select * from public.attendance       order by check_in_time desc nulls last;
select * from public.task_plans        order by submitted_at desc;
select * from public.daily_task_logs   order by submitted_at desc nulls last;
select * from public.admin_comments    order by created_at desc;
select * from public.messages          order by created_at desc;


-- ----------------------------------------------------------------------------
-- 2. USERS / EMPLOYEE DIRECTORY — profiles + login email + full details
-- ----------------------------------------------------------------------------
select
  p.employee_id,
  p.full_name,
  u.email                as login_email,
  p.role,
  p.profile_completed,
  p.can_chat,
  d.designation,
  d.department,
  d.phone,
  d.personal_email,
  d.joining_date,
  d.reporting_manager,
  p.created_at
from public.profiles p
join auth.users u              on u.id = p.id
left join public.employee_details d on d.profile_id = p.id
order by p.employee_id;


-- ----------------------------------------------------------------------------
-- 3. ATTENDANCE — every check-in with employee name + office + flags
-- ----------------------------------------------------------------------------
select
  p.employee_id,
  p.full_name,
  o.name                 as office,
  a.status,
  a.check_in_time,
  a.check_out_time,
  round(a.distance_meters::numeric, 1) as distance_m,
  a.is_mock_location,
  a.check_in_lat,
  a.check_in_lng
from public.attendance a
join public.profiles p         on p.id = a.profile_id
left join public.office_locations o on o.id = a.office_id
order by a.check_in_time desc nulls last;

-- Attendance anomalies only (mock GPS, far from office, or late)
select
  p.employee_id, p.full_name, a.status,
  round(a.distance_meters::numeric, 1) as distance_m,
  a.is_mock_location, a.check_in_time
from public.attendance a
join public.profiles p on p.id = a.profile_id
where a.is_mock_location = true
   or a.status = 'late'
   or a.distance_meters > 150
order by a.check_in_time desc nulls last;

-- Today's attendance (server timezone)
select p.employee_id, p.full_name, a.status, a.check_in_time, a.check_out_time
from public.attendance a
join public.profiles p on p.id = a.profile_id
where a.check_in_time::date = current_date
order by a.check_in_time;


-- ----------------------------------------------------------------------------
-- 4. TASKS — 90-day plans + daily logs with proof + admin comments
-- ----------------------------------------------------------------------------
-- 90-day master plans
select p.employee_id, p.full_name, tp.plan_content, tp.submitted_at
from public.task_plans tp
join public.profiles p on p.id = tp.profile_id
order by tp.submitted_at desc;

-- Daily task logs (+ how many proof files, + latest admin comment)
select
  p.employee_id,
  p.full_name,
  l.task_description,
  jsonb_array_length(coalesce(l.proof_files, '[]'::jsonb)) as proof_file_count,
  l.is_late,
  l.submitted_at,
  (select c.comment
     from public.admin_comments c
    where c.task_log_id = l.id
    order by c.created_at desc
    limit 1) as latest_admin_comment
from public.daily_task_logs l
join public.profiles p on p.id = l.profile_id
order by l.submitted_at desc nulls last;

-- Every admin comment with the task it belongs to
select
  ap.full_name  as admin_name,
  ep.employee_id,
  ep.full_name  as employee_name,
  c.comment,
  c.created_at,
  l.task_description
from public.admin_comments c
join public.daily_task_logs l on l.id = c.task_log_id
join public.profiles ep on ep.id = l.profile_id
join public.profiles ap on ap.id = c.admin_id
order by c.created_at desc;


-- ----------------------------------------------------------------------------
-- 5. CHAT — every message with sender name
-- ----------------------------------------------------------------------------
select p.full_name as sender, p.employee_id, m.content, m.created_at
from public.messages m
join public.profiles p on p.id = m.sender_id
order by m.created_at desc;


-- ----------------------------------------------------------------------------
-- 6. STORAGE — uploaded files (onboarding docs + proof of work)
-- ----------------------------------------------------------------------------
select bucket_id, name, owner, metadata->>'size' as size_bytes, created_at
from storage.objects
where bucket_id in ('employee-documents', 'proof-of-work')
order by created_at desc;

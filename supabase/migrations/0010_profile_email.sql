-- ============================================================================
-- ESG Astraa HRMS — store login email on profiles (for email notifications)
-- Lets the /api/notify route resolve a manager's / employee's email to send to.
-- ============================================================================

alter table public.profiles add column if not exists email text;

-- Backfill from auth.users.
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- Keep it populated for new signups (role still forced to 'employee').
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, employee_id, role, email)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    public.next_employee_id(),
    'employee',
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

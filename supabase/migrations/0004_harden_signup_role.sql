-- ============================================================================
-- ESG Astraa HRMS — Harden new-user role assignment
-- Now that public self-signup is enabled, the new-user trigger must NEVER take
-- `role` from client-supplied metadata (a crafted signup could otherwise set
-- role='admin'). New accounts are ALWAYS created as 'employee'; admins are
-- promoted explicitly via SQL / dashboard.
-- ============================================================================

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
    'employee'  -- never trust client metadata for role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

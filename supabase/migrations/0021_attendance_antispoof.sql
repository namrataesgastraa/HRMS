-- ============================================================================
-- ESG Astraa HRMS — STRICT attendance security (anti-spoofing)
--
-- THE GAP THIS CLOSES:
-- Previously the geofence was enforced only in client-side JavaScript, and the
-- RLS policy let an employee INSERT any attendance row for themselves. So anyone
-- could call the API directly (or use a fake-GPS app) and record a "present" row
-- from anywhere, with any lat/lng/distance they liked.
--
-- NOW:
--  * Employees can NO LONGER insert/update attendance directly (RLS revoked).
--  * All check-in/out goes through SECURITY DEFINER functions that recompute the
--    distance FROM THE OFFICE COORDINATES **inside the database** and reject
--    anything outside the radius, mock-located, coarse, or out-of-hours.
--  * Every check-in stores an audit trail: raw GPS, accuracy, IP, user-agent,
--    device id, and automatically-computed risk flags.
-- ============================================================================

-- ---------- 1. Audit + forensic columns ------------------------------------
alter table public.attendance
  add column if not exists accuracy_meters double precision,
  add column if not exists ip_address text,
  add column if not exists user_agent text,
  add column if not exists device_id text,
  add column if not exists risk_flags jsonb not null default '[]'::jsonb,
  add column if not exists source text;   -- 'web' | 'native'

-- ---------- 2. Office network (WiFi/public IP) allowlist --------------------
create table if not exists public.office_networks (
  id uuid primary key default gen_random_uuid(),
  label text,
  cidr cidr not null,
  created_at timestamptz not null default now()
);
alter table public.office_networks enable row level security;
drop policy if exists office_networks_admin on public.office_networks;
create policy office_networks_admin on public.office_networks
  for all using (public.is_admin()) with check (public.is_admin());

-- When true, a check-in MUST come from an office network IP (strictest mode).
alter table public.office_locations
  add column if not exists enforce_network boolean not null default false;

-- ---------- 3. Server-side distance (never trust the client's math) ---------
create or replace function public.haversine_meters(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) returns double precision language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- ---------- 4. Validated check-in -------------------------------------------
create or replace function public.record_check_in(
  p_lat        double precision,
  p_lng        double precision,
  p_accuracy   double precision,
  p_is_mock    boolean,
  p_device_id  text,
  p_ip         text,
  p_user_agent text,
  p_source     text default 'web'
) returns public.attendance
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_now    timestamptz := now();
  v_local  timestamptz := v_now at time zone 'Asia/Kolkata';
  v_hour   int;
  v_office public.office_locations%rowtype;
  v_dist   double precision;
  v_status text;
  v_flags  jsonb := '[]'::jsonb;
  v_prev   public.attendance%rowtype;
  v_kmh    double precision;
  v_onnet  boolean := true;
  v_row    public.attendance%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated.'; end if;
  v_hour := extract(hour from v_local);

  -- One check-in per calendar day.
  if exists (
    select 1 from public.attendance a
    where a.profile_id = v_uid
      and (a.check_in_time at time zone 'Asia/Kolkata')::date = v_local::date
  ) then
    raise exception 'You have already marked attendance today.';
  end if;

  -- HARD BLOCK: mock / spoofed GPS.
  if coalesce(p_is_mock, false) then
    raise exception 'Mock or spoofed location detected — check-in blocked.';
  end if;

  -- HARD BLOCK: coarse location can't prove presence.
  if p_accuracy is null or p_accuracy > 100 then
    raise exception 'Location accuracy too low (±% m). Turn ON Precise Location and retry.',
      coalesce(round(p_accuracy)::text, '?');
  end if;

  if p_lat is null or p_lng is null then
    raise exception 'No location provided.';
  end if;

  -- Nearest office + distance computed HERE (client value is ignored).
  select o.* into v_office
  from public.office_locations o
  order by public.haversine_meters(p_lat, p_lng, o.latitude, o.longitude) asc
  limit 1;
  if v_office.id is null then raise exception 'No office location configured.'; end if;

  v_dist := public.haversine_meters(p_lat, p_lng, v_office.latitude, v_office.longitude);

  -- HARD BLOCK: outside the geofence.
  if v_dist > v_office.radius_meters then
    raise exception 'You are % m from the office (allowed: % m).',
      round(v_dist), v_office.radius_meters;
  end if;

  -- HARD BLOCK: outside office hours.
  if v_hour < 6 or v_hour >= 22 then
    raise exception 'Outside check-in hours.';
  end if;

  -- Office network (WiFi) check.
  if exists (select 1 from public.office_networks) then
    begin
      v_onnet := exists (
        select 1 from public.office_networks n where p_ip::inet <<= n.cidr
      );
    exception when others then
      v_onnet := false;   -- unparseable IP
    end;
    if not v_onnet then
      if v_office.enforce_network then
        raise exception 'Check-in must be from the office network (WiFi).';
      end if;
      v_flags := v_flags || '["off_network_ip"]'::jsonb;
    end if;
  end if;

  -- ---- Risk signals (recorded, not blocking) ----
  -- Real GPS drifts a few metres; byte-identical coordinates suggest a fixed fake.
  if exists (
    select 1 from public.attendance a
    where a.profile_id = v_uid
      and a.check_in_lat = p_lat and a.check_in_lng = p_lng
  ) then
    v_flags := v_flags || '["repeated_exact_coordinates"]'::jsonb;
  end if;

  -- Impossible travel since the last recorded position.
  select * into v_prev from public.attendance a
  where a.profile_id = v_uid and a.check_in_lat is not null
  order by a.check_in_time desc limit 1;
  if v_prev.id is not null then
    v_kmh := public.haversine_meters(p_lat, p_lng, v_prev.check_in_lat, v_prev.check_in_lng)
             / greatest(extract(epoch from (v_now - v_prev.check_in_time)), 1) * 3.6;
    if v_kmh > 250 then
      v_flags := v_flags || '["impossible_travel"]'::jsonb;
    end if;
  end if;

  -- Suspiciously perfect accuracy is a classic spoofer tell.
  if p_accuracy <= 1 then
    v_flags := v_flags || '["implausible_accuracy"]'::jsonb;
  end if;

  -- Web browsers cannot detect mock providers; native is more trustworthy.
  if coalesce(p_source, 'web') <> 'native' then
    v_flags := v_flags || '["web_client"]'::jsonb;
  end if;

  v_status := case when v_hour >= 12 then 'late' else 'present' end;

  insert into public.attendance (
    profile_id, office_id, check_in_time, check_in_lat, check_in_lng,
    distance_meters, is_mock_location, status,
    accuracy_meters, ip_address, user_agent, device_id, risk_flags, source
  ) values (
    v_uid, v_office.id, v_now, p_lat, p_lng,
    round(v_dist), false, v_status,
    p_accuracy, p_ip, p_user_agent, p_device_id, v_flags, coalesce(p_source, 'web')
  ) returning * into v_row;

  return v_row;
end; $$;

-- ---------- 5. Work-from-home (no geofence, but still audited) --------------
create or replace function public.record_wfh(
  p_device_id text, p_ip text, p_user_agent text, p_source text default 'web'
) returns public.attendance
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_now   timestamptz := now();
  v_local timestamptz := v_now at time zone 'Asia/Kolkata';
  v_row   public.attendance%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated.'; end if;
  if exists (
    select 1 from public.attendance a
    where a.profile_id = v_uid
      and (a.check_in_time at time zone 'Asia/Kolkata')::date = v_local::date
  ) then
    raise exception 'You have already marked attendance today.';
  end if;

  insert into public.attendance (
    profile_id, check_in_time, status, is_mock_location,
    ip_address, user_agent, device_id, risk_flags, source
  ) values (
    v_uid, v_now, 'wfh', false,
    p_ip, p_user_agent, p_device_id, '[]'::jsonb, coalesce(p_source, 'web')
  ) returning * into v_row;
  return v_row;
end; $$;

-- ---------- 6. Validated check-out (incl. missed-checkout backfill) ---------
create or replace function public.record_check_out(
  p_attendance_id uuid,
  p_check_out timestamptz default null
) returns public.attendance
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row public.attendance%rowtype;
  v_out timestamptz;
begin
  if v_uid is null then raise exception 'Not authenticated.'; end if;

  select * into v_row from public.attendance
   where id = p_attendance_id and profile_id = v_uid;
  if v_row.id is null then raise exception 'Attendance record not found.'; end if;
  if v_row.check_out_time is not null then raise exception 'Already checked out.'; end if;

  v_out := coalesce(p_check_out, now());

  if v_out <= v_row.check_in_time then
    raise exception 'Check-out must be after check-in.';
  end if;
  if v_out > now() then
    raise exception 'Check-out cannot be in the future.';
  end if;
  -- Backfill must stay on the check-in day (max 18h shift).
  if v_out > v_row.check_in_time + interval '18 hours' then
    raise exception 'Check-out is too far after check-in.';
  end if;

  update public.attendance set check_out_time = v_out
   where id = p_attendance_id returning * into v_row;
  return v_row;
end; $$;

-- ---------- 7. LOCK DOWN: employees may no longer write attendance ----------
-- Reads stay the same (own / manager's team / admin). All writes now go through
-- the validated SECURITY DEFINER functions above; only admins can write directly
-- (to correct or void a record).
drop policy if exists attendance_write on public.attendance;
drop policy if exists attendance_rw on public.attendance;
create policy attendance_admin_write on public.attendance
  for all using (public.is_admin()) with check (public.is_admin());

revoke insert, update, delete on public.attendance from authenticated;

grant execute on function public.record_check_in(
  double precision, double precision, double precision, boolean, text, text, text, text
) to authenticated;
grant execute on function public.record_wfh(text, text, text, text) to authenticated;
grant execute on function public.record_check_out(uuid, timestamptz) to authenticated;

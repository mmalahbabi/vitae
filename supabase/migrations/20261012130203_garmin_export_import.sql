-- Imported measurements are separate from daily_metrics so that re-importing
-- Garmin data cannot overwrite the user's manually logged hydration.
create table public.garmin_daily (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null check (day between date '2000-01-01' and date '2100-12-31'),
  steps integer check (steps between 0 and 300000),
  total_kcal numeric check (total_kcal between 0 and 30000),
  active_kcal numeric check (active_kcal between 0 and 30000),
  resting_hr numeric check (resting_hr between 20 and 250),
  min_hr numeric check (min_hr between 20 and 250),
  max_hr numeric check (max_hr between 20 and 250),
  sleep_seconds integer check (sleep_seconds between 0 and 86400),
  deep_seconds integer check (deep_seconds between 0 and 86400),
  light_seconds integer check (light_seconds between 0 and 86400),
  rem_seconds integer check (rem_seconds between 0 and 86400),
  awake_seconds integer check (awake_seconds between 0 and 86400),
  imported_at timestamptz not null default now(),
  primary key (user_id, day),
  check (num_nonnulls(steps, total_kcal, active_kcal, resting_hr, min_hr, max_hr, sleep_seconds) > 0)
);

create table public.garmin_workouts (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  activity_id text not null check (activity_id ~ '^[0-9]{1,30}$'),
  day date not null check (day between date '2000-01-01' and date '2100-12-31'),
  started_at timestamptz,
  -- A Garmin local timestamp has no UTC offset. Do not relabel it as UTC.
  started_local timestamp,
  import_timezone text not null,
  sport text not null check (length(sport) between 1 and 80),
  duration_seconds numeric not null check (duration_seconds between 0 and 604800),
  distance_m numeric check (distance_m between 0 and 5000000),
  calories numeric check (calories between 0 and 30000),
  avg_hr numeric check (avg_hr between 20 and 250),
  max_hr numeric check (max_hr between 20 and 250),
  imported_at timestamptz not null default now(),
  primary key (user_id, activity_id),
  check (started_at is not null or started_local is not null),
  check (started_local is null or started_local::date = day)
);
create index garmin_workouts_user_day on public.garmin_workouts (user_id, day);

alter table public.garmin_daily enable row level security;
alter table public.garmin_workouts enable row level security;
revoke all on public.garmin_daily, public.garmin_workouts from public, anon, authenticated;
grant select, insert, update, delete on public.garmin_daily, public.garmin_workouts to authenticated;

create policy "own Garmin days" on public.garmin_daily for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own Garmin workouts" on public.garmin_workouts for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- One transaction for the entire preview. Caller ownership is always derived
-- from the verified session, never an owner ID inside the import payload.
create function public.import_garmin_export(daily_rows jsonb, workout_rows jsonb, import_timezone text, expected_user_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  day_count integer;
  workout_count integer;
begin
  if owner_id is null or expected_user_id is distinct from owner_id then raise exception 'Sign in before importing; account must match preview' using errcode = '42501'; end if;
  if daily_rows is null or workout_rows is null
    or jsonb_typeof(daily_rows) <> 'array' or jsonb_typeof(workout_rows) <> 'array' then
    raise exception 'Expected record arrays' using errcode = '22023';
  end if;
  if jsonb_array_length(daily_rows) + jsonb_array_length(workout_rows) not between 1 and 15000
    or octet_length(daily_rows::text) + octet_length(workout_rows::text) > 8388608 then
    raise exception 'Import size out of range' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = import_timezone) then
    raise exception 'Invalid time zone' using errcode = '22023';
  end if;

  insert into public.garmin_daily as existing
    (user_id, day, steps, total_kcal, active_kcal, resting_hr, min_hr, max_hr,
     sleep_seconds, deep_seconds, light_seconds, rem_seconds, awake_seconds)
  select owner_id, r.day, r.steps, r.total_kcal, r.active_kcal, r.resting_hr, r.min_hr, r.max_hr,
    r.sleep_seconds, r.deep_seconds, r.light_seconds, r.rem_seconds, r.awake_seconds
  from jsonb_to_recordset(daily_rows) as r(day date, steps integer, total_kcal numeric,
    active_kcal numeric, resting_hr numeric, min_hr numeric, max_hr numeric,
    sleep_seconds integer, deep_seconds integer, light_seconds integer, rem_seconds integer, awake_seconds integer)
  on conflict (user_id, day) do update set
    steps = coalesce(excluded.steps, existing.steps),
    total_kcal = coalesce(excluded.total_kcal, existing.total_kcal),
    active_kcal = coalesce(excluded.active_kcal, existing.active_kcal),
    resting_hr = coalesce(excluded.resting_hr, existing.resting_hr),
    min_hr = coalesce(excluded.min_hr, existing.min_hr),
    max_hr = coalesce(excluded.max_hr, existing.max_hr),
    sleep_seconds = coalesce(excluded.sleep_seconds, existing.sleep_seconds),
    deep_seconds = coalesce(excluded.deep_seconds, existing.deep_seconds),
    light_seconds = coalesce(excluded.light_seconds, existing.light_seconds),
    rem_seconds = coalesce(excluded.rem_seconds, existing.rem_seconds),
    awake_seconds = coalesce(excluded.awake_seconds, existing.awake_seconds),
    imported_at = now();
  get diagnostics day_count = row_count;

  insert into public.garmin_workouts as existing
    (user_id, activity_id, day, started_at, started_local, import_timezone, sport,
     duration_seconds, distance_m, calories, avg_hr, max_hr)
  select owner_id, r.activity_id, r.day, r.started_at, r.started_local, import_timezone, r.sport,
    r.duration_seconds, r.distance_m, r.calories, r.avg_hr, r.max_hr
  from jsonb_to_recordset(workout_rows) as r(activity_id text, day date, started_at timestamptz,
    started_local timestamp, sport text, duration_seconds numeric, distance_m numeric,
    calories numeric, avg_hr numeric, max_hr numeric)
  on conflict (user_id, activity_id) do update set
    day = excluded.day,
    started_at = coalesce(excluded.started_at, existing.started_at),
    started_local = coalesce(excluded.started_local, existing.started_local),
    import_timezone = excluded.import_timezone,
    sport = excluded.sport,
    duration_seconds = excluded.duration_seconds,
    distance_m = coalesce(excluded.distance_m, existing.distance_m),
    calories = coalesce(excluded.calories, existing.calories),
    avg_hr = coalesce(excluded.avg_hr, existing.avg_hr),
    max_hr = coalesce(excluded.max_hr, existing.max_hr),
    imported_at = now();
  get diagnostics workout_count = row_count;
  return jsonb_build_object('days', day_count, 'workouts', workout_count);
end;
$$;
revoke all on function public.import_garmin_export(jsonb, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.import_garmin_export(jsonb, jsonb, text, uuid) to authenticated;

-- Scoped deletion: removes only the caller's imported Garmin measurements.
create function public.delete_garmin_data(expected_user_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or expected_user_id is distinct from auth.uid() then raise exception 'Sign in required; account must match preview' using errcode = '42501'; end if;
  delete from public.garmin_workouts where user_id = auth.uid();
  delete from public.garmin_daily where user_id = auth.uid();
end;
$$;
revoke all on function public.delete_garmin_data(uuid) from public, anon, authenticated;
grant execute on function public.delete_garmin_data(uuid) to authenticated;

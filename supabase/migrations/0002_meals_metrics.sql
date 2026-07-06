-- Vitae — Meals & daily metrics schema

create table if not exists meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  kcal integer not null default 0,
  protein integer not null default 0,
  carbs integer not null default 0,
  fat integer not null default 0,
  confidence numeric,
  eaten_on date not null default current_date,
  eaten_at text not null default to_char(now(), 'HH24:MI'),
  created_at timestamptz not null default now()
);

create table if not exists daily_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null default current_date,
  water_l numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, day)
);

alter table meals enable row level security;
alter table daily_metrics enable row level security;

create policy "own meals" on meals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own daily_metrics" on daily_metrics for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

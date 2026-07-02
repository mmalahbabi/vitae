-- Vitae — Protocols & Bloodwork schema
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).

create table if not exists protocols (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('peptide','supplement')),
  name text not null,
  dose numeric not null,
  unit text not null,
  time text not null,
  slot text not null check (slot in ('AM','PM')),
  days text[] not null default '{}',
  purpose text,
  duration_days integer,
  start_date date not null default current_date,
  end_date date,
  color text not null default '#0E6E66',
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now()
);

create table if not exists protocol_logs (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid not null references protocols(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  taken_on date not null,
  created_at timestamptz not null default now(),
  unique (protocol_id, taken_on)
);

create table if not exists blood_markers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  panel text not null,
  marker_key text not null,
  value numeric not null,
  unit text not null,
  range_low numeric not null default 0,
  range_high numeric,
  taken_on date not null default current_date,
  note text,
  protocol_link text,
  created_at timestamptz not null default now(),
  unique (user_id, marker_key, taken_on)
);

alter table protocols enable row level security;
alter table protocol_logs enable row level security;
alter table blood_markers enable row level security;

create policy "own protocols" on protocols for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own protocol_logs" on protocol_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own blood_markers" on blood_markers for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

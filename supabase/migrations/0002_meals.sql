-- Vitae — Nutrition (meals) schema
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).
-- Meals used to live only in local React state (lost on refresh); this gives
-- them real persistence so a meal logged from a photo can be corrected later,
-- not just during the initial confirm-before-save review.

create table if not exists meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  kcal numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  confidence numeric,
  cooking_method text,
  quantity numeric not null default 1,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table meals enable row level security;

create policy "own meals" on meals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

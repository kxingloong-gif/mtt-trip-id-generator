-- =====================================================================
-- MTT Opportunity ID Generator - Database Setup
-- =====================================================================
-- Run this entire file once in Supabase: Project -> SQL Editor -> New
-- query -> paste this whole file -> Run.
--
-- It is safe to re-run: most statements use IF NOT EXISTS / OR REPLACE.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PROFILES
-- One row per application user, linked to Supabase Auth's own user table.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'consultant' check (role in ('consultant', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Automatically create a profile row whenever an admin creates a new
-- login in Supabase Authentication. New users start as 'consultant'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'consultant',
    true
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: is the currently logged-in user an active admin?
-- SECURITY DEFINER lets this function read profiles even though the
-- calling user's own RLS policy would not otherwise allow it, which
-- avoids infinite-recursion problems in the policies below.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active = true
  );
$$;

-- ---------------------------------------------------------------------
-- 2. SEQUENCE COUNTER (one row per calendar year)
-- Never exposed to the browser. Only the generate_opportunity_id()
-- function below is allowed to touch it.
-- ---------------------------------------------------------------------
create table if not exists public.opportunity_sequences (
  sequence_year int primary key,
  last_number int not null default 0
);

-- ---------------------------------------------------------------------
-- 3. OPPORTUNITY ID REGISTER
-- ---------------------------------------------------------------------
create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  opportunity_id text not null unique,
  sequence_year int not null,
  sequence_number int not null,
  original_description text not null,
  full_odoo_name text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  status text not null default 'Active' check (status in ('Active', 'Void')),
  void_reason text,
  voided_by uuid references public.profiles(id),
  voided_at timestamptz,
  unique (sequence_year, sequence_number)
);

create index if not exists opportunities_created_at_idx
  on public.opportunities (created_at desc);

-- ---------------------------------------------------------------------
-- 4. GENERATE OPPORTUNITY ID (concurrency-safe RPC function)
--
-- How the numbering stays safe when two people click "Generate" at the
-- same instant: the INSERT ... ON CONFLICT ... DO UPDATE statement
-- below is a single atomic Postgres statement. Postgres takes a row
-- lock on the year's counter row for the duration of that statement,
-- so if two requests arrive at the same moment, Postgres processes
-- them one after another and each gets a distinct, sequential number.
-- The UNIQUE constraints on opportunity_id and (sequence_year,
-- sequence_number) are a second safety net against duplicates.
--
-- SECURITY DEFINER means this function runs with elevated database
-- privilege, so it can write to opportunity_sequences and
-- opportunities even though ordinary logged-in users have no direct
-- write access to those tables (see the RLS policies further down).
-- This is the ONLY path by which a new Opportunity ID can be created.
-- ---------------------------------------------------------------------
create or replace function public.generate_opportunity_id(p_description text)
returns public.opportunities
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int;
  v_yy text;
  v_seq int;
  v_opportunity_id text;
  v_row public.opportunities;
  v_active boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select active into v_active from public.profiles where id = auth.uid();
  if v_active is distinct from true then
    raise exception 'User account is not active';
  end if;

  if p_description is null or length(trim(p_description)) = 0 then
    raise exception 'Opportunity description is required';
  end if;

  v_year := extract(year from now())::int;
  v_yy := to_char(now(), 'YY');

  insert into public.opportunity_sequences (sequence_year, last_number)
  values (v_year, 1)
  on conflict (sequence_year)
  do update set last_number = public.opportunity_sequences.last_number + 1
  returning last_number into v_seq;

  v_opportunity_id := 'MTT' || v_yy || '-' || lpad(v_seq::text, 6, '0');

  insert into public.opportunities (
    opportunity_id, sequence_year, sequence_number,
    original_description, full_odoo_name, created_by
  ) values (
    v_opportunity_id, v_year, v_seq,
    trim(p_description), v_opportunity_id || ' | ' || trim(p_description),
    auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. VOID OPPORTUNITY (admin-only RPC function)
-- Same SECURITY DEFINER pattern: this is the ONLY path by which a
-- record's status can change. It never deletes anything.
-- ---------------------------------------------------------------------
create or replace function public.void_opportunity(p_opportunity_id text, p_reason text)
returns public.opportunities
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.opportunities;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can void an Opportunity ID';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A void reason is required';
  end if;

  update public.opportunities
  set status = 'Void',
      void_reason = trim(p_reason),
      voided_by = auth.uid(),
      voided_at = now()
  where opportunity_id = p_opportunity_id
    and status = 'Active'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Record not found or already void';
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_sequences enable row level security;

-- profiles: you can see your own row; admins can see everyone's.
-- There is no INSERT/UPDATE/DELETE policy for ordinary users -
-- profile rows are created only by the handle_new_user trigger.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select
  using (id = auth.uid() or public.is_admin());

-- opportunities: any logged-in user may read every record (the
-- register is shared across all consultants and admins).
-- Deliberately no INSERT, UPDATE or DELETE policy exists for any role
-- here - that makes the table's rows immutable to direct client
-- access. Records can only be created via generate_opportunity_id()
-- and only be voided via void_opportunity(), both SECURITY DEFINER
-- functions that bypass RLS and enforce their own rules above.
drop policy if exists opportunities_select on public.opportunities;
create policy opportunities_select on public.opportunities
  for select
  using (auth.uid() is not null);

-- opportunity_sequences: no policies at all. No one - consultant or
-- admin - can read or write this table directly from the browser.

-- ---------------------------------------------------------------------
-- 7. FUNCTION EXECUTE PERMISSIONS
-- Only logged-in ("authenticated") users may call these functions.
-- Logged-out ("anon") visitors are explicitly blocked.
-- ---------------------------------------------------------------------
revoke execute on function public.generate_opportunity_id(text) from public, anon;
grant execute on function public.generate_opportunity_id(text) to authenticated;

revoke execute on function public.void_opportunity(text, text) from public, anon;
grant execute on function public.void_opportunity(text, text) to authenticated;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
-- =====================================================================
-- Expected result after running this file:
--   - Tables profiles, opportunity_sequences, opportunities exist.
--   - Functions is_admin, generate_opportunity_id, void_opportunity exist.
--   - "Success. No rows returned" is shown in the SQL Editor.
-- =====================================================================

-- tars: anonymous orchestration-telemetry schema.
--
-- Privacy model:
--   * A contributor is a 1:1 opaque mapping from an auth.users row. Contributions key
--     ONLY on the opaque contributor id; the GitHub identity never leaves auth.users.
--   * RLS is deny-by-default. A contributor may insert/delete their own contributions
--     and read their own contributor row — but there is NO select policy on
--     tars_contributions, so no client can ever read the training corpus. Export for
--     model training is a service-role operation only.
--   * Re-identification (contributor -> GitHub) is possible only server-side with the
--     service role, and is forbidden to every client by RLS.

create extension if not exists pgcrypto;

create table if not exists public.tars_contributors (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.tars_contributions (
  id             uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references public.tars_contributors (id) on delete cascade,
  surface        text not null check (surface in ('claude', 'codex', 'cursor', 'manual')),
  tars_version   text not null,
  schema_version int  not null default 1,
  framing        jsonb not null,
  approach       jsonb not null,
  positive       jsonb not null,
  duration_bucket text not null check (duration_bucket in ('<5m', '5-30m', '30-120m', '>120m')),
  created_at     timestamptz not null default now()
);

create index if not exists tars_contributions_surface_idx on public.tars_contributions (surface);
create index if not exists tars_contributions_contributor_idx on public.tars_contributions (contributor_id);

alter table public.tars_contributors  enable row level security;
alter table public.tars_contributions enable row level security;

-- A contributor can see only their own contributor row.
drop policy if exists tars_contributors_self_read on public.tars_contributors;
create policy tars_contributors_self_read on public.tars_contributors
  for select to authenticated
  using (user_id = auth.uid());

-- A contributor may insert only rows attributed to their own opaque id.
drop policy if exists tars_contrib_insert_own on public.tars_contributions;
create policy tars_contrib_insert_own on public.tars_contributions
  for insert to authenticated
  with check (
    contributor_id in (select id from public.tars_contributors where user_id = auth.uid())
  );

-- A contributor may delete only their own rows (powers `tars wipe --remote`).
drop policy if exists tars_contrib_delete_own on public.tars_contributions;
create policy tars_contrib_delete_own on public.tars_contributions
  for delete to authenticated
  using (
    contributor_id in (select id from public.tars_contributors where user_id = auth.uid())
  );

-- NOTE: intentionally no SELECT policy on tars_contributions. Clients can never read
-- the corpus; only the service role (training/export jobs) can.

-- Mint or fetch the caller's opaque contributor id. Called by `tars signup`.
create or replace function public.tars_get_or_create_contributor()
  returns uuid
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  cid uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.tars_contributors (user_id)
    values (auth.uid())
    on conflict (user_id) do nothing;
  select id into cid from public.tars_contributors where user_id = auth.uid();
  return cid;
end;
$$;

-- Purge all of the caller's contributions. Called by `tars wipe --remote`.
create or replace function public.tars_delete_my_contributions()
  returns int
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  n int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from public.tars_contributions
    where contributor_id in (select id from public.tars_contributors where user_id = auth.uid());
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.tars_get_or_create_contributor() to authenticated;
grant execute on function public.tars_delete_my_contributions() to authenticated;

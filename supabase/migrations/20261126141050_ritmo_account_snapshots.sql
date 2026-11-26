-- Supabase Free: owner-only snapshots, optimistic concurrency, no paid features.
create table if not exists public.ritmo_snapshots (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision bigint not null check (revision > 0),
 payload jsonb not null check (coalesce(jsonb_typeof(payload) = 'object' and payload->>'kind' = 'ritmoBackup' and payload->>'schemaVersion' = '1', false)),
 updated_at timestamptz not null default now(),
 constraint ritmo_snapshot_size check (octet_length(payload::text) <= 10000000)
);
alter table public.ritmo_snapshots enable row level security;
revoke all on public.ritmo_snapshots from anon, authenticated;
grant select on public.ritmo_snapshots to authenticated;
create policy "Owners read their snapshots" on public.ritmo_snapshots for select to authenticated using ((select auth.uid()) = user_id);
-- All writes go through this compare-and-swap function. Caller cannot supply an owner.
create schema if not exists ritmo_private;
revoke all on schema ritmo_private from public, anon;
grant usage on schema ritmo_private to authenticated;
create or replace function ritmo_private.save_snapshot(expected_revision bigint, next_payload jsonb)
returns setof public.ritmo_snapshots
language plpgsql security definer set search_path = '' as $$
declare owner uuid := auth.uid(); saved public.ritmo_snapshots;
begin
 if owner is null then raise exception 'authentication required' using errcode='42501'; end if;
 if expected_revision < 0 or expected_revision is null then raise exception 'invalid revision'; end if;
 if expected_revision = 0 then
   insert into public.ritmo_snapshots(user_id,revision,payload) values(owner,1,next_payload)
   on conflict (user_id) do nothing returning * into saved;
 else
   update public.ritmo_snapshots set payload=next_payload,revision=revision+1,updated_at=now()
   where user_id=owner and revision=expected_revision returning * into saved;
 end if;
 if saved.user_id is null then raise exception 'snapshot conflict' using errcode='40001'; end if;
 return next saved;
end;
$$;
revoke all on function ritmo_private.save_snapshot(bigint,jsonb) from public, anon;
grant execute on function ritmo_private.save_snapshot(bigint,jsonb) to authenticated;
create or replace function public.ritmo_save_snapshot(expected_revision bigint, next_payload jsonb)
returns setof public.ritmo_snapshots
language sql security invoker set search_path = '' as $wrapper$
 select * from ritmo_private.save_snapshot(expected_revision,next_payload);
$wrapper$;
revoke all on function public.ritmo_save_snapshot(bigint,jsonb) from public, anon;
grant execute on function public.ritmo_save_snapshot(bigint,jsonb) to authenticated;

create table public.ritmo_privacy_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 kind text not null check(kind in ('access','correction','information','deletion')),
 message text not null check(char_length(message) between 10 and 2000),
 status text not null default 'pending' check(status in ('pending','answered')),
 response text not null default '' check(char_length(response)<=4000),
 created_at timestamptz not null default now(),
 answered_at timestamptz
);
create index ritmo_privacy_requests_owner_created on public.ritmo_privacy_requests(user_id,created_at desc);
alter table public.ritmo_privacy_requests enable row level security;
revoke all on public.ritmo_privacy_requests from public,anon,authenticated;
grant select on public.ritmo_privacy_requests to authenticated;
grant insert(id,kind,message) on public.ritmo_privacy_requests to authenticated;
grant all on public.ritmo_privacy_requests to service_role;
create policy "Read own privacy requests" on public.ritmo_privacy_requests for select to authenticated using((select auth.uid())=user_id);
create policy "Submit own privacy request" on public.ritmo_privacy_requests for insert to authenticated with check((select auth.uid())=user_id and status='pending' and response='' and answered_at is null);
create function ritmo_private.limit_privacy_requests() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
 if (select count(*) from public.ritmo_privacy_requests where user_id=new.user_id and created_at>now()-interval '24 hours')>=5 then
  raise exception 'Limite de 5 solicitações por dia. Acompanhe os protocolos já enviados.' using errcode='P0001';
 end if;
 return new;
end;
$$;
revoke all on function ritmo_private.limit_privacy_requests() from public,anon,authenticated;
create trigger limit_privacy_requests before insert on public.ritmo_privacy_requests for each row execute function ritmo_private.limit_privacy_requests();
-- Minimal restore-suppression ledger. No email, name, health notes or raw user ID.
create table public.ritmo_erasure_log (
 subject_hash text primary key check(subject_hash ~ '^[a-f0-9]{64}$'),
 receipt uuid not null default gen_random_uuid(),
 requested_at timestamptz not null default now(),
 completed_at timestamptz
);
alter table public.ritmo_erasure_log enable row level security;
revoke all on public.ritmo_erasure_log from public,anon,authenticated;
grant all on public.ritmo_erasure_log to service_role;

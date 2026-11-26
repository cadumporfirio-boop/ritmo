-- Run in the Supabase SQL editor AFTER the migration. Rolls back all fixtures.
begin;
insert into auth.users(id,email) values
 ('10000000-0000-4000-8000-000000000001','ritmo-rls-a@example.invalid'),
 ('10000000-0000-4000-8000-000000000002','ritmo-rls-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select * from public.ritmo_save_snapshot(0,'{"kind":"ritmoBackup","schemaVersion":1}'::jsonb);
do $$ begin
 if (select count(*) from public.ritmo_snapshots) <> 1 then raise exception 'owner cannot read own row'; end if;
 begin
  perform public.ritmo_save_snapshot(0,'{"kind":"ritmoBackup","schemaVersion":1}'::jsonb);
  raise exception 'stale write accepted';
 exception when serialization_failure then null;
 end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin
 if exists(select 1 from public.ritmo_snapshots) then raise exception 'another owner can read private data'; end if;
 begin
  update public.ritmo_snapshots set revision=99;
  raise exception 'direct write allowed';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.ritmo_save_snapshot(1,'{"kind":"ritmoBackup","schemaVersion":1}'::jsonb);
  raise exception 'another owner overwrote row';
 exception when serialization_failure then null;
 end;
end $$;
set local role anon;
do $$ begin
 begin
  perform * from public.ritmo_snapshots;
  raise exception 'anonymous read allowed';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.ritmo_save_snapshot(0,'{}'::jsonb);
  raise exception 'anonymous write allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;

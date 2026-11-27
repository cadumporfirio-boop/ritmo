-- Disposable users only. The entire test is rolled back.
begin;
select set_config('ritmo.test.owner',gen_random_uuid()::text,true);
select set_config('ritmo.test.other',gen_random_uuid()::text,true);
insert into auth.users(id,email) values(current_setting('ritmo.test.owner')::uuid,'privacy-owner-'||current_setting('ritmo.test.owner')||'@example.invalid'),(current_setting('ritmo.test.other')::uuid,'privacy-other-'||current_setting('ritmo.test.other')||'@example.invalid');
insert into public.ritmo_privacy_requests(user_id,kind,message) values(current_setting('ritmo.test.other')::uuid,'access','Solicitação de outra conta fictícia.');
select set_config('request.jwt.claims',json_build_object('sub',current_setting('ritmo.test.owner'),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.ritmo_privacy_requests)<>0 then raise exception 'Owner isolation failed'; end if;
 insert into public.ritmo_privacy_requests(kind,message) values('access','Minha solicitação de acesso de teste.');
 if (select count(*) from public.ritmo_privacy_requests)<>1 then raise exception 'Own request not visible'; end if;
 begin
  update public.ritmo_privacy_requests set response='Resposta falsificada';
  raise exception 'Client may forge responses';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.ritmo_privacy_requests(user_id,kind,message) values(current_setting('ritmo.test.other')::uuid,'access','Tentativa de escolher outra pessoa.');
  raise exception 'Client may choose owner';
 exception when insufficient_privilege then null; end;
 begin
  perform * from public.ritmo_erasure_log;
  raise exception 'Client may read deletion ledger';
 exception when insufficient_privilege then null; end;
 for i in 1..4 loop insert into public.ritmo_privacy_requests(kind,message) values('information','Pedido fictício para testar limite diário.');end loop;
 begin
  insert into public.ritmo_privacy_requests(kind,message) values('information','Este pedido deve exceder o limite diário.');
  raise exception 'Rate limit failed';
 exception when raise_exception then if sqlerrm not like 'Limite de 5%' then raise;end if; end;
end; $$;
reset role;
delete from auth.users where id=current_setting('ritmo.test.owner')::uuid;
do $$begin if exists(select 1 from public.ritmo_privacy_requests where user_id=current_setting('ritmo.test.owner')::uuid) then raise exception 'Cascade deletion failed';end if;end;$$;
rollback;

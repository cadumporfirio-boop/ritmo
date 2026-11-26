-- Postgres executes this event trigger; it is not a client API.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

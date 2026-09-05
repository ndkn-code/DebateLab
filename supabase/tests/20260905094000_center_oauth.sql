-- Contract checks for the OAuth vault migration. Run after the center migrations
-- in an isolated database with the normal center fixture helpers.
begin;
do $$
begin
  if to_regclass('private.center_oauth_intents') is null then raise exception 'OAuth intent table missing'; end if;
  if to_regprocedure('public.center_oauth_begin(uuid,uuid,text,text,text,text[])') is null then raise exception 'center_oauth_begin missing'; end if;
  if to_regprocedure('public.center_oauth_consume(text)') is null then raise exception 'center_oauth_consume missing'; end if;
  if to_regprocedure('public.center_store_credentials(uuid,uuid,text,text,text[],text)') is null then raise exception 'center_store_credentials missing'; end if;
  if to_regprocedure('public.center_load_credentials(uuid)') is null then raise exception 'center_load_credentials missing'; end if;
  if to_regprocedure('public.center_refresh_credentials(uuid,text,text,timestamptz)') is null then raise exception 'center_refresh_credentials missing'; end if;
  if to_regprocedure('public.center_mark_reconnect(uuid)') is null then raise exception 'center_mark_reconnect missing'; end if;
end $$;
rollback;

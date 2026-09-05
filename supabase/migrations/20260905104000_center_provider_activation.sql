begin;
create unique index center_zbs_webhook_replay on public.center_events(subject_id,(payload->>'providerEventKey')) where kind='provider.zbs_receipt';
create table private.center_token_refresh_leases(connection_id uuid primary key references public.center_connections(id), token uuid not null, expires_at timestamptz not null);
revoke all on private.center_token_refresh_leases from public,anon,authenticated;
grant all on private.center_token_refresh_leases to service_role;
create function public.center_activate_provider(p_club_id uuid,p_actor_id uuid,p_provider text,p_external_id text,p_label text,p_ciphertext text,p_key_name text,p_status text) returns uuid language plpgsql security definer set search_path=public,private as $$
declare cid uuid;
begin
 if auth.role() is distinct from 'service_role' or not coalesce(private.organization_can_admin(p_club_id,p_actor_id),false) then raise exception 'Forbidden'; end if;
 if p_provider not in ('zbs','zalopay') or p_status not in ('sandbox','connected') or (p_provider='zbs' and p_status='sandbox') or length(coalesce(p_external_id,'')) not between 1 and 200 or length(coalesce(p_ciphertext,''))<20 or length(coalesce(p_key_name,''))<20 then raise exception 'Invalid provider activation'; end if;
 select id into cid from public.center_connections where club_id=p_club_id and provider=p_provider for update;
 if cid is null then raise exception 'Prepare this connection in the center workspace first'; end if;
 insert into private.center_credentials(connection_id,ciphertext,key_name) values(cid,p_ciphertext,p_key_name) on conflict(connection_id) do update set ciphertext=excluded.ciphertext,key_name=excluded.key_name,updated_at=now();
 update public.center_connections set status=p_status,external_account_id=p_external_id,account_label=p_label,connected_by=p_actor_id,updated_at=now(),revision=revision+1 where id=cid;
 delete from private.center_token_refresh_leases where connection_id=cid;
 insert into public.center_communication_policies(club_id,template_key) select p_club_id,x from unnest(array['trial_confirmation','trial_reminder','class_rescheduled','progress_summary','renewal_reminder'])x on conflict do nothing;
 return cid;
end $$;
create function public.center_claim_token_refresh(p_connection_id uuid,p_expected_updated_at timestamptz) returns uuid language plpgsql security definer set search_path=public,private as $$
declare tok uuid:=gen_random_uuid(); c public.center_connections;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
 select * into c from public.center_connections where id=p_connection_id and provider='zbs' and status='connected' for update;
 if not found or not exists(select 1 from private.center_credentials where connection_id=c.id and updated_at=p_expected_updated_at) then return null; end if;
 if exists(select 1 from private.center_token_refresh_leases where connection_id=c.id) then
  if exists(select 1 from private.center_token_refresh_leases where connection_id=c.id and expires_at<now()) then update public.center_connections set status='reconnect_required',last_error='Token refresh outcome unknown' where id=c.id; end if;
  return null;
 end if;
 insert into private.center_token_refresh_leases values(c.id,tok,now()+interval '60 seconds'); return tok;
end $$;
create function public.center_finish_token_refresh(p_connection_id uuid,p_token uuid,p_ciphertext text,p_key_name text) returns void language plpgsql security definer set search_path=public,private as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
 perform 1 from public.center_connections where id=p_connection_id and status='connected' for update;
 if not found or not exists(select 1 from private.center_token_refresh_leases where connection_id=p_connection_id and token=p_token and expires_at>now()) then raise exception 'Refresh lease expired'; end if;
 update private.center_credentials set ciphertext=p_ciphertext,key_name=p_key_name,updated_at=now() where connection_id=p_connection_id;
 delete from private.center_token_refresh_leases where connection_id=p_connection_id and token=p_token;
end $$;
revoke all on function public.center_activate_provider(uuid,uuid,text,text,text,text,text,text),public.center_claim_token_refresh(uuid,timestamptz),public.center_finish_token_refresh(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.center_activate_provider(uuid,uuid,text,text,text,text,text,text),public.center_claim_token_refresh(uuid,timestamptz),public.center_finish_token_refresh(uuid,uuid,text,text) to service_role;
commit;

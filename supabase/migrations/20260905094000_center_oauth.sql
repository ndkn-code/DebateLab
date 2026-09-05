begin;

create table private.center_oauth_intents (
 id uuid primary key default gen_random_uuid(), state_hash text not null unique,
 club_id uuid not null references public.clubs(id), actor_id uuid not null references public.profiles(id),
 connection_id uuid not null references public.center_connections(id), ciphertext text not null, key_name text not null,
 scopes text[] not null, expires_at timestamptz not null default (now() + interval '10 minutes'), consumed_at timestamptz
);
revoke all on private.center_oauth_intents from public, anon, authenticated;
grant all on private.center_oauth_intents to service_role;

create or replace function public.center_oauth_begin(p_club_id uuid,p_actor_id uuid,p_state_hash text,p_ciphertext text,p_key_name text,p_scopes text[])
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare connection_id uuid;
begin
 if not coalesce(private.organization_can_admin(p_club_id,p_actor_id),false) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_state_hash is null or length(p_state_hash) <> 64 or p_ciphertext is null or p_key_name is null or p_scopes is null or cardinality(p_scopes) < 1 then raise exception 'Invalid OAuth intent'; end if;
 select id into connection_id from public.center_connections where club_id=p_club_id and provider='google' for update;
 if connection_id is null then insert into public.center_connections(club_id,provider,status) values(p_club_id,'google','pending') returning id into connection_id;
 else update public.center_connections set status=case when status='connected' then status else 'pending' end,updated_at=now() where id=connection_id; end if;
 insert into private.center_oauth_intents(state_hash,club_id,actor_id,connection_id,ciphertext,key_name,scopes) values(p_state_hash,p_club_id,p_actor_id,connection_id,p_ciphertext,p_key_name,p_scopes);
 return jsonb_build_object('connectionId',connection_id);
end $$;

create or replace function public.center_oauth_consume(p_state_hash text)
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare intent private.center_oauth_intents;
begin
 select * into intent from private.center_oauth_intents where state_hash=p_state_hash for update;
 if not found or intent.consumed_at is not null or intent.expires_at <= now() then raise exception 'OAuth intent is invalid or expired' using errcode='42501'; end if;
 if not coalesce(private.organization_can_admin(intent.club_id,intent.actor_id),false) then raise exception 'Forbidden' using errcode='42501'; end if;
 update private.center_oauth_intents set consumed_at=now() where id=intent.id;
 return jsonb_build_object('clubId',intent.club_id,'actorId',intent.actor_id,'connectionId',intent.connection_id,'ciphertext',intent.ciphertext,'keyName',intent.key_name,'scopes',intent.scopes);
end $$;

revoke all on function public.center_oauth_begin(uuid,uuid,text,text,text,text[]) from public,anon,authenticated;
revoke all on function public.center_oauth_consume(text) from public,anon,authenticated;
grant execute on function public.center_oauth_begin(uuid,uuid,text,text,text,text[]) to service_role;
grant execute on function public.center_oauth_consume(text) to service_role;

create or replace function public.center_store_credentials(p_connection_id uuid,p_actor_id uuid,p_ciphertext text,p_key_name text,p_scopes text[],p_account_label text)
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare c public.center_connections; v private.center_credentials;
begin
 select * into c from public.center_connections where id=p_connection_id and provider='google' for update;
 if not found or not coalesce(private.organization_can_admin(c.club_id,p_actor_id),false) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_ciphertext is null or p_key_name is null or p_scopes is null or cardinality(p_scopes)<1 then raise exception 'Invalid credentials'; end if;
 insert into private.center_credentials(connection_id,ciphertext,key_name) values(c.id,p_ciphertext,p_key_name)
 on conflict(connection_id) do update set ciphertext=excluded.ciphertext,key_name=excluded.key_name,updated_at=now();
 update public.center_connections set status='connected',scopes=p_scopes,account_label=p_account_label,connected_by=p_actor_id,updated_at=now() where id=c.id;
 select * into v from private.center_credentials where connection_id=c.id;
 return jsonb_build_object('connectionId',c.id,'clubId',c.club_id,'provider',c.provider,'status','connected','ciphertext',v.ciphertext,'keyName',v.key_name,'updatedAt',v.updated_at,'scopes',p_scopes,'externalAccountId',c.external_account_id);
end $$;

create or replace function public.center_load_credentials(p_connection_id uuid)
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare c public.center_connections; v private.center_credentials;
begin
 select * into c from public.center_connections where id=p_connection_id and provider in ('google','zbs','zalopay');
 if not found or c.status not in ('connected','sandbox') then raise exception 'Connection unavailable'; end if;
 select * into v from private.center_credentials where connection_id=c.id;
 if not found then raise exception 'Credentials unavailable'; end if;
 return jsonb_build_object('connectionId',c.id,'clubId',c.club_id,'provider',c.provider,'status',c.status,'ciphertext',v.ciphertext,'keyName',v.key_name,'updatedAt',v.updated_at,'scopes',c.scopes,'externalAccountId',c.external_account_id);
end $$;

create or replace function public.center_refresh_credentials(p_connection_id uuid,p_ciphertext text,p_key_name text,p_expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare c public.center_connections; v private.center_credentials; changed boolean;
begin
 select * into c from public.center_connections where id=p_connection_id and provider in ('google','zbs','zalopay') for update;
 if not found or c.status not in ('connected','sandbox') then raise exception 'Connection unavailable'; end if;
 select * into v from private.center_credentials where connection_id=c.id for update;
 if not found then raise exception 'Credentials unavailable'; end if;
 if p_expected_updated_at is distinct from v.updated_at then
  return jsonb_build_object('connectionId',c.id,'clubId',c.club_id,'provider',c.provider,'status',c.status,'ciphertext',v.ciphertext,'keyName',v.key_name,'updatedAt',v.updated_at,'scopes',c.scopes,'externalAccountId',c.external_account_id);
 end if;
 update private.center_credentials set ciphertext=p_ciphertext,key_name=p_key_name,updated_at=now() where connection_id=c.id returning * into v;
 return jsonb_build_object('connectionId',c.id,'clubId',c.club_id,'provider',c.provider,'status',c.status,'ciphertext',v.ciphertext,'keyName',v.key_name,'updatedAt',v.updated_at,'scopes',c.scopes,'externalAccountId',c.external_account_id);
end $$;

create or replace function public.center_mark_reconnect(p_connection_id uuid)
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare c public.center_connections;
begin
 update public.center_connections set status='reconnect_required',updated_at=now() where id=p_connection_id and provider in ('google','zbs','zalopay') and status in ('connected','sandbox') returning * into c;
 if not found then raise exception 'Connection unavailable'; end if;
 return jsonb_build_object('connectionId',c.id,'clubId',c.club_id,'provider',c.provider,'status',c.status,'scopes',c.scopes,'externalAccountId',c.external_account_id);
end $$;

revoke all on function public.center_store_credentials(uuid,uuid,text,text,text[],text),public.center_load_credentials(uuid),public.center_refresh_credentials(uuid,text,text,timestamptz),public.center_mark_reconnect(uuid) from public,anon,authenticated;
grant execute on function public.center_store_credentials(uuid,uuid,text,text,text[],text),public.center_load_credentials(uuid),public.center_refresh_credentials(uuid,text,text,timestamptz),public.center_mark_reconnect(uuid) to service_role;
commit;

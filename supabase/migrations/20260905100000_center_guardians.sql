begin;

create table if not exists private.center_guardian_invites (
  id uuid primary key default gen_random_uuid(), guardian_id uuid not null references public.center_guardians(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade, student_record_id uuid not null references public.student_records(id) on delete cascade,
  idempotency_key text not null, token_hash text not null, expires_at timestamptz not null default (now()+interval '7 days'),
  revoked_at timestamptz, claimed_at timestamptz, created_at timestamptz not null default now(), unique(club_id,idempotency_key)
);
alter table private.center_guardian_invites enable row level security;
revoke all on private.center_guardian_invites from public, anon, authenticated;
grant all on private.center_guardian_invites to service_role;

create or replace function public.center_create_guardian_invite(p_club_id uuid,p_student_record_id uuid,p_full_name text,p_email text,p_phone text,p_key text)
returns jsonb language plpgsql security definer set search_path=public,private,extensions as $$
declare g public.center_guardians; i private.center_guardian_invites; raw text; normalized_email text;
begin
 if auth.uid() is null or not coalesce(private.organization_can_manage_people(p_club_id,auth.uid()),false) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_key is null or length(trim(p_key))<8 then raise exception 'Idempotency key required'; end if;
 select * into i from private.center_guardian_invites where club_id=p_club_id and idempotency_key=p_key;
 if found then return jsonb_build_object('guardianId',i.guardian_id,'inviteId',i.id,'alreadyCreated',true,'expiresAt',i.expires_at); end if;
 if not exists(select 1 from public.student_records where id=p_student_record_id and club_id=p_club_id) then raise exception 'Student not found'; end if;
 if nullif(trim(coalesce(p_full_name,'')),'') is null then raise exception 'Full name required'; end if;
 normalized_email:=nullif(lower(trim(p_email)),'');
 insert into public.center_guardians(club_id,full_name,email,phone) values(p_club_id,trim(p_full_name),normalized_email,nullif(trim(p_phone),'')) returning * into g;
 insert into public.center_guardian_students(guardian_id,student_record_id,club_id) values(g.id,p_student_record_id,p_club_id);
 raw:=replace(replace(encode(gen_random_bytes(32),'base64'),'+','-'),'/','_'); raw:=replace(raw,'=','');
 insert into private.center_guardian_invites(guardian_id,club_id,student_record_id,idempotency_key,token_hash) values(g.id,p_club_id,p_student_record_id,p_key,encode(digest(raw,'sha256'),'hex')) returning * into i;
 return jsonb_build_object('guardianId',g.id,'inviteId',i.id,'token',raw,'expiresAt',i.expires_at);
end $$;

create or replace function public.center_claim_guardian_invite(p_token text)
returns jsonb language plpgsql security definer set search_path=public,private,extensions as $$
declare i private.center_guardian_invites; g public.center_guardians; u auth.users;
begin
 if auth.uid() is null or p_token is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 select * into i from private.center_guardian_invites where token_hash=encode(digest(p_token,'sha256'),'hex') for update;
 if not found or i.revoked_at is not null or i.claimed_at is not null or i.expires_at<=now() then raise exception 'Invite is invalid or expired'; end if;
 select * into g from public.center_guardians where id=i.guardian_id for update;
 select * into u from auth.users where id=auth.uid();
 if g.email is not null then
   if u.email_confirmed_at is null or lower(u.email) <> lower(g.email) then raise exception 'Invite identity does not match'; end if;
 elsif g.phone is null or u.phone_confirmed_at is null or regexp_replace(coalesce(u.phone,''),'[^0-9]','','g') <> regexp_replace(g.phone,'[^0-9]','','g') then raise exception 'Invite identity does not match'; end if;
 if g.user_id is not null and g.user_id<>auth.uid() then raise exception 'Guardian already claimed'; end if;
 update public.center_guardians set user_id=auth.uid() where id=g.id;
 update public.center_guardian_students set verified_at=now(),verified_by=auth.uid() where guardian_id=g.id and student_record_id=i.student_record_id and revoked_at is null;
 update private.center_guardian_invites set claimed_at=now() where id=i.id;
 return jsonb_build_object('guardianId',g.id,'studentRecordId',i.student_record_id,'claimed',true);
end $$;

create or replace function public.center_revoke_guardian_link(p_club_id uuid,p_guardian_id uuid,p_student_record_id uuid)
returns jsonb language plpgsql security definer set search_path=public,private as $$
begin
 if auth.uid() is null or not coalesce(private.organization_can_manage_people(p_club_id,auth.uid()),false) then raise exception 'Forbidden' using errcode='42501'; end if;
 update public.center_guardian_students set revoked_at=now() where guardian_id=p_guardian_id and student_record_id=p_student_record_id and club_id=p_club_id;
 update private.center_guardian_invites set revoked_at=now() where guardian_id=p_guardian_id and student_record_id=p_student_record_id and club_id=p_club_id and revoked_at is null;
 return jsonb_build_object('revoked',true);
end $$;

create or replace function public.center_guardian_progress(p_student_record_id uuid)
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare s public.student_records; uid uuid:=auth.uid();
begin
 select sr.* into s from public.student_records sr join public.center_guardian_students gs on gs.student_record_id=sr.id and gs.club_id=sr.club_id and gs.verified_at is not null and gs.revoked_at is null join public.center_guardians g on g.id=gs.guardian_id and g.user_id=uid where sr.id=p_student_record_id;
 if not found then raise exception 'Forbidden' using errcode='42501'; end if;
 return jsonb_build_object('student',jsonb_build_object('name',s.full_name,'code',s.student_code),'classes',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',coalesce(c.title,c.code)) order by c.title) from public.student_record_enrollments e join public.classes c on c.id=e.class_id where e.student_record_id=s.id and e.status='active' and c.club_id=s.club_id),'[]'::jsonb),'trials',coalesce((select jsonb_agg(jsonb_build_object('classId',t.class_id,'startsAt',t.starts_at,'status',t.status) order by t.starts_at desc) from public.center_trials t where t.student_record_id=s.id and t.club_id=s.club_id),'[]'::jsonb),'attendance',case when s.user_id is null then jsonb_build_object('present',0,'late',0,'absent',0) else (select jsonb_build_object('present',count(*) filter(where r.status='present'),'late',count(*) filter(where r.status='late'),'absent',count(*) filter(where r.status='absent')) from public.class_attendance_records r join public.class_attendance_sessions sess on sess.id=r.session_id join public.classes c on c.id=sess.class_id where r.user_id=s.user_id and c.club_id=s.club_id and exists(select 1 from public.student_record_enrollments e where e.student_record_id=s.id and e.class_id=c.id and e.status='active')) end);
end $$;

create or replace function public.center_guardian_set_preferences(p_guardian_id uuid,p_student_record_id uuid,p_preferences jsonb)
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare prefs jsonb;
begin
 if auth.uid() is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 if p_preferences is null or jsonb_typeof(p_preferences)<>'object' or (p_preferences - 'classChanges' - 'progressSummary' - 'renewal') <> '{}'::jsonb then raise exception 'Invalid preferences'; end if;
 update public.center_guardian_students set preferences=jsonb_build_object('class_changes',coalesce((p_preferences->>'classChanges')::boolean,(preferences->>'class_changes')::boolean,false),'progress_summary',coalesce((p_preferences->>'progressSummary')::boolean,(preferences->>'progress_summary')::boolean,false),'renewal',coalesce((p_preferences->>'renewal')::boolean,(preferences->>'renewal')::boolean,false)) where guardian_id=p_guardian_id and student_record_id=p_student_record_id and verified_at is not null and revoked_at is null and exists(select 1 from public.center_guardians g where g.id=p_guardian_id and g.user_id=auth.uid()) returning preferences into prefs;
 if not found then raise exception 'Forbidden' using errcode='42501'; end if;
 return prefs;
end $$;

revoke all on function public.center_create_guardian_invite(uuid,uuid,text,text,text,text),public.center_claim_guardian_invite(text),public.center_revoke_guardian_link(uuid,uuid,uuid),public.center_guardian_progress(uuid),public.center_guardian_set_preferences(uuid,uuid,jsonb) from public,anon;
grant execute on function public.center_create_guardian_invite(uuid,uuid,text,text,text,text),public.center_claim_guardian_invite(text),public.center_revoke_guardian_link(uuid,uuid,uuid),public.center_guardian_progress(uuid),public.center_guardian_set_preferences(uuid,uuid,jsonb) to authenticated;
commit;

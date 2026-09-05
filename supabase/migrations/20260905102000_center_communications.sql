begin;
alter table public.center_event_receipts drop constraint if exists center_event_receipts_status_check;
alter table public.center_event_receipts add constraint center_event_receipts_status_check check(status in ('processing','uncertain','completed','failed','skipped'));
create unique index if not exists center_reminder_event_key_idx on public.center_events(club_id,kind,subject_id,(payload#>>'{input,reminderKey}')) where kind='trial.reminder';
create unique index if not exists center_renewal_event_key_idx on public.center_events(club_id,kind,subject_id,(payload#>>'{input,reminderKey}')) where kind='renewal.reminder';

create or replace function public.center_notification_context(p_event_id uuid) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare e public.center_events; input jsonb; p public.center_communication_policies; s public.student_records; c public.center_connections; result jsonb; preference text; tr public.center_trials; offer public.center_offers;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Not authorized' using errcode='42501'; end if;
 select * into e from public.center_events where id=p_event_id for update;
 if not found then return jsonb_build_object('allowed',false,'reason','event_not_found'); end if;
 input:=coalesce(e.payload->'input','{}'::jsonb); preference:=case input->>'templateKey' when 'class_rescheduled' then 'class_changes' when 'progress_summary' then 'progress_summary' when 'renewal_reminder' then 'renewal' else null end;
 select * into s from public.student_records where id=(input->>'studentRecordId')::uuid and club_id=e.club_id;
 if not found then return jsonb_build_object('allowed',false,'reason','student_not_found'); end if;
 if e.kind='trial.reminder' then
  select * into tr from public.center_trials where id=e.subject_id and club_id=e.club_id and student_record_id=s.id;
  if not found or tr.status<>'booked' or tr.starts_at<=now() or tr.starts_at is distinct from (input->>'startsAt')::timestamptz then return jsonb_build_object('allowed',false,'reason','stale_trial'); end if;
 elsif e.kind='renewal.reminder' then
  select * into offer from public.center_offers where id=e.subject_id and club_id=e.club_id and student_record_id=s.id;
  if not found or offer.status<>'active' or offer.ends_on<current_date or offer.ends_on is distinct from (input->>'endsAt')::date then return jsonb_build_object('allowed',false,'reason','stale_renewal'); end if;
 elsif input->>'templateKey'='trial_confirmation' and input->>'trialId' is not null then
  select * into tr from public.center_trials where id=(input->>'trialId')::uuid and club_id=e.club_id and student_record_id=s.id;
  if not found or tr.status<>'booked' or tr.starts_at<=now() then return jsonb_build_object('allowed',false,'reason','stale_trial'); end if;
  input:=input||jsonb_build_object('startsAt',tr.starts_at,'endsAt',tr.ends_at);
 end if;
 select * into c from public.center_connections where club_id=e.club_id and provider='zbs' and status='connected';
 if not found then return jsonb_build_object('allowed',false,'reason','zbs_not_connected'); end if;
 select * into p from public.center_communication_policies where club_id=e.club_id and template_key=input->>'templateKey' and approval_status='approved' and enabled;
 if not found then return jsonb_build_object('allowed',false,'reason','template_not_enabled'); end if;
 if (p.quiet_start <= p.quiet_end and extract(hour from (now() at time zone 'Asia/Ho_Chi_Minh')) between p.quiet_start and p.quiet_end) or (p.quiet_start > p.quiet_end and (extract(hour from (now() at time zone 'Asia/Ho_Chi_Minh')) >= p.quiet_start or extract(hour from (now() at time zone 'Asia/Ho_Chi_Minh')) < p.quiet_end)) then update public.center_events set available_at=now()+interval '1 hour' where id=e.id; return jsonb_build_object('allowed',false,'reason','deferred_quiet_hours'); end if;
 if (select count(*) from public.center_event_receipts r join public.center_events ce on ce.id=r.event_id where ce.club_id=e.club_id and r.consumer like 'zbs:%' and r.status in ('completed','processing','uncertain') and r.created_at >= (date_trunc('day',now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh')) >= p.daily_limit then update public.center_events set available_at=now()+interval '1 hour' where id=e.id; return jsonb_build_object('allowed',false,'reason','deferred_daily_limit'); end if;
 result:=jsonb_build_object('allowed',true,'eventId',e.id,'clubId',e.club_id,'connectionId',c.id,'templateId',p.provider_template_id,'templateKey',input->>'templateKey','templateData',jsonb_build_object('student_name',s.full_name,'student_code',s.student_code,'class_id',input->>'classId','starts_at',input->>'startsAt','ends_at',input->>'endsAt','link',input->>'link'),'recipients',coalesce((select jsonb_agg(jsonb_build_object('id',ch.id,'address',ch.address,'phone',ch.address,'kind','student')) from public.center_recipient_channels ch where ch.club_id=e.club_id and ch.student_record_id=s.id and ch.channel='zbs' and ch.consent_at is not null and ch.verified_at is not null and ch.revoked_at is null),'[]'::jsonb));
 if p.include_guardians and preference is not null then result:=jsonb_set(result,'{recipients}',(result->'recipients') || coalesce((select jsonb_agg(jsonb_build_object('id',ch.id,'address',ch.address,'phone',ch.address,'kind','guardian')) from public.center_recipient_channels ch join public.center_guardian_students gs on gs.guardian_id=ch.guardian_id and gs.student_record_id=s.id and gs.club_id=e.club_id and gs.verified_at is not null and gs.revoked_at is null join public.center_guardians g on g.id=gs.guardian_id where ch.club_id=e.club_id and ch.channel='zbs' and ch.consent_at is not null and ch.verified_at is not null and ch.revoked_at is null and coalesce((gs.preferences->>preference)::boolean,false)),'[]'::jsonb)); end if;
 return result;
end $$;

create or replace function public.center_reserve_delivery(p_event_id uuid,p_consumer text,p_detail jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public,private as $$
declare r public.center_event_receipts; delivery_context jsonb; organization_id uuid;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Not authorized' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_event_id::text||p_consumer,0));
 select * into r from public.center_event_receipts where event_id=p_event_id and consumer=p_consumer for update;
 if found then return jsonb_build_object('allowed',false,'reason',case r.status when 'completed' then 'already_completed' when 'processing' then 'delivery_unknown' when 'uncertain' then 'delivery_unknown' when 'failed' then 'delivery_failed' else 'skipped' end,'status',r.status); end if;
 select club_id into organization_id from public.center_events where id=p_event_id;
 if organization_id is null then return jsonb_build_object('allowed',false,'reason','event_not_found'); end if;
 -- Serialize the eligibility check and reservation across every event for this center.
 perform pg_advisory_xact_lock(hashtextextended('center-delivery:'||organization_id::text,0));
 delivery_context:=public.center_notification_context(p_event_id);
 if not coalesce((delivery_context->>'allowed')::boolean,false) then return delivery_context; end if;
 if not exists(select 1 from jsonb_array_elements(delivery_context->'recipients') recipient where p_consumer='zbs:'||(recipient->>'id')) then return jsonb_build_object('allowed',false,'reason','recipient_not_eligible'); end if;
 insert into public.center_event_receipts(event_id,consumer,status,detail) values(p_event_id,p_consumer,'processing',coalesce(p_detail,'{}'::jsonb)) returning * into r;
 return jsonb_build_object('allowed',true,'status',r.status,'consumer',r.consumer);
end $$;

create or replace function public.center_record_delivery(p_event_id uuid,p_consumer text,p_status text,p_provider_id text default null,p_detail jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public,private as $$
declare r public.center_event_receipts;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_status not in ('uncertain','completed','failed','skipped') then raise exception 'Invalid delivery status'; end if;
 update public.center_event_receipts set status=p_status,provider_id=p_provider_id,detail=coalesce(p_detail,'{}'::jsonb) where event_id=p_event_id and consumer=p_consumer and status='processing' returning * into r;
 if not found then raise exception 'Delivery reservation missing'; end if;
 return jsonb_build_object('eventId',r.event_id,'consumer',r.consumer,'status',r.status,'providerId',r.provider_id);
end $$;

create or replace function public.center_schedule_reminders() returns jsonb language plpgsql security definer set search_path=public,private as $$
declare t record; k text; made integer:=0;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Not authorized' using errcode='42501'; end if;
 for t in select tr.*,c.club_id from public.center_trials tr join public.classes c on c.id=tr.class_id where tr.status='booked' and ((tr.starts_at between now()+interval '23 hours' and now()+interval '25 hours') or (tr.starts_at between now()+interval '1 hour' and now()+interval '3 hours')) loop
   k:=case when t.starts_at<=now()+interval '3 hours' then '2h' else '24h' end;
   if exists(select 1 from public.center_communication_policies p join public.center_connections z on z.club_id=p.club_id and z.provider='zbs' and z.status='connected' where p.club_id=t.club_id and p.template_key='trial_reminder' and p.approval_status='approved' and p.enabled) then
     insert into public.center_events(club_id,kind,subject_id,payload,expires_at) values(t.club_id,'trial.reminder',t.id,jsonb_build_object('input',jsonb_build_object('templateKey','trial_reminder','studentRecordId',t.student_record_id,'classId',t.class_id,'startsAt',t.starts_at,'reminderKey',k||':'||t.starts_at::text)),t.starts_at) on conflict do nothing; if found then made:=made+1; end if;
   end if;
 end loop;
 for t in select o.* from public.center_offers o where o.status='active' and o.ends_on between current_date+14 and current_date+15 loop
   if exists(select 1 from public.center_communication_policies p join public.center_connections z on z.club_id=p.club_id and z.provider='zbs' and z.status='connected' where p.club_id=t.club_id and p.template_key='renewal_reminder' and p.approval_status='approved' and p.enabled) then
     insert into public.center_events(club_id,kind,subject_id,payload,expires_at) values(t.club_id,'renewal.reminder',t.id,jsonb_build_object('input',jsonb_build_object('templateKey','renewal_reminder','studentRecordId',t.student_record_id,'reminderKey','14d:'||t.ends_on::text,'endsAt',t.ends_on)),t.ends_on::timestamptz) on conflict do nothing; if found then made:=made+1; end if;
   end if;
 end loop;
 return jsonb_build_object('created',made);
end $$;

revoke all on function public.center_notification_context(uuid),public.center_reserve_delivery(uuid,text,jsonb),public.center_record_delivery(uuid,text,text,text,jsonb),public.center_schedule_reminders() from public,anon,authenticated;
grant execute on function public.center_notification_context(uuid),public.center_reserve_delivery(uuid,text,jsonb),public.center_record_delivery(uuid,text,text,text,jsonb),public.center_schedule_reminders() to service_role;
commit;

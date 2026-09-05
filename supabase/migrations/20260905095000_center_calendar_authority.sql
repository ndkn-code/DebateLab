begin;

-- Preserve the existing command entrypoint; shared and chat actions both pass through this wrapper.
alter function public.center_execute_command(uuid,text,jsonb,text) rename to center_execute_native_command;
revoke all on function public.center_execute_native_command(uuid,text,jsonb,text) from public,anon,authenticated;
create function public.center_execute_command(p_club_id uuid,p_kind text,p_input jsonb,p_idempotency_key text) returns jsonb language plpgsql security definer set search_path=public,private,extensions as $$
declare a uuid:=auth.uid(); s public.class_schedules; b public.center_resource_bindings; i public.center_calendar_items; old public.center_commands; h text; cid uuid:=gen_random_uuid(); receipt jsonb; st timestamptz; en timestamptz;
begin
 if p_kind<>'schedule.reschedule' then return public.center_execute_native_command(p_club_id,p_kind,p_input,p_idempotency_key); end if;
 if not coalesce(private.center_can_work(p_club_id,a),false) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_idempotency_key is null or length(p_idempotency_key) not between 8 and 200 or jsonb_typeof(p_input) is distinct from 'object' then raise exception 'Invalid command'; end if;
 h:=encode(digest(p_kind||p_input::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_club_id::text||a::text||p_idempotency_key,0));
 select * into old from public.center_commands where club_id=p_club_id and actor_id=a and idempotency_key=p_idempotency_key;
 if found then if old.input_hash<>h then raise exception 'Idempotency key reused with different input'; end if; return old.receipt; end if;
 select cs.* into s from public.class_schedules cs join public.classes c on c.id=cs.class_id where cs.id=(p_input->>'scheduleId')::uuid and c.club_id=p_club_id and private.organization_can_manage_class(c.id,a) for update of cs;
 if not found then raise exception 'Schedule not accessible' using errcode='42501'; end if;
 if s.updated_at is distinct from (p_input->>'expectedUpdatedAt')::timestamptz then raise exception 'Revision conflict' using errcode='40001'; end if;
 st:=(p_input->>'startAt')::timestamptz; en:=(p_input->>'endAt')::timestamptz;
 if st is null or en is null or st<=now() or en<=st or en-st>interval '8 hours' or (st at time zone s.timezone)::date<>(en at time zone s.timezone)::date then raise exception 'Invalid schedule range'; end if;
 select * into b from public.center_resource_bindings where club_id=p_club_id and class_id=s.class_id and kind='calendar' and state in ('active','conflict');
 if found then
  if b.state<>'active' then raise exception 'Resolve Calendar connection conflict first'; end if;
  select * into i from public.center_calendar_items where binding_id=b.id and schedule_id=s.id and status<>'cancelled';
  if not found or i.etag is null then raise exception 'Wait for Calendar synchronization'; end if;
  receipt:=jsonb_build_object('commandId',cid,'kind',p_kind,'targetId',s.id,'revision',null,'status','pending');
 else
  if coalesce(s.recurrence_rule->>'frequency','none')<>'none' then raise exception 'Select an occurrence in the teaching calendar for recurring native schedules'; end if;
  update public.class_schedules set start_date=(st at time zone s.timezone)::date,end_date=(en at time zone s.timezone)::date,start_time=(st at time zone s.timezone)::time,end_time=(en at time zone s.timezone)::time,updated_at=now() where id=s.id;
  receipt:=jsonb_build_object('commandId',cid,'kind',p_kind,'targetId',s.id,'revision',null,'status','completed');
 end if;
 insert into public.center_commands(id,club_id,actor_id,kind,idempotency_key,input_hash,receipt) values(cid,p_club_id,a,p_kind,p_idempotency_key,h,receipt);
 insert into public.center_events(club_id,command_id,kind,subject_id,payload) values(p_club_id,cid,case when b.id is null then 'schedule.rescheduled' else 'schedule.reschedule_requested' end,s.id,jsonb_build_object('actorId',a,'bindingId',b.id,'eventId',i.event_id,'etag',i.etag,'input',p_input));
 return receipt;
end $$;
revoke all on function public.center_execute_command(uuid,text,jsonb,text) from public,anon;
grant execute on function public.center_execute_command(uuid,text,jsonb,text) to authenticated;

-- Connected classes cannot silently fork into a second local calendar.
create function private.center_guard_calendar_authority() returns trigger language plpgsql security definer set search_path=public,private as $$
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and exists(select 1 from public.center_resource_bindings where class_id=coalesce(new.class_id,old.class_id) and kind='calendar' and state in ('active','conflict')) then
  if tg_op<>'UPDATE' or (to_jsonb(new)-'updated_at') is distinct from (to_jsonb(old)-'updated_at') then raise exception 'This class uses Google Calendar. Reschedule through the center workspace or Google Calendar.'; end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger center_calendar_authority before insert or update or delete on public.class_schedules for each row execute function private.center_guard_calendar_authority();

-- Project a complete, bounded occurrence window after all Google pages have been fetched.
-- Stable IDs preserve existing lesson/attendance foreign keys across full resynchronizations.
create function public.center_project_calendar(p_binding_id uuid,p_actor_id uuid,p_items jsonb,p_from timestamptz,p_until timestamptz) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare b public.center_resource_bindings; item jsonb; sid uuid; tid uuid; st timestamptz; en timestamptz; tz text; retained uuid[]:='{}'; status_value text; original uuid;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' then raise exception 'Forbidden'; end if;
 b:=private.center_google_binding(p_binding_id,p_actor_id);
 if b.kind<>'calendar' or b.class_id is null or p_until<=p_from or p_until-p_from>interval '500 days' or jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Invalid projection'; end if;
 for item in select * from jsonb_array_elements(p_items) loop
  sid:=md5(b.id::text||':'||(item->>'id'))::uuid;
  st:=nullif(item#>>'{start,dateTime}','')::timestamptz; en:=nullif(item#>>'{end,dateTime}','')::timestamptz;
  status_value:=coalesce(item->>'status','confirmed');
  tz:=coalesce(item#>>'{start,timeZone}','Asia/Ho_Chi_Minh');
  if not exists(select 1 from pg_timezone_names where name=tz) then tz:='Asia/Ho_Chi_Minh'; end if;
  if status_value='cancelled' then
   select coalesce((select schedule_id from public.center_calendar_items where binding_id=b.id and event_id=item->>'id'),sid) into sid;
   update public.class_schedules set status='cancelled',updated_at=now() where id=sid and class_id=b.class_id;
   update public.center_trials t set status='cancelled',revision=revision+1,updated_at=now() from public.center_calendar_items ci where ci.binding_id=b.id and ci.event_id=item->>'id' and ci.trial_id=t.id and t.club_id=b.club_id and t.status='booked';
   update public.center_calendar_items set status='cancelled',raw=item where binding_id=b.id and event_id=item->>'id';
   continue;
  end if;
  if st is null or en is null or en<=st or (st at time zone tz)::date<>(en at time zone tz)::date then continue; end if;
  tid:=null; original:=null;
  begin tid:=(item#>>'{extendedProperties,private,thinkfyTrialId}')::uuid; original:=(item#>>'{extendedProperties,private,thinkfyScheduleId}')::uuid; exception when invalid_text_representation then tid:=null; original:=null; end;
  if original is not null and exists(select 1 from public.class_schedules where id=original and class_id=b.class_id and coalesce(recurrence_rule->>'frequency','none')='none') then sid:=original; end if;
  if tid is not null and exists(select 1 from public.center_trials where id=tid and club_id=b.club_id and class_id=b.class_id) then
   update public.center_trials set starts_at=st,ends_at=en,timezone=tz,revision=revision+1,updated_at=now() where id=tid and status='booked' and (starts_at,ends_at) is distinct from (st,en);
   insert into public.center_calendar_items(binding_id,event_id,club_id,class_id,trial_id,etag,title,starts_at,ends_at,status,raw) values(b.id,item->>'id',b.club_id,b.class_id,tid,item->>'etag',coalesce(item->>'summary','Trial'),st,en,status_value,item) on conflict(binding_id,event_id) do update set trial_id=excluded.trial_id,etag=excluded.etag,raw=excluded.raw;
   continue;
  end if;
  insert into public.class_schedules(id,class_id,course_id,title,location,start_date,end_date,start_time,end_time,timezone,recurrence_rule,status,created_by,metadata)
  values(sid,b.class_id,(select course_id from public.class_schedules where id=original and class_id=b.class_id),coalesce(nullif(item->>'summary',''),'Class'),item->>'location',(st at time zone tz)::date,(en at time zone tz)::date,(st at time zone tz)::time,(en at time zone tz)::time,tz,'{"frequency":"none"}','active',p_actor_id,jsonb_build_object('centerBindingId',b.id,'googleEventId',item->>'id'))
  on conflict(id) do update set metadata=class_schedules.metadata||excluded.metadata,title=excluded.title,location=excluded.location,start_date=excluded.start_date,end_date=excluded.end_date,start_time=excluded.start_time,end_time=excluded.end_time,timezone=excluded.timezone,status='active',updated_at=case when (class_schedules.start_date,class_schedules.start_time,class_schedules.end_time,class_schedules.title,class_schedules.status) is distinct from (excluded.start_date,excluded.start_time,excluded.end_time,excluded.title,excluded.status) then now() else class_schedules.updated_at end;
  retained:=array_append(retained,sid);
  if original is not null and original<>sid then
   update public.lms_lesson_occurrences set class_schedule_id=sid where class_schedule_id=original and class_id=b.class_id and occurrence_date=coalesce((nullif(item#>>'{originalStartTime,dateTime}','')::timestamptz at time zone tz)::date,(st at time zone tz)::date);
  end if;
  insert into public.center_calendar_items(binding_id,event_id,club_id,class_id,schedule_id,etag,title,starts_at,ends_at,status,raw) values(b.id,item->>'id',b.club_id,b.class_id,sid,item->>'etag',coalesce(item->>'summary','Class'),st,en,status_value,item) on conflict(binding_id,event_id) do update set schedule_id=excluded.schedule_id,etag=excluded.etag,starts_at=excluded.starts_at,ends_at=excluded.ends_at,status=excluded.status,raw=excluded.raw;
  update public.lms_lesson_occurrences set starts_at=st,ends_at=en,occurrence_date=(st at time zone tz)::date,timezone=tz,updated_at=now() where class_schedule_id=sid and (starts_at,ends_at) is distinct from (st,en) and status='scheduled';
  update public.class_attendance_sessions a set session_date=(st at time zone tz)::date,updated_at=now() from public.lms_lesson_occurrences o where o.class_schedule_id=sid and a.occurrence_id=o.id and a.session_date<>(st at time zone tz)::date;
 end loop;
 update public.class_schedules set status='cancelled',updated_at=now() where class_id=b.class_id and metadata->>'centerBindingId'=b.id::text and status='active' and ((start_date+start_time) at time zone timezone)>=p_from and ((start_date+start_time) at time zone timezone)<p_until and not(id=any(retained));
 update public.lms_lesson_occurrences o set status='cancelled',updated_at=now() from public.class_schedules s where o.class_schedule_id=s.id and s.class_id=b.class_id and s.metadata->>'centerBindingId'=b.id::text and s.status='cancelled' and o.status='scheduled';
 return jsonb_build_object('projected',cardinality(retained));
end $$;
revoke all on function public.center_project_calendar(uuid,uuid,jsonb,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.center_project_calendar(uuid,uuid,jsonb,timestamptz,timestamptz) to service_role;

alter function public.center_snapshot(uuid) rename to center_base_snapshot;
revoke all on function public.center_base_snapshot(uuid) from public,anon,authenticated;
create function public.center_snapshot(p_club_id uuid) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare result jsonb; a uuid:=auth.uid();
begin
 result:=public.center_base_snapshot(p_club_id);
 return result||jsonb_build_object(
 'schedules',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'class_id',s.class_id,'title',s.title,'starts_at',(s.start_date+s.start_time) at time zone s.timezone,'ends_at',(s.start_date+s.end_time) at time zone s.timezone,'updated_at',s.updated_at,'connected',s.metadata ? 'centerBindingId') order by s.start_date,s.start_time) from public.class_schedules s join public.classes c on c.id=s.class_id where c.club_id=p_club_id and private.organization_can_manage_class(s.class_id,a) and s.status='active' and s.start_date>=current_date-7 and s.start_date<current_date+90),'[]'::jsonb),
 'invoices',case when coalesce(private.organization_can_admin(p_club_id,a),false) then coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('checkout_url',p.checkout_url,'payment_status',p.status)) from public.center_invoices i left join lateral(select checkout_url,status from public.center_payment_attempts where invoice_id=i.id and club_id=p_club_id order by created_at desc limit 1)p on true where i.club_id=p_club_id),'[]'::jsonb) else '[]'::jsonb end);
end $$;
revoke all on function public.center_snapshot(uuid) from public,anon;
grant execute on function public.center_snapshot(uuid) to authenticated;
create function public.center_calendar_command_context(p_event_id uuid) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare e public.center_events; b public.center_resource_bindings; c public.center_connections; s public.class_schedules;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' then raise exception 'Forbidden'; end if;
 select * into e from public.center_events where id=p_event_id and kind='schedule.reschedule_requested';
 select cs.* into s from public.class_schedules cs join public.classes cl on cl.id=cs.class_id where cs.id=e.subject_id and cl.club_id=e.club_id;
 if not found or not coalesce(private.organization_can_manage_class(s.class_id,(e.payload->>'actorId')::uuid),false) then raise exception 'Schedule permission was revoked'; end if;
 select * into b from public.center_resource_bindings where id=(e.payload->>'bindingId')::uuid and club_id=e.club_id and class_id=s.class_id and kind='calendar' and state='active';
 select * into c from public.center_connections where id=b.connection_id and club_id=e.club_id and provider='google' and status='connected';
 if b.id is null or c.id is null then raise exception 'Calendar is not connected'; end if;
 return jsonb_build_object('binding',to_jsonb(b),'connection',to_jsonb(c)-'settings','schedule',to_jsonb(s));
end $$;
revoke all on function public.center_calendar_command_context(uuid) from public,anon,authenticated;
grant execute on function public.center_calendar_command_context(uuid) to service_role;
commit;

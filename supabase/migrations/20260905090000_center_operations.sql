-- Vietnam center operations. Additive to B3; no remote application is implied.
begin;

create table public.center_admissions (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
 student_record_id uuid not null references public.student_records(id),
 stage text not null default 'lead' check(stage in ('lead','qualified','offered','enrolled','lost')),
 source text not null default 'staff', target text, revision integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(club_id,student_record_id)
);
create table public.center_trials (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
 student_record_id uuid not null references public.student_records(id), class_id uuid not null references public.classes(id),
 starts_at timestamptz not null, ends_at timestamptz not null, timezone text not null default 'Asia/Ho_Chi_Minh',
 status text not null default 'booked' check(status in ('booked','attended','no_show','cancelled')),
 assessment jsonb, revision integer not null default 1, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), check(ends_at > starts_at)
);
create table public.center_offers (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
 student_record_id uuid not null references public.student_records(id), class_id uuid not null references public.classes(id),
 amount bigint not null check(amount > 0 and amount <= 1000000000), currency text not null default 'VND' check(currency='VND'),
 starts_on date not null, ends_on date not null, status text not null default 'offered' check(status in ('offered','active','cancelled','expired')),
 revision integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(ends_on >= starts_on)
);
create table public.center_invoices (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
 offer_id uuid not null references public.center_offers(id), amount bigint not null check(amount > 0),
 currency text not null default 'VND' check(currency='VND'),
 status text not null default 'open' check(status in ('open','paid','void','refunded','exception')),
 revision integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.center_connections (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
 provider text not null check(provider in ('google','zbs','zalopay')),
 status text not null default 'not_connected' check(status in ('not_connected','pending','sandbox','connected','reconnect_required','disabled')),
 account_label text, external_account_id text, scopes text[] not null default '{}',
 settings jsonb not null default '{}', revision integer not null default 1,
 connected_by uuid references public.profiles(id), last_sync_at timestamptz, last_error text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(club_id,provider)
);
create table private.center_credentials (
 connection_id uuid primary key references public.center_connections(id) on delete cascade,
 ciphertext text not null, key_name text not null, updated_at timestamptz not null default now()
);
create table public.center_resource_bindings (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
 connection_id uuid not null references public.center_connections(id),
 kind text not null check(kind in ('calendar','sheet','drive_file')),
 external_id text not null, label text not null, class_id uuid references public.classes(id),
 state text not null default 'active' check(state in ('active','revoked','conflict')),
 cursor text, metadata jsonb not null default '{}', last_sync_at timestamptz,
 created_at timestamptz not null default now(), unique(connection_id,kind,external_id)
);
create table public.center_payment_attempts (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
 invoice_id uuid not null references public.center_invoices(id), connection_id uuid not null references public.center_connections(id),
 provider_order_id text not null, provider_transaction_id text,
 expected_amount bigint not null check(expected_amount > 0),
 status text not null default 'pending' check(status in ('pending','paid','expired','failed','exception','refunded')),
 checkout_url text, expires_at timestamptz, verified_at timestamptz, error_code text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(connection_id,provider_order_id), unique(connection_id,provider_transaction_id)
);
create table public.center_notes (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
 student_record_id uuid not null references public.student_records(id), created_by uuid not null references public.profiles(id),
 body text not null check(length(body) between 1 and 10000), revision integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.center_drafts (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
 class_id uuid not null references public.classes(id), created_by uuid not null references public.profiles(id),
 kind text not null check(kind in ('homework','lesson','report','announcement')), title text not null,
 body text not null, status text not null default 'draft' check(status in ('draft','published','archived')),
 revision integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.center_guardians (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
 user_id uuid references public.profiles(id), full_name text not null, email text, phone text,
 created_at timestamptz not null default now()
);
create table public.center_guardian_students (
 guardian_id uuid not null references public.center_guardians(id), student_record_id uuid not null references public.student_records(id),
 club_id uuid not null references public.clubs(id), verified_at timestamptz, verified_by uuid references public.profiles(id),
 revoked_at timestamptz, preferences jsonb not null default '{"class_changes":false,"progress_summary":false,"renewal":false}',
 primary key(guardian_id,student_record_id)
);
create table public.center_communication_policies (
 club_id uuid not null references public.clubs(id), template_key text not null,
 provider_template_id text, approval_status text not null default 'not_submitted' check(approval_status in ('not_submitted','pending','approved','rejected')),
 enabled boolean not null default false, include_guardians boolean not null default false,
 daily_limit integer not null default 100 check(daily_limit between 0 and 10000),
 quiet_start integer not null default 21 check(quiet_start between 0 and 23),
 quiet_end integer not null default 8 check(quiet_end between 0 and 23),
 updated_at timestamptz not null default now(), primary key(club_id,template_key)
);
create table public.center_recipient_channels (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
 student_record_id uuid references public.student_records(id), guardian_id uuid references public.center_guardians(id),
 channel text not null check(channel in ('email','zbs')), address text not null,
 consent_at timestamptz, revoked_at timestamptz, verified_at timestamptz,
 check(num_nonnulls(student_record_id,guardian_id)=1), created_at timestamptz not null default now()
);
create table public.center_commands (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
 actor_id uuid not null references public.profiles(id), kind text not null, idempotency_key text not null,
 input_hash text not null, receipt jsonb not null, created_at timestamptz not null default now(),
 unique(club_id,actor_id,idempotency_key)
);
create table public.center_events (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
 command_id uuid references public.center_commands(id), kind text not null, subject_id uuid,
 payload jsonb not null default '{}', origin text not null default 'thinkfy',
 status text not null default 'pending' check(status in ('pending','processing','completed','failed','skipped')),
 available_at timestamptz not null default now(), lease_until timestamptz, lease_token uuid,
 attempts integer not null default 0, last_error text, expires_at timestamptz,
 created_at timestamptz not null default now(), unique(command_id,kind)
);
create table public.center_event_receipts (
 event_id uuid not null references public.center_events(id), consumer text not null,
 status text not null check(status in ('completed','failed','skipped')), provider_id text,
 detail jsonb not null default '{}', created_at timestamptz not null default now(), primary key(event_id,consumer)
);
create table public.center_conversations (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
 actor_id uuid not null references public.profiles(id), title text not null default 'Teacher assistant',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.center_chat_messages (
 id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.center_conversations(id),
 role text not null check(role in ('user','assistant')), body text not null,
 metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.center_proposals (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
 actor_id uuid not null references public.profiles(id), conversation_id uuid not null references public.center_conversations(id),
 kind text not null, input jsonb not null, requires_confirmation boolean not null,
 status text not null default 'pending' check(status in ('pending','confirmed','executed','cancelled','failed')),
 receipt jsonb, expires_at timestamptz not null default(now()+interval '30 minutes'),
 created_at timestamptz not null default now()
);
create index center_events_pending_idx on public.center_events(available_at) where status in ('pending','processing');
create index center_trials_club_idx on public.center_trials(club_id,starts_at);
create index center_messages_conversation_idx on public.center_chat_messages(conversation_id,created_at);
create index center_notes_student_idx on public.center_notes(student_record_id,created_at);

create function private.center_can_work(p_club uuid,p_actor uuid) returns boolean language sql stable security definer set search_path=public,private as $$
 select p_actor is not null and (private.organization_can_manage_people(p_club,p_actor) or exists(
 select 1 from public.classes c where c.club_id=p_club and private.organization_can_manage_class(c.id,p_actor)))
$$;
create function private.center_can_read_student(p_club uuid,p_student uuid,p_actor uuid) returns boolean language sql stable security definer set search_path=public,private as $$
 select p_actor is not null and exists(select 1 from public.student_records s where s.id=p_student and s.club_id=p_club and (
 private.organization_can_manage_people(p_club,p_actor) or exists(select 1 from public.student_record_enrollments e join public.classes c on c.id=e.class_id where e.student_record_id=s.id and e.status='active' and c.club_id=p_club and private.organization_can_manage_class(c.id,p_actor)) or exists(select 1 from public.center_trials t where t.student_record_id=s.id and t.club_id=p_club and private.organization_can_manage_class(t.class_id,p_actor))))
$$;
revoke all on function private.center_can_work(uuid,uuid), private.center_can_read_student(uuid,uuid,uuid) from public,anon;
grant execute on function private.center_can_work(uuid,uuid), private.center_can_read_student(uuid,uuid,uuid) to authenticated;

-- Every new table is RLS protected before any backfill. Writes are RPC-only.
alter table public.center_admissions enable row level security;
revoke all on public.center_admissions from anon,authenticated;
grant all on public.center_admissions to service_role;
alter table public.center_trials enable row level security;
revoke all on public.center_trials from anon,authenticated;
grant all on public.center_trials to service_role;
alter table public.center_offers enable row level security;
revoke all on public.center_offers from anon,authenticated;
grant all on public.center_offers to service_role;
alter table public.center_invoices enable row level security;
revoke all on public.center_invoices from anon,authenticated;
grant all on public.center_invoices to service_role;
alter table public.center_connections enable row level security;
revoke all on public.center_connections from anon,authenticated;
grant all on public.center_connections to service_role;
alter table public.center_resource_bindings enable row level security;
revoke all on public.center_resource_bindings from anon,authenticated;
grant all on public.center_resource_bindings to service_role;
alter table public.center_payment_attempts enable row level security;
revoke all on public.center_payment_attempts from anon,authenticated;
grant all on public.center_payment_attempts to service_role;
alter table public.center_notes enable row level security;
revoke all on public.center_notes from anon,authenticated;
grant all on public.center_notes to service_role;
alter table public.center_drafts enable row level security;
revoke all on public.center_drafts from anon,authenticated;
grant all on public.center_drafts to service_role;
alter table public.center_guardians enable row level security;
revoke all on public.center_guardians from anon,authenticated;
grant all on public.center_guardians to service_role;
alter table public.center_guardian_students enable row level security;
revoke all on public.center_guardian_students from anon,authenticated;
grant all on public.center_guardian_students to service_role;
alter table public.center_communication_policies enable row level security;
revoke all on public.center_communication_policies from anon,authenticated;
grant all on public.center_communication_policies to service_role;
alter table public.center_recipient_channels enable row level security;
revoke all on public.center_recipient_channels from anon,authenticated;
grant all on public.center_recipient_channels to service_role;
alter table public.center_commands enable row level security;
revoke all on public.center_commands from anon,authenticated;
grant all on public.center_commands to service_role;
alter table public.center_events enable row level security;
revoke all on public.center_events from anon,authenticated;
grant all on public.center_events to service_role;
alter table public.center_event_receipts enable row level security;
revoke all on public.center_event_receipts from anon,authenticated;
grant all on public.center_event_receipts to service_role;
alter table public.center_conversations enable row level security;
revoke all on public.center_conversations from anon,authenticated;
grant all on public.center_conversations to service_role;
alter table public.center_chat_messages enable row level security;
revoke all on public.center_chat_messages from anon,authenticated;
grant all on public.center_chat_messages to service_role;
alter table public.center_proposals enable row level security;
revoke all on public.center_proposals from anon,authenticated;
grant all on public.center_proposals to service_role;
revoke all on private.center_credentials from public,anon,authenticated;
grant all on private.center_credentials to service_role;
grant select on public.center_admissions,public.center_trials,public.center_notes,public.center_drafts,public.center_connections,public.center_resource_bindings,public.center_conversations,public.center_chat_messages,public.center_proposals,public.center_commands,public.center_events,public.center_offers,public.center_invoices,public.center_payment_attempts,public.center_communication_policies to authenticated;
create policy center_admissions_read on public.center_admissions for select to authenticated using(private.center_can_read_student(club_id,student_record_id,auth.uid()));
create policy center_trials_read on public.center_trials for select to authenticated using(private.organization_can_manage_class(class_id,auth.uid()));
create policy center_notes_read on public.center_notes for select to authenticated using(private.center_can_read_student(club_id,student_record_id,auth.uid()));
create policy center_drafts_read on public.center_drafts for select to authenticated using(private.organization_can_manage_class(class_id,auth.uid()));
create policy center_connections_read on public.center_connections for select to authenticated using(private.organization_can_admin(club_id,auth.uid()));
create policy center_bindings_read on public.center_resource_bindings for select to authenticated using(private.organization_can_admin(club_id,auth.uid()) or (class_id is not null and private.organization_can_manage_class(class_id,auth.uid())));
create policy center_offers_read on public.center_offers for select to authenticated using(private.organization_can_admin(club_id,auth.uid()));
create policy center_invoices_read on public.center_invoices for select to authenticated using(private.organization_can_admin(club_id,auth.uid()));
create policy center_payments_read on public.center_payment_attempts for select to authenticated using(private.organization_can_admin(club_id,auth.uid()));
create policy center_policies_read on public.center_communication_policies for select to authenticated using(private.organization_can_admin(club_id,auth.uid()));
create policy center_commands_read on public.center_commands for select to authenticated using(actor_id=auth.uid() and private.center_can_work(club_id,auth.uid()));
create policy center_events_read on public.center_events for select to authenticated using(private.organization_can_admin(club_id,auth.uid()));
create policy center_conversations_read on public.center_conversations for select to authenticated using(actor_id=auth.uid() and private.center_can_work(club_id,auth.uid()));
create policy center_messages_read on public.center_chat_messages for select to authenticated using(exists(select 1 from public.center_conversations c where c.id=conversation_id and c.actor_id=auth.uid() and private.center_can_work(c.club_id,auth.uid())));
create policy center_proposals_read on public.center_proposals for select to authenticated using(actor_id=auth.uid() and private.center_can_work(club_id,auth.uid()));

-- These ledger/relationship tables are RPC-only; no authenticated direct access.
create policy center_guardians_service on public.center_guardians for all to service_role using(true) with check(true);
create policy center_guardian_students_service on public.center_guardian_students for all to service_role using(true) with check(true);
create policy center_recipient_channels_service on public.center_recipient_channels for all to service_role using(true) with check(true);
create policy center_event_receipts_service on public.center_event_receipts for all to service_role using(true) with check(true);

create function public.center_snapshot(p_club_id uuid) returns jsonb language plpgsql stable security definer set search_path=public,private as $$
declare a uuid:=auth.uid(); managers boolean; finance boolean; result jsonb;
begin
 if not coalesce(private.center_can_work(p_club_id,a),false) then raise exception 'Forbidden' using errcode='42501'; end if;
 managers:=coalesce(private.organization_can_manage_people(p_club_id,a),false);
 finance:=coalesce(private.organization_can_admin(p_club_id,a),false);
 select jsonb_build_object('organizationId',p_club_id,'actorId',a,'canManage',managers,'canManageFinance',finance,
 'classes',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.title)) from public.classes c where c.club_id=p_club_id and private.organization_can_manage_class(c.id,a)),'[]'::jsonb),
 'students',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.full_name,'code',s.student_code,'linked',s.user_id is not null,'status',s.status,'classIds',coalesce((select jsonb_agg(e.class_id) from public.student_record_enrollments e where e.student_record_id=s.id and e.status='active' and private.organization_can_manage_class(e.class_id,a)),'[]'::jsonb))) from public.student_records s where s.club_id=p_club_id and private.center_can_read_student(p_club_id,s.id,a)),'[]'::jsonb),
 'admissions',coalesce((select jsonb_agg(to_jsonb(t)) from public.center_admissions t where t.club_id=p_club_id and private.center_can_read_student(p_club_id,t.student_record_id,a)),'[]'::jsonb),
 'trials',coalesce((select jsonb_agg(to_jsonb(t) order by t.starts_at desc) from public.center_trials t where t.club_id=p_club_id and private.organization_can_manage_class(t.class_id,a)),'[]'::jsonb),
 'notes',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc) from (select * from public.center_notes n where n.club_id=p_club_id and private.center_can_read_student(p_club_id,n.student_record_id,a) order by n.created_at desc limit 100) t),'[]'::jsonb),
 'drafts',coalesce((select jsonb_agg(to_jsonb(t)) from public.center_drafts t where t.club_id=p_club_id and private.organization_can_manage_class(t.class_id,a)),'[]'::jsonb),
 'offers',case when finance then coalesce((select jsonb_agg(to_jsonb(t)) from public.center_offers t where t.club_id=p_club_id),'[]'::jsonb) else '[]'::jsonb end,
 'invoices',case when finance then coalesce((select jsonb_agg(to_jsonb(t)) from public.center_invoices t where t.club_id=p_club_id),'[]'::jsonb) else '[]'::jsonb end,
 'connections',case when finance then coalesce((select jsonb_agg(to_jsonb(t)-'settings') from public.center_connections t where t.club_id=p_club_id),'[]'::jsonb) else '[]'::jsonb end,
 'bindings',coalesce((select jsonb_agg(to_jsonb(t)-'cursor') from public.center_resource_bindings t where t.club_id=p_club_id and (finance or private.organization_can_manage_class(t.class_id,a))),'[]'::jsonb),
 'events',case when finance then coalesce((select jsonb_agg(to_jsonb(t)-'payload'-'lease_token') from (select * from public.center_events e where e.club_id=p_club_id order by e.created_at desc limit 50)t),'[]'::jsonb) else '[]'::jsonb end
 ) into result;
 return result;
end $$;

create function public.center_execute_command(p_club_id uuid,p_kind text,p_input jsonb,p_idempotency_key text) returns jsonb language plpgsql security definer set search_path=public,private,extensions as $$
declare a uuid:=auth.uid(); command_id uuid:=gen_random_uuid(); target uuid; student uuid; class_id_value uuid;
 old public.center_commands; receipt jsonb; input_hash text; revision_value integer; event_kind text; allowed boolean;
 trial public.center_trials; offer public.center_offers; invoice public.center_invoices; admission public.center_admissions;
begin
 if not coalesce(private.center_can_work(p_club_id,a),false) then raise exception 'Forbidden' using errcode='42501'; end if;
 if length(p_idempotency_key) not between 8 and 200 or jsonb_typeof(p_input)<>'object' then raise exception 'Invalid command'; end if;
 input_hash:=encode(digest(p_kind||p_input::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_club_id::text||a::text||p_idempotency_key,0));
 select * into old from public.center_commands c where c.club_id=p_club_id and c.actor_id=a and c.idempotency_key=p_idempotency_key;
 if found then
  if old.input_hash<>input_hash then raise exception 'Idempotency key reused with different input'; end if;
  return old.receipt;
 end if;
 student:=nullif(p_input->>'studentRecordId','')::uuid; class_id_value:=nullif(p_input->>'classId','')::uuid;
 if student is not null and not coalesce(private.center_can_read_student(p_club_id,student,a),false) then raise exception 'Student not accessible' using errcode='42501'; end if;
 if class_id_value is not null and not exists(select 1 from public.classes c where c.id=class_id_value and c.club_id=p_club_id and private.organization_can_manage_class(c.id,a)) then raise exception 'Class not accessible' using errcode='42501'; end if;
 if p_kind in ('student.create','admission.stage','trial.book') and not coalesce(private.organization_can_manage_people(p_club_id,a),false) then raise exception 'Admissions manager required' using errcode='42501'; end if;
 if p_kind in ('offer.create','offer.cancel','connection.prepare','connection.disconnect','invoice.checkout','message.send') and not coalesce(private.organization_can_admin(p_club_id,a),false) then raise exception 'Center administrator required' using errcode='42501'; end if;
 case p_kind
 when 'student.create' then
  if length(trim(p_input->>'name')) not between 1 and 200 then raise exception 'Student name required'; end if;
  insert into public.student_records(club_id,full_name,phone,email,student_code,created_by) values(p_club_id,trim(p_input->>'name'),nullif(p_input->>'phone',''),nullif(p_input->>'email',''),nullif(p_input->>'code',''),a) returning id into target;
  insert into public.center_admissions(club_id,student_record_id,source,target) values(p_club_id,target,coalesce(nullif(p_input->>'source',''),'staff'),p_input->>'target');
  event_kind:='student.created';
 when 'admission.stage' then
  select * into admission from public.center_admissions t where t.id=(p_input->>'admissionId')::uuid and t.club_id=p_club_id for update;
  if not found then raise exception 'Admission not found'; end if;
  if (p_input->>'expectedRevision')::integer is distinct from admission.revision then raise exception 'Revision conflict' using errcode='40001'; end if;
  if p_input->>'stage' not in ('lead','qualified','lost') or admission.stage='enrolled' then raise exception 'Invalid admission transition'; end if;
  update public.center_admissions set stage=p_input->>'stage',revision=revision+1,updated_at=now() where id=admission.id returning id,revision into target,revision_value;
  event_kind:='admission.changed';
 when 'trial.book' then
  if student is null or class_id_value is null then raise exception 'Student and class required'; end if;
  if (p_input->>'startAt')::timestamptz <= now() then raise exception 'Trial must start in the future'; end if;
  insert into public.center_trials(club_id,student_record_id,class_id,starts_at,ends_at) values(p_club_id,student,class_id_value,(p_input->>'startAt')::timestamptz,(p_input->>'endAt')::timestamptz) returning id,revision into target,revision_value;
  event_kind:='trial.booked';
 when 'trial.status','trial.evaluate' then
  select * into trial from public.center_trials t where t.id=(p_input->>'trialId')::uuid and t.club_id=p_club_id for update;
  if not found or not coalesce(private.organization_can_manage_class(trial.class_id,a),false) then raise exception 'Trial not accessible' using errcode='42501'; end if;
  if (p_input->>'expectedRevision')::integer is distinct from trial.revision then raise exception 'Revision conflict' using errcode='40001'; end if;
  if p_kind='trial.status' then
   if p_input->>'status' not in ('attended','no_show','cancelled') or trial.status<>'booked' then raise exception 'Invalid trial transition'; end if;
   if p_input->>'status'='no_show' and trial.ends_at>now() then raise exception 'Trial has not ended'; end if;
   update public.center_trials set status=p_input->>'status',revision=revision+1,updated_at=now() where id=trial.id;
   event_kind:='trial.'||(p_input->>'status');
  else
   if jsonb_typeof(p_input->'assessment') is distinct from 'object' or length((p_input->'assessment')::text)>10000 then raise exception 'Assessment required'; end if;
   update public.center_trials set assessment=p_input->'assessment',revision=revision+1,updated_at=now() where id=trial.id;
   event_kind:='trial.evaluated';
  end if;
  target:=trial.id; revision_value:=trial.revision+1;
 when 'note.create' then
  if student is null then raise exception 'Student required'; end if;
  insert into public.center_notes(club_id,student_record_id,created_by,body) values(p_club_id,student,a,p_input->>'body') returning id,revision into target,revision_value;
  event_kind:='note.created';
 when 'note.remove' then
  select revision into revision_value from public.center_notes n where n.id=(p_input->>'noteId')::uuid and n.club_id=p_club_id and n.created_by=a and private.center_can_read_student(p_club_id,n.student_record_id,a) for update;
  if not found then raise exception 'Note not accessible' using errcode='42501'; end if;
  if (p_input->>'expectedRevision')::integer is distinct from revision_value then raise exception 'Revision conflict' using errcode='40001'; end if;
  delete from public.center_notes where id=(p_input->>'noteId')::uuid returning id into target;
  event_kind:='note.removed';
 when 'draft.create' then
  if class_id_value is null or length(p_input->>'title') not between 1 and 200 or length(p_input->>'body') not between 1 and 50000 then raise exception 'Draft fields required'; end if;
  insert into public.center_drafts(club_id,class_id,created_by,kind,title,body) values(p_club_id,class_id_value,a,p_input->>'draftType',p_input->>'title',p_input->>'body') returning id,revision into target,revision_value;
  event_kind:='draft.created';
 when 'offer.create' then
  if student is null or class_id_value is null then raise exception 'Student and class required'; end if;
  insert into public.center_offers(club_id,student_record_id,class_id,amount,starts_on,ends_on) values(p_club_id,student,class_id_value,(p_input->>'amount')::bigint,(p_input->>'startDate')::date,(p_input->>'endDate')::date) returning * into offer;
  insert into public.center_invoices(club_id,offer_id,amount) values(p_club_id,offer.id,offer.amount);
  update public.center_admissions set stage='offered',revision=revision+1,updated_at=now() where club_id=p_club_id and student_record_id=student and stage<>'enrolled';
  target:=offer.id; revision_value:=offer.revision; event_kind:='offer.created';
 when 'offer.cancel' then
  select * into offer from public.center_offers t where t.id=(p_input->>'offerId')::uuid and t.club_id=p_club_id for update;
  if not found then raise exception 'Offer not found'; end if;
  if (p_input->>'expectedRevision')::integer is distinct from offer.revision then raise exception 'Revision conflict' using errcode='40001'; end if;
  if offer.status<>'offered' then raise exception 'Only unpaid offers can be cancelled'; end if;
  update public.center_offers set status='cancelled',revision=revision+1,updated_at=now() where id=offer.id;
  update public.center_invoices set status='void',revision=revision+1,updated_at=now() where offer_id=offer.id and status='open';
  target:=offer.id; event_kind:='offer.cancelled';
 when 'invoice.checkout' then
  select * into invoice from public.center_invoices t where t.id=(p_input->>'invoiceId')::uuid and t.club_id=p_club_id for update;
  if not found or invoice.status<>'open' then raise exception 'Invoice is not payable'; end if;
  if not exists(select 1 from public.center_connections c join private.center_credentials k on k.connection_id=c.id where c.club_id=p_club_id and c.provider='zalopay' and c.status in ('sandbox','connected')) then raise exception 'Connect a ZaloPay merchant account first'; end if;
  target:=invoice.id; event_kind:='invoice.checkout_requested';
 when 'connection.prepare' then
  if p_input->>'provider' not in ('google','zbs','zalopay') then raise exception 'Unknown provider'; end if;
  insert into public.center_connections(club_id,provider,connected_by) values(p_club_id,p_input->>'provider',a) on conflict(club_id,provider) do nothing;
  update public.center_connections set status='pending',updated_at=now(),revision=revision+1 where club_id=p_club_id and provider=p_input->>'provider' and status in ('not_connected','disabled');
  select id into target from public.center_connections where club_id=p_club_id and provider=p_input->>'provider';
  event_kind:='connection.prepared';
 when 'connection.disconnect' then
  select id into target from public.center_connections c where c.id=(p_input->>'connectionId')::uuid and c.club_id=p_club_id for update;
  if not found then raise exception 'Connection not found'; end if;
  update public.center_connections set status='disabled',revision=revision+1,updated_at=now() where id=target;
  update public.center_resource_bindings set state='revoked' where connection_id=target;
  delete from private.center_credentials where connection_id=target;
  event_kind:='connection.disconnected';
 when 'message.send' then
  if student is null or p_input->>'templateKey' not in ('trial_confirmation','trial_reminder','class_rescheduled','progress_summary','renewal_reminder') then raise exception 'Invalid notification'; end if;
  if not exists(select 1 from public.center_connections c where c.club_id=p_club_id and c.provider='zbs' and c.status='connected') then raise exception 'Zalo OA is not connected'; end if;
  if not exists(select 1 from public.center_communication_policies p where p.club_id=p_club_id and p.template_key=p_input->>'templateKey' and p.approval_status='approved' and p.enabled) then raise exception 'Template is not approved and enabled'; end if;
  target:=student; event_kind:='message.requested';
 else raise exception 'Unsupported center command: %',p_kind;
 end case;
 receipt:=jsonb_build_object('commandId',command_id,'kind',p_kind,'targetId',target,'revision',revision_value,'status',case when p_kind in ('invoice.checkout','message.send') then 'pending' else 'completed' end);
 insert into public.center_commands(id,club_id,actor_id,kind,idempotency_key,input_hash,receipt) values(command_id,p_club_id,a,p_kind,p_idempotency_key,input_hash,receipt);
 insert into public.center_events(club_id,command_id,kind,subject_id,payload,expires_at) values(p_club_id,command_id,event_kind,target,jsonb_build_object('actorId',a,'input',p_input),case when p_kind='message.send' then now()+interval '1 hour' else null end);
 return receipt;
end $$;

revoke all on function public.center_snapshot(uuid),public.center_execute_command(uuid,text,jsonb,text) from public,anon;
grant execute on function public.center_snapshot(uuid),public.center_execute_command(uuid,text,jsonb,text) to authenticated;
commit;

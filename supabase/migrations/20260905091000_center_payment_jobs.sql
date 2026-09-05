begin;

create or replace function public.center_prepare_payment(p_invoice_id uuid, p_connection_id uuid, p_order_id text)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare i public.center_invoices; o public.center_offers; c public.center_connections; a public.center_payment_attempts;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_order_id is null or length(trim(p_order_id)) = 0 then raise exception 'Order id required'; end if;
 select * into i from public.center_invoices where id=p_invoice_id for update;
 if not found then raise exception 'Invoice not found'; end if;
 select * into o from public.center_offers where id=i.offer_id and club_id=i.club_id for update;
 select * into c from public.center_connections where id=p_connection_id and club_id=i.club_id and provider='zalopay' for update;
 if not found or c.status not in ('sandbox','connected') then raise exception 'ZaloPay connection is not active'; end if;
 if i.status <> 'open' or o.status <> 'offered' or o.ends_on < current_date then raise exception 'Invoice is not payable'; end if;
 if i.amount <> o.amount or i.currency <> 'VND' then raise exception 'Invoice amount mismatch'; end if;
 update public.center_payment_attempts set status='expired',updated_at=now() where invoice_id=i.id and connection_id=c.id and status='pending' and expires_at is not null and expires_at <= now();
 select * into a from public.center_payment_attempts where invoice_id=i.id and connection_id=c.id and status='pending' order by created_at desc limit 1 for update;
 if found then return jsonb_build_object('attemptId',a.id,'invoiceId',a.invoice_id,'providerOrderId',a.provider_order_id,'amount',a.expected_amount,'status',a.status,'reused',true); end if;
 insert into public.center_payment_attempts(club_id,invoice_id,connection_id,provider_order_id,expected_amount,expires_at)
 values(i.club_id,i.id,c.id,p_order_id,i.amount,now()+interval '15 minutes') returning * into a;
 return jsonb_build_object('attemptId',a.id,'invoiceId',a.invoice_id,'providerOrderId',a.provider_order_id,'amount',a.expected_amount,'status',a.status,'reused',false);
end $$;

create or replace function public.center_attach_checkout(p_attempt_id uuid, p_checkout_url text, p_expires_at timestamptz)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare a public.center_payment_attempts; host text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_checkout_url is null or p_checkout_url !~* '^https://' then raise exception 'Checkout URL must use HTTPS'; end if;
 host := lower(split_part(split_part(p_checkout_url,'://',2), '/', 1));
 if host not in ('openapi.zalopay.vn','sb-openapi.zalopay.vn','qcgateway.zalopay.vn','checkout.zalopay.vn') then raise exception 'Checkout URL provider is not allowlisted'; end if;
 select * into a from public.center_payment_attempts where id=p_attempt_id for update;
 if not found then raise exception 'Payment attempt not found'; end if;
 if a.status <> 'pending' then raise exception 'Payment attempt is not pending'; end if;
 if p_expires_at is null or p_expires_at <= now() then raise exception 'Checkout expiry must be in the future'; end if;
 update public.center_payment_attempts set checkout_url=p_checkout_url,expires_at=p_expires_at,updated_at=now() where id=a.id returning * into a;
 return jsonb_build_object('attemptId',a.id,'checkoutUrl',a.checkout_url,'expiresAt',a.expires_at,'status',a.status);
end $$;

create or replace function public.center_apply_verified_payment(p_connection_id uuid, p_order_id text, p_transaction_id text, p_amount bigint)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare a public.center_payment_attempts; i public.center_invoices; o public.center_offers; s public.student_records; cl public.classes; existing uuid; exception_code text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Not authorized' using errcode='42501'; end if;
 select * into a from public.center_payment_attempts where connection_id=p_connection_id and provider_order_id=p_order_id for update;
 if not found then raise exception 'Payment attempt not found'; end if;
 if p_transaction_id is null or length(trim(p_transaction_id))=0 then raise exception 'Transaction id required'; end if;
 select * into i from public.center_invoices where id=a.invoice_id and club_id=a.club_id for update;
 if not found or not exists(select 1 from public.center_connections c where c.id=p_connection_id and c.club_id=a.club_id and c.provider='zalopay') then raise exception 'Payment ownership is invalid'; end if;
 if a.verified_at is not null then
   if a.provider_transaction_id=p_transaction_id and p_amount=a.expected_amount then return jsonb_build_object('attemptId',a.id,'invoiceId',i.id,'status',a.status,'replayed',true,'reason',a.error_code); end if;
   raise exception 'Verified payment is immutable';
 end if;
 if exists(select 1 from public.center_payment_attempts where connection_id=p_connection_id and provider_transaction_id=p_transaction_id and id<>a.id) then raise exception 'Duplicate provider transaction'; end if;
 if p_amount is null or p_amount <> a.expected_amount then
   update public.center_payment_attempts set provider_transaction_id=p_transaction_id,status='exception',error_code='amount_mismatch',updated_at=now() where id=a.id;
   if not exists(select 1 from public.center_events where club_id=a.club_id and kind='payment.exception' and subject_id=a.id) then insert into public.center_events(club_id,kind,subject_id,payload) values(a.club_id,'payment.exception',a.id,jsonb_build_object('transactionId',p_transaction_id,'reason','amount_mismatch','amount',p_amount,'expectedAmount',a.expected_amount)); end if;
   return jsonb_build_object('attemptId',a.id,'transactionId',p_transaction_id,'status','exception','reason','amount_mismatch');
 end if;
 if a.provider_transaction_id=p_transaction_id and a.status in ('paid','exception') then
   return jsonb_build_object('attemptId',a.id,'invoiceId',i.id,'transactionId',p_transaction_id,'status',a.status,'replayed',true,'reason',a.error_code);
 end if;
 if exists(select 1 from public.center_payment_attempts where connection_id=p_connection_id and provider_transaction_id=p_transaction_id and id<>a.id) then raise exception 'Duplicate provider transaction'; end if;
 select * into o from public.center_offers where id=i.offer_id;
 if not found or o.club_id is distinct from i.club_id then raise exception 'Offer ownership is invalid'; end if;
 select * into s from public.student_records where id=o.student_record_id;
 if not found or s.club_id is distinct from o.club_id then raise exception 'Student ownership is invalid'; end if;
 select * into cl from public.classes where id=o.class_id;
 if not found or cl.club_id is distinct from o.club_id then raise exception 'Class ownership is invalid'; end if;
 perform pg_advisory_xact_lock(hashtextextended(cl.id::text,0));
 if i.status<>'open' or o.status in ('cancelled','expired') then exception_code := case when i.status='paid' then 'invoice_already_paid' else 'offer_not_active' end;
 elsif not exists(select 1 from public.student_record_enrollments where student_record_id=s.id and class_id=cl.id and status='active') and not exists(select 1 from public.class_memberships where class_id=cl.id and user_id=s.user_id and member_role='student' and status='active') and cl.max_students is not null and ((select count(*) from public.class_memberships where class_id=cl.id and member_role='student' and status='active') + (select count(*) from public.student_record_enrollments e join public.student_records sr on sr.id=e.student_record_id where e.class_id=cl.id and e.status='active' and sr.user_id is null)) >= cl.max_students then exception_code := 'class_at_capacity'; end if;
 update public.center_payment_attempts set provider_transaction_id=p_transaction_id,verified_at=now(),updated_at=now() where id=a.id;
 if exception_code is not null then
   update public.center_payment_attempts set status='exception',error_code=exception_code,updated_at=now() where id=a.id;
   update public.center_invoices set status='paid',revision=revision+1,updated_at=now() where id=i.id and status='open';
   if not exists(select 1 from public.center_events where club_id=i.club_id and kind='payment.exception' and subject_id=a.id) then insert into public.center_events(club_id,kind,subject_id,payload) values(i.club_id,'payment.exception',a.id,jsonb_build_object('invoiceId',i.id,'transactionId',p_transaction_id,'reason',exception_code)); end if;
   return jsonb_build_object('attemptId',a.id,'invoiceId',i.id,'transactionId',p_transaction_id,'status','exception','reason',exception_code);
 end if;
 update public.center_payment_attempts set status='paid',updated_at=now() where id=a.id;
 update public.center_invoices set status='paid',revision=revision+1,updated_at=now() where id=i.id;
 begin
 insert into public.student_record_enrollments(student_record_id,class_id,status,metadata) values(s.id,cl.id,'active','{"paymentActivation":"pending"}'::jsonb) on conflict(student_record_id,class_id) do update set status='active',removed_at=null,metadata=student_record_enrollments.metadata || '{"paymentActivation":"pending"}'::jsonb,updated_at=now();
 if s.user_id is not null then
     insert into public.club_memberships(club_id,user_id,role,status) values(s.club_id,s.user_id,'student','active') on conflict(club_id,user_id,role) do update set status='active',removed_at=null,updated_at=now();
     insert into public.class_memberships(class_id,user_id,member_role,status) values(cl.id,s.user_id,'student','active') on conflict(class_id,user_id,member_role) do update set status='active',removed_at=null,updated_at=now();
 end if;
 exception when others then exception_code:='membership_activation_failed';
 end;
 if exception_code is not null then
   update public.center_payment_attempts set status='exception',error_code=exception_code,updated_at=now() where id=a.id;
   update public.student_record_enrollments set metadata=metadata || jsonb_build_object('paymentActivation','pending','reason',exception_code),updated_at=now() where student_record_id=s.id and class_id=cl.id;
   if not exists(select 1 from public.center_events where club_id=i.club_id and kind='payment.exception' and subject_id=a.id) then insert into public.center_events(club_id,kind,subject_id,payload) values(i.club_id,'payment.exception',a.id,jsonb_build_object('invoiceId',i.id,'transactionId',p_transaction_id,'reason',exception_code)); end if;
   return jsonb_build_object('attemptId',a.id,'invoiceId',i.id,'transactionId',p_transaction_id,'status','exception','reason',exception_code);
 end if;
 update public.student_record_enrollments set metadata=metadata || jsonb_build_object('paymentActivation','complete','paidThrough',greatest(o.ends_on,coalesce((metadata->>'paidThrough')::date,o.ends_on))),updated_at=now() where student_record_id=s.id and class_id=cl.id;
 update public.center_offers set status='active',revision=revision+1,updated_at=now() where id=o.id and status='offered';
 update public.center_admissions set stage='enrolled',revision=revision+1,updated_at=now() where club_id=o.club_id and student_record_id=o.student_record_id and stage <> 'enrolled';
 if not exists(select 1 from public.center_events where club_id=i.club_id and kind='payment.completed' and subject_id=a.id) then
   insert into public.center_events(club_id,kind,subject_id,payload) values(i.club_id,'payment.completed',a.id,jsonb_build_object('invoiceId',i.id,'offerId',o.id,'transactionId',p_transaction_id,'amount',p_amount));
 end if;
 return jsonb_build_object('attemptId',a.id,'invoiceId',i.id,'transactionId',p_transaction_id,'status','paid','replayed',false);
end $$;

create or replace function public.center_claim_event(p_event_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare e public.center_events; token uuid := gen_random_uuid();
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Not authorized' using errcode='42501'; end if;
 update public.center_events set status='skipped',lease_until=null,lease_token=null,last_error='expired' where status='pending' and expires_at is not null and expires_at <= now();
 update public.center_events set status='failed',lease_until=null,lease_token=null,last_error='lease expired after maximum attempts' where status='processing' and attempts >= 8 and lease_until <= now();
 if p_event_id is null then
   select * into e from public.center_events where attempts < 8 and (status='pending' or (status='processing' and lease_until < now())) and available_at <= now() and (expires_at is null or expires_at > now()) order by available_at,created_at for update skip locked limit 1;
 else
   select * into e from public.center_events where id=p_event_id and attempts < 8 and (status='pending' or (status='processing' and lease_until < now())) and available_at <= now() and (expires_at is null or expires_at > now()) for update skip locked;
 end if;
 if not found then return null; end if;
 update public.center_events set status='processing',lease_token=token,lease_until=now()+interval '5 minutes',attempts=attempts+1 where id=e.id returning * into e;
 return jsonb_build_object('id',e.id,'clubId',e.club_id,'kind',e.kind,'subjectId',e.subject_id,'payload',e.payload,'attempts',e.attempts,'leaseToken',e.lease_token,'leaseUntil',e.lease_until);
end $$;

create or replace function public.center_finish_event(p_event_id uuid, p_lease_token uuid, p_status text, p_error text default null)
returns jsonb language plpgsql security definer set search_path = public, private, extensions as $$
declare e public.center_events; next_status text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_status not in ('completed','skipped','failed') then raise exception 'Invalid event status'; end if;
 select * into e from public.center_events where id=p_event_id and status='processing' and lease_token=p_lease_token and lease_until > now() for update;
 if not found then raise exception 'Event lease mismatch' using errcode='40001'; end if;
 next_status := case when p_status='failed' and e.attempts < 8 then 'pending' else p_status end;
 update public.center_events set status=next_status,available_at=case when next_status='pending' then now()+make_interval(secs=>least(3600,2^least(e.attempts,10))) else available_at end,lease_until=null,lease_token=null,last_error=p_error where id=e.id returning * into e;
 return jsonb_build_object('id',e.id,'status',e.status,'attempts',e.attempts,'availableAt',e.available_at);
end $$;

revoke all on function public.center_prepare_payment(uuid,uuid,text), public.center_attach_checkout(uuid,text,timestamptz), public.center_apply_verified_payment(uuid,text,text,bigint), public.center_claim_event(uuid), public.center_finish_event(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.center_prepare_payment(uuid,uuid,text), public.center_attach_checkout(uuid,text,timestamptz), public.center_apply_verified_payment(uuid,text,text,bigint), public.center_claim_event(uuid), public.center_finish_event(uuid,uuid,text,text) to service_role;
commit;

begin;
create unique index center_message_request_idx on public.center_chat_messages(conversation_id,role,(metadata->>'requestKey')) where metadata ? 'requestKey';

create function public.center_chat_open(p_club_id uuid,p_conversation_id uuid,p_message text,p_request_key text) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare actor uuid:=auth.uid(); cid uuid:=p_conversation_id; completed public.center_chat_messages; history jsonb;
begin
 if not coalesce(private.center_can_work(p_club_id,actor),false) then raise exception 'Forbidden' using errcode='42501'; end if;
 if length(trim(p_message)) not between 1 and 10000 or length(p_request_key) not between 8 and 200 then raise exception 'Invalid chat request'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||p_club_id::text||p_request_key,0));
 if cid is null then
  select c.id into cid from public.center_conversations c join public.center_chat_messages m on m.conversation_id=c.id where c.actor_id=actor and c.club_id=p_club_id and m.role='user' and m.metadata->>'requestKey'=p_request_key limit 1;
 end if;
 if cid is null then insert into public.center_conversations(club_id,actor_id,title) values(p_club_id,actor,left(p_message,100)) returning id into cid;
 elsif not exists(select 1 from public.center_conversations c where c.id=cid and c.club_id=p_club_id and c.actor_id=actor) then raise exception 'Conversation not accessible' using errcode='42501'; end if;
 if exists(select 1 from public.center_chat_messages m where m.conversation_id=cid and m.role='user' and m.metadata->>'requestKey'=p_request_key and m.body<>p_message) then raise exception 'Request key reused'; end if;
 select * into completed from public.center_chat_messages m where m.conversation_id=cid and m.role='assistant' and m.metadata->>'requestKey'=p_request_key;
 if found then
  return jsonb_build_object('conversationId',cid,'recentMessages','[]'::jsonb,'completedTurn',jsonb_build_object('conversationId',cid,'answer',completed.body,'sources',completed.metadata->'sources','proposals',coalesce((select jsonb_agg(to_jsonb(p)) from public.center_proposals p where p.conversation_id=cid and p.id in(select jsonb_array_elements_text(completed.metadata->'proposalIds')::uuid)),'[]'::jsonb)));
 end if;
 if (select count(*) from public.center_chat_messages m join public.center_conversations c on c.id=m.conversation_id where c.actor_id=actor and m.role='user' and m.created_at>now()-interval '1 hour') >= 60 then raise exception 'Teacher assistant hourly limit reached'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('role',r.role,'content',r.body) order by r.created_at),'[]'::jsonb) into history from(select m.role,m.body,m.created_at from public.center_chat_messages m where m.conversation_id=cid order by m.created_at desc limit 12)r;
 insert into public.center_chat_messages(conversation_id,role,body,metadata) values(cid,'user',p_message,jsonb_build_object('requestKey',p_request_key)) on conflict do nothing;
 return jsonb_build_object('conversationId',cid,'recentMessages',history);
end $$;

create function public.center_chat_complete(p_club_id uuid,p_conversation_id uuid,p_answer text,p_sources jsonb,p_actions jsonb,p_request_key text) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare actor uuid:=auth.uid(); action jsonb; ids jsonb:='[]'; pid uuid; proposals jsonb; existing public.center_chat_messages;
begin
 if not coalesce(private.center_can_work(p_club_id,actor),false) or not exists(select 1 from public.center_conversations c where c.id=p_conversation_id and c.club_id=p_club_id and c.actor_id=actor) then raise exception 'Forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p_actions) is distinct from 'array' or jsonb_array_length(p_actions)>5 or jsonb_typeof(p_sources) is distinct from 'array' or jsonb_array_length(p_sources)>20 or length(p_answer) not between 1 and 50000 then raise exception 'Invalid assistant response'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_conversation_id::text||p_request_key,0));
 if not exists(select 1 from public.center_chat_messages m where m.conversation_id=p_conversation_id and m.role='user' and m.metadata->>'requestKey'=p_request_key) then raise exception 'Missing teacher request'; end if;
 select * into existing from public.center_chat_messages m where m.conversation_id=p_conversation_id and m.role='assistant' and m.metadata->>'requestKey'=p_request_key;
 if found then
  select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) into proposals from public.center_proposals p where p.id in(select jsonb_array_elements_text(existing.metadata->'proposalIds')::uuid);
  return jsonb_build_object('conversationId',p_conversation_id,'answer',existing.body,'sources',existing.metadata->'sources','proposals',proposals);
 end if;
 for action in select * from jsonb_array_elements(p_actions) loop
  if action->>'kind' not in ('note.create','trial.evaluate','trial.book','admission.stage','offer.create','schedule.reschedule','message.send','draft.create') or jsonb_typeof(action->'input') is distinct from 'object' then raise exception 'Invalid proposed operation'; end if;
  insert into public.center_proposals(club_id,actor_id,conversation_id,kind,input,requires_confirmation) values(p_club_id,actor,p_conversation_id,action->>'kind',action->'input',action->>'kind' not in ('note.create','trial.evaluate','draft.create')) returning id into pid;
  ids:=ids||jsonb_build_array(pid);
 end loop;
 insert into public.center_chat_messages(conversation_id,role,body,metadata) values(p_conversation_id,'assistant',p_answer,jsonb_build_object('requestKey',p_request_key,'sources',p_sources,'proposalIds',ids));
 update public.center_conversations set updated_at=now() where id=p_conversation_id;
 select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) into proposals from public.center_proposals p where p.id in(select jsonb_array_elements_text(ids)::uuid);
 return jsonb_build_object('conversationId',p_conversation_id,'answer',p_answer,'sources',p_sources,'proposals',proposals);
end $$;

create function public.center_decide_proposal(p_club_id uuid,p_proposal_id uuid,p_decision text) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare actor uuid:=auth.uid(); proposal public.center_proposals; execution_receipt jsonb;
begin
 if not coalesce(private.center_can_work(p_club_id,actor),false) then raise exception 'Forbidden' using errcode='42501'; end if;
 select * into proposal from public.center_proposals p where p.id=p_proposal_id and p.club_id=p_club_id and p.actor_id=actor for update;
 if not found then raise exception 'Proposal not accessible' using errcode='42501'; end if;
 if p_decision not in ('automatic','confirm','cancel') then raise exception 'Invalid decision'; end if;
 if proposal.status='executed' then return proposal.receipt; end if;
 if proposal.status<>'pending' then raise exception 'Proposal no longer pending'; end if;
 if p_decision='cancel' then update public.center_proposals set status='cancelled' where id=proposal.id; return null; end if;
 if proposal.expires_at <= now() then raise exception 'Proposal expired; request a fresh plan'; end if;
 if p_decision='automatic' and (proposal.requires_confirmation or proposal.kind not in ('note.create','trial.evaluate','draft.create')) then raise exception 'Explicit confirmation required' using errcode='42501'; end if;
 -- Command layer rechecks class/student access and expected revisions now.
 execution_receipt:=public.center_execute_command(p_club_id,proposal.kind,proposal.input,'proposal:'||proposal.id::text);
 update public.center_proposals set status='executed',receipt=execution_receipt where id=proposal.id;
 return execution_receipt;
end $$;

create function public.center_chat_history(p_club_id uuid,p_conversation_id uuid) returns jsonb language plpgsql stable security definer set search_path=public,private as $$
begin
 if not coalesce(private.center_can_work(p_club_id,auth.uid()),false) or not exists(select 1 from public.center_conversations c where c.id=p_conversation_id and c.club_id=p_club_id and c.actor_id=auth.uid()) then raise exception 'Forbidden' using errcode='42501'; end if;
 return jsonb_build_object('conversationId',p_conversation_id,'messages',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from(select * from public.center_chat_messages m where m.conversation_id=p_conversation_id order by m.created_at desc limit 100)t),'[]'::jsonb),'proposals',coalesce((select jsonb_agg(to_jsonb(p)) from public.center_proposals p where p.conversation_id=p_conversation_id),'[]'::jsonb));
end $$;
revoke all on function public.center_chat_open(uuid,uuid,text,text),public.center_chat_complete(uuid,uuid,text,jsonb,jsonb,text),public.center_decide_proposal(uuid,uuid,text),public.center_chat_history(uuid,uuid) from public,anon;
grant execute on function public.center_chat_open(uuid,uuid,text,text),public.center_chat_complete(uuid,uuid,text,jsonb,jsonb,text),public.center_decide_proposal(uuid,uuid,text),public.center_chat_history(uuid,uuid) to authenticated;
commit;

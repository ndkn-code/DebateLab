alter table public.chat_messages
  add column if not exists metadata jsonb;

comment on column public.chat_messages.metadata is
  'Optional structured rendering metadata for AI coach responses. Plain content remains the fallback.';

-- Keep the private OAuth vault protected by RLS as well as schema/table ACLs.
-- Access remains through the existing narrowly granted security-definer RPCs.
begin;

alter table private.center_credentials enable row level security;
alter table private.center_oauth_intents enable row level security;
alter table private.center_token_refresh_leases enable row level security;

commit;

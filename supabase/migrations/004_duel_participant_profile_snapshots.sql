alter table public.debate_duel_participants
  add column if not exists display_name_snapshot text not null default '',
  add column if not exists avatar_url_snapshot text;

update public.debate_duel_participants p
set display_name_snapshot = coalesce(pr.display_name, ''),
    avatar_url_snapshot = pr.avatar_url
from public.profiles pr
where pr.id = p.user_id
  and (p.display_name_snapshot = '' or p.display_name_snapshot is null);

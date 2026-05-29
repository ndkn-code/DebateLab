-- Leaderboard FK index hardening after production advisor review.

create index if not exists idx_club_join_codes_issued_by
  on public.club_join_codes(issued_by)
  where issued_by is not null;

create index if not exists idx_leaderboard_user_leagues_last_season
  on public.leaderboard_user_leagues(last_season_id)
  where last_season_id is not null;

create index if not exists idx_leaderboard_flags_created_by
  on public.leaderboard_xp_event_flags(created_by)
  where created_by is not null;

create index if not exists idx_leaderboard_flags_resolved_by
  on public.leaderboard_xp_event_flags(resolved_by)
  where resolved_by is not null;

create index if not exists idx_leaderboard_audit_actor_user
  on public.leaderboard_admin_audit_log(actor_user_id)
  where actor_user_id is not null;

create index if not exists idx_leaderboard_audit_target_user
  on public.leaderboard_admin_audit_log(target_user_id)
  where target_user_id is not null;

create index if not exists idx_leaderboard_audit_xp_event
  on public.leaderboard_admin_audit_log(xp_event_id)
  where xp_event_id is not null;

create index if not exists idx_leaderboard_audit_flag
  on public.leaderboard_admin_audit_log(flag_id)
  where flag_id is not null;

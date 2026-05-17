-- Club OS V2 advisor hardening: avoid public bucket listing and cover audit foreign keys.

drop policy if exists "Club logos are publicly readable" on storage.objects;

create index if not exists idx_club_invitations_invited_by
  on public.club_invitations(invited_by)
  where invited_by is not null;

create index if not exists idx_club_invitations_accepted_by
  on public.club_invitations(accepted_by)
  where accepted_by is not null;

create index if not exists idx_club_events_created_by
  on public.club_events(created_by)
  where created_by is not null;

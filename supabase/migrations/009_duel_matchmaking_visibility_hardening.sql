-- Keep hidden matchmaking rooms out of the pre-join lobby visibility path.
-- Custom friend rooms remain discoverable before joining so share links work.

drop policy if exists "Participants can view debate duels" on public.debate_duels;
create policy "Participants can view debate duels"
  on public.debate_duels for select
  using (
    public.can_access_duel(id, auth.uid())
    or (
      coalesce(duel_kind, 'custom') = 'custom'
      and status = 'lobby'
      and expires_at > now()
    )
  );

drop policy if exists "Participants can view duel participants" on public.debate_duel_participants;
create policy "Participants can view duel participants"
  on public.debate_duel_participants for select
  using (
    public.can_access_duel(duel_id, auth.uid())
    or exists (
      select 1
      from public.debate_duels d
      where d.id = duel_id
        and coalesce(d.duel_kind, 'custom') = 'custom'
        and d.status = 'lobby'
        and d.expires_at > now()
    )
  );

create index maintenance_settings_updated_by_idx
  on public.maintenance_settings(updated_by);

drop policy "Admins can write maintenance settings"
  on public.maintenance_settings;

create policy "Admins can insert maintenance settings"
  on public.maintenance_settings
  for insert
  to authenticated
  with check (
    id = 'singleton'
    and private.is_admin((select auth.uid()))
  );

create policy "Admins can update maintenance settings"
  on public.maintenance_settings
  for update
  to authenticated
  using (private.is_admin((select auth.uid())))
  with check (
    id = 'singleton'
    and private.is_admin((select auth.uid()))
  );

create policy "Admins can delete maintenance settings"
  on public.maintenance_settings
  for delete
  to authenticated
  using (private.is_admin((select auth.uid())));

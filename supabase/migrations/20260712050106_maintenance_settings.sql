-- WS-L3: native, singleton maintenance-mode configuration.
-- Public reads power the unauthenticated splash. Only admins may mutate it.

create table public.maintenance_settings (
  id text primary key default 'singleton'
    constraint maintenance_settings_singleton_check check (id = 'singleton'),
  mode text not null default 'off'
    constraint maintenance_settings_mode_check check (mode in ('off', 'banner', 'full')),
  banner_message_en text not null,
  banner_message_vi text not null,
  full_message_en text not null,
  full_message_vi text not null,
  expected_done_at timestamptz,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.maintenance_settings is
  'Singleton public maintenance state. Messages and timing are intentionally non-sensitive.';
comment on column public.maintenance_settings.mode is
  'off = normal operation, banner = in-app notice, full = production traffic gate.';

alter table public.maintenance_settings enable row level security;

grant select on table public.maintenance_settings to anon, authenticated;
grant insert, update, delete on table public.maintenance_settings to authenticated;
grant all on table public.maintenance_settings to service_role;

create policy "Maintenance settings are publicly readable"
  on public.maintenance_settings
  for select
  to anon, authenticated
  using (true);

create policy "Admins can write maintenance settings"
  on public.maintenance_settings
  for all
  to authenticated
  using (private.is_admin((select auth.uid())))
  with check (
    id = 'singleton'
    and private.is_admin((select auth.uid()))
  );

insert into public.maintenance_settings (
  id,
  mode,
  banner_message_en,
  banner_message_vi,
  full_message_en,
  full_message_vi,
  expected_done_at,
  updated_by
) values (
  'singleton',
  'off',
  'A quick heads-up: Thinkfy is getting a tune-up. Everything stays available while we finish.',
  'Thông báo nhanh: Thinkfy đang được tinh chỉnh. Bạn vẫn có thể sử dụng ứng dụng trong lúc chúng mình hoàn tất.',
  'We are making Thinkfy better and will be back shortly. Your progress is safe.',
  'Thinkfy đang được nâng cấp và sẽ sớm trở lại. Tiến độ của bạn vẫn được bảo toàn.',
  null,
  null
);

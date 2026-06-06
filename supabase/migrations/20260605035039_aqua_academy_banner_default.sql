-- Aqua Academy palette rollout: update profile banner defaults without
-- overwriting custom user-selected banner colors.

alter table public.profiles
  alter column banner_color set default '#00B8D9';

update public.profiles
set banner_color = '#00B8D9'
where lower(banner_color) in ('#4d86f7', '#11845f');

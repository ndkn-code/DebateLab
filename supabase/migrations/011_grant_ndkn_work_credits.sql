-- One-off credit grant requested for ndkn.work@gmail.com.
do $$
declare
  target_profile public.profiles%rowtype;
  grant_amount integer;
  target_balance integer := 100000;
begin
  select *
  into target_profile
  from public.profiles
  where email = 'ndkn.work@gmail.com'
  limit 1;

  if not found then
    raise notice 'Profile not found for ndkn.work@gmail.com; skipping credit grant.';
    return;
  end if;

  grant_amount := target_balance - coalesce(target_profile.orb_balance, 0);

  if grant_amount = 0 then
    raise notice 'Profile ndkn.work@gmail.com already has 100000 credits.';
    return;
  end if;

  update public.profiles
  set orb_balance = target_balance
  where id = target_profile.id;

  insert into public.orb_transactions (
    user_id,
    amount,
    type,
    reference_id,
    balance_after
  )
  values (
    target_profile.id,
    grant_amount,
    'admin_grant',
    null,
    target_balance
  );
end $$;

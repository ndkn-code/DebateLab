-- ============================================================
-- Orb Economy & Referral System
-- Adds token balance, referral codes, and transaction tracking
-- ============================================================

-- 1. NEW COLUMNS ON PROFILES
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS orb_balance integer NOT NULL DEFAULT 5;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);

-- 2. REFERRALS TABLE
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.profiles(id),
  referee_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'qualified', 'credited', 'rejected')),
  referrer_orbs_awarded integer NOT NULL DEFAULT 0,
  referee_orbs_awarded integer NOT NULL DEFAULT 0,
  qualified_at timestamptz,
  credited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON public.referrals(referee_id);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referee_id);

-- 3. ORB TRANSACTIONS TABLE (audit log)
CREATE TABLE IF NOT EXISTS public.orb_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  amount integer NOT NULL,
  type text NOT NULL CHECK (type IN ('signup_bonus', 'referral_reward', 'referral_bonus', 'practice_quick', 'practice_full', 'admin_grant')),
  reference_id uuid,
  balance_after integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orb_transactions_user ON public.orb_transactions(user_id, created_at DESC);

ALTER TABLE public.orb_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON public.orb_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- 4. HELPER FUNCTIONS

-- Generate unique 6-char referral code (excludes ambiguous chars: 0,1,I,O)
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i integer;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = code);
  END LOOP;
  RETURN code;
END;
$$;

-- Atomic orb balance adjustment with transaction logging
CREATE OR REPLACE FUNCTION public.adjust_orb_balance(
  p_user_id uuid,
  p_amount integer,
  p_type text,
  p_reference_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new_balance integer;
BEGIN
  UPDATE public.profiles
  SET orb_balance = LEAST(50, GREATEST(0, orb_balance + p_amount))
  WHERE id = p_user_id
  RETURNING orb_balance INTO v_new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', p_user_id;
  END IF;

  INSERT INTO public.orb_transactions (user_id, amount, type, reference_id, balance_after)
  VALUES (p_user_id, p_amount, p_type, p_reference_id, v_new_balance);

  RETURN v_new_balance;
END;
$$;

-- Credit a qualified referral (awards orbs to both users)
CREATE OR REPLACE FUNCTION public.credit_referral(p_referral_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  ref public.referrals%ROWTYPE;
  referrer_count integer;
BEGIN
  SELECT * INTO ref
  FROM public.referrals
  WHERE id = p_referral_id AND status = 'qualified'
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  -- Check referrer cap (max 20 credited referrals)
  SELECT count(*) INTO referrer_count
  FROM public.referrals
  WHERE referrer_id = ref.referrer_id AND status = 'credited';

  IF referrer_count >= 20 THEN
    UPDATE public.referrals SET status = 'rejected' WHERE id = p_referral_id;
    RETURN;
  END IF;

  -- Credit both users
  PERFORM public.adjust_orb_balance(ref.referrer_id, 3, 'referral_reward', p_referral_id);
  PERFORM public.adjust_orb_balance(ref.referee_id, 3, 'referral_bonus', p_referral_id);

  UPDATE public.referrals
  SET status = 'credited',
      referrer_orbs_awarded = 3,
      referee_orbs_awarded = 3,
      credited_at = now()
  WHERE id = p_referral_id;
END;
$$;

-- 5. UPDATE handle_new_user TRIGGER
-- Now also generates referral code, sets orb_balance, and logs signup bonus
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_referral_code text;
BEGIN
  -- Generate unique referral code
  v_referral_code := public.generate_referral_code();

  INSERT INTO public.profiles (id, email, display_name, referral_code, orb_balance)
  VALUES (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      split_part(new.email, '@', 1)
    ),
    v_referral_code,
    5
  );

  -- Log the signup bonus transaction
  INSERT INTO public.orb_transactions (user_id, amount, type, balance_after)
  VALUES (new.id, 5, 'signup_bonus', 5);

  RETURN new;
END;
$$;

-- 6. BACKFILL: Generate referral codes for existing users who don't have one
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE referral_code IS NULL LOOP
    UPDATE public.profiles
    SET referral_code = public.generate_referral_code()
    WHERE id = r.id;
  END LOOP;
END;
$$;

-- Backfill: Log signup bonus for existing users who have no orb_transactions
INSERT INTO public.orb_transactions (user_id, amount, type, balance_after)
SELECT p.id, 5, 'signup_bonus', p.orb_balance
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.orb_transactions t WHERE t.user_id = p.id
);

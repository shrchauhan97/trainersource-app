-- Track when a user has set their OWN password (vs. the OTP placeholder
-- Supabase auto-populates in auth.users.encrypted_password during signup).
--
-- Backstory: 2026-05-17 prod verification revealed that
-- `user_has_password(uid)` returned true for every user, because Supabase
-- populates encrypted_password with a non-NULL hash during OTP signup
-- (the value is unknowable to the user, so they can't actually sign in
-- with it — but `IS NOT NULL` evaluates to true regardless). Result:
-- the post-magic-link set-password gate never fired in production.
--
-- Fix: track password state in OUR own column on admins/trainers,
-- written by the /account/set-password server action. NULL means
-- "no password set" → route the user through the gate. Timestamped so we
-- can also surface "last password change" if the product ever needs it.
--
-- No backfill: existing users genuinely do not have user-set passwords
-- in our system. They will hit the gate on their next sign-in, set a
-- password once, and never see it again. The one exception is anyone
-- who previously used Supabase's legacy recovery flow to set a password
-- before this PR — they will be prompted once more, which is mildly
-- annoying but strictly correct (we have no signal to distinguish them
-- from OTP-only users).

BEGIN;

ALTER TABLE public.admins   ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ;
ALTER TABLE public.trainers ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ;

COMMENT ON COLUMN public.admins.password_set_at IS
  'Set by /account/set-password server action when the user explicitly chooses a password. NULL means OTP-only — gate them through set-password on next sign-in. See migration 2026-05-18.';
COMMENT ON COLUMN public.trainers.password_set_at IS
  'Set by /account/set-password server action when the user explicitly chooses a password. NULL means OTP-only — gate them through set-password on next sign-in. See migration 2026-05-18.';

-- Rewrite user_has_password(uid): no longer trusts auth.users.encrypted_password.
-- Looks up the caller's email via auth.users (constrained to self via auth.uid()
-- to preserve the no-enumeration property) and checks our own password_set_at
-- columns. UNION because the same email cannot live in both tables today, but
-- the function tolerates the possibility for future-proofing.
CREATE OR REPLACE FUNCTION public.user_has_password(uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = uid AND u.id = auth.uid()
      AND (
        EXISTS (
          SELECT 1 FROM public.admins   a WHERE lower(a.email) = lower(u.email) AND a.password_set_at IS NOT NULL
        )
        OR EXISTS (
          SELECT 1 FROM public.trainers t WHERE lower(t.email) = lower(u.email) AND t.password_set_at IS NOT NULL
        )
      )
  )
$$;

-- Email-keyed variant for the pre-login allow-list check (no session yet,
-- so auth.uid() is null and we can't use the uid-keyed function). Service-
-- role only — never exposed to anon/authenticated. Tolerates the same
-- "could be in either table" shape.
CREATE OR REPLACE FUNCTION public.user_has_password_by_email(addr text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins   WHERE lower(email) = lower(trim(addr)) AND password_set_at IS NOT NULL
    UNION ALL
    SELECT 1 FROM public.trainers WHERE lower(email) = lower(trim(addr)) AND password_set_at IS NOT NULL
  )
$$;

-- Re-apply EXECUTE grants (CREATE OR REPLACE preserves them, but be explicit
-- to match the original migration's hygiene).
REVOKE EXECUTE ON FUNCTION public.user_has_password(uuid)          FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.user_has_password(uuid)          TO   authenticated;
REVOKE EXECUTE ON FUNCTION public.user_has_password_by_email(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.user_has_password_by_email(text) TO   service_role;

COMMIT;

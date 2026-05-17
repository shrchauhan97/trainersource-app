-- user_has_password(uid) — RLS-safe wrapper to check whether a Supabase
-- auth user has a password set (vs. magic-link only).
--
-- Used by the post-magic-link callback (and any "do I need to set a
-- password?" check) to decide whether to route the user to
-- /account/set-password before /dashboard or /admin.
--
-- auth.users is not directly readable by anon/authenticated, so we wrap
-- the lookup in a SECURITY DEFINER function. It is HARD-CONSTRAINED to
-- self-only via `id = auth.uid()` inside the body — passing any other
-- uuid returns NULL (no rows match). Do not remove the `auth.uid()`
-- predicate: it is the difference between "self password-status check"
-- and a user-enumeration oracle.

CREATE OR REPLACE FUNCTION public.user_has_password(uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth, pg_temp
AS $$
  -- Self-only: caller can only check whether THEIR own auth row has a
  -- password set. Passing any other uuid returns NULL (no rows match).
  SELECT encrypted_password IS NOT NULL
  FROM auth.users
  WHERE id = uid AND id = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION public.user_has_password(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.user_has_password(uuid) TO authenticated;

-- Email-keyed variant for pre-login pre-check (no session yet, so no
-- JWT uid available). Returns:
--   true  → auth user exists AND has a password set
--   false → auth user exists AND has no password set (magic-link only)
--   NULL  → no auth user with that email (treat as no password)
-- Service-role only — never exposed to anon/authenticated.

CREATE OR REPLACE FUNCTION public.user_has_password_by_email(addr text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth, pg_temp
AS $$
  SELECT encrypted_password IS NOT NULL
  FROM auth.users
  WHERE lower(email) = lower(trim(addr))
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.user_has_password_by_email(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.user_has_password_by_email(text) TO service_role;

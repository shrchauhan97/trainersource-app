-- Restore EXECUTE on RLS helper functions for `authenticated`.
--
-- Wave 7 (2026-05-16) revoked EXECUTE on `is_admin()` and
-- `current_trainer_id()` from anon/authenticated on the reasoning that
-- these were "only called via service role". That reasoning was wrong:
-- both functions are referenced inside RLS policy USING/WITH CHECK
-- expressions on tables `authenticated` users read directly (see
-- supabase/rls.sql for the authoritative policy list — names there
-- can rename, so don't grep these tables by name from here).
--
-- Permission check happens up front in the caller's role, BEFORE the
-- function body runs. SECURITY DEFINER only governs the privileges the
-- body executes with; it doesn't waive the caller's need for EXECUTE.
-- So revoking EXECUTE from `authenticated` breaks RLS policy evaluation
-- the moment an authenticated user reads a table whose policy invokes
-- these helpers.
--
-- Symptom before fix: any authenticated user selecting from `admins`
-- or `trainers` (e.g. /auth/callback → getUserRole) gets:
--   ERROR  42501  permission denied for function is_admin
-- which throws out of the route handler as a 500.
--
-- anon is intentionally still denied (no anon SELECT on admins/trainers
-- in any policy, so anon never triggers the helper).

GRANT EXECUTE ON FUNCTION public.is_admin()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_trainer_id()  TO authenticated;

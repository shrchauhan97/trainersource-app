-- RLS policies for the onboarding v2 tables introduced in 0002.
--
-- Why now: the app uses the anon-keyed Supabase client with cookie-derived
-- JWTs (src/lib/supabase/server.ts + client.ts). The anon key is exposed in
-- the browser bundle, so any authenticated user can issue direct queries
-- against these tables. Without RLS, that lets one trainer read another
-- trainer's payout details / signed agreement / quiz attempts.
--
-- Pattern mirrors the storage policies already in 0002_onboarding.sql:
--   trainer-self via auth.jwt() ->> 'email' ↔ trainers.email
--   admin-SELECT via the admins table (HQ tooling reads onboarding state)
--
-- Idempotent: ENABLE ROW LEVEL SECURITY is a no-op when already enabled,
-- and each CREATE POLICY is preceded by DROP POLICY IF EXISTS so re-runs
-- are safe.

-- ---------------------------------------------------------------------------
-- trainer_application_details
-- ---------------------------------------------------------------------------
alter table trainer_application_details enable row level security;

drop policy if exists "trainer_application_details: trainer self select" on trainer_application_details;
create policy "trainer_application_details: trainer self select"
  on trainer_application_details for select to authenticated
  using (
    exists (
      select 1 from trainers
      where trainers.id = trainer_application_details.trainer_id
        and trainers.email = (auth.jwt() ->> 'email')
    )
  );

drop policy if exists "trainer_application_details: trainer self insert" on trainer_application_details;
create policy "trainer_application_details: trainer self insert"
  on trainer_application_details for insert to authenticated
  with check (
    exists (
      select 1 from trainers
      where trainers.id = trainer_application_details.trainer_id
        and trainers.email = (auth.jwt() ->> 'email')
    )
  );

drop policy if exists "trainer_application_details: trainer self update" on trainer_application_details;
create policy "trainer_application_details: trainer self update"
  on trainer_application_details for update to authenticated
  using (
    exists (
      select 1 from trainers
      where trainers.id = trainer_application_details.trainer_id
        and trainers.email = (auth.jwt() ->> 'email')
    )
  )
  with check (
    exists (
      select 1 from trainers
      where trainers.id = trainer_application_details.trainer_id
        and trainers.email = (auth.jwt() ->> 'email')
    )
  );

drop policy if exists "trainer_application_details: admin select" on trainer_application_details;
create policy "trainer_application_details: admin select"
  on trainer_application_details for select to authenticated
  using (
    exists (
      select 1 from admins
      where admins.email = (auth.jwt() ->> 'email')
    )
  );

-- ---------------------------------------------------------------------------
-- trainer_qualifications  (DELETE allowed because saveQualifications wipes
-- and replaces the whole set per src/app/onboarding/application/actions.ts)
-- ---------------------------------------------------------------------------
alter table trainer_qualifications enable row level security;

drop policy if exists "trainer_qualifications: trainer self select" on trainer_qualifications;
create policy "trainer_qualifications: trainer self select"
  on trainer_qualifications for select to authenticated
  using (
    exists (
      select 1 from trainers
      where trainers.id = trainer_qualifications.trainer_id
        and trainers.email = (auth.jwt() ->> 'email')
    )
  );

drop policy if exists "trainer_qualifications: trainer self insert" on trainer_qualifications;
create policy "trainer_qualifications: trainer self insert"
  on trainer_qualifications for insert to authenticated
  with check (
    exists (
      select 1 from trainers
      where trainers.id = trainer_qualifications.trainer_id
        and trainers.email = (auth.jwt() ->> 'email')
    )
  );

drop policy if exists "trainer_qualifications: trainer self update" on trainer_qualifications;
create policy "trainer_qualifications: trainer self update"
  on trainer_qualifications for update to authenticated
  using (
    exists (
      select 1 from trainers
      where trainers.id = trainer_qualifications.trainer_id
        and trainers.email = (auth.jwt() ->> 'email')
    )
  )
  with check (
    exists (
      select 1 from trainers
      where trainers.id = trainer_qualifications.trainer_id
        and trainers.email = (auth.jwt() ->> 'email')
    )
  );

drop policy if exists "trainer_qualifications: trainer self delete" on trainer_qualifications;
create policy "trainer_qualifications: trainer self delete"
  on trainer_qualifications for delete to authenticated
  using (
    exists (
      select 1 from trainers
      where trainers.id = trainer_qualifications.trainer_id
        and trainers.email = (auth.jwt() ->> 'email')
    )
  );

drop policy if exists "trainer_qualifications: admin select" on trainer_qualifications;
create policy "trainer_qualifications: admin select"
  on trainer_qualifications for select to authenticated
  using (
    exists (
      select 1 from admins
      where admins.email = (auth.jwt() ->> 'email')
    )
  );

-- ---------------------------------------------------------------------------
-- trainer_training_progress
-- ---------------------------------------------------------------------------
alter table trainer_training_progress enable row level security;

drop policy if exists "trainer_training_progress: trainer self select" on trainer_training_progress;
create policy "trainer_training_progress: trainer self select"
  on trainer_training_progress for select to authenticated
  using (
    exists (
      select 1 from trainers
      where trainers.id = trainer_training_progress.trainer_id
        and trainers.email = (auth.jwt() ->> 'email')
    )
  );

drop policy if exists "trainer_training_progress: trainer self insert" on trainer_training_progress;
create policy "trainer_training_progress: trainer self insert"
  on trainer_training_progress for insert to authenticated
  with check (
    exists (
      select 1 from trainers
      where trainers.id = trainer_training_progress.trainer_id
        and trainers.email = (auth.jwt() ->> 'email')
    )
  );

drop policy if exists "trainer_training_progress: trainer self update" on trainer_training_progress;
create policy "trainer_training_progress: trainer self update"
  on trainer_training_progress for update to authenticated
  using (
    exists (
      select 1 from trainers
      where trainers.id = trainer_training_progress.trainer_id
        and trainers.email = (auth.jwt() ->> 'email')
    )
  )
  with check (
    exists (
      select 1 from trainers
      where trainers.id = trainer_training_progress.trainer_id
        and trainers.email = (auth.jwt() ->> 'email')
    )
  );

drop policy if exists "trainer_training_progress: admin select" on trainer_training_progress;
create policy "trainer_training_progress: admin select"
  on trainer_training_progress for select to authenticated
  using (
    exists (
      select 1 from admins
      where admins.email = (auth.jwt() ->> 'email')
    )
  );

-- ---------------------------------------------------------------------------
-- trainer_quiz_attempts  (INSERT-only for trainers; rows are an audit trail)
-- ---------------------------------------------------------------------------
alter table trainer_quiz_attempts enable row level security;

drop policy if exists "trainer_quiz_attempts: trainer self select" on trainer_quiz_attempts;
create policy "trainer_quiz_attempts: trainer self select"
  on trainer_quiz_attempts for select to authenticated
  using (
    exists (
      select 1 from trainers
      where trainers.id = trainer_quiz_attempts.trainer_id
        and trainers.email = (auth.jwt() ->> 'email')
    )
  );

drop policy if exists "trainer_quiz_attempts: trainer self insert" on trainer_quiz_attempts;
create policy "trainer_quiz_attempts: trainer self insert"
  on trainer_quiz_attempts for insert to authenticated
  with check (
    exists (
      select 1 from trainers
      where trainers.id = trainer_quiz_attempts.trainer_id
        and trainers.email = (auth.jwt() ->> 'email')
    )
  );

drop policy if exists "trainer_quiz_attempts: admin select" on trainer_quiz_attempts;
create policy "trainer_quiz_attempts: admin select"
  on trainer_quiz_attempts for select to authenticated
  using (
    exists (
      select 1 from admins
      where admins.email = (auth.jwt() ->> 'email')
    )
  );

-- ---------------------------------------------------------------------------
-- trainer_payout_details  (most sensitive: bank + crypto. Plaintext-PII
-- flagged separately for pgsodium follow-up; RLS bounds blast radius now.)
-- ---------------------------------------------------------------------------
alter table trainer_payout_details enable row level security;

drop policy if exists "trainer_payout_details: trainer self select" on trainer_payout_details;
create policy "trainer_payout_details: trainer self select"
  on trainer_payout_details for select to authenticated
  using (
    exists (
      select 1 from trainers
      where trainers.id = trainer_payout_details.trainer_id
        and trainers.email = (auth.jwt() ->> 'email')
    )
  );

drop policy if exists "trainer_payout_details: trainer self insert" on trainer_payout_details;
create policy "trainer_payout_details: trainer self insert"
  on trainer_payout_details for insert to authenticated
  with check (
    exists (
      select 1 from trainers
      where trainers.id = trainer_payout_details.trainer_id
        and trainers.email = (auth.jwt() ->> 'email')
    )
  );

drop policy if exists "trainer_payout_details: trainer self update" on trainer_payout_details;
create policy "trainer_payout_details: trainer self update"
  on trainer_payout_details for update to authenticated
  using (
    exists (
      select 1 from trainers
      where trainers.id = trainer_payout_details.trainer_id
        and trainers.email = (auth.jwt() ->> 'email')
    )
  )
  with check (
    exists (
      select 1 from trainers
      where trainers.id = trainer_payout_details.trainer_id
        and trainers.email = (auth.jwt() ->> 'email')
    )
  );

drop policy if exists "trainer_payout_details: admin select" on trainer_payout_details;
create policy "trainer_payout_details: admin select"
  on trainer_payout_details for select to authenticated
  using (
    exists (
      select 1 from admins
      where admins.email = (auth.jwt() ->> 'email')
    )
  );

-- ---------------------------------------------------------------------------
-- trainer_agreement
-- ---------------------------------------------------------------------------
alter table trainer_agreement enable row level security;

drop policy if exists "trainer_agreement: trainer self select" on trainer_agreement;
create policy "trainer_agreement: trainer self select"
  on trainer_agreement for select to authenticated
  using (
    exists (
      select 1 from trainers
      where trainers.id = trainer_agreement.trainer_id
        and trainers.email = (auth.jwt() ->> 'email')
    )
  );

drop policy if exists "trainer_agreement: trainer self insert" on trainer_agreement;
create policy "trainer_agreement: trainer self insert"
  on trainer_agreement for insert to authenticated
  with check (
    exists (
      select 1 from trainers
      where trainers.id = trainer_agreement.trainer_id
        and trainers.email = (auth.jwt() ->> 'email')
    )
  );

drop policy if exists "trainer_agreement: trainer self update" on trainer_agreement;
create policy "trainer_agreement: trainer self update"
  on trainer_agreement for update to authenticated
  using (
    exists (
      select 1 from trainers
      where trainers.id = trainer_agreement.trainer_id
        and trainers.email = (auth.jwt() ->> 'email')
    )
  )
  with check (
    exists (
      select 1 from trainers
      where trainers.id = trainer_agreement.trainer_id
        and trainers.email = (auth.jwt() ->> 'email')
    )
  );

drop policy if exists "trainer_agreement: admin select" on trainer_agreement;
create policy "trainer_agreement: admin select"
  on trainer_agreement for select to authenticated
  using (
    exists (
      select 1 from admins
      where admins.email = (auth.jwt() ->> 'email')
    )
  );

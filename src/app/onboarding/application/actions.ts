'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { advanceOnboardingStep } from '../_lib/state';
import { uploadOnboardingFile } from '../_lib/storage';

// Resolve the current trainer via the authenticated session. We never trust a
// client-supplied trainerId for writes — only the email match against the
// auth session decides which row the action mutates.
async function resolveTrainerId(): Promise<{ trainerId?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: 'You must be signed in.' };

  const { data: trainer, error } = await supabase
    .from('trainers')
    .select('id, status')
    .eq('email', user.email)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!trainer) return { error: 'Trainer not found.' };
  if (trainer.status !== 'onboarding') {
    return { error: 'Your onboarding session is no longer active.' };
  }
  return { trainerId: trainer.id };
}

function strOrNull(v: FormDataEntryValue | null): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length === 0 ? null : s;
}

function intOrNull(v: FormDataEntryValue | null): number | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (s.length === 0) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

export type ContactState = {
  ok: boolean;
  error?: string;
};

// Save the Contact tab. First/last name + onboarding-only fields land in
// trainer_application_details. Country/City update the canonical trainers row
// (those columns predate onboarding v2 and are the system of record).
export async function saveContactDetails(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const { trainerId, error } = await resolveTrainerId();
  if (error || !trainerId) return { ok: false, error: error ?? 'Unauthorized' };

  const supabase = await createClient();

  const first_name = strOrNull(formData.get('first_name'));
  const last_name = strOrNull(formData.get('last_name'));
  const country = strOrNull(formData.get('country'));
  const city = strOrNull(formData.get('city'));
  const zip = strOrNull(formData.get('zip'));
  const profession = strOrNull(formData.get('profession'));
  const experience_years = intOrNull(formData.get('experience_years'));
  const specialty = strOrNull(formData.get('specialty'));
  const years_in_current_city = intOrNull(formData.get('years_in_current_city'));
  const instagram = strOrNull(formData.get('instagram'));
  const facebook_or_other = strOrNull(formData.get('facebook_or_other'));
  const tiktok = strOrNull(formData.get('tiktok'));
  const linkedin = strOrNull(formData.get('linkedin'));

  // trainers row owns country/city historically; keep them in sync.
  if (country !== null || city !== null) {
    const update: Record<string, string> = {};
    if (country !== null) update.country = country;
    if (city !== null) update.city = city;
    if (Object.keys(update).length > 0) {
      const { error: trainerErr } = await supabase
        .from('trainers')
        .update(update)
        .eq('id', trainerId);
      if (trainerErr) return { ok: false, error: trainerErr.message };
    }
  }

  const { error: appErr } = await supabase
    .from('trainer_application_details')
    .upsert(
      {
        trainer_id: trainerId,
        first_name,
        last_name,
        zip,
        profession,
        experience_years,
        specialty,
        years_in_current_city,
        instagram,
        facebook_or_other,
        tiktok,
        linkedin,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'trainer_id' },
    );
  if (appErr) return { ok: false, error: appErr.message };

  revalidatePath('/onboarding/application');
  return { ok: true };
}

export type QualificationsState = {
  ok: boolean;
  error?: string;
};

// One-shot save: replace all qualifications for this trainer in a single
// transaction-ish flow (delete + insert). Per-row CRUD is more code for v1
// without a real win — the user's mental model is "save the table".
export async function saveQualifications(
  _prev: QualificationsState,
  formData: FormData,
): Promise<QualificationsState> {
  const { trainerId, error } = await resolveTrainerId();
  if (error || !trainerId) return { ok: false, error: error ?? 'Unauthorized' };

  const supabase = await createClient();

  // Form encodes each row as parallel arrays via [] suffix:
  // certificate_name[], issuing_body[], date_of_issue[], is_current[], upload[]
  const names = formData.getAll('certificate_name[]');
  const bodies = formData.getAll('issuing_body[]');
  const dates = formData.getAll('date_of_issue[]');
  // For checkboxes we use a parallel `is_current_<idx>` field to avoid the
  // browser-omits-unchecked problem (FormData drops unchecked checkboxes,
  // breaking parallel arrays). Each row's index is encoded explicitly.
  const uploads = formData.getAll('upload[]');

  const rows: Array<{
    certificate_name: string;
    issuing_body: string | null;
    date_of_issue: string | null;
    is_current: boolean;
    upload?: File;
  }> = [];

  const len = Math.max(names.length, bodies.length, dates.length, uploads.length);
  for (let i = 0; i < len; i++) {
    const name = strOrNull(names[i] ?? null);
    if (!name) continue; // Skip empty rows entirely.
    const body = strOrNull(bodies[i] ?? null);
    const date = strOrNull(dates[i] ?? null);
    const isCurrent = strOrNull(formData.get(`is_current_${i}`)) === 'on';
    const file = uploads[i];
    rows.push({
      certificate_name: name,
      issuing_body: body,
      date_of_issue: date,
      is_current: isCurrent,
      upload: file instanceof File && file.size > 0 ? file : undefined,
    });
  }

  // Wipe and replace. Trainer can only see their own rows (RLS) so this is safe.
  const { error: delErr } = await supabase
    .from('trainer_qualifications')
    .delete()
    .eq('trainer_id', trainerId);
  if (delErr) return { ok: false, error: delErr.message };

  if (rows.length === 0) {
    revalidatePath('/onboarding/application');
    return { ok: true };
  }

  // Upload any files first so we can persist their paths in one insert batch.
  const inserts: Array<{
    trainer_id: string;
    certificate_name: string;
    issuing_body: string | null;
    date_of_issue: string | null;
    is_current: boolean;
    upload_path: string | null;
  }> = [];

  for (const row of rows) {
    let upload_path: string | null = null;
    if (row.upload) {
      const result = await uploadOnboardingFile(trainerId, row.upload, 'qualification');
      if ('error' in result) return { ok: false, error: result.error };
      upload_path = result.path;
    }
    inserts.push({
      trainer_id: trainerId,
      certificate_name: row.certificate_name,
      issuing_body: row.issuing_body,
      date_of_issue: row.date_of_issue,
      is_current: row.is_current,
      upload_path,
    });
  }

  const { error: insErr } = await supabase.from('trainer_qualifications').insert(inserts);
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath('/onboarding/application');
  return { ok: true };
}

export type SalesGoalsState = {
  ok: boolean;
  error?: string;
};

// Sales Goals tab + selfie video upload. The video is optional and may be
// omitted entirely (e.g. trainer hits Save before recording).
export async function saveSalesGoals(
  _prev: SalesGoalsState,
  formData: FormData,
): Promise<SalesGoalsState> {
  const { trainerId, error } = await resolveTrainerId();
  if (error || !trainerId) return { ok: false, error: error ?? 'Unauthorized' };

  const supabase = await createClient();

  const client_base_per_month = intOrNull(formData.get('client_base_per_month'));
  const sales_goal_per_month = intOrNull(formData.get('sales_goal_per_month'));
  const heard_about_source = strOrNull(formData.get('heard_about_source'));

  const update: Record<string, unknown> = {
    trainer_id: trainerId,
    client_base_per_month,
    sales_goal_per_month,
    heard_about_source,
    updated_at: new Date().toISOString(),
  };

  const video = formData.get('selfie_video');
  if (video instanceof File && video.size > 0) {
    const result = await uploadOnboardingFile(trainerId, video, 'selfie-video');
    if ('error' in result) return { ok: false, error: result.error };
    update.selfie_video_path = result.path;
  }

  const { error: appErr } = await supabase
    .from('trainer_application_details')
    .upsert(update, { onConflict: 'trainer_id' });
  if (appErr) return { ok: false, error: appErr.message };

  revalidatePath('/onboarding/application');
  return { ok: true };
}

// Final advance — stamps application_submitted_at, flips onboarding_step to
// 'training', and redirects. No-op if the trainer is already past step 1.
export async function submitApplicationFinal(): Promise<void> {
  const { trainerId, error } = await resolveTrainerId();
  if (error || !trainerId) {
    throw new Error(error ?? 'Unauthorized');
  }

  const supabase = await createClient();
  await supabase
    .from('trainer_application_details')
    .upsert(
      {
        trainer_id: trainerId,
        application_submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'trainer_id' },
    );

  const advanceResult = await advanceOnboardingStep(trainerId, 'training');
  if (advanceResult.error) throw new Error(advanceResult.error);

  revalidatePath('/onboarding/application');
  revalidatePath('/onboarding/training');
  redirect('/onboarding/training');
}

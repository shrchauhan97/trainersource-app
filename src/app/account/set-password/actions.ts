'use server';

import { redirect } from 'next/navigation';

import { getUserRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

import { PASSWORD_HINT, PASSWORD_REGEX } from './password-policy';
import { safeNext } from './safe-next';

export type SetPasswordResult = { error?: string };

export async function setPassword(formData: FormData): Promise<SetPasswordResult> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  const rawNext = formData.get('next');
  const next = safeNext(typeof rawNext === 'string' ? rawNext : null, '/dashboard');

  if (!PASSWORD_REGEX.test(password)) {
    return { error: PASSWORD_HINT };
  }
  if (password !== confirm) {
    return { error: 'Passwords do not match.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user?.email) {
    console.error('[set-password] getUser failed or missing email', {
      hasUser: Boolean(user),
      hasEmail: Boolean(user?.email),
      message: userError?.message,
    });
    redirect('/login?error=auth_callback_failed');
  }

  let role: Awaited<ReturnType<typeof getUserRole>>;
  try {
    role = await getUserRole(user.email);
  } catch (err) {
    console.error('[set-password] getUserRole failed', { email: user.email, err });
    redirect('/login?error=auth_callback_failed');
  }

  if (role === 'suspended') {
    await supabase.auth.signOut();
    redirect('/login?error=suspended');
  }
  if (role !== 'admin' && role !== 'trainer') {
    await supabase.auth.signOut();
    redirect('/login?error=not_authorized');
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    console.error('[set-password] updateUser failed', { uid: user.id, message: updateError.message });
    return { error: "We couldn't save that password. Try a different one or contact support." };
  }

  redirect(next);
}

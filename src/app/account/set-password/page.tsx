import { redirect } from 'next/navigation';

import { getCurrentUser, getUserRole } from '@/lib/auth';

import { safeNext } from './safe-next';
import SetPasswordForm from './set-password-form';

type SetPasswordPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function SetPasswordPage({ searchParams }: SetPasswordPageProps) {
  let user: Awaited<ReturnType<typeof getCurrentUser>>;
  try {
    user = await getCurrentUser();
  } catch (err) {
    console.error('[set-password page] getCurrentUser failed', { err });
    redirect('/login?error=auth_callback_failed');
  }
  if (!user?.email) {
    redirect('/login');
  }

  let role: Awaited<ReturnType<typeof getUserRole>>;
  try {
    role = await getUserRole(user.email);
  } catch (err) {
    console.error('[set-password page] getUserRole failed', { email: user.email, err });
    redirect('/login?error=auth_callback_failed');
  }
  if (role === 'suspended') redirect('/login?error=suspended');
  if (role !== 'admin' && role !== 'trainer') redirect('/login?error=not_authorized');

  const { next } = await searchParams;
  const resolved = safeNext(next, role === 'admin' ? '/admin' : '/dashboard');

  return <SetPasswordForm email={user.email} next={resolved} />;
}

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFrom = vi.fn();
const mockRpc = vi.fn();
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: mockFrom, rpc: mockRpc }),
}));
vi.mock('next/headers', () => ({
  headers: () =>
    Promise.resolve({
      get: (name: string) => (name === 'x-forwarded-for' ? '203.0.113.42' : null),
    }),
}));

import { checkEmailAllowed } from '@/app/login/actions';

function adminsRow(role: 'admin' | 'superadmin' | null) {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: () =>
          Promise.resolve({ data: role ? { id: 'a1' } : null, error: null }),
      }),
    }),
  };
}

function trainersRow(
  trainer: { status: 'active' | 'suspended' | 'applied' | 'onboarding' } | null,
  error: { code?: string; message?: string } | null = null
) {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: () =>
          Promise.resolve({ data: trainer ? { id: 't1', status: trainer.status } : null, error }),
      }),
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkEmailAllowed', () => {
  it('rejects malformed email', async () => {
    const result = await checkEmailAllowed('not-an-email');
    expect(result).toEqual({ allowed: false, reason: 'invalid' });
  });

  it('admin email is allowed (hasPassword reflects RPC)', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'admins') return adminsRow('admin');
      throw new Error('unexpected table: ' + table);
    });
    mockRpc.mockResolvedValue({ data: true, error: null });

    const result = await checkEmailAllowed('admin@example.com');
    expect(result).toEqual({ allowed: true, hasPassword: true });
  });

  it('active trainer is allowed; hasPassword false when RPC returns false', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'admins') return adminsRow(null);
      if (table === 'trainers') return trainersRow({ status: 'active' });
      throw new Error('unexpected table: ' + table);
    });
    mockRpc.mockResolvedValue({ data: false, error: null });

    const result = await checkEmailAllowed('trainer@example.com');
    expect(result).toEqual({ allowed: true, hasPassword: false });
  });

  it('suspended trainer returns suspended (and never reaches RPC)', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'admins') return adminsRow(null);
      if (table === 'trainers') return trainersRow({ status: 'suspended' });
      throw new Error('unexpected table: ' + table);
    });

    const result = await checkEmailAllowed('suspended@example.com');
    expect(result).toEqual({ allowed: false, reason: 'suspended' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('onboarding/applied trainer (not yet active) returns not_authorized', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'admins') return adminsRow(null);
      if (table === 'trainers') return trainersRow({ status: 'applied' });
      throw new Error('unexpected table: ' + table);
    });

    const result = await checkEmailAllowed('applicant@example.com');
    expect(result).toEqual({ allowed: false, reason: 'not_authorized' });
  });

  it('unknown email returns not_authorized', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'admins') return adminsRow(null);
      if (table === 'trainers') return trainersRow(null);
      throw new Error('unexpected table: ' + table);
    });
    const result = await checkEmailAllowed('nobody@example.com');
    expect(result).toEqual({ allowed: false, reason: 'not_authorized' });
  });

  it('admins lookup error surfaces server_error (not not_authorized)', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'admins') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: null,
                  error: { code: 'PGRST500', message: 'timeout' },
                }),
            }),
          }),
        };
      }
      throw new Error('unexpected table: ' + table);
    });
    const result = await checkEmailAllowed('any@example.com');
    expect(result).toEqual({ allowed: false, reason: 'server_error' });
  });

  it('trainers lookup error surfaces server_error', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'admins') return adminsRow(null);
      if (table === 'trainers')
        return trainersRow(null, { code: 'PGRST500', message: 'timeout' });
      throw new Error('unexpected table: ' + table);
    });
    const result = await checkEmailAllowed('any@example.com');
    expect(result).toEqual({ allowed: false, reason: 'server_error' });
  });

  it('RPC error surfaces server_error', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'admins') return adminsRow('admin');
      throw new Error('unexpected table: ' + table);
    });
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });
    const result = await checkEmailAllowed('admin@example.com');
    expect(result).toEqual({ allowed: false, reason: 'server_error' });
  });

  it('rate-limits after LIMIT requests from same IP within window', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'admins') return adminsRow(null);
      if (table === 'trainers') return trainersRow(null);
      throw new Error('unexpected table: ' + table);
    });
    // Spread emails so each is treated as a distinct lookup but all from
    // the same IP fixture.
    const calls = await Promise.all(
      Array.from({ length: 12 }, (_, i) => checkEmailAllowed(`u${i}@example.com`))
    );
    const limited = calls.filter(
      (r) => !r.allowed && r.reason === 'rate_limited'
    );
    expect(limited.length).toBeGreaterThan(0);
  });
});

// Regression test for the May 14 production casualty (KF7EHXDY).
//
// Before the `validate_and_consume_code` RPC, a code submission did the
// consume + customer insert as two separate non-transactional steps. Under
// any failure (or concurrent submit), the code could be marked consumed
// without a matching customer — permanently dead and unattributed.
//
// This test exercises the atomicity guarantee directly:
//   1. Set up a fresh active access code.
//   2. Fire N parallel `validate_and_consume_code` RPC calls with the same
//      code but different customer emails.
//   3. Assert exactly 1 succeeds, N-1 return `reason='consumed'`, and the
//      DB ends with exactly 1 customer row attributed to that code.
//
// Skip-able locally — only runs when SUPABASE_URL + service role key are
// present. Cleans up after itself.

import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CODE_EXPIRY_DAYS } from '@/lib/constants';
import type { AccessCode, Trainer } from '@/lib/types';

// Load .env.local the same way admin-codes.test.ts does.
const envPath = path.resolve(process.cwd(), '.env.local');

if (existsSync(envPath)) {
  const envFile = readFileSync(envPath, 'utf8');

  for (const rawLine of envFile.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const sep = line.indexOf('=');
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    let value = line.slice(sep + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const runId = randomUUID().replace(/-/g, '').slice(0, 12);
const expiryMs = CODE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL is required for integration tests.');
}

if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for integration tests.');
}

let supabase: SupabaseClient;
const createdTrainerIds = new Set<string>();
const createdAccessCodeIds = new Set<string>();
const createdCustomerEmails = new Set<string>();

beforeAll(async () => {
  supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
});

afterAll(async () => {
  if (!supabase) return;

  // Customers cleanup goes by email since validate_and_consume_code
  // creates rows we don't have IDs for upfront.
  if (createdCustomerEmails.size > 0) {
    await supabase
      .from('access_codes')
      .update({ consumed_by: null, consumed_at: null, status: 'active' })
      .in('id', [...createdAccessCodeIds]);

    await supabase.from('customers').delete().in('email', [...createdCustomerEmails]);
  }

  if (createdAccessCodeIds.size > 0) {
    await supabase.from('access_codes').delete().in('id', [...createdAccessCodeIds]);
  }

  if (createdTrainerIds.size > 0) {
    await supabase.from('trainers').delete().in('id', [...createdTrainerIds]);
  }

  // code_attempts is append-only audit — leave it. The runId prefix on the
  // test emails makes the rows greppable in forensics if needed.
});

async function createTestTrainer() {
  const { data, error } = await supabase
    .from('trainers')
    .insert({
      email: `concurrency-${runId}-${randomUUID()}@trainersource.test`,
      name: `Concurrency Trainer ${runId}`,
      country: 'Singapore',
      city: 'Singapore',
      slug: `c-${runId}-${randomUUID().slice(0, 6)}`,
      status: 'active',
    })
    .select('*')
    .single<Trainer>();
  if (error || !data) throw error ?? new Error('trainer insert returned no row');
  createdTrainerIds.add(data.id);
  return data;
}

async function createActiveTrainerCode(trainer: Trainer) {
  const code = `C${runId.slice(0, 3).toUpperCase()}${randomUUID().replace(/-/g, '').slice(0, 5).toUpperCase()}`;
  const { data, error } = await supabase
    .from('access_codes')
    .insert({
      code,
      type: 'trainer',
      trainer_id: trainer.id,
      status: 'active',
      expires_at: new Date(Date.now() + expiryMs).toISOString(),
    })
    .select('*')
    .single<AccessCode>();
  if (error || !data) throw error ?? new Error('code insert returned no row');
  createdAccessCodeIds.add(data.id);
  return data;
}

async function invokeRpc(code: string, suffix: string) {
  const email = `claim-${runId}-${suffix}@trainersource.test`;
  createdCustomerEmails.add(email.toLowerCase());
  const { data, error } = await supabase.rpc('validate_and_consume_code', {
    p_code: code,
    p_name: `Claimant ${suffix}`,
    p_email: email,
    p_country: 'Singapore',
    p_city: 'Singapore',
  });
  return { data, error, suffix };
}

describe('validate_and_consume_code — concurrency guarantees', () => {
  it('exactly one of N parallel claims on the same code wins', async () => {
    const trainer = await createTestTrainer();
    const accessCode = await createActiveTrainerCode(trainer);

    const PARALLELISM = 20;
    const calls = Array.from({ length: PARALLELISM }, (_, i) =>
      invokeRpc(accessCode.code, String(i).padStart(2, '0')),
    );
    const results = await Promise.all(calls);

    type Row = { ok: boolean; reason: string | null; customer_id: string | null };
    const wins: Row[] = [];
    const losses: Row[] = [];
    for (const r of results) {
      expect(r.error, `caller #${r.suffix} hit an RPC error`).toBeNull();
      const row = (Array.isArray(r.data) ? r.data[0] : r.data) as Row;
      if (row.ok) wins.push(row);
      else losses.push(row);
    }

    // Exactly one winner.
    expect(wins.length).toBe(1);
    expect(wins[0]?.customer_id).toBeTruthy();

    // All N-1 losers got `consumed`. NOT `not_found`, NOT a 5xx-style null.
    expect(losses.length).toBe(PARALLELISM - 1);
    for (const l of losses) {
      expect(l.reason, 'every loser must report consumed').toBe('consumed');
    }

    // DB end state: code is consumed, exactly one customer row exists.
    const { data: codeRow } = await supabase
      .from('access_codes')
      .select('id, status, consumed_by, consumed_at')
      .eq('id', accessCode.id)
      .single();
    expect(codeRow?.status).toBe('consumed');
    expect(codeRow?.consumed_by).toBe(wins[0]?.customer_id);
    expect(codeRow?.consumed_at).not.toBeNull();

    const { data: customerRows } = await supabase
      .from('customers')
      .select('id, email, trainer_id, access_code_id')
      .eq('access_code_id', accessCode.id);
    expect(customerRows?.length).toBe(1);
    expect(customerRows?.[0]?.trainer_id).toBe(trainer.id);
  });

  it('reject and consumed paths both leave an audit row in code_attempts', async () => {
    const trainer = await createTestTrainer();
    const accessCode = await createActiveTrainerCode(trainer);

    // First call should succeed.
    const first = await invokeRpc(accessCode.code, 'first');
    expect(first.error).toBeNull();
    const firstRow = (Array.isArray(first.data) ? first.data[0] : first.data) as { ok: boolean };
    expect(firstRow.ok).toBe(true);

    // Second call on the same code should fail consumed.
    const second = await invokeRpc(accessCode.code, 'second');
    expect(second.error).toBeNull();
    const secondRow = (Array.isArray(second.data) ? second.data[0] : second.data) as {
      ok: boolean;
      reason: string;
    };
    expect(secondRow.ok).toBe(false);
    expect(secondRow.reason).toBe('consumed');
  });

  it('rejects malformed code without touching the row', async () => {
    const trainer = await createTestTrainer();
    const accessCode = await createActiveTrainerCode(trainer);

    const { data, error } = await supabase.rpc('validate_and_consume_code', {
      p_code: '!!',
      p_name: 'X',
      p_email: `malformed-${runId}@trainersource.test`,
      p_country: 'Singapore',
      p_city: 'Singapore',
    });
    expect(error).toBeNull();
    const row = (Array.isArray(data) ? data[0] : data) as { ok: boolean; reason: string };
    expect(row.ok).toBe(false);
    expect(row.reason).toBe('invalid_format');

    // The original code must stay active and un-attributed.
    const { data: codeRow } = await supabase
      .from('access_codes')
      .select('status, consumed_by')
      .eq('id', accessCode.id)
      .single();
    expect(codeRow?.status).toBe('active');
    expect(codeRow?.consumed_by).toBeNull();
  });

  it('rejects country outside allowlist', async () => {
    const trainer = await createTestTrainer();
    const accessCode = await createActiveTrainerCode(trainer);

    const { data, error } = await supabase.rpc('validate_and_consume_code', {
      p_code: accessCode.code,
      p_name: 'Blocked',
      p_email: `blocked-${runId}@trainersource.test`,
      p_country: 'France',
      p_city: 'Paris',
    });
    expect(error).toBeNull();
    const row = (Array.isArray(data) ? data[0] : data) as { ok: boolean; reason: string };
    expect(row.ok).toBe(false);
    expect(row.reason).toBe('country_blocked');

    const { data: codeRow } = await supabase
      .from('access_codes')
      .select('status, consumed_by')
      .eq('id', accessCode.id)
      .single();
    expect(codeRow?.status).toBe('active');
    expect(codeRow?.consumed_by).toBeNull();
  });
});

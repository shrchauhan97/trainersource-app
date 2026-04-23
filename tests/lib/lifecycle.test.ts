import { describe, it, expect, vi } from 'vitest';
import { reasonOptions, isRemovableReason } from '@/lib/lifecycle';

describe('lifecycle helpers', () => {
  it('exposes the six canonical reason categories', () => {
    expect(reasonOptions).toEqual([
      'abuse', 'fraud', 'compliance', 'churn', 'test-data', 'other',
    ]);
  });

  it('isRemovableReason accepts every canonical category', () => {
    for (const r of reasonOptions) expect(isRemovableReason(r)).toBe(true);
  });

  it('isRemovableReason rejects unknown values', () => {
    expect(isRemovableReason('whatever')).toBe(false);
    expect(isRemovableReason('')).toBe(false);
  });
});

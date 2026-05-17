// tests/lib/env-url.test.ts
//
// Unit coverage for resolveUrlEnv — the helper that replaces the `?? fallback`
// pattern at sites that resolve URL base from env. The headline regression
// case is empty-string env (the PR #32 silent-failure class).

import { describe, it, expect } from 'vitest';
import { resolveUrlEnv } from '@/lib/env-url';

const FALLBACK = 'https://trainer-source.com';

describe('resolveUrlEnv', () => {
  it('returns the env value when it is a valid absolute URL', () => {
    expect(resolveUrlEnv('https://staging.trainer-source.com', FALLBACK))
      .toBe('https://staging.trainer-source.com');
  });

  it('returns the fallback when env is undefined', () => {
    expect(resolveUrlEnv(undefined, FALLBACK)).toBe(FALLBACK);
  });

  it('returns the fallback when env is an empty string (PR #32 bug class)', () => {
    expect(resolveUrlEnv('', FALLBACK)).toBe(FALLBACK);
  });

  it('returns the fallback when env is whitespace-only', () => {
    expect(resolveUrlEnv('   \t  \n', FALLBACK)).toBe(FALLBACK);
  });

  it('trims whitespace around an otherwise-valid env value', () => {
    expect(resolveUrlEnv('  https://x.example.com  ', FALLBACK))
      .toBe('https://x.example.com');
  });

  it('throws when env is non-empty but not a valid URL', () => {
    expect(() => resolveUrlEnv('not a url', FALLBACK))
      .toThrow(/parses as an absolute URL/);
  });

  it('throws when env is a relative path (no scheme)', () => {
    expect(() => resolveUrlEnv('/r/CODE', FALLBACK))
      .toThrow(/parses as an absolute URL/);
  });

  it('throws with descriptive message when the fallback itself is invalid', () => {
    expect(() => resolveUrlEnv(undefined, 'not-a-url-either'))
      .toThrow(/fallback "not-a-url-either"/);
  });
});

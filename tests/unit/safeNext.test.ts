import { describe, expect, it } from 'vitest';

import { safeNext } from '@/app/account/set-password/safe-next';

const FALLBACK = '/dashboard';

describe('safeNext', () => {
  it('returns fallback for null/undefined', () => {
    expect(safeNext(null, FALLBACK)).toBe(FALLBACK);
    expect(safeNext(undefined, FALLBACK)).toBe(FALLBACK);
  });

  it('returns fallback for empty string', () => {
    expect(safeNext('', FALLBACK)).toBe(FALLBACK);
  });

  it('accepts simple same-site absolute paths', () => {
    expect(safeNext('/admin', FALLBACK)).toBe('/admin');
    expect(safeNext('/dashboard/settings', FALLBACK)).toBe('/dashboard/settings');
    expect(safeNext('/admin/trainers', FALLBACK)).toBe('/admin/trainers');
  });

  it('rejects protocol-relative URLs (open-redirect via //)', () => {
    expect(safeNext('//evil.com', FALLBACK)).toBe(FALLBACK);
    expect(safeNext('//evil.com/dashboard', FALLBACK)).toBe(FALLBACK);
  });

  it('rejects backslash protocol-relative variant (/\\evil.com)', () => {
    expect(safeNext('/\\evil.com', FALLBACK)).toBe(FALLBACK);
  });

  it('rejects absolute URLs with scheme', () => {
    expect(safeNext('https://evil.com', FALLBACK)).toBe(FALLBACK);
    expect(safeNext('http://localhost:3000/admin', FALLBACK)).toBe(FALLBACK);
    expect(safeNext('javascript:alert(1)', FALLBACK)).toBe(FALLBACK);
    expect(safeNext('data:text/html,<script>x</script>', FALLBACK)).toBe(FALLBACK);
  });

  it('rejects paths with query strings or fragments (regex too strict by design)', () => {
    expect(safeNext('/admin?next=evil', FALLBACK)).toBe(FALLBACK);
    expect(safeNext('/admin#section', FALLBACK)).toBe(FALLBACK);
  });

  it('rejects relative paths (must start with /)', () => {
    expect(safeNext('admin', FALLBACK)).toBe(FALLBACK);
    expect(safeNext('./admin', FALLBACK)).toBe(FALLBACK);
    expect(safeNext('../admin', FALLBACK)).toBe(FALLBACK);
  });

  it('rejects non-string input', () => {
    expect(safeNext(42 as unknown as string, FALLBACK)).toBe(FALLBACK);
    expect(safeNext({} as unknown as string, FALLBACK)).toBe(FALLBACK);
  });
});

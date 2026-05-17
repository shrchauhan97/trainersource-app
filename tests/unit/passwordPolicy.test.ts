import { describe, expect, it } from 'vitest';

import { PASSWORD_HINT, PASSWORD_REGEX } from '@/app/account/set-password/password-policy';

describe('PASSWORD_REGEX', () => {
  it('accepts a well-formed password (12+ chars, upper, lower, digit)', () => {
    expect(PASSWORD_REGEX.test('GoodPassword12')).toBe(true);
    expect(PASSWORD_REGEX.test('aB1aaaaaaaaa')).toBe(true);
    expect(PASSWORD_REGEX.test('Z9zzzzzzzzzzzz')).toBe(true);
  });

  it('rejects passwords shorter than 12 characters', () => {
    expect(PASSWORD_REGEX.test('Short1A')).toBe(false);
    expect(PASSWORD_REGEX.test('Eleven1aaaa')).toBe(false); // 11 chars
  });

  it('rejects passwords missing uppercase', () => {
    expect(PASSWORD_REGEX.test('alllowercase1')).toBe(false);
  });

  it('rejects passwords missing lowercase', () => {
    expect(PASSWORD_REGEX.test('ALLUPPERCASE1')).toBe(false);
  });

  it('rejects passwords missing a digit', () => {
    expect(PASSWORD_REGEX.test('NoDigitsHerePresent')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(PASSWORD_REGEX.test('')).toBe(false);
  });

  it('allows special characters but does not require them', () => {
    expect(PASSWORD_REGEX.test('Strong!Password1')).toBe(true);
    expect(PASSWORD_REGEX.test('NoSpecialChars1')).toBe(true);
  });

  it('PASSWORD_HINT mentions the rules so UI copy stays in sync', () => {
    expect(PASSWORD_HINT).toMatch(/12/);
    expect(PASSWORD_HINT.toLowerCase()).toMatch(/uppercase|upper/);
    expect(PASSWORD_HINT.toLowerCase()).toMatch(/lowercase|lower/);
    expect(PASSWORD_HINT.toLowerCase()).toMatch(/digit|number/);
  });
});

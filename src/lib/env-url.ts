// src/lib/env-url.ts
//
// Centralized base-URL resolution from env vars. Replaces the
// `process.env.X ?? fallback` pattern, which silently passed empty strings
// through — env vars cleared in the Vercel dashboard come back as "", and the
// nullish-coalescing operator only catches null/undefined. Downstream code
// then encoded broken URLs like `/r/CODE` (no host) into QR codes and
// trainer share links. See PR #32 review for the silent-failure history.
//
// Contract:
//   - undefined / empty / whitespace -> use fallback
//   - non-empty value (or fallback)  -> must parse as an absolute URL or throw
//
// We throw eagerly because the alternative (warn-and-encode-garbage) is the
// exact silent-failure class we're eliminating. Misconfig should fail the
// request loudly, not produce a broken customer-facing link.

export function resolveUrlEnv(
  value: string | undefined,
  fallback: string,
): string {
  const trimmed = value?.trim();
  const candidate = trimmed && trimmed.length > 0 ? trimmed : fallback;
  try {
    // Absolute-URL validation: the no-base form of URL throws on empty
    // strings and on protocol-less inputs (e.g. "/r/CODE"). All our use
    // sites need an absolute URL (Telegram targets, QR payloads, email
    // links — no base context available), so this is the right check.
    new URL(candidate);
  } catch {
    throw new Error(
      `resolveUrlEnv: neither env value "${value ?? ''}" nor fallback "${fallback}" parses as an absolute URL`,
    );
  }
  return candidate;
}

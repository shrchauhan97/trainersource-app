// tests/api/qr-route.test.ts
//
// Regression coverage for /api/qr/[code]. PR #32 fixed a silent failure where
// the QR encoded ${UP}/code/<CODE> (BC 404) instead of the branded
// ${PORTAL}/r/<CODE> landing. The existing assertion in issue-code.test.ts:88
// only checked the URL *shape* returned by the issuer API (`qr_url` matches
// /api/qr/) — it never decoded the actual PNG bytes the QR endpoint produces,
// so the bug shipped past the entire test suite. This file closes that gap.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';

async function decodeQRFromResponse(res: Response): Promise<string> {
  expect(res.headers.get('content-type')).toBe('image/png');
  const png = PNG.sync.read(Buffer.from(await res.arrayBuffer()));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  if (!decoded) throw new Error('jsQR could not decode the response PNG');
  return decoded.data;
}

describe('GET /api/qr/[code]', () => {
  beforeEach(() => {
    // Default to no env override so the route's ?? fallback fires and we test
    // the documented default. Individual tests can re-stub.
    vi.unstubAllEnvs();
    delete process.env.NEXT_PUBLIC_PORTAL_BASE_URL;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('encodes ${PORTAL}/r/<CODE> by default (regression: PR #32)', async () => {
    const { GET } = await import('@/app/api/qr/[code]/route');
    const res = await GET(
      new Request('https://x/api/qr/SARAH-A7K2'),
      { params: Promise.resolve({ code: 'SARAH-A7K2' }) },
    );
    expect(res.status).toBe(200);
    const decoded = await decodeQRFromResponse(res);
    expect(decoded).toBe('https://trainer-source.com/r/SARAH-A7K2');
    // Anti-regression: the pre-PR-#32 bug encoded /code/<CODE>. If this
    // assertion ever fires, the bug is back.
    expect(decoded).not.toMatch(/\/code\//);
  });

  it('honors NEXT_PUBLIC_PORTAL_BASE_URL override', async () => {
    vi.stubEnv('NEXT_PUBLIC_PORTAL_BASE_URL', 'https://staging.trainer-source.com');
    const { GET } = await import('@/app/api/qr/[code]/route');
    const res = await GET(
      new Request('https://x/api/qr/TEST-1234'),
      { params: Promise.resolve({ code: 'TEST-1234' }) },
    );
    expect(res.status).toBe(200);
    expect(await decodeQRFromResponse(res)).toBe(
      'https://staging.trainer-source.com/r/TEST-1234',
    );
  });

  it('400s on codes that fail CODE_RE', async () => {
    const { GET } = await import('@/app/api/qr/[code]/route');
    const res = await GET(
      new Request('https://x/api/qr/bad'),
      { params: Promise.resolve({ code: 'bad lowercase!' }) },
    );
    expect(res.status).toBe(400);
  });

  it('sets the 24h immutable cache header', async () => {
    const { GET } = await import('@/app/api/qr/[code]/route');
    const res = await GET(
      new Request('https://x/api/qr/OK-1234'),
      { params: Promise.resolve({ code: 'OK-1234' }) },
    );
    expect(res.headers.get('cache-control')).toContain('max-age=86400');
  });
});

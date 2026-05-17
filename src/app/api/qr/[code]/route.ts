import QRCode from 'qrcode';
import { resolveUrlEnv } from '@/lib/env-url';

export const runtime = 'nodejs';

const CODE_RE = /^[A-Z0-9-]{4,40}$/;

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  if (!CODE_RE.test(code)) {
    return new Response('invalid code', { status: 400 });
  }
  // T2.1 follow-up — match issueTrainerCode's deep_link (PR #25). The earlier
  // `${UP}/code/${code}` target 404s on BC; scans landed customers on a Not
  // Found page even though the gate JS still rendered on top. Encode the
  // branded TS landing instead — same flow as "Copy share link", and QR scans
  // benefit most from the trust wrapper since scanners show no OG preview.
  const portalBase = resolveUrlEnv(
    process.env.NEXT_PUBLIC_PORTAL_BASE_URL,
    'https://trainer-source.com',
  );
  const deepLink = `${portalBase}/r/${code}`;
  const buffer = await QRCode.toBuffer(deepLink, {
    width: 300,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });
  return new Response(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  });
}

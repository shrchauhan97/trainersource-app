import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const CANONICAL_HOST = 'trainer-source.com';

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const pathname = request.nextUrl.pathname;

  // Redirect any *.vercel.app traffic to the canonical custom domain so
  // magic-link callbacks (which use window.location.origin) and bookmarks
  // anchored to the old preview URL all funnel into trainer-source.com.
  // Excludes /api so the BC storefront's gate calls (which post directly
  // to the Vercel hostname) keep working until BC-PASTE-THIS is re-pushed.
  if (host.endsWith('.vercel.app') && !pathname.startsWith('/api')) {
    const target = new URL(request.nextUrl.toString());
    target.host = CANONICAL_HOST;
    target.protocol = 'https:';
    target.port = '';
    return NextResponse.redirect(target, 308);
  }

  const country = request.headers.get('x-vercel-ip-country') || 'Unknown';
  const city = request.headers.get('x-vercel-ip-city') || 'Unknown';

  console.log(`[GEO] ${country} | ${city} | ${pathname}`);

  const response = await updateSession(request);

  if (country === 'SG') {
    response.headers.set('x-ts-geo-restricted', 'true');
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

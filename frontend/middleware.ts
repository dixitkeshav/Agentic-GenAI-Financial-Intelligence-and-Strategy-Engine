import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { sessionCookieName, verifySessionToken } from '@/lib/auth/session';

const PUBLIC_PATHS = ['/', '/login', '/settings'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/api/proxy') ||
    pathname.startsWith('/api/backtest') ||
    pathname.startsWith('/api/kite') ||
    pathname.startsWith('/api/broker') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/assets')
  ) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const secret = process.env.NEXTAUTH_SECRET ?? '';
  if (!secret) {
    // Fail-closed: if secret missing, force login.
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  const token = req.cookies.get(sessionCookieName())?.value;
  const ok = await verifySessionToken(secret, token);
  if (ok) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};


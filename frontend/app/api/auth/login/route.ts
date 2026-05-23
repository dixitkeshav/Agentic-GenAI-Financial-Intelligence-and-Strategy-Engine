import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { sessionCookieName, signSessionToken } from '@/lib/auth/session';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as null | { password?: string };
  const password = body?.password ?? '';

  const expected = process.env.DASHBOARD_PASSWORD ?? '';
  const secret = process.env.NEXTAUTH_SECRET ?? '';
  if (!expected || !secret) {
    return NextResponse.json(
      { success: false, error: 'Server not configured: set DASHBOARD_PASSWORD and NEXTAUTH_SECRET.' },
      { status: 500 }
    );
  }

  if (password !== expected) {
    return NextResponse.json({ success: false, error: 'Access Denied' }, { status: 401 });
  }

  const token = await signSessionToken(secret, { iatMs: Date.now() });
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName(), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });

  return NextResponse.json({ success: true });
}


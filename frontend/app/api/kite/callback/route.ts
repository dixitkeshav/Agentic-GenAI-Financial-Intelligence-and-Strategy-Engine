import { NextResponse } from 'next/server';
import { KiteConnect } from 'kiteconnect';

export const runtime = 'nodejs';

type KiteSession = {
  access_token?: string;
  user_id?: string;
  user_name?: string;
  user_shortname?: string;
};

type KiteApiError = {
  message?: string;
  error_type?: string;
};

function requiredEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env var: ${name} (check frontend/.env.local and restart npm run dev)`);
  return v;
}

function parseKiteError(e: unknown): string {
  if (e && typeof e === 'object') {
    const err = e as { message?: string; response?: { data?: KiteApiError } };
    const kiteMsg = err.response?.data?.message;
    const kiteType = err.response?.data?.error_type;
    if (kiteMsg) {
      return kiteType ? `${kiteMsg} (${kiteType})` : kiteMsg;
    }
    if (err.message) return err.message;
  }
  return String(e);
}

/** Base URL for post-OAuth redirect (avoids https://localhost which Safari cannot reach in dev). */
function settingsBaseUrl(requestUrl: URL): string {
  const fromEnv = process.env.NEXTAUTH_URL?.trim();
  if (fromEnv) {
    try {
      return new URL(fromEnv).origin;
    } catch {
      /* fall through */
    }
  }
  const host = requestUrl.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return `http://${requestUrl.host}`;
  }
  return requestUrl.origin;
}

function redirectWithError(base: string, message: string) {
  const redirectTo = new URL('/settings', base);
  redirectTo.searchParams.set('kite_error', message.slice(0, 500));
  return NextResponse.redirect(redirectTo.toString());
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const appOrigin = settingsBaseUrl(url);

  try {
    const requestToken = url.searchParams.get('request_token');
    const status = url.searchParams.get('status');

    if (status && status !== 'success') {
      return redirectWithError(appOrigin, `Kite login failed (status=${status}). Try again.`);
    }

    if (!requestToken) {
      return redirectWithError(
        appOrigin,
        'Missing request_token. Start login again from kite.zerodha.com (do not refresh this page).'
      );
    }

    const apiKey = requiredEnv('KITE_API_KEY');
    const apiSecret = requiredEnv('KITE_API_SECRET');

    const kite = new KiteConnect({ api_key: apiKey });
    const session = (await kite.generateSession(requestToken, apiSecret)) as unknown as KiteSession;
    const accessToken = session.access_token;

    if (!accessToken) {
      return redirectWithError(appOrigin, 'Kite did not return an access_token. Check API key/secret match your app.');
    }

    const redirectTo = new URL('/settings', appOrigin);
    redirectTo.searchParams.set('kite_access_token', accessToken);

    const res = NextResponse.redirect(redirectTo.toString());
    res.cookies.set('kite_access_token', accessToken, {
      httpOnly: true,
      secure: redirectTo.protocol === 'https:',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 10,
    });
    return res;
  } catch (e: unknown) {
    const msg = parseKiteError(e);
    console.error('[kite/callback]', msg, e);

    // Request tokens are single-use — refreshing this URL always fails
    const hint = msg.toLowerCase().includes('token')
      ? ' Request tokens work once only. Open a fresh Kite login link and do not refresh the callback URL.'
      : '';

    return redirectWithError(appOrigin, msg + hint);
  }
}

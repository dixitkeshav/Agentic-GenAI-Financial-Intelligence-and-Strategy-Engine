/**
 * Django API base URL.
 *
 * - Local dev (browser): `/api/proxy` avoids CORS when Django runs on :8000.
 * - Production (browser): call Render directly so Vercel serverless does not
 *   time out during Render free-tier cold starts (often 30–90s).
 * - SSR: always uses NEXT_PUBLIC_API_URL.
 */
const DJANGO_ORIGIN =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000';

const LOCAL_BACKEND = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;

function useBrowserProxy(): boolean {
  if (typeof window === 'undefined') return false;
  if (process.env.NEXT_PUBLIC_USE_API_PROXY === 'true') return true;
  if (process.env.NEXT_PUBLIC_USE_API_PROXY === 'false') return false;
  return LOCAL_BACKEND.test(DJANGO_ORIGIN);
}

export function djangoApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (useBrowserProxy()) {
    return `/api/proxy${normalized}`;
  }
  return `${DJANGO_ORIGIN}${normalized}`;
}

export function djangoOrigin(): string {
  return DJANGO_ORIGIN;
}

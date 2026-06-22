/**
 * Django API base URL.
 *
 * - Local dev (browser): `/api/proxy` avoids CORS when Django runs on :8000.
 * - Production (browser): call Render directly — Vercel `/api/proxy` hard-limits at 60s
 *   and news/agents often exceed that during Render cold starts.
 * - SSR: uses NEXT_PUBLIC_API_URL or production fallback below.
 */
const PRODUCTION_API_ORIGIN = 'https://fintelli-ai.onrender.com';

const DJANGO_ORIGIN =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ||
  (process.env.NODE_ENV === 'production' ? PRODUCTION_API_ORIGIN : 'http://127.0.0.1:8000');

const LOCAL_BACKEND = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;

function useBrowserProxy(): boolean {
  if (typeof window === 'undefined') return false;
  if (process.env.NEXT_PUBLIC_USE_API_PROXY === 'true') return true;
  if (process.env.NEXT_PUBLIC_USE_API_PROXY === 'false') return false;
  // Never proxy remote APIs through Vercel serverless (60s timeout on hobby tier).
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

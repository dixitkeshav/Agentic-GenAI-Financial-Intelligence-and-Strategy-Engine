/** WebSocket base URL — connects directly to Django ASGI (daphne), not Next proxy. */
export function shockWebSocketUrl(): string {
  const productionFallback = 'https://fintelli-ai.onrender.com';
  const base =
    process.env.NEXT_PUBLIC_WS_URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ||
    (process.env.NODE_ENV === 'production' ? productionFallback : 'http://127.0.0.1:8000');
  const wsBase = base.replace(/^http/, 'ws');
  return `${wsBase}/ws/shock/`;
}

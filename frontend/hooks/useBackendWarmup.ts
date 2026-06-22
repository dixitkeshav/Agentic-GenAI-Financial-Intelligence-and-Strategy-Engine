'use client';

import { useEffect } from 'react';
import { djangoApiUrl } from '@/lib/apiBase';

const WARMUP_ATTEMPTS = 12;
const WARMUP_DELAY_MS = 5000;

/** Pings Django /api/health/ so Render free tier wakes before heavy dashboard calls. */
export function useBackendWarmup() {
  useEffect(() => {
    let cancelled = false;

    async function warm() {
      for (let attempt = 0; attempt < WARMUP_ATTEMPTS && !cancelled; attempt++) {
        try {
          const res = await fetch(djangoApiUrl('/api/health/'), { cache: 'no-store' });
          if (res.ok) return;
        } catch {
          // Render cold start — retry
        }
        await new Promise((r) => setTimeout(r, WARMUP_DELAY_MS));
      }
    }

    void warm();
    return () => {
      cancelled = true;
    };
  }, []);
}

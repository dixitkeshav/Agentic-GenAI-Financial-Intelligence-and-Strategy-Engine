'use client';

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { useMarketStore } from '@/store/marketStore';

/** Fetches live ticker data from /api/live-ticker/ and populates market store. Polls every 2 min. */
export function useLiveTicker() {
  const setIndices = useMarketStore((state) => state.setIndices);
  const hasInitialized = useRef(false);

  const { data: tickers = [] } = useQuery({
    queryKey: ['live-ticker'],
    queryFn: () => apiClient.getLiveTicker(),
    refetchInterval: 120000, // 2 minutes
    staleTime: 60000,
  });

  useEffect(() => {
    if (!tickers.length) return;
    const indices = tickers.map((t) => ({
      symbol: t.symbol.replace(/^\^/, '').split('.')[0].slice(0, 8),
      price: t.price,
      change: (t.price * (t.change_pct / 100)),
      changePercent: t.change_pct,
      volume: 0,
    }));
    setIndices(indices);
    hasInitialized.current = true;
  }, [tickers, setIndices]);

  return tickers;
}

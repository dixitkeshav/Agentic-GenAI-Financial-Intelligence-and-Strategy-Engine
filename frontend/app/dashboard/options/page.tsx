'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient, OptionsChainResponse } from '@/lib/apiClient';
import { Skeleton } from '@/components/ui/skeleton';

export default function OptionsPage() {
  const [symbol, setSymbol] = useState('AAPL');
  const [expiry, setExpiry] = useState('');
  const [data, setData] = useState<OptionsChainResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canRender = !!data?.data?.length;

  const runFetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getOptionsChain(symbol, expiry || undefined);
      setData(res);
      // If expiry auto-selected, keep the controlled value in sync.
      if (res.expiry && !expiry) setExpiry(res.expiry);
    } catch (e) {
      setError(String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load initial chain once.
    runFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const strikesToShow = useMemo(() => {
    if (!data?.data) return [];
    // Keep the UI responsive by limiting rows.
    return data.data.slice(0, 60);
  }, [data]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Options Chain</h1>
        <p className="text-muted-foreground">Best-effort options chain via `/api/options-chain/` (yfinance)</p>
      </div>

      <Card className="glass-effect">
        <CardHeader>
          <CardTitle>Fetch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Symbol</label>
            <Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="AAPL" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Expiry</label>
            <select
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="w-full bg-background/50 border border-border/50 rounded-md p-2 text-sm"
              disabled={!data?.expiries?.length}
            >
              <option value="">Auto</option>
              {(data?.expiries || []).map((ex) => (
                <option key={ex} value={ex}>
                  {ex}
                </option>
              ))}
            </select>
          </div>

          <Button onClick={runFetch} disabled={loading}>
            {loading ? 'Loading...' : 'Load Chain'}
          </Button>

          {error && <p className="text-sm text-price-down">{error}</p>}
          {data?.error && <p className="text-sm text-muted-foreground">{data.error}</p>}
        </CardContent>
      </Card>

      <Card className="glass-effect">
        <CardHeader>
          <CardTitle>
            {data?.symbol || symbol} {data?.expiry ? `• ${data.expiry}` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : canRender ? (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Strike</th>
                    <th className="py-2 pr-3">CE OI</th>
                    <th className="py-2 pr-3">CE Bid/Ask</th>
                    <th className="py-2 pr-3">CE IV</th>
                    <th className="py-2 pr-3">PE OI</th>
                    <th className="py-2 pr-3">PE Bid/Ask</th>
                    <th className="py-2 pr-3">PE IV</th>
                  </tr>
                </thead>
                <tbody>
                  {strikesToShow.map((row) => (
                    <tr key={row.strike} className="border-t border-border/50">
                      <td className="py-3 pr-3 font-medium">{row.strike}</td>
                      <td className="py-3 pr-3">{row.call.openInterest ?? '-'}</td>
                      <td className="py-3 pr-3">
                        {(row.call.bid ?? '-')}/{row.call.ask ?? '-'}
                      </td>
                      <td className="py-3 pr-3">{row.call.impliedVolatility ?? '-'}</td>
                      <td className="py-3 pr-3">{row.put.openInterest ?? '-'}</td>
                      <td className="py-3 pr-3">
                        {(row.put.bid ?? '-')}/{row.put.ask ?? '-'}
                      </td>
                      <td className="py-3 pr-3">{row.put.impliedVolatility ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground mt-3">
                Showing first {strikesToShow.length} strikes (UI performance).
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No chain data yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


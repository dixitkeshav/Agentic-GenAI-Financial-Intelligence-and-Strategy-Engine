'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient, OptionsChainResponse } from '@/lib/apiClient';
import { Skeleton } from '@/components/ui/skeleton';

function fmtPrice(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n)) || !Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  if (Math.abs(v) >= 1000) return v.toFixed(2);
  return v.toFixed(2);
}

/** yfinance / Finnhub often store IV as decimal (0.25 = 25%). */
function fmtIV(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n)) || !Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  if (v >= 0 && v <= 1) return `${(v * 100).toFixed(1)}%`;
  return `${v.toFixed(1)}%`;
}

function fmtOI(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n)) || !Number.isFinite(Number(n))) return '—';
  return String(Math.round(Number(n)));
}

export default function OptionsPage() {
  const [symbol, setSymbol] = useState('AAPL');
  const [expiry, setExpiry] = useState('');
  const [data, setData] = useState<OptionsChainResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canRender = !!data?.data?.length;

  const runFetch = async (nocache?: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getOptionsChain(symbol.trim().toUpperCase(), expiry || undefined, nocache);
      setData(res);
      if (res.expiry && !expiry) setExpiry(res.expiry);
    } catch (e) {
      setError(String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const strikesToShow = useMemo(() => {
    if (!data?.data) return [];
    return data.data.slice(0, 80);
  }, [data]);

  const source = data?.source;

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Options chain</h1>
        <p className="text-muted-foreground mt-1 max-w-3xl">
          Chains load from <strong>Yahoo Finance</strong> first (best for liquid US names). Finnhub may fill in for some
          US symbols if Yahoo returns nothing. Indian (NSE/BSE) option chains are often{' '}
          <strong>not available</strong> through these free sources — use symbols like <code>AAPL</code>,{' '}
          <code>MSFT</code>, or <code>SPY</code> to verify the page.
        </p>
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
              <option value="">Auto (nearest)</option>
              {(data?.expiries || []).map((ex) => (
                <option key={ex} value={ex}>
                  {ex}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runFetch(false)} disabled={loading}>
              {loading ? 'Loading…' : 'Load chain'}
            </Button>
            <Button type="button" variant="outline" onClick={() => runFetch(true)} disabled={loading}>
              Refresh (skip cache)
            </Button>
          </div>

          {error && <p className="text-sm text-price-down">{error}</p>}
          {data?.error && !canRender && (
            <div className="text-sm rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-amber-200">
              <strong>Backend:</strong> {data.error}
            </div>
          )}
          {source && (
            <p className="text-xs text-muted-foreground">
              Data source: <span className="font-mono">{source}</span>
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="glass-effect">
        <CardHeader>
          <CardTitle>
            {data?.symbol || symbol}
            {data?.expiry ? ` · ${data.expiry}` : ''}
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
                    <th className="py-2 pr-3">CE Vol</th>
                    <th className="py-2 pr-3">CE Bid/Ask</th>
                    <th className="py-2 pr-3">CE IV</th>
                    <th className="py-2 pr-3">PE OI</th>
                    <th className="py-2 pr-3">PE Vol</th>
                    <th className="py-2 pr-3">PE Bid/Ask</th>
                    <th className="py-2 pr-3">PE IV</th>
                  </tr>
                </thead>
                <tbody>
                  {strikesToShow.map((row) => (
                    <tr key={row.strike} className="border-t border-border/50">
                      <td className="py-3 pr-3 font-medium">{fmtPrice(row.strike)}</td>
                      <td className="py-3 pr-3">{fmtOI(row.call.openInterest)}</td>
                      <td className="py-3 pr-3">{fmtOI(row.call.volume)}</td>
                      <td className="py-3 pr-3">
                        {fmtPrice(row.call.bid)}/{fmtPrice(row.call.ask)}
                      </td>
                      <td className="py-3 pr-3">{fmtIV(row.call.impliedVolatility)}</td>
                      <td className="py-3 pr-3">{fmtOI(row.put.openInterest)}</td>
                      <td className="py-3 pr-3">{fmtOI(row.put.volume)}</td>
                      <td className="py-3 pr-3">
                        {fmtPrice(row.put.bid)}/{fmtPrice(row.put.ask)}
                      </td>
                      <td className="py-3 pr-3">{fmtIV(row.put.impliedVolatility)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground mt-3">
                Showing first {strikesToShow.length} strikes. Empty bid/ask often means illiquid strikes or delayed
                data.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No chain rows yet. Try a US symbol, click &quot;Refresh (skip cache)&quot;, or check the message above.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

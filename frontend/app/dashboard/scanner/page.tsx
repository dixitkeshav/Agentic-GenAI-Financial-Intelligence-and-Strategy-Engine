'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient, ScannerResponse } from '@/lib/apiClient';
import { Skeleton } from '@/components/ui/skeleton';

type Signal = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

function signalClass(signal: Signal) {
  if (signal === 'BULLISH') return 'text-price-up';
  if (signal === 'BEARISH') return 'text-price-down';
  return 'text-muted-foreground';
}

export default function ScannerPage() {
  const [symbolsText, setSymbolsText] = useState('^NSEI,AAPL,MSFT,NVDA,RELIANCE.NS');
  const [period, setPeriod] = useState('3mo');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ScannerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runScanner = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getScanner(symbolsText, period);
      setData(res);
    } catch (e) {
      setError(String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Screener</h1>
        <p className="text-muted-foreground">Sentiment + momentum scanner via `/api/scanner/`</p>
      </div>

      <Card className="glass-effect">
        <CardHeader>
          <CardTitle>Run Scan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Symbols (comma separated)</label>
            <Input
              value={symbolsText}
              onChange={(e) => setSymbolsText(e.target.value)}
              placeholder="AAPL,MSFT,NVDA"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Price history period (yfinance)</label>
            <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="1mo,3mo,6mo,1y" />
          </div>

          <Button onClick={runScanner} disabled={loading}>
            {loading ? 'Scanning...' : 'Run Scanner'}
          </Button>

          {error && <p className="text-sm text-price-down">{error}</p>}
        </CardContent>
      </Card>

      <Card className="glass-effect">
        <CardHeader>
          <CardTitle>Results</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : data?.results?.length ? (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Symbol</th>
                    <th className="py-2 pr-3">Signal</th>
                    <th className="py-2 pr-3">Confidence</th>
                    <th className="py-2 pr-3">Sentiment</th>
                    <th className="py-2 pr-3">Momentum</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((r) => (
                    <tr key={r.symbol} className="border-t border-border/50">
                      <td className="py-3 pr-3 font-medium">{r.symbol}</td>
                      <td className={`py-3 pr-3 font-semibold ${signalClass(r.signal as Signal)}`}>
                        {r.signal}
                      </td>
                      <td className="py-3 pr-3">{r.confidence}</td>
                      <td className="py-3 pr-3">{r.sentiment}</td>
                      <td className="py-3 pr-3">{(r.momentum ?? 0).toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Run the scanner to see results.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


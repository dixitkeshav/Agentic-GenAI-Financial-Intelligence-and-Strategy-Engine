'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { apiClient, ApiError, type BacktestResult } from '@/lib/apiClient';
import { useSettingsStore } from '@/lib/store/settingsStore';

function pct(x: number | null | undefined): string {
  if (x == null || Number.isNaN(x)) return '—';
  return `${(x * 100).toFixed(2)}%`;
}

export default function BacktestPage() {
  const [ticker, setTicker] = useState('RELIANCE');
  const [useAlphaSentiment, setUseAlphaSentiment] = useState(true);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const apiKey = useSettingsStore((s) => s.apiKey);
  const accessToken = useSettingsStore((s) => s.accessToken);

  const runBacktest = async () => {
    setLoading(true);
    try {
      const data = await apiClient.runBacktest(ticker, useAlphaSentiment, {
        apiKey: apiKey || undefined,
        accessToken: accessToken || undefined,
      });
      setResult(data);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e);
      setResult({ error: msg });
    } finally {
      setLoading(false);
    }
  };

  const ex = result?.explanation;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Backtesting</h1>
        <p className="text-muted-foreground mt-1">
          Indian equities (e.g. RELIANCE, TCS) use Zerodha Kite when connected; otherwise Yahoo Finance. Compare
          buy-and-hold vs a news-sentiment strategy.
        </p>
      </div>

      <Card className="glass-effect">
        <CardHeader>
          <CardTitle>Run backtest</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Ticker</label>
            <Input
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="RELIANCE"
              className="mt-1"
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={useAlphaSentiment}
              onChange={(e) => setUseAlphaSentiment(e.target.checked)}
              className="rounded border-border"
            />
            <span>Use Alpha Vantage news sentiment (when available) for the sentiment strategy</span>
          </label>
          <Button onClick={runBacktest} disabled={loading}>
            {loading ? 'Running…' : 'Run backtest'}
          </Button>
        </CardContent>
      </Card>

      {result?.kite_note && (
        <p className="text-sm text-muted-foreground border border-border/50 rounded-lg px-4 py-3">
          {result.kite_note}
        </p>
      )}

      {result?.error && (
        <Card className="border-destructive/40 glass-effect">
          <CardContent className="pt-6 space-y-2">
            <p className="text-sm text-destructive">{result.error}</p>
            {result.explanation?.headline && (
              <p className="text-sm text-muted-foreground leading-relaxed">{result.explanation.headline}</p>
            )}
            {result.explanation?.disclaimer && (
              <p className="text-sm text-muted-foreground leading-relaxed">{result.explanation.disclaimer}</p>
            )}
          </CardContent>
        </Card>
      )}

      {result?.ticker && result.num_days != null && result.num_days > 0 && (
        <>
          <Card className="glass-effect">
            <CardHeader>
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {ex?.headline && <p className="leading-relaxed">{ex.headline}</p>}
              {ex?.recent_trend && <p className="text-muted-foreground leading-relaxed">{ex.recent_trend}</p>}
              {ex?.quarterly_context && <p className="text-muted-foreground leading-relaxed">{ex.quarterly_context}</p>}
            </CardContent>
          </Card>

          <Card className="glass-effect">
            <CardHeader>
              <CardTitle className="text-lg">Why the price might move (historical context)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(ex?.why_price_might_move?.length ? ex.why_price_might_move : ['No extra factor bullets for this run.']).map(
                (line, i) => (
                  <p key={i} className="leading-relaxed pl-3 border-l-2 border-primary/30">
                    {line}
                  </p>
                )
              )}
            </CardContent>
          </Card>

          <Card className="glass-effect">
            <CardHeader>
              <CardTitle className="text-lg">Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Price data source</dt>
                  <dd className="font-medium capitalize">
                    {result.price_source?.replace(/_/g, ' ') ?? '—'}
                    {result.kite_used ? ' (Kite)' : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Sentiment data source</dt>
                  <dd className="font-medium capitalize">{result.sentiment_source?.replace(/_/g, ' ') ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Days in sample</dt>
                  <dd className="font-medium">{result.num_days ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Buy &amp; hold Sharpe (approx.)</dt>
                  <dd className="font-medium">{result.price_only_sharpe ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Sentiment strategy Sharpe</dt>
                  <dd className="font-medium">{result.strategy_sharpe ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Information coefficient (sentiment vs next-day return)</dt>
                  <dd className="font-medium">{result.ic ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Total return (buy &amp; hold)</dt>
                  <dd className="font-medium">{pct(result.total_return_price ?? undefined)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Total return (sentiment strategy)</dt>
                  <dd className="font-medium">{pct(result.total_return_strategy ?? undefined)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card className="glass-effect">
            <CardHeader>
              <CardTitle className="text-lg">Recent price context</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">~1 month return</dt>
                  <dd className="font-medium">{pct(result.recent_price_context?.approx_return_1m ?? undefined)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">~3 month return</dt>
                  <dd className="font-medium">{pct(result.recent_price_context?.approx_return_3m ?? undefined)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Annualized vol (daily)</dt>
                  <dd className="font-medium">{pct(result.recent_price_context?.annualized_volatility ?? undefined)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {ex?.strategy_note && (
            <Card className="glass-effect">
              <CardHeader>
                <CardTitle className="text-lg">Sentiment strategy</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed">{ex.strategy_note}</CardContent>
            </Card>
          )}

          {ex?.methodology && (
            <Card className="glass-effect">
              <CardHeader>
                <CardTitle className="text-lg">How this is computed</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground leading-relaxed">{ex.methodology}</CardContent>
            </Card>
          )}

          {ex?.disclaimer && (
            <p className="text-xs text-muted-foreground border border-border/50 rounded-lg p-4">{ex.disclaimer}</p>
          )}
        </>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Zap } from 'lucide-react';
import { ShockScoreGauge } from '@/components/shock/ShockScoreGauge';
import { ShockAlertFeed, type ShockAlertItem } from '@/components/shock/ShockAlertFeed';
import { djangoApiUrl } from '@/lib/apiBase';
import { shockWebSocketUrl } from '@/lib/wsBase';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ShockHistoryRow {
  date: string;
  direction: string;
  magnitude: number;
  intraday_range: number;
  cause_type: string;
  headline: string;
  index?: string;
}

export default function ShockPage() {
  const [score, setScore] = useState(0);
  const [liveCause, setLiveCause] = useState('none');
  const [alerts, setAlerts] = useState<ShockAlertItem[]>([]);
  const [history, setHistory] = useState<ShockHistoryRow[]>([]);
  const [connected, setConnected] = useState(false);
  const [causeFilter, setCauseFilter] = useState<string>('all');
  const ws = useRef<WebSocket | null>(null);

  const loadRest = useCallback(async () => {
    const [alertsRes, historyRes, scoreRes] = await Promise.all([
      fetch(djangoApiUrl('/api/shock/alerts/')),
      fetch(
        djangoApiUrl(
          `/api/shock/history/?page=1${causeFilter !== 'all' ? `&cause=${causeFilter}` : ''}`
        )
      ),
      fetch(djangoApiUrl('/api/shock/score/')),
    ]);
    if (alertsRes.ok) setAlerts(await alertsRes.json());
    if (historyRes.ok) {
      const d = await historyRes.json();
      setHistory(d.results || []);
    }
    if (scoreRes.ok) {
      const s = await scoreRes.json();
      setScore(s.score ?? 0);
      setLiveCause(s.cause ?? 'none');
    }
  }, [causeFilter]);

  useEffect(() => {
    loadRest();
  }, [loadRest]);

  useEffect(() => {
    const url = shockWebSocketUrl();
    ws.current = new WebSocket(url);
    ws.current.onopen = () => setConnected(true);
    ws.current.onclose = () => setConnected(false);
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data) as ShockAlertItem & { score?: number; cause?: string };
      setScore(data.score ?? 0);
      setLiveCause(data.cause ?? 'none');
      if ((data.score ?? 0) >= 70) {
        setAlerts((prev) => [data, ...prev].slice(0, 20));
      }
    };
    return () => ws.current?.close();
  }, []);

  const riskLabel =
    score >= 70 ? 'High risk' : score >= 40 ? 'Moderate' : 'Low';
  const riskClass =
    score >= 70
      ? 'text-destructive'
      : score >= 40
        ? 'text-amber-600'
        : 'text-emerald-600';

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            Shock Predictor
          </h1>
          <p className="text-muted-foreground text-sm">
            Nifty / BankNifty intraday shock probability · RBI / SEBI / wire feeds
          </p>
        </div>
        <Badge variant={connected ? 'default' : 'destructive'}>
          {connected ? '● Live' : 'Disconnected'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-6">
        <ShockScoreGauge score={score} />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Latest signal</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-semibold ${riskClass}`}>{riskLabel}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Cause: <span className="font-medium">{liveCause}</span> · updates every ~30s in
              market hours
            </p>
          </CardContent>
        </Card>
      </div>

      <section>
        <h2 className="text-lg font-medium mb-3">Alert log</h2>
        <ShockAlertFeed alerts={alerts} />
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">Historical shock events (≥500 pts range)</h2>
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={causeFilter}
            onChange={(e) => setCauseFilter(e.target.value)}
          >
            <option value="all">All causes</option>
            <option value="policy">Policy</option>
            <option value="macro">Macro</option>
            <option value="geopolitical">Geopolitical</option>
            <option value="technical">Technical</option>
            <option value="corporate">Corporate</option>
          </select>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-muted-foreground">
                <th className="text-left p-2 font-medium">Date</th>
                <th className="text-left p-2 font-medium">Index</th>
                <th className="text-left p-2 font-medium">Dir</th>
                <th className="text-right p-2 font-medium">Pts</th>
                <th className="text-right p-2 font-medium">Range</th>
                <th className="text-left p-2 font-medium">Cause</th>
                <th className="text-left p-2 font-medium">Headline</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-muted-foreground text-center">
                    No events yet. Run: python manage.py backtest_shocks --fast
                  </td>
                </tr>
              )}
              {history.map((e) => (
                <tr key={`${e.date}-${e.index}`} className="border-b border-border/50">
                  <td className="p-2">{e.date}</td>
                  <td className="p-2">{e.index || 'NIFTY'}</td>
                  <td
                    className={`p-2 ${e.direction === 'DOWN' ? 'text-destructive' : 'text-emerald-600'}`}
                  >
                    {e.direction}
                  </td>
                  <td className="p-2 text-right">{e.magnitude?.toFixed(0)}</td>
                  <td className="p-2 text-right">{e.intraday_range?.toFixed(0)}</td>
                  <td className="p-2">{e.cause_type}</td>
                  <td className="p-2 text-muted-foreground max-w-xs truncate">{e.headline}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

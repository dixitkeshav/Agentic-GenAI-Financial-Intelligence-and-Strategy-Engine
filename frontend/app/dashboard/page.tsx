'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useLiveTicker } from '@/hooks/useLiveTicker';
import { useNewsFeed } from '@/hooks/useNewsFeed';
import { useAgentInsights } from '@/hooks/useAgentInsights';
import { useAgentStore } from '@/store/agentStore';
import { useMarketStore } from '@/store/marketStore';
import { apiClient } from '@/lib/apiClient';
import { fmtPct, fmtPrice } from '@/lib/fintelli/format';
import { FintelliChart } from '@/components/fintelli/FintelliChart';
import { NewsRows } from '@/components/fintelli/NewsRows';
import { PipelineList } from '@/components/fintelli/PipelineList';
import { AgentCardsGrid } from '@/components/fintelli/AgentCardsGrid';

const DEFAULT_SYMBOL = '^NSEI';
const TIMEFRAMES: Record<string, string> = { '1D': '5d', '1W': '5d', '1M': '1mo', '3M': '3mo', '1Y': '1y' };

export default function DashboardPage() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [tf, setTf] = useState('1M');
  useLiveTicker();
  const indices = useMarketStore((s) => s.indices);
  const { news, isLoading: newsLoading } = useNewsFeed();
  const insights = useAgentStore((s) => s.insights);
  const { isLoading: agentsLoading, result: agentsResult } = useAgentInsights();

  const period = TIMEFRAMES[tf] || '1mo';
  const { data: history = [] } = useQuery({
    queryKey: ['chart-data', symbol, period],
    queryFn: () => apiClient.getChartData(symbol, period),
    refetchInterval: 60000,
  });

  const chartLabels = useMemo(
    () =>
      history.map((d) =>
        new Date(d.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      ),
    [history]
  );
  const prices = useMemo(() => history.map((d) => d.close), [history]);
  const nifty = indices[0];
  const priceChange = useMemo(() => {
    if (prices.length < 2) return { pct: 0 };
    const first = prices[0];
    const last = prices[prices.length - 1];
    return { pct: first ? ((last - first) / first) * 100 : 0 };
  }, [prices]);

  const shockScore = agentsResult?.shock?.shock_probability ?? 0;
  const bullishCount = insights.filter((i) => i.signal === 'BULLISH').length;
  const consensus =
    bullishCount > insights.length / 2 ? 'BULLISH' : insights.some((i) => i.signal === 'BEARISH') ? 'BEARISH' : 'NEUTRAL';

  const displaySymbol = symbol.replace(/^\^/, '');

  return (
    <div>
      <div className="pg-head">
        <div className="pg-title">Financial Intelligence Dashboard</div>
        <div className="pg-sub">AI-powered insights, live from the market</div>
      </div>

      <div className="briefing">
        <div className="brief-badge">
          <div className="ldot" /> AI Briefing
        </div>
        <div className="brief-title">
          {agentsResult?.decision?.recommendation ||
            agentsResult?.decision?.summary ||
            'Run agent pipeline for today’s market narrative'}
        </div>
        <div className="brief-body">
          {agentsResult?.macro_context?.summary ||
            agentsResult?.news_scout?.summary ||
            'Connect Django backend to load multi-agent summaries and macro context.'}
        </div>
        <div className="brief-metrics">
          <div className="bm">
            <div className="bm-icon">📰</div>
            <div>
              <div className="bm-val">{agentsResult?.article_count ?? news.length}</div>
              <div className="bm-lbl">Articles</div>
            </div>
          </div>
          <div className="bm">
            <div className="bm-icon">⚡</div>
            <div>
              <div className="bm-val" style={{ color: shockScore >= 70 ? 'var(--red)' : shockScore >= 40 ? 'var(--amber)' : 'var(--green)' }}>
                {Math.round(shockScore)}
              </div>
              <div className="bm-lbl">Shock Score</div>
            </div>
          </div>
          <div className="bm">
            <div className="bm-icon">🎯</div>
            <div>
              <div className="bm-val" style={{ color: consensus === 'BULLISH' ? 'var(--green)' : consensus === 'BEARISH' ? 'var(--red)' : 'var(--accent)' }}>
                {consensus}
              </div>
              <div className="bm-lbl">AI Consensus</div>
            </div>
          </div>
        </div>
      </div>

      <div className="g4 mb14">
        {indices.slice(0, 4).map((idx) => {
          const up = idx.changePercent >= 0;
          return (
            <div key={idx.symbol} className="mc">
              <div className="mc-lbl">{idx.symbol}</div>
              <div className="mc-val">{fmtPrice(idx.price)}</div>
              <div className={`mc-chg ${up ? 'up' : 'dn'}`}>
                {up ? '▲' : '▼'} {fmtPct(idx.changePercent)}
              </div>
              <div className="mc-bar">
                <div
                  className="mc-bfill"
                  style={{ width: `${Math.min(100, Math.abs(idx.changePercent) * 20)}%`, background: up ? 'var(--green)' : 'var(--red)' }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="row mb14">
        <div className="f1">
          <div className="chart-card mb14">
            <div className="chart-ctrl">
              <div>
                <div className="chart-sym">
                  {displaySymbol}{' '}
                  <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="finput"
                    style={{ width: 100, display: 'inline-block', marginLeft: 8, padding: '4px 8px', fontSize: 12 }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 3 }}>
                  <span className="chart-price">{nifty ? fmtPrice(nifty.price) : '—'}</span>
                  <span className={`chart-badge ${priceChange.pct >= 0 ? 'up' : 'dn'}`}>
                    {priceChange.pct >= 0 ? '▲' : '▼'} {fmtPct(priceChange.pct)}
                  </span>
                </div>
              </div>
              <div className="tf-group">
                {Object.keys(TIMEFRAMES).map((k) => (
                  <button key={k} type="button" className={`tf ${tf === k ? 'act' : ''}`} onClick={() => setTf(k)}>
                    {k}
                  </button>
                ))}
              </div>
            </div>
            {chartLabels.length > 0 ? (
              <FintelliChart
                id="dash-main"
                labels={chartLabels}
                datasets={[{ label: 'Price', data: prices, color: 'var(--accent)', fill: true }]}
              />
            ) : (
              <div className="chart-area" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
                Loading chart…
              </div>
            )}
          </div>

          <div className="card mb14">
            <div className="ch">
              <div className="ct">
                <div className="ldot" />
                News Intelligence
              </div>
              <Link href="/dashboard/news" className="cact">
                View all →
              </Link>
            </div>
            {newsLoading ? <p className="cb" style={{ color: 'var(--text-3)' }}>Loading news…</p> : <NewsRows items={news} limit={5} />}
          </div>

          <div className="pg-sub mb14">🤖 Agent Results</div>
          <AgentCardsGrid insights={insights} />
        </div>

        <div style={{ width: 310, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="ch">
              <div className="ct">🤖 Agent Pipeline</div>
              <span className={`badge ${agentsLoading ? 'badge-am' : 'badge-gr'}`}>{agentsLoading ? 'Running' : 'Live'}</span>
            </div>
            <PipelineList steps={agentsResult?.pipeline} isLoading={agentsLoading} />
          </div>
          <div className="card">
            <div className="ch">
              <div className="ct">Quick links</div>
            </div>
            <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link href="/dashboard/shock" className="btn-pri" style={{ textAlign: 'center', textDecoration: 'none' }}>
                Shock Predictor
              </Link>
              <Link href="/dashboard/scanner" className="btn-ghost" style={{ textAlign: 'center', textDecoration: 'none' }}>
                Run Screener
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

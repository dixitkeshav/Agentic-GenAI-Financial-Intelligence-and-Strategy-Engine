'use client';

import { useEffect, useState, useRef } from 'react';
import { useAgentStore } from '@/store/agentStore';
import { useAgentInsights } from '@/hooks/useAgentInsights';
import { PipelineList } from '@/components/fintelli/PipelineList';
import { AgentCardsGrid } from '@/components/fintelli/AgentCardsGrid';
import { AgentNewsFeed } from '@/components/fintelli/AgentNewsFeed';
import { apiClient, type QuantCatalog } from '@/lib/apiClient';

const DEFAULT_INDICATORS = ['rsi', 'mfi', 'macd_hist', 'sma_20', 'sma_50', 'return_21d', 'volume_sma_ratio'];

/** Counts elapsed seconds while `active` is true, resets to 0 when active becomes false. */
function useElapsedTimer(active: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (active) {
      setElapsed(0);
      ref.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else {
      if (ref.current) clearInterval(ref.current);
    }
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [active]);

  return elapsed;
}

export default function AgentsPage() {
  const [ticker, setTicker] = useState('RELIANCE');
  const [activeTicker, setActiveTicker] = useState<string>('RELIANCE');
  const [catalog, setCatalog] = useState<QuantCatalog | null>(null);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>(DEFAULT_INDICATORS);
  const insights = useAgentStore((s) => s.insights);
  const { isLoading, result } = useAgentInsights(activeTicker, { selectedIndicators });
  const elapsed = useElapsedTimer(isLoading);

  useEffect(() => {
    apiClient.getQuantCatalog().then(setCatalog);
  }, []);

  const toggleIndicator = (id: string) => {
    setSelectedIndicators((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const sourceCounts = result?.news_sources;
  const sourceLabel = result?.news_source;
  const articles = result?.articles;

  return (
    <div>
      <div className="pg-head">
        <div className="pg-title">Agent Insights</div>
        <div className="pg-sub">
          Multi-agent research pipeline with sentiment and technical analysis
        </div>
      </div>

      {/* ── Ticker + Run ── */}
      <div className="card mb14">
        <div className="cb">
          <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 }}>
            <div>
              <label className="flabel">Ticker Symbol</label>
              <input
                type="text"
                className="finput"
                style={{ width: 200 }}
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                onKeyDown={(e) =>
                  e.key === 'Enter' && !isLoading && setActiveTicker(ticker.trim() || 'RELIANCE')
                }
                placeholder="RELIANCE, HINDUNILVR…"
              />
            </div>
            <button
              type="button"
              className="btn-pri"
              onClick={() => setActiveTicker(ticker.trim() || 'RELIANCE')}
              disabled={isLoading}
            >
              {isLoading ? `Running… ${elapsed}s` : '▶ Run Pipeline'}
            </button>
          </div>
          {sourceLabel && (
            <p className="pg-sub" style={{ marginTop: 10 }}>
              News coverage: <strong>{sourceLabel}</strong>
              {sourceCounts && (
                <> · {Object.values(sourceCounts).reduce((a, b) => a + (b ?? 0), 0)} articles analyzed</>
              )}
            </p>
          )}
        </div>
      </div>

      {/* ── Technical indicators ── */}
      {catalog && (
        <div className="card mb14">
          <div className="ch">
            <div className="ct">📈 Technical indicators</div>
            <span className="badge badge-bl">{selectedIndicators.length} selected</span>
          </div>
          <div className="cb" style={{ maxHeight: 160, overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(catalog.indicators ?? [])
                .filter((i) => i.computed !== false)
                .map((ind) => (
                  <button
                    key={ind.id}
                    type="button"
                    className={`badge ${selectedIndicators.includes(ind.id) ? 'badge-gr' : 'badge-am'}`}
                    style={{ cursor: 'pointer', border: 'none' }}
                    onClick={() => toggleIndicator(ind.id)}
                  >
                    {ind.name}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Pipeline Status ── */}
      <div className="card mb14">
        <div className="ch">
          <div className="ct">🔄 Pipeline Status</div>
          {isLoading && (
            <span className="badge badge-am" style={{ animation: 'pulse-ring 1.4s ease infinite' }}>
              Processing…
            </span>
          )}
          {!isLoading && result?.article_count != null && (
            <span className="badge badge-bl">{result.article_count} articles</span>
          )}
        </div>
        <PipelineList steps={result?.pipeline} isLoading={isLoading} />
      </div>

      {/* ── News Feed ── */}
      <div className="card mb14">
        <div className="ch">
          <div className="ct">📰 News Feed — Decision Basis</div>
          {!isLoading && articles && articles.length > 0 && (
            <div style={{ display: 'flex', gap: 6 }}>
              {/* mini sentiment bars */}
              {(() => {
                const pos = articles.filter((a) => (a.sentiment || '').toLowerCase() === 'positive').length;
                const neg = articles.filter((a) => (a.sentiment || '').toLowerCase() === 'negative').length;
                const total = articles.length;
                const pctPos = Math.round((pos / total) * 100);
                const pctNeg = Math.round((neg / total) * 100);
                return (
                  <div
                    title={`${pctPos}% positive · ${pctNeg}% negative`}
                    style={{
                      display: 'flex',
                      width: 80,
                      height: 6,
                      borderRadius: 3,
                      overflow: 'hidden',
                      alignSelf: 'center',
                    }}
                  >
                    <div style={{ width: `${pctPos}%`, background: 'var(--green)' }} />
                    <div style={{ width: `${pctNeg}%`, background: 'var(--red)' }} />
                    <div style={{ flex: 1, background: 'var(--bg-inset)' }} />
                  </div>
                );
              })()}
              <span className="badge badge-bl">{articles.length} articles</span>
            </div>
          )}
        </div>
        <AgentNewsFeed articles={articles} isLoading={isLoading} />
      </div>

      {/* ── Agent Results ── */}
      <div className="pg-sub mb14">📊 Agent Results</div>
      <AgentCardsGrid insights={insights} isLoading={isLoading} />
    </div>
  );
}

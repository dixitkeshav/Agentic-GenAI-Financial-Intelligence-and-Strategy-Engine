'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  apiClient,
  ApiError,
  type BacktestMode,
  type BacktestResult,
  type BacktestStrategyTemplate,
  type BacktestTrade,
  type BacktestTradeNews,
  type CompiledStrategy,
} from '@/lib/apiClient';
import { useSettingsStore } from '@/lib/store/settingsStore';

type TradeMode = 'equity_intraday' | 'equity_delivery' | 'options';

export default function BacktestPage() {
  const [ticker, setTicker] = useState('RELIANCE');
  const [tradeMode, setTradeMode] = useState<TradeMode>('equity_delivery');
  const [strategyId, setStrategyId] = useState('custom');
  const [strategyPrompt, setStrategyPrompt] = useState('');
  const [customOnly, setCustomOnly] = useState(true);
  const [onlyNewsEvents, setOnlyNewsEvents] = useState(true);
  const [periodPreset, setPeriodPreset] = useState<'3mo' | '6mo' | '1y' | 'custom'>('6mo');
  const [periodDays, setPeriodDays] = useState(126);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [templates, setTemplates] = useState<BacktestStrategyTemplate[]>([]);
  const [catalogMeta, setCatalogMeta] = useState<{ indicators: number; patterns: number } | null>(null);
  const [optionsMeta, setOptionsMeta] = useState<BacktestResult['options_chain'] | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [compiled, setCompiled] = useState<CompiledStrategy | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apiKey = useSettingsStore((s) => s.apiKey);
  const accessToken = useSettingsStore((s) => s.accessToken);

  const loadMeta = useCallback(async () => {
    try {
      const meta = await apiClient.getBacktestTemplates(ticker);
      setTemplates(meta.templates || []);
      setOptionsMeta(meta.options_chain ?? null);
      if (meta.catalog) {
        setCatalogMeta({
          indicators: meta.catalog.indicator_count ?? meta.catalog.indicators?.length ?? 0,
          patterns: meta.catalog.pattern_count ?? meta.catalog.candlestick_patterns?.length ?? 0,
        });
      }
    } catch {
      setTemplates([]);
      setOptionsMeta(null);
    }
  }, [ticker]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (strategyId === 'custom') setCustomOnly(true);
  }, [strategyId]);

  const fetchSuggestions = useCallback((prefix: string) => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(async () => {
      try {
        const list = await apiClient.suggestBacktestStrategy(prefix);
        setSuggestions(list);
      } catch {
        setSuggestions([]);
      }
    }, 280);
  }, []);

  const fixWithAi = async () => {
    const text = strategyPrompt.trim();
    if (!text) return;
    setCompiling(true);
    try {
      const out = await apiClient.compileBacktestStrategy(text, tradeMode);
      setCompiled(out);
      if (out.normalized_prompt) setStrategyPrompt(out.normalized_prompt);
    } catch (e) {
      setCompiled({
        fixes_applied: [e instanceof Error ? e.message : 'Compile failed — set GROQ_API_KEY in backend/.env'],
      });
    } finally {
      setCompiling(false);
    }
  };

  const periodParams = () => {
    const map = { '3mo': 63, '6mo': 126, '1y': 252 } as const;
    if (periodPreset === 'custom') {
      return {
        days: periodDays,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        periodLabel: startDate && endDate ? `${startDate} → ${endDate}` : `Last ${periodDays} days`,
      };
    }
    const d = map[periodPreset];
    return { days: d, periodLabel: `Last ${periodPreset}` };
  };

  const runBacktest = async () => {
    setLoading(true);
    setResult(null);
    try {
      const compiledRules = compiled?.rules as unknown[] | undefined;
      let useGroq = false;
      if (strategyPrompt.trim() && (customOnly || strategyId === 'custom')) {
        useGroq = !compiledRules?.length;
      }

      const p = periodParams();
      const data = await apiClient.runBacktest(ticker, {
        mode: tradeMode as BacktestMode,
        strategyId,
        strategyPrompt: strategyPrompt.trim() || undefined,
        onlyNewsEvents,
        customOnly: customOnly || strategyId === 'custom',
        useGroqCompile: useGroq,
        compiledRules,
        days: p.days,
        startDate: p.startDate,
        endDate: p.endDate,
        periodLabel: p.periodLabel,
        useKite: !!(apiKey && accessToken),
        kiteCredentials: { apiKey, accessToken },
      });
      setResult(data);
      if (data.strategy?.compile) {
        setCompiled(data.strategy.compile as CompiledStrategy);
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e);
      setResult({ error: msg });
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter((t) => {
    if (tradeMode === 'options') return t.mode_hint === 'options';
    return t.mode_hint !== 'options';
  });

  useEffect(() => {
    if (filteredTemplates.length && !filteredTemplates.find((t) => t.id === strategyId)) {
      setStrategyId(filteredTemplates[0].id);
    }
  }, [filteredTemplates, strategyId]);

  const ex = result?.explanation;
  const sum = result?.summary;
  const trades = result?.trades || [];
  const newsPool = result?.news_pool || [];
  const tradesByDay = trades.reduce<Record<string, number>>((acc, t) => {
    acc[t.date] = (acc[t.date] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div className="pg-head">
        <div className="pg-title">Backtesting</div>
        <div className="pg-sub">
          Custom rules + Groq fix · News-day trade log · yfinance options proxy
          {catalogMeta ? ` · ${catalogMeta.indicators} indicators · ${catalogMeta.patterns} candle patterns` : ''}
        </div>
      </div>

      <div className="card mb14">
        <div className="ch">
          <div className="ct">Setup</div>
        </div>
        <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div>
              <label className="flabel">Symbol</label>
              <input
                type="text"
                className="finput"
                style={{ width: 140 }}
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                onBlur={loadMeta}
              />
            </div>
            {optionsMeta && (
              <div style={{ fontSize: 12, color: 'var(--text-3)', alignSelf: 'flex-end', paddingBottom: 6, maxWidth: 320 }}>
                Options:{' '}
                <span style={{ color: optionsMeta.available ? 'var(--green)' : 'var(--amber)' }}>
                  {optionsMeta.available
                    ? optionsMeta.proxy
                      ? `Proxy mode (underlying OHLC)`
                      : `${optionsMeta.source ?? 'yfinance'} chain (${optionsMeta.chain_rows ?? optionsMeta.expiries_count ?? 0} strikes)`
                    : 'Unavailable'}
                </span>
                {optionsMeta.source && !optionsMeta.proxy && (
                  <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-4)' }}>
                    via {optionsMeta.source}
                  </span>
                )}
                {optionsMeta.note && (
                  <div style={{ marginTop: 4, fontSize: 11 }}>{optionsMeta.note}</div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="flabel">Backtest period</label>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 6, marginBottom: 8 }}>
              {(['3mo', '6mo', '1y', 'custom'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={periodPreset === p ? 'btn-pri' : 'btn-ghost'}
                  onClick={() => setPeriodPreset(p)}
                >
                  {p === 'custom' ? 'Custom range' : p.toUpperCase()}
                </button>
              ))}
            </div>
            {periodPreset === 'custom' ? (
              <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <label className="flabel">From</label>
                  <input type="date" className="finput" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="flabel">To</label>
                  <input type="date" className="finput" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
                <div>
                  <label className="flabel">Or last N days</label>
                  <input
                    type="number"
                    className="finput"
                    style={{ width: 90 }}
                    min={30}
                    max={504}
                    value={periodDays}
                    onChange={(e) => setPeriodDays(Number(e.target.value) || 126)}
                  />
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Testing roughly {periodPreset === '3mo' ? 63 : periodPreset === '6mo' ? 126 : 252} trading days of history.
              </p>
            )}
          </div>

          <div>
            <label className="flabel">Trading mode</label>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {(
                [
                  ['equity_intraday', 'Intraday (same-day OHLC)'],
                  ['equity_delivery', 'Delivery / swing (next-day exit)'],
                  ['options', 'Options strategy'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={tradeMode === id ? 'btn-pri' : 'btn-ghost'}
                  onClick={() => setTradeMode(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="flabel">Strategy template</label>
            <select
              className="finput"
              style={{ width: '100%', maxWidth: 480 }}
              value={strategyId}
              onChange={(e) => setStrategyId(e.target.value)}
            >
              {filteredTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.requires_news ? ' · news' : ''}
                </option>
              ))}
            </select>
            {filteredTemplates.find((t) => t.id === strategyId)?.description && (
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
                {filteredTemplates.find((t) => t.id === strategyId)?.description}
              </p>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="flabel" style={{ margin: 0 }}>
                Custom rules (English)
              </label>
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={fixWithAi}
                disabled={compiling || !strategyPrompt.trim()}
              >
                {compiling ? 'Fixing…' : '✨ Fix with AI (Groq)'}
              </button>
            </div>
            <textarea
              className="finput"
              rows={3}
              style={{ width: '100%', maxWidth: 560, resize: 'vertical' }}
              placeholder="e.g. Buy when Bollinger score is greater than twenty and VWAP is around forty…"
              value={strategyPrompt}
              onChange={(e) => {
                setStrategyPrompt(e.target.value);
                setShowSuggestions(true);
                fetchSuggestions(e.target.value);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul
                style={{
                  position: 'absolute',
                  zIndex: 20,
                  left: 0,
                  right: 0,
                  maxWidth: 560,
                  marginTop: 4,
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  listStyle: 'none',
                  padding: 0,
                  maxHeight: 180,
                  overflow: 'auto',
                }}
              >
                {suggestions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 12px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-2)',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setStrategyPrompt(s);
                        setShowSuggestions(false);
                      }}
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {compiled && (
              <div
                style={{
                  marginTop: 8,
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  fontSize: 12,
                  color: 'var(--text-3)',
                }}
              >
                {compiled.normalized_prompt && (
                  <div style={{ marginBottom: 6 }}>
                    <strong>Aligned:</strong> {compiled.normalized_prompt}
                  </div>
                )}
                {(compiled.fixes_applied?.length ?? 0) > 0 && (
                  <div>Fixes: {compiled.fixes_applied!.join(' · ')}</div>
                )}
                {compiled.rules && (
                  <pre style={{ marginTop: 8, fontSize: 11, overflow: 'auto' }}>
                    {JSON.stringify(compiled.rules, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
            <input
              type="checkbox"
              checked={customOnly}
              onChange={(e) => setCustomOnly(e.target.checked)}
            />
            Use only custom rules (ignore template defaults)
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
            <input
              type="checkbox"
              checked={onlyNewsEvents}
              onChange={(e) => setOnlyNewsEvents(e.target.checked)}
            />
            Only take trades on days with relevant company news (investment, stake, earnings, etc.)
          </label>

          <button type="button" className="btn-pri" onClick={runBacktest} disabled={loading}>
            {loading ? 'Running backtest…' : '▶ Run backtest'}
          </button>
        </div>
      </div>

      {result?.kite_note && (
        <p className="mb14" style={{ fontSize: 12, color: 'var(--text-3)' }}>
          {result.kite_note}
        </p>
      )}

      {result?.error && (
        <div className="card mb14" style={{ borderColor: 'var(--red)' }}>
          <div className="cb" style={{ color: 'var(--red)' }}>
            {result.error}
          </div>
        </div>
      )}

      {result?.period && (
        <div className="card mb14">
          <div className="cb" style={{ fontSize: 13, color: 'var(--text-2)' }}>
            <strong>Test window:</strong> {result.period.start} → {result.period.end}
            <span style={{ color: 'var(--text-3)' }}> ({result.period.bars_in_range} bars · {result.period.label})</span>
          </div>
        </div>
      )}

      {sum && (
        <>
          <div className="g4 mb14">
            <div className="mc">
              <div className="mc-lbl">Trades</div>
              <div className="mc-val">{sum.total_trades}</div>
            </div>
            <div className="mc">
              <div className="mc-lbl">Win rate</div>
              <div className="mc-val">{sum.win_rate_pct}%</div>
            </div>
            <div className="mc">
              <div className="mc-lbl">Total return</div>
              <div className="mc-val" style={{ color: sum.total_return_pct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {sum.total_return_pct.toFixed(2)}%
              </div>
            </div>
            <div className="mc">
              <div className="mc-lbl">News used</div>
              <div className="mc-val">{sum.news_articles_considered}</div>
            </div>
          </div>

          {result.strategy && (
            <div className="card mb14">
              <div className="ch">
                <div className="ct">Strategy used</div>
              </div>
              <div className="cb" style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-2)' }}>
                <strong>{result.strategy.name}</strong>
                <p style={{ marginTop: 6 }}>{result.strategy.description}</p>
                <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-3)' }}>
                  Mode: {result.mode} · Price: {result.price_source}
                  {result.strategy.custom_prompt ? ` · Custom: "${result.strategy.custom_prompt}"` : ''}
                </p>
              </div>
            </div>
          )}

          {ex?.headline && (
            <div className="card mb14">
              <div className="ch">
                <div className="ct">Summary</div>
              </div>
              <div className="cb" style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.75 }}>
                <p>{ex.headline}</p>
                {ex.methodology && <p style={{ marginTop: 10, fontSize: 12, color: 'var(--text-3)' }}>{ex.methodology}</p>}
                {ex.disclaimer && <p style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)' }}>{ex.disclaimer}</p>}
              </div>
            </div>
          )}

          <div className="card mb14">
            <div className="ch">
              <div className="ct">Trade blotter (detailed)</div>
            </div>
            <div className="cb" style={{ padding: 0, overflowX: 'auto' }}>
              {trades.length === 0 ? (
                <p style={{ padding: 16, fontSize: 13, color: 'var(--text-3)' }}>No trades to display.</p>
              ) : (
                <table className="dtable" style={{ minWidth: 980 }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th># / day</th>
                      <th>Decision</th>
                      <th>Mode</th>
                      <th>Expiry</th>
                      <th>ATM strike</th>
                      <th>Legs</th>
                      <th>Entry</th>
                      <th>Exit</th>
                      <th>News</th>
                      <th>P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((t) => {
                      const ex = t.execution;
                      const legs = ex?.option_legs?.map((l) => `${l.leg}@${l.strike}`).join(' · ') || '—';
                      const newsCount = t.news?.length || 0;
                      return (
                        <tr key={`${t.date}-${ex?.decision || t.action}`}>
                          <td className="mono">{t.date}</td>
                          <td className="mono">{tradesByDay[t.date] || 1}</td>
                          <td className="mono">{ex?.decision || t.action}</td>
                          <td className="mono">{result?.mode || '—'}</td>
                          <td className="mono">{ex?.option_expiry || '—'}</td>
                          <td className="mono">
                            {ex?.strike != null ? `${ex.strike}${ex.strike_source ? ` (${ex.strike_source})` : ''}` : '—'}
                          </td>
                          <td style={{ maxWidth: 360 }}>
                            <span className="mono" style={{ whiteSpace: 'nowrap' }}>
                              {legs}
                            </span>
                          </td>
                          <td className="mono">{ex ? `${ex.entry_date} ${ex.entry_time} @ ${ex.entry_price}` : '—'}</td>
                          <td className="mono">{ex ? `${ex.exit_date} ${ex.exit_time} @ ${ex.exit_price}` : '—'}</td>
                          <td className="mono">{newsCount}</td>
                          <td className="mono" style={{ color: t.pnl_pct >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                            {t.pnl_pct >= 0 ? '+' : ''}
                            {t.pnl_pct.toFixed(2)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card mb14">
            <div className="ch">
              <div className="ct">News pool used (all headlines considered)</div>
            </div>
            <div className="cb" style={{ padding: 0 }}>
              {newsPool.length === 0 ? (
                <p style={{ padding: 16, fontSize: 13, color: 'var(--text-3)' }}>
                  No news items were pulled for this window. If you enabled “news only”, this will typically result in zero trades.
                </p>
              ) : (
                <div style={{ maxHeight: 420, overflow: 'auto' }}>
                  {newsPool.map((n: BacktestTradeNews & { date?: string }, idx: number) => (
                    <div key={idx} style={{ padding: '10px 16px', borderTop: idx ? '1px solid var(--border)' : 'none' }}>
                      <div className="row" style={{ justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                        <div className="mono" style={{ fontWeight: 600 }}>
                          {n.date || '—'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-4)' }}>{n.source || '—'}</div>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
                        {n.url ? (
                          <a href={n.url} target="_blank" rel="noreferrer">
                            {n.title}
                          </a>
                        ) : (
                          n.title
                        )}
                      </div>
                      {n.summary && (
                        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-3)' }}>{String(n.summary).slice(0, 220)}</div>
                      )}
                      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-4)' }}>
                        Sentiment: {n.sentiment || '—'} ({n.sentiment_score ?? '—'}) · Relevance: {n.relevance || '—'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card mb14">
            <div className="ch">
              <div className="ct">Trade log (news + metrics per trade)</div>
            </div>
            <div className="cb" style={{ padding: 0 }}>
              {(result.trades?.length ?? 0) === 0 ? (
                <p style={{ padding: 16, fontSize: 13, color: 'var(--text-3)' }}>
                  No trades matched your rules in this window. Try disabling “news only”, another symbol, or looser RSI/MFI
                  rules.
                </p>
              ) : (
                result.trades!.map((trade: BacktestTrade) => (
                  <TradeRow
                    key={trade.date}
                    trade={trade}
                    open={expandedTrade === trade.date}
                    onToggle={() => setExpandedTrade(expandedTrade === trade.date ? null : trade.date)}
                  />
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TradeRow({
  trade,
  open,
  onToggle,
}: {
  trade: BacktestTrade;
  open: boolean;
  onToggle: () => void;
}) {
  const m = trade.metrics;
  const pnlColor = trade.pnl_pct >= 0 ? 'var(--green)' : 'var(--red)';

  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '12px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'inherit',
        }}
      >
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <span className="mono" style={{ fontWeight: 600 }}>
              {trade.date}
            </span>
            <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--text-3)' }}>
              {trade.action} · {trade.hold_type}
            </span>
          </div>
          <span className="mono" style={{ color: pnlColor, fontWeight: 600 }}>
            {trade.pnl_pct >= 0 ? '+' : ''}
            {trade.pnl_pct.toFixed(2)}%
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
          O {m.open} H {m.high} L {m.low} C {m.close}
                      {m.rsi != null ? ` · RSI ${m.rsi}` : ''}
                      {m.mfi != null ? ` · MFI ${m.mfi}` : ''}
                      {'bb_pct' in m && m.bb_pct != null ? ` · BB% ${m.bb_pct}` : ''}
                      {'vwap_dist' in m && m.vwap_dist != null ? ` · VWAP ${m.vwap_dist}%` : ''}
                      {m.day_return_pct != null ? ` · Day ${m.day_return_pct}%` : ''}
        </div>
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px', fontSize: 13, lineHeight: 1.65, color: 'var(--text-2)' }}>
          {trade.execution && (
            <div
              style={{
                marginBottom: 14,
                padding: 12,
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-2)',
                fontSize: 12,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Execution ticket</div>
              <div className="row" style={{ flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div style={{ color: 'var(--text-3)' }}>Decision</div>
                  <div className="mono">{trade.execution.decision}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-3)' }}>Entry</div>
                  <div className="mono">
                    {trade.execution.entry_date} {trade.execution.entry_time} @ {trade.execution.entry_price}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-3)' }}>Exit</div>
                  <div className="mono">
                    {trade.execution.exit_date} {trade.execution.exit_time} @ {trade.execution.exit_price}
                  </div>
                </div>
                {trade.execution.strike != null && (
                  <div>
                    <div style={{ color: 'var(--text-3)' }}>
                      ATM strike
                      {trade.execution.strike_source ? ` (${trade.execution.strike_source})` : ''}
                    </div>
                    <div className="mono">{trade.execution.strike}</div>
                  </div>
                )}
                {trade.execution.option_expiry && (
                  <div>
                    <div style={{ color: 'var(--text-3)' }}>Option expiry</div>
                    <div className="mono">{trade.execution.option_expiry}</div>
                  </div>
                )}
                {trade.execution.stop_loss_price != null && (
                  <div>
                    <div style={{ color: 'var(--text-3)' }}>Stop loss</div>
                    <div className="mono">{trade.execution.stop_loss_price}</div>
                  </div>
                )}
                {trade.execution.take_profit_price != null && (
                  <div>
                    <div style={{ color: 'var(--text-3)' }}>Take profit</div>
                    <div className="mono">{trade.execution.take_profit_price}</div>
                  </div>
                )}
                <div>
                  <div style={{ color: 'var(--text-3)' }}>Session</div>
                  <div>{trade.execution.session}</div>
                </div>
              </div>
              {trade.execution.option_legs && trade.execution.option_legs.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ color: 'var(--text-3)', marginBottom: 4 }}>Option legs</div>
                  {trade.execution.option_legs.map((leg, i) => (
                    <div key={i} className="mono">
                      {leg.leg} @ {leg.strike}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <p style={{ marginBottom: 10 }}>
            <strong>Why this trade:</strong> {trade.reason}
          </p>
          {trade.news.length > 0 ? (
            <>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>Headlines that day</div>
              {trade.news.map((n, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: 10,
                    padding: 10,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-2)',
                  }}
                >
                  <div style={{ fontWeight: 500 }}>{n.title}</div>
                  {n.summary && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{n.summary}</div>}
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                    {n.source} · sentiment: {n.sentiment}
                    {n.sentiment_score != null ? ` (${n.sentiment_score})` : ''}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>No headlines stored for this date (rule matched on indicators only).</p>
          )}
        </div>
      )}
    </div>
  );
}

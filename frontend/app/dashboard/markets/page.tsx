'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLiveTicker } from '@/hooks/useLiveTicker';
import { useMarketStore } from '@/store/marketStore';
import { fmtPct, fmtPrice } from '@/lib/fintelli/format';
import { apiClient, type IntradayTradeDecision } from '@/lib/apiClient';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';

const PERIODS: Record<string, string> = {
  '1D': '1d',
  '1W': '5d',
  '1M': '1mo',
};

type TradeStatus = 'ACTIVE' | 'TARGET_HIT' | 'SL_HIT' | 'TIME_EXIT' | 'MANUAL_EXIT';
type TradeSide = 'BUY' | 'SELL';

type TradeEvent = {
  at: number;
  message: string;
};

type ActiveTrade = {
  id: string;
  symbol: string;
  side: TradeSide;
  entry: number;
  stopLoss: number;
  target: number;
  holdMinutes: number;
  openedAt: number;
  holdUntil: number;
  status: TradeStatus;
  exitPrice?: number;
  exitReason?: string;
  events: TradeEvent[];
};

export default function MarketsPage() {
  useLiveTicker();
  const indices = useMarketStore((s) => s.indices);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [periodKey, setPeriodKey] = useState<keyof typeof PERIODS>('1D');
  const [holdMinutes, setHoldMinutes] = useState(15);
  const [decisionVersion, setDecisionVersion] = useState(0);
  const [activeTrade, setActiveTrade] = useState<ActiveTrade | null>(null);

  useEffect(() => {
    if (!selectedSymbol && indices.length > 0) {
      setSelectedSymbol(indices[0].symbol);
    }
  }, [indices, selectedSymbol]);

  const selectedMarket = useMemo(
    () => indices.find((idx) => idx.symbol === selectedSymbol) || null,
    [indices, selectedSymbol]
  );
  const rawSymbol = selectedMarket?.rawSymbol || selectedMarket?.symbol || '^NSEI';
  const period = PERIODS[periodKey] || '1d';

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['markets-history', rawSymbol, period],
    queryFn: () => apiClient.getChartData(rawSymbol, period),
    enabled: Boolean(rawSymbol),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const { data: decision, isFetching: decisionLoading } = useQuery<IntradayTradeDecision>({
    queryKey: ['intraday-decision', rawSymbol, holdMinutes, decisionVersion],
    queryFn: () => apiClient.getIntradayTradeDecision(rawSymbol, holdMinutes),
    enabled: Boolean(rawSymbol),
    staleTime: 30000,
  });

  const chartData = useMemo(
    () =>
      history.map((row) => ({
        ts: row.timestamp,
        close: row.close,
        label:
          period === '1d'
            ? new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : new Date(row.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      })),
    [history, period]
  );

  const currentPrice = selectedMarket?.price ?? (chartData.length ? chartData[chartData.length - 1].close : 0);
  const livePnL = useMemo(() => {
    if (!activeTrade || activeTrade.status !== 'ACTIVE' || !currentPrice) return 0;
    if (activeTrade.side === 'BUY') {
      return ((currentPrice - activeTrade.entry) / activeTrade.entry) * 100;
    }
    return ((activeTrade.entry - currentPrice) / activeTrade.entry) * 100;
  }, [activeTrade, currentPrice]);

  useEffect(() => {
    if (!activeTrade || activeTrade.status !== 'ACTIVE' || !currentPrice) return;
    const now = Date.now();
    const price = currentPrice;
    let nextTrade: ActiveTrade | null = activeTrade;

    const closeTrade = (status: TradeStatus, reason: string) => {
      if (!nextTrade) return;
      nextTrade = {
        ...nextTrade,
        status,
        exitPrice: price,
        exitReason: reason,
        events: [...nextTrade.events, { at: now, message: reason }],
      };
    };

    if (activeTrade.side === 'BUY') {
      if (price <= activeTrade.stopLoss) {
        closeTrade('SL_HIT', 'Stop-loss hit');
      } else if (price >= activeTrade.target) {
        closeTrade('TARGET_HIT', 'Target hit');
      }
    } else {
      if (price >= activeTrade.stopLoss) {
        closeTrade('SL_HIT', 'Stop-loss hit');
      } else if (price <= activeTrade.target) {
        closeTrade('TARGET_HIT', 'Target hit');
      }
    }

    // Simple trailing protection: once +0.5% is reached, lock SL to entry.
    if (nextTrade && nextTrade.status === 'ACTIVE') {
      const pnlPct =
        nextTrade.side === 'BUY'
          ? ((price - nextTrade.entry) / nextTrade.entry) * 100
          : ((nextTrade.entry - price) / nextTrade.entry) * 100;
      const canTrail =
        pnlPct >= 0.5 &&
        ((nextTrade.side === 'BUY' && nextTrade.stopLoss < nextTrade.entry) ||
          (nextTrade.side === 'SELL' && nextTrade.stopLoss > nextTrade.entry));
      if (canTrail) {
        nextTrade = {
          ...nextTrade,
          stopLoss: nextTrade.entry,
          events: [...nextTrade.events, { at: now, message: 'SL trailed to entry (breakeven)' }],
        };
      }
    }

    if (nextTrade && nextTrade.status === 'ACTIVE' && now >= nextTrade.holdUntil) {
      closeTrade('TIME_EXIT', 'Hold window completed');
    }

    if (nextTrade && nextTrade !== activeTrade) {
      setActiveTrade(nextTrade);
    }
  }, [activeTrade, currentPrice]);

  const startPaperTrade = () => {
    if (!decision || decision.decision === 'NO_TRADE') return;
    if (decision.entry_price == null || decision.stop_loss == null || decision.target_price == null) return;
    const now = Date.now();
    const entry = currentPrice || decision.entry_price;
    setActiveTrade({
      id: `${rawSymbol}-${now}`,
      symbol: rawSymbol,
      side: decision.decision as TradeSide,
      entry,
      stopLoss: decision.stop_loss,
      target: decision.target_price,
      holdMinutes: decision.hold_minutes,
      openedAt: now,
      holdUntil: now + decision.hold_minutes * 60 * 1000,
      status: 'ACTIVE',
      events: [{ at: now, message: `Trade opened (${decision.decision})` }],
    });
  };

  return (
    <div>
      <div className="pg-head">
        <div className="pg-title">Markets</div>
        <div className="pg-sub">Click any symbol to expand chart, decision, and live paper-trade tracking.</div>
      </div>
      <div className="g4">
        {indices.map((idx) => {
          const up = idx.changePercent >= 0;
          const active = idx.symbol === selectedSymbol;
          return (
            <button
              key={idx.symbol}
              type="button"
              className="mc"
              onClick={() => setSelectedSymbol(idx.symbol)}
              style={{
                textAlign: 'left',
                borderColor: active ? 'var(--accent)' : undefined,
                boxShadow: active ? '0 0 0 1px var(--accent) inset' : undefined,
              }}
            >
              <div className="mc-lbl">{idx.symbol}</div>
              <div className="mc-val">{fmtPrice(idx.price)}</div>
              <div className={`mc-chg ${up ? 'up' : 'dn'}`}>
                {up ? '▲' : '▼'} {fmtPct(idx.changePercent)}
              </div>
            </button>
          );
        })}
      </div>

      {selectedMarket ? (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="ch" style={{ alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div className="ct">
                {selectedMarket.symbol} ({rawSymbol})
              </div>
              <div className="pg-sub" style={{ margin: 0 }}>
                Live: {fmtPrice(currentPrice)} {activeTrade?.status === 'ACTIVE' ? `· Trade PnL ${fmtPct(livePnL)}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
              {Object.keys(PERIODS).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`tf ${periodKey === k ? 'act' : ''}`}
                  onClick={() => setPeriodKey(k as keyof typeof PERIODS)}
                >
                  {k}
                </button>
              ))}
              <label style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Hold (min)
                <input
                  type="number"
                  min={1}
                  max={240}
                  value={holdMinutes}
                  onChange={(e) => setHoldMinutes(Math.max(1, Math.min(240, Number(e.target.value) || 15)))}
                  className="finput"
                  style={{ width: 72, marginLeft: 6, padding: '6px 8px' }}
                />
              </label>
              <button type="button" className="btn-ghost" onClick={() => setDecisionVersion((v) => v + 1)}>
                Refresh Decision
              </button>
              <button
                type="button"
                className="btn-pri"
                onClick={startPaperTrade}
                disabled={!decision || decision.decision === 'NO_TRADE' || activeTrade?.status === 'ACTIVE'}
              >
                Start Paper Trade
              </button>
            </div>
          </div>

          <div style={{ height: 360, marginTop: 8 }}>
            {historyLoading ? (
              <div className="chart-area" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Loading chart...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis dataKey="label" minTickGap={28} tick={{ fontSize: 11 }} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => [fmtPrice(value), 'Price']}
                    labelFormatter={(label) => `Time: ${label}`}
                  />
                  <Line type="monotone" dataKey="close" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  {activeTrade ? (
                    <>
                      <ReferenceLine y={activeTrade.entry} stroke="#22c55e" strokeDasharray="4 4" label="Entry" />
                      <ReferenceLine y={activeTrade.stopLoss} stroke="#ef4444" strokeDasharray="4 4" label="SL" />
                      <ReferenceLine y={activeTrade.target} stroke="#f59e0b" strokeDasharray="4 4" label="Target" />
                    </>
                  ) : null}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="g4" style={{ marginTop: 12, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            <div className="mc">
              <div className="mc-lbl">Decision</div>
              <div className="mc-val" style={{ fontSize: 18 }}>
                {decisionLoading ? '...' : decision?.decision || 'NO_TRADE'}
              </div>
              <div className="mc-chg">{decision ? `${Math.round(decision.confidence * 100)}% confidence` : '--'}</div>
            </div>
            <div className="mc">
              <div className="mc-lbl">Entry / SL / TP</div>
              <div className="mc-val" style={{ fontSize: 16 }}>
                {decision?.entry_price != null ? fmtPrice(decision.entry_price) : '--'}
              </div>
              <div className="mc-chg">
                {decision?.stop_loss != null && decision?.target_price != null
                  ? `SL ${fmtPrice(decision.stop_loss)} · TP ${fmtPrice(decision.target_price)}`
                  : '--'}
              </div>
            </div>
            <div className="mc">
              <div className="mc-lbl">Expected Profit</div>
              <div className="mc-val" style={{ fontSize: 18 }}>
                {decision ? fmtPct(decision.expected_profit_pct) : '--'}
              </div>
              <div className="mc-chg">{decision ? `Hold ${decision.hold_minutes}m` : '--'}</div>
            </div>
            <div className="mc">
              <div className="mc-lbl">Trade Status</div>
              <div className="mc-val" style={{ fontSize: 18 }}>
                {activeTrade?.status || 'IDLE'}
              </div>
              <div className="mc-chg">
                {activeTrade?.status === 'ACTIVE'
                  ? `${Math.max(0, Math.ceil((activeTrade.holdUntil - Date.now()) / 60000))}m remaining`
                  : activeTrade?.exitReason || 'No active trade'}
              </div>
            </div>
          </div>

          <div className="cb" style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Decision rationale</div>
            <div style={{ color: 'var(--text-2)', marginBottom: 8 }}>
              {decision?.reason || 'No decision generated yet.'}
            </div>
            {activeTrade?.events?.length ? (
              <div style={{ display: 'grid', gap: 4 }}>
                {activeTrade.events.slice(-6).reverse().map((event) => (
                  <div key={`${event.at}-${event.message}`} style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {new Date(event.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · {event.message}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

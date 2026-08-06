'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiClient, OptionsChainResponse } from '@/lib/apiClient';

function fmtPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toFixed(2);
}

function fmtIV(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  if (v >= 0 && v <= 1) return `${(v * 100).toFixed(1)}%`;
  return `${v.toFixed(1)}%`;
}

function fmtOI(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return String(Math.round(Number(n)));
}

export default function OptionsPage() {
  const [symbol, setSymbol] = useState('NIFTY');
  const [expiry, setExpiry] = useState('');
  const [data, setData] = useState<OptionsChainResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const strikesToShow = useMemo(() => data?.data?.slice(0, 80) ?? [], [data]);

  return (
    <div>
      <div className="pg-head">
        <div className="pg-title">Options Chain</div>
        <div className="pg-sub">Live options chain with strike-level pricing</div>
      </div>

      <div className="card mb14">
        <div className="cb">
          <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 }}>
            <div>
              <label className="flabel">Symbol</label>
              <input type="text" className="finput" style={{ width: 120 }} value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
            </div>
            <div>
              <label className="flabel">Expiry</label>
              <select className="finput" style={{ width: 150 }} value={expiry} onChange={(e) => setExpiry(e.target.value)} disabled={!data?.expiries?.length}>
                <option value="">Auto (nearest)</option>
                {(data?.expiries || []).map((ex) => (
                  <option key={ex} value={ex}>
                    {ex}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="btn-pri" onClick={() => runFetch(false)} disabled={loading}>
              {loading ? 'Loading…' : 'Load Chain'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => runFetch(true)} disabled={loading}>
              ↺ Skip Cache
            </button>
          </div>
          {error && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{error}</p>}
          {data?.source && <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 8 }}>Source: {data.source}</p>}
        </div>
      </div>

      <div className="card">
        <div className="ch">
          <div className="ct">
            {data?.symbol || symbol}
            {data?.expiry ? ` · ${data.expiry}` : ''}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="dtable">
            <thead>
              <tr>
                <th style={{ color: 'var(--green)' }}>CE OI</th>
                <th style={{ color: 'var(--green)' }}>CE Vol</th>
                <th style={{ color: 'var(--green)' }}>CE IV</th>
                <th style={{ color: 'var(--green)' }}>CE Bid/Ask</th>
                <th>Strike</th>
                <th style={{ color: 'var(--red)' }}>PE Bid/Ask</th>
                <th style={{ color: 'var(--red)' }}>PE IV</th>
                <th style={{ color: 'var(--red)' }}>PE Vol</th>
                <th style={{ color: 'var(--red)' }}>PE OI</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr>
                  <td colSpan={9}>Loading…</td>
                </tr>
              ) : strikesToShow.length ? (
                strikesToShow.map((row) => (
                  <tr key={row.strike}>
                    <td className="mono">{fmtOI(row.call.openInterest)}</td>
                    <td className="mono">{fmtOI(row.call.volume)}</td>
                    <td className="mono">{fmtIV(row.call.impliedVolatility)}</td>
                    <td className="mono">
                      {fmtPrice(row.call.bid)}/{fmtPrice(row.call.ask)}
                    </td>
                    <td className="mono" style={{ fontWeight: 700 }}>
                      {fmtPrice(row.strike)}
                    </td>
                    <td className="mono">
                      {fmtPrice(row.put.bid)}/{fmtPrice(row.put.ask)}
                    </td>
                    <td className="mono">{fmtIV(row.put.impliedVolatility)}</td>
                    <td className="mono">{fmtOI(row.put.volume)}</td>
                    <td className="mono">{fmtOI(row.put.openInterest)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} style={{ color: 'var(--text-3)' }}>
                    No chain rows. Try US: AAPL, SPY, NVDA. India: RELIANCE.NS.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

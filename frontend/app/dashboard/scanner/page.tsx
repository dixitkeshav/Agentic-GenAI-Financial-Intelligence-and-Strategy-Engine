'use client';

import { useState } from 'react';
import { apiClient, ScannerResponse } from '@/lib/apiClient';
import { signalBadge } from '@/lib/fintelli/format';

type Signal = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

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
    <div>
      <div className="pg-head">
        <div className="pg-title">Screener</div>
        <div className="pg-sub">Sentiment and momentum screening across the market</div>
      </div>

      <div className="card mb14">
        <div className="cb">
          <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 }}>
            <div>
              <label className="flabel">Symbols (comma-separated)</label>
              <input type="text" className="finput" style={{ width: 340 }} value={symbolsText} onChange={(e) => setSymbolsText(e.target.value)} />
            </div>
            <div>
              <label className="flabel">Period</label>
              <input type="text" className="finput" style={{ width: 90 }} value={period} onChange={(e) => setPeriod(e.target.value)} />
            </div>
            <button type="button" className="btn-pri" onClick={runScanner} disabled={loading}>
              {loading ? 'Scanning…' : '🔍 Run Scan'}
            </button>
          </div>
          {error && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{error}</p>}
        </div>
      </div>

      <div className="card">
        <div className="ch">
          <div className="ct">Scan Results</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {data?.source ? <span className="badge badge-gr">{data.source}</span> : null}
            {data?.results?.length ? <span className="badge badge-bl">{data.results.length} symbols</span> : null}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="dtable">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Signal</th>
                <th>Confidence</th>
                <th>Sentiment</th>
                <th>Momentum</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--text-3)' }}>
                    Running scan…
                  </td>
                </tr>
              ) : data?.results?.length ? (
                data.results.map((r) => (
                  <tr key={r.symbol}>
                    <td className="sym-b">{r.symbol}</td>
                    <td>
                      <span className={`badge ${signalBadge(r.signal as Signal)}`}>{r.signal}</span>
                    </td>
                    <td className="mono">{r.confidence}</td>
                    <td>{r.sentiment}</td>
                    <td className="mono">{(r.momentum ?? 0).toFixed(4)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--text-3)' }}>
                    Run the scanner to see results.
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

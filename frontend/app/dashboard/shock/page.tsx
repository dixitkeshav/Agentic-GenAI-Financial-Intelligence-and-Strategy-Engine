'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { apiClient } from '@/lib/apiClient';
import { shockWebSocketUrl } from '@/lib/wsBase';
import type { ShockAlertItem } from '@/components/shock/ShockAlertFeed';
import type { ShockHistoryRow } from '@/lib/apiClient';

const THRESHOLD_OPTIONS = [10, 100, 200, 300, 500];

export default function ShockPage() {
  const [score, setScore] = useState(0);
  const [liveCause, setLiveCause] = useState('none');
  const [scoreHeadline, setScoreHeadline] = useState('');
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<ShockAlertItem[]>([]);
  const [history, setHistory] = useState<ShockHistoryRow[]>([]);
  const [connected, setConnected] = useState(false);
  const [causeFilter, setCauseFilter] = useState('all');
  const [directionFilter, setDirectionFilter] = useState('all');
  const [indexFilter, setIndexFilter] = useState('all');
  const [threshold, setThreshold] = useState(100);
  const [liveScan, setLiveScan] = useState<{
    net_move_pts: number;
    direction: string;
    shock_alert: boolean;
    index: string;
  } | null>(null);
  const [universeGroup, setUniverseGroup] = useState('large_cap');
  const [universeCount, setUniverseCount] = useState(0);
  const ws = useRef<WebSocket | null>(null);

  const loadRest = useCallback(async () => {
    setLoading(true);
    try {
      const histOpts: { cause?: string; direction?: string; index?: string; threshold?: number } = {
        threshold,
      };
      if (causeFilter !== 'all') histOpts.cause = causeFilter;
      if (directionFilter !== 'all') histOpts.direction = directionFilter;
      if (indexFilter !== 'all') histOpts.index = indexFilter;

      const [alertsRes, historyRes, scoreRes, scanRes, uniRes] = await Promise.all([
        apiClient.getShockAlerts(),
        apiClient.getShockHistory(1, histOpts),
        apiClient.getShockScore(true),
        apiClient.getShockLiveScan(threshold, indexFilter === 'all' ? 'nifty' : indexFilter.toLowerCase()),
        apiClient.getShockUniverse(universeGroup),
      ]);
      setAlerts(alertsRes);
      setHistory(historyRes.results || []);
      const s = scoreRes;
      setScore(s.score ?? 0);
      setLiveCause(s.cause ?? 'none');
      setScoreHeadline(s.headline ?? '');
      setLiveScan(scanRes);
      setUniverseCount(uniRes.count ?? 0);
    } finally {
      setLoading(false);
    }
  }, [causeFilter, directionFilter, indexFilter, threshold, universeGroup]);

  useEffect(() => {
    loadRest();
    const iv = setInterval(loadRest, 60000);
    return () => clearInterval(iv);
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

  const riskLabel = score >= 70 ? 'HIGH RISK' : score >= 40 ? 'MODERATE RISK' : 'LOW RISK';
  const riskClass = score >= 70 ? 'sl-hi' : score >= 40 ? 'sl-mod' : 'sl-lo';
  const gaugeOffset = 362 - (score / 100) * 362;

  return (
    <div>
      <div className="pg-head">
        <div className="pg-title">Shock Predictor</div>
        <div className="pg-sub">
          Directional index moves · historic news causes · universe {universeCount} symbols ({universeGroup})
        </div>
      </div>

      <div className="card mb14">
        <div className="cb row" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label className="flabel">Move threshold (pts)</label>
            <select className="finput" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}>
              {THRESHOLD_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t} pts
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="flabel">Index (live scan)</label>
            <select className="finput" value={indexFilter} onChange={(e) => setIndexFilter(e.target.value)}>
              <option value="all">NIFTY (default)</option>
              <option value="NIFTY">NIFTY</option>
              <option value="BANKNIFTY">BANKNIFTY</option>
              <option value="SENSEX">SENSEX</option>
            </select>
          </div>
          <div>
            <label className="flabel">Direction</label>
            <select className="finput" value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="UP">UP</option>
              <option value="DOWN">DOWN</option>
            </select>
          </div>
          <div>
            <label className="flabel">Universe group</label>
            <select className="finput" value={universeGroup} onChange={(e) => setUniverseGroup(e.target.value)}>
              <option value="large_cap">Large cap</option>
              <option value="mid_cap">Mid cap</option>
              <option value="small_cap">Small cap</option>
              <option value="indices">Indices</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>
        {liveScan && (
          <p className="cb pg-sub" style={{ paddingTop: 0 }}>
            Today {liveScan.index}: {liveScan.net_move_pts >= 0 ? '+' : ''}
            {liveScan.net_move_pts} pts ({liveScan.direction})
            {liveScan.shock_alert ? ' · ⚠ above threshold' : ' · within threshold'}
          </p>
        )}
      </div>

      <div className="shock-grid mb14">
        <div className="card">
          <div className="ch">
            <div className="ct">🎯 Shock Score</div>
            <div className="mkt-pill">
              <div className="ldot" />
              {connected ? 'WS LIVE' : 'Disconnected'}
            </div>
          </div>
          <div className="gauge-wrap">
            <div className="gauge-cont">
              <svg className="gauge-svg" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="78" fill="none" stroke="var(--bg-inset)" strokeWidth="13" />
                <circle
                  cx="100"
                  cy="100"
                  r="78"
                  fill="none"
                  stroke="url(#gg)"
                  strokeWidth="13"
                  strokeDasharray="362"
                  strokeDashoffset={gaugeOffset}
                  strokeLinecap="round"
                  transform="rotate(-210 100 100)"
                />
                <defs>
                  <linearGradient id="gg" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="var(--green)" />
                    <stop offset="50%" stopColor="var(--amber)" />
                    <stop offset="100%" stopColor="var(--red)" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="gauge-mid">
                <div
                  className="gauge-n"
                  style={{ color: score >= 70 ? 'var(--red)' : score >= 40 ? 'var(--amber)' : 'var(--green)' }}
                >
                  {Math.round(score)}
                </div>
                <div className="gauge-u">/ 100</div>
              </div>
            </div>
            <div className={`slevel ${riskClass}`}>⚠ {riskLabel}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', textAlign: 'center', marginTop: 6 }}>
              Cause: <strong>{liveCause}</strong>
              {scoreHeadline && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-2)' }}>{scoreHeadline}</div>
              )}
              {loading && (
                <div style={{ marginTop: 8, fontSize: 11 }}>Scoring live headlines…</div>
              )}
            </div>
          </div>
        </div>

        <div className="card" style={{ gridColumn: '2 / 4' }}>
          <div className="ch">
            <div className="ct">🚨 Recent Alerts</div>
            <span className="badge badge-am">{alerts.length} logged</span>
          </div>
          {alerts.length === 0 ? (
            <p className="cb" style={{ color: 'var(--text-3)' }}>
              No alerts fired yet.
            </p>
          ) : (
            alerts.map((a, i) => {
              const cause = (a.cause || 'unknown').toLowerCase();
              return (
                <div
                  key={`${a.timestamp}-${i}`}
                  style={{ display: 'flex', gap: 11, padding: '11px 18px', borderBottom: '1px solid var(--border)' }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase' }}>
                      {cause}
                    </div>
                    <div style={{ fontSize: 12.5, margin: '4px 0' }}>{a.headline}</div>
                    {a.hedge && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>💡 {a.hedge}</div>}
                  </div>
                  {a.score != null && (
                    <div className="mono" style={{ fontSize: 19, color: 'var(--amber)' }}>
                      {a.score}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="card">
        <div className="ch">
          <div className="ct">📅 Historical Shock Log</div>
          <select
            className="finput"
            style={{ width: 'auto', padding: '4px 8px' }}
            value={causeFilter}
            onChange={(e) => setCauseFilter(e.target.value)}
          >
            <option value="all">All Causes</option>
            <option value="policy">Policy</option>
            <option value="macro">Macro</option>
            <option value="geopolitical">Geopolitical</option>
            <option value="technical">Technical</option>
            <option value="corporate">Corporate</option>
          </select>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="dtable">
            <thead>
              <tr>
                <th>Date</th>
                <th>Index</th>
                <th>Dir</th>
                <th>Pts</th>
                <th>Cause</th>
                <th>Headline</th>
                <th>Cause summary</th>
                <th>News evidence</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-3)' }}>
                    No events (try lower threshold). Run: python manage.py backtest_shocks --threshold {threshold}
                  </td>
                </tr>
              ) : (
                history.map((e) => (
                  <tr key={`${e.date}-${e.index}`}>
                    <td>{e.date}</td>
                    <td className="sym-b">{e.index || 'NIFTY'}</td>
                    <td className={`mono ${e.direction === 'DOWN' ? 'dn' : 'up'}`}>{e.direction}</td>
                    <td className="mono">{e.magnitude?.toFixed(0)}</td>
                    <td>
                      <span className="badge badge-am">{e.cause_type}</span>
                    </td>
                    <td style={{ color: 'var(--text-3)', maxWidth: 280 }}>{e.headline}</td>
                    <td style={{ color: 'var(--text-3)', maxWidth: 320 }}>{e.cause_summary || '—'}</td>
                    <td style={{ color: 'var(--text-3)', maxWidth: 360, fontSize: 11 }}>
                      {(e.news_evidence || []).slice(0, 3).map((h, i) => (
                        <div key={i} style={{ marginBottom: 4 }}>
                          • {h.title || h.summary}
                        </div>
                      ))}
                      {!e.news_evidence?.length && '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

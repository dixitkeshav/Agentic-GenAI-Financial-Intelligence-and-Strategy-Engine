'use client';

import Link from 'next/link';

export default function SettingsPage() {
  return (
    <div>
      <div className="pg-head">
        <div className="pg-title">Settings</div>
        <div className="pg-sub">Workspace & API configuration</div>
      </div>
      <div className="sett-layout">
        <div className="sett-menu">
          <div className="sm-item act">⚙️ General</div>
          <Link href="/settings" className="sm-item" style={{ textDecoration: 'none' }}>
            🏦 Broker &amp; API
          </Link>
        </div>
        <div className="sett-body">
          <div style={{ fontSize: 15.5, fontWeight: 600, marginBottom: 18 }}>API Configuration</div>
          <div className="sett-row">
            <div>
              <div className="sr-lbl">Backend URL</div>
              <div className="sr-desc">Django REST + WebSocket</div>
            </div>
            <input
              type="text"
              className="finput"
              style={{ width: 230 }}
              readOnly
              defaultValue={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}
            />
          </div>
          <div className="sett-row">
            <div>
              <div className="sr-lbl">Full broker / AI settings</div>
              <div className="sr-desc">Kite, Telegram, indicators, watchlist</div>
            </div>
            <Link href="/settings" className="btn-pri" style={{ textDecoration: 'none' }}>
              Open →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

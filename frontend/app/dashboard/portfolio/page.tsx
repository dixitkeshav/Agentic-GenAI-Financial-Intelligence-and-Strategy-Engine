'use client';

import Link from 'next/link';

export default function PortfolioPage() {
  return (
    <div>
      <div className="pg-head">
        <div className="pg-title">Portfolio</div>
        <div className="pg-sub">Connect Zerodha Kite for live holdings</div>
      </div>
      <div className="g4 mb14">
        <div className="mc">
          <div className="mc-lbl">Status</div>
          <div className="mc-val" style={{ fontSize: 16 }}>Not connected</div>
        </div>
      </div>
      <div className="card">
        <div className="cb" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: 'var(--text-2)', marginBottom: 16 }}>Connect a brokerage or add holdings to track performance.</p>
          <Link href="/settings" className="btn-pri" style={{ textDecoration: 'none', display: 'inline-block' }}>
            Open Broker Settings →
          </Link>
        </div>
      </div>
    </div>
  );
}

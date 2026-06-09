'use client';

import { useNewsFeed } from '@/hooks/useNewsFeed';
import { NewsRows } from '@/components/fintelli/NewsRows';

export default function NewsPage() {
  const { news, isLoading } = useNewsFeed();

  return (
    <div>
      <div className="pg-head">
        <div className="pg-title">News Intelligence</div>
        <div className="pg-sub">NewsAPI + Alpha Vantage feed · /api/fetch-news/</div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <span className="badge badge-bl">{news.length} articles loaded</span>
      </div>
      <div className="card">
        {isLoading ? <p className="cb" style={{ color: 'var(--text-3)' }}>Loading news…</p> : <NewsRows items={news} />}
      </div>
    </div>
  );
}

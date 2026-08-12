'use client';

import { useState } from 'react';
import type { ArticleItem } from '@/lib/apiClient';
import { sentimentTag } from '@/lib/fintelli/format';

const PROVIDER_ICONS: Record<string, string> = {
  yfinance: '📈',
  newsapi: '📡',
  finnhub: '🔬',
  alpha_vantage: '⚡',
  client: '📋',
};

function sentimentScoreBar(score: number | null | undefined) {
  if (score == null || !Number.isFinite(score)) return null;
  // score is in [-1, +1]; map to colour & width
  const pct = Math.round(Math.abs(score) * 100);
  const color = score > 0.05 ? 'var(--green)' : score < -0.05 ? 'var(--red)' : 'var(--accent)';
  return (
    <div
      title={`Sentiment score: ${score > 0 ? '+' : ''}${score.toFixed(3)}`}
      style={{
        display: 'inline-block',
        width: `${Math.max(pct, 4)}%`,
        height: 3,
        background: color,
        borderRadius: 2,
        maxWidth: '100%',
        verticalAlign: 'middle',
        marginLeft: 6,
        transition: 'width .4s',
      }}
    />
  );
}

const PAGE_SIZE = 8;

/**
 * Displays the news articles fetched by the pipeline, with sentiment tags,
 * source badges, score bars, and expandable summaries.
 */
export function AgentNewsFeed({
  articles,
  isLoading,
}: {
  articles?: ArticleItem[];
  isLoading?: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(0);

  if (isLoading) {
    // Skeleton rows
    return (
      <div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="ni"
            style={{ animationDelay: `${i * 70}ms`, animation: 'step-fadein .35s ease both' }}
          >
            <div className="skel" style={{ height: 13, width: '80%', marginBottom: 8 }} />
            <div className="skel" style={{ height: 10, width: '40%' }} />
          </div>
        ))}
      </div>
    );
  }

  if (!articles || articles.length === 0) {
    return (
      <p style={{ padding: '14px 0', fontSize: 13, color: 'var(--text-3)' }}>
        No news articles were fetched — run the pipeline to see what drove the decision.
      </p>
    );
  }

  const totalPages = Math.ceil(articles.length / PAGE_SIZE);
  const visible = articles.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const toggleExpand = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <div>
      {/* Summary bar */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 12,
          fontSize: 11,
          color: 'var(--text-3)',
        }}
      >
        {(() => {
          const pos = articles.filter((a) => (a.sentiment || '').toLowerCase() === 'positive').length;
          const neg = articles.filter((a) => (a.sentiment || '').toLowerCase() === 'negative').length;
          const neu = articles.length - pos - neg;
          return (
            <>
              <span>
                <span style={{ color: 'var(--green)', fontWeight: 700 }}>▲ {pos}</span> positive
              </span>
              <span>
                <span style={{ color: 'var(--red)', fontWeight: 700 }}>▼ {neg}</span> negative
              </span>
              <span>
                <span style={{ color: 'var(--text-2)', fontWeight: 700 }}>● {neu}</span> neutral
              </span>
              <span style={{ marginLeft: 'auto' }}>
                {articles.length} articles total
              </span>
            </>
          );
        })()}
      </div>

      {/* Article rows */}
      {visible.map((art, idx) => {
        const globalIdx = page * PAGE_SIZE + idx;
        const sent = sentimentTag(art.sentiment || 'neutral');
        const isExp = expanded.has(globalIdx);
        const hasSummary = !!(art.summary && art.summary !== art.title && art.summary.trim().length > 10);
        const providerIcon = PROVIDER_ICONS[art.provider || ''] || '📰';
        const hasUrl = art.url && art.url !== '#';

        return (
          <div
            key={globalIdx}
            className="ni"
            style={{
              borderLeft: `3px solid ${
                (art.sentiment || '').toLowerCase() === 'positive'
                  ? 'var(--green)'
                  : (art.sentiment || '').toLowerCase() === 'negative'
                    ? 'var(--red)'
                    : 'var(--border)'
              }`,
              paddingLeft: 14,
              cursor: hasSummary ? 'pointer' : 'default',
            }}
            onClick={() => hasSummary && toggleExpand(globalIdx)}
          >
            {/* Headline */}
            <div
              className="ni-h"
              style={{
                WebkitLineClamp: isExp ? 'unset' : 2,
                overflow: isExp ? 'visible' : 'hidden',
              }}
            >
              {hasUrl ? (
                <a
                  href={art.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'inherit', textDecoration: 'none' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {art.title}
                  <span style={{ fontSize: 9, marginLeft: 5, color: 'var(--text-4)' }}>↗</span>
                </a>
              ) : (
                art.title
              )}
            </div>

            {/* Expandable summary */}
            {hasSummary && isExp && (
              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--text-3)',
                  lineHeight: 1.65,
                  marginTop: 5,
                  marginBottom: 6,
                  padding: '8px 10px',
                  background: 'var(--bg-inset)',
                  borderRadius: 6,
                  animation: 'step-fadein .2s ease both',
                }}
              >
                {art.summary}
              </div>
            )}

            {/* Meta row */}
            <div className="ni-meta">
              <span className={`tag ${sent.className}`}>{sent.label}</span>
              {sentimentScoreBar(art.sentiment_score)}
              {art.source && (
                <span className="ni-src">
                  {providerIcon} {art.source}
                </span>
              )}
              {art.time_published && (
                <span className="ni-time">
                  {art.time_published.slice(0, 10)}
                </span>
              )}
              {hasSummary && (
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 9.5,
                    color: 'var(--text-4)',
                    userSelect: 'none',
                  }}
                >
                  {isExp ? '▲ less' : '▼ more'}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0 2px', justifyContent: 'center' }}>
          <button
            className="btn-ghost"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{ fontSize: 12, padding: '4px 10px' }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {page + 1} / {totalPages}
          </span>
          <button
            className="btn-ghost"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            style={{ fontSize: 12, padding: '4px 10px' }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

'use client';

import type { PipelineStep } from '@/lib/apiClient';

const ALL_STEPS: PipelineStep[] = [
  { id: 'news_fetch', label: 'News ingestion', status: 'pending' },
  { id: 'news_scout', label: 'News Scout', status: 'pending' },
  { id: 'macro_context', label: 'Macro Context', status: 'pending' },
  { id: 'technical', label: 'Technical Analysis', status: 'pending' },
  { id: 'market_reaction', label: 'Market Reaction', status: 'pending' },
  { id: 'risk', label: 'Risk', status: 'pending' },
  { id: 'bull_research', label: 'Bull Research', status: 'pending' },
  { id: 'bear_research', label: 'Bear Research', status: 'pending' },
  { id: 'risk_committee', label: 'Risk Committee', status: 'pending' },
  { id: 'debate_facilitator', label: 'Debate Facilitator', status: 'pending' },
  { id: 'shock', label: 'Shock Predictor', status: 'pending' },
  { id: 'decision', label: 'Decision', status: 'pending' },
];

/**
 * Animated pipeline step list.
 *
 * While loading (isLoading=true) and no real steps have arrived yet, we show
 * all steps as "running" with a staggered CSS pulse so the UI feels alive
 * immediately instead of showing a blank card.
 *
 * Once real step data arrives (from the completed pipeline), we render those
 * faithfully.
 */
export function PipelineList({ steps, isLoading }: { steps?: PipelineStep[]; isLoading?: boolean }) {
  const hasReal = !!(steps?.length);
  const display = hasReal ? steps! : ALL_STEPS;

  return (
    <>
      {display.map((step, index) => {
        let status = step.status;

        if (isLoading && !hasReal) {
          // Show every step as "running" with staggered animation delay
          status = 'running';
        } else if (isLoading && hasReal && status !== 'completed') {
          // Partial results: mark the first pending step as running
          const firstPending = display.findIndex((s) => s.status !== 'completed');
          if (index === firstPending) status = 'running';
        }

        const cls =
          status === 'completed'
            ? 'ps-done'
            : status === 'running'
              ? 'ps-run'
              : status === 'error'
                ? 'ps-err'
                : 'ps-pend';
        const ico =
          status === 'completed' ? '✓' : status === 'running' ? '◌' : status === 'error' ? '!' : '○';

        // Stagger delay so steps animate in sequentially during load
        const animDelay = isLoading && !hasReal ? `${index * 80}ms` : undefined;

        return (
          <div key={step.id} className="pipe-step" style={animDelay ? { animationDelay: animDelay } : undefined}>
            <div className={`ps-ind ${cls}${status === 'running' ? ' ps-spin' : ''}`}>{ico}</div>
            <div style={{ flex: 1 }}>
              <div className="ps-nm">{step.label}</div>
              <div className="ps-st">
                {step.summary || (status === 'running' ? 'Running…' : 'Pending')}
              </div>
            </div>
            <div className="ps-t">{step.duration_ms ? `${step.duration_ms}ms` : '—'}</div>
          </div>
        );
      })}
    </>
  );
}

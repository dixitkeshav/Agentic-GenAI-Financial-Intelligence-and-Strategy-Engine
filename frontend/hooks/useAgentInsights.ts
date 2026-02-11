'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient, AgentsRunResult } from '@/lib/apiClient';
import { useAgentStore, AgentInsight } from '@/store/agentStore';

function mapAgentsResultToInsights(result: AgentsRunResult | null): AgentInsight[] {
  if (!result) return [];
  const insights: AgentInsight[] = [];
  const now = new Date();

  const signalFromSentiment = (s: string): AgentInsight['signal'] => {
    const l = (s || '').toLowerCase();
    if (l.includes('positive') || l.includes('bullish') || l.includes('up')) return 'BULLISH';
    if (l.includes('negative') || l.includes('bearish') || l.includes('down')) return 'BEARISH';
    return 'NEUTRAL';
  };

  if (result.news_scout?.summary) {
    insights.push({
      id: 'news-scout',
      agentName: 'Sentiment',
      signal: result.news_scout.spike_direction === 'positive' ? 'BULLISH' : result.news_scout.spike_direction === 'negative' ? 'BEARISH' : 'NEUTRAL',
      confidence: result.news_scout.spike_detected ? 78 : 65,
      explanation: result.news_scout.summary,
      timestamp: now,
      metrics: result.news_scout.spike_detected ? { spike: 1 } : undefined,
    });
  }
  if (result.macro_context?.summary) {
    insights.push({
      id: 'macro',
      agentName: 'Macro',
      signal: signalFromSentiment(result.macro_context.summary),
      confidence: 72,
      explanation: result.macro_context.summary,
      timestamp: now,
      metrics: result.macro_context.macro_links?.length ? { links: result.macro_context.macro_links.length } : undefined,
    });
  }
  if (result.decision?.recommendation) {
    insights.push({
      id: 'decision',
      agentName: 'Market Reaction',
      signal: signalFromSentiment(result.decision.recommendation),
      confidence: 75,
      explanation: result.decision.recommendation,
      timestamp: now,
    });
  } else if (result.market_reaction?.summary) {
    insights.push({
      id: 'market-reaction',
      agentName: 'Market Reaction',
      signal: signalFromSentiment(result.market_reaction.summary),
      confidence: 71,
      explanation: result.market_reaction.summary,
      timestamp: now,
    });
  }
  if (result.risk?.summary) {
    insights.push({
      id: 'risk',
      agentName: 'Risk',
      signal: (result.risk.risk_flags?.length || 0) > 2 ? 'BEARISH' : 'NEUTRAL',
      confidence: 68,
      explanation: result.risk.summary,
      timestamp: now,
      metrics: result.risk.risk_flags?.length ? { flags: result.risk.risk_flags.length } : undefined,
    });
  }

  if (insights.length > 0) return insights;
  return [
    { id: '1', agentName: 'Sentiment', signal: 'NEUTRAL', confidence: 0, explanation: 'Run agents to get insights. API may be unavailable.', timestamp: now },
  ];
}

/** Fetches agent insights from /api/agents/run/ and updates agent store */
export function useAgentInsights(ticker?: string) {
  const setInsights = useAgentStore((state) => state.setInsights);

  const { data: result, isLoading } = useQuery({
    queryKey: ['agent-insights', ticker],
    queryFn: () => apiClient.getAgentInsights(ticker),
    refetchInterval: 300000, // 5 min
    staleTime: 120000,
  });

  useEffect(() => {
    if (!result) return;
    const insights = mapAgentsResultToInsights(result);
    setInsights(insights);
  }, [result, setInsights]);

  return { isLoading, result };
}

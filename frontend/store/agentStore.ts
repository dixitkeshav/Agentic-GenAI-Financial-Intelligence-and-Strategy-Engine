import { create } from 'zustand';

export interface AgentInsight {
  id: string;
  agentName: 'Sentiment' | 'Risk' | 'Macro' | 'Market Reaction';
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  explanation: string;
  timestamp: Date;
  metrics?: Record<string, number>;
}

interface AgentState {
  insights: AgentInsight[];
  addInsight: (insight: AgentInsight) => void;
  updateInsight: (id: string, data: Partial<AgentInsight>) => void;
  clearInsights: () => void;
  setInsights: (insights: AgentInsight[]) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  insights: [
    {
      id: '1',
      agentName: 'Sentiment',
      signal: 'BULLISH',
      confidence: 78,
      explanation: 'Strong positive sentiment detected across tech sector news. Multiple institutional upgrades noted.',
      timestamp: new Date(),
      metrics: { newsVolume: 156, positiveRatio: 0.72 } as Record<string, number>,
    },
    {
      id: '2',
      agentName: 'Risk',
      signal: 'NEUTRAL',
      confidence: 65,
      explanation: 'Moderate volatility expected. VIX levels stable. No significant macro catalysts detected.',
      timestamp: new Date(),
      metrics: { vix: 15.2, beta: 1.1 } as Record<string, number>,
    },
    {
      id: '3',
      agentName: 'Macro',
      signal: 'BEARISH',
      confidence: 82,
      explanation: 'Fed rate decision approaching. Inflation data shows persistent pressure. Treasury yields rising.',
      timestamp: new Date(),
      metrics: { cpi: 3.2, yield10y: 4.5 } as Record<string, number>,
    },
    {
      id: '4',
      agentName: 'Market Reaction',
      signal: 'BULLISH',
      confidence: 71,
      explanation: 'Strong buying pressure in financial stocks. Options flow indicates bullish positioning.',
      timestamp: new Date(),
      metrics: { putCallRatio: 0.68, flowScore: 8.5 } as Record<string, number>,
    },
  ],
  addInsight: (insight) =>
    set((state) => ({ insights: [insight, ...state.insights] })),
  updateInsight: (id, data) =>
    set((state) => ({
      insights: state.insights.map((insight) =>
        insight.id === id ? { ...insight, ...data } : insight
      ),
    })),
  clearInsights: () => set({ insights: [] }),
  setInsights: (insights) => set({ insights }),
}));

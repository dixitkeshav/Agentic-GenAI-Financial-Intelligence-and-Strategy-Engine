'use client';

import { useState } from 'react';
import { AgentCard } from '@/components/agents/AgentCard';
import { AgentPipeline } from '@/components/agents/AgentPipeline';
import { useAgentStore } from '@/store/agentStore';
import { useAgentInsights } from '@/hooks/useAgentInsights';
import { Brain } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function AgentsPage() {
  const [ticker, setTicker] = useState('RELIANCE');
  const [activeTicker, setActiveTicker] = useState<string | undefined>(undefined);
  const insights = useAgentStore((state) => state.insights);
  const { isLoading, result } = useAgentInsights(activeTicker);

  const runPipeline = () => {
    setActiveTicker(ticker.trim() || undefined);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="w-6 h-6 text-primary" />
          Agent Insights
        </h1>
        <p className="text-muted-foreground">
          Full pipeline: news ingestion → sentiment scout → macro → technicals → market reaction → risk → decision
        </p>
      </div>

      <div className="flex flex-wrap gap-2 max-w-md">
        <Input
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          placeholder="RELIANCE or ^NSEI"
          className="flex-1"
        />
        <Button onClick={runPipeline} disabled={isLoading}>
          {isLoading ? 'Running…' : 'Run pipeline'}
        </Button>
      </div>

      <AgentPipeline
        steps={result?.pipeline}
        isLoading={isLoading}
        articleCount={result?.article_count}
        newsSource={result?.news_source}
        ticker={result?.ticker ?? activeTicker}
      />

      {isLoading && insights.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {insights.map((insight) => (
            <AgentCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}
    </div>
  );
}

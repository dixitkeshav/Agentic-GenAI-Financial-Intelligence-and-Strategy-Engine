'use client';

import { AgentCard } from '@/components/agents/AgentCard';
import { useAgentStore } from '@/store/agentStore';
import { useAgentInsights } from '@/hooks/useAgentInsights';
import { Brain } from 'lucide-react';

export default function AgentsPage() {
  const insights = useAgentStore((state) => state.insights);
  useAgentInsights();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="w-6 h-6 text-primary" />
          Agent Insights
        </h1>
        <p className="text-muted-foreground">AI agents from /api/agents/run/</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {insights.map((insight) => (
          <AgentCard key={insight.id} insight={insight} />
        ))}
      </div>
    </div>
  );
}

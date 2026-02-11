'use client';

import { TradingChart } from '@/components/charts/TradingChart';
import { SentimentChart } from '@/components/charts/SentimentChart';
import { AgentCard } from '@/components/agents/AgentCard';
import { NewsFeed } from '@/components/news/NewsFeed';
import { MarketTicker } from '@/components/ticker/MarketTicker';
import { useAgentStore } from '@/store/agentStore';
import { useLiveTicker } from '@/hooks/useLiveTicker';
import { useAgentInsights } from '@/hooks/useAgentInsights';
import { Brain } from 'lucide-react';

export default function DashboardPage() {
  const insights = useAgentStore((state) => state.insights);
  useLiveTicker();
  useAgentInsights();

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto pb-14">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20">
              <Brain className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Financial Intelligence Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                AI-powered market insights and real-time analytics
              </p>
            </div>
          </div>

          {/* Main Grid Layout - min-h-0 prevents overlap in flex/grid children */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 min-h-0">
            {/* Left Column - Charts (stacked, no overlap) */}
            <div className="xl:col-span-2 flex flex-col gap-6 min-h-0">
              <div className="min-h-0 shrink-0">
                <TradingChart />
              </div>
              <div className="min-h-0 shrink-0">
                <SentimentChart />
              </div>
            </div>

            {/* Right Column - News Feed */}
            <div className="xl:col-span-1 min-h-0">
              <NewsFeed />
            </div>
          </div>

          {/* Agent Insights Grid */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              AI Agent Insights
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {insights.map((insight) => (
                <AgentCard key={insight.id} insight={insight} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Ticker */}
      <MarketTicker />
    </div>
  );
}

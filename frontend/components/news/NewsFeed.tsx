'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { NewsCard } from './NewsCard';
import { useNewsFeed } from '@/hooks/useNewsFeed';
import { Newspaper } from 'lucide-react';

export function NewsFeed() {
  const { news, isLoading } = useNewsFeed();

  // Mock data for demonstration
  const mockNews = [
    {
      id: '1',
      headline: 'Tech stocks rally as AI sector shows strong growth momentum',
      source: 'Bloomberg',
      sentiment: 'positive' as const,
      sentimentScore: 0.78,
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
      symbols: ['AAPL', 'MSFT', 'NVDA'],
    },
    {
      id: '2',
      headline: 'Federal Reserve signals potential rate cuts amid slowing inflation',
      source: 'Reuters',
      sentiment: 'positive' as const,
      sentimentScore: 0.65,
      timestamp: new Date(Date.now() - 1000 * 60 * 15),
      symbols: ['SPY', 'TLT'],
    },
    {
      id: '3',
      headline: 'Banking sector faces headwinds as loan defaults increase',
      source: 'Financial Times',
      sentiment: 'negative' as const,
      sentimentScore: -0.52,
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      symbols: ['BAC', 'JPM', 'WFC'],
    },
    {
      id: '4',
      headline: 'Crypto markets show consolidation pattern, analysts remain neutral',
      source: 'CoinDesk',
      sentiment: 'neutral' as const,
      sentimentScore: 0.05,
      timestamp: new Date(Date.now() - 1000 * 60 * 45),
      symbols: ['BTC', 'ETH'],
    },
    {
      id: '5',
      headline: 'Energy sector surges on OPEC+ production cut announcement',
      source: 'CNBC',
      sentiment: 'positive' as const,
      sentimentScore: 0.82,
      timestamp: new Date(Date.now() - 1000 * 60 * 60),
      symbols: ['XLE', 'XOM', 'CVX'],
    },
  ];

  const displayNews = news.length > 0 ? news : mockNews;

  return (
    <Card className="glass-effect h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg font-semibold">Live News Stream</CardTitle>
          <div className="ml-auto">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-price-up animate-pulse" />
              <span className="text-xs text-muted-foreground">Live</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-6 pb-6">
          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Card key={i} className="p-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </Card>
              ))
            ) : (
              displayNews.map((item, index) => (
                <NewsCard key={item.id} news={item} index={index} />
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

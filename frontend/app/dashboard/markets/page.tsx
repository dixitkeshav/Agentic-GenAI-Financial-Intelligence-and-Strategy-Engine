'use client';

import { useLiveTicker } from '@/hooks/useLiveTicker';
import { useMarketStore } from '@/store/marketStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MarketsPage() {
  const indices = useMarketStore((state) => state.indices);
  useLiveTicker();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Markets</h1>
        <p className="text-muted-foreground">Live indices and stock prices from /api/live-ticker/</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {indices.map((index) => (
          <Card key={index.symbol} className="glass-effect">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{index.symbol}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{index.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <div
                className={cn(
                  'flex items-center gap-1 text-sm mt-1',
                  index.changePercent >= 0 ? 'text-price-up' : 'text-price-down'
                )}
              >
                {index.changePercent >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span>{index.changePercent >= 0 ? '+' : ''}{index.changePercent.toFixed(2)}%</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

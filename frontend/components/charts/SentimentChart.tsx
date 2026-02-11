'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

function useSentimentChartData() {
  const { data, isLoading } = useQuery({
    queryKey: ['sentiment-chart'],
    queryFn: () => apiClient.getSentimentAnalytics(),
    staleTime: 60000,
  });
  if (!data?.trend) return { data: null, isLoading };
  const trendData = data.trend.labels.map((label, i) => ({
    hour: label,
    sentiment: data.trend.positive[i] / (data.trend.positive[i] + data.trend.negative[i] + 1) || 0.5,
    positive: data.trend.positive[i],
    negative: data.trend.negative[i],
  }));
  return { data: trendData, isLoading };
}

export function SentimentChart() {
  const { data: chartData, isLoading } = useSentimentChartData();

  const chartConfig = {
    sentiment: {
      label: 'Sentiment Score',
      color: '#10b981',
    },
    positive: {
      label: 'Positive',
      color: '#10b981',
    },
    negative: {
      label: 'Negative',
      color: '#ef4444',
    },
  };

  const displayData = chartData && chartData.length > 0
    ? chartData
    : Array.from({ length: 5 }, (_, i) => ({ hour: `Day ${i + 1}`, sentiment: 0.5, positive: 10, negative: 5 }));

  return (
    <Card className="glass-effect min-h-0 shrink-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Sentiment Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full min-h-[200px]">
          <LineChart data={displayData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="hour"
              stroke="#94a3b8"
              fontSize={10}
              tickLine={false}
            />
            <YAxis
              stroke="#94a3b8"
              fontSize={10}
              tickLine={false}
              domain={[0, 1]}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="sentiment"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

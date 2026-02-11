'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PortfolioPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Portfolio</h1>
        <p className="text-muted-foreground">Portfolio tracking — coming soon</p>
      </div>
      <Card className="glass-effect">
        <CardHeader>
          <CardTitle>Your Portfolio</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Connect a brokerage or add holdings to track performance.</p>
        </CardContent>
      </Card>
    </div>
  );
}

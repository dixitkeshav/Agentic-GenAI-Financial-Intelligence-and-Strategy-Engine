'use client';

import { NewsFeed } from '@/components/news/NewsFeed';

export default function NewsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">News Intelligence</h1>
        <p className="text-muted-foreground">Financial news from /api/fetch-news/ (Alpha Vantage)</p>
      </div>
      <div className="max-w-2xl">
        <NewsFeed />
      </div>
    </div>
  );
}

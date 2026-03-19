const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number;
  timestamp: Date;
  symbols: string[];
  url?: string;
  imageUrl?: string;
}

export interface ChartDataPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SentimentChartData {
  distribution: { labels: string[]; data: number[] };
  trend: {
    labels: string[];
    positive: number[];
    negative: number[];
  };
}

export interface LiveTickerItem {
  symbol: string;
  name: string;
  price: number;
  change_pct: number;
}

export interface AgentsRunResult {
  news_scout: { summary?: string; spike_detected?: boolean; spike_direction?: string };
  macro_context: { summary?: string; macro_links?: string[] };
  market_reaction: { summary?: string; historical_reaction?: string };
  risk: { summary?: string; risk_flags?: string[] };
  decision: { summary?: string; recommendation?: string };
  recommendation?: string;
}

export interface ScannerResultItem {
  symbol: string;
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  sentiment: 'positive' | 'negative' | 'neutral' | string;
  sentiment_score: number;
  momentum: number;
  sentiment_counts: {
    positive: number;
    negative: number;
    neutral: number;
    total: number;
  };
}

export interface ScannerResponse {
  period: string;
  results: ScannerResultItem[];
}

export interface OptionsChainSide {
  bid: number | null;
  ask: number | null;
  lastPrice: number | null;
  impliedVolatility: number | null;
  openInterest: number | null;
  volume: number | null;
}

export interface OptionsChainRow {
  strike: number;
  call: OptionsChainSide;
  put: OptionsChainSide;
}

export interface OptionsChainResponse {
  symbol: string;
  expiry: string | null;
  expiries: string[];
  data: OptionsChainRow[];
  error?: string;
}

export const apiClient = {
  /** Fetch news from /api/fetch-news/ (Alpha Vantage NEWS_SENTIMENT) */
  async getNews(limit = 50): Promise<NewsItem[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/fetch-news/`);
      if (!response.ok) throw new Error('Failed to fetch news');
      const data = await response.json();
      const articles = data.articles || [];
      if (data.error && !articles.length) {
        // Treat upstream "no feed / rate limit" as an empty result.
        return [];
      }
      if (data.error) {
        // If the API returned partial data, still surface error via console.
        console.warn('fetch-news warning:', data.error);
      }
      return articles.map((item: { title?: string; summary?: string; url?: string; sentiment?: string; source?: string; time_published?: string }, i: number) => {
        const ts = item.time_published ? new Date(item.time_published.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6')) : new Date();
        // Normalize sentiment to valid values
        const rawSentiment = (item.sentiment || 'neutral').toLowerCase();
        const validSentiments: ('positive' | 'negative' | 'neutral')[] = ['positive', 'negative', 'neutral'];
        const sentiment = validSentiments.includes(rawSentiment as any) 
          ? (rawSentiment as 'positive' | 'negative' | 'neutral')
          : 'neutral';
        return {
          id: `news-${i}-${ts.getTime()}`,
          headline: item.title || 'No Title',
          source: (item.source || 'Alpha Vantage').replace(/^.*\/\/|www\.|\..*$/g, '').slice(0, 25),
          sentiment,
          sentimentScore: sentiment === 'positive' ? 0.7 : sentiment === 'negative' ? -0.5 : 0,
          timestamp: ts,
          symbols: [],
          url: item.url,
        };
      });
    } catch (error) {
      console.error('Error fetching news:', error);
      return [];
    }
  },

  /** Fetch OHLC chart data for a symbol from /api/market/{symbol}/history/ */
  async getChartData(symbol: string, period = '1mo'): Promise<ChartDataPoint[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/market/${symbol}/history/?period=${period}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch chart data: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.error) {
        // Handle backend errors gracefully - log but don't throw
        console.error('Backend error:', data.error);
        return [];
      }
      return (data.history || []).map((d: { timestamp: number; open: number; high: number; low: number; close: number; volume: number }) => ({
        timestamp: d.timestamp,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume || 0,
      }));
    } catch (error) {
      console.error('Error fetching chart data:', error);
      // Return empty array instead of throwing to prevent UI crashes
      return [];
    }
  },

  /** Run multi-agent pipeline and return unified insights */
  async getAgentInsights(ticker?: string): Promise<AgentsRunResult | null> {
    try {
      const url = ticker
        ? `${API_BASE_URL}/api/agents/run/?ticker=${encodeURIComponent(ticker)}`
        : `${API_BASE_URL}/api/agents/run/`;
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      if (!response.ok) throw new Error('Failed to fetch agent insights');
      return await response.json();
    } catch (error) {
      console.error('Error fetching agent insights:', error);
      return null;
    }
  },

  /** Fetch sentiment distribution and trend from /api/chart-data/ */
  async getSentimentAnalytics(): Promise<SentimentChartData | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chart-data/`);
      if (!response.ok) throw new Error('Failed to fetch sentiment analytics');
      return await response.json();
    } catch (error) {
      console.error('Error fetching sentiment analytics:', error);
      return null;
    }
  },

  /** Fetch live ticker data (indices, stocks) from /api/live-ticker/ */
  async getLiveTicker(): Promise<LiveTickerItem[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/live-ticker/`);
      if (!response.ok) throw new Error('Failed to fetch live ticker');
      const data = await response.json();
      return data.tickers || [];
    } catch (error) {
      console.error('Error fetching live ticker:', error);
      return [];
    }
  },

  /** Fetch scanner results from /api/scanner/ */
  async getScanner(symbols: string, period = '3mo'): Promise<ScannerResponse> {
    const params = new URLSearchParams({ symbols, period });
    const response = await fetch(`${API_BASE_URL}/api/scanner/?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch scanner results');
    return await response.json();
  },

  /** Fetch options chain from /api/options-chain/ (best-effort) */
  async getOptionsChain(symbol: string, expiry?: string): Promise<OptionsChainResponse> {
    const params = new URLSearchParams({ symbol });
    if (expiry) params.set('expiry', expiry);
    const response = await fetch(`${API_BASE_URL}/api/options-chain/?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch options chain');
    return await response.json();
  },
};

import { djangoApiUrl } from '@/lib/apiBase';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function djangoFetch(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(djangoApiUrl(path), {
    ...init,
    cache: 'no-store',
  });
  return response;
}

async function djangoJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await djangoFetch(path, init);
  const data = (await response.json().catch(() => ({}))) as T & { error?: string; detail?: string };
  if (!response.ok) {
    const msg =
      (data as { error?: string }).error ||
      (data as { detail?: string }).detail ||
      `Request failed (${response.status})`;
    throw new ApiError(msg, response.status, data);
  }
  return data;
}

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

export interface PipelineStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  summary?: string;
  duration_ms?: number;
}

export interface ShockScorePayload {
  score: number;
  cause: string;
  headline: string;
  source: string;
  hedge: string;
  timestamp: string;
}

export interface ShockHistoryRow {
  date: string;
  direction: string;
  magnitude: number;
  intraday_range: number;
  cause_type: string;
  headline: string;
  index?: string;
}

export interface AgentsRunResult {
  error?: string;
  news_scout: { summary?: string; spike_detected?: boolean; spike_direction?: string };
  macro_context: { summary?: string; macro_links?: string[] };
  technical?: { summary?: string; signal?: string; indicators?: Record<string, number> };
  market_reaction: { summary?: string; historical_reaction?: string };
  risk: { summary?: string; risk_flags?: string[] };
  shock?: {
    shock_probability?: number;
    trigger_cause?: string;
    summary?: string;
    suggested_hedge?: string;
  };
  decision: { summary?: string; recommendation?: string };
  recommendation?: string;
  pipeline?: PipelineStep[];
  article_count?: number;
  news_source?: string;
  ticker?: string | null;
}

export interface BacktestResult {
  error?: string;
  ticker?: string;
  price_source?: string;
  kite_used?: boolean;
  kite_note?: string;
  yfinance_symbol?: string;
  sentiment_source?: string;
  price_only_sharpe?: number | null;
  strategy_sharpe?: number | null;
  ic?: number | null;
  total_return_price?: number | null;
  total_return_strategy?: number | null;
  num_days?: number;
  recent_price_context?: {
    approx_return_1m?: number | null;
    approx_return_3m?: number | null;
    annualized_volatility?: number | null;
  };
  explanation?: {
    headline?: string;
    recent_trend?: string;
    quarterly_context?: string;
    why_price_might_move?: string[];
    methodology?: string;
    strategy_note?: string;
    disclaimer?: string;
  };
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
  /** Backend: yfinance | finnhub */
  source?: string;
}

function isSentiment(x: string): x is 'positive' | 'negative' | 'neutral' {
  return x === 'positive' || x === 'negative' || x === 'neutral';
}

export const apiClient = {
  /** Ping Django via proxy (live-ticker is lightweight). */
  async checkHealth(): Promise<{ ok: boolean; message?: string }> {
    try {
      const response = await djangoFetch('/api/live-ticker/');
      if (response.ok) return { ok: true };
      const data = await response.json().catch(() => ({}));
      return {
        ok: false,
        message: (data as { error?: string }).error || `Backend returned ${response.status}`,
      };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : 'Backend unreachable',
      };
    }
  },

  /** Fetch news from /api/fetch-news/ (Alpha Vantage NEWS_SENTIMENT) */
  async getNews(limit = 50): Promise<NewsItem[]> {
    try {
      const response = await djangoFetch('/api/fetch-news/');
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
        const sentiment = isSentiment(rawSentiment) ? rawSentiment : 'neutral';
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
      const response = await djangoFetch(`/api/market/${encodeURIComponent(symbol)}/history/?period=${period}`);
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
      const body: { ticker?: string } = {};
      if (ticker) body.ticker = ticker;
      return await djangoJson<AgentsRunResult>('/api/agents/run/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (error) {
      console.error('Error fetching agent insights:', error);
      return null;
    }
  },

  /** Fetch sentiment distribution and trend from /api/chart-data/ */
  async getSentimentAnalytics(): Promise<SentimentChartData | null> {
    try {
      const response = await djangoFetch('/api/chart-data/');
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
      const response = await djangoFetch('/api/live-ticker/');
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
    const response = await djangoFetch(`/api/scanner/?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch scanner results');
    return await response.json();
  },

  /** Fetch options chain from /api/options-chain/ (yfinance first, Finnhub US fallback) */
  async getOptionsChain(symbol: string, expiry?: string, nocache?: boolean): Promise<OptionsChainResponse> {
    const params = new URLSearchParams({ symbol });
    if (expiry) params.set('expiry', expiry);
    if (nocache) params.set('nocache', '1');
    const response = await djangoFetch(`/api/options-chain/?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch options chain');
    return await response.json();
  },

  async getShockScore(): Promise<ShockScorePayload> {
    return djangoJson<ShockScorePayload>('/api/shock/score/');
  },

  async getShockHistory(page = 1, cause?: string): Promise<{
    results: ShockHistoryRow[];
    total: number;
    pages: number;
  }> {
    const params = new URLSearchParams({ page: String(page) });
    if (cause) params.set('cause', cause);
    return djangoJson(`/api/shock/history/?${params}`);
  },

  async getShockAlerts(): Promise<
    Array<{
      fired_at: string;
      score: number;
      cause: string;
      headline: string;
      source: string;
      hedge: string;
      status: string;
      eod_nifty_change: number | null;
    }>
  > {
    return djangoJson('/api/shock/alerts/');
  },

  /** Run backtest (Kite NSE prices when connected, else Django/yfinance). */
  async runBacktest(
    ticker: string,
    useAlphaSentiment = true,
    kiteCredentials?: { apiKey?: string; apiSecret?: string; accessToken?: string }
  ): Promise<BacktestResult> {
    const response = await fetch('/api/backtest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticker: ticker.trim().toUpperCase(),
        useAlphaSentiment,
        apiKey: kiteCredentials?.apiKey,
        accessToken: kiteCredentials?.accessToken,
      }),
      cache: 'no-store',
    });
    const data = (await response.json()) as BacktestResult;
    if (!response.ok) {
      throw new ApiError(data.error || 'Backtest failed', response.status, data);
    }
    return data;
  },
};

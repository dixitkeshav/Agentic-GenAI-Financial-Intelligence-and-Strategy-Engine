import { NextResponse } from 'next/server';
import { KiteConnect } from 'kiteconnect';

import { djangoApiUrl } from '@/lib/apiBase';
import { getLastBrokerConfig } from '@/lib/broker';
import { resolveNseEquityToken } from '@/lib/kite/resolveInstrument';

function normalizeErrMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unknown error';
}

async function fetchKiteHistory(
  ticker: string,
  apiKey: string,
  accessToken: string
): Promise<{ history: { date: string; open: number; high: number; low: number; close: number; volume: number }[] }> {
  const token = await resolveNseEquityToken(ticker);
  if (!token) {
    throw new Error(`Symbol ${ticker} not found on NSE in Kite instruments list.`);
  }

  const kite = new KiteConnect({ api_key: apiKey });
  kite.setAccessToken(accessToken);

  const to = new Date();
  const from = new Date();
  from.setFullYear(from.getFullYear() - 1);

  const rows = await kite.getHistoricalData(token, 'day', from, to, false);
  const history = rows
    .map((r) => ({
      date: new Date(r.date).toISOString(),
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume ?? 0,
    }))
    .filter((r) => Number.isFinite(r.close));

  if (history.length < 10) {
    throw new Error('Kite returned fewer than 10 daily candles.');
  }
  return { history };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticker = (url.searchParams.get('ticker') || 'RELIANCE').trim().toUpperCase();
  const djangoUrl = djangoApiUrl(`/api/quant/backtest/?templates=1&ticker=${encodeURIComponent(ticker)}`);
  try {
    const res = await fetch(djangoUrl, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ error: normalizeErrMessage(e) }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    ticker?: string;
    useAlphaSentiment?: boolean;
    apiKey?: string;
    accessToken?: string;
    useKite?: boolean;
    mode?: string;
    strategyId?: string;
    strategyPrompt?: string;
    onlyNewsEvents?: boolean;
    days?: number;
    startDate?: string;
    endDate?: string;
    periodLabel?: string;
    customOnly?: boolean;
    useGroqCompile?: boolean;
    compiledRules?: unknown[];
  };

  const ticker = (body.ticker || 'RELIANCE').trim().toUpperCase();
  const mode = body.mode || '';
  const isEnhanced = ['equity_intraday', 'equity_delivery', 'options', 'intraday', 'delivery'].includes(mode);

  const useKite = body.useKite === true;
  let apiKey = body.apiKey || process.env.KITE_API_KEY || '';
  let accessToken = body.accessToken || process.env.KITE_ACCESS_TOKEN || '';

  if (useKite) {
    const session = getLastBrokerConfig();
    if (session?.accessToken) {
      apiKey = session.apiKey || apiKey;
      accessToken = session.accessToken;
    }
  }

  let priceHistory: Record<string, unknown>[] | undefined;
  let priceSource: string | undefined;
  let kiteNote: string | undefined;

  if (useKite && apiKey && accessToken) {
    try {
      const kiteData = await fetchKiteHistory(ticker, apiKey, accessToken);
      priceHistory = kiteData.history;
      priceSource = 'kite';
    } catch (err) {
      const msg = normalizeErrMessage(err);
      kiteNote = `Kite: ${msg} — using Yahoo Finance fallback.`;
    }
  }

  const djangoUrl = djangoApiUrl('/api/quant/backtest/');
  const payload: Record<string, unknown> = {
    ticker,
    price_history: priceHistory,
    price_source: priceSource,
  };

  if (isEnhanced) {
    payload.mode = mode === 'intraday' ? 'equity_intraday' : mode === 'delivery' ? 'equity_delivery' : mode;
    payload.strategy_id = body.strategyId;
    payload.strategy_prompt = body.strategyPrompt;
    payload.only_news_events = body.onlyNewsEvents !== false;
    payload.days = body.days ?? 126;
    if (body.startDate) payload.start_date = body.startDate;
    if (body.endDate) payload.end_date = body.endDate;
    if (body.periodLabel) payload.period_label = body.periodLabel;
    payload.custom_only = body.customOnly === true;
    payload.use_groq_compile = body.useGroqCompile === true;
    if (body.compiledRules?.length) {
      payload.compiled_rules = body.compiledRules;
    }
  } else {
    payload.use_alpha_sentiment = body.useAlphaSentiment !== false;
  }

  let djangoRes: Response;
  try {
    djangoRes = await fetch(djangoUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Backend unreachable',
        explanation: { headline: 'Start Django: cd backend && python3 manage.py runserver' },
      },
      { status: 502 }
    );
  }

  const data = await djangoRes.json().catch(() => ({}));
  if (!djangoRes.ok) {
    return NextResponse.json({ ...data, kite_note: kiteNote }, { status: djangoRes.status });
  }

  return NextResponse.json({
    ...data,
    price_source: priceSource || data.price_source || 'yfinance',
    kite_used: priceSource === 'kite',
    kite_note: kiteNote,
  });
}

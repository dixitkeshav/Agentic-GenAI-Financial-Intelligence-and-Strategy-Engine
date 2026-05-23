import { NextResponse } from 'next/server';
import { KiteConnect } from 'kiteconnect';

import { djangoApiUrl } from '@/lib/apiBase';
import { getLastBrokerConfig } from '@/lib/broker';
import { resolveNseEquityToken } from '@/lib/kite/resolveInstrument';

async function fetchKiteHistory(
  ticker: string,
  apiKey: string,
  accessToken: string
): Promise<{ history: { date: string; close: number }[]; instrumentToken: number }> {
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
      close: r.close,
    }))
    .filter((r) => Number.isFinite(r.close));

  if (history.length < 10) {
    throw new Error('Kite returned fewer than 10 daily candles.');
  }
  return { history, instrumentToken: token };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    ticker?: string;
    useAlphaSentiment?: boolean;
    apiKey?: string;
    accessToken?: string;
  };

  const ticker = (body.ticker || 'RELIANCE').trim().toUpperCase();
  const useAlphaSentiment = body.useAlphaSentiment !== false;

  let apiKey = body.apiKey || process.env.KITE_API_KEY || '';
  let accessToken = body.accessToken || process.env.KITE_ACCESS_TOKEN || '';

  const session = getLastBrokerConfig();
  if (session?.accessToken) {
    apiKey = session.apiKey || apiKey;
    accessToken = session.accessToken;
  }

  let priceHistory: { date: string; close: number }[] | undefined;
  let priceSource: string | undefined;
  let kiteNote: string | undefined;

  if (apiKey && accessToken) {
    try {
      const kiteData = await fetchKiteHistory(ticker, apiKey, accessToken);
      priceHistory = kiteData.history;
      priceSource = 'kite';
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('Kite history fetch failed, falling back to yfinance:', msg);
      kiteNote = msg.includes('Insufficient permission')
        ? 'Kite historical API not enabled on your app — using Yahoo Finance (RELIANCE.NS).'
        : `Kite: ${msg} — using Yahoo Finance fallback.`;
    }
  } else {
    kiteNote = 'No Kite access token — using Yahoo Finance for prices.';
  }

  const djangoUrl = djangoApiUrl('/api/quant/backtest/');
  let djangoRes: Response;
  try {
    djangoRes = await fetch(djangoUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticker,
        use_alpha_sentiment: useAlphaSentiment,
        price_history: priceHistory,
        price_source: priceSource,
      }),
      cache: 'no-store',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: 'Backend unreachable',
        explanation: {
          headline: 'Django API is not running.',
          disclaimer: `Start: cd backend && python3 manage.py runserver. (${msg})`,
        },
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

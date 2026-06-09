import { NextResponse } from 'next/server';
import { djangoApiUrl } from '@/lib/apiBase';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  try {
    const res = await fetch(djangoApiUrl('/api/quant/backtest/compile/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Compile failed' },
      { status: 502 }
    );
  }
}

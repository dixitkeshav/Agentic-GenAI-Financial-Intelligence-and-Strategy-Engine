import { NextResponse } from 'next/server';
import { djangoApiUrl } from '@/lib/apiBase';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q') || '';
  const params = new URLSearchParams({ suggest: '1', q });
  try {
    const res = await fetch(djangoApiUrl(`/api/quant/backtest/?${params}`), { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Suggest failed', suggestions: [] },
      { status: 502 }
    );
  }
}

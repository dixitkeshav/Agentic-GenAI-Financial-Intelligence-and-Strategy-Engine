import { NextResponse } from 'next/server';

type SearchItem = {
  instrumentToken: string;
  tradingsymbol: string;
  name: string;
  exchange: string;
  segment: string;
};

let cache: { fetchedAtMs: number; items: SearchItem[] } | null = null;

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

async function loadInstruments(): Promise<SearchItem[]> {
  const now = Date.now();
  if (cache && now - cache.fetchedAtMs < 24 * 60 * 60 * 1000) return cache.items;

  const res = await fetch('https://api.kite.trade/instruments', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed instruments dump (${res.status})`);
  const csv = await res.text();
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const idx = (name: string) => header.indexOf(name);

  const tokenI = idx('instrument_token');
  const exchangeI = idx('exchange');
  const tradingsymbolI = idx('tradingsymbol');
  const nameI = idx('name');
  const segmentI = idx('segment');

  const items: SearchItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < header.length) continue;
    const exchange = cols[exchangeI] ?? '';
    const segment = cols[segmentI] ?? '';
    // focus on equities + indices; options/futures will be heavy
    if (!segment.includes('NSE') && !segment.includes('BSE')) continue;
    items.push({
      instrumentToken: String(cols[tokenI] ?? '').trim(),
      tradingsymbol: String(cols[tradingsymbolI] ?? '').trim(),
      name: String(cols[nameI] ?? '').trim(),
      exchange,
      segment,
    });
  }

  cache = { fetchedAtMs: now, items };
  return items;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  if (!q) return NextResponse.json({ items: [] });

  const instruments = await loadInstruments();
  const items = instruments
    .filter((i) => i.tradingsymbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q))
    .slice(0, 20);

  return NextResponse.json({ items });
}


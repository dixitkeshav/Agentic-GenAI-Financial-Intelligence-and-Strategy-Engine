import { NextResponse } from 'next/server';

import { getActiveAdapter, setActiveAdapter } from '@/lib/broker';

export async function POST() {
  try {
    const adapter = getActiveAdapter();
    await adapter.disconnect();
  } catch {
    // ignore
  } finally {
    setActiveAdapter(null);
  }
  return NextResponse.json({ success: true });
}


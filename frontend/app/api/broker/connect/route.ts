import { NextResponse } from 'next/server';

import { createBrokerAdapter, getActiveAdapter, setActiveAdapter, setLastBrokerConfig } from '@/lib/broker';
import type { BrokerConfig } from '@/lib/broker/types';
import { prisma } from '@/lib/db/prisma';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as null | {
    broker?: string;
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
  };

  const broker = (body?.broker ?? '').trim().toLowerCase();
  const apiKey = body?.apiKey ?? '';
  const apiSecret = body?.apiSecret ?? '';
  const accessToken = body?.accessToken ?? '';

  if (!broker || !apiKey || !apiSecret || !accessToken) {
    return NextResponse.json({ success: false, error: 'Missing required fields.' }, { status: 400 });
  }

  const config: BrokerConfig = {
    broker: broker as BrokerConfig['broker'],
    apiKey,
    apiSecret,
    accessToken,
  };

  try {
    const adapter = createBrokerAdapter(broker);
    const result = await adapter.connect(config);
    if (!result.success) {
      await prisma.connectionLog
        .create({
          data: {
            broker,
            success: false,
            error: result.error ?? 'Unknown error',
          },
        })
        .catch(() => null);
      return NextResponse.json({ success: false, error: result.error ?? 'Connection failed' }, { status: 401 });
    }

    setActiveAdapter(adapter);
    setLastBrokerConfig(config);

    const [profile, funds] = await Promise.all([adapter.getProfile(), adapter.getFunds()]);

    await prisma.connectionLog
      .create({
        data: {
          broker,
          success: true,
          profile: profile as object,
        },
      })
      .catch(() => null);

    return NextResponse.json({ success: true, profile, funds });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.connectionLog
      .create({
        data: {
          broker,
          success: false,
          error: msg,
        },
      })
      .catch(() => null);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function GET() {
  try {
    const adapter = getActiveAdapter();
    const profile = await adapter.getProfile();
    return NextResponse.json({ connected: true, profile });
  } catch {
    return NextResponse.json({ connected: false });
  }
}


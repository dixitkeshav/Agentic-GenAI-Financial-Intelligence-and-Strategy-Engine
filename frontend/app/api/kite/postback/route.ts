import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';

type KitePostbackPayload = {
  checksum?: string;
  order_id?: string;
  order_timestamp?: string;
  [k: string]: unknown;
};

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

/**
 * Zerodha postbacks: verify checksum.
 * Docs: order_id + order_timestamp + api_secret → sha256 hex
 */
function verifyChecksum(payload: KitePostbackPayload, apiSecret: string): boolean {
  try {
    const checksum = String(payload?.checksum || '');
    const orderId = String(payload?.order_id || '');
    const orderTs = String(payload?.order_timestamp || '');
    if (!checksum || !orderId || !orderTs) return false;
    const raw = `${orderId}${orderTs}${apiSecret}`;
    const digest = crypto.createHash('sha256').update(raw).digest('hex');
    return digest === checksum;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const apiSecret = requiredEnv('KITE_API_SECRET');
    const payload = (await req.json().catch(() => ({}))) as KitePostbackPayload;

    const ok = verifyChecksum(payload, apiSecret);
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Invalid checksum' }, { status: 401 });
    }

    // For now: just acknowledge. (Wire to DB/alerts later.)
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}


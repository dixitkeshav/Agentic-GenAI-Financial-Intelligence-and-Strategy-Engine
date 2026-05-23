import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as null | { botToken?: string; chatId?: string };
  const botToken = body?.botToken ?? '';
  const chatId = body?.chatId ?? '';

  if (!botToken || !chatId) {
    return NextResponse.json({ success: false, error: 'Missing Telegram Bot Token or Chat ID.' }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: 'EDGE test alert: Telegram integration is working.',
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json(
        { success: false, error: `Telegram error (${res.status}): ${text.slice(0, 300)}` },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}


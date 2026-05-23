import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as null | { apiKey?: string; model?: string };
  const apiKey = body?.apiKey ?? '';
  const model = body?.model ?? 'gpt-4o';

  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'Missing OpenAI API key.' }, { status: 400 });
  }

  const started = Date.now();

  try {
    // Minimal network test without additional deps: hit OpenAI responses endpoint directly.
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: 'Reply with exactly: OK',
        max_output_tokens: 5,
      }),
    });

    const latencyMs = Date.now() - started;
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json(
        { success: false, error: `OpenAI error (${res.status}): ${text.slice(0, 300)}` },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true, latencyMs });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}


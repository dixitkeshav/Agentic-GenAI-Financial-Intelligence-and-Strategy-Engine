'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useSettingsStore, sensitivityToThreshold } from '@/lib/store/settingsStore';

type SectionId = 'broker' | 'ai' | 'alerts' | 'indicators' | 'watchlist';
type IndicatorKey = 'vwap' | 'bollingerBands' | 'dema9' | 'dema15' | 'rsi' | 'macd' | 'mfi';

type BrokerConnectResponse =
  | { success: true; profile?: unknown; funds?: { available: number; used: number } }
  | { success: false; error?: string };

type AiTestResponse = { success: true; latencyMs: number } | { success: false; error?: string };
type TelegramTestResponse = { success: true } | { success: false; error?: string };
type InstrumentsSearchResponse = {
  items?: { instrumentToken: string; tradingsymbol: string; name: string; exchange: string; segment: string }[];
};

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'broker', label: 'Broker' },
  { id: 'ai', label: 'AI Engine' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'indicators', label: 'Indicators' },
  { id: 'watchlist', label: 'Watchlist' },
];

function formatINR(n: number): string {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
  } catch {
    return `₹${Math.round(n)}`;
  }
}

function pulseDot(connected: boolean) {
  return (
    <span className="relative inline-flex h-2 w-2">
      <span
        className={[
          'absolute inline-flex h-full w-full rounded-full opacity-75',
          connected ? 'bg-[#00D4AA] animate-ping' : 'bg-[#6B7280]',
        ].join(' ')}
      />
      <span className={['relative inline-flex h-2 w-2 rounded-full', connected ? 'bg-[#00D4AA]' : 'bg-[#6B7280]'].join(' ')} />
    </span>
  );
}

export default function TerminalSettingsPage() {
  const [section, setSection] = useState<SectionId>('broker');
  const [savedToast, setSavedToast] = useState(false);

  const {
    broker,
    apiKey,
    apiSecret,
    accessToken,
    openAIKey,
    telegramBotToken,
    telegramChatId,
    signalSensitivity,
    enabledIndicators,
    soundAlerts,
    watchlist,
    isConnected,
    connectionProfile,
    connectionFunds,
    updateSettings,
    saveToLocalStorage,
    loadFromLocalStorage,
  } = useSettingsStore();

  // Allow /api/kite/callback to redirect here with the generated token or an error.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const kiteError = url.searchParams.get('kite_error');
      if (kiteError) {
        setConnectError(decodeURIComponent(kiteError));
        setSection('broker');
        url.searchParams.delete('kite_error');
        window.history.replaceState({}, '', url.toString());
        return;
      }
      const kiteToken = url.searchParams.get('kite_access_token');
      if (!kiteToken) return;
      updateSettings({ accessToken: kiteToken });
      setConnectError(null);
      url.searchParams.delete('kite_access_token');
      window.history.replaceState({}, '', url.toString());
      setSection('broker');
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadFromLocalStorage();
  }, [loadFromLocalStorage]);

  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [showOpenAI, setShowOpenAI] = useState(false);
  const [maxSignalsPerDay, setMaxSignalsPerDay] = useState(12);
  const [aiModel, setAiModel] = useState<'gpt-4o' | 'gpt-4o-mini'>('gpt-4o');

  const threshold = sensitivityToThreshold[signalSensitivity];

  async function testBrokerConnection() {
    setIsConnecting(true);
    setConnectError(null);
    try {
      const res = await fetch('/api/broker/connect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ broker, apiKey, apiSecret, accessToken }),
      });
      const data = (await res.json().catch(() => ({}))) as BrokerConnectResponse;
      if (!res.ok || !data.success) {
        updateSettings({ isConnected: false, connectionProfile: null, connectionFunds: null });
        setConnectError(('error' in data && data.error) || 'Connection failed');
        return;
      }
      updateSettings({
        isConnected: true,
        connectionProfile: data.profile ?? null,
        connectionFunds: data.funds ?? null,
      });
    } finally {
      setIsConnecting(false);
    }
  }

  async function disconnectBroker() {
    const ok = window.confirm('Disconnect broker session?');
    if (!ok) return;
    await fetch('/api/broker/disconnect', { method: 'POST' }).catch(() => null);
    updateSettings({ isConnected: false, connectionProfile: null, connectionFunds: null });
  }

  async function testAIConnection() {
    const res = await fetch('/api/ai/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ apiKey: openAIKey, model: aiModel }),
    });
    const data = (await res.json().catch(() => ({}))) as AiTestResponse;
    if (!res.ok || !data.success) {
      alert(('error' in data && data.error) || 'AI test failed');
      return;
    }
    alert(`AI OK. Latency: ${data.latencyMs}ms`);
  }

  async function sendTelegramTest() {
    const res = await fetch('/api/alerts/telegram/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ botToken: telegramBotToken, chatId: telegramChatId }),
    });
    const data = (await res.json().catch(() => ({}))) as TelegramTestResponse;
    if (!res.ok || !data.success) {
      alert(('error' in data && data.error) || 'Telegram test failed');
      return;
    }
    alert('Telegram message sent');
  }

  function playChime(kind: 'BUY' | 'SELL') {
    try {
      const w = window as unknown as { webkitAudioContext?: typeof AudioContext };
      const Ctx = window.AudioContext ?? w.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = kind === 'BUY' ? 880 : 440;
      g.gain.value = 0.0001;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      o.stop(ctx.currentTime + 0.45);
      setTimeout(() => ctx.close().catch(() => null), 600);
    } catch {
      // ignore
    }
  }

  const brokerCards = useMemo(
    () =>
      [
        { id: 'zerodha', label: 'Zerodha' },
        { id: 'upstox', label: 'Upstox' },
        { id: 'fyers', label: 'Fyers' },
        { id: 'angelone', label: 'Angel One' },
      ] as const,
    []
  );

  function save() {
    saveToLocalStorage();
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  }

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-[#E8EAF0]">
      <div className="mx-auto max-w-[1440px] px-6 py-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="font-mono text-2xl tracking-wider text-[#E8EAF0]">
              <span className="text-[#00D4AA] drop-shadow-[0_0_10px_rgba(0,212,170,0.25)]">TERMINAL</span> SETTINGS
            </div>
            <div className="mt-1 text-sm text-[#6B7280]">Broker, AI engine, alerts, indicators, watchlist</div>
          </div>

          <div className="flex items-center gap-3">
            <Badge className="bg-[#111318] border border-[#1E2128] text-[#E8EAF0]">
              <span className="mr-2">{pulseDot(isConnected)}</span>
              {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
            </Badge>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-12 gap-6">
          {/* Left nav */}
          <div className="col-span-3">
            <Card className="bg-[#111318] border border-[#1E2128]">
              <CardHeader>
                <CardTitle className="text-sm text-[#6B7280] tracking-widest">SECTIONS</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {SECTIONS.map((s) => {
                  const active = s.id === section;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSection(s.id)}
                      className={[
                        'w-full text-left px-3 py-2 rounded-lg border transition',
                        active
                          ? 'border-[#00D4AA] bg-[#0A0B0D] shadow-[0_0_0_1px_rgba(0,212,170,0.3)]'
                          : 'border-[#1E2128] bg-transparent hover:bg-[#0A0B0D]',
                      ].join(' ')}
                    >
                      <div className="text-sm">{s.label}</div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Right panel */}
          <div className="col-span-9 space-y-6">
            {section === 'broker' ? (
              <Card className="bg-[#111318] border border-[#1E2128]">
                <CardHeader>
                  <CardTitle>Broker Connection</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-4 gap-3">
                    {brokerCards.map((b) => {
                      const selected = broker === b.id;
                      return (
                        <button
                          key={b.id}
                          onClick={() => updateSettings({ broker: b.id })}
                          className={[
                            'rounded-xl border p-4 text-left transition',
                            selected
                              ? 'border-[#00D4AA] shadow-[0_0_18px_rgba(0,212,170,0.15)] bg-[#0A0B0D]'
                              : 'border-[#1E2128] bg-transparent hover:bg-[#0A0B0D]',
                          ].join(' ')}
                        >
                          <div className="font-medium">{b.label}</div>
                          <div className="mt-1 text-xs text-[#6B7280]">API + WebSocket</div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="text-xs text-[#6B7280]">API KEY</div>
                      <Input
                        value={apiKey}
                        onChange={(e) => updateSettings({ apiKey: e.target.value })}
                        className="bg-[#0A0B0D] border-[#1E2128] font-mono"
                        placeholder="Enter API Key"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-[#6B7280]">API SECRET</div>
                        <button
                          className="text-xs text-[#00D4AA] hover:underline"
                          onClick={() => setShowApiSecret((v) => !v)}
                        >
                          {showApiSecret ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      <Input
                        value={apiSecret}
                        onChange={(e) => updateSettings({ apiSecret: e.target.value })}
                        type={showApiSecret ? 'text' : 'password'}
                        className="bg-[#0A0B0D] border-[#1E2128] font-mono"
                        placeholder="Enter API Secret"
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-[#6B7280]">ACCESS TOKEN</div>
                        <button
                          className="text-xs text-[#00D4AA] hover:underline"
                          onClick={() => setShowAccessToken((v) => !v)}
                        >
                          {showAccessToken ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      <Input
                        value={accessToken}
                        onChange={(e) => updateSettings({ accessToken: e.target.value })}
                        type={showAccessToken ? 'text' : 'password'}
                        className="bg-[#0A0B0D] border-[#1E2128] font-mono"
                        placeholder="Paste Zerodha access token"
                      />
                      <div className="text-xs text-[#6B7280]">
                        Zerodha access tokens expire daily at 6:00 AM IST. Generate a new one at kite.zerodha.com each
                        morning.
                      </div>
                    </div>
                  </div>

                  <details className="rounded-xl border border-[#1E2128] bg-[#0A0B0D] p-4">
                    <summary className="cursor-pointer text-sm text-[#E8EAF0]">How to get credentials</summary>
                    <div className="mt-3 space-y-2 text-sm text-[#6B7280]">
                      <div>1) Create a Kite Connect app in the Zerodha developer console.</div>
                      <div>2) Copy the API Key + API Secret.</div>
                      <div>3) Generate an access token via the daily login flow and paste it here.</div>
                      <div>4) Click “Test Connection” to verify profile + funds.</div>
                    </div>
                  </details>

                  <div className="space-y-3">
                    <Button
                      onClick={testBrokerConnection}
                      disabled={isConnecting}
                      className={[
                        'w-full font-semibold',
                        isConnecting ? 'bg-[#00D4AA]/70 text-black' : 'bg-[#00D4AA] text-black hover:bg-[#00c19a]',
                      ].join(' ')}
                    >
                      {isConnecting ? `Connecting to ${broker}…` : 'Test Connection'}
                    </Button>

                    {connectError ? (
                      <div className="rounded-xl border border-[#FF4D6D]/40 bg-[#FF4D6D]/10 p-4 text-sm text-[#FF4D6D]">
                        {connectError}
                      </div>
                    ) : null}

                    {isConnected && connectionProfile ? (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl border border-[#1E2128] bg-[#0A0B0D] p-4"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-[#111318] border border-[#1E2128] flex items-center justify-center font-mono">
                              {(connectionProfile.user_shortname || connectionProfile.user_name || 'U')
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-medium">{connectionProfile.user_name}</div>
                              <div className="text-xs text-[#6B7280]">
                                {connectionProfile.user_id} • {connectionProfile.email}
                              </div>
                            </div>
                          </div>
                          <Badge className="bg-[#111318] border border-[#1E2128] text-[#E8EAF0]">
                            <span className="mr-2">{pulseDot(true)}</span>Connected
                          </Badge>
                        </div>

                        {connectionFunds ? (
                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <div className="rounded-lg border border-[#1E2128] bg-[#111318] p-3">
                              <div className="text-xs text-[#6B7280]">Available</div>
                              <div className="mt-1 font-mono text-lg">{formatINR(connectionFunds.available)}</div>
                            </div>
                            <div className="rounded-lg border border-[#1E2128] bg-[#111318] p-3">
                              <div className="text-xs text-[#6B7280]">Used</div>
                              <div className="mt-1 font-mono text-lg">{formatINR(connectionFunds.used)}</div>
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-4">
                          <Button
                            variant="ghost"
                            onClick={disconnectBroker}
                            className="border border-[#FF4D6D]/30 text-[#FF4D6D] hover:bg-[#FF4D6D]/10"
                          >
                            Disconnect
                          </Button>
                        </div>
                      </motion.div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {section === 'ai' ? (
              <Card className="bg-[#111318] border border-[#1E2128]">
                <CardHeader>
                  <CardTitle>AI Engine</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-[#6B7280]">OPENAI API KEY</div>
                      <button className="text-xs text-[#00D4AA] hover:underline" onClick={() => setShowOpenAI((v) => !v)}>
                        {showOpenAI ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <Input
                      value={openAIKey}
                      onChange={(e) => updateSettings({ openAIKey: e.target.value })}
                      type={showOpenAI ? 'text' : 'password'}
                      className="bg-[#0A0B0D] border-[#1E2128] font-mono"
                      placeholder="sk-..."
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs text-[#6B7280]">MODEL</div>
                    <div className="grid grid-cols-2 gap-3">
                      {(['gpt-4o', 'gpt-4o-mini'] as const).map((m) => {
                        const selected = aiModel === m;
                        return (
                          <button
                            key={m}
                            onClick={() => setAiModel(m)}
                            className={[
                              'rounded-xl border p-4 text-left transition',
                              selected ? 'border-[#00D4AA] bg-[#0A0B0D]' : 'border-[#1E2128] hover:bg-[#0A0B0D]',
                            ].join(' ')}
                          >
                            <div className="font-medium">{m}</div>
                            <div className="mt-1 text-xs text-[#6B7280]">{m === 'gpt-4o' ? 'Default quality' : 'Cheaper'}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs text-[#6B7280]">SIGNAL SENSITIVITY</div>
                    <div className="grid grid-cols-3 gap-3">
                      {(
                        [
                          { id: 'conservative', label: 'Conservative', est: '3–6/day' },
                          { id: 'balanced', label: 'Balanced', est: '8–15/day' },
                          { id: 'aggressive', label: 'Aggressive', est: '15–30/day' },
                        ] as const
                      ).map((p) => {
                        const selected = signalSensitivity === p.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => updateSettings({ signalSensitivity: p.id })}
                            className={[
                              'rounded-xl border p-4 text-left transition',
                              selected ? 'border-[#00D4AA] bg-[#0A0B0D]' : 'border-[#1E2128] hover:bg-[#0A0B0D]',
                            ].join(' ')}
                          >
                            <div className="font-medium">{p.label}</div>
                            <div className="mt-1 text-xs text-[#6B7280]">score ≥ {sensitivityToThreshold[p.id]}</div>
                            <div className="mt-2 text-xs text-[#6B7280]">est: {p.est}</div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="text-xs text-[#6B7280]">Current threshold: {threshold}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="text-xs text-[#6B7280]">MAX SIGNALS / DAY</div>
                      <Input
                        value={String(maxSignalsPerDay)}
                        onChange={(e) => setMaxSignalsPerDay(Number(e.target.value || 0))}
                        className="bg-[#0A0B0D] border-[#1E2128] font-mono"
                        type="number"
                        min={1}
                        max={200}
                      />
                      <div className="text-xs text-[#6B7280]">Prevents runaway API spend.</div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs text-[#6B7280]">TEST AI CONNECTION</div>
                      <Button onClick={testAIConnection} className="w-full bg-[#00D4AA] text-black hover:bg-[#00c19a]">
                        Test AI Connection
                      </Button>
                      <div className="text-xs text-[#6B7280]">Sends a tiny prompt and reports latency.</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {section === 'alerts' ? (
              <Card className="bg-[#111318] border border-[#1E2128]">
                <CardHeader>
                  <CardTitle>Alerts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="rounded-xl border border-[#1E2128] bg-[#0A0B0D] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Sound Alerts</div>
                        <div className="text-xs text-[#6B7280]">Play distinct chime for BUY vs SELL</div>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => updateSettings({ soundAlerts: !soundAlerts })}
                        className="border border-[#1E2128]"
                      >
                        {soundAlerts ? 'Enabled' : 'Disabled'}
                      </Button>
                    </div>
                    <div className="mt-3 flex gap-3">
                      <Button onClick={() => playChime('BUY')} className="bg-[#00D4AA] text-black hover:bg-[#00c19a]">
                        Preview BUY
                      </Button>
                      <Button
                        onClick={() => playChime('SELL')}
                        className="bg-[#FF4D6D] text-white hover:bg-[#ff3d61]"
                      >
                        Preview SELL
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#1E2128] bg-[#0A0B0D] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Browser Notifications</div>
                        <div className="text-xs text-[#6B7280]">Ask permission on first use</div>
                      </div>
                      <Button
                        variant="ghost"
                        className="border border-[#1E2128]"
                        onClick={async () => {
                          if (!('Notification' in window)) return alert('Notifications not supported.');
                          const p = await Notification.requestPermission();
                          alert(`Permission: ${p}`);
                        }}
                      >
                        Request Permission
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#1E2128] bg-[#0A0B0D] p-4 space-y-4">
                    <div>
                      <div className="font-medium">Telegram Alerts</div>
                      <div className="text-xs text-[#6B7280]">Create a bot via @BotFather on Telegram</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-xs text-[#6B7280]">BOT TOKEN</div>
                        <Input
                          value={telegramBotToken}
                          onChange={(e) => updateSettings({ telegramBotToken: e.target.value })}
                          type="password"
                          className="bg-[#0A0B0D] border-[#1E2128] font-mono"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs text-[#6B7280]">CHAT ID</div>
                        <Input
                          value={telegramChatId}
                          onChange={(e) => updateSettings({ telegramChatId: e.target.value })}
                          className="bg-[#0A0B0D] border-[#1E2128] font-mono"
                        />
                      </div>
                    </div>
                    <Button onClick={sendTelegramTest} className="bg-[#00D4AA] text-black hover:bg-[#00c19a]">
                      Send Test Message
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {section === 'indicators' ? (
              <Card className="bg-[#111318] border border-[#1E2128]">
                <CardHeader>
                  <CardTitle>Indicators</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(
                    [
                      ['vwap', 'VWAP'],
                      ['bollingerBands', 'Bollinger Bands (20,2)'],
                      ['dema9', 'DEMA 9'],
                      ['dema15', 'DEMA 15'],
                      ['rsi', 'RSI (14)'],
                      ['macd', 'MACD (12,26,9)'],
                      ['mfi', 'MFI (14)'],
                    ] as const satisfies readonly [IndicatorKey, string][]
                  ).map(([key, label]) => {
                    const enabled = enabledIndicators[key];
                    return (
                      <div key={key} className="flex items-center justify-between rounded-xl border border-[#1E2128] bg-[#0A0B0D] p-4">
                        <div>
                          <div className="font-medium">{label}</div>
                          <div className="text-xs text-[#6B7280]">Toggle overlay / subplot</div>
                        </div>
                        <Button
                          variant="ghost"
                          className="border border-[#1E2128]"
                          onClick={() =>
                            updateSettings({
                              enabledIndicators: { ...enabledIndicators, [key]: !enabled },
                            })
                          }
                        >
                          {enabled ? 'ON' : 'OFF'}
                        </Button>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ) : null}

            {section === 'watchlist' ? (
              <WatchlistSection watchlist={watchlist} setWatchlist={(wl) => updateSettings({ watchlist: wl })} />
            ) : null}
          </div>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-0 w-full border-t border-[#1E2128] bg-[#0A0B0D]/90 backdrop-blur">
        <div className="mx-auto max-w-[1440px] px-6 py-4 flex items-center justify-between gap-4">
          <div className="text-xs text-[#6B7280]">Changes are not auto-saved. Click Save Settings.</div>
          <div className="flex items-center gap-3">
            <Button onClick={save} className="bg-[#00D4AA] text-black hover:bg-[#00c19a] font-semibold">
              Save Settings
            </Button>
            <AnimatePresence>
              {savedToast ? (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <Badge className="bg-[#111318] border border-[#1E2128] text-[#E8EAF0]">Saved ✓</Badge>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function WatchlistSection(props: { watchlist: string[]; setWatchlist: (wl: string[]) => void }) {
  const { watchlist, setWatchlist } = props;
  const [q, setQ] = useState('');
  const [items, setItems] = useState<
    { instrumentToken: string; tradingsymbol: string; name: string; exchange: string; segment: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const query = q.trim();
      if (!query) {
        setItems([]);
        return;
      }
      setIsLoading(true);
      try {
        const res = await fetch(`/api/broker/instruments/search?q=${encodeURIComponent(query)}`);
        const data = (await res.json().catch(() => ({}))) as InstrumentsSearchResponse;
        if (!alive) return;
        setItems(Array.isArray(data.items) ? data.items : []);
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [q]);

  function add(token: string) {
    if (watchlist.includes(token)) return;
    if (watchlist.length >= 10) return alert('Max 10 symbols for performance.');
    setWatchlist([...watchlist, token]);
    setQ('');
    setItems([]);
  }

  function remove(token: string) {
    setWatchlist(watchlist.filter((t) => t !== token));
  }

  return (
    <Card className="bg-[#111318] border border-[#1E2128]">
      <CardHeader>
        <CardTitle>Watchlist</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="text-xs text-[#6B7280]">SEARCH INSTRUMENTS</div>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-[#0A0B0D] border-[#1E2128] font-mono"
            placeholder="Type symbol name…"
          />
          {isLoading ? <div className="text-xs text-[#6B7280]">Searching…</div> : null}
          {items.length ? (
            <div className="rounded-xl border border-[#1E2128] bg-[#0A0B0D] max-h-64 overflow-auto">
              {items.map((i) => (
                <button
                  key={i.instrumentToken}
                  onClick={() => add(i.instrumentToken)}
                  className="w-full text-left px-3 py-2 hover:bg-[#111318] border-b border-[#1E2128] last:border-b-0"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-sm">{i.tradingsymbol}</div>
                    <div className="text-xs text-[#6B7280]">{i.exchange}</div>
                  </div>
                  <div className="text-xs text-[#6B7280]">{i.name}</div>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="text-xs text-[#6B7280]">ADDED (MAX 10)</div>
          <div className="flex flex-wrap gap-2">
            {watchlist.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-2 rounded-full border border-[#1E2128] bg-[#0A0B0D] px-3 py-1 font-mono text-xs"
              >
                {t}
                <button className="text-[#FF4D6D] hover:underline" onClick={() => remove(t)}>
                  remove
                </button>
              </span>
            ))}
            {watchlist.length === 0 ? <div className="text-xs text-[#6B7280]">No symbols yet.</div> : null}
          </div>
        </div>

        <Button
          variant="ghost"
          className="border border-[#1E2128]"
          onClick={() => alert('Primary symbol selection will drive the /dashboard default symbol in Step 3.')}
        >
          Set as Primary (coming next)
        </Button>
      </CardContent>
    </Card>
  );
}


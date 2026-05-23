'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  const canSubmit = useMemo(() => password.trim().length > 0 && !isLoading, [password, isLoading]);

  async function onSubmit() {
    if (!canSubmit) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setShakeKey((k) => k + 1);
        setError(data.error || 'Access Denied');
        return;
      }
      router.replace('/dashboard');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-[#E8EAF0] flex items-center justify-center px-6">
      <motion.div
        key={shakeKey}
        initial={{ x: 0 }}
        animate={error ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : { x: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        <Card className="bg-[#111318] border border-[#1E2128]">
          <CardHeader>
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="font-mono text-4xl tracking-widest text-[#00D4AA] drop-shadow-[0_0_12px_rgba(0,212,170,0.35)]">
                  EDGE
                </div>
                <div className="mt-2 text-sm text-[#6B7280]">Single-user trading terminal</div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-xs text-[#6B7280]">PASSWORD</div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter dashboard password"
                className="bg-[#0A0B0D] border-[#1E2128] font-mono"
                onKeyDown={(e) => (e.key === 'Enter' ? onSubmit() : null)}
              />
            </div>

            <Button
              onClick={onSubmit}
              disabled={!canSubmit}
              className="w-full bg-[#00D4AA] text-black hover:bg-[#00c19a]"
            >
              {isLoading ? 'Authenticating…' : 'Unlock Terminal'}
            </Button>

            {error ? (
              <div className="rounded-lg border border-[#FF4D6D]/40 bg-[#FF4D6D]/10 p-3 text-sm text-[#FF4D6D]">
                {error}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}


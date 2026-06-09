'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ThemeDock } from '@/components/fintelli/ThemeDock';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setError(data.error || 'Access Denied');
        return;
      }
      router.replace('/dashboard');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <ThemeDock />
      <div className="login-pg">
        <div className="login-card">
          <div className="login-logo">
            <div className="login-mark">F</div>
            <div className="login-brand">FintelliAI</div>
          </div>
          <div className="login-title">Welcome back</div>
          <div className="login-sub">Sign in to your financial intelligence workspace</div>
          <div className="fg">
            <label className="flabel">Email address</label>
            <input
              type="email"
              className="finput"
              placeholder="you@firm.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="fg">
            <label className="flabel">Password</label>
            <input
              type="password"
              className="finput"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => (e.key === 'Enter' ? onSubmit() : null)}
            />
          </div>
          {error ? (
            <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: 'var(--red-soft)', color: 'var(--red)', fontSize: 13 }}>
              {error}
            </div>
          ) : null}
          <button type="button" className="btn-login" onClick={onSubmit} disabled={!canSubmit}>
            {isLoading ? 'Signing in…' : 'Sign in →'}
          </button>
          <div className="login-links" style={{ marginTop: 18 }}>
            <Link href="/" className="llink" style={{ textDecoration: 'none' }}>
              ← Back to home
            </Link>
            <span className="llink">Forgot password?</span>
          </div>
        </div>
      </div>
    </>
  );
}

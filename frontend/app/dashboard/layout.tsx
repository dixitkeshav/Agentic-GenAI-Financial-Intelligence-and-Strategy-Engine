'use client';

import { DashboardShell } from '@/components/fintelli/DashboardShell';
import { ApiConnectionBanner } from '@/components/ApiConnectionBanner';
import { useBackendWarmup } from '@/hooks/useBackendWarmup';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  useBackendWarmup();

  return (
    <DashboardShell>
      <ApiConnectionBanner />
      {children}
    </DashboardShell>
  );
}

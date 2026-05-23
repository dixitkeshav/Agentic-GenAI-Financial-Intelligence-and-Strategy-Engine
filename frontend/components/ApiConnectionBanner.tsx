'use client';

import { useApiHealth } from '@/hooks/useApiHealth';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ApiConnectionBanner() {
  const { isConnected, message, backendUrl, isLoading, refetch } = useApiHealth();

  if (isLoading) {
    return (
      <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-4 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Connecting to Django API at {backendUrl}…
      </div>
    );
  }

  if (isConnected) return null;

  return (
    <div className="mx-6 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div>
          <p className="font-medium text-destructive">Backend API not connected</p>
          <p className="text-muted-foreground">
            {message || `Cannot reach ${backendUrl}`}. Start Django:{' '}
            <code className="rounded bg-background/80 px-1 py-0.5 text-xs">
              cd backend && python manage.py runserver
            </code>
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={() => refetch()}>
        Retry
      </Button>
    </div>
  );
}

export function ApiConnectionBadge() {
  const { isConnected, isLoading } = useApiHealth();
  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> API
      </span>
    );
  }
  if (isConnected) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
        <CheckCircle2 className="h-3 w-3" /> API connected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-destructive">
      <AlertCircle className="h-3 w-3" /> API offline
    </span>
  );
}

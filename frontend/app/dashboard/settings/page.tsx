'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure API endpoints and preferences</p>
      </div>
      <Card className="glass-effect max-w-lg">
        <CardHeader>
          <CardTitle>API Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Backend URL</label>
            <Input
              defaultValue={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}
              placeholder="http://localhost:8000"
              className="mt-1"
              readOnly
            />
            <p className="text-xs text-muted-foreground mt-1">Set NEXT_PUBLIC_API_URL in .env.local</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

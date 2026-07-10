import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AuthStatus, DashboardData } from '@/types'
import { fetchSettings, saveSettings } from '@/lib/settings'
import { relativeTime } from '@/lib/format'

export function SettingsDialog({
  open,
  status,
  dataSource,
  onOpenChange,
  onConnect,
  onDisconnect,
}: {
  open: boolean
  status: AuthStatus
  dataSource: DashboardData['source']
  onOpenChange: (open: boolean) => void
  onConnect: () => void
  onDisconnect: () => void
}) {
  const [apiKey, setApiKey] = useState('')
  const [serverUrl, setServerUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      fetchSettings().then(s => {
        setApiKey(s.intervalsApiKey ?? '')
        setServerUrl(s.opencodeServerUrl ?? '')
        setUsername(s.opencodeUsername ?? '')
      })
    }
  }, [open])

  const handleSave = async () => {
    setSaving(true)
    await saveSettings({
      intervalsApiKey: apiKey || undefined,
      opencodeServerUrl: serverUrl || undefined,
      opencodeUsername: username || undefined,
      opencodePassword: password || undefined,
    })
    setSaving(false)
    setPassword('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Configure data source and AI assistant.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="grid gap-3">
            <h3 className="text-lg font-semibold">Data Source</h3>

            {status.connected ? (
              <div className="rounded-lg border p-3 mb-4">
                <p>Connected as <strong>{status.athleteName}</strong></p>
                {status.lastSyncAt && <p className="text-sm text-muted-foreground">Last updated {relativeTime(status.lastSyncAt)}</p>}
                <Button variant="destructive" onClick={onDisconnect} className="mt-2">Disconnect</Button>
              </div>
            ) : dataSource === 'demo' ? (
              <div className="rounded-lg border p-3 mb-4">
                <p className="mb-2">Demo mode — connect via OAuth or enter an API Key below.</p>
                <Button onClick={onConnect}>Connect Intervals.icu</Button>
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="api-key">API Key (alternative to OAuth)</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="Enter your Intervals.icu API Key"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3">
            <h3 className="text-lg font-semibold">AI Assistant</h3>
            <div className="grid gap-2">
              <Label htmlFor="server-url">Server URL</Label>
              <Input
                id="server-url"
                placeholder="http://opencode-server:4096"
                value={serverUrl}
                onChange={e => setServerUrl(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="username">Username (optional)</Label>
              <Input
                id="username"
                placeholder="Basic Auth username"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password (optional)</Label>
              <Input
                id="password"
                type="password"
                placeholder="Basic Auth password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
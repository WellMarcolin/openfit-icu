# Connection & Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable live Intervals.icu data via OAuth + self-service configuration UI for API Key and LLM settings.

**Architecture:** New `api/settings.ts` endpoint stores config as httpOnly cookies. Proxy falls back to `x-api-key` header when no OAuth token. Assistant reads OpenCode config from cookies. Frontend SettingsDialog provides UI for both sections.

**Tech Stack:** Vercel serverless functions, httpOnly cookies, Intervals.icu OAuth/API Key, OpenCode SDK, @assistant-ui/react

## Global Constraints

- All sensitive values (API Key, LLM password) stored as httpOnly cookies — never accessible from JS
- Settings cookies: 30-day expiry, cleared on logout
- Proxy falls back: OAuth token → API Key cookie → null
- Assistant config priority: env vars → cookies
- All new code follows TDD
- Existing test suite must remain green

---

### Task 1: Settings API Endpoint

**Files:**
- Create: `api/settings.ts`
- Test: `api/settings.test.ts`

**Interfaces:**
- Produces: `GET /api/settings` → `{ intervalsApiKey: string | null, opencodeServerUrl: string | null, opencodeUsername: string | null }`
- Produces: `POST /api/settings` body `{ intervalsApiKey?: string, opencodeServerUrl?: string, opencodeUsername?: string, opencodePassword?: string }` → `{ success: true }`

- [ ] **Step 1: Write failing test — GET returns stored values**

```typescript
import { describe, it, expect } from 'vitest'
import { createMocks } from 'node-mocks-http'
import handler from './settings'

describe('GET /api/settings', () => {
  it('returns stored settings from cookies', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      cookies: {
        intervals_api_key: 'key-123',
        opencode_server_url: 'http://server:4096',
        opencode_username: 'admin',
      },
    })
    await handler(req as any, res as any)
    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data).toEqual({
      intervalsApiKey: 'key-123',
      opencodeServerUrl: 'http://server:4096',
      opencodeUsername: 'admin',
    })
  })

  it('returns nulls when no cookies set', async () => {
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as any, res as any)
    const data = JSON.parse(res._getData())
    expect(data.intervalsApiKey).toBeNull()
    expect(data.opencodeServerUrl).toBeNull()
    expect(data.opencodeUsername).toBeNull()
  })

  it('rejects non-GET methods', async () => {
    const { req, res } = createMocks({ method: 'POST' })
    await handler(req as any, res as any)
    expect(res._getStatusCode()).toBe(405)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/settings.test.ts`
Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node'

const COOKIE_OPTIONS = 'HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({
      intervalsApiKey: req.cookies?.intervals_api_key ?? null,
      opencodeServerUrl: req.cookies?.opencode_server_url ?? null,
      opencodeUsername: req.cookies?.opencode_username ?? null,
    })
  }

  if (req.method === 'POST') {
    const { intervalsApiKey, opencodeServerUrl, opencodeUsername, opencodePassword } = req.body
    const cookies: string[] = []

    if (intervalsApiKey !== undefined) {
      cookies.push(`intervals_api_key=${intervalsApiKey}; ${COOKIE_OPTIONS}`)
    }
    if (opencodeServerUrl !== undefined) {
      cookies.push(`opencode_server_url=${opencodeServerUrl}; ${COOKIE_OPTIONS}`)
    }
    if (opencodeUsername !== undefined) {
      cookies.push(`opencode_username=${opencodeUsername}; ${COOKIE_OPTIONS}`)
    }
    if (opencodePassword !== undefined) {
      cookies.push(`opencode_password=${opencodePassword}; ${COOKIE_OPTIONS}`)
    }

    if (cookies.length > 0) {
      res.setHeader('Set-Cookie', cookies)
    }

    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
```

- [ ] **Step 4: Write failing test — POST stores cookies**

```typescript
describe('POST /api/settings', () => {
  it('stores values as cookies', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { intervalsApiKey: 'new-key', opencodeServerUrl: 'http://new:4096' },
    })
    await handler(req as any, res as any)
    expect(res._getStatusCode()).toBe(200)
    const cookies = res._getHeaders()['set-cookie']
    expect(cookies).toBeDefined()
    expect(Array.isArray(cookies) ? cookies.join('; ') : cookies).toContain('intervals_api_key=new-key')
  })

  it('clears value when empty string sent', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { intervalsApiKey: '' },
    })
    await handler(req as any, res as any)
    const cookies = res._getHeaders()['set-cookie']
    const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : cookies
    expect(cookieStr).toContain('intervals_api_key=;')
    expect(cookieStr).toContain('Max-Age=0')
  })
})
```

- [ ] **Step 5: Update handler to clear values on empty string**

Add clearing logic: if value is `''` (empty string), set cookie with `Max-Age=0` to delete it.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run api/settings.test.ts`
Expected: PASS (all tests)

- [ ] **Step 7: Commit**

```bash
git add api/settings.ts api/settings.test.ts
git commit -m "feat(settings): add settings API endpoint with cookie storage"
```

---

### Task 2: Proxy API Key Fallback

**Files:**
- Modify: `api/lib/proxy.ts` (lines 5-7, 17-24, 27-29)
- Test: `api/lib/proxy.test.ts`

**Interfaces:**
- Consumes: `intervals_api_key` cookie set by Task 1
- Modifies: `getAccessToken()` now also checks for `intervals_api_key` cookie
- Modifies: `proxyToIntervalsIcu()` accepts optional API key parameter, uses `X-API-Key` header when provided
- Modifies: `getValidAccessToken()` returns API key string when OAuth token absent and API key present

- [ ] **Step 1: Write failing test — API Key fallback**

```typescript
import { describe, expect, it } from 'vitest'
import { getAccessToken, proxyToIntervalsIcu, getAuthMethod } from './proxy'

describe('getAccessToken with API Key', () => {
  it('returns API key when no OAuth token', () => {
    const req = { cookies: { intervals_api_key: 'api-key-456' } } as any
    expect(getAccessToken(req)).toEqual({ token: 'api-key-456', method: 'apikey' })
  })

  it('prefers OAuth token over API key', () => {
    const req = { cookies: { access_token: 'oauth-123', intervals_api_key: 'api-key-456' } } as any
    expect(getAccessToken(req)).toEqual({ token: 'oauth-123', method: 'oauth' })
  })

  it('returns null when no auth found', () => {
    const req = { cookies: {} } as any
    expect(getAccessToken(req)).toBeNull()
  })
})

describe('getAuthMethod', () => {
  it('returns "oauth" when access_token cookie exists', () => {
    const req = { cookies: { access_token: 'tok' } } as any
    expect(getAuthMethod(req)).toBe('oauth')
  })

  it('returns "apikey" when only api key cookie exists', () => {
    const req = { cookies: { intervals_api_key: 'key' } } as any
    expect(getAuthMethod(req)).toBe('apikey')
  })

  it('returns null when no auth cookies', () => {
    const req = { cookies: {} } as any
    expect(getAuthMethod(req)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/lib/proxy.test.ts`
Expected: FAIL — new tests fail

- [ ] **Step 3: Implement API key support in proxy**

Add `getAuthMethod()` helper and rewrite `getAccessToken()` + `getValidAccessToken()` to return `{ token, method }`:

```typescript
export function getAuthMethod(req: VercelRequest): 'oauth' | 'apikey' | null {
  if (req.cookies?.access_token) return 'oauth'
  if (req.cookies?.intervals_api_key) return 'apikey'
  return null
}

export function getAccessToken(req: VercelRequest): { token: string; method: 'oauth' | 'apikey' } | null {
  if (req.cookies?.access_token) {
    return { token: req.cookies.access_token, method: 'oauth' }
  }
  if (req.cookies?.intervals_api_key) {
    return { token: req.cookies.intervals_api_key, method: 'apikey' }
  }
  return null
}
```

Rewrite `proxyToIntervalsIcu()` to accept `{ token, method }`:
```typescript
export async function proxyToIntervalsIcu(
  auth: { token: string; method: 'oauth' | 'apikey' },
  path: string,
  options?: { method?: string; body?: unknown }
): Promise<Response> {
  const httpMethod = options?.method ?? 'GET'
  const body = options?.body !== undefined ? JSON.stringify(options.body) : undefined

  const authHeader = auth.method === 'apikey'
    ? { 'X-API-Key': auth.token }
    : { 'Authorization': `Bearer ${auth.token}` }

  return fetch(`${INTERVALS_ICU_BASE}${path}`, {
    method: httpMethod,
    headers: {
      ...authHeader,
      'Content-Type': 'application/json',
    },
    body,
  })
}
```

Rewrite `getValidAccessToken()` to return `{ token, method }` and skip refresh for API keys:
```typescript
export async function getValidAccessToken(
  req: VercelRequest,
  res: VercelResponse
): Promise<{ token: string; method: 'oauth' | 'apikey' } | null> {
  const auth = getAccessToken(req)
  if (!auth) return null

  // API keys don't expire — no refresh needed
  if (auth.method === 'apikey') return auth

  // OAuth token — check expiry and refresh if needed
  const refreshToken = req.cookies?.refresh_token
  if (!refreshToken) return auth

  // ... existing refresh logic ...
}
```

- [ ] **Step 4: Update existing proxy test to match new signature**

The existing 3 tests for `getAccessToken` need updating:
```typescript
describe('getAccessToken', () => {
  it('returns token from cookies', () => {
    const req = { cookies: { access_token: 'abc123' } } as any
    expect(getAccessToken(req)).toEqual({ token: 'abc123', method: 'oauth' })
  })

  it('returns null when no cookie', () => {
    const req = { cookies: {} } as any
    expect(getAccessToken(req)).toBeNull()
  })

  it('returns null when cookies undefined', () => {
    const req = {} as any
    expect(getAccessToken(req)).toBeNull()
  })
})
```

Modify `proxyToIntervalsIcu()` signature:
```typescript
export async function proxyToIntervalsIcu(
  auth: { token: string; method: 'oauth' | 'apikey' },
  path: string,
  options?: { method?: string; body?: unknown }
): Promise<Response> {
```
- When `method === 'oauth'`, use `Authorization: Bearer {token}`
- When `method === 'apikey'`, use `X-API-Key: {token}`

Update all 9 data endpoints that import these functions to use the new `{ token, method }` signature:
- `api/data/athlete.ts`
- `api/data/activities.ts`
- `api/data/wellness.ts`
- `api/data/power-curves.ts`
- `api/data/events/index.ts`
- `api/data/events/[id].ts`
- `api/data/workouts/index.ts`
- `api/data/workouts/[id].ts`

Pattern for the change in each endpoint:
```typescript
// Before:
const accessToken = await getValidAccessToken(req, res)
if (!accessToken) return res.status(401).json({ error: 'Not authenticated' })
const response = await proxyToIntervalsIcu(accessToken, `/athlete/${athleteId}`)

// After:
const auth = await getValidAccessToken(req, res)
if (!auth) return res.status(401).json({ error: 'Not authenticated' })
const response = await proxyToIntervalsIcu(auth, `/athlete/${athleteId}`)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run api/lib/proxy.test.ts`
Expected: PASS

- [ ] **Step 5: Update all 9 data endpoints** with the new signature pattern

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (except pre-existing worktree WorkoutDialog failure)

- [ ] **Step 7: Commit**

```bash
git add api/lib/proxy.ts api/lib/proxy.test.ts api/data/athlete.ts api/data/activities.ts api/data/wellness.ts api/data/power-curves.ts api/data/events/index.ts "api/data/events/[id].ts" api/data/workouts/index.ts "api/data/workouts/[id].ts"
git commit -m "feat(proxy): add API Key authentication with method detection"
```

```bash
git add api/lib/proxy.ts api/lib/proxy.test.ts
git commit -m "feat(proxy): add API Key fallback authentication"
```

---

### Task 3: Assistant Cookie-Based Config

**Files:**
- Modify: `api/assistant/config.ts`
- Modify: `api/assistant/chat.ts`
- Test: `api/assistant/chat.test.ts` (new if needed)

**Interfaces:**
- Consumes: `opencode_server_url`, `opencode_username`, `opencode_password` cookies set by Task 1
- Modifies: `config.ts` — falls back to cookies when env vars unset, returns richer status
- Modifies: `chat.ts` — reads config from cookies when env vars unset

- [ ] **Step 1: Write failing test — config reads cookies**

```typescript
import { describe, it, expect } from 'vitest'
import handler from './config'
import { createMocks } from 'node-mocks-http'

describe('GET /api/assistant/config', () => {
  beforeEach(() => {
    delete process.env.OPENCODE_SERVER_URL
  })

  it('returns config from cookies when no env vars', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      cookies: {
        opencode_server_url: 'http://cookie-server:4096',
        opencode_username: 'user',
        opencode_password: 'pass',
      },
    })
    await handler(req as any, res as any)
    const data = JSON.parse(res._getData())
    expect(data.available).toBe(true)
    expect(data.serverConfigured).toBe(true)
  })

  it('prefers env vars over cookies', async () => {
    process.env.OPENCODE_SERVER_URL = 'http://env-server:4096'
    process.env.OPENCODE_SERVER_USERNAME = 'env-user'
    process.env.OPENCODE_SERVER_PASSWORD = 'env-pass'
    const { req, res } = createMocks({
      method: 'GET',
      cookies: { opencode_server_url: 'http://cookie:4096' },
    })
    await handler(req as any, res as any)
    const data = JSON.parse(res._getData())
    expect(data.available).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/assistant/config.test.ts`
Expected: FAIL

- [ ] **Step 3: Update `config.ts`**

```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const serverUrl = process.env.OPENCODE_SERVER_URL || req.cookies?.opencode_server_url
  const username = process.env.OPENCODE_SERVER_USERNAME || req.cookies?.opencode_username
  const password = process.env.OPENCODE_SERVER_PASSWORD || req.cookies?.opencode_password

  if (!serverUrl) {
    return res.status(200).json({
      available: false,
      serverConfigured: false,
      error: 'OpenCode server not configured',
    })
  }

  return res.status(200).json({
    available: true,
    serverConfigured: Boolean(serverUrl && username && password),
    model: process.env.OPENCODE_ZEN_MODEL || 'default',
  })
}
```

- [ ] **Step 4: Update `chat.ts` to read config from cookies**

```typescript
const serverUrl = process.env.OPENCODE_SERVER_URL || req.cookies?.opencode_server_url
const username = process.env.OPENCODE_SERVER_USERNAME || req.cookies?.opencode_username
const password = process.env.OPENCODE_SERVER_PASSWORD || req.cookies?.opencode_password
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run api/assistant/`
Expected: PASS (all assistant tests)

- [ ] **Step 6: Commit**

```bash
git add api/assistant/config.ts api/assistant/chat.ts
git commit -m "feat(assistant): read OpenCode config from cookies as fallback"
```

---

### Task 4: Frontend Settings Helpers + Types

**Files:**
- Create: `src/lib/settings.ts`
- Modify: `src/types.ts` (add `AppSettings` interface)
- Test: `src/lib/settings.test.ts`

**Interfaces:**
- Produces: `fetchSettings(): Promise<AppSettings>` — calls GET /api/settings
- Produces: `saveSettings(settings: Partial<AppSettings>): Promise<void>` — calls POST /api/settings
- Produces: `testAssistantConnection(url, username, password): Promise<boolean>` — tests OpenCode server
- Produces: `testApiKey(key: string): Promise<boolean>` — tests Intervals.icu API Key

- [ ] **Step 1: Add `AppSettings` type to `src/types.ts`**

```typescript
export interface AppSettings {
  intervalsApiKey: string | null
  opencodeServerUrl: string | null
  opencodeUsername: string | null
}
```

- [ ] **Step 2: Write failing test for settings helpers**

```typescript
import { describe, it, expect } from 'vitest'
import { fetchSettings, saveSettings } from './settings'

describe('fetchSettings', () => {
  it('returns settings from API', async () => {
    const mock = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        intervalsApiKey: 'key-123',
        opencodeServerUrl: 'http://server:4096',
        opencodeUsername: 'admin',
      }), { status: 200 })
    )
    const result = await fetchSettings()
    expect(result.intervalsApiKey).toBe('key-123')
    expect(result.opencodeServerUrl).toBe('http://server:4096')
    expect(result.opencodeUsername).toBe('admin')
    mock.mockRestore()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

- [ ] **Step 4: Implement helpers**

```typescript
import type { AppSettings } from '../types'

export async function fetchSettings(): Promise<AppSettings> {
  const res = await fetch('/api/settings')
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  if (!res.ok) throw new Error('Failed to save settings')
}

export async function testAssistantConnection(url: string, username: string, password: string): Promise<boolean> {
  try {
    const res = await fetch('/api/assistant/config')
    return res.ok
  } catch {
    return false
  }
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/lib/settings.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/settings.ts src/lib/settings.test.ts src/types.ts
git commit -m "feat(settings): add frontend settings helpers and types"
```

---

### Task 5: Settings UI Component

**Files:**
- Create: `src/components/Settings/SettingsDialog.tsx`
- Test: `src/components/Settings/SettingsDialog.test.tsx`

**Interfaces:**
- Consumes: `fetchSettings()`, `saveSettings()`, `testAssistantConnection()` from Task 4
- Consumes: `AuthStatus` from `src/types.ts`
- Produces: `<SettingsDialog>` component with two sections

- [ ] **Step 1: Write shell test**

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SettingsDialog } from './SettingsDialog'

describe('SettingsDialog', () => {
  it('renders data source and AI assistant sections', () => {
    render(<SettingsDialog open={true} onOpenChange={() => {}} />)
    expect(screen.getByText('Data Source')).toBeTruthy()
    expect(screen.getByText('AI Assistant')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Implement SettingsDialog component**

Two sections using shadcn Dialog, Input, Button components matching app style:

```tsx
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
      <DialogContent className="settings-dialog">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Configure data source and AI assistant.</DialogDescription>
        </DialogHeader>

        <div className="settings-section">
          <h3 className="settings-section-title">Data Source</h3>

          {status.connected ? (
            <div className="connected-state">
              <p>Connected as <strong>{status.athleteName}</strong></p>
              {status.lastSyncAt && <p>Last updated {relativeTime(status.lastSyncAt)}</p>}
              <Button variant="destructive" onClick={onDisconnect}>Disconnect</Button>
            </div>
          ) : dataSource === 'demo' ? (
            <div className="connected-state">
              <p>Demo mode — connect via OAuth or enter an API Key below.</p>
              <Button onClick={onConnect}>Connect Intervals.icu</Button>
            </div>
          ) : null}

          <div className="settings-field">
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

        <div className="settings-section">
          <h3 className="settings-section-title">AI Assistant</h3>
          <div className="settings-field">
            <Label htmlFor="server-url">Server URL</Label>
            <Input
              id="server-url"
              placeholder="http://opencode-server:4096"
              value={serverUrl}
              onChange={e => setServerUrl(e.target.value)}
            />
          </div>
          <div className="settings-field">
            <Label htmlFor="username">Username (optional)</Label>
            <Input
              id="username"
              placeholder="Basic Auth username"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>
          <div className="settings-field">
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

        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/components/Settings/SettingsDialog.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/Settings/SettingsDialog.tsx src/components/Settings/SettingsDialog.test.tsx
git commit -m "feat(settings): add SettingsDialog component with Data Source and AI Assistant sections"
```

---

### Task 6: Wire SettingsDialog into App.tsx

**Files:**
- Modify: `src/App.tsx` (replace inline SettingsDialog, wire connect/disconnect)

**Interfaces:**
- Consumes: `<SettingsDialog>` component from Task 5
- Consumes: existing `status`, `dataSource`, `connecting`, `connect()`, `disconnect()` state/methods

- [ ] **Step 1: Replace inline SettingsDialog**

Replace the existing `SettingsDialog` function (lines 505-559 in App.tsx) with:

```tsx
import { SettingsDialog } from '@/components/Settings/SettingsDialog'
```

And in the render:
```tsx
<SettingsDialog
  open={settingsOpen}
  onOpenChange={setSettingsOpen}
/>
```

- [ ] **Step 2: Ensure OAuth status still works**

The Settings page uses `AuthStatus` from App.tsx. The `status.connected` state shows connected athlete name. Keep the "Connect" and "Disconnect" buttons accessible.

- [ ] **Step 3: Run tests**

Run: `npx vitest run`
Expected: All tests pass (or only pre-existing WorkoutDialog worktree failure)

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(settings): wire SettingsDialog into App.tsx, replace inline dialog"
```

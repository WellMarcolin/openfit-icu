# Connection & Configuration Design

## Context

The app has two systems fully built but not yet connected:

1. **Intervals.icu OAuth** — PKCE-based flow (`/api/auth/login`, `/api/auth/callback`, `/api/auth/status`, `/api/auth/logout`), proxy forwarding for all data endpoints, Connect button + Settings dialog in the frontend. Fails because no real OAuth credentials are configured in `.env`.

2. **Health Assistant AI chat** — `@assistant-ui/react` UI, `/api/assistant/chat` endpoint, `@opencode-ai/sdk` wrapper, context builder that serializes dashboard data. Shows "OpenCode not configured" because `OPENCODE_SERVER_URL` is not set.

## Phase 1 — Immediate OAuth Setup

Guide the user through creating an Intervals.icu OAuth app and configuring `.env`. No code changes needed.

### Steps

1. User creates OAuth App at `https://intervals.icu/settings/oauth_apps`
   - Name: "OpenFit ICU"
   - Redirect URI: `http://localhost:5173/api/auth/callback` (dev) or deployment URL
2. Fill `.env`:
   ```
   INTERVALS_ICU_CLIENT_ID=<from OAuth app>
   INTERVALS_ICU_CLIENT_SECRET=<from OAuth app>
   INTERVALS_ICU_REDIRECT_URI=http://localhost:5173/api/auth/callback
   OPENCODE_SERVER_URL=<opencode-server-url>
   OPENCODE_SERVER_USERNAME=<optional>
   OPENCODE_SERVER_PASSWORD=<optional>
   ```
3. Click "Connect" in the app → OAuth flow → callback → cookies set → data loads from Intervals.icu
4. Health Assistant activates automatically when `OPENCODE_SERVER_URL` is set

## Phase 2 — In-App Configuration UI

Self-service configuration page so users can configure everything from within the app without touching `.env`.

### Settings Page Layout

A new page at `/settings` (replace current placeholder) with two sections:

#### 1. Data Source

**OAuth status card** (already exists):
- Shows connected/disconnected status, athlete name, last sync
- "Connect" button → OAuth flow
- "Disconnect" button → clears cookies

**API Key fallback** (new):
- Text field for Intervals.icu API Key
- "Save" button → stores key in httpOnly cookie via `POST /api/settings`
- "Test connection" button → validates key against `GET /api/athlete`
- When API Key is active, the proxy authenticates via `X-API-Key` header instead of OAuth Bearer token
- Visual indicator showing which auth method is active

#### 2. AI Assistant

Three text fields:
- **Server URL** — OpenCode server address (e.g. `http://opencode-server:4096`)
- **Username** — optional Basic Auth username
- **Password** — optional Basic Auth password (masked input)

Action buttons:
- **"Test connection"** → calls OpenCode server health endpoint, shows success/failure
- **"Save"** → stores in httpOnly cookies via `POST /api/settings`

Status indicator:
- Green: configured and reachable
- Yellow: configured but unreachable
- Red/gray: not configured

### Architecture Changes

#### New endpoint: `POST /api/settings`

Stores configuration values as httpOnly cookies:
- `intervals_api_key` — API Key for non-OAuth auth
- `opencode_server_url` — LLM server URL
- `opencode_server_username` — LLM auth username
- `opencode_server_password` — LLM auth password

Cookies expire after 30 days or on logout.

#### Modified: `api/lib/proxy.ts`

- `getValidAccessToken()` falls back to reading `intervals_api_key` cookie if no OAuth token exists
- When API Key is used, passes `x-api-key` header directly (no OAuth Bearer token)

#### Modified: `api/assistant/config.ts`

- Reads `opencode_server_url` cookie (or `OPENCODE_SERVER_URL` env var as fallback)
- `POST` handler to update config (stores in cookies)

#### Modified: `api/assistant/chat.ts`

- Reads OpenCode server config from cookies instead of only from env vars

#### Modified: `src/App.tsx`

- Settings dialog expanded with sections above
- Calls `GET /api/settings` to populate fields on open
- Calls `POST /api/settings` on save

#### New: Settings state type

```typescript
interface AppSettings {
  dataSource: { method: 'oauth' | 'apikey' | 'demo', apiKey?: string }
  assistant: {
    serverUrl: string
    username: string
    password: string
    status: 'configured' | 'unreachable' | 'not-configured'
  }
}
```

### Security

- API Key and LLM credentials stored as httpOnly cookies (not accessible from JS)
- API Key never logged or exposed in frontend error messages
- OAuth PKCE prevents CSRF on the OAuth callback
- Settings cookies have 30-day expiry, cleared on logout

### Testing

- `api/lib/proxy.test.ts` — test API Key fallback path
- `api/lib/settings.test.ts` — new test file for settings CRUD
- `src/components/Settings/SettingsDialog.test.tsx` — new component test
- Manual: full OAuth flow, API Key flow, LLM test connection

### Non-Goals

- User registration / multi-tenant
- Storing settings in a database (cookies only — stateless)
- OAuth for the LLM provider (Basic Auth only)

## Files Changed

| File | Change |
|------|--------|
| `api/lib/proxy.ts` | Add API Key fallback in `getValidAccessToken()` |
| `api/settings.ts` | **New** — GET/POST for settings CRUD |
| `api/assistant/config.ts` | Read cookies for OpenCode config |
| `api/assistant/chat.ts` | Use cookie config instead of only env vars |
| `src/types.ts` | Add `AppSettings` interface |
| `src/App.tsx` | Expand Settings dialog with sections |
| `src/components/Settings/SettingsDialog.tsx` | **New** — extracted settings UI |
| `src/lib/settings.ts` | **New** — settings API helpers |

## Implementation Order

1. .env setup guide (Phase 1, no code)
2. `api/settings.ts` — settings CRUD endpoint
3. `api/lib/proxy.ts` — API Key fallback
4. `api/assistant/*` — cookie-based config
5. `src/lib/settings.ts` — frontend API helpers
6. `src/components/Settings/SettingsDialog.tsx` — settings UI
7. Wire into `src/App.tsx`
8. Tests + manual verification

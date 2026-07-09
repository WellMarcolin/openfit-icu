# OpenFit ICU — Critical Code Review Fixes

## Context

Code review identified 4 Critical, 5 Important, and 5 Minor issues blocking production readiness. This spec covers all fixes using a security-first approach: security → functionality → cleanup → integration → polish.

## Approach: Security-First

1. Security fixes (`.gitignore`, path traversal)
2. 6 missing API endpoints (app non-functional without them)
3. Remove dead views + `@ts-nocheck` (cleanup)
4. Integrate dead code (`normalize.ts`, `intervals-icu.ts`)
5. Important + Minor fixes

---

## 1. Security Fixes

### 1.1 `.gitignore` — Prevent secret leakage

Add to `.gitignore`:
```
.env
.env.local
.env.*.local
```

### 1.2 Path Traversal in API Proxies

**Problem**: `athleteId` is interpolated directly into URLs without validation (`api/data/activities.ts:9`, `api/data/athlete.ts:9`). An attacker can pass `../../admin` to reach unintended API paths.

**Fix**: Create `api/lib/validation.ts` with:
```ts
export function validateAthleteId(id: string | string[] | undefined): string {
  const raw = Array.isArray(id) ? id[0] : id || '0';
  if (!/^i?\d+$/.test(raw)) {
    throw new Error('Invalid athlete ID');
  }
  return raw;
}
```

Apply to all endpoints receiving `athleteId` as query param. Return 400 on invalid input.

---

## 2. Six Missing API Endpoints

### 2.1 `api/auth/status.ts` — GET `/api/auth/status`

**Called by**: `App.tsx:129,141`

Checks if `access_token` cookie exists. If yes, calls `https://intervals.icu/api/v1/athlete` to validate the token and retrieve athlete ID/name. Returns:
```ts
{ connected: true, method: 'oauth', athleteId: 'i12345', athleteName: '...', lastSyncAt: '...' }
// or
{ connected: false }
```

### 2.2 `api/auth/logout.ts` — POST `/api/auth/logout`

**Called by**: `App.tsx:343`

Clears cookies: `access_token`, `refresh_token`, `pkce_verifier`, `oauth_state`. Returns `{ success: true }`.

### 2.3 `api/data/wellness.ts` — GET `/api/data/wellness?athleteId=<id>&oldest=<date>&newest=<date>`

**Called by**: `App.tsx:152`

Proxy to `https://intervals.icu/api/v1/athlete/{id}/wellness?oldest=X&newest=Y`. Uses `validateAthleteId()`.

### 2.4 `api/data/power-curves.ts` — GET `/api/data/power-curves?athleteId=<id>&type=<sport>`

**Called by**: `App.tsx:153`

Proxy to `https://intervals.icu/api/v1/athlete/{id}/power-curves?type=X`. Validates `athleteId` and `type` (must be a valid `SportType`).

### 2.5 `api/data/events.ts` — GET `/api/data/events?athleteId=<id>&oldest=<date>&newest=<date>`

**Called by**: `App.tsx:154`

Proxy to `https://intervals.icu/api/v1/athlete/{id}/events?oldest=X&newest=Y`. Validates `athleteId`.

### 2.6 `api/assistant/config.ts` — GET `/api/assistant/config`

**Called by**: `HealthAssistant.tsx:99`

Checks if OpenCode env vars are configured (`OPENCODE_SERVER_URL`, etc). Returns:
```ts
{ available: true, model: '...', version: '1.0.0' }
// or
{ available: false, error: 'OPENCODE_SERVER_URL not configured' }
```

### 2.7 Shared Proxy Helper

Create `api/lib/proxy.ts` to extract common logic:
1. Extract `access_token` from cookie
2. If missing, return 401
3. Validate query params with `validateAthleteId()`
4. Proxy to Intervals.icu with Bearer token
5. Return JSON or error

All 3 data endpoints (wellness, power-curves, events) use this helper.

---

## 3. Remove Dead Views + `@ts-nocheck`

### 3.1 Remove from `Views.tsx` (~500 lines)

Delete completely:
- `HealthView` (lines 637-735) — uses non-existent `data.health.*`
- `SleepView` (lines 736-839) — uses non-existent `data.sleep.*`
- `BodyView` (lines 840-924) — uses non-existent `data.body.*`
- `DevicesView` (lines 925-975) — uses non-existent `data.device.*`

Also remove:
- Imports of `hasHealthData`, `hasSleepData`, `hasBodyData` (don't exist in `data-availability.ts`)
- References to `analysis.steps`, `analysis.sleepGoalDifference`, `analysis.stepsGoalProgress` in `TodayView`
- Navigations to `'sleep'`, `'health'`, `'body'` in `TodayView` (lines 429, 430, 461, 472, 537)
- Cards/tiles in `TodayView` linking to those non-existent pages

### 3.2 Remove `@ts-nocheck`

After cleanup, remove `@ts-nocheck` from:
- `Views.tsx` — fix remaining type errors (property name mismatches)
- `Charts.tsx` (552 lines) — properly type props and state
- `HealthAssistant.tsx` (272 lines) — properly type props and events

### 3.3 Fix Property Mismatches in Views.tsx

Correct property names to match `types.ts`:
- `point.restingHeartRate` → `point.restingHR`
- `point.hrvMs` → `point.hrv`
- `point.spo2` → `point.spO2`
- `item.date` → `item.startDate`
- `item.durationMinutes` → calculate from `item.movingTime`
- `item.distanceKm` → `item.distance`
- `item.averageHeartRate` → `item.avgHeartRate`
- `status.provider` / `status.storageEncrypted` → remove (don't exist in `AuthStatus`)

### 3.4 Fix `CompactActivity` Component

Update to use correct `ActivityItem` properties:
- `item.time` → extract from `item.startDate`
- `item.averagePaceSecondsPerMeter` → calculate from `item.movingTime / item.distance`
- `item.heartZoneMinutes` → `item.hrZoneTimes`
- `item.steps` → remove (doesn't exist for cycling/triathlon)

---

## 4. Integrate Dead Code

### 4.1 Integrate `normalize.ts` into `App.tsx`

**Problem**: `App.tsx:149-304` has ~170 lines of inline normalization duplicating `normalizeIntervalsIcuData()`.

**Fix**: Refactor `syncData()` in `App.tsx` to:
1. Make 5 fetches (athlete, activities, wellness, power-curves, events)
2. Build an `IntervalsIcuPayload` with raw responses
3. Call `normalizeIntervalsIcuData(payload)` to get `DashboardData`
4. Merge with demo data if any fetch fails

This eliminates ~150 lines of duplication and uses tested code.

### 4.2 Integrate `IntervalsIcuClient` into Serverless Functions

**Problem**: `api/data/*.ts` make direct `fetch()` calls with duplicated logic (cookie extraction, error handling, URL building).

**Fix**:
1. Move `src/lib/intervals-icu.ts` to `api/lib/intervals-icu.ts` (server-side code)
2. Refactor 5 data endpoints to use `IntervalsIcuClient`:
```ts
const client = new IntervalsIcuClient(accessToken);
const data = await client.getActivities(athleteId, oldest, newest);
```
3. The `api/lib/proxy.ts` helper (from section 2) can instantiate the client internally

**Note**: `api/assistant/chat.ts` imports from `src/lib/opencode-client.ts`. Move this file to `api/lib/opencode-client.ts` as well, keeping all server-side code together.

### 4.3 Adjust `normalize.ts` if Needed

Verify that `IntervalsIcuPayload` interface covers all fields returned by endpoints. Add missing fields if necessary (power-curves, events).

---

## 5. Important Fixes

### 5.1 Token Refresh Mechanism

**Problem**: `api/auth/callback.ts:49-54` stores `access_token` and `refresh_token` in cookies, but no endpoint uses the refresh token when the access token expires. Users silently lose connectivity after token TTL.

**Fix**: Add middleware or wrapper that checks token expiry and calls the Intervals.icu token refresh endpoint. Implement in `api/lib/proxy.ts` so all data endpoints benefit automatically.

### 5.2 Fix `api/assistant/chat.ts` Import

**Problem**: `api/assistant/chat.ts:2` imports `../../src/lib/opencode-client`. Serverless functions importing from `src/` creates build-time coupling that may break with Vercel's function bundler and violates client/server boundary.

**Fix**: Move `opencode-client.ts` to `api/lib/opencode-client.ts` (covered in section 4.2).

### 5.3 Deduplicate Activity Mapping in `syncData`

**Problem**: `App.tsx:189-217` and `App.tsx:257-285` contain identical activity mapping logic (~30 lines copy-pasted for `todayActivities` and `activities`).

**Fix**: Extract a `mapActivity(raw: any): ActivityItem` helper. This will be naturally resolved when integrating `normalize.ts` (section 4.1).

---

## 6. Minor Fixes

### 6.1 Hardcoded Portuguese String

**File**: `src/lib/format.ts:50`

**Problem**: `if (!value) return 'Mai'` — should be `'Never'` or similar English fallback.

**Fix**: Change to `'Never'`.

### 6.2 `vercel.json` Uses Legacy `builds` API

**File**: `vercel.json:3-11`

**Problem**: Uses deprecated `builds` array. Vercel recommends zero-config approach or `functions` configuration.

**Fix**: Remove `builds` array and use modern Vercel configuration:
```json
{
  "functions": {
    "api/**/*.ts": {
      "runtime": "@vercel/node@3.0.0"
    }
  }
}
```

### 6.3 `.env.example` References Unused Variables

**Problem**: `VERCEL_KV_ENCRYPTION_KEY`, `VERCEL_KV_REST_API_URL`, `VERCEL_KV_REST_API_TOKEN` are defined in `.env.example` but never referenced in code.

**Fix**: Remove unused variables from `.env.example` or add a comment marking them as optional/future.

### 6.4 `home-analysis.ts` Return Shape Mismatch

**Problem**: `TodayView` accesses `analysis.steps`, `analysis.stepsGoalProgress`, `analysis.sleepGoalDifference`, `analysis.sleep` — none exist in `analyzeHome()` return type.

**Fix**: This will be resolved when removing dead views (section 3.1). The `TodayView` references will be cleaned up along with the dead view components.

### 6.5 Missing `.env` in `.gitignore`

**Problem**: `.gitignore` does not include `.env` or `.env.local`, risking accidental commit of secrets.

**Fix**: Already covered in section 1.1.

---

## Success Criteria

- [ ] All 6 missing API endpoints implemented and functional
- [ ] `@ts-nocheck` removed from all 3 files
- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run test` passes (all 14 existing tests + new tests for validation/proxy helpers)
- [ ] `npm run build` succeeds
- [ ] No path traversal vulnerabilities in API endpoints
- [ ] `.env` patterns in `.gitignore`
- [ ] Dead views removed, no runtime crashes from missing properties
- [ ] `normalize.ts` and `intervals-icu.ts` integrated and used in production
- [ ] Token refresh mechanism implemented

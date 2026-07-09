# OpenFit ICU — Critical Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 Critical, 5 Important, and 5 Minor issues from code review to make OpenFit ICU production-ready.

**Architecture:** Security-first approach: security fixes → missing API endpoints → dead code cleanup → type safety → integration → polish. Server-side code moves to `api/lib/`, client-side stays in `src/`.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vercel Serverless Functions (`@vercel/node`), Vitest 4

## Global Constraints

- Node.js >= 22, npm >= 10
- All API endpoints validate input before use (no path traversal)
- No `@ts-nocheck` in any file
- `npm run typecheck` must pass with zero errors
- `npm run test` must pass (existing + new tests)
- `npm run build` must succeed
- Server-side code lives in `api/`, client-side code lives in `src/`
- All new serverless functions follow the pattern: method check → auth check → validate → proxy → respond

---

### Task 1: Security — `.gitignore` and Input Validation

**Files:**
- Modify: `.gitignore`
- Create: `api/lib/validation.ts`
- Create: `api/lib/validation.test.ts`
- Modify: `api/data/activities.ts`
- Modify: `api/data/athlete.ts`

**Interfaces:**
- Produces: `validateAthleteId(id: string | string[] | undefined): string` — throws on invalid input
- Produces: `validateDateParam(value: string | string[] | undefined, name: string): string` — validates ISO date format

- [ ] **Step 1: Write failing tests for validation helpers**

Create `api/lib/validation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { validateAthleteId, validateDateParam } from './validation'

describe('validateAthleteId', () => {
  it('accepts numeric string', () => {
    expect(validateAthleteId('12345')).toBe('12345')
  })

  it('accepts i-prefixed ID', () => {
    expect(validateAthleteId('i12345')).toBe('i12345')
  })

  it('defaults to "0" for undefined', () => {
    expect(validateAthleteId(undefined)).toBe('0')
  })

  it('takes first element from array', () => {
    expect(validateAthleteId(['i99', 'i100'])).toBe('i99')
  })

  it('rejects path traversal', () => {
    expect(() => validateAthleteId('../../admin')).toThrow('Invalid athlete ID')
  })

  it('rejects empty string with special chars', () => {
    expect(() => validateAthleteId('foo;bar')).toThrow('Invalid athlete ID')
  })
})

describe('validateDateParam', () => {
  it('accepts ISO date', () => {
    expect(validateDateParam('2026-07-08', 'oldest')).toBe('2026-07-08')
  })

  it('rejects non-date string', () => {
    expect(() => validateDateParam('not-a-date', 'oldest')).toThrow('Invalid oldest parameter')
  })

  it('returns empty string for undefined optional param', () => {
    expect(validateDateParam(undefined, 'newest')).toBe('')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run api/lib/validation.test.ts`
Expected: FAIL — module `./validation` not found

- [ ] **Step 3: Create validation module**

Create `api/lib/validation.ts`:

```ts
export function validateAthleteId(id: string | string[] | undefined): string {
  const raw = Array.isArray(id) ? id[0] : id || '0'
  if (!/^i?\d+$/.test(raw)) {
    throw new Error('Invalid athlete ID')
  }
  return raw
}

export function validateDateParam(value: string | string[] | undefined, name: string): string {
  if (value === undefined || value === null) return ''
  const raw = Array.isArray(value) ? value[0] : value
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(`Invalid ${name} parameter`)
  }
  return raw
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run api/lib/validation.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 5: Add `.env` patterns to `.gitignore`**

Append to `.gitignore`:

```
.env
.env.local
.env.*.local
```

- [ ] **Step 6: Apply validation to existing endpoints**

In `api/data/activities.ts`, replace line 9:

```ts
const athleteId = req.query.athleteId || '0'
```

with:

```ts
import { validateAthleteId, validateDateParam } from '../lib/validation'

let athleteId: string
let oldest: string
let newest: string
try {
  athleteId = validateAthleteId(req.query.athleteId)
  oldest = validateDateParam(req.query.oldest, 'oldest')
  newest = validateDateParam(req.query.newest, 'newest')
} catch (error) {
  return res.status(400).json({ error: (error as Error).message })
}
```

Remove the old `const oldest = req.query.oldest as string` (line 10), `const newest = req.query.newest as string` (line 11), and the `if (!oldest)` block (lines 18-20). Add a check after validation:

```ts
if (!oldest) {
  return res.status(400).json({ error: 'Missing required parameter: oldest' })
}
```

In `api/data/athlete.ts`, replace line 9:

```ts
const athleteId = req.query.id || '0'
```

with:

```ts
import { validateAthleteId } from '../lib/validation'

let athleteId: string
try {
  athleteId = validateAthleteId(req.query.id)
} catch (error) {
  return res.status(400).json({ error: (error as Error).message })
}
```

- [ ] **Step 7: Run all tests and typecheck**

Run: `npm run typecheck && npx vitest run`
Expected: All tests pass, zero type errors

- [ ] **Step 8: Commit**

```bash
git add .gitignore api/lib/validation.ts api/lib/validation.test.ts api/data/activities.ts api/data/athlete.ts
git commit -m "fix: add .env to .gitignore, validate athleteId in API endpoints"
```

---

### Task 2: API Proxy Helper

**Files:**
- Create: `api/lib/proxy.ts`
- Create: `api/lib/proxy.test.ts`

**Interfaces:**
- Consumes: `validateAthleteId`, `validateDateParam` from `./validation`
- Produces: `getAccessToken(req: VercelRequest): string | null`
- Produces: `proxyToIntervalsIcu(accessToken: string, path: string): Promise<Response>`

- [ ] **Step 1: Write failing tests for proxy helpers**

Create `api/lib/proxy.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getAccessToken } from './proxy'

describe('getAccessToken', () => {
  it('returns token from cookies', () => {
    const req = { cookies: { access_token: 'abc123' } } as any
    expect(getAccessToken(req)).toBe('abc123')
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

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run api/lib/proxy.test.ts`
Expected: FAIL — module `./proxy` not found

- [ ] **Step 3: Create proxy module**

Create `api/lib/proxy.ts`:

```ts
import type { VercelRequest } from '@vercel/node'

const INTERVALS_ICU_BASE = 'https://intervals.icu/api/v1'

export function getAccessToken(req: VercelRequest): string | null {
  return req.cookies?.access_token ?? null
}

export async function proxyToIntervalsIcu(accessToken: string, path: string): Promise<Response> {
  return fetch(`${INTERVALS_ICU_BASE}${path}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run api/lib/proxy.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add api/lib/proxy.ts api/lib/proxy.test.ts
git commit -m "feat: add shared proxy helper for Intervals.icu API"
```

---

### Task 3: Six Missing API Endpoints

**Files:**
- Create: `api/auth/status.ts`
- Create: `api/auth/logout.ts`
- Create: `api/data/wellness.ts`
- Create: `api/data/power-curves.ts`
- Create: `api/data/events.ts`
- Create: `api/assistant/config.ts`

**Interfaces:**
- Consumes: `getAccessToken`, `proxyToIntervalsIcu` from `../lib/proxy`
- Consumes: `validateAthleteId`, `validateDateParam` from `../lib/validation`

- [ ] **Step 1: Create `api/auth/status.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAccessToken, proxyToIntervalsIcu } from '../lib/proxy'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const accessToken = getAccessToken(req)
  if (!accessToken) {
    return res.status(200).json({ connected: false })
  }

  try {
    const response = await proxyToIntervalsIcu(accessToken, '/athlete')
    if (!response.ok) {
      return res.status(200).json({ connected: false })
    }

    const athlete = await response.json()
    return res.status(200).json({
      connected: true,
      method: 'oauth',
      athleteId: String(athlete.id ?? ''),
      athleteName: `${athlete.firstname ?? ''} ${athlete.lastname ?? ''}`.trim() || null,
      lastSyncAt: new Date().toISOString(),
    })
  } catch {
    return res.status(200).json({ connected: false })
  }
}
```

- [ ] **Step 2: Create `api/auth/logout.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'

const COOKIE_OPTIONS = 'HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  res.setHeader('Set-Cookie', [
    `access_token=; ${COOKIE_OPTIONS}`,
    `refresh_token=; ${COOKIE_OPTIONS}`,
    `pkce_verifier=; ${COOKIE_OPTIONS}`,
    `oauth_state=; ${COOKIE_OPTIONS}`,
  ])

  return res.status(200).json({ success: true })
}
```

- [ ] **Step 3: Create `api/data/wellness.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAccessToken, proxyToIntervalsIcu } from '../lib/proxy'
import { validateAthleteId, validateDateParam } from '../lib/validation'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const accessToken = getAccessToken(req)
  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  let athleteId: string
  let oldest: string
  let newest: string
  try {
    athleteId = validateAthleteId(req.query.athleteId)
    oldest = validateDateParam(req.query.oldest, 'oldest')
    newest = validateDateParam(req.query.newest, 'newest')
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message })
  }

  if (!oldest) {
    return res.status(400).json({ error: 'Missing required parameter: oldest' })
  }

  try {
    const params = new URLSearchParams({ oldest })
    if (newest) params.append('newest', newest)

    const response = await proxyToIntervalsIcu(
      accessToken,
      `/athlete/${athleteId}/wellness?${params}`
    )

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch wellness' })
    }

    const wellness = await response.json()
    return res.status(200).json(wellness)
  } catch {
    return res.status(500).json({ error: 'Internal server error' })
  }
}
```

- [ ] **Step 4: Create `api/data/power-curves.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAccessToken, proxyToIntervalsIcu } from '../lib/proxy'
import { validateAthleteId } from '../lib/validation'

const VALID_SPORT_TYPES = new Set([
  'Ride', 'Run', 'Swim', 'Walk', 'Hike', 'WeightTraining',
  'VirtualRide', 'VirtualRun', 'TrailRun', 'GravelRide', 'MountainBikeRide',
])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const accessToken = getAccessToken(req)
  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  let athleteId: string
  try {
    athleteId = validateAthleteId(req.query.athleteId)
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message })
  }

  const type = Array.isArray(req.query.type) ? req.query.type[0] : req.query.type || 'Ride'
  if (!VALID_SPORT_TYPES.has(type)) {
    return res.status(400).json({ error: `Invalid sport type: ${type}` })
  }

  try {
    const params = new URLSearchParams({ type })
    const response = await proxyToIntervalsIcu(
      accessToken,
      `/athlete/${athleteId}/power-curves?${params}`
    )

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch power curves' })
    }

    const curves = await response.json()
    return res.status(200).json(curves)
  } catch {
    return res.status(500).json({ error: 'Internal server error' })
  }
}
```

- [ ] **Step 5: Create `api/data/events.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAccessToken, proxyToIntervalsIcu } from '../lib/proxy'
import { validateAthleteId, validateDateParam } from '../lib/validation'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const accessToken = getAccessToken(req)
  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  let athleteId: string
  let oldest: string
  let newest: string
  try {
    athleteId = validateAthleteId(req.query.athleteId)
    oldest = validateDateParam(req.query.oldest, 'oldest')
    newest = validateDateParam(req.query.newest, 'newest')
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message })
  }

  if (!oldest) {
    return res.status(400).json({ error: 'Missing required parameter: oldest' })
  }

  try {
    const params = new URLSearchParams({ oldest })
    if (newest) params.append('newest', newest)

    const response = await proxyToIntervalsIcu(
      accessToken,
      `/athlete/${athleteId}/events?${params}`
    )

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch events' })
    }

    const events = await response.json()
    return res.status(200).json(events)
  } catch {
    return res.status(500).json({ error: 'Internal server error' })
  }
}
```

- [ ] **Step 6: Create `api/assistant/config.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const serverUrl = process.env.OPENCODE_SERVER_URL
  const username = process.env.OPENCODE_SERVER_USERNAME
  const password = process.env.OPENCODE_SERVER_PASSWORD

  if (!serverUrl) {
    return res.status(200).json({
      available: false,
      serverConfigured: false,
      error: 'OPENCODE_SERVER_URL not configured',
    })
  }

  return res.status(200).json({
    available: true,
    serverConfigured: Boolean(serverUrl && username && password),
    model: process.env.OPENCODE_ZEN_MODEL || 'default',
  })
}
```

- [ ] **Step 7: Refactor existing endpoints to use proxy helper**

In `api/data/activities.ts`, replace the manual fetch block (lines 22-41) with:

```ts
import { getAccessToken, proxyToIntervalsIcu } from '../lib/proxy'
import { validateAthleteId, validateDateParam } from '../lib/validation'
```

Replace `const accessToken = req.cookies?.access_token` (line 8) with:

```ts
const accessToken = getAccessToken(req)
```

Replace the try block (lines 22-41) with:

```ts
  try {
    const params = new URLSearchParams({ oldest })
    if (newest) params.append('newest', newest)
    if (limit) params.append('limit', limit)

    const response = await proxyToIntervalsIcu(
      accessToken,
      `/athlete/${athleteId}/activities?${params}`
    )

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch activities' })
    }

    const activities = await response.json()
    return res.status(200).json(activities)
  } catch {
    return res.status(500).json({ error: 'Internal server error' })
  }
```

In `api/data/athlete.ts`, apply the same pattern:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAccessToken, proxyToIntervalsIcu } from '../lib/proxy'
import { validateAthleteId } from '../lib/validation'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const accessToken = getAccessToken(req)
  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  let athleteId: string
  try {
    athleteId = validateAthleteId(req.query.id)
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message })
  }

  try {
    const response = await proxyToIntervalsIcu(accessToken, `/athlete/${athleteId}`)

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch athlete' })
    }

    const athlete = await response.json()
    return res.status(200).json(athlete)
  } catch {
    return res.status(500).json({ error: 'Internal server error' })
  }
}
```

- [ ] **Step 8: Run typecheck and tests**

Run: `npm run typecheck && npx vitest run`
Expected: All tests pass, zero type errors

- [ ] **Step 9: Commit**

```bash
git add api/
git commit -m "feat: add 6 missing API endpoints (auth/status, auth/logout, data/wellness, data/power-curves, data/events, assistant/config)"
```

---

### Task 4: Remove Dead Views from Views.tsx

**Files:**
- Modify: `src/components/Views.tsx`

- [ ] **Step 1: Delete `HealthView` component (lines 637-734)**

Remove the entire `export function HealthView` block and all its content.

- [ ] **Step 2: Delete `SleepView` component (lines 736-829)**

Remove the entire `export function SleepView` block.

- [ ] **Step 3: Delete `BodyView` component and `BodyMetric` helper (lines 831-913)**

Remove `BodyMetric` function and `export function BodyView` block.

- [ ] **Step 4: Delete `DevicesView` component and `CoverageRow` helper (lines 915-1007)**

Remove `CoverageRow` function and `export function DevicesView` block.

- [ ] **Step 5: Delete `SleepStageBar` and `SleepStageTimeline` from Charts.tsx**

These are only used by the dead sleep views. In `src/components/Charts.tsx`, remove:
- `SleepStageBar` function (lines 463-500)
- `sleepTimelineConfig` constant (lines 502-507)
- `SleepStageTimeline` function (lines 509-575)

Also remove the `SleepStage` and `SleepStageSegment` type references if they exist.

- [ ] **Step 6: Remove dead imports from Views.tsx**

Remove these imports that are only used by dead views:

```ts
import {
  ActiveIcon,
  BatteryIcon,
  BreathingIcon,
  CaloriesIcon,
  DistanceIcon,
  DurationIcon,
  FloorsIcon,
  InfoIcon,
  NutritionIcon,
  ShieldIcon,
  SignalIcon,
  SleepIcon,
  WaterIcon,
} from './icons'
```

Keep only the icons still used by remaining views (check `TodayView`, `ActivityView`, `FitnessView`, `PowerView`, `WellnessView`, `CalendarView`, `DataSourcesView`).

Remove these imports:

```ts
import { hasBodyData, hasHealthData, hasSleepData } from '@/lib/data-availability'
```

Keep `hasActivityData` and `availableMetricCount`.

Remove `BulletChart` and `SleepStageBar` from Charts import if no longer used.

- [ ] **Step 7: Remove dead helper functions from Views.tsx**

Remove these functions only used by dead views:
- `overnightSignals` (lines 116-143)
- `sleepScoreCategory` (lines 218-223)
- `SignalRow` (lines 86-95)
- `SupportingMetrics` (lines 97-110)

Keep `Signal` and `SupportingMetric` interfaces only if used by remaining views.

- [ ] **Step 8: Run typecheck**

Run: `npm run typecheck`
Expected: May have errors from `@ts-nocheck` being present — that's OK for now, we'll remove it in Task 6.

- [ ] **Step 9: Commit**

```bash
git add src/components/Views.tsx src/components/Charts.tsx
git commit -m "refactor: remove dead views (HealthView, SleepView, BodyView, DevicesView) and unused chart components"
```

---

### Task 5: Fix TodayView and CompactActivity

**Files:**
- Modify: `src/components/Views.tsx`

**Interfaces:**
- `CompactActivity` must use `ActivityItem` properties from `types.ts`
- `TodayView` must only reference properties that exist on `DashboardData`

- [ ] **Step 1: Fix `CompactActivity` component**

Replace the `CompactActivity` function (around line 151) with:

```tsx
function CompactActivity({ item, detailed = false }: { item: ActivityItem; detailed?: boolean }) {
  const durationMin = item.movingTime > 0 ? Math.round(item.movingTime / 60) : null
  const pace = item.distance && item.movingTime > 0
    ? formatPace(item.movingTime / (item.distance * 1000))
    : null
  return (
    <div className={`activity-row ${detailed ? 'is-detailed' : ''}`}>
      <DuoIcon icon={ActivityIcon} className="activity-icon" />
      <div className="activity-copy">
        <strong>{item.name}</strong>
        <span>{formatDate(item.startDate, { day: 'numeric', month: 'short' })}</span>
      </div>
      <div className="activity-meta">
        {durationMin !== null && durationMin > 0 && <span>{durationMin} min</span>}
        {item.distance !== null && <span>{formatDecimal(item.distance)} km</span>}
        {item.avgHeartRate !== null && <span>{formatNumber(item.avgHeartRate)} bpm</span>}
        {detailed && item.calories !== null && <span>{formatNumber(item.calories)} kcal</span>}
      </div>
      {detailed && (pace || (item.hrZoneTimes !== null && item.hrZoneTimes.length > 0)) && (
        <div className="activity-detail-row">
          {pace && <span><strong>{pace}</strong> average pace</span>}
          {item.hrZoneTimes !== null && item.hrZoneTimes.map((minutes, zoneIndex) =>
            minutes > 0 ? <span key={zoneIndex}>Z{zoneIndex + 1} {formatNumber(Math.round(minutes))} min</span> : null
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `TodayView` to use Intervals.icu data model**

Replace the `TodayView` function with a version that only uses `DashboardData` properties:

```tsx
export function TodayView({ data, navigate }: ViewProps) {
  const analysis = analyzeHome(data)
  const w = data.wellness
  const hasWellness = w.hrv !== null || w.restingHR !== null || w.sleepMinutes !== null
  const hasActivities = data.activities.length > 0
  const todayLoad = data.activity.todayLoad

  return (
    <div className="page-stack today-page">
      {!hasWellness && !hasActivities && todayLoad === null && (
        <Panel className="first-sync-state">
          <CloudIcon aria-hidden="true" />
          <h2>No measurements for this day</h2>
          <p>The connection is working. Try another date or refresh your data.</p>
        </Panel>
      )}

      {(hasWellness || hasActivities) && (
        <div className="home-dashboard">
          <HomeSection id="overview" title="Overview">
            <div className="daily-summary-grid">
              <DailySummaryMetric
                category="activity"
                icon={ActivityIcon}
                label="Training load"
                value={todayLoad !== null ? formatDecimal(todayLoad) : '—'}
                note={todayLoad !== null ? 'Today' : 'No activities'}
                onClick={() => navigate('activity')}
              />
              <DailySummaryMetric
                category="recovery"
                icon={HeartIcon}
                label="HRV"
                value={w.hrv !== null ? `${formatNumber(w.hrv)} ms` : '—'}
                note={w.hrv !== null ? baselineNote(analysis.hrv, 'ms') : 'Unavailable'}
                onClick={() => navigate('wellness')}
              />
              <DailySummaryMetric
                category="sleep"
                icon={StepsIcon}
                label="Fitness (CTL)"
                value={data.fitness.ctl !== null ? formatDecimal(data.fitness.ctl, 1) : '—'}
                note={data.fitness.ctl !== null ? baselineNote(analysis.ctl, '') : 'Unavailable'}
                onClick={() => navigate('fitness')}
              />
            </div>
          </HomeSection>

          <HomeSection id="wellness-snapshot" title="Wellness snapshot">
            <div className="home-core-grid">
              <Panel className="home-wellness-card" category="wellness">
                <PanelHeader title="Daily wellness" icon={HeartIcon} action={<ChevronRightIcon aria-hidden="true" />} />
                <div className="wellness-snapshot-grid">
                  {w.restingHR !== null && <VitalSnapshot label="Resting HR" value={`${formatNumber(w.restingHR)} bpm`} />}
                  {w.sleepMinutes !== null && <VitalSnapshot label="Sleep" value={compactMinutes(w.sleepMinutes)} />}
                  {w.sleepScore !== null && <VitalSnapshot label="Sleep score" value={`${formatNumber(w.sleepScore)}`} />}
                  {w.readiness !== null && <VitalSnapshot label="Readiness" value={`${formatNumber(w.readiness)}`} />}
                  {w.mood !== null && <VitalSnapshot label="Mood" value={`${w.mood}/5`} />}
                  {w.stress !== null && <VitalSnapshot label="Stress" value={`${w.stress}/5`} />}
                  {w.fatigue !== null && <VitalSnapshot label="Fatigue" value={`${w.fatigue}/5`} />}
                  {w.motivation !== null && <VitalSnapshot label="Motivation" value={`${w.motivation}/5`} />}
                  {w.spO2 !== null && <VitalSnapshot label="SpO₂" value={`${formatDecimal(w.spO2)}%`} />}
                  {w.weight !== null && <VitalSnapshot label="Weight" value={`${formatDecimal(w.weight)} kg`} />}
                </div>
              </Panel>

              {data.fitness.ctl !== null && (
                <Panel className="home-fitness-card" category="fitness">
                  <PanelHeader title="Fitness status" icon={StepsIcon} action={<ChevronRightIcon aria-hidden="true" />} />
                  <div className="fitness-kpis">
                    <TinyStat label="CTL" value={formatDecimal(data.fitness.ctl, 1)} />
                    <TinyStat label="ATL" value={data.fitness.atl !== null ? formatDecimal(data.fitness.atl, 1) : '—'} />
                    <TinyStat label="TSB" value={data.fitness.tsb !== null ? formatDecimal(data.fitness.tsb, 1) : '—'} />
                  </div>
                </Panel>
              )}
            </div>
          </HomeSection>

          {hasActivities && (
            <HomeSection id="activities" title="Recent activities">
              <Panel className="home-activities-card activity-panel" category="activity">
                <PanelHeader
                  title="Activities"
                  icon={ActivityIcon}
                  action={<DetailAction label="Open all activities" onClick={() => navigate('activity')} />}
                />
                {data.activities.slice(0, 3).map((item, index) => (
                  <div key={item.id}>
                    {index > 0 && <Separator />}
                    <CompactActivity item={item} />
                  </div>
                ))}
              </Panel>
            </HomeSection>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Remove unused imports and helpers from Views.tsx**

Remove these imports no longer used by TodayView:
- `BodyIcon`, `SleepIcon` from `./icons` (if not used by other remaining views)
- `hasHealthData`, `hasSleepData`, `hasBodyData` from `data-availability` (already removed in Task 4)

Remove these helpers no longer used:
- `hourlyBuckets` function (only used by TodayView's stepsIntraday)
- `timeXValues` function (only used by HealthView)
- `HomeCategory` type and `trendColors` record (if not used by remaining views)
- `MetricTrendPanel` function (if not used by remaining views)
- `DailySummaryMetric` function — keep, it's used by the new TodayView
- `TrendStats` function — remove if not used
- `VitalSnapshot` function — keep, used by new TodayView

Check remaining views (`ActivityView`, `FitnessView`, `PowerView`, `WellnessView`, `CalendarView`, `DataSourcesView`) for any remaining references to removed items.

- [ ] **Step 4: Fix `ActivityView` to remove references to non-existent properties**

In `ActivityView`, remove references to:
- `data.activity.stepsIntraday` → remove steps-per-hour chart
- `data.activity.steps`, `data.activity.stepsGoal` → remove from MetricTile
- `data.activity.activeMinutes`, `data.activity.activeMinutesGoal` → remove
- `data.activity.distanceKm`, `data.activity.distanceGoalKm` → remove
- `data.activity.calories`, `data.activity.caloriesGoal` → remove
- `data.activity.floors`, `data.activity.lightActiveMinutes`, etc. → remove from supporting metrics
- Trend values: `point.calories`, `point.distanceKm`, `point.activeMinutes`, `point.zoneMinutes`, `point.sedentaryMinutes`, `point.floors` → remove activity trends section

Replace `ActivityView` with a version focused on Intervals.icu training data:

```tsx
export function ActivityView({ data }: ViewProps) {
  const activities = data.activities
  const todayActivities = data.activity.todayActivities
  const todayLoad = data.activity.todayLoad
  const weekLoad = data.activity.weekLoad

  return (
    <div className="page-stack activity-page">
      <div className="metric-grid activity-primary-metrics">
        <MetricTile label="Today's load" value={todayLoad} icon={ActivityIcon} decimals={1} />
        <MetricTile label="Week load" value={weekLoad} icon={GaugeIcon} decimals={1} />
        <MetricTile label="Activities today" value={todayActivities.length} icon={StepsIcon} />
        <MetricTile
          label="Avg intensity"
          value={data.activity.avgIntensity}
          icon={HeartIcon}
          decimals={2}
        />
      </div>

      {todayActivities.length > 0 && (
        <section>
          <SectionTitle title="Today's activities" copy={`${todayActivities.length} activities`} />
          <Panel className="activity-panel" category="activity">
            {todayActivities.map((item, index) => (
              <div key={item.id}>
                {index > 0 && <Separator />}
                <CompactActivity item={item} detailed />
              </div>
            ))}
          </Panel>
        </section>
      )}

      {activities.length > 0 && activities !== todayActivities && (
        <section>
          <SectionTitle title="All activities" copy={`${activities.length} activities in range`} />
          <Panel className="activity-panel full-list" category="activity">
            {activities.map((item, index) => (
              <div key={item.id}>
                {index > 0 && <Separator />}
                <CompactActivity item={item} detailed />
              </div>
            ))}
          </Panel>
        </section>
      )}

      {!hasActivityData(data) && <EmptyValue>No activity data available for this day.</EmptyValue>}
    </div>
  )
}
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: Errors may remain from `@ts-nocheck` — will be fixed in Task 6.

- [ ] **Step 6: Commit**

```bash
git add src/components/Views.tsx
git commit -m "refactor: rewrite TodayView, ActivityView, CompactActivity to use Intervals.icu data model"
```

---

### Task 6: Remove `@ts-nocheck` and Fix Type Errors

**Files:**
- Modify: `src/components/Views.tsx`
- Modify: `src/components/Charts.tsx`
- Modify: `src/components/HealthAssistant.tsx`

- [ ] **Step 1: Remove `@ts-nocheck` from Views.tsx**

Delete line 1: `// @ts-nocheck`

- [ ] **Step 2: Run typecheck and fix errors in Views.tsx**

Run: `npm run typecheck 2>&1 | Select-String "Views.tsx"`

Fix each error by:
- Removing references to non-existent properties
- Adding proper type annotations
- Using optional chaining where needed

Common fixes:
- Any remaining `data.health.*` → remove
- Any remaining `data.sleep.*` → remove
- Any remaining `data.body.*` → remove
- Any remaining `data.device.*` → remove
- `status.provider` → remove
- `status.storageEncrypted` → remove

- [ ] **Step 3: Remove `@ts-nocheck` from Charts.tsx**

Delete line 1: `// @ts-nocheck`

- [ ] **Step 4: Run typecheck and fix errors in Charts.tsx**

Run: `npm run typecheck 2>&1 | Select-String "Charts.tsx"`

The `Charts.tsx` file already has good inline types (`BaseChartProps`, etc.). The main issue is the `SleepStage` and `SleepStageSegment` types that were referenced but never defined. Since we removed `SleepStageBar` and `SleepStageTimeline` in Task 4, these types should no longer be referenced.

Also check:
- `formatTime` import — add if missing (used by sleep timeline, which was removed)
- Remove unused imports

- [ ] **Step 5: Remove `@ts-nocheck` from HealthAssistant.tsx**

Delete line 1: `// @ts-nocheck`

- [ ] **Step 6: Run typecheck and fix errors in HealthAssistant.tsx**

Run: `npm run typecheck 2>&1 | Select-String "HealthAssistant.tsx"`

The file already has good types. Fix any remaining issues:
- Ensure `ChatModelAdapter` type is correctly used
- Ensure `ThreadMessage` type is correctly imported
- Fix any implicit `any` types

- [ ] **Step 7: Run full typecheck**

Run: `npm run typecheck`
Expected: Zero errors

- [ ] **Step 8: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 9: Commit**

```bash
git add src/components/Views.tsx src/components/Charts.tsx src/components/HealthAssistant.tsx
git commit -m "fix: remove @ts-nocheck from Views, Charts, HealthAssistant — fix all type errors"
```

---

### Task 7: Move Server-Side Code to `api/lib/`

**Files:**
- Move: `src/lib/intervals-icu.ts` → `api/lib/intervals-icu.ts`
- Move: `src/lib/opencode-client.ts` → `api/lib/opencode-client.ts`
- Modify: `api/assistant/chat.ts` (update import path)

- [ ] **Step 1: Move `intervals-icu.ts` to `api/lib/`**

```bash
git mv src/lib/intervals-icu.ts api/lib/intervals-icu.ts
```

- [ ] **Step 2: Move `opencode-client.ts` to `api/lib/`**

```bash
git mv src/lib/opencode-client.ts api/lib/opencode-client.ts
```

- [ ] **Step 3: Update import in `api/assistant/chat.ts`**

Change line 2 from:

```ts
import { OpenCodeClient, type HealthContext } from '../../src/lib/opencode-client'
```

to:

```ts
import { OpenCodeClient, type HealthContext } from '../lib/opencode-client'
```

- [ ] **Step 4: Verify no other files import from the old paths**

Run: `grep -r "intervals-icu" src/ --include="*.ts" --include="*.tsx"`
Run: `grep -r "opencode-client" src/ --include="*.ts" --include="*.tsx"`

If any imports remain in `src/`, they need to be removed or the code needs to be refactored (the types should be accessed through the API, not imported directly).

- [ ] **Step 5: Run typecheck and tests**

Run: `npm run typecheck && npx vitest run`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: move server-side code (intervals-icu.ts, opencode-client.ts) to api/lib/"
```

---

### Task 8: Integrate `normalize.ts` into `App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `normalizeIntervalsIcuData`, `IntervalsIcuPayload` from `@/data/normalize`

- [ ] **Step 1: Refactor `syncData` in `App.tsx`**

Replace the `syncData` callback (lines 139-313) with:

```tsx
const syncData = useCallback(async (date: string) => {
  try {
    const response = await fetch('/api/auth/status')
    if (!response.ok) return
    const authStatus = await response.json()
    if (!authStatus.connected) return

    setSyncing(true)
    setToast({ tone: 'neutral', message: 'Syncing data from Intervals.icu…' })

    const [athleteRes, activitiesRes, wellnessRes, powerRes, eventsRes] = await Promise.all([
      fetch(`/api/data/athlete?id=${authStatus.athleteId || '0'}`).catch(() => null),
      fetch(`/api/data/activities?oldest=${date}&newest=${date}`).catch(() => null),
      fetch(`/api/data/wellness?oldest=${date}&newest=${date}`).catch(() => null),
      fetch(`/api/data/power-curves?type=Ride`).catch(() => null),
      fetch(`/api/data/events?oldest=${date}`).catch(() => null),
    ])

    const athlete = athleteRes?.ok ? await athleteRes.json() : null
    const activities = activitiesRes?.ok ? await activitiesRes.json() : []
    const wellness = wellnessRes?.ok ? await wellnessRes.json() : []
    const powerCurves = powerRes?.ok ? await powerRes.json() : []
    const events = eventsRes?.ok ? await eventsRes.json() : []

    const successCount = [athleteRes, activitiesRes, wellnessRes, powerRes, eventsRes]
      .filter(r => r?.ok).length

    const payload: IntervalsIcuPayload = {
      athlete: athlete ?? undefined,
      activities: Array.isArray(activities) ? activities : [],
      wellness: Array.isArray(wellness) ? wellness : [],
      powerCurves: Array.isArray(powerCurves) ? powerCurves : [],
      events: Array.isArray(events) ? events : [],
      date,
      generatedAt: new Date().toISOString(),
    }

    const normalized = normalizeIntervalsIcuData(payload)
    normalized.sync = {
      endpointCount: 5,
      successCount,
      errors: [],
      lastSyncAt: new Date().toISOString(),
    }

    setData(normalized)
    setStatus(prev => ({ ...prev, lastSyncAt: new Date().toISOString() }))
    setToast({ tone: 'success', message: 'Data updated from Intervals.icu.' })
  } catch (error) {
    setToast({ tone: 'error', message: error instanceof Error ? error.message : 'Sync failed.' })
  } finally {
    setSyncing(false)
  }
}, [])
```

- [ ] **Step 2: Add import for normalize module**

Add to the top of `App.tsx`:

```ts
import { normalizeIntervalsIcuData, type IntervalsIcuPayload } from '@/data/normalize'
```

- [ ] **Step 3: Run typecheck and tests**

Run: `npm run typecheck && npx vitest run`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: use normalizeIntervalsIcuData in syncData — eliminate 150 lines of duplication"
```

---

### Task 9: Token Refresh Mechanism

**Files:**
- Modify: `api/lib/proxy.ts`

**Interfaces:**
- Produces: `getValidAccessToken(req: VercelRequest, res: VercelResponse): Promise<string | null>`

- [ ] **Step 1: Add token refresh logic to proxy.ts**

Add to `api/lib/proxy.ts`:

```ts
export async function getValidAccessToken(req: VercelRequest, res: VercelResponse): Promise<string | null> {
  const accessToken = getAccessToken(req)
  if (!accessToken) return null

  const refreshToken = req.cookies?.refresh_token
  if (!refreshToken) return accessToken

  try {
    const testResponse = await proxyToIntervalsIcu(accessToken, '/athlete')
    if (testResponse.ok || testResponse.status !== 401) {
      return accessToken
    }
  } catch {
    // Token might be expired, try refresh
  }

  const clientId = process.env.INTERVALS_ICU_CLIENT_ID
  const clientSecret = process.env.INTERVALS_ICU_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  try {
    const tokenResponse = await fetch('https://intervals.icu/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    if (!tokenResponse.ok) return null

    const tokens = await tokenResponse.json()
    const maxAge = tokens.expires_in || 3600

    res.setHeader('Set-Cookie', [
      `access_token=${tokens.access_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`,
      `refresh_token=${tokens.refresh_token ?? refreshToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`,
    ])

    return tokens.access_token
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Update data endpoints to use `getValidAccessToken`**

In each data endpoint (`athlete.ts`, `activities.ts`, `wellness.ts`, `power-curves.ts`, `events.ts`), replace:

```ts
const accessToken = getAccessToken(req)
if (!accessToken) {
  return res.status(401).json({ error: 'Not authenticated' })
}
```

with:

```ts
const accessToken = await getValidAccessToken(req, res)
if (!accessToken) {
  return res.status(401).json({ error: 'Not authenticated' })
}
```

- [ ] **Step 3: Run typecheck and tests**

Run: `npm run typecheck && npx vitest run`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add api/
git commit -m "feat: add automatic token refresh for Intervals.icu OAuth"
```

---

### Task 10: Minor Fixes

**Files:**
- Modify: `src/lib/format.ts`
- Modify: `vercel.json`
- Modify: `.env.example`

- [ ] **Step 1: Fix hardcoded Portuguese string in `format.ts`**

In `src/lib/format.ts`, change line 50 from:

```ts
if (!value) return 'Mai'
```

to:

```ts
if (!value) return 'Never'
```

- [ ] **Step 2: Update `vercel.json` to modern configuration**

Replace `vercel.json` with:

```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

- [ ] **Step 3: Clean up `.env.example`**

Remove unused variables. Replace `.env.example` with:

```env
# Intervals.icu OAuth
INTERVALS_ICU_CLIENT_ID=
INTERVALS_ICU_CLIENT_SECRET=
INTERVALS_ICU_REDIRECT_URI=https://your-app.vercel.app/api/auth/callback

# Intervals.icu API (alternative API Key)
INTERS_ICU_API_KEY=

# OpenCode Server
OPENCODE_SERVER_URL=http://opencode-server:4096
OPENCODE_SERVER_USERNAME=
OPENCODE_SERVER_PASSWORD=

# LLM Provider (via OpenCode)
OPENCODE_ZEN_API_KEY=
OPENCODE_ZEN_MODEL=anthropic/claude-sonnet-4-5
```

- [ ] **Step 4: Run full check**

Run: `npm run check`
Expected: typecheck passes, all tests pass, build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts vercel.json .env.example
git commit -m "fix: minor fixes — Portuguese string, vercel.json modern config, clean .env.example"
```

---

### Task 11: Final Verification

**Files:** None (read-only verification)

- [ ] **Step 1: Run full check suite**

Run: `npm run check`
Expected: typecheck passes, all tests pass, build succeeds

- [ ] **Step 2: Verify no `@ts-nocheck` remains**

Run: `grep -r "@ts-nocheck" src/`
Expected: No matches

- [ ] **Step 3: Verify `.env` is in `.gitignore`**

Run: `grep ".env" .gitignore`
Expected: `.env`, `.env.local`, `.env.*.local` present

- [ ] **Step 4: Verify no path traversal vulnerabilities**

Run: `grep -n "req.query" api/data/*.ts`
Expected: All query params go through `validateAthleteId` or `validateDateParam`

- [ ] **Step 5: Verify all 6 new endpoints exist**

Run: `ls api/auth/status.ts api/auth/logout.ts api/data/wellness.ts api/data/power-curves.ts api/data/events.ts api/assistant/config.ts`
Expected: All 6 files exist

- [ ] **Step 6: Verify dead views are removed**

Run: `grep -n "HealthView\|SleepView\|BodyView\|DevicesView" src/components/Views.tsx`
Expected: No matches

- [ ] **Step 7: Verify `normalize.ts` is used in production**

Run: `grep -n "normalizeIntervalsIcuData" src/App.tsx`
Expected: At least one match

- [ ] **Step 8: Final commit (if any fixups needed)**

```bash
git add -A
git commit -m "chore: final verification fixups"
```

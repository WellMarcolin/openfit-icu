# Workout Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add step builder (structured workout steps via `workout_doc`) and workout scheduler (library → calendar event) to the existing Workouts feature.

**Architecture:** Pure conversion functions in `src/lib/workout-builder.ts` shared by dialog components. StepDialog handles individual step editing. ScheduleDialog handles date picker + event creation. Existing proxy API passes `workout_doc` through unmodified.

**Tech Stack:** React, TypeScript, shadcn/ui (Dialog, Button, Input), Vite, Vitest, Intervals.icu API

## Global Constraints

- Follow existing patterns: EventDialog.tsx for dialog structure, proxy.ts for API, compactMinutes/format for formatting
- Types defined locally in their component files (not in types.ts) — matching existing pattern
- buildWorkoutDoc converts frontend steps (minutes) → ICU format (seconds)
- Schedule uses existing POST /api/data/events endpoint
- GET /api/data/workouts/[id] added for fetching full workout detail with workout_doc
- No new page routing needed — all changes stay within existing WorkoutView + WorkoutDialog
- All numeric inputs use type="number", date inputs use type="date"
- step index is position in array (0-based), id is string key for React rendering

---

### Task 1: Core library — types + buildWorkoutDoc + tests

**Files:**
- Create: `src/lib/workout-builder.ts`
- Test: `src/lib/workout-builder.test.ts`

**Interfaces:**
- Produces: `WorkoutStep`, `StepTarget`, `WorkoutDoc`, `buildWorkoutDoc(steps: WorkoutStep[]): WorkoutDoc | undefined`, `parseWorkoutDoc(doc: WorkoutDoc | null | undefined): WorkoutStep[]`, `defaultStep(): WorkoutStep`
- Consumes: nothing (standalone pure functions)

- [ ] **Step 1: Write types + failing tests**

```ts
// src/lib/workout-builder.test.ts
import { describe, it, expect } from 'vitest'
import { buildWorkoutDoc, parseWorkoutDoc, defaultStep } from './workout-builder'
import type { WorkoutStep } from './workout-builder'

describe('buildWorkoutDoc', () => {
  it('returns undefined for empty steps', () => {
    expect(buildWorkoutDoc([])).toBeUndefined()
  })

  it('converts a simple step to workout_doc format', () => {
    const steps: WorkoutStep[] = [
      {
        id: '1',
        label: 'Warmup',
        type: 'step',
        duration: 10,
        distance: null,
        target: { type: 'power', value: 80, units: '%ftp' },
        reps: null,
        children: [],
        flags: ['warmup'],
        ramp: false,
      },
    ]
    const doc = buildWorkoutDoc(steps)
    expect(doc).toEqual({
      steps: [
        {
          text: 'Warmup',
          duration: 600,
          warmup: true,
          power: { value: 80, units: '%ftp' },
        },
      ],
    })
  })

  it('converts a repeat step with children', () => {
    const steps: WorkoutStep[] = [
      {
        id: '1',
        label: 'Intervals',
        type: 'repeat',
        duration: null,
        distance: null,
        target: null,
        reps: 3,
        children: [
          {
            id: '1-1',
            label: 'Hard',
            type: 'step',
            duration: 5,
            distance: null,
            target: { type: 'power', value: 110, units: '%ftp' },
            reps: null,
            children: [],
            flags: [],
            ramp: false,
          },
          {
            id: '1-2',
            label: 'Easy',
            type: 'step',
            duration: 2,
            distance: null,
            target: { type: 'power', value: 70, units: '%ftp' },
            reps: null,
            children: [],
            flags: [],
            ramp: false,
          },
        ],
        flags: [],
        ramp: false,
      },
    ]
    const doc = buildWorkoutDoc(steps)
    expect(doc).toEqual({
      steps: [{
        text: 'Intervals',
        reps: 3,
        steps: [
          { text: 'Hard', duration: 300, power: { value: 110, units: '%ftp' } },
          { text: 'Easy', duration: 120, power: { value: 70, units: '%ftp' } },
        ],
      }],
    })
  })

  it('converts a step with ramp target', () => {
    const steps: WorkoutStep[] = [
      {
        id: '1',
        label: 'Ramp',
        type: 'step',
        duration: 10,
        distance: null,
        target: { type: 'power', value: 80, units: '%ftp', start: 60, end: 90 },
        reps: null,
        children: [],
        flags: [],
        ramp: true,
      },
    ]
    const doc = buildWorkoutDoc(steps)
    expect(doc).toEqual({
      steps: [{
        text: 'Ramp',
        duration: 600,
        ramp: true,
        power: { value: 80, units: '%ftp', start: 60, end: 90 },
      }],
    })
  })

  it('converts a freeride step', () => {
    const steps: WorkoutStep[] = [
      {
        id: '1',
        label: 'Free ride',
        type: 'freeride',
        duration: 20,
        distance: null,
        target: { type: 'power', value: 75, units: '%ftp' },
        reps: null,
        children: [],
        flags: [],
        ramp: false,
      },
    ]
    const doc = buildWorkoutDoc(steps)
    expect(doc).toEqual({
      steps: [{
        text: 'Free ride',
        duration: 1200,
        freeride: true,
        power: { value: 75, units: '%ftp' },
      }],
    })
  })

  it('handles cooldown flag', () => {
    const steps: WorkoutStep[] = [
      {
        id: '1',
        label: 'Cool down',
        type: 'step',
        duration: 10,
        distance: null,
        target: null,
        reps: null,
        children: [],
        flags: ['cooldown'],
        ramp: false,
      },
    ]
    const doc = buildWorkoutDoc(steps)
    expect(doc).toEqual({
      steps: [{ text: 'Cool down', duration: 600, cooldown: true }],
    })
  })
})

describe('parseWorkoutDoc', () => {
  it('returns empty array for null/undefined', () => {
    expect(parseWorkoutDoc(null)).toEqual([])
    expect(parseWorkoutDoc(undefined)).toEqual([])
  })

  it('converts workout_doc back to WorkoutStep[]', () => {
    const doc = { steps: [{ text: 'Warmup', duration: 600, warmup: true, power: { value: 80, units: '%ftp' } }] }
    const steps = parseWorkoutDoc(doc)
    expect(steps).toHaveLength(1)
    expect(steps[0].label).toBe('Warmup')
    expect(steps[0].duration).toBe(10) // sec → min
    expect(steps[0].flags).toContain('warmup')
    expect(steps[0].target?.value).toBe(80)
  })

  it('converts repeat steps', () => {
    const doc = { steps: [{ text: 'Intervals', reps: 3, steps: [{ text: 'Hard', duration: 300, power: { value: 110, units: '%ftp' } }] }] }
    const steps = parseWorkoutDoc(doc)
    expect(steps[0].type).toBe('repeat')
    expect(steps[0].reps).toBe(3)
    expect(steps[0].children).toHaveLength(1)
    expect(steps[0].children[0].duration).toBe(5)
  })
})

describe('defaultStep', () => {
  it('returns a step with default values', () => {
    const s = defaultStep()
    expect(s.type).toBe('step')
    expect(s.duration).toBe(5)
    expect(s.target).toBeNull()
    expect(s.flags).toEqual([])
    expect(s.children).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/workout-builder.test.ts`
Expected: FAIL — module not found errors

- [ ] **Step 3: Write implementation**

```ts
// src/lib/workout-builder.ts
export interface StepTarget {
  type: 'power' | 'hr' | 'pace' | 'cadence'
  value: number
  units: '%ftp' | 'w' | '%hr' | '%lthr' | '%pace' | 'cadence' | 'power_zone' | 'hr_zone' | 'pace_zone'
  start?: number
  end?: number
}

export interface WorkoutStep {
  id: string
  label: string
  type: 'step' | 'repeat' | 'freeride'
  duration: number | null
  distance: number | null
  target: StepTarget | null
  reps: number | null
  children: WorkoutStep[]
  flags: ('warmup' | 'cooldown')[]
  ramp: boolean
}

export interface WorkoutDocStep {
  text?: string
  duration?: number
  distance?: number
  warmup?: boolean
  cooldown?: boolean
  freeride?: boolean
  ramp?: boolean
  reps?: number
  steps?: WorkoutDocStep[]
  power?: Record<string, unknown>
  hr?: Record<string, unknown>
  pace?: Record<string, unknown>
  cadence?: Record<string, unknown>
}

export interface WorkoutDoc {
  description?: string
  steps?: WorkoutDocStep[]
  duration?: number
  distance?: number
}

let nextId = 1
export function generateStepId(): string {
  return String(nextId++)
}

export function defaultStep(): WorkoutStep {
  return {
    id: generateStepId(),
    label: '',
    type: 'step',
    duration: 5,
    distance: null,
    target: null,
    reps: null,
    children: [],
    flags: [],
    ramp: false,
  }
}

function convertTarget(target: StepTarget): Record<string, unknown> {
  const result: Record<string, unknown> = { value: target.value, units: target.units }
  if (target.start !== undefined) result.start = target.start
  if (target.end !== undefined) result.end = target.end
  return result
}

function convertStep(s: WorkoutStep): WorkoutDocStep {
  const step: WorkoutDocStep = {}
  if (s.label) step.text = s.label
  if (s.duration) step.duration = Math.round(s.duration * 60)
  if (s.distance) step.distance = s.distance
  if (s.flags.includes('warmup')) step.warmup = true
  if (s.flags.includes('cooldown')) step.cooldown = true
  if (s.type === 'freeride') step.freeride = true
  if (s.ramp) step.ramp = true
  if (s.reps && s.type === 'repeat') {
    step.reps = s.reps
    step.steps = s.children.map(convertStep)
  }
  if (s.target) {
    step[s.target.type] = convertTarget(s.target)
  }
  return step
}

export function buildWorkoutDoc(steps: WorkoutStep[]): WorkoutDoc | undefined {
  if (!steps.length) return undefined
  return { steps: steps.map(convertStep) }
}

function parseICUUnit(units: string): StepTarget['units'] {
  const valid: StepTarget['units'][] = ['%ftp', 'w', '%hr', '%lthr', '%pace', 'cadence', 'power_zone', 'hr_zone', 'pace_zone']
  return valid.includes(units as StepTarget['units']) ? (units as StepTarget['units']) : '%ftp'
}

function parseICUStep(step: WorkoutDocStep, parentId: string): WorkoutStep {
  const id = generateStepId()
  const targetTypes = ['power', 'hr', 'pace', 'cadence'] as const
  let target: StepTarget | null = null
  for (const t of targetTypes) {
    const v = step[t]
    if (v && typeof v === 'object') {
      target = {
        type: t,
        value: Number(v.value ?? 0),
        units: parseICUUnit(String(v.units ?? '%ftp')),
        start: v.start !== undefined ? Number(v.start) : undefined,
        end: v.end !== undefined ? Number(v.end) : undefined,
      }
      break
    }
  }

  const flags: ('warmup' | 'cooldown')[] = []
  if (step.warmup) flags.push('warmup')
  if (step.cooldown) flags.push('cooldown')

  const isRepeat = step.reps !== undefined && step.reps !== null
  const isFreeride = step.freeride === true

  return {
    id,
    label: step.text ?? '',
    type: isRepeat ? 'repeat' : isFreeride ? 'freeride' : 'step',
    duration: step.duration ? Math.round(step.duration / 60) : null,
    distance: step.distance ?? null,
    target,
    reps: step.reps ?? null,
    children: step.steps ? step.steps.map((cs, i) => parseICUStep(cs, `${id}-${i}`)) : [],
    flags,
    ramp: step.ramp === true,
  }
}

export function parseWorkoutDoc(doc: WorkoutDoc | null | undefined): WorkoutStep[] {
  if (!doc?.steps) return []
  return doc.steps.map((s, i) => parseICUStep(s, `root-${i}`))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/workout-builder.test.ts`
Expected: PASS — all tests passing

- [ ] **Step 5: Run full suite + commit**

Run: `npm run typecheck && npm test`
Expected: Clean typecheck, all tests pass

```bash
git add src/lib/workout-builder.ts src/lib/workout-builder.test.ts
git commit -m "feat(workout-builder): core types and conversion functions

Add WorkoutStep/StepTarget types, buildWorkoutDoc (frontend→ICU),
parseWorkoutDoc (ICU→frontend), defaultStep, and generateStepId.
10 tests covering all step types and edge cases."
```

---

### Task 2: GET single workout endpoint

**Files:**
- Modify: `api/data/workouts/[id].ts`
- Test: `api/data/workouts/[id].test.ts`

**Interfaces:**
- Consumes: `proxyToIntervalsIcu(accessToken, path, options?)` from `api/lib/proxy.ts`
- Produces: `GET /api/data/workouts/{id}` returns full workout detail incl. `workout_doc`

- [ ] **Step 1: Write failing test**

```ts
// api/data/workouts/[id].test.ts
import { describe, it, expect, vi, beforeAll } from 'vitest'

const mockProxy = vi.fn()
vi.mock('../../lib/proxy', () => ({
  getValidAccessToken: vi.fn(),
  proxyToIntervalsIcu: (...args: unknown[]) => mockProxy(...args),
}))

import { getValidAccessToken } from '../../lib/proxy'

function createMockReqRes(method: string, query: Record<string, unknown> = {}) {
  const req = { method, query, cookies: {} } as any
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
  } as any
  return { req, res }
}

describe('GET /api/data/workouts/[id]', () => {
  it('returns 200 with workout detail on success', async () => {
    ;(getValidAccessToken as any).mockResolvedValue('token')
    const { req, res } = createMockReqRes('GET', { id: '42' })
    mockProxy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 42, name: 'Test', workout_doc: { steps: [] } }),
    })
    const handler = (await import('./[id]')).default
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }))
  })

  it('returns 401 without auth', async () => {
    ;(getValidAccessToken as any).mockResolvedValue(null)
    const { req, res } = createMockReqRes('GET', { id: '42' })
    const handler = (await import('./[id]')).default
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('returns 400 with missing id', async () => {
    ;(getValidAccessToken as any).mockResolvedValue('token')
    const { req, res } = createMockReqRes('GET', {})
    const handler = (await import('./[id]')).default
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run api/data/workouts/[id].test.ts`
Expected: FAIL

- [ ] **Step 3: Add GET handler to `api/data/workouts/[id].ts`**

Add after the `const { id } = req.query` line:
```ts
if (req.method === 'GET') {
  const response = await proxyToIntervalsIcu(accessToken, `/athlete/0/workouts/${id}`)
  if (!response.ok) return res.status(response.status).json({ error: 'Failed to fetch workout' })
  const workout = await response.json()
  return res.status(200).json(workout)
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run api/data/workouts/[id].test.ts`
Expected: PASS

- [ ] **Step 5: Run full suite + commit**

Run: `npm run typecheck && npm test`
Expected: Clean

```bash
git add api/data/workouts/[id].ts api/data/workouts/[id].test.ts
git commit -m "feat(workout-builder): add GET single workout endpoint"
```

---

### Task 3: StepDialog component

**Files:**
- Create: `src/components/Workouts/StepDialog.tsx`

**Interfaces:**
- Consumes: `WorkoutStep`, `StepTarget`, `defaultStep` from `src/lib/workout-builder`
- Consumes: shadcn/ui Dialog, Button, Input, Label
- Produces: `<StepDialog step={WorkoutStep | null} onSave={(step: WorkoutStep) => void} trigger?: ReactNode open?: boolean onOpenChange? callback />`

- [ ] **Step 1: Write StepDialog component**

```tsx
// src/components/Workouts/StepDialog.tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { WorkoutStep, StepTarget } from '@/lib/workout-builder'
import { defaultStep } from '@/lib/workout-builder'

export type { WorkoutStep, StepTarget }

interface StepDialogProps {
  step?: WorkoutStep | null
  onSave: (step: WorkoutStep) => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const TARGET_UNITS: Record<string, string[]> = {
  power: ['%ftp', 'w', 'power_zone'],
  hr: ['%hr', '%lthr', 'hr_zone'],
  pace: ['%pace', 'pace_zone'],
  cadence: ['cadence'],
}

function initForm(step?: WorkoutStep | null) {
  if (step) {
    return {
      label: step.label,
      type: step.type,
      duration: step.duration ?? 5,
      distance: step.distance ?? 0,
      hasTarget: step.target !== null,
      targetType: (step.target?.type ?? 'power') as 'power' | 'hr' | 'pace' | 'cadence',
      targetValue: step.target?.value ?? 80,
      targetUnits: step.target?.units ?? '%ftp',
      targetStart: step.target?.start ?? 0,
      targetEnd: step.target?.end ?? 0,
      reps: step.reps ?? 3,
      warmup: step.flags.includes('warmup'),
      cooldown: step.flags.includes('cooldown'),
      ramp: step.ramp,
    }
  }
  return {
    label: '',
    type: 'step' as const,
    duration: 5,
    distance: 0,
    hasTarget: false,
    targetType: 'power' as const,
    targetValue: 80,
    targetUnits: '%ftp',
    targetStart: 0,
    targetEnd: 0,
    reps: 3,
    warmup: false,
    cooldown: false,
    ramp: false,
  }
}

export function StepDialog({ step, onSave, trigger, open, onOpenChange }: StepDialogProps) {
  const [f, setF] = useState(initForm(step))
  const [saving, setSaving] = useState(false)

  const update = <K extends keyof ReturnType<typeof initForm>>(key: K, value: ReturnType<typeof initForm>[K]) => {
    setF((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const result: WorkoutStep = {
      id: step?.id ?? String(Date.now()),
      label: f.label,
      type: f.type,
      duration: f.duration || null,
      distance: f.distance || null,
      target: f.hasTarget ? {
        type: f.targetType,
        value: f.targetValue,
        units: f.targetUnits as StepTarget['units'],
        start: f.ramp && f.targetStart ? f.targetStart : undefined,
        end: f.ramp && f.targetEnd ? f.targetEnd : undefined,
      } : null,
      reps: f.type === 'repeat' ? f.reps : null,
      children: step?.children ?? [],
      flags: [
        ...(f.warmup ? ['warmup' as const] : []),
        ...(f.cooldown ? ['cooldown' as const] : []),
      ],
      ramp: f.ramp,
    }
    onSave(result)
    setSaving(false)
  }

  const units = TARGET_UNITS[f.targetType] ?? ['%ftp']

  const content = (
    <form onSubmit={handleSubmit}>
      <DialogHeader><DialogTitle>{step ? 'Edit step' : 'Add step'}</DialogTitle></DialogHeader>
      <div className="grid gap-3 py-4">
        <div className="grid gap-1.5">
          <Label htmlFor="slabel">Label</Label>
          <Input id="slabel" value={f.label} onChange={(e) => update('label', e.target.value)} placeholder="e.g. Hard interval" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="stype">Type</Label>
          <select
            id="stype"
            value={f.type}
            onChange={(e) => update('type', e.target.value as 'step' | 'repeat' | 'freeride')}
            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 13 }}
          >
            <option value="step">Step</option>
            <option value="repeat">Repeat</option>
            <option value="freeride">Freeride</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sduration">Duration (minutes)</Label>
          <Input id="sduration" type="number" min={0} value={f.duration} onChange={(e) => update('duration', parseInt(e.target.value) || 0)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sdistance">Distance (meters, optional)</Label>
          <Input id="sdistance" type="number" min={0} value={f.distance} onChange={(e) => update('distance', parseInt(e.target.value) || 0)} />
        </div>
        {f.type === 'repeat' && (
          <div className="grid gap-1.5">
            <Label htmlFor="sreps">Repetitions</Label>
            <Input id="sreps" type="number" min={1} value={f.reps} onChange={(e) => update('reps', parseInt(e.target.value) || 1)} />
          </div>
        )}
        <div className="grid gap-1.5">
          <Label>
            <input type="checkbox" checked={f.hasTarget} onChange={(e) => update('hasTarget', e.target.checked)} /> Set intensity target
          </Label>
        </div>
        {f.hasTarget && (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="stargettype">Target type</Label>
              <select id="stargettype" value={f.targetType} onChange={(e) => update('targetType', e.target.value as 'power' | 'hr' | 'pace' | 'cadence')}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 13 }}>
                <option value="power">Power</option>
                <option value="hr">Heart rate</option>
                <option value="pace">Pace</option>
                <option value="cadence">Cadence</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="stargetvalue">Value</Label>
              <Input id="stargetvalue" type="number" value={f.targetValue} onChange={(e) => update('targetValue', parseInt(e.target.value) || 0)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="stargetunits">Units</Label>
              <select id="stargetunits" value={f.targetUnits} onChange={(e) => update('targetUnits', e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 13 }}>
                {units.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            {f.ramp && (
              <div className="grid gap-1.5" style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div className="grid gap-1.5">
                  <Label htmlFor="sstart">Start</Label>
                  <Input id="sstart" type="number" value={f.targetStart} onChange={(e) => update('targetStart', parseInt(e.target.value) || 0)} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="send">End</Label>
                  <Input id="send" type="number" value={f.targetEnd} onChange={(e) => update('targetEnd', parseInt(e.target.value) || 0)} />
                </div>
              </div>
            )}
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={f.ramp} onChange={(e) => update('ramp', e.target.checked)} /> Ramp (gradual change)
            </label>
          </>
        )}
        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={f.warmup} onChange={(e) => update('warmup', e.target.checked)} /> Warmup
          </label>
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={f.cooldown} onChange={(e) => update('cooldown', e.target.checked)} /> Cooldown
          </label>
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={saving}>{step ? 'Save' : 'Add step'}</Button>
      </DialogFooter>
    </form>
  )

  if (trigger) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent>{content}</DialogContent>
      </Dialog>
    )
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{content}</DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/Workouts/StepDialog.tsx
git commit -m "feat(workout-builder): add StepDialog component"
```

---

### Task 4: ScheduleDialog component

**Files:**
- Create: `src/components/Workouts/ScheduleDialog.tsx`

**Interfaces:**
- Produces: `<ScheduleDialog workoutName: string workoutType: SportType onSchedule: (date: string) => void trigger? open? onOpenChange? />`

- [ ] **Step 1: Write ScheduleDialog**

```tsx
// src/components/Workouts/ScheduleDialog.tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ScheduleDialogProps {
  workoutName: string
  onSchedule: (date: string) => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function todayString(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

export function ScheduleDialog({ workoutName, onSchedule, trigger, open, onOpenChange }: ScheduleDialogProps) {
  const [date, setDate] = useState(todayString())
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    onSchedule(date)
    setSaving(false)
  }

  const content = (
    <form onSubmit={handleSubmit}>
      <DialogHeader><DialogTitle>Schedule &ldquo;{workoutName}&rdquo;</DialogTitle></DialogHeader>
      <div className="grid gap-3 py-4">
        <div className="grid gap-1.5">
          <Label htmlFor="schedule-date">Date</Label>
          <Input id="schedule-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={saving}>Schedule</Button>
      </DialogFooter>
    </form>
  )

  if (trigger) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent>{content}</DialogContent>
      </Dialog>
    )
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{content}</DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/Workouts/ScheduleDialog.tsx
git commit -m "feat(workout-builder): add ScheduleDialog component"
```

---

### Task 5: Update WorkoutDialog with Steps section

**Files:**
- Modify: `src/components/Workouts/WorkoutDialog.tsx`
- Create: `src/components/Workouts/WorkoutDialog.test.tsx`

**Interfaces:**
- Consumes: `WorkoutStep`, `buildWorkoutDoc`, `parseWorkoutDoc`, `defaultStep` from `src/lib/workout-builder`
- Consumes: `StepDialog` from `./StepDialog`
- Produces: `WorkoutFormData` gains `steps: WorkoutStep[]`

- [ ] **Step 1: Write failing test for WorkoutDialog with steps**

```tsx
// src/components/Workouts/WorkoutDialog.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WorkoutDialog } from './WorkoutDialog'

describe('WorkoutDialog', () => {
  it('renders steps section for new workout', () => {
    render(<WorkoutDialog onSave={() => {}} trigger={<button>Open</button>} />)
    expect(screen.getByText('+ Add step')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/components/Workouts/WorkoutDialog.test.tsx`
Expected: FAIL

- [ ] **Step 3: Update WorkoutDialog.tsx**

Modify `WorkoutFormData` to include steps:
```ts
export interface WorkoutFormData {
  name: string
  type: SportType
  description: string
  movingTime: number
  indoor: boolean
  tags: string
  steps: WorkoutStep[]           // NEW
}
```

Add import at top:
```ts
import { StepDialog } from './StepDialog'
import type { WorkoutStep } from '@/lib/workout-builder'
import { buildWorkoutDoc, parseWorkoutDoc, defaultStep } from '@/lib/workout-builder'
```

Update `defaultForm`:
```ts
const defaultForm: WorkoutFormData = {
  name: '',
  type: 'Ride',
  description: '',
  movingTime: 3600,
  indoor: false,
  tags: '',
  steps: [],                     // NEW
}
```

Update form initializer:
```ts
const [form, setForm] = useState<WorkoutFormData>(
  workout
    ? {
        name: workout.name,
        type: workout.type,
        description: workout.description ?? '',
        movingTime: workout.movingTime ?? 3600,
        indoor: workout.indoor,
        tags: workout.tags?.join(', ') ?? '',
        steps: parseWorkoutDoc(workout.workout_doc as any),   // NEW
      }
    : { ...defaultForm }
)
```

Add state for step dialog:
```ts
const [stepDialogOpen, setStepDialogOpen] = useState(false)
const [editingStep, setEditingStep] = useState<WorkoutStep | null>(null)
```

Add step handlers:
```ts
const handleAddStep = (step: WorkoutStep) => {
  setForm((prev) => ({ ...prev, steps: [...prev.steps, step] }))
  setEditingStep(null)
  setStepDialogOpen(false)
}

const handleEditStep = (index: number) => {
  setEditingStep(form.steps[index])
  setStepDialogOpen(true)
}

const handleUpdateStep = (step: WorkoutStep) => {
  setForm((prev) => ({
    ...prev,
    steps: prev.steps.map((s, i) => (s.id === step.id ? step : s)),
  }))
  setEditingStep(null)
  setStepDialogOpen(false)
}

const handleDeleteStep = (index: number) => {
  setForm((prev) => ({
    ...prev,
    steps: prev.steps.filter((_, i) => i !== index),
  }))
}

const handleMoveStep = (index: number, direction: -1 | 1) => {
  const target = index + direction
  if (target < 0 || target >= form.steps.length) return
  setForm((prev) => {
    const next = [...prev.steps]
    ;[next[index], next[target]] = [next[target], next[index]]
    return { ...prev, steps: next }
  })
}
```

Update `handleSubmit` to include steps in save body:
```ts
const correctedBody = {
  ...body,
  workout_doc: buildWorkoutDoc(form.steps) ?? null,
}
// Use correctedBody instead of body in the fetch calls
```

Add Steps section to the form JSX, after the tags field and before DialogFooter:
```tsx
<Separator />
<div className="steps-section">
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <Label style={{ fontWeight: 600 }}>Steps</Label>
    <StepDialog onSave={handleAddStep} trigger={<Button variant="outline" size="sm">+ Add step</Button>} />
  </div>
  {form.steps.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>No steps defined. Add warmup, intervals, and cooldown.</p>}
  <div className="steps-list" style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
    {form.steps.map((s, i) => (
      <div key={s.id} className="step-card" style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
        borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 13,
      }}>
        <span style={{ fontWeight: 600, minWidth: 20 }}>{i + 1}.</span>
        <div style={{ flex: 1 }}>
          <strong>{s.label || (s.type === 'repeat' ? `×${s.reps}` : s.type)}</strong>
          <span style={{ color: 'var(--muted-foreground)', marginLeft: 8 }}>
            {s.duration ? `${s.duration}min` : ''}
            {s.target ? ` @ ${s.target.value}${s.target.units}` : ''}
            {s.flags.length ? ` [${s.flags.join(', ')}]` : ''}
            {s.type === 'repeat' && s.children.length ? ` (${s.children.length} steps)` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" onClick={() => handleMoveStep(i, -1)} disabled={i === 0} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: i === 0 ? 0.3 : 1 }}>▲</button>
          <button type="button" onClick={() => handleMoveStep(i, 1)} disabled={i === form.steps.length - 1} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: i === form.steps.length - 1 ? 0.3 : 1 }}>▼</button>
          <button type="button" onClick={() => handleEditStep(i)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Edit</button>
          <button type="button" onClick={() => handleDeleteStep(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'red' }}>✕</button>
        </div>
      </div>
    ))}
  </div>
</div>

{/* Step editing dialog */}
<StepDialog
  step={editingStep}
  onSave={handleUpdateStep}
  open={stepDialogOpen}
  onOpenChange={(open) => { setStepDialogOpen(open); if (!open) setEditingStep(null) }}
/>
```

Also add `Separator` import:
```ts
import { Separator } from '@/components/ui/separator'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Workouts/WorkoutDialog.test.tsx`
Expected: PASS

- [ ] **Step 5: Verify typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/Workouts/WorkoutDialog.tsx src/components/Workouts/WorkoutDialog.test.tsx
git commit -m "feat(workout-builder): add step builder to WorkoutDialog"
```

---

### Task 6: Update WorkoutView with Schedule + wire everything

**Files:**
- Modify: `src/components/WorkoutView.tsx`

**Interfaces:**
- Consumes: `ScheduleDialog` from `./Workouts/ScheduleDialog`
- Consumes: `WorkoutItem` gains `workout_doc` field
- Consumes: `POST /api/data/events` for scheduling

- [ ] **Step 1: Update WorkoutView.tsx**

Add imports:
```ts
import { ScheduleDialog } from './Workouts/ScheduleDialog'
```

Update `mapWorkoutFromICU` to preserve `workout_doc`:
```ts
function mapWorkoutFromICU(raw: Record<string, unknown>): WorkoutItem {
  return {
    id: raw.id as number,
    name: raw.name as string,
    type: (raw.workout_type ?? raw.type ?? 'Ride') as WorkoutItem['type'],
    description: (raw.description ?? null) as string | null,
    movingTime: (raw.moving_time ?? raw.movingTime ?? null) as number | null,
    indoor: Boolean(raw.indoor ?? false),
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    workout_doc: (raw.workout_doc ?? null) as Record<string, unknown> | null,    // NEW
  }
}
```

Add `WorkoutItem` type update — add `workout_doc` field. Edit the interface in WorkoutDialog.tsx:
```ts
export interface WorkoutItem {
  // ...existing fields
  workout_doc: Record<string, unknown> | null
}
```

Add schedule state:
```ts
const [scheduling, setScheduling] = useState<WorkoutItem | null>(null)
const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
```

Add schedule handler:
```ts
const handleSchedule = async (date: string) => {
  if (!scheduling) return
  try {
    const res = await fetch('/api/data/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: scheduling.name,
        workout_type: scheduling.type,
        start_date: date,
      }),
    })
    if (!res.ok) return
    setScheduling(null)
    setScheduleDialogOpen(false)
  } catch {
    // silently fail
  }
}
```

Add ScheduleDialog to the workout row (next to the Edit/Delete buttons):
```tsx
<ScheduleDialog
  workoutName={workout.name}
  onSchedule={handleSchedule}
  open={scheduleDialogOpen && scheduling?.id === workout.id}
  onOpenChange={(open) => { setScheduleDialogOpen(open); if (!open) setScheduling(null) }}
  trigger={<Button variant="ghost" size="icon-xs" onClick={() => { setScheduling(workout); setScheduleDialogOpen(true) }} aria-label="Schedule workout">📅</Button>}
/>
```

The handleSave in WorkoutView needs to be updated to pass steps through the API:
Currently `handleSave` builds a `body` without `workout_doc`. Update it to include:
```ts
if (form.steps?.length) {
  body.workout_doc = buildWorkoutDoc(form.steps)
}
```

Add the import:
```ts
import { buildWorkoutDoc } from '@/lib/workout-builder'
```

- [ ] **Step 2: Verify typecheck + tests + build**

Run: `npm run typecheck && npm test && npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/WorkoutView.tsx src/components/Workouts/WorkoutDialog.tsx
git commit -m "feat(workout-builder): add schedule button and wire step builder into WorkoutView"
```

---

### Task 7: Spec review — verify plan against design spec

- [ ] **Step 1: Walk through spec coverage**

Check each spec section against the plan:
- WorkoutStep / StepTarget types → Task 1 ✅
- buildWorkoutDoc / parseWorkoutDoc → Task 1 ✅
- GET single workout endpoint → Task 2 ✅
- StepDialog component → Task 3 ✅
- ScheduleDialog component → Task 4 ✅
- WorkoutDialog Steps section → Task 5 ✅
- WorkoutView Schedule button → Task 6 ✅
- Types, tests, edge cases → covered per task ✅

No gaps found.

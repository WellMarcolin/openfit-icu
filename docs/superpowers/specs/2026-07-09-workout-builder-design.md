# Workout Builder — Design Spec

## Overview

Add two capabilities to the existing Workouts feature:
1. **Step builder**: visuallly create/edit structured workout steps (`workout_doc`) within the existing WorkoutDialog
2. **Workout scheduler**: schedule a library workout onto the calendar as an event

## Architecture

### New Components

| File | Purpose |
|------|---------|
| `src/components/Workouts/StepDialog.tsx` | Sub-dialog for editing a single step (type, duration/distance, target, repeats, flags) |
| `src/components/Workouts/ScheduleDialog.tsx` | Dialog with date picker for scheduling a workout |
| `src/lib/workout-builder.ts` | Pure functions: `buildWorkoutDoc(steps)`, defaults, helpers |

### Modified Components

| File | Change |
|------|--------|
| `WorkoutDialog.tsx` | Add "Steps" section with list + add/edit/delete/reorder; pass `workout_doc` on save |
| `WorkoutView.tsx` | Add "Schedule" button per workout row |

### API Changes

| File | Change |
|------|--------|
| `api/data/workouts/[id].ts` | Add GET handler for single workout (returns full detail incl. `workout_doc`) |

### No Changes Needed

- `api/lib/proxy.ts` — already passes JSON body through
- `api/data/workouts/index.ts` — POST/GET already works with `workout_doc`
- `api/data/events/index.ts` — schedule uses existing POST events endpoint
- `src/App.tsx` — no new page routing needed

## Data Types

Defined in `StepDialog.tsx`:

```ts
interface WorkoutStep {
  id: string
  label: string
  type: 'step' | 'repeat' | 'freeride'
  duration: number | null       // minutes
  distance: number | null       // meters
  target: StepTarget | null
  reps: number | null           // only for type='repeat'
  children: WorkoutStep[]       // only for type='repeat'
  flags: ('warmup' | 'cooldown')[]
  ramp: boolean                 // gradual intensity change
}

interface StepTarget {
  type: 'power' | 'hr' | 'pace' | 'cadence'
  value: number
  units: '%ftp' | 'w' | '%hr' | '%lthr' | '%pace' | 'cadence' | 'power_zone' | 'hr_zone' | 'pace_zone'
  start?: number                // for ranges
  end?: number                  // for ranges
}
```

## Step Builder UX

### Step List (in WorkoutDialog)

Inserted after existing fields (name, type, duration, tags) in the form. Uses a "Steps" section with:

- A vertical list of step cards
- Each card shows: type icon, label, summary (duration/target), Edit and Delete buttons
- Repeat cards show nested children indented
- Up/down buttons for reorder (drag-and-drop optional future)
- "[+ Add step]" button at bottom

### StepDialog

Opens as a sub-dialog on Add/Edit. Contains:

- **Label**: text input
- **Type**: select (Step / Repeat / Freeride)
- **Duration**: number input (minutes) OR **Distance**: number input (meters) — mutually exclusive, at least one required
- **Target type**: select (Power / HR / Pace / Cadence / None)
- **Target value**: number input
- **Target units**: select (dependent on type)
- **Ramp**: checkbox (only for Step type with target)
- — Repeat-only fields —
- **Repetitions**: number input (shows only if type=Repeat)
- — Freeride-only fields —
- **Suggested power range** (optional, freelride target)
- — Flags —
- **Warmup**: checkbox
- **Cooldown**: checkbox

Defaults:
- New step at end of list: type=step, duration=5, target=null, no flags
- Editing pre-fills from existing step data

### Conversion: Frontend Steps → workout_doc

`buildWorkoutDoc(steps: WorkoutStep[]): WorkoutDoc`

```ts
{
  steps: steps.map(s => ({
    text: s.label || undefined,
    duration: s.duration ? s.duration * 60 : undefined,   // min → sec
    distance: s.distance || undefined,
    warmup: s.flags.includes('warmup') || undefined,
    cooldown: s.flags.includes('cooldown') || undefined,
    freeride: s.type === 'freeride' || undefined,
    ramp: s.ramp || undefined,
    ...(s.reps && s.type === 'repeat' ? {
      reps: s.reps,
      steps: s.children.map(child => /* recursive */),
    } : {}),
    ...(s.target ? {
      [s.target.type]: {
        value: s.target.value,
        units: s.target.units,
        ...(s.target.start ? { start: s.target.start } : {}),
        ...(s.target.end ? { end: s.target.end } : {}),
      },
    } : {}),
  }))
}
```

### Reverse Conversion: workout_doc → Frontend Steps

When editing an existing workout, the GET endpoint returns `workout_doc`. The mapper converts it back to `WorkoutStep[]` for the dialog.

## Schedule UX

### ScheduleDialog

Simple dialog with:
- Title: "Schedule \"{workout name}\""
- Date picker (native `<input type="date">`)
- Cancel / Schedule buttons

### Schedule Flow

1. User clicks "Schedule" on a workout row
2. ScheduleDialog opens, pre-filled with today's date
3. User picks date, clicks Schedule
4. Frontend calls `POST /api/data/events`:
   ```ts
   body: {
     name: workout.name,
     workout_type: workout.type,
     start_date: selectedDate,
   }
   ```
5. On success: toast/feedback, dialog closes
6. The `workout_doc` is NOT copied to the event — the event references the library workout

## API Changes

### GET /api/data/workouts/[id]

Add GET handler in `api/data/workouts/[id].ts`:

```ts
if (req.method === 'GET') {
  const response = await proxyToIntervalsIcu(
    accessToken,
    `/athlete/0/workouts/${id}`
  )
  if (!response.ok) return res.status(response.status).json({ error: 'Failed to fetch workout' })
  const workout = await response.json()
  return res.status(200).json(workout)
}
```

### Schedule (no new API needed)

Schedule uses the existing `POST /api/data/events` endpoint. The frontend constructs a minimal event body with `name`, `workout_type`, and `start_date`.

## Edge Cases

| Case | Handling |
|------|----------|
| Step with no target | `target: null`, no target key in JSON |
| Step with no duration or distance | Duration defaults to 5 min in dialog; validation prevents both being empty |
| Repeat without children | `reps: N, steps: []` — Intervals.icu accepts (equivale a N× blank interval) |
| Repeat with children | Recursive `buildWorkoutDoc` on children |
| Step with ramp | Sets `ramp: true` + range target (`start`/`end`) |
| Freeride with target | `freeride: true` + target as suggested range |
| Workout without steps | `workout_doc` omitted from body (existing behavior preserved) |
| Schedule workout without steps | Event created with name + type only |
| Duplicate schedule | Intervals.icu allows multiple events same day; frontend doesn't restrict |

## Testing

### Unit Tests (`src/lib/workout-builder.test.ts`)

- `buildWorkoutDoc` with steps → correct JSON
- `buildWorkoutDoc` with repeat + children
- `buildWorkoutDoc` with no steps → undefined
- `buildWorkoutDoc` with ramp target → start/end fields
- `buildWorkoutDoc` with freeride → freeride: true
- `buildWorkoutDoc` with warmup/cooldown flags

### Component Tests

- StepDialog: renders, fields update, submit builds correct WorkoutStep
- ScheduleDialog: date picker, submit sends correct body

### API Test (`api/data/workouts/[id].test.ts`)

- GET returns 200 with full workout detail
- GET without auth returns 401
- GET with invalid id returns 400

### Verification

- `npm run typecheck` passes
- `npm test` — all existing + new tests pass
- `npm run build` succeeds

## Implementation Order

1. `src/lib/workout-builder.ts` — pure functions (buildWorkoutDoc, types, defaults) + tests
2. `api/data/workouts/[id].ts` — GET handler + test
3. `src/components/Workouts/StepDialog.tsx` — step editing dialog
4. `src/components/Workouts/ScheduleDialog.tsx` — schedule dialog
5. `WorkoutDialog.tsx` — add Steps section + integrate StepDialog
6. `WorkoutView.tsx` — add Schedule button + wire everything

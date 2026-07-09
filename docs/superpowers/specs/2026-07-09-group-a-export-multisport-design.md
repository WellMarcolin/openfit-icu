# Spec: Group A — Data Export + Multi-sport Support

## Context

OpenFit ICU displays training data across 7 views. Currently:
- No export functionality exists (despite `ExportIcon` being defined in `icons.ts`)
- No sport filtering exists (despite `SportType` being well-defined on every `ActivityItem` and `CalendarEvent`)
- `profile.sports` is hardcoded to `['Ride', 'Run']` in `normalize.ts` instead of derived from actual data
- `ActivityView` shows all activities unfiltered; `CalendarView` shows all events unfiltered

## Feature 1: Data Export (CSV + JSON per view)

### Architecture

- **`src/lib/export.ts`** — shared utility with `toCSV()`, `toJSON()`, `downloadFile()`
- Export button (using existing `ExportIcon`) added to: ActivityView, WellnessView, PowerView, CalendarView
- Each view defines which data array to export and which fields to include

### Data exported per view

| View | Data source | Key fields |
|------|------------|------------|
| ActivityView | `data.activities[]` | name, type, startDate, movingTime, distance, trainingLoad, avgPower, avgHeartRate, intensity |
| WellnessView | `data.trends[]` | date, restingHR, hrv, sleepMinutes, sleepScore, mood, stress, fatigue, readiness, weight |
| PowerView | `data.power.curves[]` | secs, watts, wattsPerKg |
| CalendarView | `data.events[]` | startDate, name, type, category, movingTime, trainingLoad, indoor |

### Export flow

1. User clicks export button in view header
2. Dropdown appears: "Download CSV" / "Download JSON"
3. `toCSV()` or `toJSON()` converts the data array
4. `downloadFile()` creates a Blob, generates an object URL, triggers download via hidden `<a>` element
5. Filename format: `{view}-{date}.{csv|json}` (e.g., `activities-2026-07-09.csv`)

### CSV format

- Header row with field names
- Values properly escaped (quotes around strings containing commas)
- Null values rendered as empty cells
- Dates in ISO format, durations in seconds, distances in km

## Feature 2: Multi-sport (Filter + Icons)

### Architecture

- **`src/components/Shared/SportFilter.tsx`** — reusable dropdown: "All" + list of sport types present in data
- **`src/components/icons.ts`** — add sport-to-icon mapping function `getSportIcon(sport: SportType)`
- Filter state managed locally within each view (no global state needed)

### Sport icon mapping

| Sport types | Lucide icon |
|-------------|-------------|
| `Ride`, `VirtualRide`, `GravelRide`, `MountainBikeRide` | `Bike` |
| `Run`, `VirtualRun`, `TrailRun` | `Footprints` |
| `Swim` | `Waves` |
| `Walk`, `Hike` | `Mountain` |
| `WeightTraining` | `Dumbbell` |
| Any other | `Activity` (fallback) |

### Filter behavior

- Dropdown shows "All" (default) + each unique sport type found in the view's data
- Selecting a sport filters the displayed list
- "All" shows everything
- Filter state resets when navigating away from the view
- Empty state: "No {sport} activities found" when filter yields no results

### Views with sport filter

| View | What gets filtered |
|------|-------------------|
| ActivityView | Activity list |
| CalendarView | Event list |
| TodayView | Recent activities section (top 3) |

### Fix: `profile.sports` derivation

Currently hardcoded in `normalize.ts:163`. Change to derive from actual activity data:
```typescript
sports: [...new Set(activities.map(a => a.type))]
```

## Success criteria

- [ ] Export CSV/JSON works on Activity, Wellness, Power, Calendar views
- [ ] Sport filter dropdown appears on Activity, Calendar, Today views
- [ ] Sport icons render correctly per sport type
- [ ] `profile.sports` derived from actual data
- [ ] All existing tests pass
- [ ] New tests for export utility and sport filter component

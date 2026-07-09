# Spec: Documentation Cleanup — OpenFit ICU

## Context

OpenFit ICU is a fork of OpenFit (Electron + Google Health/Fitbit web app) adapted to be a web-only app with Intervals.icu as the exclusive data source. Source code (`src/`, `api/`) is already clean — zero Google Health/Fitbit references. The PRD (`.opencode/plans/prd.md`) correctly documents the current architecture and goals.

However, 5 files in `docs/` still describe the original OpenFit (Electron + Google Health/Fitbit), creating confusion for anyone reading the docs. README.md has stale references and `tsconfig.node.json` references a non-existent `electron/` directory.

## Changes

### 1. Delete 5 legacy docs

| File | Irrelevant content |
|------|-------------------|
| `docs/GOOGLE_HEALTH_SETUP.md` | Full Google Cloud setup + OAuth for Fitbit via Google Health API |
| `docs/ARCHITECTURE.md` | Electron architecture with IPC, safeStorage, contextBridge, Google Health adapter |
| `docs/DATA_COVERAGE.md` | Google Health API v4 and Fitbit Air data coverage |
| `docs/HOME_DASHBOARD_MODEL.md` | Dashboard model centered on steps, sleep stages, ECG, skin temperature |
| `docs/RELEASE.md` | Desktop release process (macOS DMG, electron-builder, notarization) |

### 2. Fix README.md

- **Line 58**: Remove comment about Vercel KV
- **Lines 75-78**: Remove the 3 Vercel KV env vars
- **Lines 100-101**: `Views/` → `Views.tsx`, `Charts/` → `Charts.tsx`, `Shared/` → `Shared.tsx`
- **Lines 108-109**: `intervals-icu.ts` and `opencode-client.ts` are now in `api/lib/`

### 3. Fix tsconfig.node.json

- **Line 15**: Remove `"electron/**/*.test.ts"` from the `include` array

### 4. Verification

- `npm run check` (typecheck + tests + build) must pass
- No files in `src/` or `api/` contain Google Health, Fitbit, or Electron references

## Status

- [x] 5 legacy docs deleted
- [x] README.md reflects actual project state
- [x] tsconfig.node.json cleaned
- [x] `npm run check` passes
- [x] No Google Health/Fitbit/Electron refs remain in source

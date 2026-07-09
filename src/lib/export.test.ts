import { describe, it, expect } from 'vitest'
import { toCSV, toJSON } from './export'

describe('toCSV', () => {
  it('returns empty string for empty array', () => {
    expect(toCSV([], ['a', 'b'])).toBe('')
  })

  it('generates header and rows', () => {
    const rows = [
      { name: 'Ride', load: 42 },
      { name: 'Run', load: 30 },
    ]
    const csv = toCSV(rows, ['name', 'load'])
    expect(csv).toBe('name,load\nRide,42\nRun,30')
  })

  it('handles null and undefined as empty', () => {
    const rows = [{ a: null, b: undefined, c: 'ok' }] as Record<string, unknown>[]
    const csv = toCSV(rows, ['a', 'b', 'c'])
    expect(csv).toBe('a,b,c\n,,ok')
  })

  it('escapes commas and quotes', () => {
    const rows = [{ name: 'Easy, ride', note: 'He said "hi"' }]
    const csv = toCSV(rows, ['name', 'note'])
    expect(csv).toBe('name,note\n"Easy, ride","He said ""hi"""')
  })
})

describe('toJSON', () => {
  it('returns formatted JSON', () => {
    const rows = [{ a: 1 }]
    expect(toJSON(rows)).toBe('[\n  {\n    "a": 1\n  }\n]')
  })

  it('handles empty array', () => {
    expect(toJSON([])).toBe('[]')
  })
})

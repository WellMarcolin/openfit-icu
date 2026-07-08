import { describe, expect, it } from 'vitest'
import { normalizeIntervalsIcuData } from './normalize'
import { createDemoData } from './demo'

describe('normalizeIntervalsIcuData', () => {
  it('handles empty payload', () => {
    const result = normalizeIntervalsIcuData({
      date: '2026-07-08',
      generatedAt: new Date().toISOString(),
    })
    expect(result.source).toBe('intervals-icu')
    expect(result.selectedDate).toBe('2026-07-08')
    expect(result.activities).toEqual([])
  })

  it('normalizes athlete data', () => {
    const demoData = createDemoData()
    expect(demoData.profile.displayName).toBeTruthy()
    expect(demoData.profile.weight).toBeGreaterThan(0)
  })
})

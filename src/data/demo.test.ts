import { describe, expect, it } from 'vitest'
import { createDemoData } from './demo'

describe('createDemoData', () => {
  it('returns data for today', () => {
    const data = createDemoData()
    expect(data.source).toBe('demo')
    expect(data.profile.displayName).toBeTruthy()
    expect(data.activities.length).toBeGreaterThan(0)
    expect(data.fitness.ctl).not.toBeNull()
    expect(data.wellness.hrv).not.toBeNull()
  })

  it('returns data for a specific date', () => {
    const date = '2026-06-15'
    const data = createDemoData(date)
    expect(data.selectedDate).toBe(date)
    expect(data.trends.length).toBe(14)
  })

  it('generates valid data for any date', () => {
    const data = createDemoData('2026-06-15')
    expect(data.wellness.hrv).toBeGreaterThan(0)
    expect(data.fitness.ctl).toBeGreaterThan(0)
  })
})

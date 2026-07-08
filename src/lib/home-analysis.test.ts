import { describe, expect, it } from 'vitest'
import { analyzeHome } from './home-analysis'
import { createDemoData } from '@/data/demo'

describe('analyzeHome', () => {
  it('returns analysis from demo data', () => {
    const data = createDemoData()
    const analysis = analyzeHome(data)
    expect(analysis.todayLoad).not.toBeNull()
    expect(analysis.recentActivities).toBeGreaterThanOrEqual(0)
    expect(analysis.ctl.current).toBeGreaterThan(0)
    expect(analysis.atl.current).toBeGreaterThan(0)
  })
})

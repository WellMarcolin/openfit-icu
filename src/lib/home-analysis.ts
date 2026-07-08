import type { DashboardData } from '@/types'

function hasValue(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value)
}

export interface BaselineComparison {
  current: number
  baseline: number
  difference: number | null
  sampleCount: number
}

function computeBaseline(values: (number | null)[]): BaselineComparison {
  const valid = values.filter(hasValue)
  const current = valid[valid.length - 1] ?? 0
  const baseline = valid.length > 1
    ? valid.slice(0, -1).reduce((sum, v) => sum + v, 0) / (valid.length - 1)
    : current
  return {
    current,
    baseline: Math.round(baseline),
    difference: valid.length > 2 ? current - baseline : null,
    sampleCount: valid.length,
  }
}

export function analyzeHome(data: DashboardData) {
  const ctl = data.trends.map((t) => t.ctl)
  const atl = data.trends.map((t) => t.atl)
  const tsb = data.trends.map((t) => t.tsb)
  const hrv = data.trends.map((t) => t.hrv)
  const restingHR = data.trends.map((t) => t.restingHR)
  const sleepMinutes = data.trends.map((t) => t.sleepMinutes)

  return {
    ctl: computeBaseline(ctl),
    atl: computeBaseline(atl),
    tsb: computeBaseline(tsb),
    hrv: computeBaseline(hrv),
    restingHeartRate: computeBaseline(restingHR),
    sleep: computeBaseline(sleepMinutes),
    todayLoad: data.activity.todayLoad,
    recentActivities: data.activity.todayActivities.length,
  }
}

import type { DashboardData, PageId } from '@/types'

const hasNumber = (value: number | null) => value !== null && Number.isFinite(value)

export function hasActivityData(data: DashboardData) {
  return data.activities.length > 0 || hasNumber(data.activity.todayLoad)
}

export function hasWellnessData(data: DashboardData) {
  return hasNumber(data.wellness.hrv)
    || hasNumber(data.wellness.restingHR)
    || hasNumber(data.wellness.sleepMinutes)
    || hasNumber(data.wellness.readiness)
}

export function hasFitnessData(data: DashboardData) {
  return hasNumber(data.fitness.ctl) || hasNumber(data.fitness.atl) || hasNumber(data.fitness.tsb)
}

export function hasPowerData(data: DashboardData) {
  return data.power.curves.length > 0 || hasNumber(data.power.ftp)
}

export function availablePages(data: DashboardData): PageId[] {
  const pages: PageId[] = ['today']
  if (hasActivityData(data)) pages.push('activity')
  if (hasFitnessData(data)) pages.push('fitness')
  if (hasPowerData(data)) pages.push('power')
  if (hasWellnessData(data)) pages.push('wellness')
  pages.push('calendar')
  pages.push('data-sources')
  return pages
}

export function availableMetricCount(data: DashboardData) {
  const all: (number | null)[] = [
    data.fitness.ctl, data.fitness.atl, data.fitness.tsb,
    data.activity.todayLoad,
    data.wellness.hrv, data.wellness.restingHR, data.wellness.sleepMinutes,
    data.wellness.readiness, data.wellness.vo2max, data.wellness.bodyFat,
    data.wellness.weight, data.wellness.spO2,
    data.power.ftp, data.power.eftp, data.power.vo2max5m,
  ]
  return all.filter(hasNumber).length
}

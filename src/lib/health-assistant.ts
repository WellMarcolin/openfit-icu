import type { DashboardData, PageId } from '@/types'

export interface AssistantNavigation {
  page?: PageId
  date?: string
}

function hasValue(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value)
}

export function buildHealthAssistantContext(
  data: DashboardData,
  _archive: DashboardData[],
  _currentPage: PageId
): string {
  const ctx: Record<string, any> = {
    athlete: {
      name: data.profile.displayName,
      weight: data.profile.weight,
      ftp: data.profile.ftp,
      eftp: data.profile.eftp,
      resting_hr: data.profile.restingHR,
      sports: data.profile.sports,
    },
    fitness: {
      ctl: data.fitness.ctl,
      atl: data.fitness.atl,
      tsb: data.fitness.tsb,
      ramp_rate: data.fitness.rampRate,
      ctl_history: data.fitness.ctlHistory.slice(-30),
      atl_history: data.fitness.atlHistory.slice(-30),
      tsb_history: data.fitness.tsbHistory.slice(-30),
    },
    activity: {
      today_load: data.activity.todayLoad,
      today_activities: data.activity.todayActivities.map((a) => ({
        name: a.name,
        type: a.type,
        moving_time: a.movingTime,
        distance_km: a.distance,
        training_load: a.trainingLoad,
        intensity: a.intensity,
        avg_power: a.avgPower,
        avg_hr: a.avgHeartRate,
      })),
      recent_activities: data.activities.slice(0, 5).map((a) => ({
        name: a.name,
        type: a.type,
        date: a.startDate,
        training_load: a.trainingLoad,
      })),
    },
    wellness: {
      weight: data.wellness.weight,
      resting_hr: data.wellness.restingHR,
      hrv: data.wellness.hrv,
      sleep_minutes: data.wellness.sleepMinutes,
      sleep_score: data.wellness.sleepScore,
      mood: data.wellness.mood,
      stress: data.wellness.stress,
      fatigue: data.wellness.fatigue,
      readiness: data.wellness.readiness,
      spo2: data.wellness.spO2,
    },
    power: {
      ftp: data.power.ftp,
      eftp: data.power.eftp,
      vo2max_5m: data.power.vo2max5m,
      wkg_5m: data.power.wkg5m,
      curve_points: data.power.curves.slice(0, 7).map((c) => ({
        secs: c.secs,
        watts: c.watts,
        wkg: c.wattsPerKg,
      })),
    },
    events: data.events.slice(0, 5).map((e) => ({
      name: e.name,
      type: e.type,
      date: e.startDate,
      category: e.category,
    })),
    selected_date: data.selectedDate,
  }

  return JSON.stringify(ctx, null, 2)
}

export function parseAssistantNavigation(text: string): AssistantNavigation | null {
  const match = text.match(/<!--\s*openfit-icu:navigate\s+(\{.*?\})\s*-->/)
  if (!match) return null

  try {
    const parsed = JSON.parse(match[1])
    if (parsed.page || parsed.date) {
      return { page: parsed.page, date: parsed.date }
    }
  } catch {
    // Invalid JSON in navigation directive
  }

  return null
}

export function stripAssistantNavigation(text: string): string {
  return text.replace(/<!--\s*openfit-icu:navigate\s+\{.*?\}\s*-->/g, '').trim()
}

export function visibleAssistantText(text: string): string | null {
  const stripped = stripAssistantNavigation(text)
  return stripped || null
}

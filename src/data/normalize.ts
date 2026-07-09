import type {
  ActivityItem,
  CalendarEvent,
  DashboardData,
  PowerCurvePoint,
  TrendPoint,
} from '../types'

type Json = Record<string, any>

const asObject = (value: unknown): Json => (value && typeof value === 'object' ? value as Json : {})
const numeric = (value: unknown): number | null => {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function shortDay(date: string) {
  const parsed = new Date(`${date}T12:00:00`)
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(parsed).replace('.', '')
}

export interface IntervalsIcuPayload {
  athlete?: Json
  activities?: Json[]
  wellness?: Json[]
  powerCurves?: Json[]
  events?: Json[]
  date: string
  generatedAt: string
}

function normalizeActivity(raw: Json): ActivityItem {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? 'Unnamed activity'),
    type: String(raw.type ?? 'Ride'),
    startDate: String(raw.start_date_local ?? raw.start_date ?? ''),
    movingTime: numeric(raw.moving_time) ?? 0,
    distance: numeric(raw.distance) ? Number((raw.distance / 1000).toFixed(2)) : null,
    trainingLoad: numeric(raw.icu_training_load),
    ftp: numeric(raw.icu_ftp),
    intensity: numeric(raw.icu_intensity),
    avgPower: numeric(raw.average_watts),
    weightedAvgPower: numeric(raw.icu_weighted_avg_watts),
    avgHeartRate: numeric(raw.average_heartrate),
    maxHeartRate: numeric(raw.max_heartrate),
    avgCadence: numeric(raw.average_cadence),
    calories: numeric(raw.calories),
    elevationGain: numeric(raw.total_elevation_gain),
    trainer: Boolean(raw.trainer),
    race: Boolean(raw.race),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    source: String(raw.source ?? ''),
    compliance: numeric(raw.compliance),
    variabilityIndex: numeric(raw.icu_variability_index),
    efficiencyFactor: numeric(raw.icu_efficiency_factor),
    decoupling: numeric(raw.decoupling),
    polarizationIndex: numeric(raw.polarization_index),
    zoneTimes: Array.isArray(raw.icu_zone_times) ? raw.icu_zone_times : null,
    hrZoneTimes: Array.isArray(raw.icu_hr_zones) ? raw.icu_hr_zones : null,
  }
}

function normalizeWellness(raw: Json): Partial<TrendPoint> {
  return {
    date: String(raw.id ?? ''),
    label: shortDay(String(raw.id ?? '')),
    trainingLoad: null,
    ctl: numeric(raw.ctl),
    atl: numeric(raw.atl),
    tsb: numeric(raw.ctl) !== null && numeric(raw.atl) !== null
      ? Number((numeric(raw.ctl)! - numeric(raw.atl)!).toFixed(1))
      : null,
    rampRate: numeric(raw.rampRate),
    weight: numeric(raw.weight),
    restingHR: numeric(raw.restingHR),
    hrv: numeric(raw.hrv),
    sleepMinutes: numeric(raw.sleepSecs) ? Math.round(numeric(raw.sleepSecs)! / 60) : null,
    sleepScore: numeric(raw.sleepScore),
    mood: numeric(raw.mood),
    stress: numeric(raw.stress),
    fatigue: numeric(raw.fatigue),
    motivation: numeric(raw.motivation),
    readiness: numeric(raw.readiness),
    spO2: numeric(raw.spO2),
    steps: numeric(raw.steps),
    eftp: null,
  }
}

function normalizePowerCurve(raw: Json): PowerCurvePoint {
  return {
    secs: numeric(raw.secs) ?? 0,
    watts: numeric(raw.watts) ?? 0,
    wattsPerKg: numeric(raw.watts_per_kg) ?? 0,
  }
}

function normalizeEvent(raw: Json): CalendarEvent {
  return {
    id: numeric(raw.id) ?? 0,
    startDate: String(raw.start_date_local ?? ''),
    name: String(raw.name ?? ''),
    type: String(raw.type ?? 'Ride'),
    category: raw.category as CalendarEvent['category'],
    movingTime: numeric(raw.moving_time),
    trainingLoad: numeric(raw.icu_training_load),
    indoor: Boolean(raw.indoor),
    description: raw.description ? String(raw.description) : null,
  }
}

export function normalizeIntervalsIcuData(payload: IntervalsIcuPayload): DashboardData {
  const athlete = asObject(payload.athlete)
  const activities = (payload.activities ?? []).map(normalizeActivity)
  const wellness = (payload.wellness ?? []).map(normalizeWellness)
  const powerCurves = (payload.powerCurves ?? []).map(normalizePowerCurve)
  const events = (payload.events ?? []).map(normalizeEvent)

  const latestWellness = wellness.at(-1) ?? {}
  const latestActivity = activities.at(0)

  const trends: TrendPoint[] = wellness.map((w) => ({
    date: w.date ?? '',
    label: w.label ?? '',
    trainingLoad: w.trainingLoad ?? null,
    ctl: w.ctl ?? null,
    atl: w.atl ?? null,
    tsb: w.tsb ?? null,
    rampRate: w.rampRate ?? null,
    weight: w.weight ?? null,
    restingHR: w.restingHR ?? null,
    hrv: w.hrv ?? null,
    sleepMinutes: w.sleepMinutes ?? null,
    sleepScore: w.sleepScore ?? null,
    mood: w.mood ?? null,
    stress: w.stress ?? null,
    fatigue: w.fatigue ?? null,
    motivation: w.motivation ?? null,
    readiness: w.readiness ?? null,
    spO2: w.spO2 ?? null,
    steps: w.steps ?? null,
    eftp: w.eftp ?? null,
  }))

  const todayActivities = activities.filter((a) => a.startDate === payload.date)
  const todayLoad = todayActivities.reduce((sum, a) => sum + (a.trainingLoad ?? 0), 0)

  return {
    source: 'intervals-icu',
    selectedDate: payload.date,
    generatedAt: payload.generatedAt,
    profile: {
      displayName: `${athlete.firstname ?? ''} ${athlete.lastname ?? ''}`.trim() || 'Athlete',
      avatar: null,
      weight: numeric(athlete.weight) ?? numeric(athlete.icu_weight),
      height: numeric(athlete.height),
      ftp: null,
      eftp: null,
      restingHR: numeric(athlete.icu_resting_hr),
      timezone: athlete.timezone ? String(athlete.timezone) : null,
      sports: [...new Set(activities.map(a => a.type))],
    },
    fitness: {
      ctl: latestWellness.ctl ?? null,
      atl: latestWellness.atl ?? null,
      tsb: latestWellness.tsb ?? null,
      rampRate: latestWellness.rampRate ?? null,
      ctlHistory: trends.filter((t) => t.ctl !== null).map((t) => ({ date: t.date, value: t.ctl! })),
      atlHistory: trends.filter((t) => t.atl !== null).map((t) => ({ date: t.date, value: t.atl! })),
      tsbHistory: trends.filter((t) => t.tsb !== null).map((t) => ({ date: t.date, value: t.tsb! })),
    },
    activity: {
      todayLoad: todayLoad > 0 ? todayLoad : null,
      todayActivities,
      weekLoad: activities.slice(0, 7).reduce((sum, a) => sum + (a.trainingLoad ?? 0), 0),
      weekActivities: Math.min(activities.length, 7),
      avgIntensity: latestActivity?.intensity ?? null,
      zoneMinutes: null,
    },
    wellness: {
      weight: latestWellness.weight ?? null,
      restingHR: latestWellness.restingHR ?? null,
      hrv: latestWellness.hrv ?? null,
      hrvSDNN: null,
      sleepMinutes: latestWellness.sleepMinutes ?? null,
      sleepScore: latestWellness.sleepScore ?? null,
      sleepQuality: null,
      avgSleepingHR: null,
      spO2: latestWellness.spO2 ?? null,
      mood: latestWellness.mood ?? null,
      stress: latestWellness.stress ?? null,
      fatigue: latestWellness.fatigue ?? null,
      motivation: latestWellness.motivation ?? null,
      soreness: null,
      readiness: latestWellness.readiness ?? null,
      vo2max: null,
      bodyFat: null,
      systolic: null,
      diastolic: null,
      hydration: null,
      kcalConsumed: null,
      respiration: null,
      steps: latestWellness.steps ?? null,
    },
    power: {
      curves: powerCurves,
      seasonCurves: [],
      ftp: null,
      eftp: null,
      vo2max5m: null,
      wkg5m: null,
    },
    trends,
    activities,
    events,
    insights: [],
    sync: {
      endpointCount: 5,
      successCount: 5,
      errors: [],
      lastSyncAt: payload.generatedAt,
    },
  }
}

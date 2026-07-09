export type PageId = 'today' | 'activity' | 'fitness' | 'power' | 'wellness' | 'calendar' | 'data-sources' | 'workouts'

export type DataSource = 'demo' | 'intervals-icu' | 'cache'

export type SportType = 'Ride' | 'Run' | 'Swim' | 'Walk' | 'Hike' | 'WeightTraining' | 'VirtualRide' | 'VirtualRun' | 'TrailRun' | 'GravelRide' | 'MountainBikeRide' | string

export interface TimePoint {
  time: string
  value: number
}

export interface TrendPoint {
  date: string
  label: string
  trainingLoad: number | null
  ctl: number | null
  atl: number | null
  tsb: number | null
  rampRate: number | null
  weight: number | null
  restingHR: number | null
  hrv: number | null
  sleepMinutes: number | null
  sleepScore: number | null
  mood: number | null
  stress: number | null
  fatigue: number | null
  motivation: number | null
  readiness: number | null
  spO2: number | null
  steps: number | null
  eftp: number | null
}

export interface ActivityItem {
  id: string
  name: string
  type: SportType
  startDate: string
  movingTime: number
  distance: number | null
  trainingLoad: number | null
  ftp: number | null
  intensity: number | null
  avgPower: number | null
  weightedAvgPower: number | null
  avgHeartRate: number | null
  maxHeartRate: number | null
  avgCadence: number | null
  calories: number | null
  elevationGain: number | null
  trainer: boolean
  race: boolean
  tags: string[]
  source: string
  compliance: number | null
  variabilityIndex: number | null
  efficiencyFactor: number | null
  decoupling: number | null
  polarizationIndex: number | null
  zoneTimes: number[] | null
  hrZoneTimes: number[] | null
}

export interface IntervalItem {
  id: number
  type: 'WORK' | 'RECOVERY'
  movingTime: number
  distance: number | null
  avgWatts: number | null
  maxWatts: number | null
  avgWattsKg: number | null
  intensity: number | null
  trainingLoad: number | null
  avgHeartRate: number | null
  maxHeartRate: number | null
  avgCadence: number | null
  zone: number | null
  label: string | null
}

export interface PowerCurvePoint {
  secs: number
  watts: number
  wattsPerKg: number
}

export interface CalendarEvent {
  id: number
  startDate: string
  name: string
  type: SportType
  category: 'WORKOUT' | 'RACE_A' | 'RACE_B' | 'RACE_C' | 'NOTE' | 'HOLIDAY' | 'SICK' | 'INJURED'
  movingTime: number | null
  trainingLoad: number | null
  indoor: boolean
  description: string | null
}

export interface DashboardData {
  source: DataSource
  selectedDate: string
  generatedAt: string
  profile: {
    displayName: string
    avatar: string | null
    weight: number | null
    height: number | null
    ftp: number | null
    eftp: number | null
    restingHR: number | null
    timezone: string | null
    sports: SportType[]
  }
  fitness: {
    ctl: number | null
    atl: number | null
    tsb: number | null
    rampRate: number | null
    ctlHistory: Array<{ date: string; value: number }>
    atlHistory: Array<{ date: string; value: number }>
    tsbHistory: Array<{ date: string; value: number }>
  }
  activity: {
    todayLoad: number | null
    todayActivities: ActivityItem[]
    weekLoad: number | null
    weekActivities: number | null
    avgIntensity: number | null
    zoneMinutes: number | null
  }
  wellness: {
    weight: number | null
    restingHR: number | null
    hrv: number | null
    hrvSDNN: number | null
    sleepMinutes: number | null
    sleepScore: number | null
    sleepQuality: number | null
    avgSleepingHR: number | null
    spO2: number | null
    mood: number | null
    stress: number | null
    fatigue: number | null
    motivation: number | null
    soreness: number | null
    readiness: number | null
    vo2max: number | null
    bodyFat: number | null
    systolic: number | null
    diastolic: number | null
    hydration: number | null
    kcalConsumed: number | null
    respiration: number | null
    steps: number | null
  }
  power: {
    curves: PowerCurvePoint[]
    seasonCurves: PowerCurvePoint[]
    ftp: number | null
    eftp: number | null
    vo2max5m: number | null
    wkg5m: number | null
  }
  trends: TrendPoint[]
  activities: ActivityItem[]
  events: CalendarEvent[]
  insights: Array<{
    id: string
    tone: 'green' | 'blue' | 'amber' | 'violet' | 'red'
    title: string
    body: string
  }>
  sync: {
    endpointCount: number
    successCount: number
    errors: Array<{ key: string; message: string }>
    lastSyncAt: string | null
  }
}

export interface AuthStatus {
  connected: boolean
  method: 'oauth' | 'apikey' | null
  athleteId: string | null
  athleteName: string | null
  lastSyncAt: string | null
}

export interface AssistantConfig {
  enabled: boolean
  model: string
  temperature: number
  systemPrompt: string
  includeFitness: boolean
  includeWellness: boolean
  includePowerCurves: boolean
  includeActivities: boolean
  maxActivities: number
  maxWellnessDays: number
}

export interface HealthAssistantStatus {
  available: boolean
  connected: boolean
  authenticated: boolean
  version: string | null
  error?: string
}

export type HealthAssistantEvent =
  | { requestId: string; type: 'delta'; delta: string }
  | { requestId: string; type: 'complete'; text?: string }
  | { requestId: string; type: 'error'; message: string }
  | { requestId: string; type: 'cancelled' }

export interface AppSettings {
  intervalsApiKey: string | null
  opencodeServerUrl: string | null
  opencodeUsername: string | null
}

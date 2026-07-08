import type { ActivityItem, CalendarEvent, DashboardData, PowerCurvePoint, TrendPoint } from '../types'

const dayMs = 86_400_000

function localIso(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function dateFromIso(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function seeded(index: number, salt: number) {
  return Math.sin(index * 12.9898 + salt * 78.233) * 0.5 + 0.5
}

function makeTrends(selectedDate: string): TrendPoint[] {
  const end = dateFromIso(selectedDate)
  const formatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(end.getTime() - (13 - index) * dayMs)
    const baseLoad = 60 + Math.sin(index * 0.8) * 25
    const trainingLoad = Math.round(baseLoad + seeded(index, 2) * 30)
    const ctl = 65 + index * 0.8 + seeded(index, 3) * 2
    const atl = 70 + Math.sin(index * 1.2) * 15 + seeded(index, 4) * 5
    const tsb = ctl - atl
    return {
      date: localIso(date),
      label: formatter.format(date).replace('.', ''),
      trainingLoad,
      ctl: Number(ctl.toFixed(1)),
      atl: Number(atl.toFixed(1)),
      tsb: Number(tsb.toFixed(1)),
      rampRate: Number((1.2 + seeded(index, 5) * 0.8).toFixed(2)),
      weight: Number((75.2 - index * 0.05 + seeded(index, 6) * 0.3).toFixed(1)),
      restingHR: Math.round(52 + seeded(index, 7) * 6),
      hrv: Math.round(45 + seeded(index, 8) * 15),
      sleepMinutes: Math.round(420 + seeded(index, 9) * 60),
      sleepScore: Math.round(75 + seeded(index, 10) * 15),
      mood: Math.round(3 + seeded(index, 11) * 2),
      stress: Math.round(2 + seeded(index, 12) * 2),
      fatigue: Math.round(2 + seeded(index, 13) * 2),
      motivation: Math.round(3 + seeded(index, 14) * 2),
      readiness: Number((65 + seeded(index, 15) * 20).toFixed(1)),
      spO2: Number((96.5 + seeded(index, 16) * 1.5).toFixed(1)),
      steps: Math.round(8000 + seeded(index, 17) * 4000),
      eftp: Math.round(280 + index * 0.5 + seeded(index, 18) * 2),
    }
  })
}

function makeActivities(selectedDate: string): ActivityItem[] {
  return [
    {
      id: 'ride-demo-1',
      name: 'Morning endurance ride',
      type: 'Ride',
      startDate: selectedDate,
      movingTime: 5400,
      distance: 85.4,
      trainingLoad: 78,
      ftp: 280,
      intensity: 0.82,
      avgPower: 228,
      weightedAvgPower: 245,
      avgHeartRate: 142,
      maxHeartRate: 168,
      avgCadence: 88,
      calories: 1250,
      elevationGain: 850,
      trainer: false,
      race: false,
      tags: ['endurance', 'zone2'],
      source: 'STRAVA',
      compliance: 0.95,
      variabilityIndex: 1.07,
      efficiencyFactor: 1.72,
      decoupling: 2.3,
      polarizationIndex: 78,
      zoneTimes: [1200, 2400, 1200, 400, 150, 50],
      hrZoneTimes: [800, 1800, 2000, 600, 200],
    },
    {
      id: 'ride-demo-2',
      name: 'Interval training',
      type: 'Ride',
      startDate: localIso(new Date(dateFromIso(selectedDate).getTime() - dayMs)),
      movingTime: 3600,
      distance: 52.3,
      trainingLoad: 95,
      ftp: 280,
      intensity: 0.95,
      avgPower: 265,
      weightedAvgPower: 285,
      avgHeartRate: 158,
      maxHeartRate: 182,
      avgCadence: 92,
      calories: 980,
      elevationGain: 420,
      trainer: false,
      race: false,
      tags: ['intervals', 'vo2max'],
      source: 'STRAVA',
      compliance: 1.02,
      variabilityIndex: 1.18,
      efficiencyFactor: 1.68,
      decoupling: 1.8,
      polarizationIndex: 65,
      zoneTimes: [600, 1200, 800, 600, 300, 100],
      hrZoneTimes: [400, 1000, 1400, 600, 200],
    },
    {
      id: 'run-demo-1',
      name: 'Easy recovery run',
      type: 'Run',
      startDate: localIso(new Date(dateFromIso(selectedDate).getTime() - 2 * dayMs)),
      movingTime: 2400,
      distance: 8.5,
      trainingLoad: 35,
      ftp: null,
      intensity: null,
      avgPower: null,
      weightedAvgPower: null,
      avgHeartRate: 138,
      maxHeartRate: 152,
      avgCadence: 172,
      calories: 520,
      elevationGain: 85,
      trainer: false,
      race: false,
      tags: ['recovery', 'easy'],
      source: 'STRAVA',
      compliance: 0.88,
      variabilityIndex: null,
      efficiencyFactor: null,
      decoupling: null,
      polarizationIndex: null,
      zoneTimes: null,
      hrZoneTimes: [1200, 900, 300, 0, 0],
    },
  ]
}

function makePowerCurves(): PowerCurvePoint[] {
  const durations = [5, 10, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600]
  const baseWatts = [1200, 1050, 950, 820, 680, 580, 480, 420, 380, 360, 340]
  return durations.map((secs, index) => ({
    secs,
    watts: baseWatts[index] + Math.round(seeded(index, 20) * 30),
    wattsPerKg: Number(((baseWatts[index] + seeded(index, 20) * 30) / 75.2).toFixed(2)),
  }))
}

function makeEvents(selectedDate: string): CalendarEvent[] {
  return [
    {
      id: 1,
      startDate: localIso(new Date(dateFromIso(selectedDate).getTime() + 2 * dayMs)),
      name: 'Threshold workout',
      type: 'Ride',
      category: 'WORKOUT',
      movingTime: 4800,
      trainingLoad: 85,
      indoor: false,
      description: '3x10min @ FTP with 5min recovery',
    },
    {
      id: 2,
      startDate: localIso(new Date(dateFromIso(selectedDate).getTime() + 7 * dayMs)),
      name: 'Local criterium',
      type: 'Ride',
      category: 'RACE_B',
      movingTime: 3600,
      trainingLoad: 120,
      indoor: false,
      description: 'Category B race - 60min + 5 laps',
    },
    {
      id: 3,
      startDate: localIso(new Date(dateFromIso(selectedDate).getTime() + 14 * dayMs)),
      name: 'Recovery week',
      type: 'Ride',
      category: 'NOTE',
      movingTime: null,
      trainingLoad: null,
      indoor: false,
      description: 'Reduce volume by 50%, focus on recovery',
    },
  ]
}

export function createDemoData(selectedDate = localIso()): DashboardData {
  const trends = makeTrends(selectedDate)
  const latest = trends.at(-1)!
  const activities = makeActivities(selectedDate)
  const powerCurves = makePowerCurves()
  const events = makeEvents(selectedDate)

  return {
    source: 'demo',
    selectedDate,
    generatedAt: new Date().toISOString(),
    profile: {
      displayName: 'Demo Athlete',
      avatar: null,
      weight: 75.2,
      height: 180,
      ftp: 280,
      eftp: 278,
      restingHR: 52,
      timezone: 'Europe/Rome',
      sports: ['Ride', 'Run'],
    },
    fitness: {
      ctl: latest.ctl,
      atl: latest.atl,
      tsb: latest.tsb,
      rampRate: latest.rampRate,
      ctlHistory: trends.map((t) => ({ date: t.date, value: t.ctl ?? 0 })),
      atlHistory: trends.map((t) => ({ date: t.date, value: t.atl ?? 0 })),
      tsbHistory: trends.map((t) => ({ date: t.date, value: t.tsb ?? 0 })),
    },
    activity: {
      todayLoad: activities[0]?.trainingLoad ?? null,
      todayActivities: activities.filter((a) => a.startDate === selectedDate),
      weekLoad: activities.slice(0, 3).reduce((sum, a) => sum + (a.trainingLoad ?? 0), 0),
      weekActivities: 3,
      avgIntensity: 0.85,
      zoneMinutes: 45,
    },
    wellness: {
      weight: latest.weight,
      restingHR: latest.restingHR,
      hrv: latest.hrv,
      hrvSDNN: (latest.hrv ?? 0) + 5,
      sleepMinutes: latest.sleepMinutes,
      sleepScore: latest.sleepScore,
      sleepQuality: 4,
      avgSleepingHR: 48,
      spO2: latest.spO2,
      mood: latest.mood,
      stress: latest.stress,
      fatigue: latest.fatigue,
      motivation: latest.motivation,
      soreness: 2,
      readiness: latest.readiness,
      vo2max: 52.5,
      bodyFat: 15.8,
      systolic: 118,
      diastolic: 72,
      hydration: 2800,
      kcalConsumed: 2450,
      respiration: 14.2,
      steps: latest.steps,
    },
    power: {
      curves: powerCurves,
      seasonCurves: powerCurves.map((c) => ({ ...c, watts: c.watts - 15, wattsPerKg: Number((c.wattsPerKg - 0.2).toFixed(2)) })),
      ftp: 280,
      eftp: 278,
      vo2max5m: 54.2,
      wkg5m: 6.38,
    },
    trends,
    activities,
    events,
    insights: [
      {
        id: 'fitness',
        tone: 'green',
        title: 'Fitness trending up',
        body: `CTL increased by ${((latest.ctl ?? 0) - (trends[0]?.ctl ?? 0)).toFixed(1)} over the last 14 days.`,
      },
      {
        id: 'form',
        tone: latest.tsb && latest.tsb > 0 ? 'blue' : 'amber',
        title: latest.tsb && latest.tsb > 0 ? 'Good form' : 'Building fatigue',
        body: `TSB is ${latest.tsb?.toFixed(1)}. ${latest.tsb && latest.tsb > 0 ? 'Ready for hard training.' : 'Consider recovery.'}`,
      },
      {
        id: 'hrv',
        tone: 'violet',
        title: 'HRV baseline',
        body: `${latest.hrv} ms: ${latest.hrv && latest.hrv > 50 ? 'within normal range' : 'slightly elevated'}.`,
      },
    ],
    sync: {
      endpointCount: 8,
      successCount: 8,
      errors: [],
      lastSyncAt: new Date().toISOString(),
    },
  }
}

export { localIso }

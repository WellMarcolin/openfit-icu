export interface Athlete {
  id: string
  name: string
  firstname: string
  lastname: string
  email: string
  sex: string
  city: string
  state: string
  country: string
  timezone: string
  weight: number
  height: number
  icu_weight: number
  icu_resting_hr: number
  icu_coach: boolean
  icu_date_of_birth: string
  plan: 'FREE' | 'PREMIUM' | 'SUPPORTER' | 'WHITELABEL'
  visibility: 'PRIVATE' | 'PUBLIC' | 'HIDDEN'
  status: 'ACTIVE' | 'DORMANT' | 'ARCHIVED'
}

export interface Activity {
  id: string
  name: string
  description: string
  type: string
  start_date_local: string
  start_date: string
  moving_time: number
  elapsed_time: number
  distance: number
  total_elevation_gain: number
  icu_training_load: number
  icu_ftp: number
  icu_weighted_avg_watts: number
  icu_intensity: number
  icu_joules: number
  icu_joules_above_ftp: number
  average_heartrate: number
  max_heartrate: number
  average_cadence: number
  average_speed: number
  max_speed: number
  calories: number
  trainer: boolean
  race: boolean
  commute: boolean
  sub_type: 'NONE' | 'COMMUTE' | 'WARMUP' | 'COOLDOWN' | 'RACE'
  source: string
  device_name: string
  power_meter: string
  tags: string[]
  icu_power_zones: number[]
  icu_hr_zones: number[]
  icu_zone_times: number[]
  decoupling: number
  polarization_index: number
  compliance: number
  icu_rpe: number
  feel: number
  session_rpe: number
  kg_lifted: number
  trimp: number
  strain_score: number
  icu_variability_index: number
  icu_efficiency_factor: number
}

export interface Wellness {
  id: string
  ctl: number
  atl: number
  rampRate: number
  weight: number
  restingHR: number
  hrv: number
  hrvSDNN: number
  sleepSecs: number
  sleepScore: number
  sleepQuality: number
  avgSleepingHR: number
  soreness: number
  fatigue: number
  stress: number
  mood: number
  motivation: number
  injury: number
  spO2: number
  systolic: number
  diastolic: number
  hydration: number
  readiness: number
  vo2max: number
  bodyFat: number
  steps: number
  respiration: number
  kcalConsumed: number
  carbohydrates: number
  protein: number
  fatTotal: number
  menstrualPhase: 'PERIOD' | 'FOLLICULAR' | 'OVULATING' | 'LUTEAL' | 'NONE'
  comments: string
}

export interface Event {
  id: number
  start_date_local: string
  end_date_local: string
  name: string
  description: string
  type: string
  category: 'WORKOUT' | 'RACE_A' | 'RACE_B' | 'RACE_C' | 'NOTE' | 'PLAN' | 'HOLIDAY' | 'SICK' | 'INJURED' | 'SET_EFTP' | 'FITNESS_DAYS' | 'SEASON_START' | 'TARGET' | 'SET_FITNESS'
  moving_time: number
  icu_training_load: number
  icu_ftp: number
  target: 'AUTO' | 'POWER' | 'HR' | 'PACE'
  indoor: boolean
  color: string
  uid: string
  external_id: string
  load_target: number
  time_target: number
  distance_target: number
  carbs_per_hour: number
  tags: string[]
  training_availability: 'NORMAL' | 'LIMITED' | 'UNAVAILABLE'
  file_contents: string
  file_contents_base64: string
}

export interface PowerCurve {
  id: string
  secs: number[]
  values: number[]
  watts_per_kg: number[]
  start_date_local: string
  end_date_local: string
  days: number
  weight: number
  powerModels: any[]
  activity_id: string[]
  ranks: any[]
  vo2max_5m: number
}

export interface Interval {
  id: number
  type: 'RECOVERY' | 'WORK'
  start_index: number
  end_index: number
  moving_time: number
  distance: number
  average_watts: number
  max_watts: number
  average_watts_kg: number
  intensity: number
  training_load: number
  joules: number
  joules_above_ftp: number
  average_heartrate: number
  max_heartrate: number
  average_cadence: number
  average_torque: number
  total_elevation_gain: number
  average_gradient: number
  zone: number
  wbal_start: number
  wbal_end: number
  decoupling: number
  label: string
}

export class IntervalsIcuClient {
  private baseUrl = 'https://intervals.icu/api/v1'
  
  constructor(
    private accessToken: string,
    private athleteId: string = '0'
  ) {}

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    }

    const response = await fetch(url, { ...options, headers })
    
    if (!response.ok) {
      throw new Error(`Intervals.icu API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async getAthlete(): Promise<Athlete> {
    return this.request<Athlete>(`/athlete/${this.athleteId}`)
  }

  async getActivities(oldest: string, newest?: string, limit?: number): Promise<Activity[]> {
    const params = new URLSearchParams({ oldest })
    if (newest) params.append('newest', newest)
    if (limit) params.append('limit', limit.toString())
    
    return this.request<Activity[]>(`/athlete/${this.athleteId}/activities?${params}`)
  }

  async getActivity(id: string): Promise<Activity> {
    return this.request<Activity>(`/activity/${id}`)
  }

  async getActivityStreams(id: string): Promise<any> {
    return this.request(`/activity/${id}/streams`)
  }

  async getActivityIntervals(id: string): Promise<Interval[]> {
    return this.request<Interval[]>(`/activity/${id}/intervals`)
  }

  async getWellness(date: string): Promise<Wellness> {
    return this.request<Wellness>(`/athlete/${this.athleteId}/wellness/${date}`)
  }

  async getPowerCurves(type: string, curves?: string): Promise<PowerCurve[]> {
    const params = new URLSearchParams({ type })
    if (curves) params.append('curves', curves)
    
    return this.request<PowerCurve[]>(`/athlete/${this.athleteId}/power-curves?${params}`)
  }

  async getEvents(oldest: string, newest?: string, category?: string): Promise<Event[]> {
    const params = new URLSearchParams({ oldest })
    if (newest) params.append('newest', newest)
    if (category) params.append('category', category)
    
    return this.request<Event[]>(`/athlete/${this.athleteId}/events?${params}`)
  }

  async getSportSettings(): Promise<any> {
    return this.request(`/athlete/${this.athleteId}/sport-settings`)
  }
}

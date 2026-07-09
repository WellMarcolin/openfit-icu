export interface StepTarget {
  type: 'power' | 'hr' | 'pace' | 'cadence'
  value: number
  units: '%ftp' | 'w' | '%hr' | '%lthr' | '%pace' | 'cadence' | 'power_zone' | 'hr_zone' | 'pace_zone'
  start?: number
  end?: number
}

export interface WorkoutStep {
  id: string
  label: string
  type: 'step' | 'repeat' | 'freeride'
  duration: number | null
  distance: number | null
  target: StepTarget | null
  reps: number | null
  children: WorkoutStep[]
  flags: ('warmup' | 'cooldown')[]
  ramp: boolean
}

export interface WorkoutDocStep {
  text?: string
  duration?: number
  distance?: number
  warmup?: boolean
  cooldown?: boolean
  freeride?: boolean
  ramp?: boolean
  reps?: number
  steps?: WorkoutDocStep[]
  power?: Record<string, unknown>
  hr?: Record<string, unknown>
  pace?: Record<string, unknown>
  cadence?: Record<string, unknown>
}

export interface WorkoutDoc {
  description?: string
  steps?: WorkoutDocStep[]
  duration?: number
  distance?: number
}

let nextId = 1
export function generateStepId(): string {
  return String(nextId++)
}

export function defaultStep(): WorkoutStep {
  return {
    id: generateStepId(),
    label: '',
    type: 'step',
    duration: 5,
    distance: null,
    target: null,
    reps: null,
    children: [],
    flags: [],
    ramp: false,
  }
}

function convertTarget(target: StepTarget): Record<string, unknown> {
  const result: Record<string, unknown> = { value: target.value, units: target.units }
  if (target.start !== undefined) result.start = target.start
  if (target.end !== undefined) result.end = target.end
  return result
}

function convertStep(s: WorkoutStep): WorkoutDocStep {
  const step: WorkoutDocStep = {}
  if (s.label) step.text = s.label
  if (s.duration) step.duration = Math.round(s.duration * 60)
  if (s.distance) step.distance = s.distance
  if (s.flags.includes('warmup')) step.warmup = true
  if (s.flags.includes('cooldown')) step.cooldown = true
  if (s.type === 'freeride') step.freeride = true
  if (s.ramp) step.ramp = true
  if (s.reps && s.type === 'repeat') {
    step.reps = s.reps
    step.steps = s.children.map(convertStep)
  }
  if (s.target) {
    step[s.target.type] = convertTarget(s.target)
  }
  return step
}

export function buildWorkoutDoc(steps: WorkoutStep[]): WorkoutDoc | undefined {
  if (!steps.length) return undefined
  return { steps: steps.map(convertStep) }
}

function parseICUUnit(units: string): StepTarget['units'] {
  const valid: StepTarget['units'][] = ['%ftp', 'w', '%hr', '%lthr', '%pace', 'cadence', 'power_zone', 'hr_zone', 'pace_zone']
  return valid.includes(units as StepTarget['units']) ? (units as StepTarget['units']) : '%ftp'
}

function parseICUStep(step: WorkoutDocStep, parentId: string): WorkoutStep {
  const id = generateStepId()
  const targetTypes = ['power', 'hr', 'pace', 'cadence'] as const
  let target: StepTarget | null = null
  for (const t of targetTypes) {
    const v = step[t]
    if (v && typeof v === 'object') {
      target = {
        type: t,
        value: Number(v.value ?? 0),
        units: parseICUUnit(String(v.units ?? '%ftp')),
        start: v.start !== undefined ? Number(v.start) : undefined,
        end: v.end !== undefined ? Number(v.end) : undefined,
      }
      break
    }
  }

  const flags: ('warmup' | 'cooldown')[] = []
  if (step.warmup) flags.push('warmup')
  if (step.cooldown) flags.push('cooldown')

  const isRepeat = step.reps !== undefined && step.reps !== null
  const isFreeride = step.freeride === true

  return {
    id,
    label: step.text ?? '',
    type: isRepeat ? 'repeat' : isFreeride ? 'freeride' : 'step',
    duration: step.duration ? Math.round(step.duration / 60) : null,
    distance: step.distance ?? null,
    target,
    reps: step.reps ?? null,
    children: step.steps ? step.steps.map((cs, i) => parseICUStep(cs, `${id}-${i}`)) : [],
    flags,
    ramp: step.ramp === true,
  }
}

export function parseWorkoutDoc(doc: WorkoutDoc | null | undefined): WorkoutStep[] {
  if (!doc?.steps) return []
  return doc.steps.map((s, i) => parseICUStep(s, `root-${i}`))
}

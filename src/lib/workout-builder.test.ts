import { describe, it, expect } from 'vitest'
import { buildWorkoutDoc, parseWorkoutDoc, defaultStep } from './workout-builder'
import type { WorkoutStep } from './workout-builder'

describe('buildWorkoutDoc', () => {
  it('returns undefined for empty steps', () => {
    expect(buildWorkoutDoc([])).toBeUndefined()
  })

  it('converts a simple step to workout_doc format', () => {
    const steps: WorkoutStep[] = [
      {
        id: '1',
        label: 'Warmup',
        type: 'step',
        duration: 10,
        distance: null,
        target: { type: 'power', value: 80, units: '%ftp' },
        reps: null,
        children: [],
        flags: ['warmup'],
        ramp: false,
      },
    ]
    const doc = buildWorkoutDoc(steps)
    expect(doc).toEqual({
      steps: [
        {
          text: 'Warmup',
          duration: 600,
          warmup: true,
          power: { value: 80, units: '%ftp' },
        },
      ],
    })
  })

  it('converts a repeat step with children', () => {
    const steps: WorkoutStep[] = [
      {
        id: '1',
        label: 'Intervals',
        type: 'repeat',
        duration: null,
        distance: null,
        target: null,
        reps: 3,
        children: [
          {
            id: '1-1',
            label: 'Hard',
            type: 'step',
            duration: 5,
            distance: null,
            target: { type: 'power', value: 110, units: '%ftp' },
            reps: null,
            children: [],
            flags: [],
            ramp: false,
          },
          {
            id: '1-2',
            label: 'Easy',
            type: 'step',
            duration: 2,
            distance: null,
            target: { type: 'power', value: 70, units: '%ftp' },
            reps: null,
            children: [],
            flags: [],
            ramp: false,
          },
        ],
        flags: [],
        ramp: false,
      },
    ]
    const doc = buildWorkoutDoc(steps)
    expect(doc).toEqual({
      steps: [{
        text: 'Intervals',
        reps: 3,
        steps: [
          { text: 'Hard', duration: 300, power: { value: 110, units: '%ftp' } },
          { text: 'Easy', duration: 120, power: { value: 70, units: '%ftp' } },
        ],
      }],
    })
  })

  it('converts a step with ramp target', () => {
    const steps: WorkoutStep[] = [
      {
        id: '1',
        label: 'Ramp',
        type: 'step',
        duration: 10,
        distance: null,
        target: { type: 'power', value: 80, units: '%ftp', start: 60, end: 90 },
        reps: null,
        children: [],
        flags: [],
        ramp: true,
      },
    ]
    const doc = buildWorkoutDoc(steps)
    expect(doc).toEqual({
      steps: [{
        text: 'Ramp',
        duration: 600,
        ramp: true,
        power: { value: 80, units: '%ftp', start: 60, end: 90 },
      }],
    })
  })

  it('converts a freeride step', () => {
    const steps: WorkoutStep[] = [
      {
        id: '1',
        label: 'Free ride',
        type: 'freeride',
        duration: 20,
        distance: null,
        target: { type: 'power', value: 75, units: '%ftp' },
        reps: null,
        children: [],
        flags: [],
        ramp: false,
      },
    ]
    const doc = buildWorkoutDoc(steps)
    expect(doc).toEqual({
      steps: [{
        text: 'Free ride',
        duration: 1200,
        freeride: true,
        power: { value: 75, units: '%ftp' },
      }],
    })
  })

  it('handles cooldown flag', () => {
    const steps: WorkoutStep[] = [
      {
        id: '1',
        label: 'Cool down',
        type: 'step',
        duration: 10,
        distance: null,
        target: null,
        reps: null,
        children: [],
        flags: ['cooldown'],
        ramp: false,
      },
    ]
    const doc = buildWorkoutDoc(steps)
    expect(doc).toEqual({
      steps: [{ text: 'Cool down', duration: 600, cooldown: true }],
    })
  })
})

describe('parseWorkoutDoc', () => {
  it('returns empty array for null/undefined', () => {
    expect(parseWorkoutDoc(null)).toEqual([])
    expect(parseWorkoutDoc(undefined)).toEqual([])
  })

  it('converts workout_doc back to WorkoutStep[]', () => {
    const doc = { steps: [{ text: 'Warmup', duration: 600, warmup: true, power: { value: 80, units: '%ftp' } }] }
    const steps = parseWorkoutDoc(doc)
    expect(steps).toHaveLength(1)
    expect(steps[0].label).toBe('Warmup')
    expect(steps[0].duration).toBe(10)
    expect(steps[0].flags).toContain('warmup')
    expect(steps[0].target?.value).toBe(80)
  })

  it('converts repeat steps', () => {
    const doc = { steps: [{ text: 'Intervals', reps: 3, steps: [{ text: 'Hard', duration: 300, power: { value: 110, units: '%ftp' } }] }] }
    const steps = parseWorkoutDoc(doc)
    expect(steps[0].type).toBe('repeat')
    expect(steps[0].reps).toBe(3)
    expect(steps[0].children).toHaveLength(1)
    expect(steps[0].children[0].duration).toBe(5)
  })
})

describe('defaultStep', () => {
  it('returns a step with default values', () => {
    const s = defaultStep()
    expect(s.type).toBe('step')
    expect(s.duration).toBe(5)
    expect(s.target).toBeNull()
    expect(s.flags).toEqual([])
    expect(s.children).toEqual([])
  })
})

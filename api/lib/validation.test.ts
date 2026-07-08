import { describe, expect, it } from 'vitest'
import { validateAthleteId, validateDateParam } from './validation'

describe('validateAthleteId', () => {
  it('accepts numeric string', () => {
    expect(validateAthleteId('12345')).toBe('12345')
  })

  it('accepts i-prefixed ID', () => {
    expect(validateAthleteId('i12345')).toBe('i12345')
  })

  it('defaults to "0" for undefined', () => {
    expect(validateAthleteId(undefined)).toBe('0')
  })

  it('takes first element from array', () => {
    expect(validateAthleteId(['i99', 'i100'])).toBe('i99')
  })

  it('rejects path traversal', () => {
    expect(() => validateAthleteId('../../admin')).toThrow('Invalid athlete ID')
  })

  it('rejects empty string with special chars', () => {
    expect(() => validateAthleteId('foo;bar')).toThrow('Invalid athlete ID')
  })
})

describe('validateDateParam', () => {
  it('accepts ISO date', () => {
    expect(validateDateParam('2026-07-08', 'oldest')).toBe('2026-07-08')
  })

  it('rejects non-date string', () => {
    expect(() => validateDateParam('not-a-date', 'oldest')).toThrow('Invalid oldest parameter')
  })

  it('returns empty string for undefined optional param', () => {
    expect(validateDateParam(undefined, 'newest')).toBe('')
  })
})

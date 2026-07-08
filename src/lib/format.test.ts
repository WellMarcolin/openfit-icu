import { describe, expect, it } from 'vitest'
import { formatDate, relativeTime, formatNumber, formatDecimal } from './format'

describe('format', () => {
  it('formatDate returns formatted string', () => {
    const result = formatDate('2026-07-08', { weekday: 'long', day: 'numeric', month: 'long' })
    expect(result).toContain('July')
    expect(result).toContain('8')
  })

  it('formatNumber returns number with commas', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
    expect(formatNumber(0)).toBe('0')
  })

  it('formatDecimal returns fixed decimal', () => {
    expect(formatDecimal(123.456, 1)).toBe('123.5')
    expect(formatDecimal(123.456, 2)).toBe('123.46')
  })

  it('relativeTime returns text', () => {
    const result = relativeTime(new Date().toISOString())
    expect(result).toBeTruthy()
  })
})

import { describe, expect, it } from 'vitest'
import { getAccessToken } from './proxy'

describe('getAccessToken', () => {
  it('returns token from cookies', () => {
    const req = { cookies: { access_token: 'abc123' } } as any
    expect(getAccessToken(req)).toBe('abc123')
  })

  it('returns null when no cookie', () => {
    const req = { cookies: {} } as any
    expect(getAccessToken(req)).toBeNull()
  })

  it('returns null when cookies undefined', () => {
    const req = {} as any
    expect(getAccessToken(req)).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { getAccessToken, getAuthMethod } from './proxy'

describe('getAccessToken', () => {
  it('returns token from cookies', () => {
    const req = { cookies: { access_token: 'abc123' } } as any
    expect(getAccessToken(req)).toEqual({ token: 'abc123', method: 'oauth' })
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

describe('getAccessToken with API Key', () => {
  it('returns API key when no OAuth token', () => {
    const req = { cookies: { intervals_api_key: 'api-key-456' } } as any
    expect(getAccessToken(req)).toEqual({ token: 'api-key-456', method: 'apikey' })
  })

  it('prefers OAuth token over API key', () => {
    const req = { cookies: { access_token: 'oauth-123', intervals_api_key: 'api-key-456' } } as any
    expect(getAccessToken(req)).toEqual({ token: 'oauth-123', method: 'oauth' })
  })

  it('returns null when no auth found', () => {
    const req = { cookies: {} } as any
    expect(getAccessToken(req)).toBeNull()
  })
})

describe('getAuthMethod', () => {
  it('returns "oauth" when access_token cookie exists', () => {
    const req = { cookies: { access_token: 'tok' } } as any
    expect(getAuthMethod(req)).toBe('oauth')
  })

  it('returns "apikey" when only api key cookie exists', () => {
    const req = { cookies: { intervals_api_key: 'key' } } as any
    expect(getAuthMethod(req)).toBe('apikey')
  })

  it('returns null when no auth cookies', () => {
    const req = { cookies: {} } as any
    expect(getAuthMethod(req)).toBeNull()
  })
})

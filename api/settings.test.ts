import { describe, it, expect } from 'vitest'
import { createMocks } from 'node-mocks-http'
import handler from './index'

describe('GET /api/settings', () => {
  it('returns stored settings from cookies', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/settings',
      cookies: {
        intervals_api_key: 'key-123',
        opencode_server_url: 'http://server:4096',
        opencode_username: 'admin',
      },
    })
    await handler(req as any, res as any)
    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data).toEqual({
      intervalsApiKey: 'key-123',
      opencodeServerUrl: 'http://server:4096',
      opencodeUsername: 'admin',
    })
  })

  it('returns nulls when no cookies set', async () => {
    const { req, res } = createMocks({ method: 'GET', url: '/api/settings' })
    await handler(req as any, res as any)
    const data = JSON.parse(res._getData())
    expect(data.intervalsApiKey).toBeNull()
    expect(data.opencodeServerUrl).toBeNull()
    expect(data.opencodeUsername).toBeNull()
  })

  it('rejects unsupported methods', async () => {
    const { req, res } = createMocks({ method: 'PUT', url: '/api/settings' })
    await handler(req as any, res as any)
    expect(res._getStatusCode()).toBe(404)
  })
})

describe('POST /api/settings', () => {
  it('stores values as cookies', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/settings',
      body: { intervalsApiKey: 'new-key', opencodeServerUrl: 'http://new:4096' },
    })
    await handler(req as any, res as any)
    expect(res._getStatusCode()).toBe(200)
    const cookies = res._getHeaders()['set-cookie']
    expect(cookies).toBeDefined()
    const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : cookies
    expect(cookieStr).toContain('intervals_api_key=new-key')
    expect(cookieStr).toContain('opencode_server_url=http://new:4096')
  })

  it('clears value when empty string sent', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/settings',
      body: { intervalsApiKey: '' },
    })
    await handler(req as any, res as any)
    const cookies = res._getHeaders()['set-cookie']
    const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : cookies
    expect(cookieStr).toContain('intervals_api_key=;')
    expect(cookieStr).toContain('Max-Age=0')
  })
})

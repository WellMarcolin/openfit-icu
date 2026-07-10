import { describe, it, expect, beforeEach } from 'vitest'
import { createMocks } from 'node-mocks-http'
import handler from './config'

describe('GET /api/assistant/config', () => {
  beforeEach(() => {
    delete process.env.OPENCODE_SERVER_URL
    delete process.env.OPENCODE_SERVER_USERNAME
    delete process.env.OPENCODE_SERVER_PASSWORD
  })

  it('returns config from cookies when no env vars', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      cookies: {
        opencode_server_url: 'http://cookie-server:4096',
        opencode_username: 'user',
        opencode_password: 'pass',
      },
    })
    await handler(req as any, res as any)
    const data = JSON.parse(res._getData())
    expect(data.available).toBe(true)
    expect(data.serverConfigured).toBe(true)
  })

  it('prefers env vars over cookies', async () => {
    process.env.OPENCODE_SERVER_URL = 'http://env-server:4096'
    process.env.OPENCODE_SERVER_USERNAME = 'env-user'
    process.env.OPENCODE_SERVER_PASSWORD = 'env-pass'
    const { req, res } = createMocks({
      method: 'GET',
      cookies: { opencode_server_url: 'http://cookie:4096' },
    })
    await handler(req as any, res as any)
    const data = JSON.parse(res._getData())
    expect(data.available).toBe(true)
  })
})

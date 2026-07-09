import { describe, it, expect, vi, beforeAll } from 'vitest'

const mockProxy = vi.fn()
vi.mock('../../lib/proxy', () => ({
  getValidAccessToken: vi.fn(),
  proxyToIntervalsIcu: (...args: unknown[]) => mockProxy(...args),
}))

import { getValidAccessToken } from '../../lib/proxy'

function createMockReqRes(method: string, query: Record<string, unknown> = {}) {
  const req = { method, query, cookies: {} } as any
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
  } as any
  return { req, res }
}

describe('GET /api/data/workouts/[id]', () => {
  it('returns 200 with workout detail on success', async () => {
    ;(getValidAccessToken as any).mockResolvedValue('token')
    const { req, res } = createMockReqRes('GET', { id: '42' })
    mockProxy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 42, name: 'Test', workout_doc: { steps: [] } }),
    })
    const handler = (await import('./[id]')).default
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }))
  })

  it('returns 401 without auth', async () => {
    ;(getValidAccessToken as any).mockResolvedValue(null)
    const { req, res } = createMockReqRes('GET', { id: '42' })
    const handler = (await import('./[id]')).default
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('returns 400 with missing id', async () => {
    ;(getValidAccessToken as any).mockResolvedValue('token')
    const { req, res } = createMockReqRes('GET', {})
    const handler = (await import('./[id]')).default
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })
})
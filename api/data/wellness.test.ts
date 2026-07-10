import { describe, expect, it, vi, beforeEach } from 'vitest'

const { mockGetValidAccessToken, mockProxyToIntervalsIcu } = vi.hoisted(() => ({
  mockGetValidAccessToken: vi.fn(),
  mockProxyToIntervalsIcu: vi.fn(),
}))

vi.mock('../lib/proxy', () => ({
  getValidAccessToken: mockGetValidAccessToken,
  proxyToIntervalsIcu: mockProxyToIntervalsIcu,
}))

import handler from '../index'

function mockReq(overrides: Record<string, unknown> = {}) {
  return {
    method: 'GET',
    url: '/api/data/wellness',
    query: {},
    cookies: {},
    body: {},
    ...overrides,
  } as any
}

function mockRes() {
  const res: any = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  res.setHeader = vi.fn().mockReturnValue(res)
  return res
}

function mockResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(data),
  }
}

describe('wellness handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetValidAccessToken.mockResolvedValue('test-token')
  })

  describe('POST', () => {
    it('returns 200 with wellness data for valid request', async () => {
      const wellnessData = { date: '2024-01-15', weight: 75, restingHR: 48 }
      mockProxyToIntervalsIcu.mockResolvedValue(mockResponse(wellnessData))

      const req = mockReq({
        method: 'POST',
        query: { athleteId: '12345' },
        body: { date: '2024-01-15', weight: 75, restingHR: 48 },
      })
      const res = mockRes()

      await handler(req, res)

      expect(mockProxyToIntervalsIcu).toHaveBeenCalledWith(
        'test-token',
        '/athlete/12345/wellness',
        { method: 'POST', body: { date: '2024-01-15', weight: 75, restingHR: 48 } }
      )
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(wellnessData)
    })

    it('returns 400 when body is missing', async () => {
      const req = mockReq({
        method: 'POST',
        query: { athleteId: '12345' },
        body: null,
      })
      const res = mockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing request body' })
    })

    it('returns 400 when date is missing', async () => {
      const req = mockReq({
        method: 'POST',
        query: { athleteId: '12345' },
        body: { weight: 75 },
      })
      const res = mockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing required field: date' })
    })

    it('returns 400 when date format is invalid', async () => {
      const req = mockReq({
        method: 'POST',
        query: { athleteId: '12345' },
        body: { date: 'not-a-date' },
      })
      const res = mockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid date format. Expected YYYY-MM-DD' })
    })

    it('returns 401 when not authenticated', async () => {
      mockGetValidAccessToken.mockResolvedValue(null)

      const req = mockReq({
        method: 'POST',
        query: { athleteId: '12345' },
        body: { date: '2024-01-15' },
      })
      const res = mockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' })
    })

    it('returns proxy error status when proxy fails', async () => {
      mockProxyToIntervalsIcu.mockResolvedValue(mockResponse(null, false, 500))

      const req = mockReq({
        method: 'POST',
        query: { athleteId: '12345' },
        body: { date: '2024-01-15' },
      })
      const res = mockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to save wellness' })
    })
  })

  describe('GET', () => {
    it('still works after POST addition', async () => {
      const wellnessData = [{ date: '2024-01-15', weight: 75 }]
      mockProxyToIntervalsIcu.mockResolvedValue(mockResponse(wellnessData))

      const req = mockReq({
        method: 'GET',
        query: { athleteId: '12345', oldest: '2024-01-01' },
      })
      const res = mockRes()

      await handler(req, res)

      expect(mockProxyToIntervalsIcu).toHaveBeenCalledWith(
        'test-token',
        '/athlete/12345/wellness?oldest=2024-01-01'
      )
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(wellnessData)
    })

    it('returns 400 when oldest param is missing', async () => {
      const req = mockReq({
        method: 'GET',
        query: { athleteId: '12345' },
      })
      const res = mockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing required parameter: oldest' })
    })
  })

  describe('other methods', () => {
    it('returns 404 for PUT (unregistered route)', async () => {
      const req = mockReq({
        method: 'PUT',
        url: '/api/data/wellness',
        query: { athleteId: '12345' },
      })
      const res = mockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ error: 'Not found' })
    })

    it('returns 404 for DELETE (unregistered route)', async () => {
      const req = mockReq({
        method: 'DELETE',
        url: '/api/data/wellness',
        query: { athleteId: '12345' },
      })
      const res = mockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ error: 'Not found' })
    })
  })
})

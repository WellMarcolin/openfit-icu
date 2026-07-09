import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getValidAccessToken, proxyToIntervalsIcu } from '../lib/proxy'
import { validateAthleteId } from '../lib/validation'

const VALID_SPORT_TYPES = new Set([
  'Ride', 'Run', 'Swim', 'Walk', 'Hike', 'WeightTraining',
  'VirtualRide', 'VirtualRun', 'TrailRun', 'GravelRide', 'MountainBikeRide',
])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const auth = await getValidAccessToken(req, res)
  if (!auth) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  let athleteId: string
  try {
    athleteId = validateAthleteId(req.query.athleteId)
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message })
  }

  const type = Array.isArray(req.query.type) ? req.query.type[0] : req.query.type || 'Ride'
  if (!VALID_SPORT_TYPES.has(type)) {
    return res.status(400).json({ error: `Invalid sport type: ${type}` })
  }

  try {
    const params = new URLSearchParams({ type })
    const response = await proxyToIntervalsIcu(
      auth,
      `/athlete/${athleteId}/power-curves?${params}`
    )

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch power curves' })
    }

    const curves = await response.json()
    return res.status(200).json(curves)
  } catch {
    return res.status(500).json({ error: 'Internal server error' })
  }
}

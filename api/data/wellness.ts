import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getValidAccessToken, proxyToIntervalsIcu } from '../lib/proxy'
import { validateAthleteId, validateDateParam } from '../lib/validation'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const accessToken = await getValidAccessToken(req, res)
  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  let athleteId: string
  let oldest: string
  let newest: string
  try {
    athleteId = validateAthleteId(req.query.athleteId)
    oldest = validateDateParam(req.query.oldest, 'oldest')
    newest = validateDateParam(req.query.newest, 'newest')
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message })
  }

  if (!oldest) {
    return res.status(400).json({ error: 'Missing required parameter: oldest' })
  }

  try {
    const params = new URLSearchParams({ oldest })
    if (newest) params.append('newest', newest)

    const response = await proxyToIntervalsIcu(
      accessToken,
      `/athlete/${athleteId}/wellness?${params}`
    )

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch wellness' })
    }

    const wellness = await response.json()
    return res.status(200).json(wellness)
  } catch {
    return res.status(500).json({ error: 'Internal server error' })
  }
}

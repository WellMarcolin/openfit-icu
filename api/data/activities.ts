import type { VercelRequest, VercelResponse } from '@vercel/node'
import { validateAthleteId, validateDateParam } from '../lib/validation'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const accessToken = req.cookies?.access_token

  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  let athleteId: string
  let oldest: string
  let newest: string
  const limit = req.query.limit as string

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
    if (limit) params.append('limit', limit)

    const response = await fetch(
      `https://intervals.icu/api/v1/athlete/${athleteId}/activities?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch activities' })
    }

    const activities = await response.json()
    return res.status(200).json(activities)
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' })
  }
}

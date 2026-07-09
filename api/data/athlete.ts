import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getValidAccessToken, proxyToIntervalsIcu } from '../lib/proxy'
import { validateAthleteId } from '../lib/validation'

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
    athleteId = validateAthleteId(req.query.id)
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message })
  }

  try {
    const response = await proxyToIntervalsIcu(auth, `/athlete/${athleteId}`)

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch athlete' })
    }

    const athlete = await response.json()
    return res.status(200).json(athlete)
  } catch {
    return res.status(500).json({ error: 'Internal server error' })
  }
}

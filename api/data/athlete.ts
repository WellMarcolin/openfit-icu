import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const accessToken = req.cookies?.access_token
  const athleteId = req.query.id || '0'

  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    const response = await fetch(`https://intervals.icu/api/v1/athlete/${athleteId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch athlete' })
    }

    const athlete = await response.json()
    return res.status(200).json(athlete)
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' })
  }
}

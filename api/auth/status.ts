import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAccessToken, proxyToIntervalsIcu } from '../lib/proxy'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const accessToken = getAccessToken(req)
  if (!accessToken) {
    return res.status(200).json({ connected: false })
  }

  try {
    const response = await proxyToIntervalsIcu(accessToken, '/athlete')
    if (!response.ok) {
      return res.status(200).json({ connected: false })
    }

    const athlete = await response.json()
    return res.status(200).json({
      connected: true,
      method: 'oauth',
      athleteId: String(athlete.id ?? ''),
      athleteName: `${athlete.firstname ?? ''} ${athlete.lastname ?? ''}`.trim() || null,
      lastSyncAt: new Date().toISOString(),
    })
  } catch {
    return res.status(200).json({ connected: false })
  }
}

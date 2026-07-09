import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getValidAccessToken, proxyToIntervalsIcu } from '../../lib/proxy'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const accessToken = await getValidAccessToken(req, res)
  if (!accessToken) return res.status(401).json({ error: 'Not authenticated' })

  const { id } = req.query
  if (!id || Array.isArray(id)) return res.status(400).json({ error: 'Invalid workout ID' })

  if (req.method === 'PUT') {
    const response = await proxyToIntervalsIcu(accessToken, `/athlete/0/workouts/${id}`, {
      method: 'PUT',
      body: req.body,
    })
    if (!response.ok) return res.status(response.status).json({ error: 'Failed to update workout' })
    const workout = await response.json()
    return res.status(200).json(workout)
  }

  if (req.method === 'DELETE') {
    const response = await proxyToIntervalsIcu(accessToken, `/athlete/0/workouts/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) return res.status(response.status).json({ error: 'Failed to delete workout' })
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

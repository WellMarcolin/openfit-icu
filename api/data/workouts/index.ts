import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getValidAccessToken, proxyToIntervalsIcu } from '../../lib/proxy'
import { validateAthleteId } from '../../lib/validation'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await getValidAccessToken(req, res)
  if (!auth) return res.status(401).json({ error: 'Not authenticated' })

  let athleteId: string
  try { athleteId = validateAthleteId(req.query.athleteId) }
  catch (e) { return res.status(400).json({ error: (e as Error).message }) }

  if (req.method === 'GET') {
    const folderId = req.query.folderId ? String(req.query.folderId) : undefined
    const path = folderId
      ? `/athlete/${athleteId}/workouts?folder_id=${folderId}`
      : `/athlete/${athleteId}/workouts`
    const response = await proxyToIntervalsIcu(auth, path)
    if (!response.ok) return res.status(response.status).json({ error: 'Failed to fetch workouts' })
    const workouts = await response.json()
    return res.status(200).json(workouts)
  }

  if (req.method === 'POST') {
    const response = await proxyToIntervalsIcu(auth, `/athlete/${athleteId}/workouts`, {
      method: 'POST',
      body: req.body,
    })
    if (!response.ok) return res.status(response.status).json({ error: 'Failed to create workout' })
    const workout = await response.json()
    return res.status(201).json(workout)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

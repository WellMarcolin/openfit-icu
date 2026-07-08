import type { VercelRequest, VercelResponse } from '@vercel/node'
import { OpenCodeClient, type HealthContext } from '../../src/lib/opencode-client'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { message, context, sessionId } = req.body

  if (!message || !context) {
    return res.status(400).json({ error: 'Missing message or context' })
  }

  const serverUrl = process.env.OPENCODE_SERVER_URL
  const username = process.env.OPENCODE_SERVER_USERNAME
  const password = process.env.OPENCODE_SERVER_PASSWORD

  if (!serverUrl) {
    return res.status(500).json({ error: 'OpenCode server not configured' })
  }

  try {
    const client = new OpenCodeClient(serverUrl, username, password)
    
    if (sessionId) {
      client['sessionId'] = sessionId
    }

    const result = await client.sendMessage(message, context as HealthContext)

    return res.status(200).json(result)
  } catch (error) {
    console.error('Chat error:', error)
    return res.status(500).json({ error: 'Failed to process message' })
  }
}

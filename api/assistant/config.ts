import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const serverUrl = process.env.OPENCODE_SERVER_URL || req.cookies?.opencode_server_url
  const username = process.env.OPENCODE_SERVER_USERNAME || req.cookies?.opencode_username
  const password = process.env.OPENCODE_SERVER_PASSWORD || req.cookies?.opencode_password

  if (!serverUrl) {
    return res.status(200).json({
      available: false,
      serverConfigured: false,
      error: 'OpenCode server not configured',
    })
  }

  return res.status(200).json({
    available: true,
    serverConfigured: Boolean(serverUrl && username && password),
    model: process.env.OPENCODE_ZEN_MODEL || 'default',
  })
}

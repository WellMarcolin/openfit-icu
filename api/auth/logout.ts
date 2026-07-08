import type { VercelRequest, VercelResponse } from '@vercel/node'

const COOKIE_OPTIONS = 'HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  res.setHeader('Set-Cookie', [
    `access_token=; ${COOKIE_OPTIONS}`,
    `refresh_token=; ${COOKIE_OPTIONS}`,
    `pkce_verifier=; ${COOKIE_OPTIONS}`,
    `oauth_state=; ${COOKIE_OPTIONS}`,
  ])

  return res.status(200).json({ success: true })
}

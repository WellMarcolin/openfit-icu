import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const clientId = process.env.INTERVALS_ICU_CLIENT_ID
  const redirectUri = process.env.INTERVALS_ICU_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: 'OAuth configuration missing' })
  }

  const codeVerifier = crypto.randomBytes(32).toString('base64url')
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')
  const state = crypto.randomBytes(16).toString('hex')

  res.setHeader('Set-Cookie', [
    `pkce_verifier=${codeVerifier}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
    `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
  ])

  const authUrl = new URL('https://intervals.icu/oauth/authorize')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('state', state)

  return res.redirect(authUrl.toString())
}

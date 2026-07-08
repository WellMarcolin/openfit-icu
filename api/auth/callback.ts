import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { code, state } = req.query
  const storedState = req.cookies?.oauth_state
  const codeVerifier = req.cookies?.pkce_verifier

  if (!code || !state || !storedState || !codeVerifier) {
    return res.status(400).json({ error: 'Missing OAuth parameters' })
  }

  if (state !== storedState) {
    return res.status(400).json({ error: 'Invalid state parameter' })
  }

  const clientId = process.env.INTERVALS_ICU_CLIENT_ID
  const clientSecret = process.env.INTERVALS_ICU_CLIENT_SECRET
  const redirectUri = process.env.INTERVALS_ICU_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    return res.status(500).json({ error: 'OAuth configuration missing' })
  }

  try {
    const tokenResponse = await fetch('https://intervals.icu/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret
      })
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text()
      return res.status(400).json({ error: `Token exchange failed: ${error}` })
    }

    const tokens = await tokenResponse.json()

    res.setHeader('Set-Cookie', [
      `access_token=${tokens.access_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${tokens.expires_in || 3600}`,
      `refresh_token=${tokens.refresh_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`,
      `pkce_verifier=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
      `oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
    ])

    return res.redirect('/')
  } catch (error) {
    return res.status(500).json({ error: 'Token exchange error' })
  }
}

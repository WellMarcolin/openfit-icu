import type { VercelRequest, VercelResponse } from '@vercel/node'

const INTERVALS_ICU_BASE = 'https://intervals.icu/api/v1'

export function getAuthMethod(req: VercelRequest): 'oauth' | 'apikey' | null {
  if (req.cookies?.access_token) return 'oauth'
  if (req.cookies?.intervals_api_key) return 'apikey'
  return null
}

export function getAccessToken(req: VercelRequest): { token: string; method: 'oauth' | 'apikey' } | null {
  if (req.cookies?.access_token) {
    return { token: req.cookies.access_token, method: 'oauth' }
  }
  if (req.cookies?.intervals_api_key) {
    return { token: req.cookies.intervals_api_key, method: 'apikey' }
  }
  return null
}

export async function proxyToIntervalsIcu(
  auth: { token: string; method: 'oauth' | 'apikey' },
  path: string,
  options?: { method?: string; body?: unknown }
): Promise<Response> {
  const httpMethod = options?.method ?? 'GET'
  const body = options?.body !== undefined ? JSON.stringify(options.body) : undefined

  const authHeader = auth.method === 'apikey'
    ? { 'X-API-Key': auth.token }
    : { 'Authorization': `Bearer ${auth.token}` }

  return fetch(`${INTERVALS_ICU_BASE}${path}`, {
    method: httpMethod,
    headers: {
      ...authHeader,
      'Content-Type': 'application/json',
    },
    body,
  })
}

export async function getValidAccessToken(
  req: VercelRequest,
  res: VercelResponse
): Promise<{ token: string; method: 'oauth' | 'apikey' } | null> {
  const auth = getAccessToken(req)
  if (!auth) return null

  // API keys don't expire — no refresh needed
  if (auth.method === 'apikey') return auth

  // OAuth token — check expiry and refresh if needed
  const refreshToken = req.cookies?.refresh_token
  if (!refreshToken) return auth

  try {
    const testResponse = await proxyToIntervalsIcu(auth, '/athlete')
    if (testResponse.ok || testResponse.status !== 401) {
      return auth
    }
  } catch {
    // Token might be expired, try refresh
  }

  const clientId = process.env.INTERVALS_ICU_CLIENT_ID
  const clientSecret = process.env.INTERVALS_ICU_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  try {
    const tokenResponse = await fetch('https://intervals.icu/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    if (!tokenResponse.ok) return null

    const tokens = await tokenResponse.json()
    const maxAge = tokens.expires_in || 3600

    res.setHeader('Set-Cookie', [
      `access_token=${tokens.access_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`,
      `refresh_token=${tokens.refresh_token ?? refreshToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`,
    ])

    return { token: tokens.access_token, method: 'oauth' }
  } catch {
    return null
  }
}

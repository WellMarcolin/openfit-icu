import type { VercelRequest, VercelResponse } from '@vercel/node'

const INTERVALS_ICU_BASE = 'https://intervals.icu/api/v1'

export function getAccessToken(req: VercelRequest): string | null {
  return req.cookies?.access_token ?? null
}

export async function proxyToIntervalsIcu(
  accessToken: string,
  path: string,
  options?: { method?: string; body?: unknown }
): Promise<Response> {
  const method = options?.method ?? 'GET'
  const body = options?.body !== undefined ? JSON.stringify(options.body) : undefined

  return fetch(`${INTERVALS_ICU_BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body,
  })
}

export async function getValidAccessToken(req: VercelRequest, res: VercelResponse): Promise<string | null> {
  const accessToken = getAccessToken(req)
  if (!accessToken) return null

  const refreshToken = req.cookies?.refresh_token
  if (!refreshToken) return accessToken

  try {
    const testResponse = await proxyToIntervalsIcu(accessToken, '/athlete')
    if (testResponse.ok || testResponse.status !== 401) {
      return accessToken
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

    return tokens.access_token
  } catch {
    return null
  }
}

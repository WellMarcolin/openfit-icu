import type { VercelRequest } from '@vercel/node'

const INTERVALS_ICU_BASE = 'https://intervals.icu/api/v1'

export function getAccessToken(req: VercelRequest): string | null {
  return req.cookies?.access_token ?? null
}

export async function proxyToIntervalsIcu(accessToken: string, path: string): Promise<Response> {
  return fetch(`${INTERVALS_ICU_BASE}${path}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })
}

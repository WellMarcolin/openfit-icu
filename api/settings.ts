import type { VercelRequest, VercelResponse } from '@vercel/node'

const COOKIE_OPTIONS = 'HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000'
const CLEAR_COOKIE_OPTIONS = 'HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'

function makeCookie(name: string, value: string): string {
  const options = value === '' ? CLEAR_COOKIE_OPTIONS : COOKIE_OPTIONS
  return `${name}=${value}; ${options}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({
      intervalsApiKey: req.cookies?.intervals_api_key ?? null,
      opencodeServerUrl: req.cookies?.opencode_server_url ?? null,
      opencodeUsername: req.cookies?.opencode_username ?? null,
    })
  }

  if (req.method === 'POST') {
    const { intervalsApiKey, opencodeServerUrl, opencodeUsername, opencodePassword } = req.body
    const cookies: string[] = []

    if (intervalsApiKey !== undefined) {
      cookies.push(makeCookie('intervals_api_key', intervalsApiKey))
    }
    if (opencodeServerUrl !== undefined) {
      cookies.push(makeCookie('opencode_server_url', opencodeServerUrl))
    }
    if (opencodeUsername !== undefined) {
      cookies.push(makeCookie('opencode_username', opencodeUsername))
    }
    if (opencodePassword !== undefined) {
      cookies.push(makeCookie('opencode_password', opencodePassword))
    }

    if (cookies.length > 0) {
      res.setHeader('Set-Cookie', cookies)
    }

    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

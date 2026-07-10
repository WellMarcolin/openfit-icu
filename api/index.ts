import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'
import { getAccessToken, getValidAccessToken, proxyToIntervalsIcu } from './lib/proxy.js'
import { validateAthleteId, validateDateParam } from './lib/validation.js'
import { OpenCodeClient, type HealthContext } from './lib/opencode-client.js'

const VALID_SPORT_TYPES = new Set([
  'Ride', 'Run', 'Swim', 'Walk', 'Hike', 'WeightTraining',
  'VirtualRide', 'VirtualRun', 'TrailRun', 'GravelRide', 'MountainBikeRide',
])

const COOKIE_OPTIONS = 'HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000'
const CLEAR_COOKIE_OPTIONS = 'HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'

function makeCookie(name: string, value: string): string {
  return `${name}=${value}; ${value === '' ? CLEAR_COOKIE_OPTIONS : COOKIE_OPTIONS}`
}

function param(req: VercelRequest, name: string): string | undefined {
  const v = req.query[name]
  return Array.isArray(v) ? v[0] : v
}

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>

const routes: Record<string, Handler> = {}

function reg(method: string, path: string, fn: Handler) {
  routes[`${method} ${path}`] = fn
}

function parsePath(url: string | undefined): string {
  if (!url) return ''
  const q = url.indexOf('?')
  return q === -1 ? url : url.slice(0, q)
}

function match(apiPath: string): { fn?: Handler; params: Record<string, string> } {
  const exact = routes[apiPath]
  if (exact) return { fn: exact, params: {} }

  for (const [key, fn] of Object.entries(routes)) {
    const parts = key.split(' ')
    const pattern = parts.slice(1).join(' ') || parts[0]
    const methodPart = parts.length > 1 ? parts[0] : null

    const method = methodPart ? apiPath.split(' ')[0] : null
    if (methodPart && method !== methodPart) continue

    const pathOnly = methodPart ? apiPath.slice(methodPart.length + 1) : apiPath
    const paramNames: string[] = []
    const regexStr = pattern.replace(/:(\w+)/g, (_, n: string) => { paramNames.push(n); return '([^/]+)' })
    const re = new RegExp(`^${regexStr}$`)
    const m = pathOnly.match(re)
    if (m) {
      const params: Record<string, string> = {}
      paramNames.forEach((n, i) => { params[n] = m[i + 1] })
      return { fn, params }
    }
  }

  return { params: {} }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const method = req.method || 'GET'
  const path = parsePath(req.url)

  const routeKey = `${method} ${path}`
  const { fn, params } = match(routeKey)

  if (!fn) {
    return res.status(404).json({ error: 'Not found' })
  }

  Object.assign(req.query, params)

  try {
    await fn(req, res)
  } catch (err) {
    console.error('Unhandled error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// ── Settings ─────────────────────────────────────────────

reg('GET', '/api/settings', async (req, res) => {
  res.status(200).json({
    intervalsApiKey: req.cookies?.intervals_api_key ?? null,
    opencodeServerUrl: req.cookies?.opencode_server_url ?? null,
    opencodeUsername: req.cookies?.opencode_username ?? null,
  })
})

reg('POST', '/api/settings', async (req, res) => {
  const { intervalsApiKey, opencodeServerUrl, opencodeUsername, opencodePassword } = req.body
  const cookies: string[] = []
  if (intervalsApiKey !== undefined) cookies.push(makeCookie('intervals_api_key', intervalsApiKey))
  if (opencodeServerUrl !== undefined) cookies.push(makeCookie('opencode_server_url', opencodeServerUrl))
  if (opencodeUsername !== undefined) cookies.push(makeCookie('opencode_username', opencodeUsername))
  if (opencodePassword !== undefined) cookies.push(makeCookie('opencode_password', opencodePassword))
  if (cookies.length > 0) res.setHeader('Set-Cookie', cookies)
  res.status(200).json({ success: true })
})

// ── Auth ─────────────────────────────────────────────────

reg('GET', '/api/auth/login', async (req, res) => {
  const clientId = process.env.INTERVALS_ICU_CLIENT_ID
  const redirectUri = process.env.INTERVALS_ICU_REDIRECT_URI
  if (!clientId || !redirectUri) {
    res.status(500).json({ error: 'OAuth configuration missing' }); return
  }

  const codeVerifier = crypto.randomBytes(32).toString('base64url')
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')
  const state = crypto.randomBytes(16).toString('hex')

  res.setHeader('Set-Cookie', [
    `pkce_verifier=${codeVerifier}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
    `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
  ])

  const authUrl = new URL('https://intervals.icu/oauth/authorize')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('state', state)

  res.redirect(authUrl.toString())
})

reg('GET', '/api/auth/callback', async (req, res) => {
  const { code, state } = req.query
  const storedState = req.cookies?.oauth_state
  const codeVerifier = req.cookies?.pkce_verifier
  if (!code || !state || !storedState || !codeVerifier) {
    res.status(400).json({ error: 'Missing OAuth parameters' }); return
  }
  if (state !== storedState) {
    res.status(400).json({ error: 'Invalid state parameter' }); return
  }

  const clientId = process.env.INTERVALS_ICU_CLIENT_ID
  const clientSecret = process.env.INTERVALS_ICU_CLIENT_SECRET
  const redirectUri = process.env.INTERVALS_ICU_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    res.status(500).json({ error: 'OAuth configuration missing' }); return
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
        client_secret: clientSecret,
      }),
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text()
      res.status(400).json({ error: `Token exchange failed: ${error}` }); return
    }

    const tokens = await tokenResponse.json()
    res.setHeader('Set-Cookie', [
      `access_token=${tokens.access_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${tokens.expires_in || 3600}`,
      `refresh_token=${tokens.refresh_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`,
      `pkce_verifier=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
      `oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
    ])
    res.redirect('/')
  } catch {
    res.status(500).json({ error: 'Token exchange error' })
  }
})

reg('POST', '/api/auth/logout', async (req, res) => {
  res.setHeader('Set-Cookie', [
    `access_token=; ${CLEAR_COOKIE_OPTIONS}`,
    `refresh_token=; ${CLEAR_COOKIE_OPTIONS}`,
    `pkce_verifier=; ${CLEAR_COOKIE_OPTIONS}`,
    `oauth_state=; ${CLEAR_COOKIE_OPTIONS}`,
  ])
  res.status(200).json({ success: true })
})

reg('GET', '/api/auth/status', async (req, res) => {
  const accessToken = getAccessToken(req)
  if (!accessToken) {
    res.status(200).json({ connected: false }); return
  }

  try {
    const response = await proxyToIntervalsIcu(accessToken, '/athlete')
    if (!response.ok) {
      res.status(200).json({ connected: false }); return
    }

    const athlete = await response.json()
    res.status(200).json({
      connected: true,
      method: 'oauth',
      athleteId: String(athlete.id ?? ''),
      athleteName: `${athlete.firstname ?? ''} ${athlete.lastname ?? ''}`.trim() || null,
      lastSyncAt: new Date().toISOString(),
    })
  } catch {
    res.status(200).json({ connected: false })
  }
})

// ── Assistant ────────────────────────────────────────────

reg('GET', '/api/assistant/config', async (req, res) => {
  const serverUrl = process.env.OPENCODE_SERVER_URL || req.cookies?.opencode_server_url
  const username = process.env.OPENCODE_SERVER_USERNAME || req.cookies?.opencode_username
  const password = process.env.OPENCODE_SERVER_PASSWORD || req.cookies?.opencode_password

  if (!serverUrl) {
    res.status(200).json({ available: false, serverConfigured: false, error: 'OpenCode server not configured' })
    return
  }

  res.status(200).json({ available: true, serverConfigured: Boolean(serverUrl && username && password), model: process.env.OPENCODE_ZEN_MODEL || 'default' })
})

reg('POST', '/api/assistant/chat', async (req, res) => {
  const { message, context, sessionId } = req.body
  if (!message || !context) {
    res.status(400).json({ error: 'Missing message or context' }); return
  }

  const serverUrl = process.env.OPENCODE_SERVER_URL || req.cookies?.opencode_server_url
  const username = process.env.OPENCODE_SERVER_USERNAME || req.cookies?.opencode_username
  const password = process.env.OPENCODE_SERVER_PASSWORD || req.cookies?.opencode_password

  if (!serverUrl) {
    res.status(500).json({ error: 'OpenCode server not configured' }); return
  }

  try {
    const client = new OpenCodeClient(serverUrl, username, password)
    if (sessionId) client['sessionId'] = sessionId
    const result = await client.sendMessage(message, context as HealthContext)
    res.status(200).json(result)
  } catch (error) {
    console.error('Chat error:', error)
    res.status(500).json({ error: 'Failed to process message' })
  }
})

// ── Data: Athlete ────────────────────────────────────────

reg('GET', '/api/data/athlete', async (req, res) => {
  const auth = await getValidAccessToken(req, res)
  if (!auth) { res.status(401).json({ error: 'Not authenticated' }); return }

  let athleteId: string
  try { athleteId = validateAthleteId(req.query.id) }
  catch (e) { res.status(400).json({ error: (e as Error).message }); return }

  try {
    const response = await proxyToIntervalsIcu(auth, `/athlete/${athleteId}`)
    if (!response.ok) { res.status(response.status).json({ error: 'Failed to fetch athlete' }); return }
    res.status(200).json(await response.json())
  } catch { res.status(500).json({ error: 'Internal server error' }) }
})

// ── Data: Activities ─────────────────────────────────────

reg('GET', '/api/data/activities', async (req, res) => {
  const auth = await getValidAccessToken(req, res)
  if (!auth) { res.status(401).json({ error: 'Not authenticated' }); return }

  let athleteId: string, oldest: string, newest: string
  try {
    athleteId = validateAthleteId(req.query.athleteId)
    oldest = validateDateParam(req.query.oldest, 'oldest')
    newest = validateDateParam(req.query.newest, 'newest')
  } catch (e) { res.status(400).json({ error: (e as Error).message }); return }

  if (!oldest) { res.status(400).json({ error: 'Missing required parameter: oldest' }); return }

  try {
    const params = new URLSearchParams({ oldest })
    if (newest) params.append('newest', newest)
    if (req.query.limit) params.append('limit', req.query.limit as string)
    const response = await proxyToIntervalsIcu(auth, `/athlete/${athleteId}/activities?${params}`)
    if (!response.ok) { res.status(response.status).json({ error: 'Failed to fetch activities' }); return }
    res.status(200).json(await response.json())
  } catch { res.status(500).json({ error: 'Internal server error' }) }
})

// ── Data: Wellness ───────────────────────────────────────

reg('GET', '/api/data/wellness', async (req, res) => {
  const auth = await getValidAccessToken(req, res)
  if (!auth) { res.status(401).json({ error: 'Not authenticated' }); return }

  let athleteId: string, oldest: string, newest: string
  try {
    athleteId = validateAthleteId(req.query.athleteId)
    oldest = validateDateParam(req.query.oldest, 'oldest')
    newest = validateDateParam(req.query.newest, 'newest')
  } catch (e) { res.status(400).json({ error: (e as Error).message }); return }

  if (!oldest) { res.status(400).json({ error: 'Missing required parameter: oldest' }); return }

  try {
    const params = new URLSearchParams({ oldest })
    if (newest) params.append('newest', newest)
    const response = await proxyToIntervalsIcu(auth, `/athlete/${athleteId}/wellness?${params}`)
    if (!response.ok) { res.status(response.status).json({ error: 'Failed to fetch wellness' }); return }
    res.status(200).json(await response.json())
  } catch { res.status(500).json({ error: 'Internal server error' }) }
})

reg('POST', '/api/data/wellness', async (req, res) => {
  const auth = await getValidAccessToken(req, res)
  if (!auth) { res.status(401).json({ error: 'Not authenticated' }); return }

  let athleteId: string
  try { athleteId = validateAthleteId(req.query.athleteId) }
  catch (e) { res.status(400).json({ error: (e as Error).message }); return }

  if (!req.body) { res.status(400).json({ error: 'Missing request body' }); return }
  if (!req.body.date) { res.status(400).json({ error: 'Missing required field: date' }); return }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(req.body.date)) { res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD' }); return }

  try {
    const response = await proxyToIntervalsIcu(auth, `/athlete/${athleteId}/wellness`, { method: 'POST', body: req.body })
    if (!response.ok) { res.status(response.status).json({ error: 'Failed to save wellness' }); return }
    res.status(200).json(await response.json())
  } catch { res.status(500).json({ error: 'Internal server error' }) }
})

// ── Data: Power Curves ───────────────────────────────────

reg('GET', '/api/data/power-curves', async (req, res) => {
  const auth = await getValidAccessToken(req, res)
  if (!auth) { res.status(401).json({ error: 'Not authenticated' }); return }

  let athleteId: string
  try { athleteId = validateAthleteId(req.query.athleteId) }
  catch (e) { res.status(400).json({ error: (e as Error).message }); return }

  const type = param(req, 'type') || 'Ride'
  if (!VALID_SPORT_TYPES.has(type)) { res.status(400).json({ error: `Invalid sport type: ${type}` }); return }

  try {
    const response = await proxyToIntervalsIcu(auth, `/athlete/${athleteId}/power-curves?${new URLSearchParams({ type })}`)
    if (!response.ok) { res.status(response.status).json({ error: 'Failed to fetch power curves' }); return }
    res.status(200).json(await response.json())
  } catch { res.status(500).json({ error: 'Internal server error' }) }
})

// ── Data: Events ─────────────────────────────────────────

reg('GET', '/api/data/events', async (req, res) => {
  const auth = await getValidAccessToken(req, res)
  if (!auth) { res.status(401).json({ error: 'Not authenticated' }); return }

  let athleteId: string, oldest: string, newest: string
  try {
    athleteId = validateAthleteId(req.query.athleteId)
    oldest = validateDateParam(req.query.oldest, 'oldest')
    newest = validateDateParam(req.query.newest, 'newest')
  } catch (e) { res.status(400).json({ error: (e as Error).message }); return }

  if (!oldest) { res.status(400).json({ error: 'Missing required parameter: oldest' }); return }

  const params = new URLSearchParams({ oldest })
  if (newest) params.append('newest', newest)

  try {
    const response = await proxyToIntervalsIcu(auth, `/athlete/${athleteId}/events?${params}`)
    if (!response.ok) { res.status(response.status).json({ error: 'Failed to fetch events' }); return }
    res.status(200).json(await response.json())
  } catch { res.status(500).json({ error: 'Internal server error' }) }
})

reg('POST', '/api/data/events', async (req, res) => {
  const auth = await getValidAccessToken(req, res)
  if (!auth) { res.status(401).json({ error: 'Not authenticated' }); return }

  let athleteId: string
  try { athleteId = validateAthleteId(req.query.athleteId) }
  catch (e) { res.status(400).json({ error: (e as Error).message }); return }

  try {
    const response = await proxyToIntervalsIcu(auth, `/athlete/${athleteId}/events`, { method: 'POST', body: req.body })
    if (!response.ok) { res.status(response.status).json({ error: 'Failed to create event' }); return }
    res.status(201).json(await response.json())
  } catch { res.status(500).json({ error: 'Internal server error' }) }
})

reg('PUT', '/api/data/events/:id', async (req, res) => {
  const auth = await getValidAccessToken(req, res)
  if (!auth) { res.status(401).json({ error: 'Not authenticated' }); return }

  const { id } = req.query
  if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid event ID' }); return }

  try {
    const response = await proxyToIntervalsIcu(auth, `/athlete/0/events/${id}`, { method: 'PUT', body: req.body })
    if (!response.ok) { res.status(response.status).json({ error: 'Failed to update event' }); return }
    res.status(200).json(await response.json())
  } catch { res.status(500).json({ error: 'Internal server error' }) }
})

reg('DELETE', '/api/data/events/:id', async (req, res) => {
  const auth = await getValidAccessToken(req, res)
  if (!auth) { res.status(401).json({ error: 'Not authenticated' }); return }

  const { id } = req.query
  if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid event ID' }); return }

  try {
    const response = await proxyToIntervalsIcu(auth, `/athlete/0/events/${id}`, { method: 'DELETE' })
    if (!response.ok) { res.status(response.status).json({ error: 'Failed to delete event' }); return }
    res.status(204).end()
  } catch { res.status(500).json({ error: 'Internal server error' }) }
})

// ── Data: Workouts ───────────────────────────────────────

reg('GET', '/api/data/workouts', async (req, res) => {
  const auth = await getValidAccessToken(req, res)
  if (!auth) { res.status(401).json({ error: 'Not authenticated' }); return }

  let athleteId: string
  try { athleteId = validateAthleteId(req.query.athleteId) }
  catch (e) { res.status(400).json({ error: (e as Error).message }); return }

  const folderId = req.query.folderId ? String(req.query.folderId) : undefined
  const path = folderId ? `/athlete/${athleteId}/workouts?folder_id=${folderId}` : `/athlete/${athleteId}/workouts`

  try {
    const response = await proxyToIntervalsIcu(auth, path)
    if (!response.ok) { res.status(response.status).json({ error: 'Failed to fetch workouts' }); return }
    res.status(200).json(await response.json())
  } catch { res.status(500).json({ error: 'Internal server error' }) }
})

reg('POST', '/api/data/workouts', async (req, res) => {
  const auth = await getValidAccessToken(req, res)
  if (!auth) { res.status(401).json({ error: 'Not authenticated' }); return }

  let athleteId: string
  try { athleteId = validateAthleteId(req.query.athleteId) }
  catch (e) { res.status(400).json({ error: (e as Error).message }); return }

  try {
    const response = await proxyToIntervalsIcu(auth, `/athlete/${athleteId}/workouts`, { method: 'POST', body: req.body })
    if (!response.ok) { res.status(response.status).json({ error: 'Failed to create workout' }); return }
    res.status(201).json(await response.json())
  } catch { res.status(500).json({ error: 'Internal server error' }) }
})

reg('GET', '/api/data/workouts/:id', async (req, res) => {
  const auth = await getValidAccessToken(req, res)
  if (!auth) { res.status(401).json({ error: 'Not authenticated' }); return }

  const { id } = req.query
  if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid workout ID' }); return }

  try {
    const response = await proxyToIntervalsIcu(auth, `/athlete/0/workouts/${id}`)
    if (!response.ok) { res.status(response.status).json({ error: 'Failed to fetch workout' }); return }
    res.status(200).json(await response.json())
  } catch { res.status(500).json({ error: 'Internal server error' }) }
})

reg('PUT', '/api/data/workouts/:id', async (req, res) => {
  const auth = await getValidAccessToken(req, res)
  if (!auth) { res.status(401).json({ error: 'Not authenticated' }); return }

  const { id } = req.query
  if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid workout ID' }); return }

  try {
    const response = await proxyToIntervalsIcu(auth, `/athlete/0/workouts/${id}`, { method: 'PUT', body: req.body })
    if (!response.ok) { res.status(response.status).json({ error: 'Failed to update workout' }); return }
    res.status(200).json(await response.json())
  } catch { res.status(500).json({ error: 'Internal server error' }) }
})

reg('DELETE', '/api/data/workouts/:id', async (req, res) => {
  const auth = await getValidAccessToken(req, res)
  if (!auth) { res.status(401).json({ error: 'Not authenticated' }); return }

  const { id } = req.query
  if (!id || Array.isArray(id)) { res.status(400).json({ error: 'Invalid workout ID' }); return }

  try {
    const response = await proxyToIntervalsIcu(auth, `/athlete/0/workouts/${id}`, { method: 'DELETE' })
    if (!response.ok) { res.status(response.status).json({ error: 'Failed to delete workout' }); return }
    res.status(204).end()
  } catch { res.status(500).json({ error: 'Internal server error' }) }
})

import type { AppSettings } from '../types'

export async function fetchSettings(): Promise<AppSettings> {
  const res = await fetch('/api/settings')
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  if (!res.ok) throw new Error('Failed to save settings')
}

export async function testAssistantConnection(_url: string, _username: string, _password: string): Promise<boolean> {
  try {
    const res = await fetch('/api/assistant/config')
    return res.ok
  } catch {
    return false
  }
}

export async function testApiKey(key: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/test-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    })
    if (!res.ok) return false
    const data = await res.json()
    return data.valid === true
  } catch {
    return false
  }
}
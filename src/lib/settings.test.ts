import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchSettings, saveSettings, testAssistantConnection, testApiKey } from './settings'

describe('fetchSettings', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns settings from API', async () => {
    const mock = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        intervalsApiKey: 'key-123',
        opencodeServerUrl: 'http://server:4096',
        opencodeUsername: 'admin',
      }), { status: 200 })
    )
    const result = await fetchSettings()
    expect(result.intervalsApiKey).toBe('key-123')
    expect(result.opencodeServerUrl).toBe('http://server:4096')
    expect(result.opencodeUsername).toBe('admin')
    mock.mockRestore()
  })

  it('throws on non-ok response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 500 })
    )
    await expect(fetchSettings()).rejects.toThrow('Failed to fetch settings')
  })
})

describe('saveSettings', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends POST request with settings', async () => {
    const mock = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 200 })
    )
    await saveSettings({ intervalsApiKey: 'new-key' })
    expect(mock).toHaveBeenCalledWith('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intervalsApiKey: 'new-key' }),
    })
    mock.mockRestore()
  })

  it('throws on non-ok response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 400 })
    )
    await expect(saveSettings({})).rejects.toThrow('Failed to save settings')
  })
})

describe('testAssistantConnection', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns true when connection succeeds', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 200 })
    )
    const result = await testAssistantConnection('http://server', 'user', 'pass')
    expect(result).toBe(true)
  })

  it('returns false when fetch fails', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'))
    const result = await testAssistantConnection('http://server', 'user', 'pass')
    expect(result).toBe(false)
  })

  it('returns false when response is not ok', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 401 })
    )
    const result = await testAssistantConnection('http://server', 'user', 'pass')
    expect(result).toBe(false)
  })
})

describe('testApiKey', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends key to validation endpoint and returns true on success', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ valid: true }), { status: 200 })
    )
    const result = await testApiKey('some-api-key')
    expect(result).toBe(true)
  })

  it('returns false on network error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Timeout'))
    const result = await testApiKey('bad')
    expect(result).toBe(false)
  })
})
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { toCSV, toJSON, downloadFile } from './export'

describe('toCSV', () => {
  it('returns empty string for empty array', () => {
    expect(toCSV([], ['a', 'b'])).toBe('')
  })

  it('generates header and rows', () => {
    const rows = [
      { name: 'Ride', load: 42 },
      { name: 'Run', load: 30 },
    ]
    const csv = toCSV(rows, ['name', 'load'])
    expect(csv).toBe('name,load\nRide,42\nRun,30')
  })

  it('handles null and undefined as empty', () => {
    const rows = [{ a: null, b: undefined, c: 'ok' }] as Record<string, unknown>[]
    const csv = toCSV(rows, ['a', 'b', 'c'])
    expect(csv).toBe('a,b,c\n,,ok')
  })

  it('escapes commas and quotes', () => {
    const rows = [{ name: 'Easy, ride', note: 'He said "hi"' }]
    const csv = toCSV(rows, ['name', 'note'])
    expect(csv).toBe('name,note\n"Easy, ride","He said ""hi"""')
  })
})

describe('downloadFile', () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>
  let revokeSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    revokeSpy = vi.spyOn(URL, 'revokeObjectURL')
  })

  afterEach(() => {
    vi.useRealTimers()
    createObjectURLSpy.mockRestore()
    revokeSpy.mockRestore()
  })

  it('triggers click on the anchor element', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click')
    downloadFile('hello', 'test.csv', 'text/csv')
    expect(clickSpy).toHaveBeenCalledOnce()
    clickSpy.mockRestore()
  })

  it('appends anchor to DOM and removes after delay', () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    const removeSpy = vi.spyOn(document.body, 'removeChild')
    downloadFile('hello', 'test.csv', 'text/csv')
    expect(appendSpy).toHaveBeenCalled()
    expect(removeSpy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    expect(removeSpy).toHaveBeenCalled()
    appendSpy.mockRestore()
    removeSpy.mockRestore()
  })

  it('does not revoke blob URL synchronously', () => {
    downloadFile('hello', 'test.csv', 'text/csv')
    expect(revokeSpy).not.toHaveBeenCalled()
  })

  it('revokes blob URL after download starts', () => {
    downloadFile('hello', 'test.csv', 'text/csv')
    expect(revokeSpy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    expect(revokeSpy).toHaveBeenCalledWith('blob:test')
  })
})

describe('toJSON', () => {
  it('returns formatted JSON', () => {
    const rows = [{ a: 1 }]
    expect(toJSON(rows)).toBe('[\n  {\n    "a": 1\n  }\n]')
  })

  it('handles empty array', () => {
    expect(toJSON([])).toBe('[]')
  })
})

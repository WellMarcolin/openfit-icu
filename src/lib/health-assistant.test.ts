import { describe, expect, it } from 'vitest'
import { buildHealthAssistantContext, parseAssistantNavigation, stripAssistantNavigation } from './health-assistant'
import { createDemoData } from '@/data/demo'

describe('buildHealthAssistantContext', () => {
  it('returns JSON string with athlete info', () => {
    const data = createDemoData()
    const context = buildHealthAssistantContext(data, [], 'today')
    const parsed = JSON.parse(context)
    expect(parsed.athlete.name).toBeTruthy()
    expect(parsed.fitness.ctl).toBeTruthy()
    expect(parsed.power.ftp).toBe(280)
  })
})

describe('parseAssistantNavigation', () => {
  it('parses navigate directive', () => {
    const result = parseAssistantNavigation('Some text <!-- openfit-icu:navigate {"page":"fitness","date":"2026-07-08"} --> more text')
    expect(result).toEqual({ page: 'fitness', date: '2026-07-08' })
  })

  it('returns null for text without directive', () => {
    expect(parseAssistantNavigation('Just some text')).toBeNull()
  })
})

describe('stripAssistantNavigation', () => {
  it('removes navigate directive', () => {
    const result = stripAssistantNavigation('Hello<!-- openfit-icu:navigate {"page":"fitness"} --> world')
    expect(result).toBe('Hello world')
  })
})

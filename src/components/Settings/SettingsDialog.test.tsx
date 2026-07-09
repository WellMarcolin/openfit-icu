import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SettingsDialog } from './SettingsDialog'
import type { AuthStatus } from '@/types'

describe('SettingsDialog', () => {
  const status: AuthStatus = {
    connected: false,
    method: null,
    athleteId: null,
    athleteName: null,
    lastSyncAt: null,
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders data source and AI assistant sections', () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 })
    )
    render(
      <SettingsDialog
        open={true}
        status={status}
        dataSource="demo"
        onOpenChange={() => {}}
        onConnect={() => {}}
        onDisconnect={() => {}}
      />
    )
    expect(screen.getByText('Data Source')).toBeTruthy()
    expect(screen.getByText('AI Assistant')).toBeTruthy()
  })

  it('shows connected state when status.connected is true', () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 })
    )
    const connectedStatus: AuthStatus = {
      connected: true,
      method: 'oauth',
      athleteId: '123',
      athleteName: 'Test Athlete',
      lastSyncAt: new Date().toISOString(),
    }
    render(
      <SettingsDialog
        open={true}
        status={connectedStatus}
        dataSource="intervals-icu"
        onOpenChange={() => {}}
        onConnect={() => {}}
        onDisconnect={() => {}}
      />
    )
    expect(screen.getByText(/Connected as/)).toBeTruthy()
    expect(screen.getByText(/Test Athlete/)).toBeTruthy()
  })

  it('shows demo mode message when source is demo', () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 })
    )
    render(
      <SettingsDialog
        open={true}
        status={status}
        dataSource="demo"
        onOpenChange={() => {}}
        onConnect={() => {}}
        onDisconnect={() => {}}
      />
    )
    const matches = screen.getAllByText(/Demo mode/)
    expect(matches.length).toBeGreaterThan(0)
  })

  it('renders API Key input', () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 })
    )
    render(
      <SettingsDialog
        open={true}
        status={status}
        dataSource="demo"
        onOpenChange={() => {}}
        onConnect={() => {}}
        onDisconnect={() => {}}
      />
    )
    expect(screen.getByLabelText(/API Key/)).toBeTruthy()
  })

  it('renders AI Assistant form fields', () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 })
    )
    render(
      <SettingsDialog
        open={true}
        status={status}
        dataSource="demo"
        onOpenChange={() => {}}
        onConnect={() => {}}
        onDisconnect={() => {}}
      />
    )
    expect(screen.getByLabelText('Server URL')).toBeTruthy()
    expect(screen.getByLabelText('Username (optional)')).toBeTruthy()
    expect(screen.getByLabelText('Password (optional)')).toBeTruthy()
  })
})
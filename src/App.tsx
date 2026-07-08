import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ChevronsUpDown, LoaderCircle, RefreshCw, Sparkles } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { DashboardData, AuthStatus, PageId } from '@/types'
import { createDemoData, localIso } from '@/data/demo'
import { formatDate, relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ActivityView, WellnessView, FitnessView, PowerView, CalendarView, DataSourcesView, TodayView } from '@/components/Views'
import { HealthAssistant } from '@/components/HealthAssistant'
import type { AssistantNavigation } from '@/lib/health-assistant'
import type { AppIcon } from '@/components/icons'
import {
  ActivityIcon,
  BodyIcon,
  CalendarIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  CloudIcon,
  DeviceIcon,
  DisconnectIcon,
  HeartIcon,
  LoaderIcon,
  SettingsIcon,
  ShieldIcon,
  SparkleIcon,
  StepsIcon,
  TodayIcon,
} from '@/components/icons'

type NavCategory = 'summary' | 'training' | 'fitness' | 'power' | 'wellness' | 'calendar' | 'device'

const navItems: Array<{ id: PageId; label: string; copy: string; icon: AppIcon; category: NavCategory }> = [
  { id: 'today', label: 'Today', copy: 'Training overview and fitness status.', icon: TodayIcon, category: 'summary' },
  { id: 'activity', label: 'Activity', copy: 'Workouts, training load, and intervals.', icon: ActivityIcon, category: 'training' },
  { id: 'fitness', label: 'Fitness', copy: 'CTL, ATL, TSB and performance management.', icon: StepsIcon, category: 'fitness' },
  { id: 'power', label: 'Power', copy: 'Power curves, FTP, and W/kg.', icon: ActivityIcon, category: 'power' },
  { id: 'wellness', label: 'Wellness', copy: 'HRV, sleep, mood, and readiness.', icon: HeartIcon, category: 'wellness' },
  { id: 'calendar', label: 'Calendar', copy: 'Training plan and upcoming events.', icon: CalendarIcon, category: 'calendar' },
  { id: 'data-sources', label: 'Data', copy: 'Intervals.icu connection and settings.', icon: DeviceIcon, category: 'device' },
]

const defaultStatus: AuthStatus = {
  connected: false,
  method: null,
  athleteId: null,
  athleteName: null,
  lastSyncAt: null,
}

interface ToastState {
  tone: 'success' | 'error' | 'neutral'
  message: string
}

function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number)
  return localIso(new Date(year, month - 1, day + days, 12))
}

function IconButton({ label, children, ...props }: { label: string; children: ReactNode } & React.ComponentProps<typeof Button>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild><Button aria-label={label} variant="ghost" size="icon" {...props}>{children}</Button></TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function getSourceLabel(status: AuthStatus, dataSource: DashboardData['source']): string {
  if (status.connected) return 'Intervals.icu'
  return dataSource === 'demo' ? 'Demo data' : 'Local cache'
}

export default function App() {
  const [page, setPage] = useState<PageId>('today')
  const [selectedDate, setSelectedDate] = useState(localIso())
  const [data, setData] = useState<DashboardData>(() => createDemoData())
  const [status, setStatus] = useState(defaultStatus)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const selectedDateRef = useRef(selectedDate)
  const syncingRef = useRef(false)
  const queuedDateRef = useRef<string | null>(null)

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [page])

  useEffect(() => {
    selectedDateRef.current = selectedDate
  }, [selectedDate])

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/status')
      if (response.ok) {
        const authStatus = await response.json()
        setStatus(authStatus)
      }
    } catch {
      // Not authenticated, demo mode
    }
  }, [])

  const syncData = useCallback(async (date: string) => {
    try {
      const response = await fetch(`/api/auth/status`)
      if (!response.ok) return
      const authStatus = await response.json()
      if (!authStatus.connected) return

      setSyncing(true)
      setToast({ tone: 'neutral', message: 'Syncing data from Intervals.icu…' })

      const [athleteRes, activitiesRes, wellnessRes, powerRes, eventsRes] = await Promise.all([
        fetch(`/api/data/athlete?id=${authStatus.athleteId || '0'}`).catch(() => null),
        fetch(`/api/data/activities?oldest=${date}&newest=${date}`).catch(() => null),
        fetch(`/api/data/wellness?date=${date}`).catch(() => null),
        fetch(`/api/data/power-curves?type=Ride`).catch(() => null),
        fetch(`/api/data/events?oldest=${date}`).catch(() => null),
      ])

      const athlete = athleteRes?.ok ? await athleteRes.json() : null
      const activities = activitiesRes?.ok ? await activitiesRes.json() : []
      const wellness = wellnessRes?.ok ? await wellnessRes.json() : null
      const powerCurves = powerRes?.ok ? await powerRes.json() : null
      const events = eventsRes?.ok ? await eventsRes.json() : []

      setData({
        source: 'intervals-icu',
        selectedDate: date,
        generatedAt: new Date().toISOString(),
        profile: {
          displayName: athlete ? `${athlete.firstname ?? ''} ${athlete.lastname ?? ''}`.trim() : 'Athlete',
          avatar: null,
          weight: athlete?.weight ?? athlete?.icu_weight ?? null,
          height: athlete?.height ?? null,
          ftp: null,
          eftp: athlete?.eftp ?? null,
          restingHR: athlete?.icu_resting_hr ?? null,
          timezone: athlete?.timezone ?? null,
          sports: ['Ride', 'Run'],
        },
        fitness: {
          ctl: wellness?.ctl ?? null,
          atl: wellness?.atl ?? null,
          tsb: wellness?.ctl != null && wellness?.atl != null ? Number((wellness.ctl - wellness.atl).toFixed(1)) : null,
          rampRate: wellness?.rampRate ?? null,
          ctlHistory: wellness?.ctlHistory ?? [],
          atlHistory: wellness?.atlHistory ?? [],
          tsbHistory: wellness?.tsbHistory ?? [],
        },
        activity: {
          todayLoad: activities.reduce?.((sum: number, a: any) => sum + (a.icu_training_load ?? 0), 0) ?? null,
          todayActivities: (activities ?? []).map((a: any) => ({
            id: String(a.id ?? ''),
            name: String(a.name ?? ''),
            type: String(a.type ?? 'Ride'),
            startDate: String(a.start_date_local ?? ''),
            movingTime: a.moving_time ?? 0,
            distance: a.distance ? Number((a.distance / 1000).toFixed(2)) : null,
            trainingLoad: a.icu_training_load ?? null,
            ftp: a.icu_ftp ?? null,
            intensity: a.icu_intensity ?? null,
            avgPower: a.average_watts ?? null,
            weightedAvgPower: a.icu_weighted_avg_watts ?? null,
            avgHeartRate: a.average_heartrate ?? null,
            maxHeartRate: a.max_heartrate ?? null,
            avgCadence: a.average_cadence ?? null,
            calories: a.calories ?? null,
            elevationGain: a.total_elevation_gain ?? null,
            trainer: Boolean(a.trainer),
            race: Boolean(a.race),
            tags: Array.isArray(a.tags) ? a.tags.map(String) : [],
            source: String(a.source ?? ''),
            compliance: a.compliance ?? null,
            variabilityIndex: a.icu_variability_index ?? null,
            efficiencyFactor: a.icu_efficiency_factor ?? null,
            decoupling: a.decoupling ?? null,
            polarizationIndex: a.polarization_index ?? null,
            zoneTimes: Array.isArray(a.icu_zone_times) ? a.icu_zone_times : null,
            hrZoneTimes: Array.isArray(a.icu_hr_zones) ? a.icu_hr_zones : null,
          })),
          weekLoad: null,
          weekActivities: null,
          avgIntensity: null,
          zoneMinutes: null,
        },
        wellness: {
          weight: wellness?.weight ?? null,
          restingHR: wellness?.restingHR ?? null,
          hrv: wellness?.hrv ?? null,
          hrvSDNN: wellness?.hrvSDNN ?? null,
          sleepMinutes: wellness?.sleepSecs ? Math.round(wellness.sleepSecs / 60) : null,
          sleepScore: wellness?.sleepScore ?? null,
          sleepQuality: wellness?.sleepQuality ?? null,
          avgSleepingHR: wellness?.avgSleepingHR ?? null,
          spO2: wellness?.spO2 ?? null,
          mood: wellness?.mood ?? null,
          stress: wellness?.stress ?? null,
          fatigue: wellness?.fatigue ?? null,
          motivation: wellness?.motivation ?? null,
          soreness: wellness?.soreness ?? null,
          readiness: wellness?.readiness ?? null,
          vo2max: wellness?.vo2max ?? null,
          bodyFat: wellness?.bodyFat ?? null,
          systolic: wellness?.systolic ?? null,
          diastolic: wellness?.diastolic ?? null,
          hydration: wellness?.hydration ?? null,
          kcalConsumed: wellness?.kcalConsumed ?? null,
          respiration: wellness?.respiration ?? null,
          steps: wellness?.steps ?? null,
        },
        power: {
          curves: powerCurves?.curves ?? [],
          seasonCurves: powerCurves?.seasonCurves ?? [],
          ftp: null,
          eftp: null,
          vo2max5m: powerCurves?.vo2max_5m ?? null,
          wkg5m: null,
        },
        trends: [],
        activities: (activities ?? []).map((a: any) => ({
          id: String(a.id ?? ''),
          name: String(a.name ?? ''),
          type: String(a.type ?? 'Ride'),
          startDate: String(a.start_date_local ?? ''),
          movingTime: a.moving_time ?? 0,
          distance: a.distance ? Number((a.distance / 1000).toFixed(2)) : null,
          trainingLoad: a.icu_training_load ?? null,
          ftp: a.icu_ftp ?? null,
          intensity: a.icu_intensity ?? null,
          avgPower: a.average_watts ?? null,
          weightedAvgPower: a.icu_weighted_avg_watts ?? null,
          avgHeartRate: a.average_heartrate ?? null,
          maxHeartRate: a.max_heartrate ?? null,
          avgCadence: a.average_cadence ?? null,
          calories: a.calories ?? null,
          elevationGain: a.total_elevation_gain ?? null,
          trainer: Boolean(a.trainer),
          race: Boolean(a.race),
          tags: Array.isArray(a.tags) ? a.tags.map(String) : [],
          source: String(a.source ?? ''),
          compliance: a.compliance ?? null,
          variabilityIndex: a.icu_variability_index ?? null,
          efficiencyFactor: a.icu_efficiency_factor ?? null,
          decoupling: a.decoupling ?? null,
          polarizationIndex: a.polarization_index ?? null,
          zoneTimes: Array.isArray(a.icu_zone_times) ? a.icu_zone_times : null,
          hrZoneTimes: Array.isArray(a.icu_hr_zones) ? a.icu_hr_zones : null,
        })),
        events: (events ?? []).map((e: any) => ({
          id: e.id ?? 0,
          startDate: String(e.start_date_local ?? ''),
          name: String(e.name ?? ''),
          type: String(e.type ?? 'Ride'),
          category: e.category ?? 'WORKOUT',
          movingTime: e.moving_time ?? null,
          trainingLoad: e.icu_training_load ?? null,
          indoor: Boolean(e.indoor),
          description: e.description ? String(e.description) : null,
        })),
        insights: [],
        sync: {
          endpointCount: 5,
          successCount: [athleteRes, activitiesRes, wellnessRes, powerRes, eventsRes].filter(r => r?.ok).length,
          errors: [],
          lastSyncAt: new Date().toISOString(),
        },
      })

      setStatus(prev => ({ ...prev, lastSyncAt: new Date().toISOString() }))
      setToast({ tone: 'success', message: 'Data updated from Intervals.icu.' })
    } catch (error) {
      setToast({ tone: 'error', message: error instanceof Error ? error.message : 'Sync failed.' })
    } finally {
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    void checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!toast) return
    if (toast.tone === 'error') return
    const timer = window.setTimeout(() => setToast(null), 4_500)
    return () => window.clearTimeout(timer)
  }, [toast])

  const changeDate = (date: string) => {
    if (!date || date > localIso()) return
    selectedDateRef.current = date
    setSelectedDate(date)
    if (data.source === 'demo' && !status.connected) {
      setData(createDemoData(date))
      return
    }
    if (status.connected) void syncData(date)
  }

  const connect = () => {
    window.location.href = '/api/auth/login'
  }

  const disconnect = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      setStatus(defaultStatus)
      setData(createDemoData(selectedDate))
      setSettingsOpen(false)
      setPage('today')
      setToast({ tone: 'success', message: 'Disconnected from Intervals.icu.' })
    } catch {
      setToast({ tone: 'error', message: 'Failed to disconnect.' })
    }
  }

  const currentView = useMemo(() => {
    const props = { data, status, navigate: setPage }
    if (page === 'activity') return <ActivityView {...props} />
    if (page === 'fitness') return <FitnessView {...props} />
    if (page === 'power') return <PowerView {...props} />
    if (page === 'wellness') return <WellnessView {...props} />
    if (page === 'calendar') return <CalendarView {...props} />
    if (page === 'data-sources') return <DataSourcesView {...props} />
    return <TodayView {...props} />
  }, [data, page, status])

  const isToday = selectedDate === localIso()
  const sourceLabel = getSourceLabel(status, data.source)
  const pageMeta = navItems.find((item) => item.id === page) ?? navItems[0]

  const navigate = (nextPage: PageId) => {
    setPage(nextPage)
  }

  const navigateFromAssistant = (navigation: AssistantNavigation) => {
    if (navigation.date) changeDate(navigation.date)
    if (navigation.page) setPage(navigation.page as PageId)
  }

  return (
    <SidebarProvider className={cn('app-shell', assistantOpen && 'assistant-open')}>
      <OpenFitIcuSidebar
        items={navItems}
        page={page}
        userName={data.profile.displayName}
        userAvatar={data.profile.avatar}
        sourceLabel={sourceLabel}
        onNavigate={navigate}
        onSettings={() => setSettingsOpen(true)}
      />

      <SidebarInset className="main-area">
        <header className="topbar">
          <div className="topbar-heading">
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarTrigger className="sidebar-trigger" aria-label="Toggle navigation" />
              </TooltipTrigger>
              <TooltipContent>Toggle navigation</TooltipContent>
            </Tooltip>
            <div>
              <h1>{pageMeta.label}</h1>
              <p className="topbar-meta">
                <span>{page === 'today' ? formatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long' }) : pageMeta.copy}</span>
              </p>
            </div>
          </div>

          <div className="topbar-actions">
            <div className="date-control">
              <IconButton label="Previous day" onClick={() => changeDate(shiftDate(selectedDate, -1))}><ChevronLeftIcon /></IconButton>
              <label className="date-picker">
                <CalendarIcon aria-hidden="true" />
                <span>{isToday ? 'Today' : formatDate(selectedDate, { day: 'numeric', month: 'short' })}</span>
                <input type="date" value={selectedDate} max={localIso()} onChange={(event) => changeDate(event.target.value)} />
              </label>
              <IconButton label="Next day" disabled={isToday} onClick={() => changeDate(shiftDate(selectedDate, 1))}><ChevronRightIcon /></IconButton>
            </div>

            <IconButton
              label={assistantOpen ? 'Close assistant' : 'Open assistant'}
              className={cn('assistant-toggle', assistantOpen && 'is-active')}
              aria-controls="health-assistant"
              aria-expanded={assistantOpen}
              onClick={() => setAssistantOpen((open) => !open)}
            >
              <Sparkles />
            </IconButton>
            {status.connected ? (
              <>
                <IconButton
                  label="Refresh data from Intervals.icu"
                  className="refresh-button"
                  onClick={() => syncData(selectedDate)}
                  disabled={syncing}
                >
                  {syncing ? <LoaderCircle className="spin" /> : <RefreshCw />}
                </IconButton>
              </>
            ) : (
              <Button className="connect-button" aria-label="Connect Intervals.icu" onClick={connect} disabled={connecting}>
                {connecting ? <LoaderIcon className="spin" /> : <CloudIcon />}<span>Connect</span>
              </Button>
            )}
          </div>
        </header>

        <div className="page-content" key={page}>
          {currentView}
        </div>
      </SidebarInset>

      <HealthAssistant
        open={assistantOpen}
        data={data}
        page={page}
        onOpenChange={setAssistantOpen}
        onNavigate={navigateFromAssistant}
      />

      <SettingsDialog
        open={settingsOpen}
        status={status}
        dataSource={data.source}
        onOpenChange={setSettingsOpen}
        onConnect={connect}
        onDisconnect={disconnect}
      />

      {toast && (
        <div className={cn('toast', `toast-${toast.tone}`)} role={toast.tone === 'error' ? 'alert' : 'status'}>
          {toast.tone === 'success' ? <CheckIcon /> : toast.tone === 'error' ? <CloseIcon /> : <SparkleIcon />}
          <span>{toast.message}</span>
          <button className="toast-close" aria-label="Close notification" onClick={() => setToast(null)}><CloseIcon /></button>
        </div>
      )}
    </SidebarProvider>
  )
}

function OpenFitIcuSidebar({
  items,
  page,
  userName,
  userAvatar,
  sourceLabel,
  onNavigate,
  onSettings,
}: {
  items: typeof navItems
  page: PageId
  userName: string
  userAvatar: string | null
  sourceLabel: string
  onNavigate: (page: PageId) => void
  onSettings: () => void
}) {
  const { setOpenMobile } = useSidebar()
  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'AT'

  const trainingItems = items.filter((item) => ['training', 'fitness', 'power'].includes(item.category))
  const wellnessItems = items.filter((item) => ['wellness', 'calendar'].includes(item.category))
  const dataItem = items.find((item) => item.category === 'device')

  const selectPage = (nextPage: PageId) => {
    onNavigate(nextPage)
    setOpenMobile(false)
  }

  const openSettings = () => {
    setOpenMobile(false)
    onSettings()
  }

  return (
    <Sidebar collapsible="icon" className="pulse-sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="sidebar-workspace" tooltip="OpenFit ICU" onClick={() => selectPage('today')}>
              <span className="sidebar-workspace-mark">
                <img src="./app-icon.png" alt="" aria-hidden="true" />
              </span>
              <span className="sidebar-workspace-copy">
                <strong>OpenFit ICU</strong>
                <small>Training dashboard</small>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Training</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu aria-label="Training navigation">
              {items.filter((i) => i.id === 'today').map(({ id, label, icon: Icon }) => (
                <SidebarMenuItem key={id}>
                  <SidebarMenuButton isActive={page === id} tooltip={label} aria-current={page === id ? 'page' : undefined}
                    onClick={() => selectPage(id)}>
                    <Icon aria-hidden="true" /><span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {trainingItems.map(({ id, label, icon: Icon }) => (
                <SidebarMenuItem key={id}>
                  <SidebarMenuButton isActive={page === id} tooltip={label} aria-current={page === id ? 'page' : undefined}
                    onClick={() => selectPage(id)}>
                    <Icon aria-hidden="true" /><span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Wellness</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {wellnessItems.map(({ id, label, icon: Icon }) => (
                <SidebarMenuItem key={id}>
                  <SidebarMenuButton isActive={page === id} tooltip={label} aria-current={page === id ? 'page' : undefined}
                    onClick={() => selectPage(id)}>
                    <Icon aria-hidden="true" /><span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {dataItem && (
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={page === dataItem.id} tooltip={dataItem.label}
                    aria-current={page === dataItem.id ? 'page' : undefined} onClick={() => selectPage(dataItem.id)}>
                    <dataItem.icon aria-hidden="true" /><span>{dataItem.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Settings" onClick={openSettings}>
                  <SettingsIcon /><span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="sidebar-user" tooltip={userName} onClick={openSettings}>
              <Avatar className="sidebar-user-avatar">
                {userAvatar && <AvatarImage src={userAvatar} alt="" />}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <span className="sidebar-user-copy">
                <strong>{userName}</strong>
                <small>{sourceLabel}</small>
              </span>
              <ChevronsUpDown className="sidebar-switcher-icon" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function SettingsDialog({
  open,
  status,
  dataSource,
  onOpenChange,
  onConnect,
  onDisconnect,
}: {
  open: boolean
  status: AuthStatus
  dataSource: DashboardData['source']
  onOpenChange: (open: boolean) => void
  onConnect: () => void
  onDisconnect: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="settings-dialog" showCloseButton>
        <DialogHeader>
          <div className="dialog-icon"><CloudIcon /></div>
          <DialogTitle>{status.connected ? 'Intervals.icu connected' : 'Connect Intervals.icu'}</DialogTitle>
          <DialogDescription>Your data is fetched directly from Intervals.icu. No data is stored on our servers.</DialogDescription>
        </DialogHeader>

        {status.connected ? (
          <div className="connected-state">
            <div className="connection-check"><CheckIcon /></div>
            <div>
              <h3>Sync active</h3>
              <p>{status.athleteName ? `Connected as ${status.athleteName}` : ''}</p>
              {status.lastSyncAt && <p>Last updated {relativeTime(status.lastSyncAt)}.</p>}
            </div>
            <div className="connected-actions">
              <Button variant="destructive" onClick={() => void onDisconnect()}><DisconnectIcon /> Disconnect</Button>
            </div>
          </div>
        ) : dataSource === 'demo' ? (
          <div className="connected-state">
            <div>
              <h3>Demo mode</h3>
              <p>Connect your Intervals.icu account to see real training data.</p>
              <ol className="settings-steps">
                <li>Create an OAuth app in your Intervals.icu account settings</li>
                <li>Set the redirect URI to your app's callback URL</li>
                <li>Click Connect to authorize</li>
              </ol>
            </div>
            <div className="connected-actions">
              <Button onClick={onConnect}><CloudIcon /> Connect Intervals.icu</Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

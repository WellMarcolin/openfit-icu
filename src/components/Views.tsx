import type { ReactNode } from 'react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { ActivityItem, CalendarEvent, DashboardData, AuthStatus, PageId } from '@/types'
import { ColumnChart, LineChart } from './Charts'
import { DuoIcon, EmptyValue, ExportButton, MetricTile, Panel, PanelHeader, SportFilter } from './Shared'
import type { AppIcon } from './icons'
import { getSportIcon } from './icons'
import {
  ActivityIcon,
  BodyIcon,
  ChevronRightIcon,
  CloudIcon,
  GaugeIcon,
  HeartIcon,
  ShieldIcon,
  SleepIcon,
  StepsIcon,
  TrendIcon,
} from './icons'
import { Button } from '@/components/ui/button'
import { EventDialog } from './Events/EventDialog'
import type { EventFormData } from './Events/EventDialog'
import { WellnessDialog } from './Wellness/WellnessDialog'
import type { WellnessFormData } from './Wellness/WellnessDialog'
import {
  compactMinutes,
  formatDate,
  formatDecimal,
  formatMinutes,
  formatNumber,
  relativeTime,
} from '@/lib/format'
import { hasActivityData } from '@/lib/data-availability'
import { analyzeHome } from '@/lib/home-analysis'
import type { BaselineComparison } from '@/lib/home-analysis'
import { TrashIcon } from './icons'

interface ViewProps {
  data: DashboardData
  status: AuthStatus
  navigate: (page: PageId) => void
  onDateChange?: (date: string) => void
}

function hasValue(value: number | null | undefined): value is number {
  return value !== null && Number.isFinite(value)
}

function SectionTitle({ title, copy, action }: { title: string; copy?: string; action?: ReactNode }) {
  return (
    <div className="section-title">
      <div><h2>{title}</h2>{copy && <p>{copy}</p>}</div>
      {action}
    </div>
  )
}

function TinyStat({ label, value, unit = '' }: { label: string; value: string | number; unit?: string }) {
  return <div className="tiny-stat"><span>{label}</span><strong>{value}{unit}</strong></div>
}

function formatPace(secondsPerMeter: number | null | undefined) {
  if (!hasValue(secondsPerMeter) || secondsPerMeter <= 0) return null
  const secondsPerKm = Math.round(secondsPerMeter * 1000)
  return `${Math.floor(secondsPerKm / 60)}:${String(secondsPerKm % 60).padStart(2, '0')} min/km`
}

function CompactActivity({ item, detailed = false }: { item: ActivityItem; detailed?: boolean }) {
  const durationMinutes = Math.round(item.movingTime / 60)
  const distanceKm = item.distance
  const pace = item.distance && item.distance > 0 ? formatPace(item.movingTime / (item.distance * 1000)) : null
  const SportIcon = getSportIcon(item.type)
  const zoneDetails = item.hrZoneTimes
    ? item.hrZoneTimes
      .map((minutes, index) => {
        if (!hasValue(minutes) || minutes <= 0) return null
        const zoneNames = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']
        return `${zoneNames[index] ?? `Z${index + 1}`} ${formatNumber(minutes)} min`
      })
      .filter((value): value is string => Boolean(value))
    : []
  return (
    <div className={`activity-row ${detailed ? 'is-detailed' : ''}`}>
      <DuoIcon icon={SportIcon} className="activity-icon" />
      <div className="activity-copy">
        <strong>{item.name}</strong>
        <span>{formatDate(item.startDate, { day: 'numeric', month: 'short' })}</span>
      </div>
      <div className="activity-meta">
        {durationMinutes > 0 && <span>{durationMinutes} min</span>}
        {hasValue(distanceKm) && <span>{formatDecimal(distanceKm)} km</span>}
        {hasValue(item.avgHeartRate) && <span>{formatNumber(item.avgHeartRate)} bpm</span>}
        {detailed && hasValue(item.calories) && <span>{formatNumber(item.calories)} kcal</span>}
      </div>
      {detailed && (pace || zoneDetails.length > 0) && (
        <div className="activity-detail-row">
          {pace && <span><strong>{pace}</strong> average pace</span>}
          {zoneDetails.map((detail) => <span key={detail}>{detail}</span>)}
        </div>
      )}
    </div>
  )
}

function trendLabels(data: DashboardData) {
  return data.trends.map((point) => formatDate(point.date, { day: 'numeric', month: 'short' }))
}

function trendXValues(data: DashboardData) {
  return data.trends.map((point, index) => {
    const value = new Date(`${point.date}T12:00:00`).getTime()
    return Number.isFinite(value) ? value : index
  })
}

type HomeCategory = 'activity' | 'heart' | 'sleep' | 'recovery' | 'body'

const trendColors: Record<HomeCategory, string> = {
  activity: 'var(--category-activity)',
  heart: 'var(--category-heart)',
  sleep: 'var(--category-sleep)',
  recovery: 'var(--category-recovery)',
  body: 'var(--category-body)',
}

function MetricTrendPanel({
  data,
  category,
  icon,
  title,
  values,
  formatter,
  target = null,
}: {
  data: DashboardData
  category: HomeCategory
  icon: AppIcon
  title: string
  values: Array<number | null>
  formatter: (value: number) => string
  target?: number | null
}) {
  const count = values.filter(hasValue).length
  if (count < 2) return null
  const latest = [...values].reverse().find(hasValue) ?? null
  return (
    <Panel className="metric-trend-card" category={category}>
      <PanelHeader
        eyebrow={`${count} days with data`}
        title={title}
        icon={icon}
        action={latest === null ? null : <Badge variant="secondary">{formatter(latest)}</Badge>}
      />
      <LineChart
        values={values}
        labels={trendLabels(data)}
        xValues={trendXValues(data)}
        target={target}
        color={trendColors[category]}
        height={156}
        compact
        showRangeLabels
        variant="area"
        formatter={formatter}
        ariaLabel={`${title} during the synced period`}
      />
    </Panel>
  )
}

function signedNumber(value: number, digits = 0) {
  const formatted = formatNumber(Math.abs(value), { minimumFractionDigits: digits, maximumFractionDigits: digits })
  return `${value > 0 ? '+' : value < 0 ? '-' : ''}${formatted}`
}

function baselineNote(comparison: BaselineComparison, unit: string, digits = 0) {
  if (comparison.difference === null || comparison.sampleCount < 3) return 'Building baseline'
  return `${signedNumber(comparison.difference, digits)} ${unit} · ${comparison.sampleCount} days`
}

function DetailAction({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className="panel-detail-action" onClick={onClick} aria-label={label}><ChevronRightIcon aria-hidden="true" /></button>
}

function HomeSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const titleId = `home-section-${id}`
  return (
    <section className="home-section" aria-labelledby={titleId}>
      <div className="home-section-title"><h2 id={titleId}>{title}</h2></div>
      {children}
    </section>
  )
}

function DailySummaryMetric({
  category,
  icon: Icon,
  label,
  value,
  note,
  onClick,
}: {
  category: HomeCategory
  icon: AppIcon
  label: string
  value: string
  note: string
  onClick: () => void
}) {
  return (
    <Panel className="daily-summary-metric" category={category} onClick={onClick} ariaLabel={`${label}: ${value}, ${note}`}>
      <DuoIcon icon={Icon} className="daily-summary-icon" />
      <span className="daily-summary-copy"><small>{label}</small><strong>{value}</strong><span>{note}</span></span>
    </Panel>
  )
}

function TrendStats({
  current,
  average,
  difference,
  sampleCount,
}: {
  current: string
  average: string
  difference: string
  sampleCount: number
}) {
  return (
    <div className="mini-trend-stats">
      <div><span>Today</span><strong>{current}</strong></div>
      <div><span>{sampleCount ? `${sampleCount}-day average` : 'Recent average'}</span><strong>{average}</strong></div>
      <div><span>vs average</span><strong>{difference}</strong></div>
    </div>
  )
}

function VitalSnapshot({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="vital-snapshot">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export function TodayView({ data, navigate }: ViewProps) {
  const [sportFilter, setSportFilter] = useState('all')
  const analysis = analyzeHome(data)
  const hasFitness = hasValue(data.fitness.ctl) || hasValue(data.fitness.atl) || hasValue(data.fitness.tsb)
  const hasLoad = hasValue(data.activity.todayLoad)
  const hasWellness = hasValue(data.wellness.hrv) || hasValue(data.wellness.restingHR) || hasValue(data.wellness.sleepMinutes)
  const ctlTrend = data.trends.map((point) => point.ctl)
  const atlTrend = data.trends.map((point) => point.atl)
  const tsbTrend = data.trends.map((point) => point.tsb)
  const hrvTrend = data.trends.map((point) => point.hrv)
  const restingHRTrend = data.trends.map((point) => point.restingHR)
  const sleepTrend = data.trends.map((point) => point.sleepMinutes)
  const hasAnyData = hasFitness || hasLoad || hasWellness || data.activities.length > 0
  const uniqueSports = [...new Set(data.activities.map(a => a.type))]
  const filteredActivities = sportFilter === 'all' ? data.activities : data.activities.filter(a => a.type === sportFilter)

  const vitalSnapshots = [
    hasValue(data.wellness.hrv) ? { id: 'hrv', label: 'HRV', value: `${formatNumber(data.wellness.hrv)} ms` } : null,
    hasValue(data.wellness.spO2) ? { id: 'spo2', label: 'SpO\u2082', value: `${formatDecimal(data.wellness.spO2)}%` } : null,
    hasValue(data.wellness.respiration) ? { id: 'breathing', label: 'Breathing', value: `${formatDecimal(data.wellness.respiration)} rpm` } : null,
    hasValue(data.wellness.weight) ? { id: 'weight', label: 'Weight', value: `${formatDecimal(data.wellness.weight)} kg` } : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null)

  return (
    <div className="page-stack today-page">
      {!hasAnyData && (
        <Panel className="first-sync-state">
          <CloudIcon aria-hidden="true" />
          <h2>No data for this day</h2>
          <p>Connect Intervals.icu or try another date.</p>
        </Panel>
      )}

      {hasAnyData && (
        <div className="home-dashboard">
          <HomeSection id="overview" title="Overview">
            <div className="daily-summary-grid">
              <DailySummaryMetric
                category="activity"
                icon={StepsIcon}
                label="Training load"
                value={hasLoad ? formatDecimal(data.activity.todayLoad) : '\u2014'}
                note={hasLoad ? baselineNote(analysis.ctl, 'CTL') : 'Unavailable'}
                onClick={() => navigate('activity')}
              />
              <DailySummaryMetric
                category="heart"
                icon={HeartIcon}
                label="Fitness (CTL)"
                value={hasValue(data.fitness.ctl) ? formatDecimal(data.fitness.ctl, 1) : '\u2014'}
                note={hasValue(data.fitness.ctl) ? baselineNote(analysis.ctl, 'CTL') : 'Unavailable'}
                onClick={() => navigate('fitness')}
              />
              <DailySummaryMetric
                category="recovery"
                icon={GaugeIcon}
                label="HRV"
                value={hasValue(data.wellness.hrv) ? `${formatNumber(data.wellness.hrv)} ms` : '\u2014'}
                note={hasValue(data.wellness.hrv) ? baselineNote(analysis.hrv, 'ms') : 'Unavailable'}
                onClick={() => navigate('wellness')}
              />
            </div>
          </HomeSection>

          {(hasFitness || hasLoad) && (
            <HomeSection id="fitness" title="Fitness and load">
              <div className="home-core-grid">
                <Panel className="home-fitness-card" category="fitness" onClick={() => navigate('fitness')} ariaLabel="Open Fitness">
                  <PanelHeader title="Fitness" icon={StepsIcon} action={<ChevronRightIcon aria-hidden="true" />} />
                  <div className="home-card-lead">
                    <div><strong>{hasValue(data.fitness.ctl) ? formatDecimal(data.fitness.ctl, 1) : '\u2014'}</strong><span>CTL</span></div>
                    <TinyStat label="ATL" value={hasValue(data.fitness.atl) ? formatDecimal(data.fitness.atl, 1) : '\u2014'} />
                    <TinyStat label="TSB" value={hasValue(data.fitness.tsb) ? formatDecimal(data.fitness.tsb, 1) : '\u2014'} />
                  </div>
                </Panel>

                {vitalSnapshots.length > 0 && (
                  <Panel className="home-vitals-card" category="recovery" onClick={() => navigate('wellness')} ariaLabel="Open Wellness">
                    <PanelHeader title="Wellness" icon={HeartIcon} action={<ChevronRightIcon aria-hidden="true" />} />
                    <div className="vital-snapshot-grid">{vitalSnapshots.map((item) => <VitalSnapshot key={item.id} {...item} />)}</div>
                  </Panel>
                )}
              </div>
            </HomeSection>
          )}

          {(ctlTrend.filter(hasValue).length > 1 || hrvTrend.filter(hasValue).length > 1 || restingHRTrend.filter(hasValue).length > 1 || sleepTrend.filter(hasValue).length > 1) && (
            <HomeSection id="trends" title="Personal trends">
              <div className="metric-trend-grid">
                <MetricTrendPanel data={data} category="activity" icon={StepsIcon} title="Fitness (CTL)" values={ctlTrend} formatter={(value) => formatDecimal(value, 1)} />
                <MetricTrendPanel data={data} category="heart" icon={HeartIcon} title="Resting heart rate" values={restingHRTrend} formatter={(value) => `${Math.round(value)} bpm`} />
                <MetricTrendPanel data={data} category="recovery" icon={GaugeIcon} title="HRV" values={hrvTrend} formatter={(value) => `${formatNumber(value)} ms`} />
                <MetricTrendPanel data={data} category="sleep" icon={SleepIcon} title="Sleep" values={sleepTrend} formatter={(value) => compactMinutes(value)} />
              </div>
            </HomeSection>
          )}

          {data.activities.length > 0 && (
            <HomeSection id="activities" title="Recent activities">
              <Panel className="home-activities-card activity-panel" category="activity">
                <PanelHeader
                  title="Activities"
                  icon={ActivityIcon}
                  action={
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {uniqueSports.length > 1 && <SportFilter sports={uniqueSports} selected={sportFilter} onChange={setSportFilter} />}
                      <DetailAction label="Open all activities" onClick={() => navigate('activity')} />
                    </div>
                  }
                />
                {filteredActivities.slice(0, 3).map((item, index) => <div key={item.id}>{index > 0 && <Separator />}<CompactActivity item={item} /></div>)}
                {!filteredActivities.length && <EmptyValue>No activities for this sport.</EmptyValue>}
              </Panel>
            </HomeSection>
          )}
        </div>
      )}
    </div>
  )
}

export function ActivityView({ data }: ViewProps) {
  const [sportFilter, setSportFilter] = useState('all')
  const uniqueSports = [...new Set(data.activities.map(a => a.type))]
  const filteredActivities = sportFilter === 'all' ? data.activities : data.activities.filter(a => a.type === sportFilter)

  return (
    <div className="page-stack activity-page">
      <div className="metric-grid activity-primary-metrics">
        <Panel className="metric-tile" category="activity" ariaLabel={`Today load: ${hasValue(data.activity.todayLoad) ? formatDecimal(data.activity.todayLoad) : 'unavailable'}`}>
          <div className="metric-tile-head"><DuoIcon icon={GaugeIcon} /><span>Today load</span></div>
          <div className="metric-value">{hasValue(data.activity.todayLoad) ? formatDecimal(data.activity.todayLoad) : '\u2014'}</div>
        </Panel>
        <Panel className="metric-tile" category="activity" ariaLabel={`Week load: ${hasValue(data.activity.weekLoad) ? formatDecimal(data.activity.weekLoad) : 'unavailable'}`}>
          <div className="metric-tile-head"><DuoIcon icon={TrendIcon} /><span>Week load</span></div>
          <div className="metric-value">{hasValue(data.activity.weekLoad) ? formatDecimal(data.activity.weekLoad) : '\u2014'}</div>
        </Panel>
        <Panel className="metric-tile" category="activity" ariaLabel={`Avg intensity: ${hasValue(data.activity.avgIntensity) ? formatDecimal(data.activity.avgIntensity) : 'unavailable'}`}>
          <div className="metric-tile-head"><DuoIcon icon={ActivityIcon} /><span>Avg intensity</span></div>
          <div className="metric-value">{hasValue(data.activity.avgIntensity) ? formatDecimal(data.activity.avgIntensity) : '\u2014'}</div>
        </Panel>
      </div>

      <section>
        <SectionTitle
          title="Activities"
          copy={`${filteredActivities.length} activities in the synced period`}
          action={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {uniqueSports.length > 1 && <SportFilter sports={uniqueSports} selected={sportFilter} onChange={setSportFilter} />}
              <ExportButton
                data={filteredActivities as unknown as Record<string, unknown>[]}
                fields={['name', 'type', 'startDate', 'movingTime', 'distance', 'trainingLoad', 'avgPower', 'avgHeartRate', 'intensity']}
                filename={`activities-${data.selectedDate}`}
              />
            </div>
          }
        />
        <Panel className="activity-panel full-list" category="activity">
          {filteredActivities.map((item, index) => <div key={item.id}>{index > 0 && <Separator />}<CompactActivity item={item} detailed /></div>)}
          {!filteredActivities.length && <EmptyValue>No workouts recorded for this filter.</EmptyValue>}
        </Panel>
      </section>

      {!hasActivityData(data) && <EmptyValue>No activity data available for this day.</EmptyValue>}
    </div>
  )
}

export function FitnessView({ data }: ViewProps) {
  const fitness = data.fitness
  const hasFitnessData = fitness.ctl !== null || fitness.atl !== null || fitness.tsb !== null

  return (
    <div className="page-stack fitness-page">
      {hasFitnessData && (
        <>
          <div className="metric-grid fitness-primary-metrics">
            <MetricTile label="CTL (Fitness)" value={fitness.ctl} icon={StepsIcon} decimals={1} />
            <MetricTile label="ATL (Fatigue)" value={fitness.atl} icon={ActivityIcon} decimals={1} />
            <MetricTile label="TSB (Form)" value={fitness.tsb} icon={HeartIcon} decimals={1} />
            <MetricTile label="Ramp Rate" value={fitness.rampRate} icon={GaugeIcon} decimals={2} />
          </div>

          {fitness.ctlHistory.length > 1 && (
            <Panel className="chart-panel" category="fitness">
              <PanelHeader eyebrow="Performance Management" title="CTL / ATL / TSB" icon={StepsIcon} />
              <div className="pmc-chart">
                <LineChart
                  values={fitness.ctlHistory.map(p => p.value)}
                  labels={fitness.ctlHistory.map(p => p.date.slice(5))}
                  color="var(--category-fitness)"
                  height={300}
                  formatter={(v) => `${v.toFixed(1)}`}
                  ariaLabel="CTL fitness trend"
                />
              </div>
              <div className="mini-trend-stats">
                <div><span>ATL</span><strong>{fitness.atl ?? '\u2014'}</strong></div>
                <div><span>TSB</span><strong>{fitness.tsb ?? '\u2014'}</strong></div>
              </div>
            </Panel>
          )}
        </>
      )}
      {!hasFitnessData && <EmptyValue>No fitness data available. Connect Intervals.icu to see your training load.</EmptyValue>}
    </div>
  )
}

export function PowerView({ data }: ViewProps) {
  const power = data.power
  const hasPowerData = power.curves.length > 0 || power.ftp !== null

  return (
    <div className="page-stack power-page">
      {hasPowerData && (
        <>
          <div className="metric-grid power-primary-metrics">
            <MetricTile label="FTP" value={power.ftp} unit=" W" icon={ActivityIcon} />
            <MetricTile label="eFTP" value={power.eftp} unit=" W" icon={GaugeIcon} />
            <MetricTile label="VO2max (5min)" value={power.vo2max5m} icon={HeartIcon} decimals={1} />
            <MetricTile label="W/kg (5min)" value={power.wkg5m} unit=" W/kg" icon={StepsIcon} decimals={2} />
          </div>

          {power.curves.length > 0 && (
            <Panel className="chart-panel power-curve-panel" category="power">
              <PanelHeader
                eyebrow={`${power.curves.length} duration points`}
                title="Power Curve"
                icon={ActivityIcon}
                action={
                  <ExportButton
                    data={power.curves as unknown as Record<string, unknown>[]}
                    fields={['secs', 'watts', 'wattsPerKg']}
                    filename={`power-curves-${data.selectedDate}`}
                  />
                }
              />
              <LineChart
                values={power.curves.map(p => p.watts)}
                labels={power.curves.map(p => {
                  if (p.secs < 60) return `${p.secs}s`
                  if (p.secs < 3600) return `${p.secs / 60}m`
                  return `${p.secs / 3600}h`
                })}
                color="var(--category-power)"
                height={266}
                formatter={(v) => `${Math.round(v)} W`}
                ariaLabel="Power curve"
              />
              <div className="power-curve-table">
                {power.curves.slice(0, 8).map((point) => (
                  <div key={point.secs} className="power-curve-point">
                    <span>{point.secs < 60 ? `${point.secs}s` : `${point.secs / 60}m`}</span>
                    <strong>{Math.round(point.watts)} W</strong>
                    <small>{point.wattsPerKg.toFixed(2)} W/kg</small>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </>
      )}
      {!hasPowerData && <EmptyValue>No power data available. Ride with a power meter to see your power curve.</EmptyValue>}
    </div>
  )
}

export function WellnessView({ data, onDateChange }: ViewProps) {
  const w = data.wellness
  const hasWellness = w.hrv !== null || w.restingHR !== null || w.sleepMinutes !== null || w.readiness !== null
  const [dialogOpen, setDialogOpen] = useState(false)

  const buildInitialData = (): Partial<WellnessFormData> => {
    const result: Partial<WellnessFormData> = { date: data.selectedDate }
    for (const key of Object.keys(w) as Array<keyof typeof w>) {
      if (w[key] !== null) {
        (result as Record<string, unknown>)[key] = w[key]
      }
    }
    return result
  }

  const handleSave = async (form: WellnessFormData) => {
    try {
      const res = await fetch('/api/data/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) return
      setDialogOpen(false)
      onDateChange?.(data.selectedDate)
    } catch {
      // silently fail
    }
  }

  return (
    <div className="page-stack wellness-page">
      {hasWellness && (
        <>
          <div className="metric-grid wellness-primary-metrics">
            <MetricTile label="Resting HR" value={w.restingHR} unit=" bpm" icon={HeartIcon} />
            <MetricTile label="HRV" value={w.hrv} unit=" ms" icon={GaugeIcon} />
            <MetricTile label="Sleep" value={w.sleepMinutes} unit=" min" icon={BodyIcon} />
            <MetricTile label="Readiness" value={w.readiness} icon={ActivityIcon} decimals={1} />
          </div>

          <Panel className="wellness-detail-panel" category="wellness">
            <PanelHeader
              title="Daily wellness"
              icon={HeartIcon}
              action={
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <WellnessDialog
                    date={data.selectedDate}
                    initialData={buildInitialData()}
                    onSave={handleSave}
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    trigger={<Button variant="outline" size="sm">Edit</Button>}
                  />
                  <ExportButton
                    data={data.trends as unknown as Record<string, unknown>[]}
                    fields={['date', 'restingHR', 'hrv', 'sleepMinutes', 'sleepScore', 'mood', 'stress', 'fatigue', 'readiness', 'weight']}
                    filename={`wellness-${data.selectedDate}`}
                  />
                </div>
              }
            />
            <div className="wellness-grid">
              {w.sleepScore !== null && <div className="wellness-item"><span>Sleep score</span><strong>{w.sleepScore}</strong></div>}
              {w.sleepQuality !== null && <div className="wellness-item"><span>Sleep quality</span><strong>{w.sleepQuality}/5</strong></div>}
              {w.avgSleepingHR !== null && <div className="wellness-item"><span>Avg sleeping HR</span><strong>{w.avgSleepingHR} bpm</strong></div>}
              {w.hrvSDNN !== null && <div className="wellness-item"><span>HRV (SDNN)</span><strong>{w.hrvSDNN} ms</strong></div>}
              {w.spO2 !== null && <div className="wellness-item"><span>SpO2</span><strong>{w.spO2}%</strong></div>}
              {w.vo2max !== null && <div className="wellness-item"><span>VO2max</span><strong>{w.vo2max} ml/kg/min</strong></div>}
              {w.bodyFat !== null && <div className="wellness-item"><span>Body fat</span><strong>{w.bodyFat}%</strong></div>}
              {w.weight !== null && <div className="wellness-item"><span>Weight</span><strong>{w.weight} kg</strong></div>}
              {w.systolic !== null && <div className="wellness-item"><span>Blood pressure</span><strong>{w.systolic}/{w.diastolic}</strong></div>}
              {w.kcalConsumed !== null && <div className="wellness-item"><span>Calories</span><strong>{w.kcalConsumed} kcal</strong></div>}
              {w.hydration !== null && <div className="wellness-item"><span>Hydration</span><strong>{w.hydration} ml</strong></div>}
              {w.respiration !== null && <div className="wellness-item"><span>Respiration</span><strong>{w.respiration} rpm</strong></div>}
              {w.steps !== null && <div className="wellness-item"><span>Steps</span><strong>{w.steps}</strong></div>}
              {w.mood !== null && <div className="wellness-item"><span>Mood</span><strong>{w.mood}/5</strong></div>}
              {w.stress !== null && <div className="wellness-item"><span>Stress</span><strong>{w.stress}/5</strong></div>}
              {w.fatigue !== null && <div className="wellness-item"><span>Fatigue</span><strong>{w.fatigue}/5</strong></div>}
              {w.motivation !== null && <div className="wellness-item"><span>Motivation</span><strong>{w.motivation}/5</strong></div>}
              {w.soreness !== null && <div className="wellness-item"><span>Soreness</span><strong>{w.soreness}/5</strong></div>}
            </div>
          </Panel>
        </>
      )}
      {!hasWellness && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <EmptyValue>No wellness data available for this day.</EmptyValue>
          <div style={{ marginTop: 16 }}>
            <WellnessDialog
              date={data.selectedDate}
              onSave={handleSave}
              trigger={<Button>Add wellness entry</Button>}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export function CalendarView({ data }: ViewProps) {
  const [sportFilter, setSportFilter] = useState('all')
  const [localEvents, setLocalEvents] = useState(data.events ?? [])
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const uniqueSports = [...new Set(localEvents.map(e => e.type))]
  const filteredEvents = sportFilter === 'all' ? localEvents : localEvents.filter(e => e.type === sportFilter)
  const hasEvents = localEvents.length > 0

  const handleSave = async (form: EventFormData) => {
    try {
      const body = {
        name: form.name,
        start_date: form.startDate,
        type: form.type,
        category: form.category,
        moving_time: form.movingTime,
        description: form.description || undefined,
        indoor: form.indoor,
      }

      if (editingEvent) {
        const res = await fetch(`/api/data/events/${editingEvent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) return
        const updated = await res.json()
        setLocalEvents((prev) => prev.map((e) => (e.id === editingEvent.id ? { ...e, ...mapEventFromICU(updated) } : e)))
      } else {
        const res = await fetch('/api/data/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) return
        const created = await res.json()
        setLocalEvents((prev) => [...prev, mapEventFromICU(created)])
      }

      setEditingEvent(null)
      setDialogOpen(false)
    } catch {
      // silently fail
    }
  }

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/data/events/${id}`, { method: 'DELETE' })
      if (!res.ok) return
      setLocalEvents((prev) => prev.filter((e) => e.id !== id))
    } catch {
      // silently fail
    }
    setDeletingId(null)
  }

  return (
    <div className="page-stack calendar-page">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <EventDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSave={handleSave}
          event={editingEvent}
          trigger={<Button size="sm">+ Add event</Button>}
        />
        {uniqueSports.length > 1 && <SportFilter sports={uniqueSports} selected={sportFilter} onChange={setSportFilter} />}
      </div>

      {hasEvents && (
        <>
          <SectionTitle title="Training calendar" copy={`${filteredEvents.length} events in range`} action={
            <ExportButton
              data={filteredEvents as unknown as Record<string, unknown>[]}
              fields={['startDate', 'name', 'type', 'category', 'movingTime', 'trainingLoad', 'indoor']}
              filename={`events-${data.selectedDate}`}
            />
          } />
          <Panel className="calendar-events-panel" category="calendar">
            {filteredEvents.map((event, index) => (
              <div key={event.id}>
                {index > 0 && <Separator />}
                <div className="calendar-event-row">
                  <div className="calendar-event-date">
                    <strong>{event.startDate.slice(8)}</strong>
                    <small>{event.startDate.slice(0, 7)}</small>
                  </div>
                  <div className="calendar-event-copy">
                    <strong>{event.name}</strong>
                    <span>{event.type}{event.category !== 'WORKOUT' ? ` \u00B7 ${event.category}` : ''}</span>
                    {event.description && <p>{event.description}</p>}
                  </div>
                  <div className="calendar-event-meta">
                    {event.movingTime && <span>{Math.round(event.movingTime / 60)} min</span>}
                    {event.trainingLoad && <span>{event.trainingLoad} TSS</span>}
                    {event.indoor && <small>Indoor</small>}
                  </div>
                  <div className="calendar-event-actions" style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => { setEditingEvent(event); setDialogOpen(true) }}
                      aria-label="Edit event"
                    >
                      &hellip;
                    </Button>
                    {deletingId === event.id ? (
                      <Button variant="destructive" size="xs" onClick={() => handleDelete(event.id)}>Confirm</Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setDeletingId(event.id)}
                        aria-label="Delete event"
                      >
                        <TrashIcon />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </Panel>
        </>
      )}
      {!hasEvents && <EmptyValue>No events in your calendar.</EmptyValue>}
    </div>
  )
}

function mapEventFromICU(raw: Record<string, unknown>): CalendarEvent {
  return {
    id: raw.id as number,
    startDate: (raw.start_date_local ?? raw.startDate ?? '') as string,
    name: raw.name as string,
    type: (raw.type ?? 'Ride') as CalendarEvent['type'],
    category: (raw.category ?? 'WORKOUT') as CalendarEvent['category'],
    movingTime: (raw.moving_time ?? raw.movingTime ?? null) as number | null,
    trainingLoad: (raw.icu_training_load ?? raw.trainingLoad ?? null) as number | null,
    indoor: Boolean(raw.indoor ?? false),
    description: (raw.description ?? null) as string | null,
  }
}

export function DataSourcesView({ data, status }: ViewProps) {
  const isDemo = data.source === 'demo'
  const sourceName = isDemo ? 'Demo data' : 'Intervals.icu'

  return (
    <div className="page-stack data-sources-page">
      <div className="data-overview">
        <Panel className="source-card" category="device">
          <PanelHeader eyebrow="Data source" title={sourceName} icon={CloudIcon} />
          <div className="source-details">
            <div className="detail-row">
              <span>Connection</span>
              <strong>{status.connected ? 'Connected' : 'Demo mode'}</strong>
            </div>
            {status.athleteName && (
              <div className="detail-row">
                <span>Athlete</span>
                <strong>{status.athleteName}</strong>
              </div>
            )}
            {status.lastSyncAt && (
              <div className="detail-row">
                <span>Last sync</span>
                <strong>{relativeTime(status.lastSyncAt)}</strong>
              </div>
            )}
            <div className="detail-row">
              <span>Selected date</span>
              <strong>{data.selectedDate}</strong>
            </div>
          </div>
        </Panel>

        {data.sync.errors.length > 0 && (
          <Panel className="source-errors" category="device">
            <PanelHeader title="Sync errors" icon={ShieldIcon} />
            {data.sync.errors.map((error, index) => (
              <div key={index} className="error-row"><span>{error.key}</span><small>{error.message}</small></div>
            ))}
          </Panel>
        )}
      </div>

      <div className="medical-note"><ShieldIcon aria-hidden="true" /><p>All data is fetched directly from Intervals.icu. No data is stored on external servers.</p></div>
    </div>
  )
}

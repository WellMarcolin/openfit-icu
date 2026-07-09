import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { DuoIcon, EmptyValue, Panel, PanelHeader } from './Shared'
import { ActivityIcon, TrashIcon } from './icons'
import { WorkoutDialog, type WorkoutItem, type WorkoutFormData } from './Workouts/WorkoutDialog'
import type { DashboardData, AuthStatus, PageId } from '@/types'
import { getSportIcon } from './icons'
import { compactMinutes } from '@/lib/format'
import { hasActivityData } from '@/lib/data-availability'

interface WorkoutViewProps {
  data: DashboardData
  status: AuthStatus
  navigate: (page: PageId) => void
}

export function WorkoutView({ data, status }: WorkoutViewProps) {
  const [workouts, setWorkouts] = useState<WorkoutItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<WorkoutItem | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    fetchWorkouts()
  }, [])

  const fetchWorkouts = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/data/workouts')
      if (!res.ok) { setWorkouts([]); return }
      const list = await res.json()
      setWorkouts(Array.isArray(list) ? list.map(mapWorkoutFromICU) : [])
    } catch {
      setWorkouts([])
    }
    setLoading(false)
  }

  const handleSave = async (form: WorkoutFormData) => {
    const body = {
      name: form.name,
      workout_type: form.type,
      description: form.description || undefined,
      moving_time: form.movingTime,
      indoor: form.indoor,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
    }

    try {
      if (editing) {
        const res = await fetch(`/api/data/workouts/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) return
        const updated = await res.json()
        setWorkouts((prev) => prev.map((w) => (w.id === editing.id ? mapWorkoutFromICU(updated) : w)))
      } else {
        const res = await fetch('/api/data/workouts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) return
        const created = await res.json()
        setWorkouts((prev) => [...prev, mapWorkoutFromICU(created)])
      }
      setEditing(null)
      setDialogOpen(false)
    } catch {
      // silently fail
    }
  }

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/data/workouts/${id}`, { method: 'DELETE' })
      if (!res.ok) return
      setWorkouts((prev) => prev.filter((w) => w.id !== id))
    } catch {
      // silently fail
    }
    setDeletingId(null)
  }

  return (
    <div className="page-stack workouts-page">
      <WorkoutDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        workout={editing}
        trigger={<Button size="sm">+ New workout</Button>}
      />

      {loading && <EmptyValue>Loading workouts...</EmptyValue>}
      {!loading && workouts.length === 0 && <EmptyValue>No workouts in the library. Create your first workout!</EmptyValue>}
      {!loading && workouts.length > 0 && (
        <section>
          <Panel className="activity-panel full-list" category="training">
            {workouts.map((workout, index) => {
              const SportIcon = getSportIcon(workout.type)
              return (
                <div key={workout.id}>
                  {index > 0 && <Separator />}
                  <div className="activity-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
                    <DuoIcon icon={SportIcon} className="activity-icon" />
                    <div className="activity-copy" style={{ flex: 1 }}>
                      <strong>{workout.name}</strong>
                      <span>{workout.type}{workout.tags?.length ? ` · ${workout.tags.join(', ')}` : ''}</span>
                    </div>
                    <div className="activity-meta">
                      {workout.movingTime && <span>{compactMinutes(workout.movingTime)}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Button variant="ghost" size="icon-xs" onClick={() => { setEditing(workout); setDialogOpen(true) }} aria-label="Edit workout">&hellip;</Button>
                      {deletingId === workout.id ? (
                        <Button variant="destructive" size="xs" onClick={() => handleDelete(workout.id)}>Confirm</Button>
                      ) : (
                        <Button variant="ghost" size="icon-xs" onClick={() => setDeletingId(workout.id)} aria-label="Delete workout"><TrashIcon /></Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </Panel>
        </section>
      )}
    </div>
  )
}

function mapWorkoutFromICU(raw: Record<string, unknown>): WorkoutItem {
  return {
    id: raw.id as number,
    name: raw.name as string,
    type: (raw.workout_type ?? raw.type ?? 'Ride') as WorkoutItem['type'],
    description: (raw.description ?? null) as string | null,
    movingTime: (raw.moving_time ?? raw.movingTime ?? null) as number | null,
    indoor: Boolean(raw.indoor ?? false),
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    workout_doc: (raw.workout_doc ?? null) as Record<string, unknown> | null,
  }
}

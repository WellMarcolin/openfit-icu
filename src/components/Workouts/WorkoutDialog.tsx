import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { StepDialog } from './StepDialog'
import type { WorkoutStep } from '@/lib/workout-builder'
import { parseWorkoutDoc } from '@/lib/workout-builder'
import type { SportType } from '@/types'

export interface WorkoutFormData {
  name: string
  type: SportType
  description: string
  movingTime: number
  indoor: boolean
  tags: string
  steps: WorkoutStep[]
}

const SPORT_TYPES: SportType[] = ['Ride', 'Run', 'Swim', 'Walk', 'Hike', 'WeightTraining', 'VirtualRide', 'VirtualRun', 'TrailRun']

const defaultForm: WorkoutFormData = {
  name: '',
  type: 'Ride',
  description: '',
  movingTime: 3600,
  indoor: false,
  tags: '',
  steps: [],
}

export interface WorkoutItem {
  id: number
  name: string
  type: SportType
  description: string | null
  movingTime: number | null
  indoor: boolean
  tags: string[]
  workout_doc: Record<string, unknown> | null
}

interface WorkoutDialogProps {
  workout?: WorkoutItem | null
  onSave: (data: WorkoutFormData) => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function WorkoutDialog({ workout, onSave, trigger, open, onOpenChange }: WorkoutDialogProps) {
  const [form, setForm] = useState<WorkoutFormData>(
    workout
      ? {
          name: workout.name,
          type: workout.type,
          description: workout.description ?? '',
          movingTime: workout.movingTime ?? 3600,
          indoor: workout.indoor,
          tags: workout.tags?.join(', ') ?? '',
          steps: parseWorkoutDoc(workout.workout_doc as any),
        }
      : { ...defaultForm }
  )

  const [stepDialogOpen, setStepDialogOpen] = useState(false)
  const [editingStep, setEditingStep] = useState<WorkoutStep | null>(null)

  const handleAddStep = (step: WorkoutStep) => {
    setForm((prev) => ({ ...prev, steps: [...prev.steps, step] }))
    setEditingStep(null)
    setStepDialogOpen(false)
  }

  const handleEditStep = (index: number) => {
    setEditingStep(form.steps[index])
    setStepDialogOpen(true)
  }

  const handleUpdateStep = (step: WorkoutStep) => {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => (s.id === step.id ? step : s)),
    }))
    setEditingStep(null)
    setStepDialogOpen(false)
  }

  const handleDeleteStep = (index: number) => {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index),
    }))
  }

  const handleMoveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= form.steps.length) return
    setForm((prev) => {
      const next = [...prev.steps]
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...prev, steps: next }
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(form)
  }

  const update = <K extends keyof WorkoutFormData>(key: K, value: WorkoutFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const content = (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{workout ? 'Edit workout' : 'New workout'}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3 py-4">
        <div className="grid gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={form.name} onChange={(e) => update('name', e.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="type">Type</Label>
          <select
            id="type"
            value={form.type}
            onChange={(e) => update('type', e.target.value as SportType)}
            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 13 }}
          >
            {SPORT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="duration">Duration (minutes)</Label>
          <Input
            id="duration"
            type="number"
            min={0}
            value={Math.round(form.movingTime / 60)}
            onChange={(e) => update('movingTime', parseInt(e.target.value) * 60 || 0)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={3}
            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tags">Tags (comma separated)</Label>
          <Input id="tags" value={form.tags} onChange={(e) => update('tags', e.target.value)} placeholder="e.g. endurance, base" />
        </div>
        <label className="flex items-center gap-2" style={{ fontSize: 13 }}>
          <input type="checkbox" checked={form.indoor} onChange={(e) => update('indoor', e.target.checked)} />
          Indoor
        </label>
        <Separator />
        <div className="steps-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label style={{ fontWeight: 600 }}>Steps</Label>
            <StepDialog onSave={handleAddStep} trigger={<Button variant="outline" size="sm">+ Add step</Button>} />
          </div>
          {form.steps.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>No steps defined. Add warmup, intervals, and cooldown.</p>}
          <div className="steps-list" style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {form.steps.map((s, i) => (
              <div key={s.id} className="step-card" style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 13,
              }}>
                <span style={{ fontWeight: 600, minWidth: 20 }}>{i + 1}.</span>
                <div style={{ flex: 1 }}>
                  <strong>{s.label || (s.type === 'repeat' ? `×${s.reps}` : s.type)}</strong>
                  <span style={{ color: 'var(--muted-foreground)', marginLeft: 8 }}>
                    {s.duration ? `${s.duration}min` : ''}
                    {s.target ? ` @ ${s.target.value}${s.target.units}` : ''}
                    {s.flags.length ? ` [${s.flags.join(', ')}]` : ''}
                    {s.type === 'repeat' && s.children.length ? ` (${s.children.length} steps)` : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="button" onClick={() => handleMoveStep(i, -1)} disabled={i === 0} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: i === 0 ? 0.3 : 1 }}>▲</button>
                  <button type="button" onClick={() => handleMoveStep(i, 1)} disabled={i === form.steps.length - 1} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: i === form.steps.length - 1 ? 0.3 : 1 }}>▼</button>
                  <button type="button" onClick={() => handleEditStep(i)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Edit</button>
                  <button type="button" onClick={() => handleDeleteStep(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'red' }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <StepDialog
          step={editingStep}
          onSave={handleUpdateStep}
          open={stepDialogOpen}
          onOpenChange={(open) => { setStepDialogOpen(open); if (!open) setEditingStep(null) }}
        />
      </div>
      <DialogFooter>
        <Button type="submit">{workout ? 'Save' : 'Create'}</Button>
      </DialogFooter>
    </form>
  )

  if (trigger) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent>{content}</DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{content}</DialogContent>
    </Dialog>
  )
}

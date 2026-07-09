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
import type { SportType } from '@/types'

export interface WorkoutFormData {
  name: string
  type: SportType
  description: string
  movingTime: number
  indoor: boolean
  tags: string
}

const SPORT_TYPES: SportType[] = ['Ride', 'Run', 'Swim', 'Walk', 'Hike', 'WeightTraining', 'VirtualRide', 'VirtualRun', 'TrailRun']

const defaultForm: WorkoutFormData = {
  name: '',
  type: 'Ride',
  description: '',
  movingTime: 3600,
  indoor: false,
  tags: '',
}

export interface WorkoutItem {
  id: number
  name: string
  type: SportType
  description: string | null
  movingTime: number | null
  indoor: boolean
  tags: string[]
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
        }
      : { ...defaultForm }
  )

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

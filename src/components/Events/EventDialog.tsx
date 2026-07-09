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
import type { CalendarEvent, SportType } from '@/types'

export interface EventFormData {
  name: string
  startDate: string
  type: SportType
  category: CalendarEvent['category']
  movingTime: number
  description: string
  indoor: boolean
}

const SPORT_TYPES: SportType[] = ['Ride', 'Run', 'Swim', 'Walk', 'Hike', 'WeightTraining', 'VirtualRide', 'VirtualRun', 'TrailRun']
const CATEGORIES: CalendarEvent['category'][] = ['WORKOUT', 'RACE_A', 'RACE_B', 'RACE_C', 'NOTE', 'HOLIDAY', 'SICK', 'INJURED']

const defaultForm: EventFormData = {
  name: '',
  startDate: new Date().toISOString().slice(0, 10),
  type: 'Ride',
  category: 'WORKOUT',
  movingTime: 3600,
  description: '',
  indoor: false,
}

interface EventDialogProps {
  event?: CalendarEvent | null
  onSave: (data: EventFormData) => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function EventDialog({ event, onSave, trigger, open, onOpenChange }: EventDialogProps) {
  const [form, setForm] = useState<EventFormData>(
    event
      ? {
          name: event.name,
          startDate: event.startDate.slice(0, 10),
          type: event.type,
          category: event.category,
          movingTime: event.movingTime ?? 3600,
          description: event.description ?? '',
          indoor: event.indoor,
        }
      : { ...defaultForm }
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(form)
  }

  const update = <K extends keyof EventFormData>(key: K, value: EventFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const content = (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{event ? 'Edit event' : 'New event'}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3 py-4">
        <div className="grid gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={form.name} onChange={(e) => update('name', e.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" value={form.startDate} onChange={(e) => update('startDate', e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
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
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              value={form.category}
              onChange={(e) => update('category', e.target.value as CalendarEvent['category'])}
              style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 13 }}
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
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
        <label className="flex items-center gap-2" style={{ fontSize: 13 }}>
          <input type="checkbox" checked={form.indoor} onChange={(e) => update('indoor', e.target.checked)} />
          Indoor
        </label>
      </div>
      <DialogFooter>
        <Button type="submit">{event ? 'Save' : 'Create'}</Button>
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

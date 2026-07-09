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

interface ScheduleDialogProps {
  workoutName: string
  onSchedule: (date: string) => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function todayString(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

export function ScheduleDialog({ workoutName, onSchedule, trigger, open, onOpenChange }: ScheduleDialogProps) {
  const [date, setDate] = useState(todayString())
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    onSchedule(date)
    setSaving(false)
  }

  const content = (
    <form onSubmit={handleSubmit}>
      <DialogHeader><DialogTitle>Schedule &ldquo;{workoutName}&rdquo;</DialogTitle></DialogHeader>
      <div className="grid gap-3 py-4">
        <div className="grid gap-1.5">
          <Label htmlFor="schedule-date">Date</Label>
          <Input id="schedule-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={saving}>Schedule</Button>
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

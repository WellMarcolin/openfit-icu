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
import type { WorkoutStep, StepTarget } from '@/lib/workout-builder'
import { defaultStep } from '@/lib/workout-builder'

export type { WorkoutStep, StepTarget }

interface StepDialogProps {
  step?: WorkoutStep | null
  onSave: (step: WorkoutStep) => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const TARGET_UNITS: Record<string, string[]> = {
  power: ['%ftp', 'w', 'power_zone'],
  hr: ['%hr', '%lthr', 'hr_zone'],
  pace: ['%pace', 'pace_zone'],
  cadence: ['cadence'],
}

function initForm(step?: WorkoutStep | null) {
  if (step) {
    return {
      label: step.label,
      type: step.type,
      duration: step.duration ?? 5,
      distance: step.distance ?? 0,
      hasTarget: step.target !== null,
      targetType: (step.target?.type ?? 'power') as 'power' | 'hr' | 'pace' | 'cadence',
      targetValue: step.target?.value ?? 80,
      targetUnits: step.target?.units ?? '%ftp',
      targetStart: step.target?.start ?? 0,
      targetEnd: step.target?.end ?? 0,
      reps: step.reps ?? 3,
      warmup: step.flags.includes('warmup'),
      cooldown: step.flags.includes('cooldown'),
      ramp: step.ramp,
    }
  }
  return {
    label: '',
    type: 'step' as const,
    duration: 5,
    distance: 0,
    hasTarget: false,
    targetType: 'power' as const,
    targetValue: 80,
    targetUnits: '%ftp',
    targetStart: 0,
    targetEnd: 0,
    reps: 3,
    warmup: false,
    cooldown: false,
    ramp: false,
  }
}

export function StepDialog({ step, onSave, trigger, open, onOpenChange }: StepDialogProps) {
  const [f, setF] = useState(initForm(step))
  const [saving, setSaving] = useState(false)

  const update = <K extends keyof ReturnType<typeof initForm>>(key: K, value: ReturnType<typeof initForm>[K]) => {
    setF((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const result: WorkoutStep = {
      id: step?.id ?? String(Date.now()),
      label: f.label,
      type: f.type,
      duration: f.duration || null,
      distance: f.distance || null,
      target: f.hasTarget ? {
        type: f.targetType,
        value: f.targetValue,
        units: f.targetUnits as StepTarget['units'],
        start: f.ramp && f.targetStart ? f.targetStart : undefined,
        end: f.ramp && f.targetEnd ? f.targetEnd : undefined,
      } : null,
      reps: f.type === 'repeat' ? f.reps : null,
      children: step?.children ?? [],
      flags: [
        ...(f.warmup ? ['warmup' as const] : []),
        ...(f.cooldown ? ['cooldown' as const] : []),
      ],
      ramp: f.ramp,
    }
    onSave(result)
    setSaving(false)
  }

  const units = TARGET_UNITS[f.targetType] ?? ['%ftp']

  const content = (
    <form onSubmit={handleSubmit}>
      <DialogHeader><DialogTitle>{step ? 'Edit step' : 'Add step'}</DialogTitle></DialogHeader>
      <div className="grid gap-3 py-4">
        <div className="grid gap-1.5">
          <Label htmlFor="slabel">Label</Label>
          <Input id="slabel" value={f.label} onChange={(e) => update('label', e.target.value)} placeholder="e.g. Hard interval" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="stype">Type</Label>
          <select
            id="stype"
            value={f.type}
            onChange={(e) => update('type', e.target.value as 'step' | 'repeat' | 'freeride')}
            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 13 }}
          >
            <option value="step">Step</option>
            <option value="repeat">Repeat</option>
            <option value="freeride">Freeride</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sduration">Duration (minutes)</Label>
          <Input id="sduration" type="number" min={0} value={f.duration} onChange={(e) => update('duration', parseInt(e.target.value) || 0)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sdistance">Distance (meters, optional)</Label>
          <Input id="sdistance" type="number" min={0} value={f.distance} onChange={(e) => update('distance', parseInt(e.target.value) || 0)} />
        </div>
        {f.type === 'repeat' && (
          <div className="grid gap-1.5">
            <Label htmlFor="sreps">Repetitions</Label>
            <Input id="sreps" type="number" min={1} value={f.reps} onChange={(e) => update('reps', parseInt(e.target.value) || 1)} />
          </div>
        )}
        <div className="grid gap-1.5">
          <Label>
            <input type="checkbox" checked={f.hasTarget} onChange={(e) => update('hasTarget', e.target.checked)} /> Set intensity target
          </Label>
        </div>
        {f.hasTarget && (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="stargettype">Target type</Label>
              <select id="stargettype" value={f.targetType} onChange={(e) => update('targetType', e.target.value as 'power' | 'hr' | 'pace' | 'cadence')}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 13 }}>
                <option value="power">Power</option>
                <option value="hr">Heart rate</option>
                <option value="pace">Pace</option>
                <option value="cadence">Cadence</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="stargetvalue">Value</Label>
              <Input id="stargetvalue" type="number" value={f.targetValue} onChange={(e) => update('targetValue', parseInt(e.target.value) || 0)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="stargetunits">Units</Label>
              <select id="stargetunits" value={f.targetUnits} onChange={(e) => update('targetUnits', e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 13 }}>
                {units.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            {f.ramp && (
              <div className="grid gap-1.5" style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div className="grid gap-1.5">
                  <Label htmlFor="sstart">Start</Label>
                  <Input id="sstart" type="number" value={f.targetStart} onChange={(e) => update('targetStart', parseInt(e.target.value) || 0)} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="send">End</Label>
                  <Input id="send" type="number" value={f.targetEnd} onChange={(e) => update('targetEnd', parseInt(e.target.value) || 0)} />
                </div>
              </div>
            )}
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={f.ramp} onChange={(e) => update('ramp', e.target.checked)} /> Ramp (gradual change)
            </label>
          </>
        )}
        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={f.warmup} onChange={(e) => update('warmup', e.target.checked)} /> Warmup
          </label>
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={f.cooldown} onChange={(e) => update('cooldown', e.target.checked)} /> Cooldown
          </label>
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={saving}>{step ? 'Save' : 'Add step'}</Button>
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

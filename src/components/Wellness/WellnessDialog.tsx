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

export interface WellnessFormData {
  date: string
  weight: number | null
  restingHR: number | null
  hrv: number | null
  sleepMinutes: number | null
  sleepScore: number | null
  sleepQuality: number | null
  avgSleepingHR: number | null
  spO2: number | null
  mood: number | null
  stress: number | null
  fatigue: number | null
  motivation: number | null
  soreness: number | null
  readiness: number | null
  vo2max: number | null
  bodyFat: number | null
  systolic: number | null
  diastolic: number | null
  hydration: number | null
  kcalConsumed: number | null
  respiration: number | null
  steps: number | null
}

const defaultForm: WellnessFormData = {
  date: new Date().toISOString().slice(0, 10),
  weight: null,
  restingHR: null,
  hrv: null,
  sleepMinutes: null,
  sleepScore: null,
  sleepQuality: null,
  avgSleepingHR: null,
  spO2: null,
  mood: null,
  stress: null,
  fatigue: null,
  motivation: null,
  soreness: null,
  readiness: null,
  vo2max: null,
  bodyFat: null,
  systolic: null,
  diastolic: null,
  hydration: null,
  kcalConsumed: null,
  respiration: null,
  steps: null,
}

interface WellnessDialogProps {
  date?: string
  initialData?: Partial<WellnessFormData>
  onSave: (data: WellnessFormData) => Promise<void>
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function WellnessDialog({ date, initialData, onSave, trigger, open, onOpenChange }: WellnessDialogProps) {
  const [form, setForm] = useState<WellnessFormData>(() => {
    if (initialData) {
      return {
        ...defaultForm,
        ...initialData,
        date: initialData.date ?? date ?? defaultForm.date,
      }
    }
    return { ...defaultForm, date: date ?? defaultForm.date }
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(form)
    } finally {
      setSaving(false)
    }
  }

  const update = <K extends keyof WellnessFormData>(key: K, value: WellnessFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const updateNumber = (key: keyof WellnessFormData, value: string) => {
    const parsed = value === '' ? null : parseFloat(value)
    update(key, (Number.isFinite(parsed) ? parsed : null) as WellnessFormData[keyof WellnessFormData])
  }

  interface FieldDef {
  key: keyof WellnessFormData
  label: string
  step: number
  min: number
  max?: number
}

  const formFields: Record<string, FieldDef[]> = {
    vitals: [
      { key: 'restingHR', label: 'Resting HR (bpm)', step: 1, min: 30, max: 250 },
      { key: 'hrv', label: 'HRV (ms)', step: 1, min: 0 },
      { key: 'avgSleepingHR', label: 'Avg Sleeping HR (bpm)', step: 1, min: 30, max: 250 },
      { key: 'spO2', label: 'SpO2 (%)', step: 0.1, min: 50, max: 100 },
      { key: 'respiration', label: 'Respiration (rpm)', step: 0.1, min: 5, max: 60 },
    ],
    sleep: [
      { key: 'sleepMinutes', label: 'Sleep (minutes)', step: 1, min: 0 },
      { key: 'sleepScore', label: 'Sleep Score', step: 1, min: 0, max: 100 },
      { key: 'sleepQuality', label: 'Sleep Quality (1-5)', step: 1, min: 1, max: 5 },
    ],
    subjective: [
      { key: 'mood', label: 'Mood (1-5)', step: 1, min: 1, max: 5 },
      { key: 'stress', label: 'Stress (1-5)', step: 1, min: 1, max: 5 },
      { key: 'fatigue', label: 'Fatigue (1-5)', step: 1, min: 1, max: 5 },
      { key: 'motivation', label: 'Motivation (1-5)', step: 1, min: 1, max: 5 },
      { key: 'soreness', label: 'Soreness (1-5)', step: 1, min: 1, max: 5 },
      { key: 'readiness', label: 'Readiness (1-5)', step: 1, min: 1, max: 5 },
    ],
    body: [
      { key: 'weight', label: 'Weight (kg)', step: 0.1, min: 20 },
      { key: 'bodyFat', label: 'Body Fat (%)', step: 0.1, min: 1, max: 70 },
      { key: 'vo2max', label: 'VO2max (ml/kg/min)', step: 0.1, min: 10, max: 100 },
      { key: 'systolic', label: 'Systolic BP', step: 1, min: 60, max: 300 },
      { key: 'diastolic', label: 'Diastolic BP', step: 1, min: 30, max: 200 },
    ],
    nutrition: [
      { key: 'kcalConsumed', label: 'Calories (kcal)', step: 1, min: 0 },
      { key: 'hydration', label: 'Hydration (ml)', step: 1, min: 0 },
    ],
    activity: [
      { key: 'steps', label: 'Steps', step: 1, min: 0 },
    ],
  }

  const content = (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{initialData ? 'Edit wellness data' : 'Add wellness data'}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto">
        <div className="grid gap-1.5">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" value={form.date} onChange={(e) => update('date', e.target.value)} required />
        </div>

        <fieldset>
          <legend style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Vitals</legend>
          <div className="grid grid-cols-2 gap-3">
            {formFields.vitals.map(({ key, label, step, min, max }) => (
              <div key={key} className="grid gap-1.5">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  type="number"
                  step={step}
                  min={min}
                  max={max}
                  value={form[key] ?? ''}
                  onChange={(e) => updateNumber(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Sleep</legend>
          <div className="grid grid-cols-2 gap-3">
            {formFields.sleep.map(({ key, label, step, min, max }) => (
              <div key={key} className="grid gap-1.5">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  type="number"
                  step={step}
                  min={min}
                  max={max}
                  value={form[key] ?? ''}
                  onChange={(e) => updateNumber(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Subjective</legend>
          <div className="grid grid-cols-2 gap-3">
            {formFields.subjective.map(({ key, label, step, min, max }) => (
              <div key={key} className="grid gap-1.5">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  type="number"
                  step={step}
                  min={min}
                  max={max}
                  value={form[key] ?? ''}
                  onChange={(e) => updateNumber(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Body</legend>
          <div className="grid grid-cols-2 gap-3">
            {formFields.body.map(({ key, label, step, min, max }) => (
              <div key={key} className="grid gap-1.5">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  type="number"
                  step={step}
                  min={min}
                  max={max}
                  value={form[key] ?? ''}
                  onChange={(e) => updateNumber(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Nutrition</legend>
          <div className="grid grid-cols-2 gap-3">
            {formFields.nutrition.map(({ key, label, step, min, max }) => (
              <div key={key} className="grid gap-1.5">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  type="number"
                  step={step}
                  min={min}
                  max={max}
                  value={form[key] ?? ''}
                  onChange={(e) => updateNumber(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Activity</legend>
          <div className="grid grid-cols-2 gap-3">
            {formFields.activity.map(({ key, label, step, min, max }) => (
              <div key={key} className="grid gap-1.5">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  type="number"
                  step={step}
                  min={min}
                  max={max}
                  value={form[key] ?? ''}
                  onChange={(e) => updateNumber(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </fieldset>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={saving}>{saving ? 'Saving\u2026' : 'Save'}</Button>
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
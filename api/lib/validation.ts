export function validateAthleteId(id: string | string[] | undefined): string {
  const raw = Array.isArray(id) ? id[0] : id || '0'
  if (!/^i?\d+$/.test(raw)) {
    throw new Error('Invalid athlete ID')
  }
  return raw
}

export function validateDateParam(value: string | string[] | undefined, name: string): string {
  if (value === undefined || value === null) return ''
  const raw = Array.isArray(value) ? value[0] : value
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(`Invalid ${name} parameter`)
  }
  return raw
}

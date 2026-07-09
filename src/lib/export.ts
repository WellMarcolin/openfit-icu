export function toCSV<T extends Record<string, unknown>>(rows: T[], fields: (keyof T)[]): string {
  if (rows.length === 0) return ''
  const header = fields.join(',')
  const body = rows.map(row =>
    fields.map(f => {
      const v = row[f]
      if (v === null || v === undefined) return ''
      const s = String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }).join(',')
  ).join('\n')
  return `${header}\n${body}`
}

export function toJSON<T>(rows: T[]): string {
  return JSON.stringify(rows, null, 2)
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

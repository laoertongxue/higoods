import { escapeHtml } from '../utils.ts'

export function buildPmsCsv(headers: string[], rows: Array<Array<string | number>>): string {
  const escapeCell = (value: string | number): string => {
    const text = String(value ?? '')
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  return [headers.map(escapeCell).join(','), ...rows.map((row) => row.map(escapeCell).join(','))].join('\n')
}

export function downloadPmsCsv(filename: string, headers: string[], rows: Array<Array<string | number>>): void {
  downloadPmsFile(filename, `\uFEFF${buildPmsCsv(headers, rows)}`, 'text/csv;charset=utf-8')
}

export function downloadPmsFile(filename: string, content: string, type = 'application/octet-stream'): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function buildPmsHtmlTemplateFile(title: string, headers: string[], rows: Array<Array<string | number>>): string {
  return `<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body><table border="1"><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`
}

export function escapeHtml(value: unknown): string {
  const text = value == null ? '' : String(value)
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function toClassName(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function escapeCssSelectorValue(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value)
  return Array.from(value, (character) => {
    if (/^[A-Za-z0-9_-]$/.test(character)) return character
    return `\\${character.codePointAt(0)?.toString(16)} `
  }).join('')
}

export function formatDateTime(value: string): string {
  if (!value) return '-'
  return value.slice(0, 16)
}

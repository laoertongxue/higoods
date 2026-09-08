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

/** 原型现场记录使用本机当地时间，不能去掉 ISO 的 Z 后冒充本地时间。 */
export function localDateTimeText(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

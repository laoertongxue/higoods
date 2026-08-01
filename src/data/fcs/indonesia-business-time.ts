export const INDONESIA_BUSINESS_TIME_ZONE = 'Asia/Jakarta'

const jakartaDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: INDONESIA_BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function formatParts(date: Date): Record<string, string> {
  return Object.fromEntries(
    jakartaDateTimeFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
}

export function getIndonesiaBusinessDateKey(date: Date = new Date()): string {
  const parts = formatParts(date)
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function formatIndonesiaBusinessDateTime(date: Date = new Date()): string {
  const parts = formatParts(date)
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}

export function isIndonesiaBusinessDateToday(
  value: string | undefined,
  now: Date = new Date(),
): boolean {
  const normalized = value?.trim() || ''
  if (!normalized) return false
  const dateKey = getIndonesiaBusinessDateKey(now)
  const hasExplicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)
  if (!hasExplicitZone) {
    const wallClockDate = /^(\d{4}-\d{2}-\d{2})(?:[ T]|$)/.exec(normalized)?.[1]
    return wallClockDate === dateKey
  }
  const instant = new Date(normalized)
  return !Number.isNaN(instant.getTime()) && getIndonesiaBusinessDateKey(instant) === dateKey
}

import { t } from '@/lib/i18n'

// Token whitelist — any ALL_CAPS_UNDERSCORE string containing one of these
// tokens is considered a status code candidate.
const STATUS_TOKENS = [
  'PENDING', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'DONE', 'CANCEL',
  'SHIPPED', 'DELIVERED', 'RECEIVED', 'INBOUND', 'OUTBOUND',
  'QC', 'REWORK', 'DEDUCT', 'SETTLEMENT', 'PAYMENT', 'DISPUTE', 'ARBITRAT',
  'ACTIVE', 'SUSPEND', 'BLACKLIST', 'VOID', 'DRAFT', 'SUBMIT',
  'STARTED', 'FINISHED', 'BLOCKED', 'ASSIGNED', 'UNASSIGNED', 'CONFIRMED',
  'CREATED', 'CLOSED', 'OPEN', 'RESOLVED', 'SENT', 'ACKED', 'VOIDED',
  'ARCHIVED', 'EXPIRED', 'PAID', 'UNPAID', 'INVOICED', 'SETTLED',
  'SCRAP', 'REMAKE', 'ACCEPT', 'SHORTAGE', 'OVERFLOW', 'DAMAGED',
  'REVIEW', 'AWARD', 'BIDDING', 'AWARDED', 'NOT_STARTED', 'INACTIVE',
  'RETURNED', 'WITHDRAWN', 'PLANNED', 'SCHEDULED', 'PAUSED', 'ON_HOLD',
  'DELAYED', 'OVERDUE', 'READY', 'SIGNED', 'REFUND', 'RETURN',
  'PICKING', 'PACKING', 'PACKED', 'STOCKTAK', 'PUTAWAY', 'DISPATCHED',
  // FCS-specific additions
  'PASS', 'FAIL', 'PARTIAL', 'PROCESS', 'COMPLET', 'ALLOCATION', 'GATE',
  'DEFECT', 'SUPPLIER', 'PROCESSOR', 'FACTORY', 'INTERNAL', 'PROGRESS',
]

/**
 * Returns true if the input string looks like an enum status code.
 * Criteria:
 *  1. Consists only of uppercase letters, digits, and underscores (SCREAMING_SNAKE_CASE)
 *  2. AND contains at least one known status token
 */
export function isLikelyStatusCode(input: string): boolean {
  if (!/^[A-Z][A-Z0-9_]*$/.test(input)) return false
  const upper = input.toUpperCase()
  return STATUS_TOKENS.some((token) => upper.includes(token))
}

/**
 * Formats an unknown value for display:
 * - Non-string: String(value)
 * - String with a known i18n mapping: returns the translation
 * - String that looks like a status code but has no mapping: returns unknownText
 *   and emits a console.warn to aid dict completion
 * - Anything else: returns the value as-is
 */
export function formatEnumText(
  value: unknown,
  opts?: { unknownText?: string },
): string {
  if (value === null || value === undefined) return ''
  if (typeof value !== 'string') return String(value)

  const translated = t(value)
  if (translated !== value) return translated

  if (isLikelyStatusCode(value)) {
    console.warn(`[i18n] missing enum mapping: ${value}`)
    return opts?.unknownText ?? '未知状态'
  }

  return value
}

import type { WoolWorkOrder } from './types.ts'

/** The payload printed on the existing one-batch wool delivery note. Parsing
 * never navigates to or fetches the supplied URL; actual record ownership is
 * checked by the caller after parsing. */
export function parseWoolHandoverCode(raw: string): { stage: WoolWorkOrder['stage']; woolOrderId: string; handoverId: string } | undefined {
  const code = raw.trim()
  if (!/^https?:\/\//i.test(code) && !code.startsWith('/')) return undefined
  try {
    const url = new URL(code, 'https://wool-label.invalid')
    if (!['http:', 'https:'].includes(url.protocol)) return undefined
    const match = url.pathname.match(/^\/fcs\/craft\/wool\/(knitting-orders|linking-orders)\/([^/]+)\/handover-print\/([^/]+)$/)
    if (!match) return undefined
    return { stage: match[1] === 'knitting-orders' ? 'KNITTING' : 'LINKING',
      woolOrderId: decodeURIComponent(match[2]), handoverId: decodeURIComponent(match[3]) }
  } catch { return undefined }
}

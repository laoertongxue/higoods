/** CONTRACT-002: 业务分配日为第1天，后续按自然日计时，包含星期日。 */
export const SEWING_RETURN_RULE_VERSION = 'PPIC-20261014-TWO-NODES-JAKARTA'
export const SEWING_RETURN_BUSINESS_TIME_ZONE = 'Asia/Jakarta'
export const SEWING_RETURN_MILESTONE_RATIOS = [0.35, 1] as const
export type SewingReturnMilestoneRatio = typeof SEWING_RETURN_MILESTONE_RATIOS[number]
/** 旧比例仅供原合同、旧快照和复核历史读取，当前规则不再生成。 */
export type SewingReturnHistoricalMilestoneRatio = SewingReturnMilestoneRatio | 0.3 | 0.7
export type SewingReturnQuantityStatus = 'READY' | 'WAIT_HANDOVER' | 'AMBIGUOUS' | 'SOURCE_UNAVAILABLE'
export const SEWING_RETURN_COUNTING_DAYS = {
  INDEPENDENT_SEWING: [4, 9],
  SEWING_TO_IRON_PACK: [5, 10],
  CUTTING_TO_IRON_PACK: [6, 12],
} as const

export function formatSewingBusinessWallClock(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: SEWING_RETURN_BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(date)
}

export function calculateSewingReturnDeadlineDate(startAt: string, countingDay: number): string {
  if (!Number.isInteger(countingDay) || countingDay < 1) throw new Error('回货节点计时日必须大于等于1')
  const dateText = startAt.slice(0, 10)
  const start = new Date(`${dateText}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText) || !Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== dateText) {
    throw new Error('业务分配时间不是有效日期')
  }
  start.setUTCDate(start.getUTCDate() + countingDay - 1)
  return start.toISOString().slice(0, 10)
}

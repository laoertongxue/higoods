/** RETURN-004—010: business wall-clock dates; only the start week's Sunday is excluded. */
export const SEWING_RETURN_RULE_VERSION = 'PPIC-20260907-START-WEEK-SUNDAY'
export const SEWING_RETURN_COUNTING_DAYS = {
  INDEPENDENT_SEWING: [4, 8, 9],
  SEWING_TO_IRON_PACK: [5, 9, 10],
  CUTTING_TO_IRON_PACK: [6, 9, 12],
} as const

export function calculateSewingReturnDeadlineDate(startAt: string, countingDay: number): string {
  if (!Number.isInteger(countingDay) || countingDay < 1) throw new Error('回货节点计时日必须大于等于1')
  const dateText = startAt.slice(0, 10)
  const start = new Date(`${dateText}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText) || !Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== dateText) {
    throw new Error('接单时间不是有效日期')
  }
  const excludedSundayOffset = (7 - start.getUTCDay()) % 7
  const offset = countingDay - 1 + (countingDay - 1 >= excludedSundayOffset ? 1 : 0)
  start.setUTCDate(start.getUTCDate() + offset)
  return start.toISOString().slice(0, 10)
}

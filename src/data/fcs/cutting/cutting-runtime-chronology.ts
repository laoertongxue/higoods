export interface CuttingRuntimeChronologyItem {
  occurredAt: string
  ledgerSequence?: number
  createdAt?: string
  eventId?: string
  factId?: string
}

export function normalizeCuttingRuntimeLedgerSequence(value: unknown): number | undefined {
  const sequence = Number(value)
  return Number.isSafeInteger(sequence) && sequence > 0 ? sequence : undefined
}

function stableChronologyId(item: CuttingRuntimeChronologyItem): string {
  return item.eventId || item.factId || ''
}

function compareOperationTime(left:string,right:string):number {
  const leftTime=Date.parse(left.replace(' ','T')),rightTime=Date.parse(right.replace(' ','T'))
  // 旧本地时间和 ISO 时区时间按实际时刻比较；保留原文及同刻账本顺序。
  return Number.isFinite(leftTime) && Number.isFinite(rightTime)?leftTime-rightTime:left.localeCompare(right,'zh-CN')
}

export function compareCuttingRuntimeChronologyAscending(
  left: CuttingRuntimeChronologyItem,
  right: CuttingRuntimeChronologyItem,
): number {
  return compareOperationTime(left.occurredAt,right.occurredAt)
    || (normalizeCuttingRuntimeLedgerSequence(left.ledgerSequence) || 0)
      - (normalizeCuttingRuntimeLedgerSequence(right.ledgerSequence) || 0)
    || compareOperationTime(left.createdAt || left.occurredAt,
      right.createdAt || right.occurredAt,
    )
    || stableChronologyId(left).localeCompare(stableChronologyId(right), 'zh-CN')
}


/** 旧记录丢失秒时，只在同一分钟全部具备唯一账本顺序的集合内恢复动作先后。 */
export function createCuttingRuntimeChronologyComparator(
  items: readonly CuttingRuntimeChronologyItem[],
): typeof compareCuttingRuntimeChronologyAscending {
  // 一次比较器内按原文本复用解析结果；新文本仍重新解析，不跨动作保留。
  const parsedTimes = new Map<string, number>()
  const timeOf = (text: string) => {
    if (!parsedTimes.has(text)) parsedTimes.set(text, Date.parse(text.replace(' ', 'T')))
    return parsedTimes.get(text)!
  }
  const compareTime = (left: string, right: string) => {
    const a = timeOf(left), b = timeOf(right)
    return Number.isFinite(a) && Number.isFinite(b) ? a - b : left.localeCompare(right, 'zh-CN')
  }
  const compare = (left: CuttingRuntimeChronologyItem, right: CuttingRuntimeChronologyItem) =>
    compareTime(left.occurredAt, right.occurredAt)
    || (normalizeCuttingRuntimeLedgerSequence(left.ledgerSequence) || 0) - (normalizeCuttingRuntimeLedgerSequence(right.ledgerSequence) || 0)
    || compareTime(left.createdAt || left.occurredAt, right.createdAt || right.occurredAt)
    || stableChronologyId(left).localeCompare(stableChronologyId(right), 'zh-CN')
  const groups = new Map<number, CuttingRuntimeChronologyItem[]>()
  const minuteOf = (item: CuttingRuntimeChronologyItem) => Math.floor(timeOf(item.occurredAt) / 60_000)
  const minutePrecision = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})?$/
  for (const item of items) {
    const minute = minuteOf(item)
    if (!Number.isFinite(minute)) continue
    const group = groups.get(minute)
    if (group) group.push(item)
    else groups.set(minute, [item])
  }
  const sequencedMinutes = new Set<number>()
  for (const [minute, group] of groups) {
    const sequences = group.map(item => normalizeCuttingRuntimeLedgerSequence(item.ledgerSequence))
    if (group.some(item => minutePrecision.test(item.occurredAt))
      && sequences.every(sequence => sequence !== undefined)
      && new Set(sequences).size === group.length) sequencedMinutes.add(minute)
  }
  return (left, right) => {
    const minute = minuteOf(left)
    // 整组使用同一规则，避免成对切换“秒/序号”产生不传递的排序。
    if (minute === minuteOf(right) && sequencedMinutes.has(minute)) {
      return normalizeCuttingRuntimeLedgerSequence(left.ledgerSequence)!
        - normalizeCuttingRuntimeLedgerSequence(right.ledgerSequence)!
        || compare(left, right)
    }
    return compare(left, right)
  }
}

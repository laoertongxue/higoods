/** Read-only demand reference. This calculation creates no reservation or allocation. */
export interface PriorityDemand {
  id: string
  orderId: string
  sku: string
  warehouseId: string
  quantity: number
  deadline: string
  deadlineTimeZone: string
}

export interface PriorityReservation {
  id: string
  /** Omit only for an explicitly external purpose; an unknown or empty ID is invalid. */
  orderLineId?: string
  quantity: number
}

export interface PriorityStock {
  id: string
  sku: string
  warehouseId: string
  /** Qualified physical stock before subtracting reservations. */
  quantity: number
  reservations: PriorityReservation[]
}

export interface PriorityPostSupply {
  /** Stable physical-source identity, deduplicated across all pipeline positions. */
  id: string
  sku: string
  warehouseId: string
  quantity: number
}

export interface PriorityRules {
  todayStars: number
  tomorrowStars: number
  todayLabel: string
  tomorrowLabel: string
  overdueLabel: string
  version: number
}

export const DEFAULT_QC_SHIPPING_PRIORITY_RULES: PriorityRules = Object.freeze({
  todayStars: 2,
  tomorrowStars: 1,
  todayLabel: '今日需发',
  tomorrowLabel: '明日需发',
  overdueLabel: '已超期',
  version: 1,
})

export type PriorityDayBucket = 'overdue' | 'today' | 'tomorrow' | 'future'

export interface PriorityDemandAudit {
  id: string
  orderId: string
  deadlineMs: number
  bucket: PriorityDayBucket
  quantity: number
  reservedQuantity: number
  sharedSupplyQuantity: number
  remainingQuantity: number
}

export interface QcShippingPriorityRow {
  sku: string
  warehouseId: string
  overdue: number
  today: number
  tomorrow: number
  future: number
  /** An elapsed-deadline subset of today; never add it to today again. */
  todayOverdue: number
  stars: number
  label: string
  demandQuantity: number
  stockQuantity: number
  reservedStock: number
  reservedDemandCoverage: number
  freeStock: number
  postSupply: number
  sharedSupplyUsed: number
  unusedSupply: number
  demandRows: PriorityDemandAudit[]
}

export interface QcShippingPriorityInput {
  demands: PriorityDemand[]
  stocks: PriorityStock[]
  postSupplies: PriorityPostSupply[]
  rules?: PriorityRules
  nowMs?: number
  issues?: string[]
}

export interface QcShippingPriorityResult {
  /** False means the UI must show "需核对", rather than a normal/zero-shortage result. */
  ready: boolean
  issues: string[]
  rows: QcShippingPriorityRow[]
  asOf: string
  ruleVersion: number
}

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
const JAKARTA_OFFSET = 7 * 60 * MINUTE

function isIdentity(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim()
}

function isQuantity(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

/** Parse source-local times explicitly, rejecting Date's silent calendar rollover. */
export function parseQcShippingDeadlineMillis(deadline: string, sourceTimeZone: string): number | undefined {
  if (typeof deadline !== 'string') return undefined
  const parts = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$/.exec(deadline)
  if (!parts) return undefined
  const [, yearText, monthText, dateText, hourText, minuteText, secondText, milliText, zoneText] = parts
  const year = Number(yearText)
  const month = Number(monthText)
  const date = Number(dateText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText ?? 0)
  const millisecond = Number((milliText ?? '').padEnd(3, '0'))
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const monthDays = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (year < 1 || month < 1 || month > 12 || date < 1 || date > monthDays[month - 1]! || hour > 23 || minute > 59 || second > 59) return undefined
  let offsetMinutes: number
  if (zoneText === 'Z') {
    offsetMinutes = 0
  } else if (zoneText) {
    const hours = Number(zoneText.slice(1, 3))
    const minutes = Number(zoneText.slice(4, 6))
    if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) return undefined
    offsetMinutes = (hours * 60 + minutes) * (zoneText[0] === '-' ? -1 : 1)
  } else if (sourceTimeZone === 'Asia/Jakarta') {
    offsetMinutes = 7 * 60
  } else if (sourceTimeZone === 'Asia/Shanghai') {
    offsetMinutes = 8 * 60
  } else {
    return undefined
  }
  // setUTCFullYear avoids Date.UTC's special interpretation of years 00..99.
  const sourceDate = new Date(0)
  sourceDate.setUTCFullYear(year, month - 1, date)
  sourceDate.setUTCHours(hour, minute, second, millisecond)
  const instant = sourceDate.getTime() - offsetMinutes * MINUTE
  return Number.isFinite(instant) ? instant : undefined
}

function jakartaDateTime(nowMs: number): string {
  return `${new Date(nowMs + JAKARTA_OFFSET).toISOString().slice(0, -1).replace(/\.000$/, '')}+07:00`
}

function compareIdentity(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function rowKey(sku: string, warehouseId: string): string {
  return JSON.stringify([sku, warehouseId])
}

/**
 * Preserve each order line's existing stock guarantee, then consume only shared
 * free stock + qualified post-finishing supply, earliest deadline first. The
 * warehouse/SKU partition is strict and no new reservation is persisted.
 */
export function calculateQcShippingPriority(input: QcShippingPriorityInput): QcShippingPriorityResult {
  const issues = [...(input.issues ?? [])]
  const rules = input.rules ?? DEFAULT_QC_SHIPPING_PRIORITY_RULES
  const nowMs = input.nowMs ?? Date.now()
  const validTime = Number.isFinite(nowMs) && Number.isFinite(new Date(nowMs + JAKARTA_OFFSET).getTime())
  if (!validTime) issues.push('统计时间无效，需核对')
  const validRules = Number.isInteger(rules.todayStars) && Number.isInteger(rules.tomorrowStars)
    && rules.todayStars <= 5 && rules.todayStars > rules.tomorrowStars && rules.tomorrowStars >= 1
    && isIdentity(rules.todayLabel) && isIdentity(rules.tomorrowLabel) && isIdentity(rules.overdueLabel)
    && Number.isSafeInteger(rules.version) && rules.version > 0
  if (!validRules) issues.push('紧急规则无效：今日星级须高于明日，均为1至5星，且标签和版本有效')
  const effectiveRules = validRules ? rules : DEFAULT_QC_SHIPPING_PRIORITY_RULES
  const rows = new Map<string, QcShippingPriorityRow>()
  const demands = new Map<string, { source: PriorityDemand; deadlineMs: number; reserved: number }>()
  const supplyIds = new Set<string>()
  const reservationIds = new Set<string>()
  const safeAdd = (left: number, right: number, label: string): number => {
    const total = left + right
    if (!Number.isSafeInteger(total)) {
      issues.push(`${label}合计超出安全整数范围，需核对`)
      return Number.MAX_SAFE_INTEGER
    }
    return total
  }
  const ensureRow = (sku: string, warehouseId: string): QcShippingPriorityRow => {
    const key = rowKey(sku, warehouseId)
    const existing = rows.get(key)
    if (existing) return existing
    const created: QcShippingPriorityRow = {
      sku, warehouseId, overdue: 0, today: 0, tomorrow: 0, future: 0, todayOverdue: 0,
      stars: 0, label: '正常流转', demandQuantity: 0, stockQuantity: 0, reservedStock: 0,
      reservedDemandCoverage: 0, freeStock: 0, postSupply: 0, sharedSupplyUsed: 0, unusedSupply: 0, demandRows: [],
    }
    rows.set(key, created)
    return created
  }

  for (const demand of input.demands) {
    if (!isIdentity(demand.id) || !isIdentity(demand.orderId) || !isIdentity(demand.sku) || !isIdentity(demand.warehouseId) || !isQuantity(demand.quantity)) {
      issues.push(`出库需求 ${demand.id || '未命名'} 的身份或数量无效，需核对`)
      continue
    }
    if (demands.has(demand.id)) {
      issues.push(`出库需求编号 ${demand.id} 重复，未重复计量`)
      continue
    }
    const deadlineMs = parseQcShippingDeadlineMillis(demand.deadline, demand.deadlineTimeZone)
    if (deadlineMs === undefined) {
      issues.push(`出库需求 ${demand.id} 的揽收时效或来源时区无效，需核对`)
      continue
    }
    demands.set(demand.id, { source: demand, deadlineMs, reserved: 0 })
    const row = ensureRow(demand.sku, demand.warehouseId)
    row.demandQuantity = safeAdd(row.demandQuantity, demand.quantity, '出库需求')
  }

  for (const stock of input.stocks) {
    if (!isIdentity(stock.id) || !isIdentity(stock.sku) || !isIdentity(stock.warehouseId) || !isQuantity(stock.quantity) || !Array.isArray(stock.reservations)) {
      issues.push(`库存 ${stock.id || '未命名'} 的身份、数量或占用清单无效，需核对`)
      continue
    }
    if (supplyIds.has(stock.id)) {
      issues.push(`供给来源编号 ${stock.id} 重复，未重复计量`)
      continue
    }
    supplyIds.add(stock.id)
    const row = ensureRow(stock.sku, stock.warehouseId)
    row.stockQuantity = safeAdd(row.stockQuantity, stock.quantity, '合格现货')
    let reserved = 0
    for (const reservation of stock.reservations) {
      if (!isIdentity(reservation.id) || !isQuantity(reservation.quantity)) {
        issues.push(`库存 ${stock.id} 的占用身份或数量无效，需核对`)
        continue
      }
      if (reservationIds.has(reservation.id)) {
        issues.push(`库存占用编号 ${reservation.id} 重复，未重复计量`)
        continue
      }
      reservationIds.add(reservation.id)
      reserved = safeAdd(reserved, reservation.quantity, '库存占用')
      // All reservations remain locked, even if they exceed the linked line's
      // remaining quantity. Only explicitly external uses omit orderLineId.
      if (reservation.orderLineId === undefined) continue
      const linked = demands.get(reservation.orderLineId)
      if (!isIdentity(reservation.orderLineId) || !linked) {
        issues.push(`库存占用 ${reservation.id} 关联的出库需求不存在，需核对`)
        continue
      }
      if (linked.source.sku !== stock.sku || linked.source.warehouseId !== stock.warehouseId) {
        issues.push(`库存占用 ${reservation.id} 与出库需求的SKU或仓库不一致，需核对`)
        continue
      }
      linked.reserved = safeAdd(linked.reserved, reservation.quantity, '订单现货保障')
    }
    if (reserved > stock.quantity) issues.push(`库存 ${stock.id} 的占用数量超过合格现货，需核对`)
    row.reservedStock = safeAdd(row.reservedStock, reserved, '有效现货占用')
    row.freeStock = safeAdd(row.freeStock, Math.max(0, stock.quantity - reserved), '公共现货')
  }

  for (const post of input.postSupplies) {
    if (!isIdentity(post.id) || !isIdentity(post.sku) || !isIdentity(post.warehouseId) || !isQuantity(post.quantity)) {
      issues.push(`后道供给 ${post.id || '未命名'} 的身份、去向或数量无效，需核对`)
      continue
    }
    if (supplyIds.has(post.id)) {
      issues.push(`供给来源编号 ${post.id} 重复，未重复计量`)
      continue
    }
    supplyIds.add(post.id)
    const row = ensureRow(post.sku, post.warehouseId)
    row.postSupply = safeAdd(row.postSupply, post.quantity, '后道合格供给')
  }

  if (validTime) {
    const today = Math.floor((nowMs + JAKARTA_OFFSET) / DAY)
    const sorted = [...demands.values()].sort((left, right) => left.deadlineMs - right.deadlineMs || compareIdentity(left.source.id, right.source.id))
    const available = new Map<string, number>()
    for (const [key, row] of rows) available.set(key, safeAdd(row.freeStock, row.postSupply, '公共供给'))
    for (const demand of sorted) {
      const source = demand.source
      const key = rowKey(source.sku, source.warehouseId)
      const row = rows.get(key)!
      const deadlineDay = Math.floor((demand.deadlineMs + JAKARTA_OFFSET) / DAY)
      const bucket: PriorityDayBucket = deadlineDay < today ? 'overdue' : deadlineDay === today ? 'today' : deadlineDay === today + 1 ? 'tomorrow' : 'future'
      const reservedQuantity = Math.min(source.quantity, demand.reserved)
      const afterGuarantee = source.quantity - reservedQuantity
      const sharedSupplyQuantity = Math.min(afterGuarantee, available.get(key) ?? 0)
      available.set(key, (available.get(key) ?? 0) - sharedSupplyQuantity)
      const remainingQuantity = afterGuarantee - sharedSupplyQuantity
      row.reservedDemandCoverage = safeAdd(row.reservedDemandCoverage, reservedQuantity, '订单已有保障')
      row.sharedSupplyUsed = safeAdd(row.sharedSupplyUsed, sharedSupplyQuantity, '公共供给覆盖')
      row[bucket] = safeAdd(row[bucket], remainingQuantity, '剩余待发需求')
      if (bucket === 'today' && demand.deadlineMs < nowMs) row.todayOverdue = safeAdd(row.todayOverdue, remainingQuantity, '今日已超时需求')
      row.demandRows.push({ id: source.id, orderId: source.orderId, deadlineMs: demand.deadlineMs, bucket, quantity: source.quantity, reservedQuantity, sharedSupplyQuantity, remainingQuantity })
    }
    for (const [key, row] of rows) {
      row.unusedSupply = available.get(key) ?? 0
      if (row.overdue > 0) {
        row.stars = effectiveRules.todayStars
        row.label = effectiveRules.overdueLabel
      } else if (row.today > 0) {
        row.stars = effectiveRules.todayStars
        row.label = effectiveRules.todayLabel
      } else if (row.tomorrow > 0) {
        row.stars = effectiveRules.tomorrowStars
        row.label = effectiveRules.tomorrowLabel
      }
    }
  }
  return {
    ready: issues.length === 0,
    issues: [...new Set(issues)],
    rows: [...rows.values()].sort((left, right) => compareIdentity(left.sku, right.sku) || compareIdentity(left.warehouseId, right.warehouseId)),
    asOf: validTime ? jakartaDateTime(nowMs) : '',
    ruleVersion: effectiveRules.version,
  }
}

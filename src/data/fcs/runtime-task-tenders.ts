export interface RuntimeTaskTenderFactory {
  factoryId: string
  factoryName: string
  factoryCode?: string
  factoryAddress?: string
  factoryType?: string
  capabilitySummary?: string
  notifiedAt?: string
}

export type RuntimeTaskTenderPoolMode = 'ALL_ELIGIBLE' | 'MANUAL'
export type RuntimeTaskTenderStatus = 'BIDDING' | 'AWAIT_AWARD' | 'NO_QUOTE' | 'AWARDED' | 'CANCELLED'

export interface RuntimeTaskTenderSkuLine {
  skuCode: string
  color: string
  size: string
  qty: number
}

export interface RuntimeTaskTenderTaskSnapshot {
  taskNo: string
  productionOrderId: string
  productionOrderNo?: string
  processName: string
  taskTypeLabel: string
  qty: number
  qtyUnit: string
  skuLines: RuntimeTaskTenderSkuLine[]
}

export interface RuntimeTaskTenderQuote extends RuntimeTaskTenderFactory {
  quotePrice: number
  quoteTime: string
  deliveryDays?: number
  remark?: string
}

export interface RuntimeTaskTenderRecord {
  tenderId: string
  taskId: string
  businessAssignedAt: string
  assignmentOperatedAt: string
  biddingDeadline: string
  taskDeadline: string
  poolMode: RuntimeTaskTenderPoolMode
  taskSnapshot: RuntimeTaskTenderTaskSnapshot
  factoryPool: RuntimeTaskTenderFactory[]
  standardPrice: number
  minPrice: number
  currency: string
  unit: string
  remark: string
  quotes: RuntimeTaskTenderQuote[]
  createdBy: string
  cancelledAt?: string
  cancelledBy?: string
  cancelReason?: string
  awardedAt?: string
  awardedFactoryId?: string
  awardedFactoryName?: string
  awardedPrice?: number
  awardReason?: string
}

// 以招标单号保存历史记录。同一任务取消旧竞价后可以重新发起，但旧招标单必须继续留痕。
const runtimeTaskTenderRecords = new Map<string, RuntimeTaskTenderRecord>()

function getLatestTaskRecord(taskId: string): RuntimeTaskTenderRecord | undefined {
  return [...runtimeTaskTenderRecords.values()].reverse().find((record) => record.taskId === taskId)
}

function cloneRecord(record: RuntimeTaskTenderRecord): RuntimeTaskTenderRecord {
  return {
    ...record,
    taskSnapshot: {
      ...record.taskSnapshot,
      skuLines: record.taskSnapshot.skuLines.map((line) => ({ ...line })),
    },
    factoryPool: record.factoryPool.map((factory) => ({ ...factory })),
    quotes: record.quotes.map((quote) => ({ ...quote })),
  }
}

export function upsertRuntimeTaskTenderRecord(
  input: Omit<RuntimeTaskTenderRecord, 'quotes'> & { quotes?: RuntimeTaskTenderQuote[] },
): RuntimeTaskTenderRecord {
  const current = runtimeTaskTenderRecords.get(input.tenderId)
  if (current) throw new Error(`招标单 ${input.tenderId} 已创建，任务范围、工厂池和最低允许报价均已冻结`)
  const latestForTask = getLatestTaskRecord(input.taskId)
  if (
    latestForTask &&
    latestForTask.tenderId !== input.tenderId &&
    resolveRuntimeTaskTenderStatus(latestForTask, input.assignmentOperatedAt) !== 'CANCELLED'
  ) {
    throw new Error(`任务 ${input.taskId} 已关联招标单 ${latestForTask.tenderId}，不可重复创建`)
  }
  const factoryIds = new Set<string>()
  const factoryPool = input.factoryPool.filter((factory) => {
    if (!factory.factoryId || factoryIds.has(factory.factoryId)) return false
    factoryIds.add(factory.factoryId)
    return true
  })
  if (factoryPool.length === 0) throw new Error('招标单至少需要一个候选工厂')
  const snapshotQty = input.taskSnapshot.skuLines.reduce((sum, line) => sum + line.qty, 0)
  if (input.taskSnapshot.skuLines.length === 0 || snapshotQty !== input.taskSnapshot.qty) {
    throw new Error('竞价任务必须保存完整且数量守恒的 SKU 范围快照')
  }
  if (!input.biddingDeadline.trim()) throw new Error('竞价截止时间不能为空')
  if (toDateMs(input.biddingDeadline) <= toDateMs(input.assignmentOperatedAt)) {
    throw new Error('竞价截止时间必须晚于业务分配时间')
  }
  if (!Number.isFinite(input.standardPrice) || input.standardPrice <= 0) {
    throw new Error('发起竞价前必须存在有效的工序标准价')
  }
  if (!Number.isFinite(input.minPrice) || input.minPrice <= 0) {
    throw new Error('最低允许报价必须为正数')
  }
  if (input.minPrice > input.standardPrice) {
    throw new Error('最低允许报价不能高于工序标准价')
  }
  if (!input.currency.trim() || !input.unit.trim()) throw new Error('竞价价格必须明确币种和计价单位')

  const record: RuntimeTaskTenderRecord = {
    ...input,
    factoryPool,
    quotes: (input.quotes ?? [])
      .filter((quote) => factoryIds.has(quote.factoryId))
      .map((quote) => ({ ...quote })),
  }
  runtimeTaskTenderRecords.set(input.tenderId, cloneRecord(record))
  return cloneRecord(record)
}

export function recordRuntimeTaskTenderQuote(
  taskId: string,
  quote: RuntimeTaskTenderQuote,
): RuntimeTaskTenderRecord {
  const record = getLatestTaskRecord(taskId)
  if (!record) throw new Error(`任务 ${taskId} 尚未创建招标单`)
  const status = resolveRuntimeTaskTenderStatus(record, quote.quoteTime)
  if (status !== 'BIDDING') throw new Error(`招标单 ${record.tenderId} 当前已${runtimeTaskTenderStatusLabel[status]}，不能再报价`)
  if (!record.factoryPool.some((factory) => factory.factoryId === quote.factoryId)) {
    throw new Error(`工厂 ${quote.factoryName} 不在招标候选工厂池中`)
  }
  if (record.quotes.some((item) => item.factoryId === quote.factoryId)) {
    throw new Error(`工厂 ${quote.factoryName} 已提交报价，不允许修改`)
  }
  if (!Number.isFinite(quote.quotePrice) || quote.quotePrice <= 0) throw new Error('报价金额必须为正数')
  if (quote.quotePrice < record.minPrice) {
    throw new Error(`报价不能低于最低允许报价 ${record.minPrice.toLocaleString()} ${record.currency}/${record.unit}`)
  }
  const next = cloneRecord({ ...record, quotes: [...record.quotes, quote] })
  runtimeTaskTenderRecords.set(record.tenderId, next)
  return cloneRecord(next)
}

export const runtimeTaskTenderStatusLabel: Record<RuntimeTaskTenderStatus, string> = {
  BIDDING: '招标中',
  AWAIT_AWARD: '待定标',
  NO_QUOTE: '无人报价待处理',
  AWARDED: '已定标',
  CANCELLED: '已取消',
}

function toDateMs(value: string): number {
  return new Date(value.replace(' ', 'T')).getTime()
}

function formatLocalWallClock(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function resolveRuntimeTaskTenderStatus(
  record: RuntimeTaskTenderRecord,
  now = formatLocalWallClock(),
): RuntimeTaskTenderStatus {
  if (record.cancelledAt) return 'CANCELLED'
  if (record.awardedFactoryId) return 'AWARDED'
  const deadlineMs = toDateMs(record.biddingDeadline)
  const nowMs = toDateMs(now)
  if (Number.isFinite(deadlineMs) && Number.isFinite(nowMs) && nowMs >= deadlineMs) {
    return record.quotes.length > 0 ? 'AWAIT_AWARD' : 'NO_QUOTE'
  }
  return 'BIDDING'
}

export function markRuntimeTaskTenderAwarded(input: {
  taskId: string
  factoryId: string
  factoryName: string
  awardedPrice: number
  awardedAt: string
  awardReason?: string
}): RuntimeTaskTenderRecord {
  const record = getLatestTaskRecord(input.taskId)
  if (!record) throw new Error(`任务 ${input.taskId} 尚未创建招标单`)
  if (resolveRuntimeTaskTenderStatus(record, input.awardedAt) !== 'AWAIT_AWARD') {
    throw new Error('只有竞价已截止且存在有效报价时才能定标')
  }
  const quote = record.quotes.find((item) => item.factoryId === input.factoryId)
  if (!quote) throw new Error(`工厂 ${input.factoryName} 未提交报价，不能定标`)
  if (quote.quotePrice !== input.awardedPrice) throw new Error('中标价格必须与工厂原始报价完全一致')
  if (input.awardedPrice > record.standardPrice && !input.awardReason?.trim()) {
    throw new Error('中标价高于工序标准价时必须填写价格差异说明')
  }
  const next = cloneRecord({
    ...record,
    awardedAt: input.awardedAt,
    awardedFactoryId: input.factoryId,
    awardedFactoryName: input.factoryName,
    awardedPrice: input.awardedPrice,
    awardReason: input.awardReason?.trim() || undefined,
  })
  runtimeTaskTenderRecords.set(record.tenderId, next)
  return cloneRecord(next)
}

export function cancelRuntimeTaskTenderRecord(input: {
  taskId: string
  tenderId?: string
  cancelledAt: string
  cancelledBy: string
  reason: string
}): RuntimeTaskTenderRecord {
  const record = getLatestTaskRecord(input.taskId)
  if (!record) throw new Error(`任务 ${input.taskId} 尚未创建招标单`)
  if (input.tenderId && record.tenderId !== input.tenderId) {
    throw new Error(`任务 ${input.taskId} 当前竞价单不是 ${input.tenderId}`)
  }
  if (resolveRuntimeTaskTenderStatus(record, input.cancelledAt) === 'AWARDED') throw new Error('已定标招标单不能取消')
  if (!input.reason.trim()) throw new Error('取消竞价必须填写原因')
  const next = cloneRecord({
    ...record,
    cancelledAt: input.cancelledAt,
    cancelledBy: input.cancelledBy,
    cancelReason: input.reason.trim(),
  })
  runtimeTaskTenderRecords.set(record.tenderId, next)
  return cloneRecord(next)
}

export function getRuntimeTaskTenderRecord(taskId: string): RuntimeTaskTenderRecord | undefined {
  const record = getLatestTaskRecord(taskId)
  return record ? cloneRecord(record) : undefined
}

export function getRuntimeTaskTenderRecordByTenderId(tenderId: string): RuntimeTaskTenderRecord | undefined {
  const record = runtimeTaskTenderRecords.get(tenderId)
  return record ? cloneRecord(record) : undefined
}

export function listRuntimeTaskTenderRecords(): RuntimeTaskTenderRecord[] {
  return [...runtimeTaskTenderRecords.values()].map(cloneRecord)
}

export function captureRuntimeTaskTenderRecordStore(): RuntimeTaskTenderRecord[] {
  return listRuntimeTaskTenderRecords()
}

export function restoreRuntimeTaskTenderRecordStore(records: RuntimeTaskTenderRecord[]): void {
  runtimeTaskTenderRecords.clear()
  records.forEach((record) => runtimeTaskTenderRecords.set(record.tenderId, cloneRecord(record)))
}

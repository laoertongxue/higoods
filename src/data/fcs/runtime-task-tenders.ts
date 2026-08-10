export interface RuntimeTaskTenderFactory {
  factoryId: string
  factoryName: string
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
  distributionMode: 'BAG_AWARE' | 'FREE'
  factoryPool: RuntimeTaskTenderFactory[]
  standardPrice: number
  minPrice: number
  maxPrice: number
  currency: string
  unit: string
  remark: string
  quotes: RuntimeTaskTenderQuote[]
  createdBy: string
}

const runtimeTaskTenderRecords = new Map<string, RuntimeTaskTenderRecord>()

function cloneRecord(record: RuntimeTaskTenderRecord): RuntimeTaskTenderRecord {
  return {
    ...record,
    factoryPool: record.factoryPool.map((factory) => ({ ...factory })),
    quotes: record.quotes.map((quote) => ({ ...quote })),
  }
}

export function upsertRuntimeTaskTenderRecord(
  input: Omit<RuntimeTaskTenderRecord, 'quotes'> & { quotes?: RuntimeTaskTenderQuote[] },
): RuntimeTaskTenderRecord {
  const current = runtimeTaskTenderRecords.get(input.taskId)
  if (current && current.tenderId !== input.tenderId) {
    throw new Error(`任务 ${input.taskId} 已关联招标单 ${current.tenderId}，不可重复创建`)
  }
  const factoryIds = new Set<string>()
  const factoryPool = input.factoryPool.filter((factory) => {
    if (!factory.factoryId || factoryIds.has(factory.factoryId)) return false
    factoryIds.add(factory.factoryId)
    return true
  })
  if (factoryPool.length === 0) throw new Error('招标单至少需要一个候选工厂')

  const record: RuntimeTaskTenderRecord = {
    ...input,
    factoryPool,
    quotes: (input.quotes ?? current?.quotes ?? [])
      .filter((quote) => factoryIds.has(quote.factoryId))
      .map((quote) => ({ ...quote })),
  }
  runtimeTaskTenderRecords.set(input.taskId, cloneRecord(record))
  return cloneRecord(record)
}

export function recordRuntimeTaskTenderQuote(
  taskId: string,
  quote: RuntimeTaskTenderQuote,
): RuntimeTaskTenderRecord {
  const record = runtimeTaskTenderRecords.get(taskId)
  if (!record) throw new Error(`任务 ${taskId} 尚未创建招标单`)
  if (!record.factoryPool.some((factory) => factory.factoryId === quote.factoryId)) {
    throw new Error(`工厂 ${quote.factoryName} 不在招标候选工厂池中`)
  }
  if (record.quotes.some((item) => item.factoryId === quote.factoryId)) {
    throw new Error(`工厂 ${quote.factoryName} 已提交报价，不允许修改`)
  }
  const next = cloneRecord({ ...record, quotes: [...record.quotes, quote] })
  runtimeTaskTenderRecords.set(taskId, next)
  return cloneRecord(next)
}

export function getRuntimeTaskTenderRecord(taskId: string): RuntimeTaskTenderRecord | undefined {
  const record = runtimeTaskTenderRecords.get(taskId)
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
  records.forEach((record) => runtimeTaskTenderRecords.set(record.taskId, cloneRecord(record)))
}

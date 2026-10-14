export type PmsActorRole = '采购员' | '采购主管' | '财务' | '系统'

export interface PmsOperationLog {
  id: string
  objectType: string
  objectId: string
  action: string
  beforeValue: string
  afterValue: string
  reason: string
  actorId: string
  actorName: string
  actorRole: PmsActorRole
  occurredAt: string
  timeZone: 'Asia/Jakarta'
  source: 'PMS'
  relatedPurchaseOrderNo?: string
  secondConfirmation?: boolean
}

export class PmsDomainError extends Error {
  readonly code: string
  /** § P2-1 错误码字典:从 code 前缀自动推导 namespace,方便日志聚合 + 用户提示映射 */
  readonly namespace: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.namespace = inferPmsNamespace(code)
    this.name = 'PmsDomainError'
  }
}

/**
 * § P2-1 错误码字典:code 前缀 → namespace 映射。
 *
 * 新增错误码只需在此 dict 添加一行,无需改 type 定义。
 * 调用 PmsDomainError 时自动从 code 推导 namespace。
 */
export const PMS_ERROR_NAMESPACE = {
  IDB: 'PMS_IDB',
  BOM: 'BOM',
  MPO: 'MPO',
  MREQ: 'MREQ',
  KOL: 'KOL',
  PAYMENT: 'PAYMENT',
  RECON: 'RECON',
  CONF: 'CONF',
  TMF: 'TMF',
  BATCH: 'BATCH',
  CARRIER: 'CARRIER',
  CHANNEL: 'CHANNEL',
  FIRST_LEG: 'FL',
  INVENTORY: 'INVENTORY',
  MATERIAL: 'MATERIAL',
  PRODUCTION: 'PRODUCTION',
  PRODUCT: 'PRODUCT',
  PROTOTYPE: 'PROTOTYPE',
  PURCHASE: 'PURCHASE',
  REQUIRE: 'REQUIRE',
  ROLE: 'ROLE',
  SUPPLY: 'SUPPLY',
  TRANSIT: 'TRANSIT',
  UNIT: 'UNIT',
  USER: 'USER',
  WAREHOUSE: 'WAREHOUSE',
  SUGGEST: 'SUGGEST',
  RECONCILIATION: 'RECONCILIATION',
  BATCH_ALLOCATION: 'BATCH_ALLOCATION',
  SUPPLIER: 'SUPPLIER',
  DICTIONARY: 'DICTIONARY',
  SOURCE: 'SOURCE',
  HEADER: 'HEADER',
  LOGISTICS: 'LOGISTICS',
  INBOUND: 'INBOUND',
  MIGRATION: 'MIGRATION',
  ROLL: 'ROLL',
  FEE: 'FEE',
  WAYBILL: 'WAYBILL',
  VERSION: 'VERSION',
  DEMAND: 'DEMAND',
  ORDER: 'ORDER',
  STORAGE: 'STORAGE',
  MISC: 'MISC',
} as const

/**
 * 从 PmsDomainError.code 前缀推导 namespace。
 * 未匹配的 code 归到 'MISC'(杂项)避免 undefined。
 */
export function inferPmsNamespace(code: string): string {
  for (const [ns, prefix] of Object.entries(PMS_ERROR_NAMESPACE)) {
    if (code.startsWith(`${prefix}_`) || code === prefix) return ns.toLowerCase()
  }
  return 'misc'
}

export const PMS_SYSTEM_ACTOR = { id: 'USR-PMS-SYSTEM', name: '系统计算', role: '系统' as PmsActorRole }
export const PMS_BUYER_ACTOR = { id: 'USR-PMS-WANG', name: '王采购', role: '采购员' as PmsActorRole }
export const PMS_MANAGER_ACTOR = { id: 'USR-PMS-CHEN', name: '陈主管', role: '采购主管' as PmsActorRole }
export const PMS_FINANCE_ACTOR = { id: 'USR-PMS-LIU', name: '刘财务', role: '财务' as PmsActorRole }

import { PMS_STORES, pmsAll, pmsPut } from './idb-storage.ts'

let actionSequence = 0
const prefixSequences = new Map<string, number>()
const logs: PmsOperationLog[] = []

let logsHydrationStarted = false
let logsHydrationPromise: Promise<void> | null = null
let logsHydrationReady = false

/** Ordinary hydration reads saved log records without flushing pending writes or copying seeds. */
export function hydratePmsLogsFromIdb(): Promise<void> {
  if (logsHydrationStarted) return logsHydrationPromise ?? Promise.resolve()
  logsHydrationStarted = true
  logsHydrationPromise = (async () => {
    try {
      const stored = await pmsAll<PmsOperationLog>(PMS_STORES.pmsOperationLogs)
      for (const log of stored) publishPmsOperationLog(log)
      logsHydrationReady = true
    } catch (error) {
      logsHydrationStarted = false
      logsHydrationPromise = null
      throw error
    }
  })()
  return logsHydrationPromise
}

export function nextPmsSequence(prefix: string, width = 4): string {
  const next = (prefixSequences.get(prefix) ?? 0) + 1
  prefixSequences.set(prefix, next)
  return `${prefix}-${String(next).padStart(width, '0')}`
}

export function nextPmsActionId(prefix: string): string {
  actionSequence += 1
  return `${prefix}-${Date.now()}-${actionSequence}`
}

export function roundPmsQty(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function roundPmsInteger(value: number): number {
  return Math.max(0, Math.round(value))
}

/** Standalone log actions must also wait for durable commit. Related business logs use pmsCommitRecords. */
export async function appendPmsLog(entry: Omit<PmsOperationLog, 'id' | 'occurredAt' | 'timeZone' | 'source'>): Promise<PmsOperationLog> {
  const log = createPmsOperationLog(entry)
  await pmsPut(PMS_STORES.pmsOperationLogs, log)
  publishPmsOperationLog(log)
  return log
}

/** Legacy callers obtain a candidate only; publishing belongs after their transaction completes. */
export const appendPmsLogInMemory = createPmsOperationLog

export function createPmsOperationLog(entry: Omit<PmsOperationLog, 'id' | 'occurredAt' | 'timeZone' | 'source'>): PmsOperationLog {
  return {
    ...entry,
    id: `PMSLOG-${crypto.randomUUID()}`,
    occurredAt: new Date().toISOString(),
    timeZone: 'Asia/Jakarta',
    source: 'PMS',
  }
}

/** Publish only after the transaction containing this log has completed. */
export function publishPmsOperationLog(log: PmsOperationLog): void {
  if (logs.some((item) => item.id === log.id)) return
  logs.unshift(log)
  indexLog(log)
}

export function listPmsLogs(objectType: string, objectId?: string): PmsOperationLog[] {
  // § 性能优化:按 objectType 索引 + 仅在指定 objectId 时二次过滤
  // - logsByObjectType: Map< objectType, PmsOperationLog[] > O(1) 查表
  // - 单 objectType 命中后再 filter objectId
  const indexed = logsByObjectType.get(objectType)
  if (!indexed) return []
  return objectId ? indexed.filter((log) => log.objectId === objectId) : indexed
}

// § 性能优化:按 objectType 索引 O(1) 替代全表 filter(2000 logs × 60 业务类型)
const logsByObjectType = new Map<string, PmsOperationLog[]>()

function indexLog(log: PmsOperationLog): void {
  let bucket = logsByObjectType.get(log.objectType)
  if (!bucket) {
    bucket = []
    logsByObjectType.set(log.objectType, bucket)
  }
  bucket.push(log)
}

export function resetPmsRuntimeForTest(): void {
  actionSequence = 0
  prefixSequences.clear()
  logs.splice(0, logs.length)
  logsByObjectType.clear()
  logsHydrationStarted = false
  logsHydrationPromise = null
  logsHydrationReady = false
}

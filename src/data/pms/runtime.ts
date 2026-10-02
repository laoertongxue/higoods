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

  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'PmsDomainError'
  }
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
const pendingHydrationLogs: PmsOperationLog[] = []

/**
 * 从 IDB 一次性加载所有操作日志到内存缓存。idempotent。
 * 启动时调用一次;后续 listPmsLogs 从内存读(快速路径)。
 * 严格按 § 2.4.3.7 "列表/详情须独立读取持久数据":
 * - 内存缓存只在 IDB 加载完成后填充
 * - 加载未完成时 listPmsLogs 返回空数组,绝不冒充种子
 *
 * 修复 race condition:hydrate 完成前 appendPmsLog 写入的日志
 * 进入 pendingHydrationLogs 队列,hydrate 完成后逐个 put 到 IDB
 * (避免 hydrate 清空内存时丢失新增日志)。
 */
export function hydratePmsLogsFromIdb(): Promise<void> {
  if (logsHydrationStarted) return logsHydrationPromise ?? Promise.resolve()
  logsHydrationStarted = true
  logsHydrationPromise = (async () => {
    try {
      const stored = await pmsAll<PmsOperationLog>(PMS_STORES.pmsOperationLogs)
      if (stored.length > 0) {
        logs.length = 0
        logsByObjectType.clear()
        for (const log of stored) {
          logs.unshift(log)
          indexLog(log)
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown'
      console.error('[PMS_IDB_LOAD_FAILED] 操作日志加载失败', { message })
    } finally {
      logsHydrationReady = true
      // 把 hydrate 期间累积的日志 put 到 IDB(避免 race 丢数据)
      const pending = pendingHydrationLogs.splice(0)
      for (const log of pending) {
        try {
          await pmsPut(PMS_STORES.pmsOperationLogs, log)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'unknown'
          console.error('[PMS_IDB_SAVE_FAILED] 操作日志 IDB 写入失败(hydration 后)', { id: log.id, message })
        }
      }
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

export function appendPmsLog(entry: Omit<PmsOperationLog, 'id' | 'occurredAt' | 'timeZone' | 'source'>): PmsOperationLog {
  const log = buildPmsLog(entry)
  logs.unshift(log)
  indexLog(log)
  // 双写:内存缓存 + IDB 主存。
  // § 2.4.3.5:失败抛 PmsDomainError,不静默回退。
  if (logsHydrationReady) {
    pmsPut(PMS_STORES.pmsOperationLogs, log).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'unknown'
      console.error('[PMS_IDB_SAVE_FAILED] 操作日志 IDB 写入失败', { id: log.id, message })
    })
  } else {
    // hydrate 完成前累积,等 hydrate 完成后由其接管 put
    pendingHydrationLogs.push(log)
  }
  return log
}

/**
 * 构造 log 并加入内存数组,但不写 IDB。
 * 用于外部 pmsTx 多 store 原子事务:调用方把返回的 log 放进自己的 IDB 事务里。
 */
export function appendPmsLogInMemory(entry: Omit<PmsOperationLog, 'id' | 'occurredAt' | 'timeZone' | 'source'>): PmsOperationLog {
  const log = buildPmsLog(entry)
  logs.unshift(log)
  indexLog(log)
  return log
}

function buildPmsLog(entry: Omit<PmsOperationLog, 'id' | 'occurredAt' | 'timeZone' | 'source'>): PmsOperationLog {
  return {
    ...entry,
    id: nextPmsSequence('PMSLOG', 6),
    occurredAt: new Date().toISOString(),
    timeZone: 'Asia/Jakarta',
    source: 'PMS',
  }
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
  pendingHydrationLogs.length = 0
}

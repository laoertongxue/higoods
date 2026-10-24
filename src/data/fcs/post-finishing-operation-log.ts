import { assertPostFinishingWrite, registerPostFinishingRepository } from './post-finishing-records.ts'
export type PostFinishingFullFlowStage =
  | '送货登记'
  | '回货确认'
  | '送检'
  | '质检'
  | '后道'
  | '复检'
  | '出货'
  | '仓库收货'
  | '辅料调拨'
  | '授权'
  | '质检参考资料'

export type PostFinishingLogResult = '成功' | '失败' | '阻断'

export interface PostFinishingOperationLogEntry {
  logId: string
  stage: PostFinishingFullFlowStage
  objectType: string
  objectId: string
  objectNo: string
  productionOrderNo: string
  deliveryOrderNo?: string
  qcTaskNo?: string
  postTaskNo?: string
  recheckOrderNo?: string
  outboundOrderNo?: string
  action: string
  operatorId: string
  operatorName: string
  operatedAt: string
  beforeStatus?: string
  afterStatus?: string
  beforeQuantity?: number
  afterQuantity?: number
  differenceQuantity?: number
  differenceDirection?: '多' | '少' | '一致'
  differenceReason?: string
  authorizerId?: string
  authorizerName?: string
  result: PostFinishingLogResult
  remark?: string
}

export interface PostFinishingOperationLogFilter {
  keyword?: string
  stage?: PostFinishingFullFlowStage
  operatorName?: string
  authorizerName?: string
  result?: PostFinishingLogResult
  differenceDirection?: '多' | '少' | '一致'
  startedAt?: string
  endedAt?: string
}


function readPersistedLogs(): PostFinishingOperationLogEntry[] { return [] }

let logs = readPersistedLogs()

// 仅固定演示数据的同步初始化暂缓保存；普通业务操作仍即时保存。
let demoPersistence: 'idle' | 'save' | 'remove' | undefined

export function beginPostFinishingOperationLogDemoBatch() {
  const before = structuredClone(logs)
  demoPersistence = 'idle'
  return {
    commit(): void {
    },
    rollback(): void { logs = before },
    finish(): void { demoPersistence = undefined },
  }
}

function persist(): void { assertPostFinishingWrite() }

function cloneLog(entry: PostFinishingOperationLogEntry): PostFinishingOperationLogEntry {
  return { ...entry }
}

export function appendPostFinishingOperationLog(
  input: Omit<PostFinishingOperationLogEntry, 'logId'> & { logId?: string },
): PostFinishingOperationLogEntry {
  assertPostFinishingWrite()
  const entry: PostFinishingOperationLogEntry = {
    ...input,
    logId: input.logId || `PF-LOG-${String(logs.length + 1).padStart(6, '0')}`,
  }
  logs.push(entry)
  persist()
  return cloneLog(entry)
}

export function listPostFinishingOperationLogs(
  filter: PostFinishingOperationLogFilter = {},
): PostFinishingOperationLogEntry[] {
  const keyword = filter.keyword?.trim().toLowerCase() || ''
  return logs
    .filter((entry) => {
      if (filter.stage && entry.stage !== filter.stage) return false
      if (filter.operatorName && entry.operatorName !== filter.operatorName) return false
      if (filter.authorizerName && entry.authorizerName !== filter.authorizerName) return false
      if (filter.result && entry.result !== filter.result) return false
      if (filter.differenceDirection && entry.differenceDirection !== filter.differenceDirection) return false
      if (filter.startedAt && entry.operatedAt < filter.startedAt) return false
      if (filter.endedAt && entry.operatedAt > filter.endedAt) return false
      if (!keyword) return true
      return [
        entry.objectId,
        entry.objectNo,
        entry.productionOrderNo,
        entry.deliveryOrderNo,
        entry.qcTaskNo,
        entry.postTaskNo,
        entry.recheckOrderNo,
        entry.outboundOrderNo,
        entry.operatorName,
        entry.authorizerName,
        entry.action,
        entry.differenceReason,
      ].some((value) => String(value || '').toLowerCase().includes(keyword))
    })
    .sort((a, b) => b.operatedAt.localeCompare(a.operatedAt))
    .map(cloneLog)
}

export function resetPostFinishingOperationLogs(): void {
  assertPostFinishingWrite()
  logs = []
  if (demoPersistence !== undefined) { demoPersistence = 'remove'; return }
  assertPostFinishingWrite()
}

registerPostFinishingRepository('logs', () => logs, value => { logs = value })

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

let actionSequence = 0
const prefixSequences = new Map<string, number>()
const logs: PmsOperationLog[] = []

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
  const log: PmsOperationLog = {
    ...entry,
    id: nextPmsSequence('PMSLOG', 6),
    occurredAt: new Date().toISOString(),
    timeZone: 'Asia/Jakarta',
    source: 'PMS',
  }
  logs.unshift(log)
  return log
}

export function listPmsLogs(objectType: string, objectId?: string): PmsOperationLog[] {
  return logs.filter((log) => log.objectType === objectType && (!objectId || log.objectId === objectId))
}

export function resetPmsRuntimeForTest(): void {
  actionSequence = 0
  prefixSequences.clear()
  logs.splice(0, logs.length)
}

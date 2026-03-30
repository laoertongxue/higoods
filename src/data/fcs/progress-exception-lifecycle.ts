import type { CaseStatus, ExceptionCase, ExceptionAction, ExceptionAuditLog } from './store-domain-progress.ts'
import { getDefaultSubCategoryKeyFromReason, type SubCategoryKey } from './progress-exception-taxonomy.ts'

export type CloseReasonCode =
  | 'RESOLVED_DONE'
  | 'DUPLICATE'
  | 'FALSE_ALARM'
  | 'OBJECT_INVALID'
  | 'MERGED'

export type ResolveSource = 'SYSTEM' | 'USER'

export type ResolveRuleCode =
  | 'ASSIGNMENT_TARGET_SECURED'
  | 'EXEC_START_CONFIRMED'
  | 'EXEC_MILESTONE_REPORTED'
  | 'EXEC_RESUMED'
  | 'EXEC_ALLOW_CONTINUE'
  | 'TECH_PACK_RELEASED'
  | 'MATERIAL_SATISFIED'
  | 'HANDOUT_ISSUE_CLOSED'

export const CLOSE_REASON_LABEL: Record<CloseReasonCode, string> = {
  RESOLVED_DONE: '已解决后关闭',
  DUPLICATE: '重复异常',
  FALSE_ALARM: '误报',
  OBJECT_INVALID: '业务对象失效',
  MERGED: '并入其他异常',
}

export const RESOLVE_RULE_LABEL: Record<ResolveRuleCode, string> = {
  ASSIGNMENT_TARGET_SECURED: '任务已落实承接方',
  EXEC_START_CONFIRMED: '工厂已确认开工',
  EXEC_MILESTONE_REPORTED: '关键节点已上报',
  EXEC_RESUMED: '生产暂停已恢复执行',
  EXEC_ALLOW_CONTINUE: '平台允许继续',
  TECH_PACK_RELEASED: '技术包已可用',
  MATERIAL_SATISFIED: '领料需求已满足',
  HANDOUT_ISSUE_CLOSED: '交出差异/异议已闭环',
}

export const RESOLVE_SOURCE_LABEL: Record<ResolveSource, string> = {
  SYSTEM: '系统',
  USER: '人工',
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function buildSequentialEventId(prefix: 'EA' | 'EAL', caseId: string, nextIndex: number): string {
  return `${prefix}-${caseId}-${String(nextIndex).padStart(3, '0')}`
}

function deriveSubCategoryKey(exceptionCase: ExceptionCase): SubCategoryKey {
  return exceptionCase.subCategoryKey || getDefaultSubCategoryKeyFromReason(exceptionCase.reasonCode) || 'EXEC_BLOCK_OTHER'
}

const AUTO_CLOSE_SUB_CATEGORY_SET = new Set<SubCategoryKey>([
  'EXEC_START_OVERDUE',
  'EXEC_MILESTONE_NOT_REPORTED',
  'TECH_PACK_NOT_RELEASED',
  'TECH_PACK_MISSING',
  'TECH_PACK_PENDING_CONFIRM',
  'MATERIAL_NOT_READY',
  'MATERIAL_PREP_PENDING',
  'MATERIAL_QTY_SHORT',
  'MATERIAL_MULTI_OPEN',
  'HANDOUT_DIFF',
  'HANDOUT_OBJECTION',
  'HANDOUT_MIXED',
  'HANDOUT_DAMAGE',
  'HANDOUT_PENDING_CHECK',
])

export function appendCaseAction(
  exceptionCase: ExceptionCase,
  payload: {
    actionType: string
    actionDetail: string
    at?: string
    by: string
    id?: string
  },
): ExceptionCase {
  const at = payload.at || nowTimestamp()
  const action: ExceptionAction = {
    id: payload.id || buildSequentialEventId('EA', exceptionCase.caseId, exceptionCase.actions.length + 1),
    actionType: payload.actionType,
    actionDetail: payload.actionDetail,
    at,
    by: payload.by,
  }
  return {
    ...exceptionCase,
    actions: [...exceptionCase.actions, action],
  }
}

export function appendCaseAuditLog(
  exceptionCase: ExceptionCase,
  payload: {
    action: string
    detail: string
    at?: string
    by: string
    id?: string
  },
): ExceptionCase {
  const at = payload.at || nowTimestamp()
  const audit: ExceptionAuditLog = {
    id: payload.id || buildSequentialEventId('EAL', exceptionCase.caseId, exceptionCase.auditLogs.length + 1),
    action: payload.action,
    detail: payload.detail,
    at,
    by: payload.by,
  }
  return {
    ...exceptionCase,
    auditLogs: [...exceptionCase.auditLogs, audit],
  }
}

export function appendCaseStatusChangeAudit(
  exceptionCase: ExceptionCase,
  fromStatus: CaseStatus,
  toStatus: CaseStatus,
  at: string,
  by: string,
): ExceptionCase {
  if (fromStatus === toStatus) return exceptionCase
  return appendCaseAuditLog(exceptionCase, {
    action: 'STATUS_CHANGE',
    detail: `${fromStatus} -> ${toStatus}`,
    at,
    by,
  })
}

export function markCaseResolved(
  exceptionCase: ExceptionCase,
  payload: {
    by: string
    source: ResolveSource
    ruleCode: ResolveRuleCode
    detail: string
    at?: string
    actionType?: string
    auditAction?: string
  },
): ExceptionCase {
  if (exceptionCase.caseStatus === 'CLOSED') return exceptionCase

  const at = payload.at || nowTimestamp()
  const nextStatus: CaseStatus = 'RESOLVED'
  const actionType = payload.actionType || (payload.source === 'SYSTEM' ? 'AUTO_RESOLVE' : 'RESOLVE')
  const auditAction = payload.auditAction || (payload.source === 'SYSTEM' ? 'AUTO_RESOLVE' : 'RESOLVE')

  let updated: ExceptionCase = {
    ...exceptionCase,
    caseStatus: nextStatus,
    updatedAt: at,
    resolvedAt: at,
    resolvedBy: payload.by,
    resolvedRuleCode: payload.ruleCode,
    resolvedSource: payload.source,
    resolvedDetail: payload.detail,
  }

  updated = appendCaseAction(updated, {
    actionType,
    actionDetail: payload.detail,
    at,
    by: payload.by,
  })

  updated = appendCaseAuditLog(updated, {
    action: auditAction,
    detail: payload.detail,
    at,
    by: payload.by,
  })

  updated = appendCaseStatusChangeAudit(updated, exceptionCase.caseStatus, nextStatus, at, payload.by)

  return updated
}

export function markCaseClosed(
  exceptionCase: ExceptionCase,
  payload: {
    by: string
    reasonCode: CloseReasonCode
    detail: string
    mergedCaseId?: string
    at?: string
    actionType?: string
    auditAction?: string
  },
): ExceptionCase {
  const at = payload.at || nowTimestamp()
  const nextStatus: CaseStatus = 'CLOSED'
  const actionType = payload.actionType || 'CLOSE_EXCEPTION'
  const auditAction = payload.auditAction || 'CLOSE_EXCEPTION'

  let updated: ExceptionCase = {
    ...exceptionCase,
    caseStatus: nextStatus,
    updatedAt: at,
    closedAt: at,
    closedBy: payload.by,
    closeReasonCode: payload.reasonCode,
    mergedCaseId: payload.mergedCaseId || undefined,
    closeDetail: payload.detail,
    closeRemark: payload.detail,
  }

  updated = appendCaseAction(updated, {
    actionType,
    actionDetail: payload.detail,
    at,
    by: payload.by,
  })

  updated = appendCaseAuditLog(updated, {
    action: auditAction,
    detail: payload.detail,
    at,
    by: payload.by,
  })

  updated = appendCaseStatusChangeAudit(updated, exceptionCase.caseStatus, nextStatus, at, payload.by)

  return updated
}

export function getAutoCloseDecision(
  exceptionCase: ExceptionCase,
): { shouldClose: boolean; reasonCode?: CloseReasonCode; detail?: string } {
  if (exceptionCase.caseStatus !== 'RESOLVED') {
    return { shouldClose: false }
  }

  const subCategoryKey = deriveSubCategoryKey(exceptionCase)
  if (!AUTO_CLOSE_SUB_CATEGORY_SET.has(subCategoryKey)) {
    return { shouldClose: false }
  }

  const detail = `系统自动关闭：${exceptionCase.resolvedDetail || '满足自动关闭条件，已完成处理'}`
  return {
    shouldClose: true,
    reasonCode: 'RESOLVED_DONE',
    detail,
  }
}

export function maybeAutoCloseResolvedCase(
  exceptionCase: ExceptionCase,
  by: string = '系统',
): ExceptionCase {
  const decision = getAutoCloseDecision(exceptionCase)
  if (!decision.shouldClose || !decision.reasonCode || !decision.detail) {
    return exceptionCase
  }
  return markCaseClosed(exceptionCase, {
    by,
    reasonCode: decision.reasonCode,
    detail: decision.detail,
    actionType: 'AUTO_CLOSE',
    auditAction: 'AUTO_CLOSE',
  })
}

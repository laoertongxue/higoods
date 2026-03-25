import { getCanonicalCuttingPath } from './meta'
import type { MergeBatchRecord } from './merge-batches-model'
import type { OriginalCutOrderRow } from './original-orders-model'
import type {
  BindingStripProcessPayload,
  SpecialProcessExecutionLog,
  SpecialProcessExecutionLogActionType,
  SpecialProcessFollowupAction,
  SpecialProcessFollowupActionStatus,
  SpecialProcessFollowupActionType,
  SpecialProcessNavigationPayload,
  SpecialProcessOrder,
  SpecialProcessScopeLine,
  SpecialProcessStatusKey,
  SpecialProcessType,
  SpecialProcessTypeExecutionMeta,
} from './special-processes-model'

function nowText(date = new Date()): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

export interface SpecialProcessSourceOption {
  sourceType: 'ORIGINAL_CUT_ORDER' | 'MERGE_BATCH'
  sourceCutOrderId: string
  sourceCutOrderNo: string
  mergeBatchId: string
  mergeBatchNo: string
  sourceProductionOrderNo: string
  styleCode: string
  spuCode: string
  color: string
  materialSku: string
  plannedQty: number
}

export interface SpecialProcessExecutionSnapshot {
  plannedQtyTotal: number
  actualQtyTotal: number
  latestActualLength: number
  latestActualWidth: number
  latestExecutionAt: string
  latestOperatorName: string
  logCount: number
  completedActionCount: number
  pendingActionCount: number
  followupDoneCount: number
  followupPendingCount: number
  executionProgressText: string
  followupProgressText: string
  downstreamBlocked: boolean
  downstreamBlockReason: string
}

export interface SpecialProcessStatusValidationResult {
  ok: boolean
  message: string
}

const FOLLOWUP_ACTION_LABELS: Record<SpecialProcessFollowupActionType, string> = {
  GO_TRANSFER_BAG: '去周转口袋车缝交接',
  GO_CUT_PIECE_WAREHOUSE: '去裁片仓',
  GO_ORIGINAL_CUT_ORDER: '去原始裁片单',
  GO_CUTTING_DASHBOARD: '去生产单进度',
  GO_CUTTING_TOTAL_TABLE: '去裁剪总表',
}

export function deriveSpecialProcessTypeExecutionMeta(processType: SpecialProcessType): SpecialProcessTypeExecutionMeta {
  if (processType === 'BINDING_STRIP') {
    return {
      enabledForExecution: true,
      readinessLevel: 'READY',
      integrationLevel: 'EXECUTION',
      readinessLabel: '已接入执行',
      integrationLabel: '执行链已接通',
      disabledReason: '',
    }
  }
  return {
    enabledForExecution: false,
    readinessLevel: 'RESERVED',
    integrationLevel: 'PLACEHOLDER',
    readinessLabel: '预留类型',
    integrationLabel: '暂未接入执行链',
    disabledReason: '洗水工艺当前仅保留结构占位，暂不进入裁片执行链。',
  }
}

export function buildSpecialProcessSourceOptions(options: {
  order: Pick<SpecialProcessOrder, 'sourceType' | 'originalCutOrderIds' | 'mergeBatchId' | 'mergeBatchNo'>
  originalRows: OriginalCutOrderRow[]
  mergeBatches: MergeBatchRecord[]
}): SpecialProcessSourceOption[] {
  const rowsById = new Map(options.originalRows.map((row) => [row.originalCutOrderId, row]))
  if (options.order.sourceType === 'merge-batch') {
    const batch = options.mergeBatches.find((item) => item.mergeBatchId === options.order.mergeBatchId || item.mergeBatchNo === options.order.mergeBatchNo)
    if (!batch) return []
    return batch.items
      .map((item) => {
        const row = rowsById.get(item.originalCutOrderId)
        return {
          sourceType: 'MERGE_BATCH' as const,
          sourceCutOrderId: item.originalCutOrderId,
          sourceCutOrderNo: item.originalCutOrderNo,
          mergeBatchId: batch.mergeBatchId,
          mergeBatchNo: batch.mergeBatchNo,
          sourceProductionOrderNo: item.productionOrderNo,
          styleCode: item.styleCode,
          spuCode: item.spuCode,
          color: row?.color || '',
          materialSku: row?.materialSku || item.materialSku,
          plannedQty: row?.plannedQty || row?.orderQty || 0,
        }
      })
      .filter((item) => item.sourceCutOrderId)
  }

  return options.order.originalCutOrderIds
    .map((originalCutOrderId) => rowsById.get(originalCutOrderId))
    .filter((row): row is OriginalCutOrderRow => Boolean(row))
    .map((row) => ({
      sourceType: 'ORIGINAL_CUT_ORDER' as const,
      sourceCutOrderId: row.originalCutOrderId,
      sourceCutOrderNo: row.originalCutOrderNo,
      mergeBatchId: row.activeBatchId || '',
      mergeBatchNo: row.activeBatchNo || row.latestMergeBatchNo || '',
      sourceProductionOrderNo: row.productionOrderNo,
      styleCode: row.styleCode,
      spuCode: row.spuCode,
      color: row.color,
      materialSku: row.materialSku,
      plannedQty: row.plannedQty || row.orderQty || 0,
    }))
}

export function buildDefaultSpecialProcessScopeLines(options: {
  order: SpecialProcessOrder
  originalRows: OriginalCutOrderRow[]
  mergeBatches: MergeBatchRecord[]
}): SpecialProcessScopeLine[] {
  return buildSpecialProcessSourceOptions(options).map((item, index) => ({
    scopeId: `scope-${options.order.processOrderId}-${index + 1}`,
    processOrderId: options.order.processOrderId,
    sourceType: item.sourceType,
    sourceCutOrderId: item.sourceCutOrderId,
    sourceCutOrderNo: item.sourceCutOrderNo,
    mergeBatchId: item.mergeBatchId,
    mergeBatchNo: item.mergeBatchNo,
    sourceProductionOrderNo: item.sourceProductionOrderNo,
    styleCode: item.styleCode,
    spuCode: item.spuCode,
    color: item.color,
    materialSku: item.materialSku,
    plannedQty: item.plannedQty,
    unitType: 'GARMENT',
    note: '',
  }))
}

export function hydrateScopeLineFromSource(
  scopeLine: SpecialProcessScopeLine,
  sourceOptions: SpecialProcessSourceOption[],
): SpecialProcessScopeLine {
  const matched =
    sourceOptions.find((item) => item.sourceCutOrderId === scopeLine.sourceCutOrderId) ||
    sourceOptions.find((item) => item.sourceCutOrderNo === scopeLine.sourceCutOrderNo)
  if (!matched) return scopeLine
  return {
    ...scopeLine,
    sourceType: matched.sourceType,
    sourceCutOrderId: matched.sourceCutOrderId,
    sourceCutOrderNo: matched.sourceCutOrderNo,
    mergeBatchId: matched.mergeBatchId,
    mergeBatchNo: matched.mergeBatchNo,
    sourceProductionOrderNo: matched.sourceProductionOrderNo,
    styleCode: matched.styleCode,
    spuCode: matched.spuCode,
    color: matched.color,
    materialSku: matched.materialSku,
    plannedQty: scopeLine.plannedQty > 0 ? scopeLine.plannedQty : matched.plannedQty,
  }
}

export function buildDefaultSpecialProcessFollowupActions(options: {
  order: SpecialProcessOrder
  navigationPayload: SpecialProcessNavigationPayload
  typeMeta: SpecialProcessTypeExecutionMeta
}): SpecialProcessFollowupAction[] {
  if (!options.typeMeta.enabledForExecution) return []

  const targetConfig: Array<{
    actionType: SpecialProcessFollowupActionType
    targetPageKey: SpecialProcessFollowupAction['targetPageKey']
    targetPath: string
    targetQuery: Record<string, string | undefined>
  }> = [
    {
      actionType: 'GO_TRANSFER_BAG',
      targetPageKey: 'transfer-bags',
      targetPath: getCanonicalCuttingPath('transfer-bags'),
      targetQuery: options.navigationPayload.transferBags,
    },
    {
      actionType: 'GO_CUT_PIECE_WAREHOUSE',
      targetPageKey: 'cut-piece-warehouse',
      targetPath: getCanonicalCuttingPath('cut-piece-warehouse'),
      targetQuery: options.navigationPayload.cutPieceWarehouse,
    },
    {
      actionType: 'GO_ORIGINAL_CUT_ORDER',
      targetPageKey: 'original-orders',
      targetPath: getCanonicalCuttingPath('original-orders'),
      targetQuery: options.navigationPayload.originalOrders,
    },
    {
      actionType: 'GO_CUTTING_DASHBOARD',
      targetPageKey: 'production-progress',
      targetPath: getCanonicalCuttingPath('production-progress'),
      targetQuery: options.navigationPayload.productionProgress,
    },
    {
      actionType: 'GO_CUTTING_TOTAL_TABLE',
      targetPageKey: 'summary',
      targetPath: getCanonicalCuttingPath('summary'),
      targetQuery: options.navigationPayload.summary,
    },
  ]

  return targetConfig.map((item, index) => ({
    actionId: `sp-action-${options.order.processOrderId}-${index + 1}`,
    processOrderId: options.order.processOrderId,
    actionType: item.actionType,
    title: FOLLOWUP_ACTION_LABELS[item.actionType],
    status: 'PENDING',
    targetPageKey: item.targetPageKey,
    targetPath: item.targetPath,
    targetQuery: item.targetQuery,
    note: '',
    decidedAt: '',
    decidedBy: '',
    completedAt: '',
    completedBy: '',
  }))
}

export function deriveSpecialProcessExecutionSnapshot(options: {
  order: SpecialProcessOrder
  payload: BindingStripProcessPayload | null
  scopeLines: SpecialProcessScopeLine[]
  executionLogs: SpecialProcessExecutionLog[]
  followupActions: SpecialProcessFollowupAction[]
  typeMeta: SpecialProcessTypeExecutionMeta
}): SpecialProcessExecutionSnapshot {
  const plannedQtyTotal = options.scopeLines.reduce((sum, item) => sum + Math.max(item.plannedQty, 0), 0)
  const sortedLogs = [...options.executionLogs].sort((left, right) => right.operatedAt.localeCompare(left.operatedAt, 'zh-CN'))
  const latestLog = sortedLogs[0] || null
  const actualQtyFromLogs = latestLog?.actualQty || 0
  const actualQtyTotal = Math.max(options.payload?.actualQty || 0, actualQtyFromLogs)
  const latestActualLength = latestLog?.actualLength || 0
  const latestActualWidth = latestLog?.actualWidth || 0
  const latestExecutionAt = latestLog?.operatedAt || ''
  const latestOperatorName = latestLog?.operatorName || options.payload?.operatorName || ''
  const activeLogs = options.executionLogs.filter((item) => item.actionType !== 'CREATE')
  const completedActionCount = options.followupActions.filter((item) => item.status === 'DONE').length
  const pendingActionCount = options.followupActions.filter((item) => item.status === 'PENDING').length
  const executionProgressText = options.typeMeta.enabledForExecution
    ? `${actualQtyTotal}/${Math.max(options.payload?.expectedQty || plannedQtyTotal, 0)}`
    : options.typeMeta.integrationLabel

  let downstreamBlocked = false
  let downstreamBlockReason = ''
  if (!options.typeMeta.enabledForExecution) {
    downstreamBlocked = true
    downstreamBlockReason = '预留类型未接入'
  } else if (!['DONE', 'CANCELLED'].includes(options.order.status)) {
    downstreamBlocked = true
    downstreamBlockReason = '工艺执行未完成'
  } else if (pendingActionCount > 0) {
    downstreamBlocked = true
    downstreamBlockReason = '后续动作待处理'
  }

  return {
    plannedQtyTotal,
    actualQtyTotal,
    latestActualLength,
    latestActualWidth,
    latestExecutionAt,
    latestOperatorName,
    logCount: options.executionLogs.length,
    completedActionCount,
    pendingActionCount,
    followupDoneCount: completedActionCount,
    followupPendingCount: pendingActionCount,
    executionProgressText,
    followupProgressText: options.followupActions.length
      ? `${completedActionCount}/${options.followupActions.length} 已处理`
      : options.typeMeta.enabledForExecution
        ? '无后续动作'
        : '预留类型未接入',
    downstreamBlocked,
    downstreamBlockReason,
  }
}

function hasExecutionContent(logs: SpecialProcessExecutionLog[]): boolean {
  return logs.some((item) => item.actionType !== 'CREATE')
}

export function validateSpecialProcessExecutionTransition(options: {
  order: SpecialProcessOrder
  nextStatus: SpecialProcessStatusKey
  payload: BindingStripProcessPayload | null
  scopeLines: SpecialProcessScopeLine[]
  executionLogs: SpecialProcessExecutionLog[]
  typeMeta: SpecialProcessTypeExecutionMeta
  remark?: string
}): SpecialProcessStatusValidationResult {
  if (!options.typeMeta.enabledForExecution) {
    return { ok: false, message: options.typeMeta.disabledReason || '当前工艺类型未接入执行链。' }
  }
  if (!options.scopeLines.length) return { ok: false, message: '请先补齐作用范围。' }
  if (!options.payload) return { ok: false, message: '请先补齐工艺参数。' }

  if (options.nextStatus === 'DRAFT') return { ok: true, message: '' }

  if (options.payload.materialLength <= 0) return { ok: false, message: '请填写计划布料长度。' }
  if (options.payload.cutWidth <= 0) return { ok: false, message: '请填写计划裁剪宽度。' }
  if (options.payload.expectedQty <= 0) return { ok: false, message: '请填写计划产出数量。' }

  if (options.nextStatus === 'PENDING_EXECUTION') {
    return { ok: true, message: '' }
  }

  if (options.nextStatus === 'IN_PROGRESS' && !hasExecutionContent(options.executionLogs)) {
    return { ok: false, message: '请先记录开工或进度，再进入执行中。' }
  }

  if (options.nextStatus === 'DONE') {
    if (!hasExecutionContent(options.executionLogs)) return { ok: false, message: '请先补录执行记录。' }
    if ((options.payload.actualQty || 0) <= 0) return { ok: false, message: '请填写实际产出数量后再完成。' }
    return { ok: true, message: '' }
  }

  if (options.nextStatus === 'CANCELLED' && !options.remark?.trim() && !options.order.note.trim()) {
    return { ok: false, message: '取消工艺单前请填写取消原因。' }
  }

  return { ok: true, message: '' }
}

export function buildSpecialProcessExecutionLog(options: {
  processOrderId: string
  actionType: SpecialProcessExecutionLogActionType
  operatorName: string
  actualQty?: number
  actualLength?: number
  actualWidth?: number
  remark?: string
  operatedAt?: string
}): SpecialProcessExecutionLog {
  return {
    executionId: `sp-execution-${options.processOrderId}-${options.actionType}-${Date.now()}`,
    processOrderId: options.processOrderId,
    actionType: options.actionType,
    operatorName: options.operatorName || '待补执行人',
    operatedAt: options.operatedAt || nowText(),
    actualQty: Math.max(options.actualQty || 0, 0),
    actualLength: Math.max(options.actualLength || 0, 0),
    actualWidth: Math.max(options.actualWidth || 0, 0),
    remark: options.remark || '',
  }
}

export function normalizeFollowupStatus(value: string | undefined): SpecialProcessFollowupActionStatus {
  if (value === 'DONE' || value === 'SKIPPED' || value === 'PENDING') return value
  return 'PENDING'
}

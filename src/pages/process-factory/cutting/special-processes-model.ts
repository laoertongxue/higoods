import type { MergeBatchRecord } from './merge-batches-model'
import { getCanonicalCuttingPath } from './meta'
import type { OriginalCutOrderRow } from './original-orders-model'
import {
  buildDefaultSpecialProcessFollowupActions,
  buildDefaultSpecialProcessScopeLines,
  buildSpecialProcessExecutionLog,
  buildSpecialProcessSourceOptions,
  deriveSpecialProcessExecutionSnapshot,
  deriveSpecialProcessTypeExecutionMeta,
  hydrateScopeLineFromSource,
  normalizeFollowupStatus,
  type SpecialProcessExecutionSnapshot,
  type SpecialProcessSourceOption,
} from './special-processes-domain'

export const CUTTING_SPECIAL_PROCESS_ORDERS_STORAGE_KEY = 'cuttingSpecialProcessOrders'
export const CUTTING_SPECIAL_PROCESS_BINDING_PAYLOAD_STORAGE_KEY = 'cuttingSpecialProcessBindingPayloads'
export const CUTTING_SPECIAL_PROCESS_AUDIT_STORAGE_KEY = 'cuttingSpecialProcessAuditTrail'
export const CUTTING_SPECIAL_PROCESS_SCOPE_LINES_STORAGE_KEY = 'cuttingSpecialProcessScopeLines'
export const CUTTING_SPECIAL_PROCESS_EXECUTION_LOGS_STORAGE_KEY = 'cuttingSpecialProcessExecutionLogs'
export const CUTTING_SPECIAL_PROCESS_FOLLOWUP_ACTIONS_STORAGE_KEY = 'cuttingSpecialProcessFollowupActions'

export type SpecialProcessType = 'BINDING_STRIP' | 'WASH'
export type SpecialProcessSourceType = 'original-order' | 'merge-batch'
export type SpecialProcessStatusKey = 'DRAFT' | 'PENDING_EXECUTION' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
export type SpecialProcessAuditAction =
  | 'CREATED'
  | 'UPDATED'
  | 'STATUS_CHANGED'
  | 'CANCELLED'
  | 'EXECUTION_LOGGED'
  | 'FOLLOWUP_UPDATED'
export type SpecialProcessScopeSourceType = 'ORIGINAL_CUT_ORDER' | 'MERGE_BATCH'
export type SpecialProcessScopeUnitType = 'PIECE' | 'GARMENT' | 'METER' | 'BUNDLE'
export type SpecialProcessExecutionLogActionType = 'CREATE' | 'UPDATE' | 'START' | 'PAUSE' | 'RESUME' | 'COMPLETE' | 'CANCEL' | 'NOTE'
export type SpecialProcessFollowupActionType =
  | 'GO_TRANSFER_BAG'
  | 'GO_CUT_PIECE_WAREHOUSE'
  | 'GO_ORIGINAL_CUT_ORDER'
  | 'GO_CUTTING_DASHBOARD'
  | 'GO_CUTTING_TOTAL_TABLE'
export type SpecialProcessFollowupActionStatus = 'PENDING' | 'DONE' | 'SKIPPED'
export type SpecialProcessReadinessLevel = 'READY' | 'RESERVED'
export type SpecialProcessIntegrationLevel = 'EXECUTION' | 'PLACEHOLDER'

export interface SpecialProcessTypeExecutionMeta {
  enabledForExecution: boolean
  readinessLevel: SpecialProcessReadinessLevel
  integrationLevel: SpecialProcessIntegrationLevel
  readinessLabel: string
  integrationLabel: string
  disabledReason: string
}

export interface SpecialProcessOrder {
  processOrderId: string
  processOrderNo: string
  processType: SpecialProcessType
  sourceType: SpecialProcessSourceType
  originalCutOrderIds: string[]
  originalCutOrderNos: string[]
  mergeBatchId: string
  mergeBatchNo: string
  productionOrderIds: string[]
  productionOrderNos: string[]
  styleCode: string
  spuCode: string
  styleName: string
  materialSku: string
  status: SpecialProcessStatusKey
  createdAt: string
  createdBy: string
  note: string
}

export interface BindingStripProcessPayload {
  processOrderId: string
  materialLength: number
  cutWidth: number
  expectedQty: number
  actualQty: number
  operatorName: string
  note: string
}

export interface ReservedSpecialProcessPayload {
  processOrderId: string
  processType: SpecialProcessType
  enabled: boolean
  payloadVersion: string | null
  data: Record<string, unknown> | null
}

export interface SpecialProcessScopeLine {
  scopeId: string
  processOrderId: string
  sourceType: SpecialProcessScopeSourceType
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
  unitType: SpecialProcessScopeUnitType
  note: string
}

export interface SpecialProcessExecutionLog {
  executionId: string
  processOrderId: string
  actionType: SpecialProcessExecutionLogActionType
  operatorName: string
  operatedAt: string
  actualQty: number
  actualLength: number
  actualWidth: number
  remark: string
}

export interface SpecialProcessFollowupAction {
  actionId: string
  processOrderId: string
  actionType: SpecialProcessFollowupActionType
  title: string
  status: SpecialProcessFollowupActionStatus
  targetPageKey: 'transfer-bags' | 'cut-piece-warehouse' | 'original-orders' | 'production-progress' | 'summary'
  targetPath: string
  targetQuery: Record<string, string | undefined>
  note: string
  decidedAt: string
  decidedBy: string
  completedAt: string
  completedBy: string
}

export interface SpecialProcessAuditTrail {
  auditTrailId: string
  processOrderId: string
  action: SpecialProcessAuditAction
  actionAt: string
  actionBy: string
  payloadSummary: string
  note: string
}

export interface SpecialProcessStatusMeta {
  key: SpecialProcessStatusKey
  label: string
  className: string
  detailText: string
}

export interface SpecialProcessPrefilter {
  productionOrderId?: string
  productionOrderNo?: string
  originalCutOrderId?: string
  originalCutOrderNo?: string
  mergeBatchId?: string
  mergeBatchNo?: string
  processOrderId?: string
  processOrderNo?: string
  processType?: SpecialProcessType
  styleCode?: string
  materialSku?: string
}

export interface SpecialProcessFilters {
  keyword: string
  processType: 'ALL' | SpecialProcessType
  status: 'ALL' | SpecialProcessStatusKey
  sourceType: 'ALL' | SpecialProcessSourceType
}

export interface SpecialProcessNavigationPayload {
  originalOrders: Record<string, string | undefined>
  mergeBatches: Record<string, string | undefined>
  replenishment: Record<string, string | undefined>
  summary: Record<string, string | undefined>
  productionProgress: Record<string, string | undefined>
  cutPieceWarehouse: Record<string, string | undefined>
  transferBags: Record<string, string | undefined>
}

export interface SpecialProcessRow extends SpecialProcessOrder {
  processTypeLabel: string
  sourceLabel: string
  sourceSummary: string
  statusMeta: SpecialProcessStatusMeta
  bindingPayload: BindingStripProcessPayload | null
  reservedPayload: ReservedSpecialProcessPayload
  navigationPayload: SpecialProcessNavigationPayload
  keywordIndex: string[]
  scopeLines: SpecialProcessScopeLine[]
  executionLogs: SpecialProcessExecutionLog[]
  followupActions: SpecialProcessFollowupAction[]
  sourceOptions: SpecialProcessSourceOption[]
  typeExecutionMeta: SpecialProcessTypeExecutionMeta
  plannedQtyTotal: number
  actualQtyTotal: number
  latestActualLength: number
  latestActualWidth: number
  latestExecutionAt: string
  latestOperatorName: string
  executionLogCount: number
  followupPendingCount: number
  followupDoneCount: number
  executionProgressSummary: string
  followupProgressSummary: string
  downstreamBlocked: boolean
  downstreamBlockReason: string
}

export interface SpecialProcessViewModel {
  rows: SpecialProcessRow[]
  rowsById: Record<string, SpecialProcessRow>
  stats: {
    totalCount: number
    bindingStripCount: number
    pendingExecutionCount: number
    inProgressCount: number
    doneCount: number
    reservedCount: number
  }
}

export const specialProcessTypeMeta: Record<SpecialProcessType, { label: string; className: string; detailText: string }> = {
  BINDING_STRIP: {
    label: '捆条工艺',
    className: 'bg-blue-100 text-blue-700',
    detailText: '当前已接入裁片执行链。',
  },
  WASH: {
    label: '洗水（预留）',
    className: 'bg-slate-100 text-slate-700',
    detailText: '当前仅保留预留结构，暂未进入执行链。',
  },
}

export const specialProcessStatusMetaMap: Record<SpecialProcessStatusKey, SpecialProcessStatusMeta> = {
  DRAFT: { key: 'DRAFT', label: '草稿', className: 'bg-slate-100 text-slate-700', detailText: '工艺单已创建，待补范围与参数。' },
  PENDING_EXECUTION: { key: 'PENDING_EXECUTION', label: '待执行', className: 'bg-amber-100 text-amber-700', detailText: '工艺单已准备就绪，待开工。' },
  IN_PROGRESS: { key: 'IN_PROGRESS', label: '执行中', className: 'bg-blue-100 text-blue-700', detailText: '工艺执行中，继续补录进度。' },
  DONE: { key: 'DONE', label: '已完成', className: 'bg-emerald-100 text-emerald-700', detailText: '工艺执行完成，待收后续动作。' },
  CANCELLED: { key: 'CANCELLED', label: '已取消', className: 'bg-slate-200 text-slate-700', detailText: '工艺单已取消，不再继续执行。' },
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function nowText(date = new Date()): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function buildProcessOrderNo(index: number): string {
  const date = nowText().slice(0, 10).replaceAll('-', '')
  return `SP-${date}-${String(index + 1).padStart(3, '0')}`
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
}

function normalizeSpecialProcessOrder(record: unknown): SpecialProcessOrder | null {
  if (!record || typeof record !== 'object') return null
  const raw = record as Record<string, unknown>
  if (typeof raw.processOrderId !== 'string' || typeof raw.processOrderNo !== 'string') return null
  const processType = raw.processType === 'WASH' ? 'WASH' : 'BINDING_STRIP'
  const sourceType = raw.sourceType === 'merge-batch' ? 'merge-batch' : 'original-order'
  const status = ['DRAFT', 'PENDING_EXECUTION', 'IN_PROGRESS', 'DONE', 'CANCELLED'].includes(String(raw.status))
    ? (raw.status as SpecialProcessStatusKey)
    : 'DRAFT'
  return {
    processOrderId: raw.processOrderId,
    processOrderNo: raw.processOrderNo,
    processType,
    sourceType,
    originalCutOrderIds: normalizeStringArray(raw.originalCutOrderIds),
    originalCutOrderNos: normalizeStringArray(raw.originalCutOrderNos),
    mergeBatchId: typeof raw.mergeBatchId === 'string' ? raw.mergeBatchId : '',
    mergeBatchNo: typeof raw.mergeBatchNo === 'string' ? raw.mergeBatchNo : '',
    productionOrderIds: normalizeStringArray(raw.productionOrderIds),
    productionOrderNos: normalizeStringArray(raw.productionOrderNos),
    styleCode: typeof raw.styleCode === 'string' ? raw.styleCode : '',
    spuCode: typeof raw.spuCode === 'string' ? raw.spuCode : '',
    styleName: typeof raw.styleName === 'string' ? raw.styleName : '',
    materialSku: typeof raw.materialSku === 'string' ? raw.materialSku : '',
    status,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : nowText(),
    createdBy: typeof raw.createdBy === 'string' ? raw.createdBy : '工艺专员',
    note: typeof raw.note === 'string' ? raw.note : '',
  }
}

function normalizeBindingStripPayload(record: unknown): BindingStripProcessPayload | null {
  if (!record || typeof record !== 'object') return null
  const raw = record as Record<string, unknown>
  if (typeof raw.processOrderId !== 'string') return null
  return {
    processOrderId: raw.processOrderId,
    materialLength: Number(raw.materialLength || 0),
    cutWidth: Number(raw.cutWidth || 0),
    expectedQty: Number(raw.expectedQty || 0),
    actualQty: Number(raw.actualQty || 0),
    operatorName: typeof raw.operatorName === 'string' ? raw.operatorName : '',
    note: typeof raw.note === 'string' ? raw.note : '',
  }
}

function normalizeSpecialProcessScopeLine(record: unknown): SpecialProcessScopeLine | null {
  if (!record || typeof record !== 'object') return null
  const raw = record as Record<string, unknown>
  if (typeof raw.scopeId !== 'string' || typeof raw.processOrderId !== 'string') return null
  return {
    scopeId: raw.scopeId,
    processOrderId: raw.processOrderId,
    sourceType: raw.sourceType === 'MERGE_BATCH' ? 'MERGE_BATCH' : 'ORIGINAL_CUT_ORDER',
    sourceCutOrderId: typeof raw.sourceCutOrderId === 'string' ? raw.sourceCutOrderId : '',
    sourceCutOrderNo: typeof raw.sourceCutOrderNo === 'string' ? raw.sourceCutOrderNo : '',
    mergeBatchId: typeof raw.mergeBatchId === 'string' ? raw.mergeBatchId : '',
    mergeBatchNo: typeof raw.mergeBatchNo === 'string' ? raw.mergeBatchNo : '',
    sourceProductionOrderNo: typeof raw.sourceProductionOrderNo === 'string' ? raw.sourceProductionOrderNo : '',
    styleCode: typeof raw.styleCode === 'string' ? raw.styleCode : '',
    spuCode: typeof raw.spuCode === 'string' ? raw.spuCode : '',
    color: typeof raw.color === 'string' ? raw.color : '',
    materialSku: typeof raw.materialSku === 'string' ? raw.materialSku : '',
    plannedQty: Math.max(Number(raw.plannedQty || 0), 0),
    unitType: ['PIECE', 'GARMENT', 'METER', 'BUNDLE'].includes(String(raw.unitType)) ? (raw.unitType as SpecialProcessScopeUnitType) : 'GARMENT',
    note: typeof raw.note === 'string' ? raw.note : '',
  }
}

function normalizeSpecialProcessExecutionLog(record: unknown): SpecialProcessExecutionLog | null {
  if (!record || typeof record !== 'object') return null
  const raw = record as Record<string, unknown>
  if (typeof raw.executionId !== 'string' || typeof raw.processOrderId !== 'string') return null
  return {
    executionId: raw.executionId,
    processOrderId: raw.processOrderId,
    actionType: ['CREATE', 'UPDATE', 'START', 'PAUSE', 'RESUME', 'COMPLETE', 'CANCEL', 'NOTE'].includes(String(raw.actionType))
      ? (raw.actionType as SpecialProcessExecutionLogActionType)
      : 'NOTE',
    operatorName: typeof raw.operatorName === 'string' ? raw.operatorName : '待补执行人',
    operatedAt: typeof raw.operatedAt === 'string' ? raw.operatedAt : nowText(),
    actualQty: Math.max(Number(raw.actualQty || 0), 0),
    actualLength: Math.max(Number(raw.actualLength || 0), 0),
    actualWidth: Math.max(Number(raw.actualWidth || 0), 0),
    remark: typeof raw.remark === 'string' ? raw.remark : '',
  }
}

function normalizeSpecialProcessFollowupAction(record: unknown): SpecialProcessFollowupAction | null {
  if (!record || typeof record !== 'object') return null
  const raw = record as Record<string, unknown>
  if (typeof raw.actionId !== 'string' || typeof raw.processOrderId !== 'string') return null
  const targetPageKey = ['transfer-bags', 'cut-piece-warehouse', 'original-orders', 'production-progress', 'summary'].includes(String(raw.targetPageKey))
    ? (raw.targetPageKey as SpecialProcessFollowupAction['targetPageKey'])
    : 'summary'
  return {
    actionId: raw.actionId,
    processOrderId: raw.processOrderId,
    actionType: ['GO_TRANSFER_BAG', 'GO_CUT_PIECE_WAREHOUSE', 'GO_ORIGINAL_CUT_ORDER', 'GO_CUTTING_DASHBOARD', 'GO_CUTTING_TOTAL_TABLE'].includes(String(raw.actionType))
      ? (raw.actionType as SpecialProcessFollowupActionType)
      : 'GO_CUTTING_TOTAL_TABLE',
    title: typeof raw.title === 'string' ? raw.title : '去裁剪总表',
    status: normalizeFollowupStatus(typeof raw.status === 'string' ? raw.status : undefined),
    targetPageKey,
    targetPath: typeof raw.targetPath === 'string' ? raw.targetPath : getCanonicalCuttingPath('summary'),
    targetQuery: raw.targetQuery && typeof raw.targetQuery === 'object' ? (raw.targetQuery as Record<string, string | undefined>) : {},
    note: typeof raw.note === 'string' ? raw.note : '',
    decidedAt: typeof raw.decidedAt === 'string' ? raw.decidedAt : '',
    decidedBy: typeof raw.decidedBy === 'string' ? raw.decidedBy : '',
    completedAt: typeof raw.completedAt === 'string' ? raw.completedAt : '',
    completedBy: typeof raw.completedBy === 'string' ? raw.completedBy : '',
  }
}

function normalizeSpecialProcessAudit(record: unknown): SpecialProcessAuditTrail | null {
  if (!record || typeof record !== 'object') return null
  const raw = record as Record<string, unknown>
  if (typeof raw.auditTrailId !== 'string' || typeof raw.processOrderId !== 'string') return null
  const action = ['CREATED', 'UPDATED', 'STATUS_CHANGED', 'CANCELLED', 'EXECUTION_LOGGED', 'FOLLOWUP_UPDATED'].includes(String(raw.action))
    ? (raw.action as SpecialProcessAuditAction)
    : 'UPDATED'
  return {
    auditTrailId: raw.auditTrailId,
    processOrderId: raw.processOrderId,
    action,
    actionAt: typeof raw.actionAt === 'string' ? raw.actionAt : nowText(),
    actionBy: typeof raw.actionBy === 'string' ? raw.actionBy : '系统',
    payloadSummary: typeof raw.payloadSummary === 'string' ? raw.payloadSummary : '',
    note: typeof raw.note === 'string' ? raw.note : '',
  }
}

export function createBindingStripProcessDraft(options: {
  originalRows: OriginalCutOrderRow[]
  mergeBatches: MergeBatchRecord[]
  prefilter: SpecialProcessPrefilter | null
  existingCount: number
}): {
  order: SpecialProcessOrder
  payload: BindingStripProcessPayload
  scopeLines: SpecialProcessScopeLine[]
  followupActions: SpecialProcessFollowupAction[]
  audit: SpecialProcessAuditTrail
} {
  const mergeBatch =
    (options.prefilter?.mergeBatchNo && options.mergeBatches.find((item) => item.mergeBatchNo === options.prefilter?.mergeBatchNo)) || null
  const matchedOriginals = options.prefilter?.originalCutOrderNo
    ? options.originalRows.filter((row) => row.originalCutOrderNo === options.prefilter?.originalCutOrderNo)
    : mergeBatch
      ? options.originalRows.filter((row) => mergeBatch.items.some((item) => item.originalCutOrderId === row.originalCutOrderId))
      : [options.originalRows[0]].filter(Boolean)

  const seed = matchedOriginals[0]
  const orderId = `sp-order-${Date.now()}`
  const orderNo = buildProcessOrderNo(options.existingCount)
  const order: SpecialProcessOrder = {
    processOrderId: orderId,
    processOrderNo: orderNo,
    processType: 'BINDING_STRIP',
    sourceType: mergeBatch ? 'merge-batch' : 'original-order',
    originalCutOrderIds: matchedOriginals.map((row) => row.originalCutOrderId),
    originalCutOrderNos: matchedOriginals.map((row) => row.originalCutOrderNo),
    mergeBatchId: mergeBatch?.mergeBatchId || '',
    mergeBatchNo: mergeBatch?.mergeBatchNo || '',
    productionOrderIds: uniqueStrings(matchedOriginals.map((row) => row.productionOrderId)),
    productionOrderNos: uniqueStrings(matchedOriginals.map((row) => row.productionOrderNo)),
    styleCode: seed?.styleCode || options.prefilter?.styleCode || '',
    spuCode: seed?.spuCode || '',
    styleName: seed?.styleName || '',
    materialSku: options.prefilter?.materialSku || seed?.materialSku || '',
    status: 'DRAFT',
    createdAt: nowText(),
    createdBy: '工艺专员 叶晓青',
    note: mergeBatch ? '来源于合并裁剪批次预填。' : '来源于原始裁片单预填。',
  }
  const payload: BindingStripProcessPayload = {
    processOrderId: orderId,
    materialLength: seed ? Math.max(seed.plannedQty / 2, 18) : 20,
    cutWidth: 3.5,
    expectedQty: seed?.plannedQty || 0,
    actualQty: 0,
    operatorName: '',
    note: '',
  }
  const navigationPayload = buildSpecialProcessNavigationPayload(order)
  const typeMeta = deriveSpecialProcessTypeExecutionMeta(order.processType)
  const scopeLines = buildDefaultSpecialProcessScopeLines({
    order,
    originalRows: options.originalRows,
    mergeBatches: options.mergeBatches,
  })
  const followupActions = buildDefaultSpecialProcessFollowupActions({
    order,
    navigationPayload,
    typeMeta,
  })

  return {
    order,
    payload,
    scopeLines,
    followupActions,
    audit: buildSpecialProcessAuditTrail({
      processOrderId: orderId,
      action: 'CREATED',
      actionBy: order.createdBy,
      payloadSummary: `创建捆条工艺单 ${orderNo}`,
      note: order.note,
    }),
  }
}

export function deriveSpecialProcessStatus(status: SpecialProcessStatusKey): SpecialProcessStatusMeta {
  return specialProcessStatusMetaMap[status]
}

export function validateSpecialProcessPayload(options: {
  order: SpecialProcessOrder
  payload: BindingStripProcessPayload | null
}): { ok: boolean; message: string } {
  if (options.order.processType === 'WASH') {
    return { ok: false, message: '洗水工艺当前仅做预留，暂未接入裁片执行链。' }
  }
  if (!options.payload) return { ok: false, message: '当前缺少捆条工艺参数。' }
  if (options.payload.materialLength <= 0) return { ok: false, message: '请填写计划布料长度。' }
  if (options.payload.cutWidth <= 0) return { ok: false, message: '请填写计划裁剪宽度。' }
  if (options.payload.expectedQty <= 0) return { ok: false, message: '请填写计划产出数量。' }
  return { ok: true, message: '' }
}

export function buildReservedSpecialProcessPayload(processOrderId: string, processType: SpecialProcessType): ReservedSpecialProcessPayload {
  return {
    processOrderId,
    processType,
    enabled: false,
    payloadVersion: null,
    data: null,
  }
}

export function buildSpecialProcessNavigationPayload(
  order: Pick<
    SpecialProcessOrder,
    | 'originalCutOrderIds'
    | 'originalCutOrderNos'
    | 'mergeBatchId'
    | 'mergeBatchNo'
    | 'productionOrderIds'
    | 'productionOrderNos'
    | 'styleCode'
    | 'materialSku'
  >,
): SpecialProcessNavigationPayload {
  const originalCutOrderId = order.originalCutOrderIds[0] || undefined
  const productionOrderId = order.productionOrderIds[0] || undefined
  return {
    originalOrders: {
      originalCutOrderId,
      originalCutOrderNo: order.originalCutOrderNos[0] || undefined,
      productionOrderId,
      productionOrderNo: order.productionOrderNos[0] || undefined,
      mergeBatchId: order.mergeBatchId || undefined,
      mergeBatchNo: order.mergeBatchNo || undefined,
      styleCode: order.styleCode || undefined,
      materialSku: order.materialSku || undefined,
    },
    mergeBatches: {
      mergeBatchId: order.mergeBatchId || undefined,
      mergeBatchNo: order.mergeBatchNo || undefined,
      originalCutOrderId,
      originalCutOrderNo: order.originalCutOrderNos[0] || undefined,
    },
    replenishment: {
      originalCutOrderId,
      originalCutOrderNo: order.originalCutOrderNos[0] || undefined,
      productionOrderId,
      productionOrderNo: order.productionOrderNos[0] || undefined,
      mergeBatchId: order.mergeBatchId || undefined,
      mergeBatchNo: order.mergeBatchNo || undefined,
      materialSku: order.materialSku || undefined,
    },
    summary: {
      mergeBatchId: order.mergeBatchId || undefined,
      mergeBatchNo: order.mergeBatchNo || undefined,
      originalCutOrderId,
      originalCutOrderNo: order.originalCutOrderNos[0] || undefined,
      productionOrderId,
      productionOrderNo: order.productionOrderNos[0] || undefined,
      styleCode: order.styleCode || undefined,
      materialSku: order.materialSku || undefined,
    },
    productionProgress: {
      productionOrderId,
      productionOrderNo: order.productionOrderNos[0] || undefined,
      styleCode: order.styleCode || undefined,
    },
    cutPieceWarehouse: {
      productionOrderId,
      productionOrderNo: order.productionOrderNos[0] || undefined,
      originalCutOrderId,
      originalCutOrderNo: order.originalCutOrderNos[0] || undefined,
      mergeBatchId: order.mergeBatchId || undefined,
      mergeBatchNo: order.mergeBatchNo || undefined,
      materialSku: order.materialSku || undefined,
    },
    transferBags: {
      productionOrderId,
      productionOrderNo: order.productionOrderNos[0] || undefined,
      originalCutOrderId,
      originalCutOrderNo: order.originalCutOrderNos[0] || undefined,
      mergeBatchId: order.mergeBatchId || undefined,
      mergeBatchNo: order.mergeBatchNo || undefined,
      materialSku: order.materialSku || undefined,
    },
  }
}

export function buildSpecialProcessAuditTrail(options: {
  processOrderId: string
  action: SpecialProcessAuditAction
  actionBy: string
  payloadSummary: string
  note?: string
  actionAt?: string
}): SpecialProcessAuditTrail {
  return {
    auditTrailId: `sp-audit-${options.processOrderId}-${options.action}-${Date.now()}`,
    processOrderId: options.processOrderId,
    action: options.action,
    actionAt: options.actionAt || nowText(),
    actionBy: options.actionBy,
    payloadSummary: options.payloadSummary,
    note: options.note || '',
  }
}

function buildSystemSeedOrders(originalRows: OriginalCutOrderRow[], mergeBatches: MergeBatchRecord[]): {
  orders: SpecialProcessOrder[]
  payloads: BindingStripProcessPayload[]
  scopeLines: SpecialProcessScopeLine[]
  executionLogs: SpecialProcessExecutionLog[]
  followupActions: SpecialProcessFollowupAction[]
  audits: SpecialProcessAuditTrail[]
} {
  const original = originalRows[0]
  const orders: SpecialProcessOrder[] = []
  const payloads: BindingStripProcessPayload[] = []
  const scopeLines: SpecialProcessScopeLine[] = []
  const executionLogs: SpecialProcessExecutionLog[] = []
  const followupActions: SpecialProcessFollowupAction[] = []
  const audits: SpecialProcessAuditTrail[] = []

  if (original) {
    const order: SpecialProcessOrder = {
      processOrderId: 'sp-seed-binding-strip',
      processOrderNo: 'SP-20260324-001',
      processType: 'BINDING_STRIP',
      sourceType: 'original-order',
      originalCutOrderIds: [original.originalCutOrderId],
      originalCutOrderNos: [original.originalCutOrderNo],
      mergeBatchId: '',
      mergeBatchNo: original.latestMergeBatchNo || '',
      productionOrderIds: [original.productionOrderId],
      productionOrderNos: [original.productionOrderNo],
      styleCode: original.styleCode,
      spuCode: original.spuCode,
      styleName: original.styleName,
      materialSku: original.materialSku,
      status: 'IN_PROGRESS',
      createdAt: '2026-03-24 09:20',
      createdBy: '工艺专员 叶晓青',
      note: '捆条工艺已进入执行，可继续补录实际数量。',
    }
    const payload: BindingStripProcessPayload = {
      processOrderId: order.processOrderId,
      materialLength: 28,
      cutWidth: 3.2,
      expectedQty: Math.max(original.plannedQty, 20),
      actualQty: Math.max(original.plannedQty - 4, 0),
      operatorName: '陈工',
      note: '首轮捆条已完成，待复核余量。',
    }
    const navigationPayload = buildSpecialProcessNavigationPayload(order)
    const typeMeta = deriveSpecialProcessTypeExecutionMeta(order.processType)
    const seedScopes = buildDefaultSpecialProcessScopeLines({ order, originalRows, mergeBatches })
    const seedActions = buildDefaultSpecialProcessFollowupActions({ order, navigationPayload, typeMeta }).map((item, index) =>
      index === 2
        ? {
            ...item,
            status: 'DONE' as const,
            decidedAt: '2026-03-24 10:20',
            decidedBy: '工艺专员 叶晓青',
            completedAt: '2026-03-24 10:20',
            completedBy: '工艺专员 叶晓青',
            note: '已同步原始裁片单。',
          }
        : item,
    )
    const seedLogs = [
      buildSpecialProcessExecutionLog({
        processOrderId: order.processOrderId,
        actionType: 'CREATE',
        operatorName: order.createdBy,
        actualQty: 0,
        remark: '创建工艺单',
        operatedAt: order.createdAt,
      }),
      buildSpecialProcessExecutionLog({
        processOrderId: order.processOrderId,
        actionType: 'START',
        operatorName: '陈工',
        actualQty: Math.max(original.plannedQty - 8, 0),
        actualLength: 24,
        actualWidth: 3.2,
        remark: '已开工，先做首轮捆条。',
        operatedAt: '2026-03-24 10:00',
      }),
      buildSpecialProcessExecutionLog({
        processOrderId: order.processOrderId,
        actionType: 'UPDATE',
        operatorName: '陈工',
        actualQty: payload.actualQty,
        actualLength: 28,
        actualWidth: 3.2,
        remark: '补录本轮产出。',
        operatedAt: '2026-03-24 11:30',
      }),
    ]

    orders.push(order)
    payloads.push(payload)
    scopeLines.push(...seedScopes)
    executionLogs.push(...seedLogs)
    followupActions.push(...seedActions)
    audits.push(
      buildSpecialProcessAuditTrail({
        processOrderId: order.processOrderId,
        action: 'CREATED',
        actionBy: order.createdBy,
        actionAt: order.createdAt,
        payloadSummary: `创建工艺单 ${order.processOrderNo}`,
        note: order.note,
      }),
      buildSpecialProcessAuditTrail({
        processOrderId: order.processOrderId,
        action: 'EXECUTION_LOGGED',
        actionBy: '陈工',
        actionAt: '2026-03-24 10:00',
        payloadSummary: `${order.processOrderNo} 已开工`,
        note: '已记录首轮捆条。',
      }),
    )
  }

  return { orders, payloads, scopeLines, executionLogs, followupActions, audits }
}

export function buildSystemSeedSpecialProcessLedger(
  originalRows: OriginalCutOrderRow[],
  mergeBatches: MergeBatchRecord[],
): {
  orders: SpecialProcessOrder[]
  payloads: BindingStripProcessPayload[]
  scopeLines: SpecialProcessScopeLine[]
  executionLogs: SpecialProcessExecutionLog[]
  followupActions: SpecialProcessFollowupAction[]
  audits: SpecialProcessAuditTrail[]
} {
  return buildSystemSeedOrders(originalRows, mergeBatches)
}

export function serializeSpecialProcessOrdersStorage(records: SpecialProcessOrder[]): string {
  return JSON.stringify(records)
}

export function deserializeSpecialProcessOrdersStorage(raw: string | null): SpecialProcessOrder[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(normalizeSpecialProcessOrder).filter((item): item is SpecialProcessOrder => Boolean(item)) : []
  } catch {
    return []
  }
}

export function serializeBindingStripPayloadsStorage(records: BindingStripProcessPayload[]): string {
  return JSON.stringify(records)
}

export function deserializeBindingStripPayloadsStorage(raw: string | null): BindingStripProcessPayload[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(normalizeBindingStripPayload).filter((item): item is BindingStripProcessPayload => Boolean(item)) : []
  } catch {
    return []
  }
}

export function serializeSpecialProcessScopeLinesStorage(records: SpecialProcessScopeLine[]): string {
  return JSON.stringify(records)
}

export function deserializeSpecialProcessScopeLinesStorage(raw: string | null): SpecialProcessScopeLine[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(normalizeSpecialProcessScopeLine).filter((item): item is SpecialProcessScopeLine => Boolean(item)) : []
  } catch {
    return []
  }
}

export function serializeSpecialProcessExecutionLogsStorage(records: SpecialProcessExecutionLog[]): string {
  return JSON.stringify(records)
}

export function deserializeSpecialProcessExecutionLogsStorage(raw: string | null): SpecialProcessExecutionLog[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(normalizeSpecialProcessExecutionLog).filter((item): item is SpecialProcessExecutionLog => Boolean(item)) : []
  } catch {
    return []
  }
}

export function serializeSpecialProcessFollowupActionsStorage(records: SpecialProcessFollowupAction[]): string {
  return JSON.stringify(records)
}

export function deserializeSpecialProcessFollowupActionsStorage(raw: string | null): SpecialProcessFollowupAction[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(normalizeSpecialProcessFollowupAction).filter((item): item is SpecialProcessFollowupAction => Boolean(item)) : []
  } catch {
    return []
  }
}

export function serializeSpecialProcessAuditTrailStorage(records: SpecialProcessAuditTrail[]): string {
  return JSON.stringify(records)
}

export function deserializeSpecialProcessAuditTrailStorage(raw: string | null): SpecialProcessAuditTrail[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(normalizeSpecialProcessAudit).filter((item): item is SpecialProcessAuditTrail => Boolean(item)) : []
  } catch {
    return []
  }
}

function getEffectiveScopeLines(options: {
  order: SpecialProcessOrder
  storedScopeLines: SpecialProcessScopeLine[]
  originalRows: OriginalCutOrderRow[]
  mergeBatches: MergeBatchRecord[]
  sourceOptions: SpecialProcessSourceOption[]
}): SpecialProcessScopeLine[] {
  const matched = options.storedScopeLines.filter((item) => item.processOrderId === options.order.processOrderId)
  if (!matched.length) {
    return buildDefaultSpecialProcessScopeLines({
      order: options.order,
      originalRows: options.originalRows,
      mergeBatches: options.mergeBatches,
    })
  }
  return matched.map((item) => hydrateScopeLineFromSource(item, options.sourceOptions))
}

function getEffectiveFollowupActions(options: {
  order: SpecialProcessOrder
  storedActions: SpecialProcessFollowupAction[]
  navigationPayload: SpecialProcessNavigationPayload
  typeMeta: SpecialProcessTypeExecutionMeta
}): SpecialProcessFollowupAction[] {
  const matched = options.storedActions.filter((item) => item.processOrderId === options.order.processOrderId)
  if (!matched.length) {
    return buildDefaultSpecialProcessFollowupActions({
      order: options.order,
      navigationPayload: options.navigationPayload,
      typeMeta: options.typeMeta,
    })
  }
  const defaultsByType = new Map(
    buildDefaultSpecialProcessFollowupActions({
      order: options.order,
      navigationPayload: options.navigationPayload,
      typeMeta: options.typeMeta,
    }).map((item) => [item.actionType, item]),
  )
  return matched.map((item) => ({
    ...defaultsByType.get(item.actionType),
    ...item,
  }))
}

function buildSourceSummary(order: SpecialProcessOrder, scopeLines: SpecialProcessScopeLine[]): string {
  const scopeCutOrders = uniqueStrings(scopeLines.map((item) => item.sourceCutOrderNo))
  if (order.sourceType === 'merge-batch') {
    return `来自合并批次 ${order.mergeBatchNo || '待补批次号'}，当前覆盖 ${scopeCutOrders.length || order.originalCutOrderNos.length} 个原始裁片单。`
  }
  return `来源原始裁片单 ${scopeCutOrders[0] || order.originalCutOrderNos[0] || '待补'}。`
}

function buildKeywordIndex(order: SpecialProcessOrder, scopeLines: SpecialProcessScopeLine[]): string[] {
  return [
    order.processOrderNo,
    order.originalCutOrderNos.join(' '),
    order.mergeBatchNo,
    order.styleCode,
    order.spuCode,
    order.materialSku,
    ...scopeLines.map((item) => item.sourceProductionOrderNo),
    ...scopeLines.map((item) => item.color),
    ...scopeLines.map((item) => item.materialSku),
  ]
    .filter(Boolean)
    .map((item) => item.toLowerCase())
}

function mergeByKey<T extends Record<string, unknown>>(seed: T[], stored: T[], key: keyof T): T[] {
  const merged = new Map<string, T>()
  seed.forEach((item) => merged.set(String(item[key]), item))
  stored.forEach((item) => merged.set(String(item[key]), item))
  return Array.from(merged.values())
}

export function buildSpecialProcessViewModel(options: {
  originalRows: OriginalCutOrderRow[]
  mergeBatches: MergeBatchRecord[]
  orders: SpecialProcessOrder[]
  bindingPayloads: BindingStripProcessPayload[]
  scopeLines?: SpecialProcessScopeLine[]
  executionLogs?: SpecialProcessExecutionLog[]
  followupActions?: SpecialProcessFollowupAction[]
}): SpecialProcessViewModel {
  const seed = buildSystemSeedOrders(options.originalRows, options.mergeBatches)
  const orderMap = new Map<string, SpecialProcessOrder>()
  mergeByKey(seed.orders, options.orders, 'processOrderId').forEach((order) => orderMap.set(order.processOrderId, order))

  const payloadMap = new Map<string, BindingStripProcessPayload>()
  mergeByKey(seed.payloads, options.bindingPayloads, 'processOrderId').forEach((payload) => payloadMap.set(payload.processOrderId, payload))

  const allStoredScopeLines = mergeByKey(seed.scopeLines, options.scopeLines || [], 'scopeId')
  const allStoredExecutionLogs = mergeByKey(seed.executionLogs, options.executionLogs || [], 'executionId')
  const allStoredFollowupActions = mergeByKey(seed.followupActions, options.followupActions || [], 'actionId')

  const rows = Array.from(orderMap.values())
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt, 'zh-CN'))
    .map((order) => {
      const statusMeta = deriveSpecialProcessStatus(order.status)
      const bindingPayload = payloadMap.get(order.processOrderId) || null
      const reservedPayload = buildReservedSpecialProcessPayload(order.processOrderId, order.processType)
      const navigationPayload = buildSpecialProcessNavigationPayload(order)
      const typeExecutionMeta = deriveSpecialProcessTypeExecutionMeta(order.processType)
      const sourceOptions = buildSpecialProcessSourceOptions({
        order,
        originalRows: options.originalRows,
        mergeBatches: options.mergeBatches,
      })
      const scopeLines = getEffectiveScopeLines({
        order,
        storedScopeLines: allStoredScopeLines,
        originalRows: options.originalRows,
        mergeBatches: options.mergeBatches,
        sourceOptions,
      })
      const executionLogs = allStoredExecutionLogs
        .filter((item) => item.processOrderId === order.processOrderId)
        .sort((left, right) => right.operatedAt.localeCompare(left.operatedAt, 'zh-CN'))
      const followupActions = getEffectiveFollowupActions({
        order,
        storedActions: allStoredFollowupActions,
        navigationPayload,
        typeMeta: typeExecutionMeta,
      })
      const executionSnapshot: SpecialProcessExecutionSnapshot = deriveSpecialProcessExecutionSnapshot({
        order,
        payload: bindingPayload,
        scopeLines,
        executionLogs,
        followupActions,
        typeMeta: typeExecutionMeta,
      })
      return {
        ...order,
        processTypeLabel: specialProcessTypeMeta[order.processType].label,
        sourceLabel: order.sourceType === 'merge-batch' ? '合并裁剪批次' : '原始裁片单',
        sourceSummary: buildSourceSummary(order, scopeLines),
        statusMeta,
        bindingPayload,
        reservedPayload,
        navigationPayload,
        keywordIndex: buildKeywordIndex(order, scopeLines),
        scopeLines,
        executionLogs,
        followupActions,
        sourceOptions,
        typeExecutionMeta,
        plannedQtyTotal: executionSnapshot.plannedQtyTotal,
        actualQtyTotal: executionSnapshot.actualQtyTotal,
        latestActualLength: executionSnapshot.latestActualLength,
        latestActualWidth: executionSnapshot.latestActualWidth,
        latestExecutionAt: executionSnapshot.latestExecutionAt,
        latestOperatorName: executionSnapshot.latestOperatorName,
        executionLogCount: executionSnapshot.logCount,
        followupPendingCount: executionSnapshot.followupPendingCount,
        followupDoneCount: executionSnapshot.followupDoneCount,
        executionProgressSummary: executionSnapshot.executionProgressText,
        followupProgressSummary: executionSnapshot.followupProgressText,
        downstreamBlocked: executionSnapshot.downstreamBlocked,
        downstreamBlockReason: executionSnapshot.downstreamBlockReason,
      }
    })

  return {
    rows,
    rowsById: Object.fromEntries(rows.map((row) => [row.processOrderId, row])),
    stats: {
      totalCount: rows.length,
      bindingStripCount: rows.filter((row) => row.processType === 'BINDING_STRIP').length,
      pendingExecutionCount: rows.filter((row) => row.status === 'PENDING_EXECUTION').length,
      inProgressCount: rows.filter((row) => row.status === 'IN_PROGRESS').length,
      doneCount: rows.filter((row) => row.status === 'DONE').length,
      reservedCount: rows.filter((row) => !row.typeExecutionMeta.enabledForExecution).length,
    },
  }
}

export function filterSpecialProcessRows(
  rows: SpecialProcessRow[],
  filters: SpecialProcessFilters,
  prefilter: SpecialProcessPrefilter | null,
): SpecialProcessRow[] {
  const keyword = filters.keyword.trim().toLowerCase()

  return rows.filter((row) => {
    if (prefilter?.productionOrderId && !row.productionOrderIds.includes(prefilter.productionOrderId)) return false
    if (prefilter?.productionOrderNo && !row.productionOrderNos.includes(prefilter.productionOrderNo)) return false
    if (prefilter?.originalCutOrderId && !row.originalCutOrderIds.includes(prefilter.originalCutOrderId)) return false
    if (prefilter?.originalCutOrderNo && !row.originalCutOrderNos.includes(prefilter.originalCutOrderNo)) return false
    if (prefilter?.mergeBatchId && row.mergeBatchId !== prefilter.mergeBatchId) return false
    if (prefilter?.mergeBatchNo && row.mergeBatchNo !== prefilter.mergeBatchNo) return false
    if (prefilter?.processOrderId && row.processOrderId !== prefilter.processOrderId) return false
    if (prefilter?.processOrderNo && row.processOrderNo !== prefilter.processOrderNo) return false
    if (prefilter?.processType && row.processType !== prefilter.processType) return false
    if (prefilter?.styleCode && row.styleCode !== prefilter.styleCode) return false
    if (prefilter?.materialSku && row.materialSku !== prefilter.materialSku) return false

    if (keyword && !row.keywordIndex.some((item) => item.includes(keyword))) return false
    if (filters.processType !== 'ALL' && row.processType !== filters.processType) return false
    if (filters.status !== 'ALL' && row.status !== filters.status) return false
    if (filters.sourceType !== 'ALL' && row.sourceType !== filters.sourceType) return false
    return true
  })
}

export function findSpecialProcessByPrefilter(
  rows: SpecialProcessRow[],
  prefilter: SpecialProcessPrefilter | null,
): SpecialProcessRow | null {
  if (!prefilter) return null
  return (
    rows.find((row) => {
      if (prefilter.processOrderId && row.processOrderId === prefilter.processOrderId) return true
      if (prefilter.processOrderNo && row.processOrderNo === prefilter.processOrderNo) return true
      if (prefilter.productionOrderId && row.productionOrderIds.includes(prefilter.productionOrderId)) return true
      if (prefilter.productionOrderNo && row.productionOrderNos.includes(prefilter.productionOrderNo)) return true
      if (prefilter.originalCutOrderId && row.originalCutOrderIds.includes(prefilter.originalCutOrderId)) return true
      if (prefilter.originalCutOrderNo && row.originalCutOrderNos.includes(prefilter.originalCutOrderNo)) return true
      if (prefilter.mergeBatchId && row.mergeBatchId === prefilter.mergeBatchId) return true
      if (prefilter.mergeBatchNo && row.mergeBatchNo === prefilter.mergeBatchNo) return true
      if (prefilter.processType && row.processType === prefilter.processType) return true
      return false
    }) || null
  )
}

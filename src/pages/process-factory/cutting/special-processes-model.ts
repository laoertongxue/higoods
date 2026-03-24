import type { MergeBatchRecord } from './merge-batches-model'
import type { OriginalCutOrderRow } from './original-orders-model'

export const CUTTING_SPECIAL_PROCESS_ORDERS_STORAGE_KEY = 'cuttingSpecialProcessOrders'
export const CUTTING_SPECIAL_PROCESS_BINDING_PAYLOAD_STORAGE_KEY = 'cuttingSpecialProcessBindingPayloads'
export const CUTTING_SPECIAL_PROCESS_AUDIT_STORAGE_KEY = 'cuttingSpecialProcessAuditTrail'

export type SpecialProcessType = 'BINDING_STRIP' | 'WASH'
export type SpecialProcessSourceType = 'original-order' | 'merge-batch'
export type SpecialProcessStatusKey = 'DRAFT' | 'PENDING_EXECUTION' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
export type SpecialProcessAuditAction = 'CREATED' | 'UPDATED' | 'STATUS_CHANGED' | 'CANCELLED'

export interface SpecialProcessOrder {
  processOrderId: string
  processOrderNo: string
  processType: SpecialProcessType
  sourceType: SpecialProcessSourceType
  originalCutOrderIds: string[]
  originalCutOrderNos: string[]
  mergeBatchId: string
  mergeBatchNo: string
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
  originalCutOrderNo?: string
  mergeBatchNo?: string
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
  summary: Record<string, string | undefined>
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
  }
}

export const specialProcessTypeMeta: Record<SpecialProcessType, { label: string; className: string; detailText: string }> = {
  BINDING_STRIP: {
    label: '捆条工艺',
    className: 'bg-blue-100 text-blue-700',
    detailText: '当前正式启用，可独立建单并记录长度、宽度和产出。',
  },
  WASH: {
    label: '洗水（占位）',
    className: 'bg-slate-100 text-slate-700',
    detailText: '当前仅保留结构与入口占位，后续阶段启用。',
  },
}

export const specialProcessStatusMetaMap: Record<SpecialProcessStatusKey, SpecialProcessStatusMeta> = {
  DRAFT: { key: 'DRAFT', label: '草稿', className: 'bg-slate-100 text-slate-700', detailText: '工艺单草稿已创建，待补充参数。' },
  PENDING_EXECUTION: { key: 'PENDING_EXECUTION', label: '待执行', className: 'bg-amber-100 text-amber-700', detailText: '工艺单已确认，等待进入执行。' },
  IN_PROGRESS: { key: 'IN_PROGRESS', label: '执行中', className: 'bg-blue-100 text-blue-700', detailText: '工艺单正在执行，参数仍可补录。' },
  DONE: { key: 'DONE', label: '已完成', className: 'bg-emerald-100 text-emerald-700', detailText: '工艺单执行完成，可进入后续收口。' },
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

export function createBindingStripProcessDraft(options: {
  originalRows: OriginalCutOrderRow[]
  mergeBatches: MergeBatchRecord[]
  prefilter: SpecialProcessPrefilter | null
  existingCount: number
}): { order: SpecialProcessOrder; payload: BindingStripProcessPayload; audit: SpecialProcessAuditTrail } {
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
    productionOrderNos: uniqueStrings(matchedOriginals.map((row) => row.productionOrderNo)),
    styleCode: seed?.styleCode || options.prefilter?.styleCode || '',
    spuCode: seed?.spuCode || '',
    styleName: seed?.styleName || '',
    materialSku: options.prefilter?.materialSku || seed?.materialSku || '',
    status: 'DRAFT',
    createdAt: nowText(),
    createdBy: '工艺专员 叶晓青',
    note: mergeBatch ? '来源于合并裁剪批次预填，当前仍按原始裁片单回落关联。' : '来源于原始裁片单预填。',
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

  return {
    order,
    payload,
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
    return { ok: false, message: '洗水工艺当前仅做占位，后续阶段启用。' }
  }
  if (!options.payload) return { ok: false, message: '当前缺少捆条参数。' }
  if (options.payload.materialLength <= 0) return { ok: false, message: '请填写布料长度。' }
  if (options.payload.cutWidth <= 0) return { ok: false, message: '请填写裁剪宽度。' }
  if (options.payload.expectedQty <= 0) return { ok: false, message: '请填写预期数量。' }
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
  order: Pick<SpecialProcessOrder, 'originalCutOrderNos' | 'mergeBatchNo' | 'productionOrderNos' | 'styleCode' | 'materialSku'>,
): SpecialProcessNavigationPayload {
  return {
    originalOrders: {
      originalCutOrderNo: order.originalCutOrderNos[0] || undefined,
      productionOrderNo: order.productionOrderNos[0] || undefined,
      mergeBatchNo: order.mergeBatchNo || undefined,
      styleCode: order.styleCode || undefined,
      materialSku: order.materialSku || undefined,
    },
    mergeBatches: {
      mergeBatchNo: order.mergeBatchNo || undefined,
      originalCutOrderNo: order.originalCutOrderNos[0] || undefined,
    },
    summary: {
      mergeBatchNo: order.mergeBatchNo || undefined,
      originalCutOrderNo: order.originalCutOrderNos[0] || undefined,
      productionOrderNo: order.productionOrderNos[0] || undefined,
      styleCode: order.styleCode || undefined,
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
  audits: SpecialProcessAuditTrail[]
} {
  const original = originalRows[0]
  const batch = mergeBatches[0]
  const orders: SpecialProcessOrder[] = []
  const payloads: BindingStripProcessPayload[] = []
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
    orders.push(order)
    payloads.push({
      processOrderId: order.processOrderId,
      materialLength: 28,
      cutWidth: 3.2,
      expectedQty: Math.max(original.plannedQty, 20),
      actualQty: Math.max(original.plannedQty - 4, 0),
      operatorName: '陈工',
      note: '首轮捆条已完成，待复核余量。',
    })
    audits.push(
      buildSpecialProcessAuditTrail({
        processOrderId: order.processOrderId,
        action: 'CREATED',
        actionBy: order.createdBy,
        actionAt: order.createdAt,
        payloadSummary: `创建工艺单 ${order.processOrderNo}`,
        note: order.note,
      }),
    )
  }

  if (batch) {
    const order: SpecialProcessOrder = {
      processOrderId: 'sp-seed-wash-placeholder',
      processOrderNo: 'SP-20260324-002',
      processType: 'WASH',
      sourceType: 'merge-batch',
      originalCutOrderIds: batch.items.map((item) => item.originalCutOrderId),
      originalCutOrderNos: batch.items.map((item) => item.originalCutOrderNo),
      mergeBatchId: batch.mergeBatchId,
      mergeBatchNo: batch.mergeBatchNo,
      productionOrderNos: uniqueStrings(batch.items.map((item) => item.productionOrderNo)),
      styleCode: batch.styleCode,
      spuCode: batch.spuCode,
      styleName: batch.styleName,
      materialSku: batch.materialSkuSummary,
      status: 'DRAFT',
      createdAt: '2026-03-24 09:40',
      createdBy: '工艺专员 叶晓青',
      note: '洗水工艺当前仅做结构占位，后续阶段启用。',
    }
    orders.push(order)
    audits.push(
      buildSpecialProcessAuditTrail({
        processOrderId: order.processOrderId,
        action: 'CREATED',
        actionBy: order.createdBy,
        actionAt: order.createdAt,
        payloadSummary: `创建占位工艺单 ${order.processOrderNo}`,
        note: order.note,
      }),
    )
  }

  return { orders, payloads, audits }
}

export function buildSystemSeedSpecialProcessLedger(
  originalRows: OriginalCutOrderRow[],
  mergeBatches: MergeBatchRecord[],
): {
  orders: SpecialProcessOrder[]
  payloads: BindingStripProcessPayload[]
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
    return Array.isArray(parsed) ? parsed : []
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
    return Array.isArray(parsed) ? parsed : []
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
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function buildSpecialProcessViewModel(options: {
  originalRows: OriginalCutOrderRow[]
  mergeBatches: MergeBatchRecord[]
  orders: SpecialProcessOrder[]
  bindingPayloads: BindingStripProcessPayload[]
}): SpecialProcessViewModel {
  const seed = buildSystemSeedOrders(options.originalRows, options.mergeBatches)
  const orderMap = new Map<string, SpecialProcessOrder>()
  seed.orders.forEach((order) => orderMap.set(order.processOrderId, order))
  options.orders.forEach((order) => orderMap.set(order.processOrderId, order))

  const payloadMap = new Map<string, BindingStripProcessPayload>()
  seed.payloads.forEach((payload) => payloadMap.set(payload.processOrderId, payload))
  options.bindingPayloads.forEach((payload) => payloadMap.set(payload.processOrderId, payload))

  const rows = Array.from(orderMap.values())
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt, 'zh-CN'))
    .map((order) => {
      const statusMeta = deriveSpecialProcessStatus(order.status)
      const bindingPayload = payloadMap.get(order.processOrderId) || null
      const reservedPayload = buildReservedSpecialProcessPayload(order.processOrderId, order.processType)
      return {
        ...order,
        processTypeLabel: specialProcessTypeMeta[order.processType].label,
        sourceLabel: order.sourceType === 'merge-batch' ? '合并裁剪批次' : '原始裁片单',
        sourceSummary:
          order.sourceType === 'merge-batch'
            ? `来自批次 ${order.mergeBatchNo || '待补批次号'}，当前仍回落 ${order.originalCutOrderNos.length} 个原始裁片单。`
            : `来源原始裁片单 ${order.originalCutOrderNos[0] || '待补'}。`,
        statusMeta,
        bindingPayload,
        reservedPayload,
        navigationPayload: buildSpecialProcessNavigationPayload(order),
        keywordIndex: [
          order.processOrderNo,
          order.originalCutOrderNos.join(' '),
          order.mergeBatchNo,
          order.styleCode,
          order.spuCode,
          order.materialSku,
        ]
          .filter(Boolean)
          .map((item) => item.toLowerCase()),
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
    if (prefilter?.originalCutOrderNo && !row.originalCutOrderNos.includes(prefilter.originalCutOrderNo)) return false
    if (prefilter?.mergeBatchNo && row.mergeBatchNo !== prefilter.mergeBatchNo) return false
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
      if (prefilter.originalCutOrderNo && row.originalCutOrderNos.includes(prefilter.originalCutOrderNo)) return true
      if (prefilter.mergeBatchNo && row.mergeBatchNo === prefilter.mergeBatchNo) return true
      if (prefilter.processType && row.processType === prefilter.processType) return true
      return false
    }) || null
  )
}

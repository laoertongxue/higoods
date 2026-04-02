import type { CuttableOriginalOrderItem } from './cuttable-pool-model'

export const CUTTING_SELECTED_IDS_STORAGE_KEY = 'cuttingSelectedOriginalOrderIds'
export const CUTTING_SELECTED_COMPATIBILITY_KEY_STORAGE_KEY = 'cuttingSelectedCompatibilityKey'
export const CUTTING_MERGE_BATCH_LEDGER_STORAGE_KEY = 'cuttingMergeBatchLedger'

export type MergeBatchStatus = 'DRAFT' | 'READY' | 'CUTTING' | 'DONE' | 'CANCELLED'

export interface MergeBatchDraftForm {
  plannedCuttingGroup: string
  plannedCuttingDate: string
  note: string
}

export interface MergeBatchItem {
  mergeBatchId: string
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  styleCode: string
  spuCode: string
  styleName: string
  urgencyLabel: string
  plannedShipDate: string
  plannedShipDateDisplay: string
  materialSku: string
  materialCategory: string
  materialLabel: string
  currentStage: string
  cuttableStateLabel: string
  sourceCompatibilityKey: string
}

export interface MergeBatchRecord {
  mergeBatchId: string
  mergeBatchNo: string
  status: MergeBatchStatus
  compatibilityKey: string
  styleCode: string
  spuCode: string
  styleName: string
  materialSkuSummary: string
  sourceProductionOrderCount: number
  sourceOriginalCutOrderCount: number
  plannedCuttingGroup: string
  plannedCuttingDate: string
  note: string
  createdFrom: 'cuttable-pool' | 'system-seed'
  createdAt: string
  updatedAt: string
  items: MergeBatchItem[]
}

export interface MergeBatchSummary {
  sourceProductionOrderCount: number
  sourceOriginalCutOrderCount: number
  styleCode: string
  spuCode: string
  styleName: string
  compatibilityKey: string
  materialSkuSummary: string
  urgencySummary: string
  riskSummary: string
}

export interface MergeBatchSourceOriginalOrderItem {
  id: string
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  styleCode: string
  spuCode: string
  styleName: string
  urgencyLabel: string
  plannedShipDate: string
  plannedShipDateDisplay: string
  materialSku: string
  materialCategory: string
  materialLabel: string
  currentStage: string
  batchOccupancyStatus: string
  cuttableState: {
    label: string
    selectable: boolean
    key?: string
  }
  compatibilityKey: string
  mergeBatchNo: string
}

export interface HydratedIncomingBatchSelection {
  items: MergeBatchSourceOriginalOrderItem[]
  requestedIds: string[]
  missingIds: string[]
  compatibilityKey: string | null
}

export interface MergeBatchValidationResult {
  ok: boolean
  reasons: string[]
  compatibilityKey: string | null
  occupiedBatchNo?: string
}

export interface MergeBatchProductionOrderGroup {
  productionOrderId: string
  productionOrderNo: string
  styleCode: string
  styleName: string
  urgencyLabel: string
  plannedShipDateDisplay: string
  itemCount: number
  items: MergeBatchItem[]
}

function toDateTimeString(input: Date | string): string {
  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function toDateString(input: Date | string): string {
  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function buildMaterialSkuSummary(materialSkus: string[]): string {
  return uniqueStrings(materialSkus).join(' / ')
}

function batchRecordFromItems(options: {
  mergeBatchId: string
  mergeBatchNo: string
  status: MergeBatchStatus
  compatibilityKey: string
  items: MergeBatchSourceOriginalOrderItem[]
  plannedCuttingGroup: string
  plannedCuttingDate: string
  note: string
  createdFrom: 'cuttable-pool' | 'system-seed'
  createdAt: string
  updatedAt: string
}): MergeBatchRecord {
  const seed = options.items[0]
  const productionOrderIds = uniqueStrings(options.items.map((item) => item.productionOrderId))
  const batchItems: MergeBatchItem[] = options.items.map((item) => ({
    mergeBatchId: options.mergeBatchId,
    originalCutOrderId: item.originalCutOrderId,
    originalCutOrderNo: item.originalCutOrderNo,
    productionOrderId: item.productionOrderId,
    productionOrderNo: item.productionOrderNo,
    styleCode: item.styleCode,
    spuCode: item.spuCode,
    styleName: item.styleName,
    urgencyLabel: item.urgencyLabel,
    plannedShipDate: item.plannedShipDate,
    plannedShipDateDisplay: item.plannedShipDateDisplay,
    materialSku: item.materialSku,
    materialCategory: item.materialCategory,
    materialLabel: item.materialLabel,
    currentStage: item.currentStage,
    cuttableStateLabel: item.cuttableState.label,
    sourceCompatibilityKey: item.compatibilityKey,
  }))

  return {
    mergeBatchId: options.mergeBatchId,
    mergeBatchNo: options.mergeBatchNo,
    status: options.status,
    compatibilityKey: options.compatibilityKey,
    styleCode: seed?.styleCode ?? '',
    spuCode: seed?.spuCode ?? '',
    styleName: seed?.styleName ?? '',
    materialSkuSummary: buildMaterialSkuSummary(options.items.map((item) => item.materialSku)),
    sourceProductionOrderCount: productionOrderIds.length,
    sourceOriginalCutOrderCount: options.items.length,
    plannedCuttingGroup: options.plannedCuttingGroup,
    plannedCuttingDate: options.plannedCuttingDate,
    note: options.note,
    createdFrom: options.createdFrom,
    createdAt: options.createdAt,
    updatedAt: options.updatedAt,
    items: batchItems,
  }
}

function inferSystemBatchStatus(items: MergeBatchSourceOriginalOrderItem[]): MergeBatchStatus {
  if (items.some((item) => /已完成/.test(item.currentStage))) return 'DONE'
  if (items.some((item) => /裁片中|裁剪中|待入仓/.test(item.currentStage))) return 'CUTTING'
  return 'READY'
}

function parseBatchDateFromNo(mergeBatchNo: string): string {
  const match = mergeBatchNo.match(/(\d{2})(\d{2})(\d{2})/)
  if (!match) return ''
  return `20${match[1]}-${match[2]}-${match[3]}`
}

export function buildSystemSeedMergeBatches(items: MergeBatchSourceOriginalOrderItem[]): MergeBatchRecord[] {
  const bucket = new Map<string, MergeBatchSourceOriginalOrderItem[]>()

  for (const item of items) {
    if (!item.mergeBatchNo) continue
    const group = bucket.get(item.mergeBatchNo)
    if (group) {
      group.push(item)
    } else {
      bucket.set(item.mergeBatchNo, [item])
    }
  }

  return Array.from(bucket.entries())
    .map(([mergeBatchNo, groupItems]) =>
      batchRecordFromItems({
        mergeBatchId: `seed-${mergeBatchNo}`,
        mergeBatchNo,
        status: inferSystemBatchStatus(groupItems),
        compatibilityKey: groupItems[0]?.compatibilityKey ?? '',
        items: groupItems,
        plannedCuttingGroup: '',
        plannedCuttingDate: parseBatchDateFromNo(mergeBatchNo),
        note: '来源于当前原型中已有的批次占用记录。',
        createdFrom: 'system-seed',
        createdAt: `${parseBatchDateFromNo(mergeBatchNo)} 09:00`,
        updatedAt: `${parseBatchDateFromNo(mergeBatchNo)} 09:00`,
      }),
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt, 'zh-CN'))
}

export function hydrateIncomingSelectedOriginalCutOrders(
  itemsById: Record<string, MergeBatchSourceOriginalOrderItem>,
  storage: Pick<Storage, 'getItem'>,
): HydratedIncomingBatchSelection {
  let requestedIds: string[] = []
  const rawIds = storage.getItem(CUTTING_SELECTED_IDS_STORAGE_KEY)
  const compatibilityKey = storage.getItem(CUTTING_SELECTED_COMPATIBILITY_KEY_STORAGE_KEY)

  if (rawIds) {
    try {
      const parsed = JSON.parse(rawIds)
      if (Array.isArray(parsed)) {
        requestedIds = parsed.filter((value): value is string => typeof value === 'string')
      }
    } catch {
      requestedIds = []
    }
  }

  const items: MergeBatchSourceOriginalOrderItem[] = []
  const missingIds: string[] = []

  for (const id of requestedIds) {
    const item = itemsById[id]
    if (item) {
      items.push(item)
    } else {
      missingIds.push(id)
    }
  }

  return {
    items,
    requestedIds,
    missingIds,
    compatibilityKey: compatibilityKey || null,
  }
}

export function validateIncomingBatchSelection(
  incoming: HydratedIncomingBatchSelection,
  ledger: MergeBatchRecord[],
): MergeBatchValidationResult {
  const reasons: string[] = []

  if (!incoming.requestedIds.length) {
    reasons.push('当前没有收到来自可裁排产页的原始裁片单选择结果。')
  }

  if (incoming.missingIds.length) {
    reasons.push('部分原始裁片单在当前页面无法恢复，请返回可裁排产重新选择。')
  }

  if (!incoming.items.length) {
    return {
      ok: false,
      reasons,
      compatibilityKey: incoming.compatibilityKey,
    }
  }

  const compatibilityKeys = uniqueStrings(incoming.items.map((item) => item.compatibilityKey))
  if (incoming.compatibilityKey && compatibilityKeys.length === 1 && compatibilityKeys[0] !== incoming.compatibilityKey) {
    reasons.push('当前输入的兼容组与原始裁片单实际兼容组不一致。')
  }

  if (compatibilityKeys.length !== 1) {
    reasons.push('当前待建批次仅支持单一 compatibilityKey 的原始裁片单。')
  }

  const blockedItem = incoming.items.find((item) => item.cuttableState.key !== 'CUTTABLE')
  if (blockedItem) {
    reasons.push(`${blockedItem.originalCutOrderNo} 当前状态为“${blockedItem.cuttableState.label}”，不能创建合并裁剪批次。`)
  }

  const occupiedLookup = new Map<string, string>()
  for (const batch of ledger) {
    for (const item of batch.items) {
      occupiedLookup.set(item.originalCutOrderId, batch.mergeBatchNo)
    }
  }
  const occupiedItem = incoming.items.find((item) => occupiedLookup.has(item.originalCutOrderId))
  if (occupiedItem) {
    reasons.push(`${occupiedItem.originalCutOrderNo} 已进入批次 ${occupiedLookup.get(occupiedItem.originalCutOrderId)}，不能重复创建。`)
  }

  const styleKeys = uniqueStrings(incoming.items.map((item) => item.styleCode || item.spuCode))
  if (styleKeys.length !== 1) {
    reasons.push('当前待建批次只允许同款原始裁片单进入同一执行批次。')
  }

  return {
    ok: reasons.length === 0,
    reasons,
    compatibilityKey: compatibilityKeys[0] ?? incoming.compatibilityKey,
    occupiedBatchNo: occupiedItem ? occupiedLookup.get(occupiedItem.originalCutOrderId) : undefined,
  }
}

export function summarizeIncomingBatchSelection(items: MergeBatchSourceOriginalOrderItem[]): MergeBatchSummary {
  const productionOrderIds = uniqueStrings(items.map((item) => item.productionOrderId))
  const styleCodes = uniqueStrings(items.map((item) => item.styleCode))
  const spuCodes = uniqueStrings(items.map((item) => item.spuCode))
  const urgencies = uniqueStrings(items.map((item) => item.urgencyLabel))
  const riskTokens = uniqueStrings(items.flatMap((item) => (item.batchOccupancyStatus === 'IN_BATCH' ? ['已入批次'] : [])))

  return {
    sourceProductionOrderCount: productionOrderIds.length,
    sourceOriginalCutOrderCount: items.length,
    styleCode: styleCodes[0] ?? '',
    spuCode: spuCodes[0] ?? '',
    styleName: items[0]?.styleName ?? '',
    compatibilityKey: items[0]?.compatibilityKey ?? '',
    materialSkuSummary: buildMaterialSkuSummary(items.map((item) => item.materialSku)),
    urgencySummary: urgencies.join(' / ') || '常规',
    riskSummary: riskTokens.join(' / ') || '兼容组校验通过',
  }
}

export function buildMergeBatchNo(existingBatches: MergeBatchRecord[], now = new Date()): string {
  const dateKey = toDateString(now).replaceAll('-', '')
  const sameDayNumbers = existingBatches
    .map((batch) => batch.mergeBatchNo)
    .filter((batchNo) => batchNo.startsWith(`CUT-MB-${dateKey}`))
    .map((batchNo) => {
      const suffix = batchNo.split('-').pop() || '0'
      return Number.parseInt(suffix, 10)
    })
    .filter((value) => Number.isFinite(value))

  const nextSerial = Math.max(0, ...sameDayNumbers) + 1
  return `CUT-MB-${dateKey}-${String(nextSerial).padStart(3, '0')}`
}

export function createMergeBatchDraft(options: {
  items: MergeBatchSourceOriginalOrderItem[]
  form: MergeBatchDraftForm
  status: MergeBatchStatus
  existingBatches: MergeBatchRecord[]
  createdFrom?: 'cuttable-pool' | 'system-seed'
  now?: Date
}): MergeBatchRecord {
  const now = options.now ?? new Date()
  const mergeBatchId = `merge-batch-${now.getTime()}`
  const mergeBatchNo = buildMergeBatchNo(options.existingBatches, now)
  const summary = summarizeIncomingBatchSelection(options.items)

  return batchRecordFromItems({
    mergeBatchId,
    mergeBatchNo,
    status: options.status,
    compatibilityKey: summary.compatibilityKey,
    items: options.items,
    plannedCuttingGroup: options.form.plannedCuttingGroup.trim(),
    plannedCuttingDate: options.form.plannedCuttingDate,
    note: options.form.note.trim(),
    createdFrom: options.createdFrom ?? 'cuttable-pool',
    createdAt: toDateTimeString(now),
    updatedAt: toDateTimeString(now),
  })
}

export function mapCuttableItemsToMergeBatchSourceItems(
  items: CuttableOriginalOrderItem[],
): MergeBatchSourceOriginalOrderItem[] {
  return items.map((item) => ({
    id: item.id,
    originalCutOrderId: item.originalCutOrderId,
    originalCutOrderNo: item.originalCutOrderNo,
    productionOrderId: item.productionOrderId,
    productionOrderNo: item.productionOrderNo,
    styleCode: item.styleCode,
    spuCode: item.spuCode,
    styleName: item.styleName,
    urgencyLabel: item.urgencyLabel,
    plannedShipDate: item.plannedShipDate,
    plannedShipDateDisplay: item.plannedShipDateDisplay,
    materialSku: item.materialSku,
    materialCategory: item.materialCategory,
    materialLabel: item.materialLabel,
    currentStage: item.currentStage.label,
    batchOccupancyStatus: item.batchOccupancyStatus,
    cuttableState: {
      key: item.cuttableState.key,
      label: item.cuttableState.label,
      selectable: item.cuttableState.selectable,
    },
    compatibilityKey: item.compatibilityKey,
    mergeBatchNo: item.mergeBatchNo,
  }))
}

export function createDraftMergeBatchFromCuttableSelection(options: {
  items: CuttableOriginalOrderItem[]
  existingBatches: MergeBatchRecord[]
  now?: Date
}): MergeBatchRecord {
  return createMergeBatchDraft({
    items: mapCuttableItemsToMergeBatchSourceItems(options.items),
    form: {
      plannedCuttingGroup: '',
      plannedCuttingDate: '',
      note: '',
    },
    status: 'DRAFT',
    existingBatches: options.existingBatches,
    createdFrom: 'cuttable-pool',
    now: options.now,
  })
}

export function serializeMergeBatchStorage(records: MergeBatchRecord[]): string {
  return JSON.stringify(records)
}

export function deserializeMergeBatchStorage(raw: string | null): MergeBatchRecord[] {
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((record): record is MergeBatchRecord => {
      return Boolean(record && typeof record === 'object' && typeof record.mergeBatchId === 'string' && typeof record.mergeBatchNo === 'string')
    })
  } catch {
    return []
  }
}

export function groupMergeBatchItemsByProductionOrder(items: MergeBatchItem[]): MergeBatchProductionOrderGroup[] {
  const groupMap = new Map<string, MergeBatchProductionOrderGroup>()

  for (const item of items) {
    const existing = groupMap.get(item.productionOrderId)
    if (existing) {
      existing.itemCount += 1
      existing.items.push(item)
      continue
    }

    groupMap.set(item.productionOrderId, {
      productionOrderId: item.productionOrderId,
      productionOrderNo: item.productionOrderNo,
      styleCode: item.styleCode,
      styleName: item.styleName,
      urgencyLabel: item.urgencyLabel,
      plannedShipDateDisplay: item.plannedShipDateDisplay,
      itemCount: 1,
      items: [item],
    })
  }

  return Array.from(groupMap.values()).sort((left, right) => left.productionOrderNo.localeCompare(right.productionOrderNo, 'zh-CN'))
}

export function getMergeBatchStatusMeta(status: MergeBatchStatus): {
  label: string
  className: string
  helperText: string
} {
  if (status === 'READY') {
    return {
      label: '待裁',
      className: 'bg-blue-100 text-blue-700 border border-blue-200',
      helperText: '已完成批次建档，等待裁床正式执行。',
    }
  }

  if (status === 'CUTTING') {
    return {
      label: '裁剪中',
      className: 'bg-amber-100 text-amber-700 border border-amber-200',
      helperText: '批次已进入裁床执行上下文，但不改变原始裁片单归属。',
    }
  }

  if (status === 'DONE') {
    return {
      label: '已完成',
      className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
      helperText: '批次执行已完成，后续打印菲票与追溯仍回落原始裁片单。',
    }
  }

  if (status === 'CANCELLED') {
    return {
      label: '已取消',
      className: 'bg-rose-100 text-rose-700 border border-rose-200',
      helperText: '当前批次已作废，不再作为有效执行上下文。',
    }
  }

  return {
    label: '草稿',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
    helperText: '仅完成批次草稿建档，尚未进入正式待裁状态。',
  }
}

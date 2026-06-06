export const CUTTING_MARKER_PLAN_SOURCE_LEDGER_STORAGE_KEY = 'cuttingMarkerPlanSourceLedger'

export type MarkerPlanSourceStatus = 'DRAFT' | 'READY' | 'CUTTING' | 'DONE' | 'CANCELLED'
export type MarkerPlanSourceVisibleStatus = 'READY' | 'CUTTING' | 'DONE' | 'CANCELLED'

export interface MarkerPlanSourceDraftForm {
  plannedCuttingGroup: string
  plannedCuttingDate: string
  note: string
}

export interface MarkerPlanSourceItem {
  markerPlanId: string
  cutOrderId: string
  cutOrderNo: string
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
  sourceStageLabel: string
  sourceMarkerPlaningKey: string
}

export interface MarkerPlanSourceRecord {
  markerPlanId: string
  markerPlanNo: string
  status: MarkerPlanSourceStatus
  markerPlanGroupKey: string
  styleCode: string
  spuCode: string
  styleName: string
  materialSkuSummary: string
  sourceProductionOrderCount: number
  sourceCutOrderCount: number
  plannedCuttingGroup: string
  plannedCuttingDate: string
  note: string
  createdFrom: 'cut-order' | 'system-seed'
  createdAt: string
  updatedAt: string
  items: MarkerPlanSourceItem[]
}

export interface MarkerPlanSourceSummary {
  sourceProductionOrderCount: number
  sourceCutOrderCount: number
  styleCode: string
  spuCode: string
  styleName: string
  markerPlanGroupKey: string
  materialSkuSummary: string
  urgencySummary: string
  riskSummary: string
}

export interface MarkerPlanCutOrderSourceItem {
  id: string
  cutOrderId: string
  cutOrderNo: string
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
  markerPlanOccupancyStatus: string
  markerPlanGroupKey: string
  markerPlanNo: string
}

export interface MarkerPlanSourceProductionOrderGroup {
  productionOrderId: string
  productionOrderNo: string
  styleCode: string
  styleName: string
  urgencyLabel: string
  plannedShipDateDisplay: string
  itemCount: number
  items: MarkerPlanSourceItem[]
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

function markerPlanRecordFromItems(options: {
  markerPlanId: string
  markerPlanNo: string
  status: MarkerPlanSourceStatus
  markerPlanGroupKey: string
  items: MarkerPlanCutOrderSourceItem[]
  plannedCuttingGroup: string
  plannedCuttingDate: string
  note: string
  createdFrom: 'cut-order' | 'system-seed'
  createdAt: string
  updatedAt: string
}): MarkerPlanSourceRecord {
  const seed = options.items[0]
  const productionOrderIds = uniqueStrings(options.items.map((item) => item.productionOrderId))
  const markerPlanItems: MarkerPlanSourceItem[] = options.items.map((item) => ({
    markerPlanId: options.markerPlanId,
    cutOrderId: item.cutOrderId,
    cutOrderNo: item.cutOrderNo,
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
    sourceStageLabel: item.currentStage,
    sourceMarkerPlaningKey: item.markerPlanGroupKey,
  }))

  return {
    markerPlanId: options.markerPlanId,
    markerPlanNo: options.markerPlanNo,
    status: options.status,
    markerPlanGroupKey: options.markerPlanGroupKey,
    styleCode: seed?.styleCode ?? '',
    spuCode: seed?.spuCode ?? '',
    styleName: seed?.styleName ?? '',
    materialSkuSummary: buildMaterialSkuSummary(options.items.map((item) => item.materialSku)),
    sourceProductionOrderCount: productionOrderIds.length,
    sourceCutOrderCount: options.items.length,
    plannedCuttingGroup: options.plannedCuttingGroup,
    plannedCuttingDate: options.plannedCuttingDate,
    note: options.note,
    createdFrom: options.createdFrom,
    createdAt: options.createdAt,
    updatedAt: options.updatedAt,
    items: markerPlanItems,
  }
}

function inferSystemMarkerPlanStatus(items: MarkerPlanCutOrderSourceItem[]): MarkerPlanSourceStatus {
  if (items.some((item) => /已完成/.test(item.currentStage))) return 'DONE'
  if (items.some((item) => /裁片中|裁剪中|待入仓/.test(item.currentStage))) return 'CUTTING'
  return 'READY'
}

function parseMarkerPlanDateFromNo(markerPlanNo: string): string {
  const match = markerPlanNo.match(/(\d{2})(\d{2})(\d{2})/)
  if (!match) return ''
  return `20${match[1]}-${match[2]}-${match[3]}`
}

export function buildSystemSeedMarkerPlanSources(items: MarkerPlanCutOrderSourceItem[]): MarkerPlanSourceRecord[] {
  const bucket = new Map<string, MarkerPlanCutOrderSourceItem[]>()

  for (const item of items) {
    if (!item.markerPlanNo) continue
    const group = bucket.get(item.markerPlanNo)
    if (group) {
      group.push(item)
    } else {
      bucket.set(item.markerPlanNo, [item])
    }
  }

  return Array.from(bucket.entries())
    .map(([markerPlanNo, groupItems]) =>
      markerPlanRecordFromItems({
        markerPlanId: `seed-${markerPlanNo}`,
        markerPlanNo,
        status: inferSystemMarkerPlanStatus(groupItems),
        markerPlanGroupKey: groupItems[0]?.markerPlanGroupKey ?? '',
        items: groupItems,
        plannedCuttingGroup: '',
        plannedCuttingDate: parseMarkerPlanDateFromNo(markerPlanNo),
        note: '来源于当前原型中已有的唛架方案占用记录。',
        createdFrom: 'system-seed',
        createdAt: `${parseMarkerPlanDateFromNo(markerPlanNo)} 09:00`,
        updatedAt: `${parseMarkerPlanDateFromNo(markerPlanNo)} 09:00`,
      }),
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt, 'zh-CN'))
}

export function summarizeIncomingMarkerPlanSelection(items: MarkerPlanCutOrderSourceItem[]): MarkerPlanSourceSummary {
  const productionOrderIds = uniqueStrings(items.map((item) => item.productionOrderId))
  const styleCodes = uniqueStrings(items.map((item) => item.styleCode))
  const spuCodes = uniqueStrings(items.map((item) => item.spuCode))
  const urgencies = uniqueStrings(items.map((item) => item.urgencyLabel))
  const riskTokens = uniqueStrings(items.flatMap((item) => (item.markerPlanOccupancyStatus === 'IN_MARKER_PLAN' ? ['已入唛架方案'] : [])))

  return {
    sourceProductionOrderCount: productionOrderIds.length,
    sourceCutOrderCount: items.length,
    styleCode: styleCodes[0] ?? '',
    spuCode: spuCodes[0] ?? '',
    styleName: items[0]?.styleName ?? '',
    markerPlanGroupKey: items[0]?.markerPlanGroupKey ?? '',
    materialSkuSummary: buildMaterialSkuSummary(items.map((item) => item.materialSku)),
    urgencySummary: urgencies.join(' / ') || '常规',
    riskSummary: riskTokens.join(' / ') || '唛架方案组合校验通过',
  }
}

export function buildMarkerPlanSourceNo(existingMarkerPlans: MarkerPlanSourceRecord[], now = new Date()): string {
  const dateKey = toDateString(now).replaceAll('-', '')
  const sameDayNumbers = existingMarkerPlans
    .map((markerPlan) => markerPlan.markerPlanNo)
    .filter((batchNo) => batchNo.startsWith(`MKP-${dateKey}`))
    .map((batchNo) => {
      const suffix = batchNo.split('-').pop() || '0'
      return Number.parseInt(suffix, 10)
    })
    .filter((value) => Number.isFinite(value))

  const nextSerial = Math.max(0, ...sameDayNumbers) + 1
  return `MKP-${dateKey}-${String(nextSerial).padStart(3, '0')}`
}

export function createMarkerPlanSourceDraft(options: {
  items: MarkerPlanCutOrderSourceItem[]
  form: MarkerPlanSourceDraftForm
  status: MarkerPlanSourceStatus
  existingMarkerPlans: MarkerPlanSourceRecord[]
  createdFrom?: 'cut-order' | 'system-seed'
  now?: Date
}): MarkerPlanSourceRecord {
  const now = options.now ?? new Date()
  const markerPlanId = `marker-plan-${now.getTime()}`
  const markerPlanNo = buildMarkerPlanSourceNo(options.existingMarkerPlans, now)
  const summary = summarizeIncomingMarkerPlanSelection(options.items)

  return markerPlanRecordFromItems({
    markerPlanId,
    markerPlanNo,
    status: options.status,
    markerPlanGroupKey: summary.markerPlanGroupKey,
    items: options.items,
    plannedCuttingGroup: options.form.plannedCuttingGroup.trim(),
    plannedCuttingDate: options.form.plannedCuttingDate,
    note: options.form.note.trim(),
    createdFrom: options.createdFrom ?? 'cut-order',
    createdAt: toDateTimeString(now),
    updatedAt: toDateTimeString(now),
  })
}

export function normalizeMarkerPlanSourceStatus(status: MarkerPlanSourceStatus): MarkerPlanSourceVisibleStatus {
  if (status === 'DRAFT') {
    return 'READY'
  }
  return status
}

export function serializeMarkerPlanSourceStorage(records: MarkerPlanSourceRecord[]): string {
  return JSON['stringify'](records)
}

export function deserializeMarkerPlanSourceStorage(raw: string | null): MarkerPlanSourceRecord[] {
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((record): record is MarkerPlanSourceRecord => {
      return Boolean(record && typeof record === 'object' && typeof record.markerPlanId === 'string' && typeof record.markerPlanNo === 'string')
    })
  } catch {
    return []
  }
}

export function groupMarkerPlanSourceItemsByProductionOrder(items: MarkerPlanSourceItem[]): MarkerPlanSourceProductionOrderGroup[] {
  const groupMap = new Map<string, MarkerPlanSourceProductionOrderGroup>()

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

export function getMarkerPlanSourceStatusMeta(status: MarkerPlanSourceStatus): {
  label: string
  className: string
  helperText: string
} {
  const visibleStatus = normalizeMarkerPlanSourceStatus(status)

  if (visibleStatus === 'READY') {
    return {
      label: '待裁',
      className: 'bg-blue-100 text-blue-700 border border-blue-200',
      helperText: '已完成唛架方案建档，等待裁床正式执行。',
    }
  }

  if (visibleStatus === 'CUTTING') {
    return {
      label: '裁剪中',
      className: 'bg-amber-100 text-amber-700 border border-amber-200',
      helperText: '唛架方案已进入裁床执行上下文，但不改变裁片单归属。',
    }
  }

  if (visibleStatus === 'DONE') {
    return {
      label: '已完成',
      className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
      helperText: '唛架方案执行已完成，后续打印菲票与追溯仍回落裁片单。',
    }
  }

  if (visibleStatus === 'CANCELLED') {
    return {
      label: '已取消',
      className: 'bg-rose-100 text-rose-700 border border-rose-200',
      helperText: '当前唛架方案已作废，不再作为有效执行上下文。',
    }
  }

  return {
    label: '待裁',
    className: 'bg-blue-100 text-blue-700 border border-blue-200',
    helperText: '已完成唛架方案建档，等待裁床正式执行。',
  }
}

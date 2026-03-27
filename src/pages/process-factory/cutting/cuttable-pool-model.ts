import type {
  CuttingBatchOccupancyStatus,
  CuttingConfigStatus,
  CuttingMaterialLine,
  CuttingOrderProgressRecord,
  CuttingReceiveStatus,
  CuttingReviewStatus,
} from '../../../data/fcs/cutting/types'
import {
  listGeneratedOriginalCutOrderSourceRecords,
  type GeneratedOriginalCutOrderSourceRecord,
} from '../../../data/fcs/cutting/generated-original-cut-orders'
import {
  buildProductionProgressRows,
  type ProductionProgressRiskTag,
  type ProductionProgressRow,
  type ProductionProgressUrgencyKey,
} from './production-progress-model'

export type CuttableViewMode = 'STYLE_GROUP' | 'PRODUCTION_ORDER'
export type CuttableStateKey =
  | 'CUTTABLE'
  | 'WAITING_REVIEW'
  | 'WAITING_PREP'
  | 'PARTIAL_PREP'
  | 'WAITING_CLAIM'
  | 'PARTIAL_CLAIM'
  | 'CLAIM_EXCEPTION'
  | 'IN_BATCH'
  | 'NOT_READY'
export type CoverageStatusKey = 'FULL' | 'PARTIAL' | 'BLOCKED'

export interface CuttableSummaryMeta<Key extends string> {
  key: Key
  label: string
  className: string
  detailText: string
}

export interface CuttableOriginalOrderItem {
  id: string
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  styleCode: string
  spuCode: string
  styleName: string
  orderQty: number
  plannedShipDate: string
  plannedShipDateDisplay: string
  urgencyKey: ProductionProgressUrgencyKey
  urgencyLabel: string
  materialSku: string
  materialType: string
  materialLabel: string
  materialCategory: string
  materialAuditStatus: CuttingReviewStatus
  materialPrepStatus: CuttingConfigStatus
  materialClaimStatus: CuttingReceiveStatus
  currentStage: string
  cuttableState: CuttableSummaryMeta<CuttableStateKey> & {
    selectable: boolean
    reasonText: string
  }
  compatibilityKey: string
  batchOccupancyStatus: CuttingBatchOccupancyStatus
  mergeBatchNo: string
  latestActionText: string
  keywordIndex: string[]
}

export interface CuttableProductionOrderSummary {
  id: string
  productionOrderId: string
  productionOrderNo: string
  styleCode: string
  spuCode: string
  styleName: string
  urgency: ProductionProgressRow['urgency']
  orderQty: number
  plannedShipDate: string
  plannedShipDateDisplay: string
  cuttableOriginalOrderCount: number
  totalOriginalOrderCount: number
  coverageStatus: CuttableSummaryMeta<CoverageStatusKey>
  riskTags: ProductionProgressRiskTag[]
  items: CuttableOriginalOrderItem[]
  filterPayloadForOriginalOrders: {
    productionOrderId: string
    productionOrderNo: string
  }
  filterPayloadForMaterialPrep: {
    productionOrderId: string
    productionOrderNo: string
  }
}

export interface CuttableCompatibilityBucket {
  compatibilityKey: string
  materialSku: string
  cuttableCount: number
  totalCount: number
  productionOrderCount: number
}

export interface CuttableStyleGroup {
  styleCode: string
  spuCode: string
  styleName: string
  orders: CuttableProductionOrderSummary[]
  totalOrderCount: number
  totalOriginalOrderCount: number
  cuttableOriginalOrderCount: number
  fullOrderCount: number
  partialOrderCount: number
  blockedOrderCount: number
  compatibilityBuckets: CuttableCompatibilityBucket[]
}

export interface CuttablePoolViewModel {
  groups: CuttableStyleGroup[]
  orders: CuttableProductionOrderSummary[]
  itemsById: Record<string, CuttableOriginalOrderItem>
}

export interface CuttablePoolFilters {
  keyword: string
  urgencyLevel: 'ALL' | ProductionProgressUrgencyKey
  cuttableState: 'ALL' | CuttableStateKey
  coverageStatus: 'ALL' | CoverageStatusKey
  auditStatus: 'ALL' | CuttingReviewStatus
  configStatus: 'ALL' | CuttingConfigStatus
  receiveStatus: 'ALL' | CuttingReceiveStatus | 'EXCEPTION'
  onlySelected: boolean
  onlyCuttable: boolean
  onlyPartialOrders: boolean
  viewMode: CuttableViewMode
}

export interface CuttablePoolPrefilter {
  productionOrderId?: string
  productionOrderNo?: string
  styleCode?: string
  spuCode?: string
  urgencyLevel?: ProductionProgressUrgencyKey
  riskOnly?: boolean
}

export interface CuttablePoolStats {
  cuttableOriginalOrderCount: number
  fullProductionOrderCount: number
  partialProductionOrderCount: number
  blockedProductionOrderCount: number
  selectedOriginalOrderCount: number
  compatibilityBucketCount: number
}

export const cuttableStateMeta: Record<CuttableStateKey, { label: string; className: string }> = {
  CUTTABLE: { label: '可裁', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  WAITING_REVIEW: { label: '待审核', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  WAITING_PREP: { label: '待配料', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
  PARTIAL_PREP: { label: '部分配料', className: 'bg-orange-100 text-orange-700 border border-orange-200' },
  WAITING_CLAIM: { label: '待领料', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
  PARTIAL_CLAIM: { label: '部分领料', className: 'bg-sky-100 text-sky-700 border border-sky-200' },
  CLAIM_EXCEPTION: { label: '领料异常', className: 'bg-rose-100 text-rose-700 border border-rose-200' },
  IN_BATCH: { label: '已入批次', className: 'bg-violet-100 text-violet-700 border border-violet-200' },
  NOT_READY: { label: '暂不可裁', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
}

const coverageMeta: Record<CoverageStatusKey, { label: string; className: string }> = {
  FULL: { label: '整单可裁', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  PARTIAL: { label: '部分料可裁', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  BLOCKED: { label: '暂不可裁', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
}

function materialTypeLabel(materialType: string): string {
  if (materialType === 'PRINT') return '印花主料'
  if (materialType === 'DYE') return '染色主料'
  if (materialType === 'LINING') return '里辅料'
  return '主布 / 拼接料'
}

function buildKeywordIndex(values: Array<string | undefined>): string[] {
  return values
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())
}

function buildProgressLineFallback(source: GeneratedOriginalCutOrderSourceRecord): CuttingMaterialLine {
  return {
    originalCutOrderId: source.originalCutOrderId,
    originalCutOrderNo: source.originalCutOrderNo,
    cutPieceOrderNo: source.originalCutOrderNo,
    mergeBatchId: source.mergeBatchId,
    mergeBatchNo: source.mergeBatchNo,
    materialSku: source.materialSku,
    materialType: source.materialType,
    materialLabel: source.materialLabel,
    color: source.colorScope[0] || '待补',
    materialCategory: source.materialCategory,
    reviewStatus: 'PENDING',
    configStatus: 'NOT_CONFIGURED',
    receiveStatus: 'NOT_RECEIVED',
    configuredRollCount: 0,
    configuredLength: 0,
    receivedRollCount: 0,
    receivedLength: 0,
    printSlipStatus: 'NOT_PRINTED',
    qrStatus: 'NOT_GENERATED',
    batchOccupancyStatus: source.mergeBatchNo ? 'IN_BATCH' : 'AVAILABLE',
    skuScopeLines: source.skuScopeLines.map((line) => ({ ...line })),
    issueFlags: [],
    latestActionText: `原始裁片单 ${source.originalCutOrderNo} 已从生产单生成，待进入可裁判断。`,
  }
}

function createCuttableState(
  key: CuttableStateKey,
  detailText: string,
  reasonText = detailText,
): CuttableSummaryMeta<CuttableStateKey> & { selectable: boolean; reasonText: string } {
  const meta = cuttableStateMeta[key]
  return {
    key,
    label: meta.label,
    className: meta.className,
    detailText,
    selectable: key === 'CUTTABLE',
    reasonText,
  }
}

function createCoverageStatus(key: CoverageStatusKey, detailText: string): CuttableSummaryMeta<CoverageStatusKey> {
  const meta = coverageMeta[key]
  return {
    key,
    label: meta.label,
    className: meta.className,
    detailText,
  }
}

export function buildCompatibilityKey(source: {
  styleCode?: string
  spuCode?: string
  materialSku: string
}): string {
  const styleKey = source.styleCode || source.spuCode || 'UNKNOWN_STYLE'
  return `${styleKey}__${source.materialSku}`
}

export function deriveOriginalCutOrderCuttableState(
  line: CuttingMaterialLine,
  record: CuttingOrderProgressRecord,
): CuttableSummaryMeta<CuttableStateKey> & { selectable: boolean; reasonText: string } {
  if (line.batchOccupancyStatus === 'IN_BATCH') {
    return createCuttableState('IN_BATCH', `已占用：${line.mergeBatchNo || '当前批次'}`, '当前原始裁片单已进入合并裁剪批次')
  }

  if (record.hasSpreadingRecord || record.hasInboundRecord || /裁片中|裁剪中|待入仓|已完成/.test(record.cuttingStage)) {
    return createCuttableState('NOT_READY', '已进入裁剪后续', '当前原始裁片单已进入裁剪后续，不能再次加入可裁池')
  }

  if (line.reviewStatus === 'PENDING' || line.reviewStatus === 'PARTIAL') {
    return createCuttableState('WAITING_REVIEW', '审核未齐', '面料审核未完成，暂不可裁')
  }

  if (line.configStatus === 'NOT_CONFIGURED') {
    return createCuttableState('WAITING_PREP', '待完成配料', '仓库配料未完成，暂不可裁')
  }

  if (line.configStatus === 'PARTIAL') {
    return createCuttableState('PARTIAL_PREP', '配料未齐', '当前仅完成部分配料，需补齐后再裁')
  }

  if (line.issueFlags.includes('RECEIVE_DIFF')) {
    return createCuttableState('CLAIM_EXCEPTION', '领料存在差异', '领料现场存在差异，需复核后再裁')
  }

  if (line.receiveStatus === 'NOT_RECEIVED') {
    return createCuttableState('WAITING_CLAIM', '待完成领料', '尚未完成领料，暂不可裁')
  }

  if (line.receiveStatus === 'PARTIAL') {
    return createCuttableState('PARTIAL_CLAIM', '领料未齐', '当前仅完成部分领料，需补齐后再裁')
  }

  return createCuttableState('CUTTABLE', '审核 / 配料 / 领料均已到位', '当前原始裁片单满足可裁条件')
}

export function summarizeProductionOrderCoverageStatus(items: CuttableOriginalOrderItem[]): CuttableSummaryMeta<CoverageStatusKey> {
  const total = items.length
  const cuttableCount = items.filter((item) => item.cuttableState.key === 'CUTTABLE').length

  if (total > 0 && cuttableCount === total) {
    return createCoverageStatus('FULL', `${cuttableCount}/${total} 个原始裁片单可直接安排裁床`)
  }

  if (cuttableCount > 0) {
    return createCoverageStatus('PARTIAL', `${cuttableCount}/${total} 个原始裁片单当前可裁`)
  }

  return createCoverageStatus('BLOCKED', `当前 ${total} 个原始裁片单均未形成可裁条件`)
}

function buildCompatibilityBuckets(items: CuttableOriginalOrderItem[]): CuttableCompatibilityBucket[] {
  const bucketMap = new Map<
    string,
    CuttableCompatibilityBucket & {
      productionOrderSet: Set<string>
    }
  >()

  for (const item of items) {
    const existing = bucketMap.get(item.compatibilityKey)
    if (existing) {
      existing.totalCount += 1
      if (item.cuttableState.key === 'CUTTABLE') existing.cuttableCount += 1
      existing.productionOrderSet.add(item.productionOrderId)
      existing.productionOrderCount = existing.productionOrderSet.size
      continue
    }

    bucketMap.set(item.compatibilityKey, {
      compatibilityKey: item.compatibilityKey,
      materialSku: item.materialSku,
      cuttableCount: item.cuttableState.key === 'CUTTABLE' ? 1 : 0,
      totalCount: 1,
      productionOrderCount: 1,
      productionOrderSet: new Set([item.productionOrderId]),
    })
  }

  return Array.from(bucketMap.values())
    .map(({ productionOrderSet: _productionOrderSet, ...bucket }) => bucket)
    .sort((left, right) => right.cuttableCount - left.cuttableCount || left.materialSku.localeCompare(right.materialSku, 'zh-CN'))
}

function buildOriginalOrderItem(
  source: GeneratedOriginalCutOrderSourceRecord,
  record: CuttingOrderProgressRecord,
  line: CuttingMaterialLine,
  progressRow: ProductionProgressRow,
): CuttableOriginalOrderItem {
  const cuttableState = deriveOriginalCutOrderCuttableState(line, record)
  const compatibilityKey = buildCompatibilityKey({
    styleCode: record.styleCode,
    spuCode: record.spuCode,
    materialSku: source.materialSku,
  })

  return {
    id: source.originalCutOrderId,
    originalCutOrderId: source.originalCutOrderId,
    originalCutOrderNo: source.originalCutOrderNo,
    productionOrderId: source.productionOrderId,
    productionOrderNo: source.productionOrderNo,
    styleCode: record.styleCode,
    spuCode: record.spuCode,
    styleName: record.styleName,
    orderQty: record.orderQty,
    plannedShipDate: record.plannedShipDate,
    plannedShipDateDisplay: record.plannedShipDate || '待补日期',
    urgencyKey: progressRow.urgency.key,
    urgencyLabel: progressRow.urgency.label,
    materialSku: source.materialSku,
    materialType: source.materialType,
    materialLabel: source.materialLabel,
    materialCategory: source.materialCategory || materialTypeLabel(source.materialType),
    materialAuditStatus: line.reviewStatus,
    materialPrepStatus: line.configStatus,
    materialClaimStatus: line.receiveStatus,
    currentStage: record.cuttingStage,
    cuttableState,
    compatibilityKey,
    batchOccupancyStatus: line.batchOccupancyStatus ?? 'AVAILABLE',
    mergeBatchNo: line.mergeBatchNo ?? '',
    latestActionText: line.latestActionText,
    keywordIndex: buildKeywordIndex([
      source.productionOrderNo,
      source.productionOrderId,
      record.styleCode,
      record.spuCode,
      record.styleName,
      source.originalCutOrderNo,
      source.materialSku,
      source.materialLabel,
      source.materialType,
    ]),
  }
}

function sortOrders(left: CuttableProductionOrderSummary, right: CuttableProductionOrderSummary): number {
  return (
    right.urgency.sortWeight - left.urgency.sortWeight ||
    left.plannedShipDateDisplay.localeCompare(right.plannedShipDateDisplay, 'zh-CN') ||
    left.productionOrderNo.localeCompare(right.productionOrderNo, 'zh-CN')
  )
}

export function buildCuttablePoolViewModel(
  records: CuttingOrderProgressRecord[],
  options: {
    progressRows?: ProductionProgressRow[]
  } = {},
): CuttablePoolViewModel {
  const progressRows = options.progressRows ?? buildProductionProgressRows(records)
  const progressRowMap = new Map(progressRows.map((row) => [row.id, row]))
  const recordMap = new Map(records.map((record) => [record.productionOrderId, record] as const))
  const generatedRowsByOrder = new Map<string, GeneratedOriginalCutOrderSourceRecord[]>()
  const lineMap = new Map<string, CuttingMaterialLine>()
  listGeneratedOriginalCutOrderSourceRecords().forEach((row) => {
    const current = generatedRowsByOrder.get(row.productionOrderId) ?? []
    current.push(row)
    generatedRowsByOrder.set(row.productionOrderId, current)
  })
  records.forEach((record) => {
    record.materialLines.forEach((line) => {
      const key = line.originalCutOrderId || line.originalCutOrderNo || line.cutPieceOrderNo
      if (key) lineMap.set(key, line)
    })
  })
  const itemsById: Record<string, CuttableOriginalOrderItem> = {}

  const orders = progressRows
    .map((progressRow) => {
      const record = recordMap.get(progressRow.productionOrderId)
      if (!progressRow) return null
      if (!record) return null

      const items = (generatedRowsByOrder.get(record.productionOrderId) ?? []).map((source) =>
        buildOriginalOrderItem(source, record, lineMap.get(source.originalCutOrderId) || buildProgressLineFallback(source), progressRow),
      )
      for (const item of items) {
        itemsById[item.id] = item
      }

      return {
        id: record.id,
        productionOrderId: record.productionOrderId,
        productionOrderNo: record.productionOrderNo,
        styleCode: record.styleCode,
        spuCode: record.spuCode,
        styleName: record.styleName,
        urgency: progressRow.urgency,
        orderQty: record.orderQty,
        plannedShipDate: record.plannedShipDate,
        plannedShipDateDisplay: progressRow.plannedShipDateDisplay,
        cuttableOriginalOrderCount: items.filter((item) => item.cuttableState.key === 'CUTTABLE').length,
        totalOriginalOrderCount: items.length,
        coverageStatus: summarizeProductionOrderCoverageStatus(items),
        riskTags: progressRow.riskTags,
        items,
        filterPayloadForOriginalOrders: progressRow.filterPayloadForOriginalOrders,
        filterPayloadForMaterialPrep: progressRow.filterPayloadForMaterialPrep,
      }
    })
    .filter((order): order is CuttableProductionOrderSummary => order !== null)
    .sort(sortOrders)

  const groupMap = new Map<string, CuttableProductionOrderSummary[]>()
  for (const order of orders) {
    const groupKey = order.styleCode || order.spuCode || order.productionOrderNo
    const group = groupMap.get(groupKey)
    if (group) {
      group.push(order)
    } else {
      groupMap.set(groupKey, [order])
    }
  }

  const groups = Array.from(groupMap.entries())
    .map(([groupKey, groupOrders]) => {
      const seed = groupOrders[0]
      const items = groupOrders.flatMap((order) => order.items)
      const fullOrderCount = groupOrders.filter((order) => order.coverageStatus.key === 'FULL').length
      const partialOrderCount = groupOrders.filter((order) => order.coverageStatus.key === 'PARTIAL').length
      const blockedOrderCount = groupOrders.filter((order) => order.coverageStatus.key === 'BLOCKED').length

      return {
        styleCode: seed.styleCode || groupKey,
        spuCode: seed.spuCode,
        styleName: seed.styleName,
        orders: groupOrders.sort(sortOrders),
        totalOrderCount: groupOrders.length,
        totalOriginalOrderCount: items.length,
        cuttableOriginalOrderCount: items.filter((item) => item.cuttableState.key === 'CUTTABLE').length,
        fullOrderCount,
        partialOrderCount,
        blockedOrderCount,
        compatibilityBuckets: buildCompatibilityBuckets(items),
      }
    })
    .sort((left, right) => {
      const leftMaxUrgency = Math.max(...left.orders.map((order) => order.urgency.sortWeight))
      const rightMaxUrgency = Math.max(...right.orders.map((order) => order.urgency.sortWeight))
      return rightMaxUrgency - leftMaxUrgency || left.styleCode.localeCompare(right.styleCode, 'zh-CN')
    })

  return {
    groups,
    orders,
    itemsById,
  }
}

function matchesKeyword(item: CuttableOriginalOrderItem, keyword: string): boolean {
  if (!keyword) return true
  return item.keywordIndex.some((value) => value.includes(keyword))
}

function matchesReceiveFilter(item: CuttableOriginalOrderItem, value: CuttablePoolFilters['receiveStatus']): boolean {
  if (value === 'ALL') return true
  if (value === 'EXCEPTION') return item.cuttableState.key === 'CLAIM_EXCEPTION'
  return item.materialClaimStatus === value
}

function hasItemScopedFilter(filters: CuttablePoolFilters): boolean {
  return (
    !!filters.keyword.trim() ||
    filters.cuttableState !== 'ALL' ||
    filters.auditStatus !== 'ALL' ||
    filters.configStatus !== 'ALL' ||
    filters.receiveStatus !== 'ALL' ||
    filters.onlySelected ||
    filters.onlyCuttable
  )
}

function matchesPrefilter(item: CuttableOriginalOrderItem, order: CuttableProductionOrderSummary, group: CuttableStyleGroup, prefilter: CuttablePoolPrefilter | null): boolean {
  if (!prefilter) return true
  if (prefilter.productionOrderId && order.productionOrderId !== prefilter.productionOrderId) return false
  if (prefilter.productionOrderNo && order.productionOrderNo !== prefilter.productionOrderNo) return false
  if (prefilter.styleCode && group.styleCode !== prefilter.styleCode) return false
  if (prefilter.spuCode && group.spuCode !== prefilter.spuCode) return false
  if (prefilter.urgencyLevel && order.urgency.key !== prefilter.urgencyLevel) return false
  if (prefilter.riskOnly && order.riskTags.length === 0) return false
  return true
}

export function filterCuttablePoolGroups(
  viewModel: CuttablePoolViewModel,
  filters: CuttablePoolFilters,
  selectedIds: string[],
  prefilter: CuttablePoolPrefilter | null,
): CuttableStyleGroup[] {
  const selectedIdSet = new Set(selectedIds)
  const keyword = filters.keyword.trim().toLowerCase()
  const itemScopedFilter = hasItemScopedFilter(filters)

  return viewModel.groups
    .map((group) => {
      const orders = group.orders
        .map((order) => {
          if (filters.urgencyLevel !== 'ALL' && order.urgency.key !== filters.urgencyLevel) return null
          if (filters.coverageStatus !== 'ALL' && order.coverageStatus.key !== filters.coverageStatus) return null
          if (filters.onlyPartialOrders && order.coverageStatus.key !== 'PARTIAL') return null
          if (prefilter && !order.items.some((item) => matchesPrefilter(item, order, group, prefilter))) return null

          const visibleItems = order.items.filter((item) => {
            if (!matchesPrefilter(item, order, group, prefilter)) return false
            if (!matchesKeyword(item, keyword)) return false
            if (filters.cuttableState !== 'ALL' && item.cuttableState.key !== filters.cuttableState) return false
            if (filters.auditStatus !== 'ALL' && item.materialAuditStatus !== filters.auditStatus) return false
            if (filters.configStatus !== 'ALL' && item.materialPrepStatus !== filters.configStatus) return false
            if (!matchesReceiveFilter(item, filters.receiveStatus)) return false
            if (filters.onlySelected && !selectedIdSet.has(item.id)) return false
            if (filters.onlyCuttable && item.cuttableState.key !== 'CUTTABLE') return false
            return true
          })

          if (itemScopedFilter && visibleItems.length === 0) return null

          return {
            ...order,
            items: itemScopedFilter ? visibleItems : order.items.filter((item) => matchesPrefilter(item, order, group, prefilter)),
          }
        })
        .filter((order): order is CuttableProductionOrderSummary => order !== null)

      if (!orders.length) return null

      const visibleItems = orders.flatMap((order) => order.items)
      return {
        ...group,
        orders,
        totalOrderCount: orders.length,
        totalOriginalOrderCount: visibleItems.length,
        cuttableOriginalOrderCount: visibleItems.filter((item) => item.cuttableState.key === 'CUTTABLE').length,
        fullOrderCount: orders.filter((order) => order.coverageStatus.key === 'FULL').length,
        partialOrderCount: orders.filter((order) => order.coverageStatus.key === 'PARTIAL').length,
        blockedOrderCount: orders.filter((order) => order.coverageStatus.key === 'BLOCKED').length,
        compatibilityBuckets: buildCompatibilityBuckets(visibleItems),
      }
    })
    .filter((group): group is CuttableStyleGroup => group !== null)
}

export function buildCuttablePoolStats(groups: CuttableStyleGroup[], selectedIds: string[]): CuttablePoolStats {
  const orders = groups.flatMap((group) => group.orders)
  const items = orders.flatMap((order) => order.items)
  const compatibilityBucketCount = groups.flatMap((group) => group.compatibilityBuckets).filter((bucket) => bucket.cuttableCount > 0).length

  return {
    cuttableOriginalOrderCount: items.filter((item) => item.cuttableState.key === 'CUTTABLE').length,
    fullProductionOrderCount: orders.filter((order) => order.coverageStatus.key === 'FULL').length,
    partialProductionOrderCount: orders.filter((order) => order.coverageStatus.key === 'PARTIAL').length,
    blockedProductionOrderCount: orders.filter((order) => order.coverageStatus.key === 'BLOCKED').length,
    selectedOriginalOrderCount: selectedIds.length,
    compatibilityBucketCount,
  }
}

export function areOriginalCutOrdersCompatibleForBatching(items: CuttableOriginalOrderItem[]): {
  ok: boolean
  compatibilityKey: string | null
  reason?: string
} {
  if (!items.length) {
    return { ok: false, compatibilityKey: null, reason: '请先选择至少 1 条可裁原始裁片单。' }
  }

  const nonCuttable = items.find((item) => item.cuttableState.key !== 'CUTTABLE')
  if (nonCuttable) {
    return {
      ok: false,
      compatibilityKey: null,
      reason: `${nonCuttable.originalCutOrderNo} 当前状态为“${nonCuttable.cuttableState.label}”，不能进入合并裁剪批次。`,
    }
  }

  const compatibilityKeys = Array.from(new Set(items.map((item) => item.compatibilityKey)))
  if (compatibilityKeys.length !== 1) {
    return {
      ok: false,
      compatibilityKey: null,
      reason: '当前已选清单仅支持同一兼容组的原始裁片单，请清空后重新选择。',
    }
  }

  return {
    ok: true,
    compatibilityKey: compatibilityKeys[0],
  }
}

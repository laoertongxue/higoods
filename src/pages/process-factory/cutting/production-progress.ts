// production-progress 是 canonical 页面文件。
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import { formatFactoryDisplayName } from '../../../data/fcs/factory-mock-data.ts'
import {
  CUTTING_REPLENISHMENT_PENDING_PREP_STORAGE_KEY,
  deserializeReplenishmentPendingPrepStorage,
  type ReplenishmentPendingPrepFollowupRecord,
} from '../../../data/fcs/cutting/storage/replenishment-storage.ts'
import type { CuttingCanonicalPageKey } from './meta.ts'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, isCuttingAliasPath, renderCuttingPageHeader } from './meta.ts'
import {
  buildProductionProgressSummary,
  configMeta,
  filterProductionProgressRows,
  formatQty,
  receiveMeta,
  riskMeta,
  shipDeltaRangeMeta,
  sortProductionProgressRows,
  stageMeta,
  type ProductionProgressFilters,
  type ProductionProgressRow,
  type ProductionProgressSortKey,
  type ProductionProgressViewDimension,
  urgencyMeta,
} from './production-progress-model.ts'
import {
  paginateItems,
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchPagination,
  renderWorkbenchStateBar,
} from './layout.helpers.ts'
import { renderMaterialIdentityBlock } from './material-identity.ts'
import {
  buildCuttingDrillChipLabels,
  buildCuttingDrillSummary,
  buildCuttingRouteWithContext,
  buildReturnToSummaryContext,
  hasSummaryReturnContext,
  buildCuttingDrillContext,
  readCuttingDrillContextFromLocation,
  type CuttingDrillContext,
  type CuttingNavigationTarget,
} from './navigation-context.ts'
import { buildProductionProgressProjection } from './production-progress-projection.ts'
import { buildSampleWarehouseProjection } from './sample-warehouse-projection.ts'
import type { SampleWarehouseItem } from './sample-warehouse-model.ts'
import {
  getCuttingProgressSnapshots,
  getCuttingSpecialCraftReturnStatusByProductionOrders,
  type CuttingSpecialCraftReturnStatusSummary,
} from '../../../data/fcs/progress-statistics-linkage.ts'
import {
  getCuttingSewingDispatchProgressByProductionOrder as getRuntimeSewingDispatchProgressByProductionOrder,
  listAvailableCutPieceInventoryForSewingDispatch,
  listCuttingSewingDispatchBatches,
  listCuttingSewingDispatchOrders,
  listCuttingSewingTransferBags,
} from '../../../data/fcs/cutting/sewing-dispatch.ts'
import {
  listMaterialLedgerProjectionsByProductionOrderId,
  type MaterialLedgerProjection,
} from '../../../data/fcs/cutting/material-ledger.ts'
import { buildCutOrderCloseRecordLookup } from '../../../data/fcs/cutting/cut-order-close-records'
import { listSpreadingDifferencesByProductionOrder } from '../../../data/fcs/cutting/spreading-differences.ts'
import { buildMarkerSpreadingProjection, type MarkerSpreadingProjection } from './marker-spreading-projection.ts'
import { type SpreadingOrder } from './marker-spreading-model.ts'

type ProductionProgressQuickFilter = 'URGENT_ONLY' | 'PREP_DELAY' | 'CLAIM_EXCEPTION' | 'CUTTING_ACTIVE'
type ProductionProgressQuickFilterExtended =
  | ProductionProgressQuickFilter
  | 'INCOMPLETE_ONLY'
  | 'GAP_ONLY'
  | 'MAPPING_MISSING'
  | 'REPLENISH_GAP'
type FilterField =
  | 'keyword'
  | 'production-order'
  | 'urgency'
  | 'ship-delta'
  | 'stage'
  | 'completion'
  | 'config'
  | 'claim'
  | 'risk'
  | 'sort'

const FIELD_TO_FILTER_KEY: Record<FilterField, keyof ProductionProgressFilters> = {
  keyword: 'keyword',
  'production-order': 'productionOrderNo',
  urgency: 'urgencyLevel',
  'ship-delta': 'shipDeltaRange',
  stage: 'currentStage',
  completion: 'completionState',
  config: 'configStatus',
  claim: 'receiveStatus',
  risk: 'riskFilter',
  sort: 'sortBy',
}

const initialFilters: ProductionProgressFilters = {
  keyword: '',
  productionOrderNo: '',
  urgencyLevel: 'ALL',
  shipDeltaRange: 'ALL',
  currentStage: 'ALL',
  completionState: 'ALL',
  configStatus: 'ALL',
  receiveStatus: 'ALL',
  riskFilter: 'ALL',
  sortBy: 'URGENCY_THEN_SHIP',
}

interface ProductionProgressPageState {
  filters: ProductionProgressFilters
  viewDimension: ProductionProgressViewDimension
  activeQuickFilter: ProductionProgressQuickFilterExtended | null
  activeDetailId: string | null
  drillContext: CuttingDrillContext | null
  querySignature: string
  page: number
  pageSize: number
}

interface CutOrderDimensionRow {
  rowId: string
  parentRowId: string
  cutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  styleLabel: string
  styleName: string
  materialSku: string
  materialAlias: string
  materialImageUrl: string
  factoryName: string
  relatedQty: number
  quantityLedger: MaterialQuantityLedgerLine
  plannedShipDateDisplay: string
  urgencyLabel: string
  urgencyClassName: string
  mainStatusLabel: string
  mainStatusClassName: string
  closeReasonText: string
  closeReason: string
  closedAt: string
  cuttableLabel: string
  cuttableClassName: string
  cuttableReasonText: string
  markerRelationText: string
  operationResultText: string
  feiTicketLabel: string
  feiTicketClassName: string
  specialCraftReturnLabel: string
  specialCraftReturnDetail: string
  sewingDispatchLabel: string
  sewingDispatchDetail: string
  pendingDifferenceCount: number
  blockingText: string
  parentRecordId: string
}

type MaterialQuantityLedgerLine = MaterialLedgerProjection

interface ProductionPartFlowLine {
  lineId: string
  skuLabel: string
  color: string
  size: string
  partName: string
  requiredPieceQty: number
  actualCutQty: number
  waitHandoverStockQty: number
  assignedPieceQty: number
  handedOverPieceQty: number
  gapPieceQty: number
  sourceCutOrderNo: string
}

const state: ProductionProgressPageState = {
  filters: { ...initialFilters },
  viewDimension: 'CUT_ORDER',
  activeQuickFilter: null,
  activeDetailId: null,
  drillContext: null,
  querySignature: '',
  page: 1,
  pageSize: 20,
}

function getAllRows(): ProductionProgressRow[] {
  return buildProductionProgressProjection().rows
}

function buildStateBadgeClass(label: string): string {
  if (label.includes('已') || label.includes('核对') || label.includes('可发')) {
    return 'bg-emerald-100 text-emerald-700'
  }
  if (label.includes('差异') || label.includes('异议') || label.includes('异常')) {
    return 'bg-rose-100 text-rose-700'
  }
  if (label.includes('加工中') || label.includes('进行中') || label.includes('部分') || label.includes('回写')) {
    return 'bg-blue-100 text-blue-700'
  }
  return 'bg-amber-100 text-amber-700'
}

function getCuttingSnapshotForRow(row: ProductionProgressRow) {
  return getCuttingProgressSnapshots().find((item) => item.productionOrderId === row.productionOrderId)
}

function makePartFlowKey(input: { color?: string; size?: string; sizeCode?: string; partName?: string }): string {
  return [input.color || '', input.size || input.sizeCode || '', input.partName || '']
    .map((item) => String(item || '').trim().toLowerCase())
    .join('::')
}

function createEmptyPartFlowLine(row: ProductionProgressRow, input: {
  color?: string
  size?: string
  sizeCode?: string
  partName?: string
  skuLabel?: string
  sourceCutOrderNo?: string
}): ProductionPartFlowLine {
  const color = input.color || ''
  const size = input.size || input.sizeCode || ''
  const partName = input.partName || '裁片'
  return {
    lineId: `${row.productionOrderId}::${makePartFlowKey({ color, size, partName })}`,
    skuLabel: input.skuLabel || [color, size].filter(Boolean).join(' / ') || '未命名 SKU',
    color,
    size,
    partName,
    requiredPieceQty: 0,
    actualCutQty: 0,
    waitHandoverStockQty: 0,
    assignedPieceQty: 0,
    handedOverPieceQty: 0,
    gapPieceQty: 0,
    sourceCutOrderNo: input.sourceCutOrderNo || '',
  }
}

function buildProductionPartFlowLines(row: ProductionProgressRow): ProductionPartFlowLine[] {
  const grouped = new Map<string, ProductionPartFlowLine>()
  const upsert = (input: {
    color?: string
    size?: string
    sizeCode?: string
    partName?: string
    skuLabel?: string
    sourceCutOrderNo?: string
  }): ProductionPartFlowLine => {
    const key = makePartFlowKey(input)
    const current = grouped.get(key) || createEmptyPartFlowLine(row, input)
    grouped.set(key, current)
    return current
  }

  row.pieceTruth.gapRows.forEach((item) => {
    const current = upsert({
      color: item.color,
      size: item.size,
      partName: item.partName,
      skuLabel: item.skuCode || [item.color, item.size].filter(Boolean).join(' / '),
      sourceCutOrderNo: resolveGapRowCutOrderNo(row, item),
    })
    current.requiredPieceQty += Number(item.requiredPieceQty || 0)
    current.actualCutQty += Number(item.actualCutQty || 0)
    current.sourceCutOrderNo = current.sourceCutOrderNo || resolveGapRowCutOrderNo(row, item)
  })

  listAvailableCutPieceInventoryForSewingDispatch({ productionOrderId: row.productionOrderId }).forEach((item) => {
    const current = upsert({
      color: item.colorName,
      size: item.sizeCode,
      partName: item.partName,
      skuLabel: [item.colorName, item.sizeCode].filter(Boolean).join(' / '),
      sourceCutOrderNo: item.cutOrderNos.join('、'),
    })
    current.waitHandoverStockQty += Number(item.availablePieceQty || 0)
    current.sourceCutOrderNo = current.sourceCutOrderNo || item.cutOrderNos.join('、')
  })

  const handoverBagStatuses = new Set(['已交出', '已回写', '差异', '异议中'])
  listCuttingSewingTransferBags()
    .filter((bag) => bag.productionOrderId === row.productionOrderId)
    .forEach((bag) => {
      const isHandedOver = handoverBagStatuses.has(bag.status)
      bag.pieceLines.forEach((line) => {
        const current = upsert({
          color: line.colorName,
          size: line.sizeCode,
          partName: line.partName,
          skuLabel: [line.colorName, line.sizeCode].filter(Boolean).join(' / '),
          sourceCutOrderNo: bag.cuttingOrderNos.join('、'),
        })
        current.assignedPieceQty += Number(line.scannedPieceQty || 0)
        if (isHandedOver) current.handedOverPieceQty += Number(line.scannedPieceQty || 0)
      })
    })

  return Array.from(grouped.values())
    .map((item) => {
      const availableAfterCut = Math.max(item.actualCutQty, item.waitHandoverStockQty + item.assignedPieceQty)
      return {
        ...item,
        gapPieceQty: item.requiredPieceQty > 0 ? Math.max(item.requiredPieceQty - availableAfterCut, 0) : 0,
      }
    })
    .sort((left, right) =>
      `${left.skuLabel}-${left.partName}`.localeCompare(`${right.skuLabel}-${right.partName}`, 'zh-CN'),
    )
}

function formatBundleSummary(lengthValues: number[], widthValues: number[]): string {
  if (!lengthValues.length && !widthValues.length) return ''
  const lengthText = lengthValues.length ? `长 ${lengthValues.join(' / ')} 厘米` : ''
  const widthText = widthValues.length ? `宽 ${widthValues.join(' / ')} 厘米` : ''
  return [lengthText, widthText].filter(Boolean).join(' · ')
}

function getCutOrderRelatedQty(row: ProductionProgressRow, cutOrderNo: string, materialSku: string): number {
  const skuQtyMap = new Map<string, number>()
  row.pieceTruth.requirementRows
    .filter((item) => item.cutOrderNo === cutOrderNo && item.materialSku === materialSku)
    .forEach((item) => {
      const skuKey = [item.skuCode, item.color, item.size].join('::')
      const current = skuQtyMap.get(skuKey) || 0
      skuQtyMap.set(skuKey, Math.max(current, item.requiredGarmentQty))
    })
  return Array.from(skuQtyMap.values()).reduce((sum, value) => sum + value, 0)
}

function findProgressMaterialIdentity(row: ProductionProgressRow, materialSku: string) {
  return (
    row.materialPrepLines.find((line) => line.materialSku === materialSku)
    || row.materialClaimLines.find((line) => line.materialSku === materialSku)
    || row.sourceOrderProgressLines.find((line) => line.materialSku === materialSku)
    || null
  )
}

function buildMaterialQuantityLedgerLines(
  row: ProductionProgressRow,
  cutOrderNo?: string,
  materialSku?: string,
): MaterialQuantityLedgerLine[] {
  return listMaterialLedgerProjectionsByProductionOrderId(row.productionOrderId)
    .filter((line) => !cutOrderNo || line.cutOrderNo === cutOrderNo || line.cutOrderId === cutOrderNo)
    .filter((line) => !materialSku || line.materialIdentity.materialSku === materialSku)
    .sort((left, right) => left.materialIdentity.materialSku.localeCompare(right.materialIdentity.materialSku, 'zh-CN'))
}

function getSpreadingOrderSummaryForProductionOrder(
  row: ProductionProgressRow,
  projection: MarkerSpreadingProjection = buildMarkerSpreadingProjection(),
): {
  orders: SpreadingOrder[]
  markerPlanCount: number
  waitingSpreadingCount: number
  spreadingCount: number
  cutDoneCount: number
} {
  const byId = projection.spreadingOrdersByProductionOrderId[row.productionOrderId] || []
  const byNo = projection.spreadingOrders.filter((order) => order.productionOrderNos.includes(row.productionOrderNo))
  const orders = Array.from(new Map([...byId, ...byNo].map((order) => [order.spreadingOrderId, order])).values())
  return {
    orders,
    markerPlanCount: new Set(orders.map((order) => order.markerPlanId)).size,
    waitingSpreadingCount: orders.filter((order) => order.status === 'WAITING_SPREADING').length,
    spreadingCount: orders.filter((order) => order.status === 'SPREADING').length,
    cutDoneCount: orders.filter((order) => order.status === 'CUT_DONE').length,
  }
}

function buildEmptyMaterialQuantityLedger(materialSku: string): MaterialQuantityLedgerLine {
  return {
    cutOrderId: '',
    cutOrderNo: '',
    productionOrderId: '',
    productionOrderNo: '',
    materialIdentity: {
      materialSku,
      materialName: '裁片单面料',
      materialColor: '',
      materialAlias: '',
      materialImageUrl: '',
      materialUnit: '米',
    },
    patternIdentity: {
      patternFileId: '',
      patternFileName: '',
      patternVersion: '',
      patternKind: '',
      effectiveWidthValue: 0,
      effectiveWidthUnit: 'cm',
      piecePartCodes: [],
      piecePartNames: [],
    },
    requiredMaterialQty: 0,
    transferWarehouseAllocatedQty: 0,
    cuttingClaimedQty: 0,
    markerLockedQty: 0,
    spreadingConsumedQty: 0,
    returnedQty: 0,
    adjustmentQty: 0,
    availableQty: 0,
    unit: '米',
    latestClaimEvent: null,
    events: [],
  }
}

function buildCutOrderDimensionRows(rows: ProductionProgressRow[]): CutOrderDimensionRow[] {
  const snapshotMap = new Map(getCuttingProgressSnapshots().map((item) => [item.productionOrderId, item] as const))
  const closeRecordLookup = buildCutOrderCloseRecordLookup()

  return rows.flatMap((row) => {
    const snapshot = snapshotMap.get(row.productionOrderId)
    return row.sourceOrderProgressLines.map((sourceLine) => {
      const specialCraftDetailParts = [
        snapshot?.specialCraftCurrentQty ? `当前 ${formatQty(snapshot.specialCraftCurrentQty)}` : '',
        snapshot?.specialCraftScrapQty ? `报废 ${formatQty(snapshot.specialCraftScrapQty)}` : '',
        snapshot?.specialCraftDamageQty ? `货损 ${formatQty(snapshot.specialCraftDamageQty)}` : '',
        snapshot?.specialCraftDifferenceWarning ? '差异预警' : '',
        snapshot ? formatBundleSummary(snapshot.bundleLengthCmValues, snapshot.bundleWidthCmValues) : '',
      ].filter(Boolean)

      const sewingDispatchDetailParts = [
        snapshot?.transferBagPackStatus ? `装袋 ${snapshot.transferBagPackStatus}` : '',
        snapshot?.transferBagCombinedWritebackStatus ? `回写 ${snapshot.transferBagCombinedWritebackStatus}` : '',
        snapshot?.transferBagBagDifferenceCount ? `袋差异 ${snapshot.transferBagBagDifferenceCount}` : '',
        snapshot?.transferBagFeiTicketDifferenceCount ? `菲票差异 ${snapshot.transferBagFeiTicketDifferenceCount}` : '',
      ].filter(Boolean)
      const quantityLedger =
        buildMaterialQuantityLedgerLines(row, sourceLine.cutOrderNo, sourceLine.materialSku)[0] ||
        buildEmptyMaterialQuantityLedger(sourceLine.materialSku)
      const spreadingDifferences = listSpreadingDifferencesByProductionOrder(row.productionOrderId).filter(
        (difference) =>
          (difference.cutOrderNos.includes(sourceLine.cutOrderNo) || difference.cutOrderIds.includes(sourceLine.cutOrderId)) &&
          (!sourceLine.materialSku || difference.materialSku === sourceLine.materialSku),
      )
      const pendingDifferenceCount = spreadingDifferences.filter((difference) => difference.handlingStatus === '待处理').length
      const closeRecord = closeRecordLookup[sourceLine.cutOrderId] || closeRecordLookup[sourceLine.cutOrderNo] || null
      const closeReasonText = closeRecord?.closeReasonText || row.closeReasonText
      const closeReason = closeRecord?.closeDescription || row.closeReason
      const closedAt = closeRecord?.closedAt || row.closedAt
      const isClosed = Boolean(closeRecord || row.closeReason || row.closedAt || row.rawStageText.includes('已关闭'))
      const mainStatusLabel = isClosed ? '已关闭' : row.currentStage.label
      const mainStatusClassName = isClosed ? 'bg-zinc-100 text-zinc-700' : row.currentStage.className
      const cuttable = !isClosed && row.currentStage.label === '已开工' && quantityLedger.cuttingClaimedQty > 0 && quantityLedger.availableQty > 0
      const cuttableReasonText = isClosed
        ? closeReasonText || closeReason || '该裁片单已关闭'
        : quantityLedger.cuttingClaimedQty <= 0
          ? '无领料记录'
          : row.currentStage.label !== '已开工'
            ? '未开工'
            : quantityLedger.availableQty <= 0
              ? '可用余额为 0'
              : '满足可排唛架条件'
      const markerRelationText =
        quantityLedger.markerLockedQty > 0
          ? `已锁定 ${formatMaterialLedgerQty(quantityLedger.markerLockedQty, quantityLedger.unit)}`
          : snapshot?.markerProgress.status || '无唛架方案占用'
      const operationResultText = [
        `实际裁剪：${sourceLine.currentStateLabel}`,
        `菲票：${snapshot?.feiTicketProgress.status || '待生成'}`,
        `待交出仓：${snapshot?.cutPieceWarehouseProgress.status || '待记录'}`,
      ].join(' / ')

      return {
        rowId: `${row.id}::${sourceLine.cutOrderNo}::${sourceLine.materialSku}`,
        parentRowId: row.id,
        cutOrderNo: sourceLine.cutOrderNo,
        productionOrderId: row.productionOrderId,
        productionOrderNo: row.productionOrderNo,
        styleLabel: row.styleCode || row.spuCode || '-',
        styleName: row.styleName || row.spuCode || '-',
        materialSku: sourceLine.materialSku || '待补面料 SKU',
        materialAlias: sourceLine.materialAlias || '',
        materialImageUrl: sourceLine.materialImageUrl || '',
        factoryName: row.assignedFactoryName || '-',
        relatedQty: getCutOrderRelatedQty(row, sourceLine.cutOrderNo, sourceLine.materialSku),
        quantityLedger,
        plannedShipDateDisplay: row.plannedShipDateDisplay,
        urgencyLabel: row.urgency.label,
        urgencyClassName: row.urgency.className,
        mainStatusLabel,
        mainStatusClassName,
        closeReasonText,
        closeReason,
        closedAt,
        cuttableLabel: cuttable ? '可排唛架' : '不可排唛架',
        cuttableClassName: cuttable ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700',
        cuttableReasonText,
        markerRelationText,
        operationResultText,
        feiTicketLabel: snapshot?.feiTicketProgress.status || '待生成',
        feiTicketClassName: buildStateBadgeClass(snapshot?.feiTicketProgress.status || '待生成'),
        specialCraftReturnLabel: snapshot?.specialCraftReturnProgress.status || '待确认',
        specialCraftReturnDetail: specialCraftDetailParts.join(' · '),
        sewingDispatchLabel: snapshot?.sewingDispatchProgress.status || '待交出',
        sewingDispatchDetail: sewingDispatchDetailParts.join(' · '),
        pendingDifferenceCount,
        blockingText:
          pendingDifferenceCount > 0
            ? `待处理差异 ${pendingDifferenceCount} 项`
            : snapshot?.blockingReasons.length
            ? snapshot.blockingReasons.map((item) => item.blockingLabel).join('、')
            : row.riskTags.map((item) => item.label).join('、') || '暂无风险',
        parentRecordId: row.id,
      }
    })
  })
}

function resetPagination(): void {
  state.page = 1
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function readPendingPrepFollowups(): ReplenishmentPendingPrepFollowupRecord[] {
  return deserializeReplenishmentPendingPrepStorage(
    localStorage.getItem(CUTTING_REPLENISHMENT_PENDING_PREP_STORAGE_KEY),
  )
}

function getPendingPrepFollowupsForRow(row: ProductionProgressRow): ReplenishmentPendingPrepFollowupRecord[] {
  const cutOrderIdSet = new Set(
    row.sourceOrderProgressLines
      .map((item) => item.cutOrderId)
      .filter((value): value is string => Boolean(value)),
  )
  const cutOrderNoSet = new Set(
    row.sourceOrderProgressLines
      .map((item) => item.cutOrderNo)
      .filter((value): value is string => Boolean(value)),
  )

  return readPendingPrepFollowups().filter(
    (item) => cutOrderIdSet.has(item.cutOrderId) || cutOrderNoSet.has(item.cutOrderNo),
  )
}

function buildPendingPrepSummaryText(row: ProductionProgressRow): string {
  const followups = getPendingPrepFollowupsForRow(row)
  if (!followups.length) return '当前无补料配料待处理'
  const latest = followups[0]
  return `补料配料待处理 ${followups.length} 条（来源铺布 ${latest?.sourceSpreadingSessionId || '待补'} / 来源差异处理 ${latest?.sourceReplenishmentRequestId || '待补'}）`
}

function buildRouteWithQuery(key: CuttingCanonicalPageKey, payload?: Record<string, string | undefined>): string {
  const pathname = getCanonicalCuttingPath(key)
  if (!payload) return pathname

  const params = new URLSearchParams()
  Object.entries(payload).forEach(([entryKey, entryValue]) => {
    if (entryValue) params.set(entryKey, entryValue)
  })

  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

function buildProductionProgressDetailPath(recordId: string): string {
  return `/fcs/craft/cutting/production-progress-detail/${encodeURIComponent(recordId)}`
}

function getCurrentSearchParams(): URLSearchParams {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return new URLSearchParams(query || '')
}

function syncDrillContextFromPath(): void {
  const pathname = appStore.getState().pathname
  if (state.querySignature === pathname) return
  state.querySignature = pathname
  state.drillContext = readCuttingDrillContextFromLocation(getCurrentSearchParams())

  if (state.drillContext?.productionOrderNo) {
    state.filters.productionOrderNo = state.drillContext.productionOrderNo
  }
  if (state.drillContext?.blockerSection === 'REPLENISHMENT') {
    state.activeQuickFilter = 'REPLENISH_GAP'
  } else if (state.drillContext?.blockerSection === 'SPREADING') {
    state.activeQuickFilter = 'GAP_ONLY'
  } else if (state.drillContext?.blockerSection === 'MATERIAL_PREP') {
    state.activeQuickFilter = 'PREP_DELAY'
  }

  const matched = state.drillContext?.productionOrderNo
    ? getAllRows().find((row) => row.productionOrderNo === state.drillContext?.productionOrderNo)
    : null
  state.activeDetailId = state.drillContext?.autoOpenDetail ? matched?.id || null : matched?.id || state.activeDetailId
}

function applyQuickFilter(rows: ProductionProgressRow[]): ProductionProgressRow[] {
  switch (state.activeQuickFilter) {
    case 'URGENT_ONLY':
      return rows.filter((row) => row.urgency.key === 'AA' || row.urgency.key === 'A')
    case 'PREP_DELAY':
      return rows.filter((row) => row.materialPrepSummary.key !== 'CONFIGURED')
    case 'CLAIM_EXCEPTION':
      return rows.filter((row) => row.materialClaimSummary.key === 'EXCEPTION' || row.materialClaimSummary.key === 'NOT_RECEIVED')
    case 'CUTTING_ACTIVE':
      return rows.filter((row) => row.currentStage.key === 'CUTTING' || row.currentStage.key === 'WAITING_INBOUND' || row.currentStage.key === 'DONE')
    case 'INCOMPLETE_ONLY':
      return rows.filter((row) => row.incompleteSkuCount > 0 || row.incompletePartCount > 0)
    case 'GAP_ONLY':
      return rows.filter((row) => row.hasPieceGap)
    case 'MAPPING_MISSING':
      return rows.filter((row) => row.hasMappingWarnings)
    case 'REPLENISH_GAP':
      return rows.filter((row) => row.hasPieceGap && row.riskTags.some((tag) => tag.key === 'REPLENISH_PENDING'))
    default:
      return rows
  }
}

function getDisplayRows(): ProductionProgressRow[] {
  const filteredRows = filterProductionProgressRows(getAllRows(), state.filters)
  const quickFilteredRows = applyQuickFilter(filteredRows)
  return sortProductionProgressRows(quickFilteredRows, state.filters.sortBy)
}

function getQuickFilterLabel(filter: ProductionProgressQuickFilterExtended | null): string | null {
  if (filter === 'URGENT_ONLY') return '快捷筛选：只看临近发货'
  if (filter === 'PREP_DELAY') return '快捷筛选：只看配料异常'
  if (filter === 'CLAIM_EXCEPTION') return '快捷筛选：只看领料差异'
  if (filter === 'CUTTING_ACTIVE') return '快捷筛选：只看已开工'
  if (filter === 'INCOMPLETE_ONLY') return '快捷筛选：只看未完成生产单'
  if (filter === 'GAP_ONLY') return '快捷筛选：只看有部位缺口'
  if (filter === 'MAPPING_MISSING') return '快捷筛选：只看映射缺失'
  if (filter === 'REPLENISH_GAP') return '快捷筛选：只看待补料导致的缺口'
  return null
}

function getFilterLabels(): string[] {
  const labels: string[] = []
  const quickFilterLabel = getQuickFilterLabel(state.activeQuickFilter)
  const completionLabelMap: Record<Exclude<ProductionProgressFilters['completionState'], 'ALL'>, string> = {
    COMPLETED: '已完成',
    IN_PROGRESS: '进行中',
    DATA_PENDING: '数据待补',
    HAS_EXCEPTION: '有异常',
  }
  if (quickFilterLabel) labels.push(quickFilterLabel)

  if (state.filters.keyword) labels.push(`关键词：${state.filters.keyword}`)
  if (state.filters.productionOrderNo) labels.push(`生产单：${state.filters.productionOrderNo}`)
  if (state.filters.urgencyLevel !== 'ALL') labels.push(`紧急程度：${urgencyMeta[state.filters.urgencyLevel].label}`)
  if (state.filters.shipDeltaRange !== 'ALL') labels.push(`与计划发货相比：${shipDeltaRangeMeta[state.filters.shipDeltaRange].label}`)
  if (state.filters.currentStage !== 'ALL') {
    const stageLabel =
      state.filters.currentStage === 'NOT_STARTED'
        ? '未开工'
        : state.filters.currentStage === 'STARTED'
          ? '已开工'
          : stageMeta[state.filters.currentStage].label
    labels.push(`裁床主状态：${stageLabel}`)
  }
  if (state.filters.completionState !== 'ALL') labels.push(`完成状态：${completionLabelMap[state.filters.completionState]}`)
  if (state.filters.configStatus !== 'ALL') labels.push(`中转仓配料：${configMeta[state.filters.configStatus].label}`)
  if (state.filters.receiveStatus !== 'ALL') labels.push(`裁床领料：${receiveMeta[state.filters.receiveStatus].label}`)
  if (state.filters.riskFilter !== 'ALL') {
    labels.push(state.filters.riskFilter === 'ANY' ? '风险：只看有风险' : `风险：${riskMeta[state.filters.riskFilter].label}`)
  }

  if (state.filters.sortBy !== 'URGENCY_THEN_SHIP') {
    const sortLabelMap: Record<ProductionProgressSortKey, string> = {
      URGENCY_THEN_SHIP: '默认排序',
      SHIP_DATE_ASC: '计划发货日期升序',
      ORDER_QTY_DESC: '本单成衣件数降序',
    }
    labels.push(`排序：${sortLabelMap[state.filters.sortBy]}`)
  }

  return labels
}

function renderStatsCards(rows: ProductionProgressRow[]): string {
  const summary = buildProductionProgressSummary(rows)
  const differences = rows.flatMap((row) => listSpreadingDifferencesByProductionOrder(row.productionOrderId))
  const pendingDifferenceCount = differences.filter((difference) => difference.handlingStatus === '待处理').length
  const pendingReplenishmentReviewCount = differences.filter((difference) => difference.handlingStatus !== '已处理').length
  const handledReplenishmentReviewCount = differences.filter((difference) => difference.handlingStatus === '已处理').length
  const latestDifference = differences[0]
  const closedCutOrderCount = rows.filter((row) => Boolean(row.closeReason || row.closedAt || row.rawStageText.includes('已关闭'))).length
  const rowProductionNos = new Set(rows.map((row) => row.productionOrderNo))
  const rowStyleCodes = new Set(rows.map((row) => row.styleCode).filter(Boolean))
  const sampleItems = buildSampleWarehouseProjection().viewModel.items.filter(
    (item) => rowProductionNos.has(item.relatedProductionOrderNo) || rowStyleCodes.has(item.styleCode),
  )
  const sampleAbnormalCount = sampleItems.filter((item) => item.abnormalFlag).length

  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
      ${renderCompactKpiCard('生产单总数', summary.totalCount, '当前筛选范围', 'text-slate-900')}
      ${renderCompactKpiCard('临近发货生产单', summary.urgentCount, '需优先跟进交付', 'text-rose-600')}
      ${renderCompactKpiCard('配料异常单', summary.prepExceptionCount, '配料数量不足', 'text-amber-600')}
      ${renderCompactKpiCard('领料差异单', summary.claimExceptionCount, '未产生领料记录或现场差异', 'text-orange-600')}
      ${renderCompactKpiCard('待处理差异', pendingDifferenceCount, '来自铺布 / 裁剪实际差异', pendingDifferenceCount ? 'text-rose-600' : 'text-emerald-600')}
      ${renderCompactKpiCard('待审核补料', pendingReplenishmentReviewCount, '由审核结果决定是否补料', pendingReplenishmentReviewCount ? 'text-amber-600' : 'text-emerald-600')}
      ${renderCompactKpiCard('已处理补料', handledReplenishmentReviewCount, '已形成审核结果', handledReplenishmentReviewCount ? 'text-emerald-600' : 'text-slate-500')}
      ${renderCompactKpiCard('最近差异来源', latestDifference?.sourceType || '暂无差异', latestDifference?.differenceType || '当前筛选范围无差异', latestDifference ? 'text-blue-600' : 'text-slate-500')}
      ${renderCompactKpiCard('已关闭裁片单', closedCutOrderCount, '已记录关闭原因', closedCutOrderCount ? 'text-zinc-700' : 'text-slate-500')}
      ${renderCompactKpiCard('样衣异常', sampleAbnormalCount, '关联样衣版本、破损或待归还', sampleAbnormalCount ? 'text-rose-600' : 'text-slate-500')}
      ${renderCompactKpiCard('已开工生产单', summary.cuttingCount + summary.doneCount, '含铺布、裁剪、入仓后续', 'text-violet-600')}
      ${renderCompactKpiCard('已进入后续单', summary.doneCount, '含菲票、入仓或交出后续', 'text-emerald-600')}
    </section>
  `
}

function renderFullChainOverviewCards(rows: ProductionProgressRow[]): string {
  const rowIds = new Set(rows.map((row) => row.productionOrderId))
  const snapshots = getCuttingProgressSnapshots().filter((item) => rowIds.has(item.productionOrderId))
  const total = rows.length || 1
  const countBy = (getter: (row: ProductionProgressRow) => boolean): number => rows.filter(getter).length
  const runtimeSummaries = rows.map((row) => getRuntimeSewingDispatchProgressByProductionOrder(row.productionOrderId))
  const dispatchOrders = listCuttingSewingDispatchOrders().filter((order) => rowIds.has(order.productionOrderId))
  const dispatchBatches = listCuttingSewingDispatchBatches().filter((batch) => rowIds.has(batch.productionOrderId))
  const handoverRecordCount = dispatchBatches.filter((batch) => Boolean(batch.handoverRecordId)).length
  const spreadingProjection = buildMarkerSpreadingProjection()
  const spreadingOrders = spreadingProjection.spreadingOrders.filter((order) =>
    order.productionOrderIds.some((productionOrderId) => rowIds.has(productionOrderId)),
  )
  const markerPlanCount = new Set(spreadingOrders.map((order) => order.markerPlanId)).size
  const waitingSpreadingCount = spreadingOrders.filter((order) => order.status === 'WAITING_SPREADING').length
  const activeSpreadingCount = spreadingOrders.filter((order) => order.status === 'SPREADING').length
  const cutDoneCount = spreadingOrders.filter((order) => order.status === 'CUT_DONE').length
  const blockingReasonCount =
    snapshots.reduce((sum, snapshot) => sum + snapshot.blockingReasons.length, 0) +
    runtimeSummaries.reduce((sum, item) => sum + item.blockingReasons.length, 0) +
    rows.filter((row) => row.pieceGapQty > 0 || row.inboundGapQty > 0).length

  return `
    <section class="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      ${renderCompactKpiCard('中转仓配料', `${countBy((row) => row.materialPrepSummary.key === 'CONFIGURED')}/${total}`, '有配料数量生产单', 'text-slate-900')}
      ${renderCompactKpiCard('裁床领料', `${countBy((row) => row.materialClaimSummary.key === 'RECEIVED')}/${total}`, '有领料记录生产单', 'text-blue-600')}
      ${renderCompactKpiCard('裁片单', rows.reduce((sum, row) => sum + row.cutOrderCount, 0), '当前筛选范围', 'text-slate-900')}
      ${renderCompactKpiCard('唛架方案', `${markerPlanCount} 个`, '已确认并生成铺布单', 'text-violet-600')}
      ${renderCompactKpiCard('铺布单', `${spreadingOrders.length} 张`, `待铺布 ${waitingSpreadingCount} / 铺布中 ${activeSpreadingCount} / 已裁剪 ${cutDoneCount}`, 'text-violet-600')}
      ${renderCompactKpiCard('菲票', snapshots.reduce((sum, item) => sum + item.feiTicketProgress.completedQty, 0), '已生成菲票数', 'text-cyan-600')}
      ${renderCompactKpiCard('待交出仓', snapshots.reduce((sum, item) => sum + item.cutPieceWarehouseProgress.completedQty, 0), '裁片库存记录', 'text-emerald-600')}
      ${renderCompactKpiCard('车缝任务分配', runtimeSummaries.reduce((sum, item) => sum + item.dispatchBatchCount, 0), '分配批次', 'text-blue-600')}
      ${renderCompactKpiCard('交出单', dispatchOrders.filter((order) => order.handoverOrderId).length || dispatchOrders.length, '已生成 / 已创建', 'text-blue-600')}
      ${renderCompactKpiCard('交出记录', handoverRecordCount, '已提交记录', 'text-blue-600')}
      ${renderCompactKpiCard('交出后缺口', blockingReasonCount, '裁床链路风险与交出后缺口', blockingReasonCount ? 'text-amber-600' : 'text-emerald-600')}
      ${renderCompactKpiCard('交出回写', runtimeSummaries.reduce((sum, item) => sum + item.writtenBackTransferBagCount, 0), '已回写中转袋', 'text-emerald-600')}
    </section>
  `
}

function renderSpecialCraftReturnCards(rows: ProductionProgressRow[]): string {
  const statusByProductionId = getCuttingSpecialCraftReturnStatusByProductionOrders(rows.map((row) => row.productionOrderId))
  const summaries = rows
    .map((row) => statusByProductionId.get(row.productionOrderId))
    .filter((item): item is CuttingSpecialCraftReturnStatusSummary => Boolean(item))
    .filter((item) => item.totalNeedSpecialCraftFeiTickets > 0)

  if (summaries.length === 0) return ''

  const aggregated = summaries.reduce(
    (result, item) => {
      result.totalNeed += item.totalNeedSpecialCraftFeiTickets
      result.waitDispatch += item.waitDispatchCount
      result.dispatched += item.dispatchedCount
      result.received += item.receivedBySpecialFactoryCount
      result.waitReturn += item.waitReturnCount
      result.returned += item.returnedCount
      result.difference += item.differenceCount
      result.objection += item.objectionCount
      return result
    },
    {
      totalNeed: 0,
      waitDispatch: 0,
      dispatched: 0,
      received: 0,
      waitReturn: 0,
      returned: 0,
      difference: 0,
      objection: 0,
    },
  )

  const allReturned = summaries.every((item) => item.allReturned)

  return `
    <section class="rounded-lg border bg-white p-4 shadow-sm">
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-sm font-semibold text-foreground">特殊工艺回仓汇总</div>
          <div class="mt-1 text-xs text-muted-foreground">只统计需要特殊工艺的菲票，用于后续裁床交出前核对。</div>
        </div>
        <div class="text-sm font-medium ${allReturned ? 'text-emerald-600' : 'text-amber-600'}">是否全部回仓：${allReturned ? '是' : '否'}</div>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderCompactKpiCard('需要特殊工艺菲票数', aggregated.totalNeed, '需经过特殊工艺流转', 'text-slate-900')}
        ${renderCompactKpiCard('待交出菲票数', aggregated.waitDispatch, '裁床厂待交出仓待处理', 'text-amber-600')}
        ${renderCompactKpiCard('已交出菲票数', aggregated.dispatched, '裁床厂已创建交出记录', 'text-blue-600')}
        ${renderCompactKpiCard('已接收菲票数', aggregated.received, '特殊工艺厂已入待加工仓', 'text-cyan-600')}
        ${renderCompactKpiCard('待回仓菲票数', aggregated.waitReturn, '特殊工艺厂待交出仓待回仓', 'text-amber-600')}
        ${renderCompactKpiCard('已回仓菲票数', aggregated.returned, '已回裁床厂待交出仓', 'text-emerald-600')}
        ${renderCompactKpiCard('差异菲票数', aggregated.difference, '交出或回仓存在差异', 'text-rose-600')}
        ${renderCompactKpiCard('异议中菲票数', aggregated.objection, '数量异议处理中', 'text-rose-600')}
      </div>
    </section>
  `
}

function renderSewingDispatchProgressCards(rows: ProductionProgressRow[]): string {
  const summaries = rows.map((row) => getRuntimeSewingDispatchProgressByProductionOrder(row.productionOrderId))
  const aggregated = summaries.reduce(
    (result, item) => {
      result.totalProductionQty += item.totalProductionQty
      result.cumulativeDispatchedGarmentQty += item.cumulativeDispatchedGarmentQty
      result.remainingGarmentQty += item.remainingGarmentQty
      result.dispatchBatchCount += item.dispatchBatchCount
      result.transferBagCount += item.transferBagCount
      result.writtenBackTransferBagCount += item.writtenBackTransferBagCount
      result.differenceTransferBagCount += item.differenceTransferBagCount
      result.objectionTransferBagCount += item.objectionTransferBagCount
      item.blockingReasons.forEach((reason) => result.blockingReasons.add(reason))
      return result
    },
    {
      totalProductionQty: 0,
      cumulativeDispatchedGarmentQty: 0,
      remainingGarmentQty: 0,
      dispatchBatchCount: 0,
      transferBagCount: 0,
      writtenBackTransferBagCount: 0,
      differenceTransferBagCount: 0,
      objectionTransferBagCount: 0,
      blockingReasons: new Set<string>(),
    },
  )
  const reasons = Array.from(aggregated.blockingReasons)

  return `
    <section class="rounded-lg border bg-white p-4 shadow-sm">
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-sm font-semibold text-foreground">交出单汇总</div>
          <div class="mt-1 text-xs text-muted-foreground">统计裁床厂交出单、交出记录、中转袋和回写结果。</div>
        </div>
        <div class="text-sm font-medium text-amber-600">交出后风险提示：${reasons.length ? `${reasons.length} 项` : '无'}</div>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        ${renderCompactKpiCard('生产总数', aggregated.totalProductionQty, '', 'text-slate-900')}
        ${renderCompactKpiCard('累计已交出件数', aggregated.cumulativeDispatchedGarmentQty, '', 'text-blue-600')}
        ${renderCompactKpiCard('剩余未交出件数', aggregated.remainingGarmentQty, '', 'text-amber-600')}
        ${renderCompactKpiCard('交出记录数', aggregated.dispatchBatchCount, '', 'text-slate-700')}
        ${renderCompactKpiCard('中转袋数', aggregated.transferBagCount, '', 'text-slate-700')}
        ${renderCompactKpiCard('已回写袋数', aggregated.writtenBackTransferBagCount, '', 'text-emerald-600')}
        ${renderCompactKpiCard('差异袋数', aggregated.differenceTransferBagCount, '', 'text-rose-600')}
        ${renderCompactKpiCard('异议中袋数', aggregated.objectionTransferBagCount, '', 'text-rose-600')}
        ${renderCompactKpiCard('交出后缺口', reasons.length ? reasons.join('、') : '无', '缺口和差异作为交出后结果展示，不拦截有效裁片继续交出', 'text-amber-600')}
      </div>
    </section>
  `
}

function renderProgressStatisticsLinkageCards(rows: ProductionProgressRow[]): string {
  const rowIds = new Set(rows.map((row) => row.productionOrderId))
  const snapshots = getCuttingProgressSnapshots().filter((item) => rowIds.has(item.productionOrderId))
  if (!snapshots.length) return ''

  const countBy = (getter: (snapshot: (typeof snapshots)[number]) => boolean): number => snapshots.filter(getter).length
  const blockingReasons = Array.from(new Set(snapshots.flatMap((snapshot) => snapshot.blockingReasons.map((reason) => reason.blockingLabel))))
  const bundleLengthValues = Array.from(new Set(snapshots.flatMap((snapshot) => snapshot.bundleLengthCmValues).filter((value) => value > 0)))
  const bundleWidthValues = Array.from(new Set(snapshots.flatMap((snapshot) => snapshot.bundleWidthCmValues).filter((value) => value > 0)))

  return `
    <section class="rounded-lg border bg-white p-4 shadow-sm">
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-sm font-semibold text-foreground">裁床进度联动</div>
          <div class="mt-1 text-xs text-muted-foreground">按生产单汇总配料数量、领料数量、裁剪、菲票、特殊工艺回仓、裁片交出和差异风险。</div>
        </div>
        <div class="text-sm font-medium text-amber-600">交出后风险提示：${blockingReasons.length ? `${blockingReasons.length} 项` : '无'}</div>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderCompactKpiCard('配料数量', countBy((item) => item.materialPrepProgress.status === '已配置'), `共 ${snapshots.length} 单`, 'text-slate-900')}
        ${renderCompactKpiCard('领料数量', countBy((item) => item.pickupProgress.status === '已入待加工仓'), `差异 ${countBy((item) => item.pickupProgress.status === '差异待处理')} 单`, 'text-blue-600')}
        ${renderCompactKpiCard('裁剪进度', countBy((item) => item.cuttingProgress.status === '已裁剪'), `共 ${snapshots.length} 单`, 'text-violet-600')}
        ${renderCompactKpiCard('菲票进度', countBy((item) => item.feiTicketProgress.status === '已生成'), `部分 / 未生成 ${countBy((item) => item.feiTicketProgress.status !== '已生成')} 单`, 'text-cyan-600')}
        ${renderCompactKpiCard('特殊工艺回仓', countBy((item) => item.specialCraftReturnProgress.status === '已回仓' || item.specialCraftReturnProgress.status === '不需要回仓'), `特殊工艺未回仓 ${countBy((item) => item.specialCraftReturnProgress.status.includes('未回仓'))} 单`, 'text-emerald-600')}
        ${renderCompactKpiCard('裁片交出', snapshots.reduce((sum, item) => sum + item.sewingDispatchProgress.completedQty, 0), '累计已交出件数', 'text-blue-600')}
        ${renderCompactKpiCard('特殊工艺当前数量', formatQty(snapshots.reduce((sum, item) => sum + item.specialCraftCurrentQty, 0)), '已回仓后当前可用数量', 'text-blue-600')}
        ${renderCompactKpiCard('特殊工艺报废 / 货损', `${formatQty(snapshots.reduce((sum, item) => sum + item.specialCraftScrapQty, 0))} / ${formatQty(snapshots.reduce((sum, item) => sum + item.specialCraftDamageQty, 0))}`, '报废 / 货损', 'text-rose-600')}
        ${renderCompactKpiCard('领料单已完成', countBy((item) => item.pickupOrderCompleted), '工厂侧完成裁床领料', 'text-emerald-600')}
        ${renderCompactKpiCard('交出单已完成', countBy((item) => item.handoutOrderCompleted), '工厂侧完成交出单', 'text-emerald-600')}
        ${renderCompactKpiCard('装袋 / 回写', countBy((item) => item.transferBagPackStatus === '已装袋' || item.transferBagPackStatus === '已交出'), `部分回写 ${countBy((item) => item.transferBagCombinedWritebackStatus === '部分回写')}`, 'text-blue-600')}
        ${renderCompactKpiCard('袋级 / 菲票级差异', `${snapshots.reduce((sum, item) => sum + item.transferBagBagDifferenceCount, 0)} / ${snapshots.reduce((sum, item) => sum + item.transferBagFeiTicketDifferenceCount, 0)}`, '中转袋差异 / 菲票差异', 'text-rose-600')}
        ${renderCompactKpiCard('差异 / 异议', countBy((item) => item.blockingReasons.some((reason) => reason.blockingLabel.includes('差异') || reason.blockingLabel.includes('异议'))), '涉及生产单', 'text-rose-600')}
        ${
          bundleLengthValues.length || bundleWidthValues.length
            ? renderCompactKpiCard(
                '捆条尺寸',
                `${bundleLengthValues.length ? `长 ${bundleLengthValues.join(' / ')}` : '长 —'}${bundleWidthValues.length ? ` / 宽 ${bundleWidthValues.join(' / ')}` : ''}`,
                '仅在捆条已维护尺寸时展示',
                'text-violet-600',
              )
            : ''
        }
        ${renderCompactKpiCard('交出后风险', blockingReasons.length ? blockingReasons.slice(0, 3).join('、') : '无', '有可交库存时仍可继续新增交出记录', 'text-amber-600')}
      </div>
    </section>
  `
}

function renderFilterSelect(
  label: string,
  field: FilterField,
  value: string,
  options: Array<{ value: string; label: string }>,
): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select
        class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        data-cutting-progress-field="${field}"
      >
        ${options
          .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
          .join('')}
      </select>
    </label>
  `
}

function renderQuickFilterRow(): string {
  const options: Array<{ key: ProductionProgressQuickFilterExtended; label: string; tone: 'blue' | 'amber' | 'rose' }> = [
    { key: 'URGENT_ONLY', label: '只看临近发货', tone: 'rose' },
    { key: 'PREP_DELAY', label: '只看配料不足', tone: 'amber' },
    { key: 'CLAIM_EXCEPTION', label: '只看领料差异', tone: 'rose' },
    { key: 'CUTTING_ACTIVE', label: '只看已开工', tone: 'blue' },
    { key: 'INCOMPLETE_ONLY', label: '只看未完成', tone: 'blue' },
    { key: 'GAP_ONLY', label: '只看部位缺口', tone: 'amber' },
    { key: 'MAPPING_MISSING', label: '只看映射缺失', tone: 'amber' },
    { key: 'REPLENISH_GAP', label: '只看待补料缺口', tone: 'rose' },
  ]

  return `
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs font-medium text-muted-foreground">快捷筛选</span>
      ${options
        .map((option) =>
          renderWorkbenchFilterChip(
            option.label,
            `data-cutting-progress-action="toggle-quick-filter" data-quick-filter="${option.key}"`,
            state.activeQuickFilter === option.key ? option.tone : 'blue',
          ),
        )
        .join('')}
    </div>
  `
}

function renderActiveStateBar(): string {
  const labels = [...buildCuttingDrillChipLabels(state.drillContext), ...getFilterLabels()]
  if (!labels.length) return ''

  return renderWorkbenchStateBar({
    summary: buildCuttingDrillSummary(state.drillContext) || '当前视图条件',
    chips: labels.map((label) =>
      renderWorkbenchFilterChip(
        label,
        state.drillContext ? 'data-cutting-progress-action="clear-prefilter"' : 'data-cutting-progress-action="clear-filters"',
        state.drillContext ? 'amber' : 'blue',
      ),
    ),
    clearAttrs: state.drillContext ? 'data-cutting-progress-action="clear-prefilter"' : 'data-cutting-progress-action="clear-filters"',
  })
}

function renderMetricChip(label: string, value: string, toneClass = 'text-slate-900'): string {
  return `
    <span class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
      <span>${escapeHtml(label)}</span>
      <span class="font-semibold ${toneClass}">${escapeHtml(value)}</span>
    </span>
  `
}

function formatMaterialLedgerQty(value: number, unit = '米'): string {
  return `${formatQty(Math.round(value * 10) / 10)} ${unit}`
}

function renderMaterialLedgerLine(
  line: MaterialQuantityLedgerLine,
  fields: Array<[string, keyof MaterialQuantityLedgerLine]>,
): string {
  return `
    <div class="space-y-1.5 rounded-md border bg-background px-2.5 py-2">
      ${renderMaterialIdentityBlock(line.materialIdentity, { compact: true, imageSizeClass: 'h-9 w-9' })}
      <div class="grid gap-x-3 gap-y-1 text-xs text-muted-foreground">
        ${fields
          .map(([label, field]) => {
            const value = typeof line[field] === 'number' ? Number(line[field]) : 0
            return `<div class="flex justify-between gap-3"><span>${escapeHtml(label)}</span><span class="font-medium tabular-nums text-foreground">${escapeHtml(formatMaterialLedgerQty(value, line.unit))}</span></div>`
          })
          .join('')}
      </div>
    </div>
  `
}

function renderStackedLines(
  lines: string[],
  emptyText: string,
  options: { limit?: number } = {},
): string {
  if (!lines.length) {
    return `<div class="text-xs text-muted-foreground">${escapeHtml(emptyText)}</div>`
  }

  const limit = options.limit ?? lines.length
  const visibleLines = lines.slice(0, limit)
  const remainingCount = Math.max(lines.length - visibleLines.length, 0)

  return `
    <div class="space-y-1.5">
      ${visibleLines
        .map((line) => `<div class="text-xs leading-5 text-foreground">${line}</div>`)
        .join('')}
      ${remainingCount > 0 ? `<div class="text-xs text-muted-foreground">+${remainingCount} 项</div>` : ''}
    </div>
  `
}

function renderPrepProgressCell(row: ProductionProgressRow): string {
  const lines = buildMaterialQuantityLedgerLines(row).map((line) =>
    renderMaterialLedgerLine(
      line,
      [
        ['需求用量', 'requiredMaterialQty'],
        ['中转仓已配数量', 'transferWarehouseAllocatedQty'],
        ['已锁定数量', 'markerLockedQty'],
      ],
    ),
  )
  return renderStackedLines(lines, '暂无面料数量账')
}

function renderClaimProgressCell(row: ProductionProgressRow): string {
  const lines = buildMaterialQuantityLedgerLines(row).map((line) =>
    renderMaterialLedgerLine(
      line,
      [
        ['裁床已领数量', 'cuttingClaimedQty'],
        ['已消耗数量', 'spreadingConsumedQty'],
        ['可用余额', 'availableQty'],
      ],
    ),
  )
  return renderStackedLines(lines, '暂无面料数量账')
}

function renderSkuProgressCell(row: ProductionProgressRow): string {
  const lines = row.skuProgressLines.map(
    (line) =>
      `<div class="flex items-start justify-between gap-3"><span class="text-muted-foreground">${escapeHtml([line.skuLabel, line.skuDetailLabel].filter(Boolean).join(' / '))}</span><span class="font-medium ${line.completionClassName}">${escapeHtml(line.completionLabel)}</span></div>`,
  )
  return renderStackedLines(lines, '暂无 SKU 进展')
}

function renderPartDifferenceCell(row: ProductionProgressRow): string {
  return `
    <div class="space-y-1 text-xs">
      <div class="flex items-center justify-between gap-3">
        <span class="text-muted-foreground">已完成部位片数</span>
        <span class="font-medium tabular-nums text-emerald-700">${formatQty(row.partDifferenceSummary.completedPieceQty)}</span>
      </div>
      <div class="flex items-center justify-between gap-3">
        <span class="text-muted-foreground">未完成部位片数</span>
        <span class="font-medium tabular-nums ${row.partDifferenceSummary.incompletePieceQty > 0 ? 'text-amber-700' : 'text-slate-900'}">${formatQty(row.partDifferenceSummary.incompletePieceQty)}</span>
      </div>
    </div>
  `
}

function resolveGapRowCutOrderNo(
  row: ProductionProgressRow,
  item: ProductionProgressRow['pieceTruth']['gapRows'][number],
): string {
  if (item.cutOrderNo) return item.cutOrderNo
  const fallback = row.pieceTruth.cutOrderRows.find(
    (sourceRow) =>
      sourceRow.materialSku === item.materialSku &&
      (sourceRow.gapCutQty > 0 || sourceRow.gapInboundQty > 0),
  )
  return fallback?.cutOrderNo || '-'
}

function renderRiskCell(row: ProductionProgressRow): string {
  const pendingPrepFollowups = getPendingPrepFollowupsForRow(row)
  if (!row.riskTags.length && !pendingPrepFollowups.length) {
    return '<span class="text-xs text-muted-foreground">无风险</span>'
  }

  return `
    <div class="flex flex-wrap gap-1">
      ${row.riskTags.map((riskTag) => renderBadge(riskTag.label, riskTag.className)).join('')}
      ${pendingPrepFollowups.length ? renderBadge(`补料配料待处理 ${pendingPrepFollowups.length} 条`, 'bg-amber-100 text-amber-700') : ''}
    </div>
  `
}

function renderDetailSummaryItem(label: string, value: string): string {
  return `
    <div class="space-y-1 rounded-md bg-background/60 px-3 py-2">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="text-sm font-medium text-foreground">${escapeHtml(value || '-')}</div>
    </div>
  `
}

function renderDetailMaterialLines(
  lines: string[],
  emptyText: string,
): string {
  if (!lines.length) {
    return `<div class="text-sm text-muted-foreground">${escapeHtml(emptyText)}</div>`
  }

  return `
    <div class="space-y-2">
      ${lines.map((line) => `<div class="text-sm leading-6 text-foreground">${line}</div>`).join('')}
    </div>
  `
}

function renderMaterialProgressSection(row: ProductionProgressRow): string {
  const ledgerLines = buildMaterialQuantityLedgerLines(row)

  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold">面料数量账</h3>
      <div class="mt-4 overflow-x-auto">
        <table class="w-full min-w-[980px] text-sm">
          <thead class="border-b bg-muted/30 text-muted-foreground">
            <tr>
              <th class="px-4 py-3 text-left font-medium">面料</th>
              <th class="px-4 py-3 text-left font-medium">需求用量</th>
              <th class="px-4 py-3 text-left font-medium">中转仓已配数量</th>
              <th class="px-4 py-3 text-left font-medium">裁床已领数量</th>
              <th class="px-4 py-3 text-left font-medium">已锁定数量</th>
              <th class="px-4 py-3 text-left font-medium">已消耗数量</th>
              <th class="px-4 py-3 text-left font-medium">可用余额</th>
            </tr>
          </thead>
          <tbody>
            ${
              ledgerLines.length
                ? ledgerLines
                    .map(
                      (line) => `
                        <tr class="border-b last:border-b-0 align-top">
                          <td class="px-4 py-3">${renderMaterialIdentityBlock(line.materialIdentity, { compact: true, imageSizeClass: 'h-9 w-9' })}</td>
                          <td class="px-4 py-3 font-medium tabular-nums">${escapeHtml(formatMaterialLedgerQty(line.requiredMaterialQty, line.unit))}</td>
                          <td class="px-4 py-3 font-medium tabular-nums">${escapeHtml(formatMaterialLedgerQty(line.transferWarehouseAllocatedQty, line.unit))}</td>
                          <td class="px-4 py-3 font-medium tabular-nums">${escapeHtml(formatMaterialLedgerQty(line.cuttingClaimedQty, line.unit))}</td>
                          <td class="px-4 py-3 font-medium tabular-nums">${escapeHtml(formatMaterialLedgerQty(line.markerLockedQty, line.unit))}</td>
                          <td class="px-4 py-3 font-medium tabular-nums">${escapeHtml(formatMaterialLedgerQty(line.spreadingConsumedQty, line.unit))}</td>
                          <td class="px-4 py-3 font-medium tabular-nums">${escapeHtml(formatMaterialLedgerQty(line.availableQty, line.unit))}</td>
                        </tr>
                      `,
                    )
                    .join('')
                : '<tr><td colspan="7" class="px-4 py-10 text-center text-sm text-muted-foreground">暂无面料数量账。</td></tr>'
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderFullChainDetailSection(row: ProductionProgressRow): string {
  const snapshot = getCuttingSnapshotForRow(row)
  const runtimeSewing = getRuntimeSewingDispatchProgressByProductionOrder(row.productionOrderId)
  const dispatchOrders = listCuttingSewingDispatchOrders().filter((order) => order.productionOrderId === row.productionOrderId)
  const dispatchBatches = listCuttingSewingDispatchBatches().filter((batch) => batch.productionOrderId === row.productionOrderId)
  const transferBags = listCuttingSewingTransferBags().filter((bag) => bag.productionOrderId === row.productionOrderId)
  const handoverRecordCount = dispatchBatches.filter((batch) => Boolean(batch.handoverRecordId)).length
  const spreadingOrderSummary = getSpreadingOrderSummaryForProductionOrder(row)
  const blockingReasons = [
    ...(snapshot?.blockingReasons.map((item) => item.blockingLabel) || []),
    ...runtimeSewing.blockingReasons,
    row.pieceGapQty > 0 ? `裁片仍缺 ${formatQty(row.pieceGapQty)} 片` : '',
    row.inboundGapQty > 0 ? `入仓仍缺 ${formatQty(row.inboundGapQty)} 片` : '',
  ].filter(Boolean)
  const chainItems = [
    {
      label: '中转仓配料',
      value: row.materialPrepSummary.label,
      detail: row.materialPrepSummary.detailText,
      tone: row.materialPrepSummary.className,
    },
    {
      label: '裁床领料',
      value: row.materialClaimSummary.label,
      detail: row.materialClaimSummary.detailText,
      tone: row.materialClaimSummary.className,
    },
    {
      label: '裁片单',
      value: `${row.cutOrderCount} 张`,
      detail: row.cutOrderNos.join('、') || '暂无裁片单',
      tone: 'bg-slate-100 text-slate-700',
    },
    {
      label: '唛架',
      value: snapshot?.markerProgress.status || '待确认',
      detail: `${formatQty(snapshot?.markerProgress.completedQty || 0)}/${formatQty(snapshot?.markerProgress.plannedQty || 0)}`,
      tone: buildStateBadgeClass(snapshot?.markerProgress.status || '待确认'),
    },
    {
      label: '铺布单',
      value: `${formatQty(spreadingOrderSummary.orders.length)} 张`,
      detail: `唛架方案 ${formatQty(spreadingOrderSummary.markerPlanCount)} 个 / 待铺布 ${formatQty(spreadingOrderSummary.waitingSpreadingCount)} / 铺布中 ${formatQty(spreadingOrderSummary.spreadingCount)} / 已裁剪 ${formatQty(spreadingOrderSummary.cutDoneCount)}`,
      tone: spreadingOrderSummary.orders.length ? 'bg-violet-100 text-violet-700' : buildStateBadgeClass(snapshot?.spreadingProgress.status || '待确认'),
    },
    {
      label: '菲票',
      value: snapshot?.feiTicketProgress.status || '待生成',
      detail: `已生成 ${formatQty(snapshot?.feiTicketProgress.completedQty || 0)} 张`,
      tone: buildStateBadgeClass(snapshot?.feiTicketProgress.status || '待生成'),
    },
    {
      label: '待交出仓',
      value: snapshot?.cutPieceWarehouseProgress.status || '未入仓',
      detail: `库存记录 ${formatQty(snapshot?.cutPieceWarehouseProgress.completedQty || 0)} 条`,
      tone: buildStateBadgeClass(snapshot?.cutPieceWarehouseProgress.status || '未入仓'),
    },
    {
      label: '车缝任务分配',
      value: `${runtimeSewing.dispatchBatchCount} 批`,
      detail: `中转袋 ${runtimeSewing.transferBagCount} 个 / 已交出袋 ${runtimeSewing.dispatchedTransferBagCount} 个`,
      tone: runtimeSewing.dispatchBatchCount ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700',
    },
    {
      label: '交出单',
      value: `${dispatchOrders.filter((order) => order.handoverOrderId).length || dispatchOrders.length} 个`,
      detail: dispatchOrders.map((order) => order.handoverOrderNo || order.dispatchOrderNo).join('、') || '暂无交出单',
      tone: dispatchOrders.length ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700',
    },
    {
      label: '交出记录',
      value: `${handoverRecordCount} 条`,
      detail: dispatchBatches.map((batch) => batch.handoverRecordNo || batch.dispatchBatchNo).join('、') || '暂无交出记录',
      tone: handoverRecordCount ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700',
    },
    {
      label: '缺口',
      value: blockingReasons.length ? `${blockingReasons.length} 项` : '无',
      detail: blockingReasons.slice(0, 4).join('、') || '当前无裁床链路缺口',
      tone: blockingReasons.length ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700',
    },
  ]

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between gap-4">
        <h3 class="text-sm font-semibold">全链路总览</h3>
        <div class="flex flex-wrap gap-2">
          ${renderMetricChip('车缝任务', `${runtimeSewing.dispatchBatchCount} 批`, runtimeSewing.dispatchBatchCount ? 'text-blue-600' : 'text-slate-700')}
          ${renderMetricChip('中转袋', `${transferBags.length} 个`, transferBags.length ? 'text-blue-600' : 'text-slate-700')}
          ${renderMetricChip('已交出件数', formatQty(runtimeSewing.cumulativeDispatchedGarmentQty), 'text-blue-600')}
        </div>
      </div>
      <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        ${chainItems
          .map(
            (item) => `
              <div class="rounded-md border bg-background px-3 py-2">
                <div class="flex items-center justify-between gap-3">
                  <span class="text-xs text-muted-foreground">${escapeHtml(item.label)}</span>
                  ${renderBadge(item.value, item.tone)}
                </div>
                <div class="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">${escapeHtml(item.detail)}</div>
              </div>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function getSampleItemsForProduction(row: ProductionProgressRow): SampleWarehouseItem[] {
  return buildSampleWarehouseProjection().viewModel.items.filter(
    (item) => item.relatedProductionOrderNo === row.productionOrderNo || item.styleCode === row.styleCode,
  )
}

function renderSampleWarehouseProgressSection(row: ProductionProgressRow): string {
  const sampleItems = getSampleItemsForProduction(row)
  if (!sampleItems.length) {
    return `
      <section class="rounded-lg border bg-card p-4">
        <h3 class="text-sm font-semibold">裁床样衣</h3>
        <p class="mt-3 text-sm text-muted-foreground">当前生产单暂无关联样衣。</p>
      </section>
    `
  }
  const abnormalItems = sampleItems.filter((item) => item.abnormalFlag)
  const cuttingUseCount = sampleItems.filter((item) => item.currentStatus === '裁剪中使用').length
  const pendingReturnCount = sampleItems.filter((item) => item.currentStatus === '待归还').length

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h3 class="text-sm font-semibold">裁床样衣</h3>
        <div class="flex flex-wrap gap-2">
          ${renderMetricChip('关联样衣', formatQty(sampleItems.length), 'text-blue-700')}
          ${renderMetricChip('裁剪中使用', formatQty(cuttingUseCount), cuttingUseCount ? 'text-blue-700' : 'text-slate-700')}
          ${renderMetricChip('待归还', formatQty(pendingReturnCount), pendingReturnCount ? 'text-amber-700' : 'text-slate-700')}
          ${renderMetricChip('异常', formatQty(abnormalItems.length), abnormalItems.length ? 'text-rose-700' : 'text-slate-700')}
        </div>
      </div>
      <div class="mt-4 grid gap-3 md:grid-cols-2">
        ${sampleItems
          .slice(0, 4)
          .map(
            (item) => `
              <div class="rounded-md border bg-background p-3">
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div class="font-medium text-foreground">${escapeHtml(item.sampleNo)}</div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml([item.sampleName, item.sampleVersion].filter(Boolean).join(' / '))}</div>
                  </div>
                  <span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${item.status.className}">${escapeHtml(item.currentStatus)}</span>
                </div>
                <div class="mt-2 text-xs leading-5 text-muted-foreground">
                  <div>用途：${escapeHtml(item.currentUsageType)}</div>
                  <div>位置：${escapeHtml(item.currentLocation)} / ${escapeHtml(item.currentHolder)}</div>
                  <div>异常：${escapeHtml(item.abnormalItems.map((abnormal) => abnormal.abnormalType).join('、') || '无')}</div>
                </div>
              </div>
            `,
          )
          .join('')}
      </div>
      <div class="mt-4">
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildRouteWithQuery('sample-warehouse', { productionOrderId: row.productionOrderId, styleCode: row.styleCode }))}">查看裁床样衣仓</button>
      </div>
    </section>
  `
}

function renderProductionPartFlowSection(row: ProductionProgressRow): string {
  const rows = buildProductionPartFlowLines(row)
  const totals = rows.reduce(
    (result, item) => {
      result.required += item.requiredPieceQty
      result.cut += item.actualCutQty
      result.stock += item.waitHandoverStockQty
      result.assigned += item.assignedPieceQty
      result.handedOver += item.handedOverPieceQty
      result.gap += item.gapPieceQty
      return result
    },
    { required: 0, cut: 0, stock: 0, assigned: 0, handedOver: 0, gap: 0 },
  )

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between gap-4">
        <h3 class="text-sm font-semibold">SKU / 部位流转明细</h3>
        <div class="flex flex-wrap gap-2">
          ${renderMetricChip('已裁', formatQty(totals.cut), 'text-violet-700')}
          ${renderMetricChip('库存', formatQty(totals.stock), 'text-emerald-700')}
          ${renderMetricChip('已分配', formatQty(totals.assigned), 'text-blue-700')}
          ${renderMetricChip('已交出', formatQty(totals.handedOver), 'text-blue-700')}
          ${renderMetricChip('仍缺', formatQty(totals.gap), totals.gap > 0 ? 'text-amber-700' : 'text-emerald-700')}
        </div>
      </div>
      <div class="mt-4 overflow-x-auto">
        <table class="w-full min-w-[1120px] text-sm">
          <thead class="border-b bg-muted/30 text-muted-foreground">
            <tr>
              <th class="px-4 py-3 text-left font-medium">SKU / 部位</th>
              <th class="px-4 py-3 text-left font-medium">来源裁片单</th>
              <th class="px-4 py-3 text-left font-medium">理论片数</th>
              <th class="px-4 py-3 text-left font-medium">实际裁剪</th>
              <th class="px-4 py-3 text-left font-medium">待交出仓库存</th>
              <th class="px-4 py-3 text-left font-medium">已分配</th>
              <th class="px-4 py-3 text-left font-medium">已交出</th>
              <th class="px-4 py-3 text-left font-medium">仍缺</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length
                ? rows
                    .map(
                      (item) => `
                        <tr class="border-b last:border-b-0 align-top">
                          <td class="px-4 py-3">
                            <div class="font-medium">${escapeHtml(item.skuLabel)}</div>
                            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.partName)}</div>
                          </td>
                          <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.sourceCutOrderNo || '—')}</td>
                          <td class="px-4 py-3 font-medium tabular-nums">${formatQty(item.requiredPieceQty)}</td>
                          <td class="px-4 py-3 tabular-nums">${formatQty(item.actualCutQty)}</td>
                          <td class="px-4 py-3 tabular-nums">${formatQty(item.waitHandoverStockQty)}</td>
                          <td class="px-4 py-3 tabular-nums">${formatQty(item.assignedPieceQty)}</td>
                          <td class="px-4 py-3 tabular-nums">${formatQty(item.handedOverPieceQty)}</td>
                          <td class="px-4 py-3 font-medium tabular-nums ${item.gapPieceQty > 0 ? 'text-amber-700' : 'text-emerald-700'}">${formatQty(item.gapPieceQty)}</td>
                        </tr>
                      `,
                    )
                    .join('')
                : '<tr><td colspan="8" class="px-4 py-10 text-center text-sm text-muted-foreground">暂无 SKU / 部位流转明细。</td></tr>'
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderRiskPromptSection(row: ProductionProgressRow): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold">风险提示</h3>
      <div class="mt-3 flex flex-wrap gap-2">
        ${
          row.riskTags.length
            ? row.riskTags.map((riskTag) => renderBadge(riskTag.label, riskTag.className)).join('')
            : '<span class="text-sm text-muted-foreground">无风险</span>'
        }
      </div>
    </section>
  `
}

function renderStageOverview(rows: ProductionProgressRow[]): string {
  const total = rows.length || 1
  const configuredCount = rows.filter((row) => row.materialPrepSummary.key === 'CONFIGURED').length
  const claimedCount = rows.filter((row) => row.materialClaimSummary.key === 'RECEIVED').length
  const spreadingProjection = buildMarkerSpreadingProjection()
  const rowIds = new Set(rows.map((row) => row.productionOrderId))
  const generatedSpreadingOrders = spreadingProjection.spreadingOrders.filter((order) =>
    order.productionOrderIds.some((productionOrderId) => rowIds.has(productionOrderId)),
  )
  const markerCount = new Set(generatedSpreadingOrders.map((order) => order.markerPlanId)).size
  const spreadingCount = generatedSpreadingOrders.length
  const waitingSpreadingCount = generatedSpreadingOrders.filter((order) => order.status === 'WAITING_SPREADING').length
  const activeSpreadingCount = generatedSpreadingOrders.filter((order) => order.status === 'SPREADING').length
  const cutDoneCount = generatedSpreadingOrders.filter((order) => order.status === 'CUT_DONE').length
  const ticketCount = rows.filter((row) => row.pieceCompletionSummary.key !== 'NOT_STARTED').length
  const replenishmentCount = rows.filter((row) => row.riskTags.some((tag) => tag.key === 'REPLENISH_PENDING')).length
  const warehouseCount = rows.filter((row) => row.hasInboundRecord).length

  const cards = [
    { label: '中转仓配料', value: `${configuredCount}/${total} 有配料数量` },
    { label: '裁床领料', value: `${claimedCount}/${total} 有领料记录` },
    { label: '唛架方案', value: `${markerCount} 个已确认` },
    { label: '铺布单', value: `${spreadingCount} 张，待铺布 ${waitingSpreadingCount} / 铺布中 ${activeSpreadingCount} / 已裁剪 ${cutDoneCount}` },
    { label: '菲票', value: `${ticketCount}/${total} 已生成` },
    { label: '补料记录', value: replenishmentCount ? `${replenishmentCount} 条待处理` : '正常' },
    { label: '待交出仓库存', value: `${warehouseCount}/${total} 有入仓记录` },
  ]

  return `
    <section class="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
      ${cards
        .map(
          (card) => `
            <article class="rounded-lg border bg-card px-4 py-3">
              <div class="text-xs text-muted-foreground">${escapeHtml(card.label)}</div>
              <div class="mt-2 text-base font-semibold text-foreground">${escapeHtml(card.value)}</div>
            </article>
          `,
        )
        .join('')}
    </section>
  `
}

const PRODUCTION_PROGRESS_TABLE_HEADERS = [
  '紧急程度',
  '生产单号',
  '款号 / SPU',
  '下单件数',
  '计划发货日期',
  '中转仓配料',
  '裁床领料',
  '裁片单数',
  '当前进展',
  '部位差异',
  '风险提示',
  '操作',
] as const

const CUT_ORDER_PROGRESS_TABLE_HEADERS = [
  '裁片单',
  '生产单与款式',
  '面料 / 纸样',
  '数量账',
  '主状态与判断',
  '作业关系',
  '交出 / 缺口',
  '操作',
] as const

function renderViewDimensionActions(): string {
  return `
    <div class="inline-flex rounded-md border bg-card">
      <button
        type="button"
        class="px-3 py-2 text-sm ${state.viewDimension === 'CUT_ORDER' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
        data-cutting-progress-action="switch-view-dimension"
        data-view-dimension="CUT_ORDER"
      >
        裁片单维度
      </button>
      <button
        type="button"
        class="border-l px-3 py-2 text-sm ${state.viewDimension === 'PRODUCTION_ORDER' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
        data-cutting-progress-action="switch-view-dimension"
        data-view-dimension="PRODUCTION_ORDER"
      >
        生产单维度
      </button>
    </div>
  `
}

function renderSkuCompletionSection(row: ProductionProgressRow): string {
  const rows = row.skuProgressLines
  if (!rows.length) {
    return `
      <section class="rounded-lg border bg-card p-4">
        <div class="flex items-center justify-between gap-4">
          <h3 class="text-sm font-semibold">当前进展</h3>
        </div>
        <div class="mt-3 text-sm text-muted-foreground">当前尚未形成 SKU 明细。</div>
      </section>
    `
  }

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between gap-4">
        <h3 class="text-sm font-semibold">当前进展</h3>
        <div class="flex flex-wrap gap-2">
          ${renderMetricChip('SKU 总数', String(row.skuTotalCount))}
          ${renderMetricChip('已完成 SKU', String(row.completedSkuCount), row.completedSkuCount < row.skuTotalCount ? 'text-blue-600' : 'text-emerald-600')}
          ${renderMetricChip('未完成 SKU', String(row.incompleteSkuCount), row.incompleteSkuCount > 0 ? 'text-amber-600' : 'text-emerald-600')}
        </div>
      </div>
      <div class="mt-4 overflow-x-auto">
        <table class="w-full min-w-[860px] text-sm">
          <thead class="border-b bg-muted/30 text-muted-foreground">
            <tr>
              <th class="px-4 py-3 text-left font-medium">SKU 名称&编码</th>
              <th class="px-4 py-3 text-left font-medium">需求成衣件数（件）</th>
              <th class="px-4 py-3 text-left font-medium">已裁裁片片数（片）</th>
              <th class="px-4 py-3 text-left font-medium">已入仓裁片片数（片）</th>
              <th class="px-4 py-3 text-left font-medium">完成状态</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (item) => `
                  <tr class="border-b last:border-b-0 align-top">
                    <td class="px-4 py-3">
                      <div class="font-medium">${escapeHtml(item.skuLabel || item.skuDetailLabel || '-')}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.skuDetailLabel || '-')}</div>
                    </td>
                    <td class="px-4 py-3 font-medium tabular-nums">${formatQty(item.demandQty)}</td>
                    <td class="px-4 py-3 tabular-nums">${formatQty(item.cutQty)}</td>
                    <td class="px-4 py-3 tabular-nums">${formatQty(item.inboundQty)}</td>
                    <td class="px-4 py-3">
                      ${renderBadge(
                        item.completionLabel,
                        item.completionClassName.includes('emerald')
                          ? 'bg-emerald-100 text-emerald-700'
                          : item.completionClassName.includes('orange')
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700',
                      )}
                    </td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderPieceGapSection(row: ProductionProgressRow): string {
  const rows = row.pieceTruth.gapRows.filter((item) => Number(item.gapCutQty || 0) > 0 || Number(item.gapInboundQty || 0) > 0)
  if (!rows.length) {
    return `
      <section class="rounded-lg border bg-card p-4">
        <div class="flex items-center justify-between gap-4">
          <h3 class="text-sm font-semibold">部位差异</h3>
          <div class="flex flex-wrap gap-2">
            ${renderMetricChip('已完成部位片数', formatQty(row.partDifferenceSummary.completedPieceQty), 'text-emerald-700')}
            ${renderMetricChip('未完成部位片数', formatQty(row.partDifferenceSummary.incompletePieceQty), row.partDifferenceSummary.incompletePieceQty > 0 ? 'text-amber-700' : 'text-slate-900')}
          </div>
        </div>
        <div class="mt-3 text-sm text-muted-foreground">当前无未完成部位。</div>
      </section>
    `
  }

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between gap-4">
        <h3 class="text-sm font-semibold">部位差异</h3>
        <div class="flex flex-wrap gap-2">
          ${renderMetricChip('已完成部位片数', formatQty(row.partDifferenceSummary.completedPieceQty), 'text-emerald-700')}
          ${renderMetricChip('未完成部位片数', formatQty(row.partDifferenceSummary.incompletePieceQty), 'text-amber-700')}
        </div>
      </div>
      <div class="mt-4 overflow-x-auto">
        <table class="w-full min-w-[1080px] text-sm">
          <thead class="border-b bg-muted/30 text-muted-foreground">
            <tr>
              <th class="px-4 py-3 text-left font-medium">裁片单号</th>
              <th class="px-4 py-3 text-left font-medium">面料</th>
              <th class="px-4 py-3 text-left font-medium">SKU</th>
              <th class="px-4 py-3 text-left font-medium">部位名称</th>
              <th class="px-4 py-3 text-left font-medium">理论片数</th>
              <th class="px-4 py-3 text-left font-medium">未完成片数</th>
              <th class="px-4 py-3 text-left font-medium">实际产出</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (item) => `
                  <tr class="border-b last:border-b-0 align-top">
                    <td class="px-4 py-3 font-medium">${escapeHtml(resolveGapRowCutOrderNo(row, item))}</td>
                    <td class="px-4 py-3">
                      ${renderMaterialIdentityBlock(
                        {
                          materialSku: item.materialSku,
                          materialName: findProgressMaterialIdentity(row, item.materialSku)?.materialName || '部位差异面料',
                          materialColor: findProgressMaterialIdentity(row, item.materialSku)?.materialColor || '',
                          materialAlias: findProgressMaterialIdentity(row, item.materialSku)?.materialAlias || '',
                          materialImageUrl: findProgressMaterialIdentity(row, item.materialSku)?.materialImageUrl || '',
                          materialUnit: findProgressMaterialIdentity(row, item.materialSku)?.materialUnit || '',
                        },
                        { compact: true, imageSizeClass: 'h-9 w-9', showCategory: false },
                      )}
                    </td>
                    <td class="px-4 py-3">
                      <div class="font-medium">${escapeHtml(item.skuCode || `${item.color}/${item.size}`)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(`${item.color} / ${item.size}`)}</div>
                    </td>
                    <td class="px-4 py-3">
                      <div class="font-medium">${escapeHtml(item.partName)}</div>
                      ${item.patternName ? `<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.patternName)}</div>` : ''}
                    </td>
                    <td class="px-4 py-3 tabular-nums">${formatQty(item.requiredPieceQty)}</td>
                    <td class="px-4 py-3">
                      <div class="font-medium tabular-nums ${item.gapCutQty > 0 ? 'text-rose-600' : 'text-amber-600'}">
                        ${formatQty(item.gapCutQty > 0 ? item.gapCutQty : item.gapInboundQty)}
                      </div>
                    </td>
                    <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.currentStateLabel)}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderSourceOrderSection(row: ProductionProgressRow): string {
  const rows = row.sourceOrderProgressLines
  if (!rows.length) {
    return `
      <section class="rounded-lg border bg-card p-4">
        <div class="flex items-center justify-between gap-4">
          <h3 class="text-sm font-semibold">来源裁片单</h3>
          <span class="text-xs text-muted-foreground">暂无来源裁片单</span>
        </div>
      </section>
    `
  }

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between gap-4">
        <h3 class="text-sm font-semibold">来源裁片单</h3>
        ${renderMetricChip('裁片单数', String(row.cutOrderCount), 'text-slate-900')}
      </div>
      <div class="mt-4 overflow-x-auto">
        <table class="w-full min-w-[1080px] text-sm">
          <thead class="border-b bg-muted/30 text-muted-foreground">
            <tr>
              <th class="px-4 py-3 text-left font-medium">裁片单号</th>
              <th class="px-4 py-3 text-left font-medium">面料</th>
              <th class="px-4 py-3 text-left font-medium">纸样</th>
              <th class="px-4 py-3 text-left font-medium">承接 SKU 数</th>
              <th class="px-4 py-3 text-left font-medium">未完成部位片数</th>
              <th class="px-4 py-3 text-left font-medium">实际产出</th>
              <th class="px-4 py-3 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (item) => `
                  <tr class="border-b last:border-b-0 align-top">
                    <td class="px-4 py-3 font-medium">${escapeHtml(item.cutOrderNo)}</td>
                    <td class="px-4 py-3">
                      ${renderMaterialIdentityBlock(
                        {
                          materialSku: item.materialSku,
                          materialName: item.materialName,
                          materialColor: item.materialColor,
                          materialAlias: item.materialAlias,
                          materialImageUrl: item.materialImageUrl,
                          materialUnit: item.materialUnit,
                        },
                        { compact: true, imageSizeClass: 'h-9 w-9', showCategory: false },
                      )}
                    </td>
                    <td class="px-4 py-3">
                      <div class="space-y-1 text-xs">
                        <div class="text-sm font-medium text-foreground">${escapeHtml(item.patternFileName || '待补纸样文件')}</div>
                        <div class="text-muted-foreground">版本：${escapeHtml(item.patternVersion || '待补')}</div>
                        <div class="text-muted-foreground">有效幅宽：${escapeHtml(item.effectiveWidthText || '待补')}</div>
                      </div>
                    </td>
                    <td class="px-4 py-3 tabular-nums">${formatQty(item.skuCount)}</td>
                    <td class="px-4 py-3 tabular-nums">${formatQty(item.incompletePieceQty)}</td>
                    <td class="px-4 py-3">${escapeHtml(item.currentStateLabel)}</td>
                    <td class="px-4 py-3">
                      <button class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-progress-action="go-cut-orders" data-record-id="${row.id}">查看裁片单</button>
                    </td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderMappingWarningSection(row: ProductionProgressRow): string {
  const mappingIssues = row.pieceTruth.mappingIssues
  const dataIssues = row.pieceTruth.dataIssues
  const issues = [...mappingIssues, ...dataIssues]
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between gap-4">
        <h3 class="text-sm font-semibold">映射与数据问题</h3>
        ${
          issues.length
            ? renderMetricChip('问题项', String(issues.length), 'text-amber-600')
            : '<span class="text-xs text-muted-foreground">当前无问题</span>'
        }
      </div>
      ${
        issues.length
          ? `
            <div class="mt-3 space-y-2">
              ${issues
                .map(
                  (issue) => `
                    <div class="rounded-lg border ${issue.level === 'mapping' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'} px-3 py-2 text-xs">
                      <div class="font-medium ${issue.level === 'mapping' ? 'text-amber-700' : 'text-slate-700'}">${escapeHtml(issue.level === 'mapping' ? '映射缺失' : '数据待补')}</div>
                      <div class="mt-1 text-muted-foreground">${escapeHtml(issue.message)}</div>
                    </div>
                  `,
                )
                .join('')}
            </div>
          `
          : ''
      }
    </section>
  `
}

function renderProductionOrderTable(rows: ProductionProgressRow[]): string {
  const pagination = paginateItems(rows, state.page, state.pageSize)
  const columnCount = PRODUCTION_PROGRESS_TABLE_HEADERS.length

  return `
    <section class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold">生产单主表</h2>
          <div class="mt-1 text-xs text-muted-foreground">汇总查看当前生产单在裁床的整体推进情况。</div>
        </div>
        <div class="text-xs text-muted-foreground">共 ${pagination.total} 条生产单</div>
      </div>
      ${renderStickyTableScroller(
        `
          <table class="w-full min-w-[1440px] text-sm" data-testid="cutting-production-progress-main-table">
            <thead class="sticky top-0 z-10 border-b bg-muted/95 text-muted-foreground backdrop-blur">
              <tr>
                ${PRODUCTION_PROGRESS_TABLE_HEADERS.map(
                  (header) => `<th class="px-4 py-3 text-left font-medium">${header}</th>`,
                ).join('')}
              </tr>
            </thead>
            <tbody>
              ${
                pagination.items.length
                  ? pagination.items
                      .map(
                        (row) => `
                          <tr class="border-b last:border-b-0 align-top hover:bg-muted/20">
                            <td class="px-4 py-3">
                              <div>${renderBadge(row.urgency.label, row.urgency.className)}</div>
                              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.shipCountdownText)}</div>
                            </td>
                            <td class="px-4 py-3">
                              <button class="font-medium text-blue-600 hover:underline" data-nav="${escapeHtml(buildProductionProgressDetailPath(row.id))}">
                                ${escapeHtml(row.productionOrderNo)}
                              </button>
                              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(formatFactoryDisplayName(row.assignedFactoryName))}</div>
                            </td>
                            <td class="px-4 py-3">
                              <div class="font-medium text-foreground">${escapeHtml(row.styleCode || row.spuCode || '-')}</div>
                              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.styleName || row.spuCode || '-')}</div>
                            </td>
                            <td class="px-4 py-3 font-medium tabular-nums">${formatQty(row.orderQty)}</td>
                            <td class="px-4 py-3">
                              <div>${escapeHtml(row.plannedShipDateDisplay)}</div>
                            </td>
                            <td class="px-4 py-3">${renderPrepProgressCell(row)}</td>
                            <td class="px-4 py-3">${renderClaimProgressCell(row)}</td>
                            <td class="px-4 py-3 font-medium">${row.cutOrderCount}</td>
                            <td class="px-4 py-3">${renderSkuProgressCell(row)}</td>
                            <td class="px-4 py-3">${renderPartDifferenceCell(row)}</td>
                            <td class="px-4 py-3">${renderRiskCell(row)}</td>
                            <td class="px-4 py-3">
                              <div class="flex flex-wrap gap-2">
                                <button class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildProductionProgressDetailPath(row.id))}">查看详情</button>
                                <button class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-progress-action="go-marker-spreading" data-record-id="${row.id}">去铺布</button>
                              </div>
                            </td>
                          </tr>
                        `,
                      )
                      .join('')
                  : `<tr><td colspan="${columnCount}" class="px-6 py-12 text-center text-sm text-muted-foreground">当前筛选条件下暂无匹配生产单。</td></tr>`
              }
            </tbody>
          </table>
        `,
        'max-h-[64vh]',
      )}
      ${renderWorkbenchPagination({
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        actionAttr: 'data-cutting-progress-action',
        pageAction: 'set-page',
        pageSizeAttr: 'data-cutting-progress-page-size',
      })}
    </section>
  `
}

function renderCutOrderTable(rows: ProductionProgressRow[]): string {
  const cutOrderRows = buildCutOrderDimensionRows(rows)
  const pagination = paginateItems(cutOrderRows, state.page, state.pageSize)
  const columnCount = CUT_ORDER_PROGRESS_TABLE_HEADERS.length

  return `
    <section class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold">裁片单主表</h2>
          <div class="mt-1 text-xs text-muted-foreground">默认按裁片单维度查看待加工入仓、铺布裁剪、特殊工艺回仓和交出记录。</div>
        </div>
        <div class="text-xs text-muted-foreground">共 ${pagination.total} 条裁片单</div>
      </div>
      ${renderStickyTableScroller(
        `
          <table class="w-full table-fixed text-sm" data-testid="cutting-production-progress-cut-order-table">
            <thead class="sticky top-0 z-10 border-b bg-muted/95 text-muted-foreground backdrop-blur">
              <tr>
                <th class="w-[13%] px-4 py-3 text-left font-medium">裁片单</th>
                <th class="w-[14%] px-4 py-3 text-left font-medium">生产单与款式</th>
                <th class="w-[19%] px-4 py-3 text-left font-medium">面料 / 纸样</th>
                <th class="w-[17%] px-4 py-3 text-left font-medium">数量账</th>
                <th class="w-[13%] px-4 py-3 text-left font-medium">主状态与判断</th>
                <th class="w-[12%] px-4 py-3 text-left font-medium">作业关系</th>
                <th class="w-[8%] px-4 py-3 text-left font-medium">交出 / 缺口</th>
                <th class="w-[4%] px-4 py-3 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              ${
                pagination.items.length
                  ? pagination.items
                      .map(
                        (item) => `
                          <tr class="border-b last:border-b-0 align-top hover:bg-muted/20">
                            <td class="px-4 py-3">
                              <div class="font-medium text-blue-600">${escapeHtml(item.cutOrderNo)}</div>
                              <div class="mt-1">${renderBadge(item.urgencyLabel, item.urgencyClassName)}</div>
                              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.plannedShipDateDisplay)}</div>
                            </td>
                            <td class="px-4 py-3">
                              <button class="font-medium text-blue-600 hover:underline" data-nav="${escapeHtml(buildProductionProgressDetailPath(item.parentRecordId))}">
                                ${escapeHtml(item.productionOrderNo)}
                              </button>
                              <div class="font-medium text-foreground">${escapeHtml(item.styleLabel)}</div>
                              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.styleName)}</div>
                              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(formatFactoryDisplayName(item.factoryName))}</div>
                            </td>
                            <td class="px-4 py-3">
                              <div class="space-y-2">
                                ${renderMaterialIdentityBlock(
                                  item.quantityLedger.materialIdentity,
                                  { compact: true, imageSizeClass: 'h-9 w-9', showCategory: false },
                                )}
                                <div class="text-xs text-muted-foreground">
                                  <div>${escapeHtml(item.quantityLedger.patternIdentity.patternFileName || '待补纸样文件')}</div>
                                  <div>版本：${escapeHtml(item.quantityLedger.patternIdentity.patternVersion || '待补')} / 幅宽：${escapeHtml(`${item.quantityLedger.patternIdentity.effectiveWidthValue || '待补'}${item.quantityLedger.patternIdentity.effectiveWidthUnit || ''}`)}</div>
                                </div>
                              </div>
                            </td>
                            <td class="px-4 py-3">
                              ${renderMaterialLedgerLine(item.quantityLedger, [
                                ['需求用量', 'requiredMaterialQty'],
                                ['中转仓已配数量', 'transferWarehouseAllocatedQty'],
                                ['裁床已领数量', 'cuttingClaimedQty'],
                                ['已锁定数量', 'markerLockedQty'],
                                ['已消耗数量', 'spreadingConsumedQty'],
                                ['可用余额', 'availableQty'],
                              ])}
                            </td>
                            <td class="px-4 py-3">
                              <div class="space-y-2">
                                ${renderBadge(item.mainStatusLabel, item.mainStatusClassName)}
                                ${renderBadge(item.cuttableLabel, item.cuttableClassName)}
                                <div class="text-xs leading-5 text-muted-foreground">
                                  <div>判断原因：${escapeHtml(item.cuttableReasonText)}</div>
                                  ${item.closeReason ? `<div>关闭原因：${escapeHtml(item.closeReasonText || item.closeReason)}</div>` : ''}
                                </div>
                              </div>
                            </td>
                            <td class="px-4 py-3">
                              <div class="space-y-1 text-xs text-muted-foreground">
                                <div>唛架方案：${escapeHtml(item.markerRelationText)}</div>
                                <div>${escapeHtml(item.operationResultText)}</div>
                                <div>特殊工艺未回仓：${escapeHtml(item.specialCraftReturnLabel)}${item.specialCraftReturnDetail ? ` · ${escapeHtml(item.specialCraftReturnDetail)}` : ''}</div>
                              </div>
                            </td>
                            <td class="px-4 py-3">
                              <div class="space-y-1 text-xs text-muted-foreground">
                                <div>交出单：${escapeHtml(item.sewingDispatchLabel)}</div>
                                <div>${escapeHtml(item.sewingDispatchDetail || '暂无袋级 / 菲票级回写')}</div>
                                <div>待处理差异：${escapeHtml(`${item.pendingDifferenceCount} 项`)}</div>
                                <div class="${item.blockingText === '暂无风险' ? 'text-emerald-700' : 'text-amber-700'}">${escapeHtml(item.blockingText)}</div>
                              </div>
                            </td>
                            <td class="px-4 py-3">
                              <div class="flex flex-col gap-1">
                                <button class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildProductionProgressDetailPath(item.parentRecordId))}">查看详情</button>
                              </div>
                            </td>
                          </tr>
                        `,
                      )
                      .join('')
                  : `<tr><td colspan="${columnCount}" class="px-6 py-12 text-center text-sm text-muted-foreground">当前筛选条件下暂无匹配裁片单。</td></tr>`
              }
            </tbody>
          </table>
        `,
        'max-h-[64vh]',
      )}
      ${renderWorkbenchPagination({
        currentPage: pagination.page,
        totalPages: pagination.totalPages,
        pageSize: state.pageSize,
        pageSizeOptions: [10, 20, 50],
      })}
    </section>
  `
}

function renderMainTable(rows: ProductionProgressRow[]): string {
  return state.viewDimension === 'CUT_ORDER'
    ? renderCutOrderTable(rows)
    : renderProductionOrderTable(rows)
}

function renderProductionProgressDetailPanel(row: ProductionProgressRow): string {
  const content = `
    <div class="space-y-6">
      <section class="grid gap-3 rounded-lg border bg-muted/10 p-4 sm:grid-cols-2 xl:grid-cols-4">
        ${renderDetailSummaryItem('生产单号', row.productionOrderNo)}
        ${renderDetailSummaryItem('款号 / SPU', row.styleCode || row.spuCode || '-')}
        ${renderDetailSummaryItem('款式名称', row.styleName || '-')}
        ${renderDetailSummaryItem('工厂', formatFactoryDisplayName(row.assignedFactoryName) || '-')}
        ${renderDetailSummaryItem('本单成衣件数（件）', formatQty(row.orderQty))}
        ${renderDetailSummaryItem('计划发货日期', row.plannedShipDateDisplay)}
        ${renderDetailSummaryItem('紧急程度', `${row.urgency.label} · ${row.shipCountdownText}`)}
        ${renderDetailSummaryItem('裁片单数', formatQty(row.cutOrderCount))}
        ${renderDetailSummaryItem('补料配料待处理', buildPendingPrepSummaryText(row))}
      </section>

      ${renderFullChainDetailSection(row)}
      ${renderSampleWarehouseProgressSection(row)}
      ${renderMaterialProgressSection(row)}
      ${renderProductionPartFlowSection(row)}
      ${renderSkuCompletionSection(row)}
      ${renderPieceGapSection(row)}
      ${renderSourceOrderSection(row)}
      ${renderRiskPromptSection(row)}
    </div>
  `

  return `
    <article class="space-y-4" data-testid="cutting-production-progress-detail-page">
      <div class="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-card p-4">
        <div>
          <p class="text-sm text-muted-foreground">生产单详情</p>
          <h1 class="text-2xl font-semibold text-foreground">${escapeHtml(row.productionOrderNo)}</h1>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(row.styleName || row.styleCode || row.spuCode || '裁床生产单')}</p>
        </div>
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(getCanonicalCuttingPath('production-progress'))}">返回裁床生产单总览</button>
      </div>
      ${content}
    </article>
  `
}

export function renderCraftCuttingProductionProgressPage(): string {
  syncDrillContextFromPath()
  const pathname = appStore.getState().pathname
  const meta = getCanonicalCuttingMeta(pathname, 'production-progress')
  const rows = getDisplayRows()

  return `
    <div class="space-y-3 p-4">
      ${renderCuttingPageHeader(meta, {
        actionsHtml: renderViewDimensionActions(),
        showAliasBadge: isCuttingAliasPath(pathname),
      })}

      ${renderStatsCards(rows)}
      ${renderFullChainOverviewCards(rows)}

      ${renderStickyFilterShell(`
        <div class="space-y-3">
          ${renderQuickFilterRow()}
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
            <label class="space-y-2 md:col-span-2 xl:col-span-2">
              <span class="text-sm font-medium text-foreground">关键词</span>
              <input
                type="text"
                value="${escapeHtml(state.filters.keyword)}"
                placeholder="支持生产单号 / 款号 / SPU"
                class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                data-cutting-progress-field="keyword"
              />
            </label>
            <label class="space-y-2">
              <span class="text-sm font-medium text-foreground">生产单号</span>
              <input
                type="text"
                value="${escapeHtml(state.filters.productionOrderNo)}"
                placeholder="PO-..."
                class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                data-cutting-progress-field="production-order"
              />
            </label>
            ${renderFilterSelect('完成状态', 'completion', state.filters.completionState, [
              { value: 'ALL', label: '全部' },
              { value: 'IN_PROGRESS', label: '进行中' },
              { value: 'COMPLETED', label: '已完成' },
              { value: 'DATA_PENDING', label: '数据待补' },
              { value: 'HAS_EXCEPTION', label: '有异常' },
            ])}
            ${renderFilterSelect('紧急程度', 'urgency', state.filters.urgencyLevel, [
              { value: 'ALL', label: '全部' },
              { value: 'AA', label: 'AA 紧急' },
              { value: 'A', label: 'A 紧急' },
              { value: 'B', label: 'B 紧急' },
              { value: 'C', label: 'C 优先' },
              { value: 'D', label: 'D 常规' },
              { value: 'UNKNOWN', label: '待补日期' },
            ])}
            ${renderFilterSelect('与计划发货相比', 'ship-delta', state.filters.shipDeltaRange, [
              { value: 'ALL', label: '全部' },
              { value: 'BEFORE_0_3', label: '距计划发货 0~3 天' },
              { value: 'BEFORE_4_6', label: '距计划发货 4~6 天' },
              { value: 'BEFORE_7_9', label: '距计划发货 7~9 天' },
              { value: 'BEFORE_10_13', label: '距计划发货 10~13 天' },
              { value: 'BEFORE_14_PLUS', label: '距计划发货 14 天以上' },
              { value: 'OVERDUE_0_3', label: '超计划发货 0~3 天' },
              { value: 'OVERDUE_4_6', label: '超计划发货 4~6 天' },
              { value: 'OVERDUE_7_PLUS', label: '超计划发货 7 天以上' },
              { value: 'SHIP_DATE_MISSING', label: '计划发货日期待补' },
            ])}
            ${renderFilterSelect('裁床主状态', 'stage', state.filters.currentStage, [
              { value: 'ALL', label: '全部' },
              { value: 'NOT_STARTED', label: '未开工' },
              { value: 'STARTED', label: '已开工' },
            ])}
            ${renderFilterSelect('中转仓配料', 'config', state.filters.configStatus, [
              { value: 'ALL', label: '全部' },
              { value: 'NOT_CONFIGURED', label: '无配料数量' },
              { value: 'PARTIAL', label: '配料数量不足' },
              { value: 'CONFIGURED', label: '有配料数量' },
            ])}
            ${renderFilterSelect('裁床领料', 'claim', state.filters.receiveStatus, [
              { value: 'ALL', label: '全部' },
              { value: 'NOT_RECEIVED', label: '未产生领料记录' },
              { value: 'PARTIAL', label: '领料数量不足' },
              { value: 'RECEIVED', label: '有领料记录' },
              { value: 'EXCEPTION', label: '领料差异' },
            ])}
            ${renderFilterSelect('风险状态', 'risk', state.filters.riskFilter, [
              { value: 'ALL', label: '全部' },
              { value: 'ANY', label: '仅看有风险' },
              { value: 'CONFIG_DELAY', label: '中转仓滞后' },
              { value: 'SHIP_URGENT', label: '临近发货' },
              { value: 'REPLENISH_PENDING', label: '待补料' },
              { value: 'PIECE_GAP', label: '裁片缺口' },
            ])}
            ${renderFilterSelect('排序', 'sort', state.filters.sortBy, [
              { value: 'URGENCY_THEN_SHIP', label: '默认：紧急程度 + 发货时间' },
              { value: 'SHIP_DATE_ASC', label: '计划发货日期升序' },
              { value: 'ORDER_QTY_DESC', label: '本单成衣件数降序' },
            ])}
          </div>
        </div>
      `)}

      ${renderActiveStateBar()}
      ${renderMainTable(rows)}
    </div>
  `
}

export function renderCraftCuttingProductionProgressDetailPage(recordId?: string): string {
  const row = getAllRows().find((item) => item.id === decodeURIComponent(recordId || ''))
  if (!row) {
    return `
      <div class="space-y-4 p-4" data-testid="cutting-production-progress-detail-page">
        <section class="rounded-xl border bg-card p-8 text-center">
          <h1 class="text-xl font-semibold text-foreground">生产单详情</h1>
          <p class="mt-2 text-sm text-muted-foreground">未找到对应生产单详情，请返回裁床生产单总览重新选择。</p>
          <button type="button" class="mt-4 rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(getCanonicalCuttingPath('production-progress'))}">返回裁床生产单总览</button>
        </section>
      </div>
    `
  }

  return `<div class="space-y-4 p-4">${renderProductionProgressDetailPanel(row)}</div>`
}

function findRowById(recordId: string | undefined): ProductionProgressRow | undefined {
  if (!recordId) return undefined
  return getAllRows().find((row) => row.id === recordId)
}

function navigateToRecordTarget(recordId: string | undefined, key: CuttingCanonicalPageKey): boolean {
  const row = findRowById(recordId)
  if (!row) return false

  const payload =
    key === 'spreading-list' || key === 'marker-spreading' || key === 'marker-list'
        ? row.filterPayloadForMarkerSpreading
        : key === 'fei-tickets'
          ? row.filterPayloadForFeiTickets
      : key === 'cuttable-pool'
        ? row.filterPayloadForCuttablePool
        : key === 'summary'
          ? row.filterPayloadForSummary
          : row.filterPayloadForCutOrders

  const context = buildCuttingDrillContext(payload, 'production-progress', {
    productionOrderId: row.productionOrderId,
    productionOrderNo: row.productionOrderNo,
    autoOpenDetail: true,
  })
  appStore.navigate(buildCuttingRouteWithContext(
    key === 'summary'
      ? 'summary'
      : key === 'cut-orders'
        ? 'cutOrders'
        : key === 'cuttable-pool'
            ? 'cuttablePool'
            : key === 'spreading-list' || key === 'marker-spreading'
              ? 'markerSpreading'
              : key === 'marker-list'
                ? 'markerPlan'
              : key === 'fei-tickets'
                ? 'feiTickets'
                : 'productionProgress',
    context,
  ))
  return true
}

export function handleCraftCuttingProductionProgressEvent(target: Element): boolean {
  const pageSizeNode = target.closest<HTMLElement>('[data-cutting-progress-page-size]')
  if (pageSizeNode) {
    const input = pageSizeNode as HTMLSelectElement
    state.pageSize = Number(input.value) || 20
    state.page = 1
    return true
  }

  const fieldNode = target.closest<HTMLElement>('[data-cutting-progress-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.cuttingProgressField as FilterField | undefined
    if (!field) return false

    const filterKey = FIELD_TO_FILTER_KEY[field]
    const input = fieldNode as HTMLInputElement | HTMLSelectElement
    state.filters = {
      ...state.filters,
      [filterKey]: input.value,
    }
    resetPagination()
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-cutting-progress-action]')
  const action = actionNode?.dataset.cuttingProgressAction
  if (!action) return false

  if (action === 'toggle-quick-filter') {
    const quickFilter = actionNode.dataset.quickFilter as ProductionProgressQuickFilterExtended | undefined
    if (!quickFilter) return false
    state.activeQuickFilter = state.activeQuickFilter === quickFilter ? null : quickFilter
    resetPagination()
    return true
  }

  if (action === 'clear-filters') {
    state.filters = { ...initialFilters }
    state.viewDimension = 'CUT_ORDER'
    state.activeQuickFilter = null
    resetPagination()
    return true
  }

  if (action === 'clear-prefilter') {
    state.drillContext = null
    state.querySignature = getCanonicalCuttingPath('production-progress')
    state.filters = { ...initialFilters }
    state.activeQuickFilter = null
    state.activeDetailId = null
    appStore.navigate(getCanonicalCuttingPath('production-progress'))
    return true
  }

  if (action === 'open-detail') {
    const recordId = actionNode.dataset.recordId
    if (recordId) appStore.navigate(`/fcs/craft/cutting/production-progress-detail/${encodeURIComponent(recordId)}`)
    return true
  }

  if (action === 'close-detail') {
    state.activeDetailId = null
    return true
  }

  if (action === 'set-page') {
    state.page = Number(actionNode.dataset.page) || 1
    return true
  }

  if (action === 'switch-view-dimension') {
    const nextDimension = actionNode.dataset.viewDimension as ProductionProgressViewDimension | undefined
    if (!nextDimension) return false
    state.viewDimension = nextDimension
    resetPagination()
    return true
  }

  if (action === 'go-cut-orders') {
    return navigateToRecordTarget(actionNode.dataset.recordId, 'cut-orders')
  }

  if (action === 'go-material-prep') {
    const row = findRowById(actionNode.dataset.recordId)
    if (!row) return false
    const context = buildCuttingDrillContext(row.filterPayloadForMaterialPrep, 'production-progress', {
      productionOrderId: row.productionOrderId,
      productionOrderNo: row.productionOrderNo,
      autoOpenDetail: true,
    })
    appStore.navigate(buildCuttingRouteWithContext('materialPrep', context))
    return true
  }

  if (action === 'go-cuttable-pool') {
    return navigateToRecordTarget(actionNode.dataset.recordId, 'cuttable-pool')
  }

  if (action === 'go-marker-spreading') {
    return navigateToRecordTarget(actionNode.dataset.recordId, 'spreading-list')
  }

  if (action === 'go-fei-tickets') {
    return navigateToRecordTarget(actionNode.dataset.recordId, 'fei-tickets')
  }

  if (action === 'go-summary') {
    return navigateToRecordTarget(actionNode.dataset.recordId, 'summary')
  }

  if (action === 'go-cuttable-pool-index') {
    appStore.navigate(getCanonicalCuttingPath('cuttable-pool'))
    return true
  }

  if (action === 'go-summary-index') {
    appStore.navigate(getCanonicalCuttingPath('summary'))
    return true
  }

  if (action === 'return-summary') {
    const context = buildReturnToSummaryContext(state.drillContext)
    if (!context) return false
    appStore.navigate(buildCuttingRouteWithContext('summary', context))
    return true
  }

  return false
}

export function isCraftCuttingProductionProgressDialogOpen(): boolean {
  return state.activeDetailId !== null
}

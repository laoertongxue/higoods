// production-progress 是 canonical 页面文件。
import { renderDrawer as uiDrawer } from '../../../components/ui/index.ts'
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
import {
  buildCuttingDrillChipLabels,
  buildCuttingDrillSummary,
  buildCuttingRouteWithContext,
  buildReturnToSummaryContext,
  hasSummaryReturnContext,
  normalizeLegacyCuttingPayload,
  readCuttingDrillContextFromLocation,
  type CuttingDrillContext,
  type CuttingNavigationTarget,
} from './navigation-context.ts'
import { buildProductionProgressProjection } from './production-progress-projection.ts'
import { getCuttingSpecialCraftReturnStatusByProductionOrder } from '../../../data/fcs/cutting/special-craft-fei-ticket-flow.ts'
import { getCuttingSewingDispatchProgressByProductionOrder } from '../../../data/fcs/cutting/sewing-dispatch.ts'
import { getCuttingProgressSnapshots } from '../../../data/fcs/progress-statistics-linkage.ts'

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
  originalCutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  styleLabel: string
  styleName: string
  materialSku: string
  factoryName: string
  relatedQty: number
  plannedShipDateDisplay: string
  urgencyLabel: string
  urgencyClassName: string
  prepLabel: string
  prepClassName: string
  pickupLabel: string
  pickupClassName: string
  cuttingLabel: string
  cuttingClassName: string
  feiTicketLabel: string
  feiTicketClassName: string
  specialCraftReturnLabel: string
  specialCraftReturnDetail: string
  sewingDispatchLabel: string
  sewingDispatchDetail: string
  blockingText: string
  parentRecordId: string
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
  if (label.includes('已') || label.includes('齐套') || label.includes('可发')) {
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

function formatBundleSummary(lengthValues: number[], widthValues: number[]): string {
  if (!lengthValues.length && !widthValues.length) return ''
  const lengthText = lengthValues.length ? `长 ${lengthValues.join(' / ')} 厘米` : ''
  const widthText = widthValues.length ? `宽 ${widthValues.join(' / ')} 厘米` : ''
  return [lengthText, widthText].filter(Boolean).join(' · ')
}

function getCutOrderRelatedQty(row: ProductionProgressRow, originalCutOrderNo: string, materialSku: string): number {
  const skuQtyMap = new Map<string, number>()
  row.pieceTruth.requirementRows
    .filter((item) => item.originalCutOrderNo === originalCutOrderNo && item.materialSku === materialSku)
    .forEach((item) => {
      const skuKey = [item.skuCode, item.color, item.size].join('::')
      const current = skuQtyMap.get(skuKey) || 0
      skuQtyMap.set(skuKey, Math.max(current, item.requiredGarmentQty))
    })
  return Array.from(skuQtyMap.values()).reduce((sum, value) => sum + value, 0)
}

function buildCutOrderDimensionRows(rows: ProductionProgressRow[]): CutOrderDimensionRow[] {
  const snapshotMap = new Map(getCuttingProgressSnapshots().map((item) => [item.productionOrderId, item] as const))

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

      return {
        rowId: `${row.id}::${sourceLine.originalCutOrderNo}::${sourceLine.materialSku}`,
        parentRowId: row.id,
        originalCutOrderNo: sourceLine.originalCutOrderNo,
        productionOrderId: row.productionOrderId,
        productionOrderNo: row.productionOrderNo,
        styleLabel: row.styleCode || row.spuCode || '-',
        styleName: row.styleName || row.spuCode || '-',
        materialSku: sourceLine.materialSku || '待补面料 SKU',
        factoryName: row.assignedFactoryName || '-',
        relatedQty: getCutOrderRelatedQty(row, sourceLine.originalCutOrderNo, sourceLine.materialSku),
        plannedShipDateDisplay: row.plannedShipDateDisplay,
        urgencyLabel: row.urgency.label,
        urgencyClassName: row.urgency.className,
        prepLabel: row.materialPrepSummary.label,
        prepClassName: row.materialPrepSummary.className,
        pickupLabel: row.materialClaimSummary.label,
        pickupClassName: row.materialClaimSummary.className,
        cuttingLabel: sourceLine.currentStateLabel || row.currentStage.label,
        cuttingClassName: buildStateBadgeClass(sourceLine.currentStateLabel || row.currentStage.label),
        feiTicketLabel: snapshot?.feiTicketProgress.status || '待生成',
        feiTicketClassName: buildStateBadgeClass(snapshot?.feiTicketProgress.status || '待生成'),
        specialCraftReturnLabel: snapshot?.specialCraftReturnProgress.status || '待确认',
        specialCraftReturnDetail: specialCraftDetailParts.join(' · '),
        sewingDispatchLabel: snapshot?.sewingDispatchProgress.status || '待发料',
        sewingDispatchDetail: sewingDispatchDetailParts.join(' · '),
        blockingText:
          snapshot?.blockingReasons.length
            ? snapshot.blockingReasons.map((item) => item.blockingLabel).join('、')
            : row.riskTags.map((item) => item.label).join('、') || '暂无阻塞',
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
  const originalOrderIdSet = new Set(
    row.sourceOrderProgressLines
      .map((item) => item.originalCutOrderId)
      .filter((value): value is string => Boolean(value)),
  )
  const originalOrderNoSet = new Set(
    row.sourceOrderProgressLines
      .map((item) => item.originalCutOrderNo)
      .filter((value): value is string => Boolean(value)),
  )

  return readPendingPrepFollowups().filter(
    (item) => originalOrderIdSet.has(item.originalCutOrderId) || originalOrderNoSet.has(item.originalCutOrderNo),
  )
}

function buildPendingPrepSummaryText(row: ProductionProgressRow): string {
  const followups = getPendingPrepFollowupsForRow(row)
  if (!followups.length) return '当前无补料待配料'
  const latest = followups[0]
  return `补料待配料 ${followups.length} 条（来源铺布 ${latest?.sourceSpreadingSessionId || '待补'} / 来源补料单 ${latest?.sourceReplenishmentRequestId || '待补'}）`
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
      return rows.filter((row) => row.currentStage.key === 'CUTTING' || row.currentStage.key === 'WAITING_INBOUND')
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
  if (filter === 'CLAIM_EXCEPTION') return '快捷筛选：只看领料异常'
  if (filter === 'CUTTING_ACTIVE') return '快捷筛选：只看裁剪中'
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
  if (state.filters.currentStage !== 'ALL') labels.push(`当前阶段：${stageMeta[state.filters.currentStage].label}`)
  if (state.filters.completionState !== 'ALL') labels.push(`完成状态：${completionLabelMap[state.filters.completionState]}`)
  if (state.filters.configStatus !== 'ALL') labels.push(`配料进展：${configMeta[state.filters.configStatus].label}`)
  if (state.filters.receiveStatus !== 'ALL') labels.push(`领料进展：${receiveMeta[state.filters.receiveStatus].label}`)
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

  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      ${renderCompactKpiCard('生产单总数', summary.totalCount, '当前筛选范围', 'text-slate-900')}
      ${renderCompactKpiCard('临近发货生产单', summary.urgentCount, '需优先跟进交付', 'text-rose-600')}
      ${renderCompactKpiCard('配料异常单', summary.prepExceptionCount, '配料未齐', 'text-amber-600')}
      ${renderCompactKpiCard('领料异常单', summary.claimExceptionCount, '待领取或现场差异', 'text-orange-600')}
      ${renderCompactKpiCard('裁剪中单数', summary.cuttingCount, '含待入仓', 'text-violet-600')}
      ${renderCompactKpiCard('已完成单数', summary.doneCount, '已完成', 'text-emerald-600')}
    </section>
  `
}

function renderSpecialCraftReturnCards(rows: ProductionProgressRow[]): string {
  const summaries = rows
    .map((row) => getCuttingSpecialCraftReturnStatusByProductionOrder(row.productionOrderId))
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
          <div class="mt-1 text-xs text-muted-foreground">只统计需要特殊工艺的菲票，用于后续裁床统一发料前校验。</div>
        </div>
        <div class="text-sm font-medium ${allReturned ? 'text-emerald-600' : 'text-amber-600'}">是否全部回仓：${allReturned ? '是' : '否'}</div>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderCompactKpiCard('需要特殊工艺菲票数', aggregated.totalNeed, '需经过特殊工艺流转', 'text-slate-900')}
        ${renderCompactKpiCard('待发料菲票数', aggregated.waitDispatch, '裁床厂待交出仓待发料', 'text-amber-600')}
        ${renderCompactKpiCard('已发料菲票数', aggregated.dispatched, '裁床厂已创建交出记录', 'text-blue-600')}
        ${renderCompactKpiCard('已接收菲票数', aggregated.received, '特殊工艺厂已入待加工仓', 'text-cyan-600')}
        ${renderCompactKpiCard('待回仓菲票数', aggregated.waitReturn, '特殊工艺厂待交出仓待回仓', 'text-amber-600')}
        ${renderCompactKpiCard('已回仓菲票数', aggregated.returned, '已回裁床厂待交出仓', 'text-emerald-600')}
        ${renderCompactKpiCard('差异菲票数', aggregated.difference, '发料或回仓存在差异', 'text-rose-600')}
        ${renderCompactKpiCard('异议中菲票数', aggregated.objection, '数量异议处理中', 'text-rose-600')}
      </div>
    </section>
  `
}

function renderSewingDispatchProgressCards(rows: ProductionProgressRow[]): string {
  const summaries = rows.map((row) => getCuttingSewingDispatchProgressByProductionOrder(row.productionOrderId))
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
          <div class="text-sm font-semibold text-foreground">裁片发料汇总</div>
          <div class="mt-1 text-xs text-muted-foreground">统计裁床厂统一发给车缝厂的中转单、中转袋和回写结果。</div>
        </div>
        <div class="text-sm font-medium ${reasons.length ? 'text-amber-600' : 'text-emerald-600'}">是否可继续发料：${reasons.length ? '否' : '是'}</div>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        ${renderCompactKpiCard('生产总数', aggregated.totalProductionQty, '', 'text-slate-900')}
        ${renderCompactKpiCard('累计已发车缝件数', aggregated.cumulativeDispatchedGarmentQty, '', 'text-blue-600')}
        ${renderCompactKpiCard('剩余未发件数', aggregated.remainingGarmentQty, '', 'text-amber-600')}
        ${renderCompactKpiCard('发料批次数', aggregated.dispatchBatchCount, '', 'text-slate-700')}
        ${renderCompactKpiCard('中转袋数', aggregated.transferBagCount, '', 'text-slate-700')}
        ${renderCompactKpiCard('已回写袋数', aggregated.writtenBackTransferBagCount, '', 'text-emerald-600')}
        ${renderCompactKpiCard('差异袋数', aggregated.differenceTransferBagCount, '', 'text-rose-600')}
        ${renderCompactKpiCard('异议中袋数', aggregated.objectionTransferBagCount, '', 'text-rose-600')}
        ${renderCompactKpiCard('阻塞原因', reasons.length ? reasons.join('、') : '无', '裁片未配齐 / 特殊工艺未回仓 / 存在差异 / 存在异议 / 菲票被占用 / 数量超过剩余未发', 'text-amber-600')}
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
          <div class="mt-1 text-xs text-muted-foreground">按生产单汇总配料、领料、裁剪、菲票、特殊工艺回仓、裁片发车缝和阻塞原因。</div>
        </div>
        <div class="text-sm font-medium ${snapshots.every((item) => item.canCreateSewingDispatchBatch) ? 'text-emerald-600' : 'text-amber-600'}">是否可继续发料：${snapshots.every((item) => item.canCreateSewingDispatchBatch) ? '是' : '否'}</div>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderCompactKpiCard('配料进度', countBy((item) => item.materialPrepProgress.status === '已配置'), `共 ${snapshots.length} 单`, 'text-slate-900')}
        ${renderCompactKpiCard('领料进度', countBy((item) => item.pickupProgress.status === '已领料'), `差异 ${countBy((item) => item.pickupProgress.status === '差异待处理')} 单`, 'text-blue-600')}
        ${renderCompactKpiCard('裁剪进度', countBy((item) => item.cuttingProgress.status === '已裁剪'), `共 ${snapshots.length} 单`, 'text-violet-600')}
        ${renderCompactKpiCard('菲票进度', countBy((item) => item.feiTicketProgress.status === '已生成'), `部分 / 未生成 ${countBy((item) => item.feiTicketProgress.status !== '已生成')} 单`, 'text-cyan-600')}
        ${renderCompactKpiCard('特殊工艺回仓', countBy((item) => item.specialCraftReturnProgress.status === '已回仓' || item.specialCraftReturnProgress.status === '不需要回仓'), `未回仓 ${countBy((item) => item.specialCraftReturnProgress.status.includes('未回仓'))} 单`, 'text-emerald-600')}
        ${renderCompactKpiCard('裁片发车缝', snapshots.reduce((sum, item) => sum + item.sewingDispatchProgress.completedQty, 0), '累计已发件数', 'text-blue-600')}
        ${renderCompactKpiCard('特殊工艺当前数量', formatQty(snapshots.reduce((sum, item) => sum + item.specialCraftCurrentQty, 0)), '已回仓后当前可用数量', 'text-blue-600')}
        ${renderCompactKpiCard('特殊工艺报废 / 货损', `${formatQty(snapshots.reduce((sum, item) => sum + item.specialCraftScrapQty, 0))} / ${formatQty(snapshots.reduce((sum, item) => sum + item.specialCraftDamageQty, 0))}`, '报废 / 货损', 'text-rose-600')}
        ${renderCompactKpiCard('领料单已完成', countBy((item) => item.pickupOrderCompleted), '工厂侧完成领料单', 'text-emerald-600')}
        ${renderCompactKpiCard('交出单已完成', countBy((item) => item.handoutOrderCompleted), '工厂侧完成交出单', 'text-emerald-600')}
        ${renderCompactKpiCard('装袋 / 回写', countBy((item) => item.transferBagPackStatus === '已装袋' || item.transferBagPackStatus === '已交出'), `部分回写 ${countBy((item) => item.transferBagCombinedWritebackStatus === '部分回写')}`, 'text-blue-600')}
        ${renderCompactKpiCard('袋级 / 菲票级差异', `${snapshots.reduce((sum, item) => sum + item.transferBagBagDifferenceCount, 0)} / ${snapshots.reduce((sum, item) => sum + item.transferBagFeiTicketDifferenceCount, 0)}`, '中转袋差异 / 菲票差异', 'text-rose-600')}
        ${renderCompactKpiCard('差异 / 异议', countBy((item) => item.blockingReasons.some((reason) => reason.blockingLabel.includes('差异') || reason.blockingLabel.includes('异议'))), '阻塞生产单', 'text-rose-600')}
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
        ${renderCompactKpiCard('阻塞原因', blockingReasons.length ? blockingReasons.slice(0, 3).join('、') : '无', '可按阻塞原因筛选', 'text-amber-600')}
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
    { key: 'PREP_DELAY', label: '只看配料未齐', tone: 'amber' },
    { key: 'CLAIM_EXCEPTION', label: '只看领料异常', tone: 'rose' },
    { key: 'CUTTING_ACTIVE', label: '只看裁剪中', tone: 'blue' },
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
  const lines = row.materialPrepLines.map(
    (line) =>
      `<div class="flex items-start justify-between gap-3"><span class="text-muted-foreground">${escapeHtml(`${line.materialLabel} / ${line.materialSku}`)}</span><span class="font-medium tabular-nums text-foreground">${escapeHtml(`${formatQty(line.preparedQty)}/${formatQty(line.totalQty)}`)}</span></div>`,
  )
  return renderStackedLines(lines, '暂无面料进展')
}

function renderClaimProgressCell(row: ProductionProgressRow): string {
  const lines = row.materialClaimLines.map(
    (line) =>
      `<div class="flex items-start justify-between gap-3"><span class="text-muted-foreground">${escapeHtml(`${line.materialLabel} / ${line.materialSku}`)}</span><span class="font-medium tabular-nums text-foreground">${escapeHtml(`${formatQty(line.claimedQty)}/${formatQty(line.preparedQty)}`)}</span></div>`,
  )
  return renderStackedLines(lines, '暂无领料进展')
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

function resolveGapRowOriginalCutOrderNo(
  row: ProductionProgressRow,
  item: ProductionProgressRow['pieceTruth']['gapRows'][number],
): string {
  if (item.originalCutOrderNo) return item.originalCutOrderNo
  const fallback = row.pieceTruth.originalCutOrderRows.find(
    (sourceRow) =>
      sourceRow.materialSku === item.materialSku &&
      (sourceRow.gapCutQty > 0 || sourceRow.gapInboundQty > 0),
  )
  return fallback?.originalCutOrderNo || '-'
}

function renderRiskCell(row: ProductionProgressRow): string {
  const pendingPrepFollowups = getPendingPrepFollowupsForRow(row)
  if (!row.riskTags.length && !pendingPrepFollowups.length) {
    return '<span class="text-xs text-muted-foreground">无风险</span>'
  }

  return `
    <div class="flex flex-wrap gap-1">
      ${row.riskTags.map((riskTag) => renderBadge(riskTag.label, riskTag.className)).join('')}
      ${pendingPrepFollowups.length ? renderBadge(`补料待配料 ${pendingPrepFollowups.length} 条`, 'bg-amber-100 text-amber-700') : ''}
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
  const prepLines = row.materialPrepLines.map(
    (line) =>
      `<div class="flex items-start justify-between gap-3"><span class="text-muted-foreground">${escapeHtml(`${line.materialLabel} / ${line.materialSku}`)}</span><span class="font-medium tabular-nums text-foreground">${escapeHtml(`${formatQty(line.preparedQty)}/${formatQty(line.totalQty)}`)}</span></div>`,
  )
  const claimLines = row.materialClaimLines.map(
    (line) =>
      `<div class="flex items-start justify-between gap-3"><span class="text-muted-foreground">${escapeHtml(`${line.materialLabel} / ${line.materialSku}`)}</span><span class="font-medium tabular-nums text-foreground">${escapeHtml(`${formatQty(line.claimedQty)}/${formatQty(line.preparedQty)}`)}</span></div>`,
  )

  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold">面料进度</h3>
      <div class="mt-4 grid gap-4 lg:grid-cols-2">
        <article class="rounded-lg border bg-muted/10 p-4">
          <div class="text-sm font-medium text-foreground">配料进展</div>
          <div class="mt-3">
            ${renderDetailMaterialLines(prepLines, '暂无配料进展')}
          </div>
        </article>
        <article class="rounded-lg border bg-muted/10 p-4">
          <div class="text-sm font-medium text-foreground">领料进展</div>
          <div class="mt-3">
            ${renderDetailMaterialLines(claimLines, '暂无领料进展')}
          </div>
        </article>
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
  const markerCount = rows.filter((row) => row.originalCutOrderCount > 0).length
  const spreadingCount = rows.filter((row) => row.hasSpreadingRecord).length
  const ticketCount = rows.filter((row) => row.pieceCompletionSummary.key !== 'NOT_STARTED').length
  const replenishmentCount = rows.filter((row) => row.riskTags.some((tag) => tag.key === 'REPLENISH_PENDING')).length
  const warehouseCount = rows.filter((row) => row.hasInboundRecord).length

  const cards = [
    { label: '配料状态', value: `${configuredCount}/${total} 已配置` },
    { label: '领料状态', value: `${claimedCount}/${total} 已领料` },
    { label: '唛架状态', value: `${markerCount}/${total} 已排唛` },
    { label: '铺布状态', value: `${spreadingCount}/${total} 已铺布` },
    { label: '菲票状态', value: `${ticketCount}/${total} 已生成` },
    { label: '补料状态', value: replenishmentCount ? `${replenishmentCount} 条待处理` : '正常' },
    { label: '裁片仓状态', value: `${warehouseCount}/${total} 已入仓` },
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
  '配料进展',
  '领料进展',
  '原始裁片单数',
  '当前进展',
  '部位差异',
  '风险提示',
  '操作',
] as const

const CUT_ORDER_PROGRESS_TABLE_HEADERS = [
  '原始裁片单号',
  '生产单号',
  '款号 / SPU',
  '面料 SKU',
  '工厂',
  '关联数量',
  '计划发货日期',
  '紧急程度',
  '配料',
  '领料',
  '裁剪',
  '菲票',
  '特殊工艺回仓',
  '裁片发料',
  '当前阻塞',
  '操作',
] as const

function renderViewDimensionSwitch(): string {
  return `
    <div class="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
      <div>
        <div class="text-sm font-semibold text-foreground">展示维度</div>
        <div class="mt-1 text-xs text-muted-foreground">默认按裁片单维度展开，生产单维度保留汇总视角。</div>
      </div>
      <div class="inline-flex rounded-md border">
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
              <th class="px-4 py-3 text-left font-medium">原始裁片单号</th>
              <th class="px-4 py-3 text-left font-medium">面料 SKU</th>
              <th class="px-4 py-3 text-left font-medium">SKU</th>
              <th class="px-4 py-3 text-left font-medium">部位名称</th>
              <th class="px-4 py-3 text-left font-medium">理论片数</th>
              <th class="px-4 py-3 text-left font-medium">未完成片数</th>
              <th class="px-4 py-3 text-left font-medium">当前状态</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (item) => `
                  <tr class="border-b last:border-b-0 align-top">
                    <td class="px-4 py-3 font-medium">${escapeHtml(resolveGapRowOriginalCutOrderNo(row, item))}</td>
                    <td class="px-4 py-3">${escapeHtml(item.materialSku || '-')}</td>
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
        ${renderMetricChip('原始裁片单数', String(row.originalCutOrderCount), 'text-slate-900')}
      </div>
      <div class="mt-4 overflow-x-auto">
        <table class="w-full min-w-[980px] text-sm">
          <thead class="border-b bg-muted/30 text-muted-foreground">
            <tr>
              <th class="px-4 py-3 text-left font-medium">原始裁片单号</th>
              <th class="px-4 py-3 text-left font-medium">面料 SKU</th>
              <th class="px-4 py-3 text-left font-medium">承接 SKU 数</th>
              <th class="px-4 py-3 text-left font-medium">未完成部位片数</th>
              <th class="px-4 py-3 text-left font-medium">当前状态</th>
              <th class="px-4 py-3 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (item) => `
                  <tr class="border-b last:border-b-0 align-top">
                    <td class="px-4 py-3 font-medium">${escapeHtml(item.originalCutOrderNo)}</td>
                    <td class="px-4 py-3">${escapeHtml(item.materialSku || '-')}</td>
                    <td class="px-4 py-3 tabular-nums">${formatQty(item.skuCount)}</td>
                    <td class="px-4 py-3 tabular-nums">${formatQty(item.incompletePieceQty)}</td>
                    <td class="px-4 py-3">${escapeHtml(item.currentStateLabel)}</td>
                    <td class="px-4 py-3">
                      <button class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-progress-action="go-original-orders" data-record-id="${row.id}">查看原始裁片单</button>
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
                              <button class="font-medium text-blue-600 hover:underline" data-cutting-progress-action="open-detail" data-record-id="${row.id}">
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
                            <td class="px-4 py-3 font-medium">${row.originalCutOrderCount}</td>
                            <td class="px-4 py-3">${renderSkuProgressCell(row)}</td>
                            <td class="px-4 py-3">${renderPartDifferenceCell(row)}</td>
                            <td class="px-4 py-3">${renderRiskCell(row)}</td>
                            <td class="px-4 py-3">
                              <div class="flex flex-wrap gap-2">
                                <button class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-progress-action="open-detail" data-record-id="${row.id}">查看详情</button>
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
          <div class="mt-1 text-xs text-muted-foreground">默认按裁片单维度查看配料、领料、裁剪、特殊工艺回仓和裁片发料。</div>
        </div>
        <div class="text-xs text-muted-foreground">共 ${pagination.total} 条裁片单</div>
      </div>
      ${renderStickyTableScroller(
        `
          <table class="w-full min-w-[1820px] text-sm" data-testid="cutting-production-progress-cut-order-table">
            <thead class="sticky top-0 z-10 border-b bg-muted/95 text-muted-foreground backdrop-blur">
              <tr>
                ${CUT_ORDER_PROGRESS_TABLE_HEADERS.map(
                  (header) => `<th class="px-4 py-3 text-left font-medium">${header}</th>`,
                ).join('')}
              </tr>
            </thead>
            <tbody>
              ${
                pagination.items.length
                  ? pagination.items
                      .map(
                        (item) => `
                          <tr class="border-b last:border-b-0 align-top hover:bg-muted/20">
                            <td class="px-4 py-3 font-medium text-blue-600">${escapeHtml(item.originalCutOrderNo)}</td>
                            <td class="px-4 py-3">
                              <button class="font-medium text-blue-600 hover:underline" data-cutting-progress-action="open-detail" data-record-id="${item.parentRecordId}">
                                ${escapeHtml(item.productionOrderNo)}
                              </button>
                            </td>
                            <td class="px-4 py-3">
                              <div class="font-medium text-foreground">${escapeHtml(item.styleLabel)}</div>
                              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.styleName)}</div>
                            </td>
                            <td class="px-4 py-3">${escapeHtml(item.materialSku)}</td>
                            <td class="px-4 py-3">${escapeHtml(formatFactoryDisplayName(item.factoryName))}</td>
                            <td class="px-4 py-3 font-medium tabular-nums">${formatQty(item.relatedQty)}</td>
                            <td class="px-4 py-3">${escapeHtml(item.plannedShipDateDisplay)}</td>
                            <td class="px-4 py-3">${renderBadge(item.urgencyLabel, item.urgencyClassName)}</td>
                            <td class="px-4 py-3">${renderBadge(item.prepLabel, item.prepClassName)}</td>
                            <td class="px-4 py-3">${renderBadge(item.pickupLabel, item.pickupClassName)}</td>
                            <td class="px-4 py-3">${renderBadge(item.cuttingLabel, item.cuttingClassName)}</td>
                            <td class="px-4 py-3">${renderBadge(item.feiTicketLabel, item.feiTicketClassName)}</td>
                            <td class="px-4 py-3">
                              <div>${renderBadge(item.specialCraftReturnLabel, buildStateBadgeClass(item.specialCraftReturnLabel))}</div>
                              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.specialCraftReturnDetail || '当前无额外数量变化')}</div>
                            </td>
                            <td class="px-4 py-3">
                              <div>${renderBadge(item.sewingDispatchLabel, buildStateBadgeClass(item.sewingDispatchLabel))}</div>
                              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.sewingDispatchDetail || '当前无袋级 / 菲票级回写')}</div>
                            </td>
                            <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(item.blockingText)}</td>
                            <td class="px-4 py-3">
                              <div class="flex flex-wrap gap-2">
                                <button class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-progress-action="open-detail" data-record-id="${item.parentRecordId}">查看详情</button>
                                <button class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-progress-action="go-fei-tickets" data-record-id="${item.parentRecordId}">看菲票</button>
                                <button class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-progress-action="go-summary" data-record-id="${item.parentRecordId}">看裁剪总结</button>
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

function renderDetailDrawer(): string {
  const row = getAllRows().find((item) => item.id === state.activeDetailId)
  if (!row) return ''

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
        ${renderDetailSummaryItem('原始裁片单数', formatQty(row.originalCutOrderCount))}
        ${renderDetailSummaryItem('补料待配料', buildPendingPrepSummaryText(row))}
      </section>

      ${renderMaterialProgressSection(row)}
      ${renderSkuCompletionSection(row)}
      ${renderPieceGapSection(row)}
      ${renderSourceOrderSection(row)}
      ${renderRiskPromptSection(row)}
    </div>
  `

  return uiDrawer(
    {
      title: '生产单详情',
      subtitle: row.productionOrderNo,
      closeAction: { prefix: 'cutting-progress', action: 'close-detail' },
      width: 'lg',
    },
    content,
    {
      cancel: { prefix: 'cutting-progress', action: 'close-detail', label: '关闭' },
    },
  )
}

function renderActionBar(): string {
  const returnToSummary = hasSummaryReturnContext(state.drillContext)
    ? `<button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-progress-action="return-summary">返回裁剪总表</button>`
    : ''
  return `
    <div class="flex flex-wrap items-center gap-2">
      <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-progress-action="go-cuttable-pool-index">去可裁排产</button>
      ${returnToSummary}
      <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-progress-action="go-summary-index">查看裁剪总表</button>
    </div>
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
        actionsHtml: renderActionBar(),
        showCompatibilityBadge: isCuttingAliasPath(pathname),
      })}

      ${renderStatsCards(rows)}
      ${renderSpecialCraftReturnCards(rows)}
      ${renderSewingDispatchProgressCards(rows)}
      ${renderProgressStatisticsLinkageCards(rows)}
      ${renderStageOverview(rows)}
      ${renderViewDimensionSwitch()}

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
            ${renderFilterSelect('当前阶段', 'stage', state.filters.currentStage, [
              { value: 'ALL', label: '全部' },
              { value: 'WAITING_PREP', label: '待配料' },
              { value: 'PREPPING', label: '配料中' },
              { value: 'WAITING_CLAIM', label: '待领料' },
              { value: 'CUTTING', label: '裁剪中' },
              { value: 'WAITING_INBOUND', label: '待入仓' },
              { value: 'DONE', label: '已完成' },
            ])}
            ${renderFilterSelect('配料进展', 'config', state.filters.configStatus, [
              { value: 'ALL', label: '全部' },
              { value: 'NOT_CONFIGURED', label: '未配置' },
              { value: 'PARTIAL', label: '部分配置' },
              { value: 'CONFIGURED', label: '已配置' },
            ])}
            ${renderFilterSelect('领料进展', 'claim', state.filters.receiveStatus, [
              { value: 'ALL', label: '全部' },
              { value: 'NOT_RECEIVED', label: '待领取' },
              { value: 'PARTIAL', label: '部分领取' },
              { value: 'RECEIVED', label: '领料成功' },
              { value: 'EXCEPTION', label: '领取异常' },
            ])}
            ${renderFilterSelect('风险状态', 'risk', state.filters.riskFilter, [
              { value: 'ALL', label: '全部' },
              { value: 'ANY', label: '仅看有风险' },
              { value: 'CONFIG_DELAY', label: '配料滞后' },
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
      ${renderDetailDrawer()}
    </div>
  `
}

function findRowById(recordId: string | undefined): ProductionProgressRow | undefined {
  if (!recordId) return undefined
  return getAllRows().find((row) => row.id === recordId)
}

function navigateToRecordTarget(recordId: string | undefined, key: CuttingCanonicalPageKey): boolean {
  const row = findRowById(recordId)
  if (!row) return false

  const payload =
    key === 'material-prep'
      ? row.filterPayloadForMaterialPrep
      : key === 'spreading-list' || key === 'marker-spreading' || key === 'marker-list'
        ? row.filterPayloadForMarkerSpreading
        : key === 'fei-tickets'
          ? row.filterPayloadForFeiTickets
      : key === 'cuttable-pool'
        ? row.filterPayloadForCuttablePool
        : key === 'summary'
          ? row.filterPayloadForSummary
          : row.filterPayloadForOriginalOrders

  const context = normalizeLegacyCuttingPayload(payload, 'production-progress', {
    productionOrderId: row.productionOrderId,
    productionOrderNo: row.productionOrderNo,
    autoOpenDetail: true,
  })
  appStore.navigate(buildCuttingRouteWithContext(
    key === 'summary'
      ? 'summary'
      : key === 'original-orders'
        ? 'originalOrders'
        : key === 'material-prep'
          ? 'materialPrep'
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
    state.activeDetailId = actionNode.dataset.recordId ?? null
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

  if (action === 'go-original-orders') {
    return navigateToRecordTarget(actionNode.dataset.recordId, 'original-orders')
  }

  if (action === 'go-material-prep') {
    return navigateToRecordTarget(actionNode.dataset.recordId, 'material-prep')
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

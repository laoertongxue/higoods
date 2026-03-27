import type {
  CuttingSummaryIssue as PlatformRuntimeIssue,
  CuttingSummaryIssueSourcePage,
  CuttingSummaryLinkedPageSummary,
  CuttingSummaryRecord,
  CuttingSummaryRiskLevel,
  CuttingSummaryUpdatedSource,
} from '../../data/fcs/cutting/cutting-summary'
import type { CuttingUrgencyLevel } from '../../data/fcs/cutting/types'
import {
  type CuttingCheckActionTarget,
  type CuttingCheckBlockerItem,
  type CuttingCheckSectionKey,
  cuttingCheckSectionLabelMap,
} from '../../pages/process-factory/cutting/cutting-summary-checks'
import type {
  CuttingSummaryDetailPanelData,
  CuttingSummaryRow,
} from '../../pages/process-factory/cutting/summary-model'
import {
  buildCuttingIdentityRegistry,
  type CuttingTaskRef,
  type MergeBatchRef,
  type OriginalCutOrderRef,
  type ProductionOrderRef,
} from '../cutting-identity'
import {
  buildFcsCuttingRuntimeDetailData,
  buildFcsCuttingRuntimeSummaryResult,
  type FcsCuttingRuntimeSummaryResult,
} from '../fcs-cutting-runtime/sources'
import { buildCuttingSummaryPickupView } from '../pickup/page-adapters/pcs-cutting-summary'
import {
  listCuttingPickupViewsByProductionOrder,
  type CuttingPickupView,
} from '../pickup/page-adapters/cutting-shared'
import {
  buildEmptyPlatformCuttingPickupSummary,
  buildPlatformCuttingPickupSummary,
  type PlatformCuttingPickupSummary,
} from '../pickup/page-adapters/platform-cutting-summary'

export type PlatformCuttingOverviewStage =
  | 'PENDING_PICKUP'
  | 'EXECUTING'
  | 'PENDING_REPLENISHMENT'
  | 'PENDING_INBOUND'
  | 'PENDING_HANDOVER'
  | 'ALMOST_DONE'

export interface PlatformCuttingOverviewRoutes {
  orderProgress: string
  materialPrep: string
  cutPieceOrders: string
  replenishment: string
  warehouseManagement: string
}

export type PlatformCuttingRuntimeRecordSnapshot = Pick<
  CuttingSummaryRecord,
  | 'cutPieceOrderCount'
  | 'markerSummary'
  | 'spreadingSummary'
  | 'replenishmentSummary'
  | 'warehouseSummary'
  | 'sampleSummary'
  | 'lastUpdatedAt'
  | 'lastUpdatedSource'
  | 'searchKeywords'
>

export interface PlatformCuttingOverviewRow {
  id: string
  sourceRowId: string
  productionOrderId: string
  productionOrderNo: string
  originalCutOrderIds: string[]
  originalCutOrderNos: string[]
  mergeBatchIds: string[]
  mergeBatchNos: string[]
  productionOrderRef: ProductionOrderRef | null
  originalCutOrderRefs: OriginalCutOrderRef[]
  mergeBatchRefs: MergeBatchRef[]
  cuttingTaskRef: CuttingTaskRef | null
  purchaseDate: string
  orderQty: number
  plannedShipDate: string
  urgencyLevel: CuttingUrgencyLevel
  cuttingTaskNo: string
  assignedFactoryName: string
  platformStageSummary: string
  currentStage: PlatformCuttingOverviewStage
  overallRiskLevel: CuttingSummaryRiskLevel
  pendingIssueCount: number
  highRiskIssueCount: number
  pickupSlipNo: string
  latestPrintVersionNo: string
  printCopyCount: number
  pickupSummary: PlatformCuttingPickupSummary
  pickupAggregate: ReturnType<typeof buildCuttingSummaryPickupView>
  pickupSummaryText: string
  executionSummaryText: string
  replenishmentSummaryText: string
  warehouseSummaryText: string
  sampleSummaryText: string
  recentFactoryActionAt: string
  recentFactoryActionBy: string
  recentFactoryActionSource: '领料回写' | '铺布录入' | '入仓回写' | '样衣流转' | '暂无回写'
  mainIssueTitle: string
  mainIssueDescription: string
  mainIssueSourceLabel: string
  suggestedActionText: string
  suggestedRoute: string
  issueFlags: string[]
  issues: PlatformRuntimeIssue[]
  linkedPages: CuttingSummaryLinkedPageSummary[]
  nextActionSuggestions: string[]
  hasPendingReplenishment: boolean
  hasReceiveRecheck: boolean
  hasPhotoEvidence: boolean
  hasExecutionStalled: boolean
  hasPendingInbound: boolean
  hasPendingHandover: boolean
  hasSampleRisk: boolean
  isPendingFollowUp: boolean
  record: PlatformCuttingRuntimeRecordSnapshot
  routes: PlatformCuttingOverviewRoutes
}

export interface PlatformCuttingRuntimeOverviewData {
  runtime: FcsCuttingRuntimeSummaryResult
  rows: PlatformCuttingOverviewRow[]
}

const defaultRoutes: PlatformCuttingOverviewRoutes = {
  orderProgress: '/fcs/craft/cutting/order-progress',
  materialPrep: '/fcs/craft/cutting/material-prep',
  cutPieceOrders: '/fcs/craft/cutting/cut-piece-orders',
  replenishment: '/fcs/craft/cutting/replenishment',
  warehouseManagement: '/fcs/craft/cutting/warehouse-management',
}

const navigationTargetRouteMap: Record<CuttingCheckActionTarget, string> = {
  productionProgress: '/fcs/craft/cutting/order-progress',
  cuttablePool: '/fcs/craft/cutting/cuttable-pool',
  mergeBatches: '/fcs/craft/cutting/merge-batches',
  originalOrders: '/fcs/craft/cutting/cut-piece-orders',
  materialPrep: '/fcs/craft/cutting/material-prep',
  markerSpreading: '/fcs/craft/cutting/marker-spreading',
  feiTickets: '/fcs/craft/cutting/fei-tickets',
  fabricWarehouse: '/fcs/craft/cutting/fabric-warehouse',
  cutPieceWarehouse: '/fcs/craft/cutting/cut-piece-warehouse',
  sampleWarehouse: '/fcs/craft/cutting/sample-warehouse',
  transferBags: '/fcs/craft/cutting/transfer-bags',
  replenishment: '/fcs/craft/cutting/replenishment',
  specialProcesses: '/fcs/craft/cutting/special-processes',
  summary: '/fcs/craft/cutting/summary',
}

const cuttingIdentityRegistry = buildCuttingIdentityRegistry()

function compareDateTime(left: string, right: string): number {
  const safeLeft = left || ''
  const safeRight = right || ''
  return safeLeft.localeCompare(safeRight)
}

function buildRouteWithPayload(route: string, payload?: Record<string, string | undefined>): string {
  const params = new URLSearchParams()
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  const query = params.toString()
  return query ? `${route}?${query}` : route
}

function buildNavigationRoute(target: CuttingCheckActionTarget, payload?: Record<string, string | undefined>): string {
  return buildRouteWithPayload(navigationTargetRouteMap[target], payload)
}

function getLatestPickupView(productionOrderNo: string): CuttingPickupView | null {
  return (
    [...listCuttingPickupViewsByProductionOrder(productionOrderNo)].sort((left, right) => {
      const scanDiff = compareDateTime(
        right.latestScannedAt === '-' ? '' : right.latestScannedAt,
        left.latestScannedAt === '-' ? '' : left.latestScannedAt,
      )
      if (scanDiff !== 0) return scanDiff
      const printDiff = compareDateTime(
        right.latestPrintVersionNo === '-' ? '' : right.latestPrintVersionNo,
        left.latestPrintVersionNo === '-' ? '' : left.latestPrintVersionNo,
      )
      if (printDiff !== 0) return printDiff
      return right.printCopyCount - left.printCopyCount
    })[0] ?? null
  )
}

function mapSectionToIssueSourcePage(sectionKey: CuttingCheckSectionKey): CuttingSummaryIssueSourcePage {
  if (sectionKey === 'MATERIAL_PREP') return 'MATERIAL_PREP'
  if (sectionKey === 'REPLENISHMENT') return 'REPLENISHMENT'
  if (sectionKey === 'WAREHOUSE_HANDOFF') return 'WAREHOUSE'
  return 'CUT_PIECE_ORDER'
}

function getIssueSourceLabel(sourcePage: CuttingSummaryIssueSourcePage): string {
  if (sourcePage === 'MATERIAL_PREP') return '仓库配料'
  if (sourcePage === 'REPLENISHMENT') return '补料管理'
  if (sourcePage === 'WAREHOUSE') return '仓务收口'
  if (sourcePage === 'SAMPLE') return '样衣流转'
  return '裁片执行'
}

function buildSampleSummary(detail: CuttingSummaryDetailPanelData): CuttingSummaryRecord['sampleSummary'] {
  const sampleWaitingReturnCount = detail.sampleItems.filter((item) => item.status.key === 'PENDING_RETURN').length
  const sampleAvailableCount = detail.sampleItems.filter((item) => item.status.key === 'AVAILABLE').length
  const sampleCheckingCount = detail.sampleItems.filter((item) => item.status.key === 'INSPECTION').length
  const sampleInUseCount = detail.sampleItems.filter((item) =>
    ['BORROWED', 'IN_FACTORY', 'PENDING_RETURN'].includes(item.status.key),
  ).length
  const overdueReturnCount = detail.sampleItems.filter(
    (item) => item.status.key === 'PENDING_RETURN' && (item.note || '').includes('超期'),
  ).length
  const latestSampleItem = [...detail.sampleItems].sort((left, right) => compareDateTime(right.lastMovedAt, left.lastMovedAt))[0]
  return {
    sampleInUseCount,
    sampleWaitingReturnCount,
    sampleAvailableCount,
    sampleCheckingCount,
    overdueReturnCount,
    latestSampleActionAt: latestSampleItem?.lastMovedAt || '',
    latestSampleActionBy: latestSampleItem?.currentHolder || '',
  }
}

function buildWarehouseSummary(detail: CuttingSummaryDetailPanelData): CuttingSummaryRecord['warehouseSummary'] {
  const latestInboundItem = [...detail.cutPieceItems]
    .filter((item) => item.warehouseStatus.key !== 'PENDING_INBOUND')
    .sort((left, right) => compareDateTime(right.updatedAt, left.updatedAt))[0]

  return {
    cuttingFabricStockNeedRecheckCount: detail.fabricStocks.filter((item) => item.stockStatus.key === 'RISK').length,
    cutPiecePendingInboundCount: detail.cutPieceItems.filter((item) => item.warehouseStatus.key === 'PENDING_INBOUND').length,
    cutPieceInboundedCount: detail.cutPieceItems.filter((item) => item.warehouseStatus.key !== 'PENDING_INBOUND').length,
    waitingHandoverCount: detail.cutPieceItems.filter((item) => item.handoffStatus.key === 'WAITING_HANDOVER').length,
    handedOverCount: detail.cutPieceItems.filter((item) => item.handoffStatus.key === 'HANDED_OVER').length,
    unassignedZoneCount: detail.cutPieceItems.filter((item) => item.zoneCode === 'UNASSIGNED').length,
    latestInboundAt: latestInboundItem?.updatedAt || '',
    latestInboundBy: latestInboundItem?.operatorName || '',
  }
}

function buildReplenishmentSummary(detail: CuttingSummaryDetailPanelData): CuttingSummaryRecord['replenishmentSummary'] {
  return {
    suggestionCount: detail.replenishments.length,
    pendingReviewCount: detail.replenishments.filter((item) => item.statusMeta.key === 'PENDING_REVIEW').length,
    approvedCount: detail.replenishments.filter((item) =>
      ['APPROVED_PENDING_ACTION', 'IN_ACTION', 'COMPLETED'].includes(item.statusMeta.key),
    ).length,
    rejectedCount: detail.replenishments.filter((item) => item.statusMeta.key === 'REJECTED').length,
    needMoreInfoCount: detail.replenishments.filter((item) => item.statusMeta.key === 'PENDING_SUPPLEMENT').length,
    highRiskCount: detail.replenishments.filter((item) => item.riskLevel === 'HIGH').length,
    mayAffectPrintingCount: detail.replenishments.filter((item) => (item.impactFlags || []).includes('PRINTING')).length,
    mayAffectDyeingCount: detail.replenishments.filter((item) => (item.impactFlags || []).includes('DYEING')).length,
  }
}

function buildMarkerSummary(detail: CuttingSummaryDetailPanelData): CuttingSummaryRecord['markerSummary'] {
  const markerMaintainedCount = detail.spreadingSessions.filter((item) => Boolean(item.markerId || item.markerNo)).length
  return {
    markerMaintainedCount,
    markerImageUploadedCount: detail.spreadingSessions.filter((item) => Boolean(item.importedFromMarker)).length,
    pendingMarkerCount: Math.max(detail.originalRows.length - markerMaintainedCount, 0),
  }
}

function buildSpreadingSummary(detail: CuttingSummaryDetailPanelData): CuttingSummaryRecord['spreadingSummary'] {
  const latestSession = [...detail.spreadingSessions].sort((left, right) => compareDateTime(right.updatedAt, left.updatedAt))[0]
  return {
    spreadingRecordCount: detail.spreadingSessions.length,
    totalSpreadLength: detail.spreadingSessions.reduce((sum, item) => sum + item.totalActualLength, 0),
    latestSpreadingAt: latestSession?.updatedAt || '',
    latestSpreadingBy: latestSession?.note || '',
    pendingSpreadingCount: detail.spreadingSessions.filter((item) => item.status !== 'DONE').length,
  }
}

function buildSearchKeywords(row: CuttingSummaryRow): string[] {
  return Array.from(
    new Set(
      [
        ...row.keywordIndex,
        row.productionOrderNo,
        row.styleCode,
        row.spuCode,
        ...row.relatedOriginalCutOrderNos,
        ...row.relatedMergeBatchNos,
        ...row.relatedMaterialSkus,
        ...row.relatedProcessOrderNos,
        ...row.relatedTicketNos,
        ...row.relatedBagCodes,
        ...row.relatedUsageNos,
      ].filter(Boolean),
    ),
  )
}

function buildRecentFactoryAction(
  record: PlatformCuttingRuntimeRecordSnapshot,
  pickupSummary: PlatformCuttingPickupSummary,
): {
  at: string
  by: string
  source: PlatformCuttingOverviewRow['recentFactoryActionSource']
} {
  const candidates = [
    {
      at: pickupSummary.latestScannedAt !== '-' ? pickupSummary.latestScannedAt : '',
      by: pickupSummary.latestScannedBy !== '-' ? pickupSummary.latestScannedBy : '',
      source: '领料回写' as const,
    },
    {
      at: record.spreadingSummary.latestSpreadingAt,
      by: record.spreadingSummary.latestSpreadingBy,
      source: '铺布录入' as const,
    },
    {
      at: record.warehouseSummary.latestInboundAt,
      by: record.warehouseSummary.latestInboundBy,
      source: '入仓回写' as const,
    },
    {
      at: record.sampleSummary.latestSampleActionAt,
      by: record.sampleSummary.latestSampleActionBy,
      source: '样衣流转' as const,
    },
  ].filter((item) => item.at)

  const latest = candidates.sort((left, right) => compareDateTime(right.at, left.at))[0]
  if (!latest) return { at: '-', by: '-', source: '暂无回写' }
  return latest
}

function buildRuntimeRecordSnapshot(
  row: CuttingSummaryRow,
  detail: CuttingSummaryDetailPanelData,
  productionRowUpdatedAt: string,
  pickupSummary: PlatformCuttingPickupSummary,
): PlatformCuttingRuntimeRecordSnapshot {
  const markerSummary = buildMarkerSummary(detail)
  const spreadingSummary = buildSpreadingSummary(detail)
  const replenishmentSummary = buildReplenishmentSummary(detail)
  const warehouseSummary = buildWarehouseSummary(detail)
  const sampleSummary = buildSampleSummary(detail)
  const recentAction = buildRecentFactoryAction(
    {
      cutPieceOrderCount: detail.originalRows.length,
      markerSummary,
      spreadingSummary,
      replenishmentSummary,
      warehouseSummary,
      sampleSummary,
      lastUpdatedAt: productionRowUpdatedAt,
      lastUpdatedSource: 'PLATFORM',
      searchKeywords: [],
    },
    pickupSummary,
  )

  const lastUpdatedAt = recentAction.at !== '-' ? recentAction.at : productionRowUpdatedAt || '-'
  const lastUpdatedSource: CuttingSummaryUpdatedSource =
    recentAction.source === '样衣流转'
      ? 'PCS'
      : recentAction.source === '暂无回写'
        ? 'PLATFORM'
        : 'FACTORY_APP'

  return {
    cutPieceOrderCount: detail.originalRows.length,
    markerSummary,
    spreadingSummary,
    replenishmentSummary,
    warehouseSummary,
    sampleSummary,
    lastUpdatedAt,
    lastUpdatedSource,
    searchKeywords: buildSearchKeywords(row),
  }
}

function buildPlatformIssues(
  row: CuttingSummaryRow,
  detail: CuttingSummaryDetailPanelData,
): PlatformRuntimeIssue[] {
  const sectionIssues = row.checkSections
    .filter((section) => section.blocking)
    .map((section) => {
      const blocker =
        row.blockerItems.find((item) => item.sectionKey === section.sectionKey) ||
        row.blockerItems[0]
      if (!blocker) return null

      const sourcePage = mapSectionToIssueSourcePage(section.sectionKey)
      return {
        issueType: section.sectionKey,
        level: blocker.severity,
        title: blocker.title || `${cuttingCheckSectionLabelMap[section.sectionKey]}存在待处理项`,
        description: blocker.blockerReason || section.detailText,
        sourcePage,
        suggestedAction: blocker.nextActionLabel || section.defaultAction.label,
        suggestedRoute: buildNavigationRoute(blocker.navigationTarget, blocker.navigationPayload),
      }
    })
    .filter((item): item is PlatformRuntimeIssue => Boolean(item))

  const sampleSummary = buildSampleSummary(detail)
  if (sampleSummary.sampleWaitingReturnCount > 0 || sampleSummary.overdueReturnCount > 0) {
    sectionIssues.push({
      issueType: 'SAMPLE_RISK',
      level: sampleSummary.overdueReturnCount > 0 ? 'HIGH' : 'MEDIUM',
      title: sampleSummary.overdueReturnCount > 0 ? '样衣归还存在超期风险' : '样衣待归还',
      description:
        sampleSummary.overdueReturnCount > 0
          ? `当前待归还样衣 ${sampleSummary.sampleWaitingReturnCount} 件，其中超期 ${sampleSummary.overdueReturnCount} 件。`
          : `当前仍有 ${sampleSummary.sampleWaitingReturnCount} 件样衣待归还。`,
      sourcePage: 'SAMPLE',
      suggestedAction: '去样衣仓',
      suggestedRoute: '/fcs/craft/cutting/sample-warehouse',
    })
  }

  return sectionIssues
}

function getCurrentStage(
  row: CuttingSummaryRow,
  record: PlatformCuttingRuntimeRecordSnapshot,
  pickupAggregate: ReturnType<typeof buildCuttingSummaryPickupView>,
): PlatformCuttingOverviewStage {
  const getSection = (key: CuttingCheckSectionKey) => row.checkSections.find((item) => item.sectionKey === key)
  if (getSection('REPLENISHMENT')?.blocking) return 'PENDING_REPLENISHMENT'
  if (getSection('WAREHOUSE_HANDOFF')?.blocking) {
    if (record.warehouseSummary.cutPiecePendingInboundCount > 0 || record.warehouseSummary.unassignedZoneCount > 0) {
      return 'PENDING_INBOUND'
    }
    if (record.warehouseSummary.waitingHandoverCount > 0) return 'PENDING_HANDOVER'
    return 'PENDING_INBOUND'
  }
  if (getSection('MATERIAL_PREP')?.blocking || pickupAggregate.receiveSuccessCount === 0) return 'PENDING_PICKUP'
  if (row.completionState !== 'COMPLETED') return 'EXECUTING'
  return 'ALMOST_DONE'
}

function buildLinkedPages(
  row: CuttingSummaryRow,
  pickupSummaryText: string,
  executionSummaryText: string,
  replenishmentSummaryText: string,
  warehouseSummaryText: string,
): CuttingSummaryLinkedPageSummary[] {
  return [
    {
      pageKey: 'ORDER_PROGRESS',
      pageLabel: '生产单进度',
      route: buildNavigationRoute('productionProgress', row.navigationPayload.productionProgress),
      summaryText: `当前阶段 ${row.currentStageLabel}`,
    },
    {
      pageKey: 'MATERIAL_PREP',
      pageLabel: '仓库配料领料',
      route: buildNavigationRoute('materialPrep', row.navigationPayload.materialPrep),
      summaryText: pickupSummaryText,
    },
    {
      pageKey: 'CUT_PIECE_ORDER',
      pageLabel: '原始裁片单',
      route: buildNavigationRoute('originalOrders', row.navigationPayload.originalOrders),
      summaryText: executionSummaryText,
    },
    {
      pageKey: 'REPLENISHMENT',
      pageLabel: '补料管理',
      route: buildNavigationRoute('replenishment', row.navigationPayload.replenishment),
      summaryText: replenishmentSummaryText,
    },
    {
      pageKey: 'WAREHOUSE',
      pageLabel: '仓库管理',
      route: buildNavigationRoute('cutPieceWarehouse', row.navigationPayload.cutPieceWarehouse),
      summaryText: warehouseSummaryText,
    },
  ]
}

function buildPlatformStageSummary(row: CuttingSummaryRow): string {
  if (row.primaryBlockerTitle) {
    return `${row.primaryBlockerSectionLabel}：${row.primaryBlockerTitle}`
  }
  return `${row.currentStageLabel} · ${row.completionLabel}`
}

function buildOverviewRow(
  row: CuttingSummaryRow,
  detail: CuttingSummaryDetailPanelData,
): PlatformCuttingOverviewRow {
  const productionRow = detail.productionRow
  const pickupAggregate = buildCuttingSummaryPickupView(row.productionOrderNo)
  const latestPickupView = getLatestPickupView(row.productionOrderNo)
  const pickupSummary = latestPickupView
    ? buildPlatformCuttingPickupSummary(latestPickupView)
    : buildEmptyPlatformCuttingPickupSummary()
  const record = buildRuntimeRecordSnapshot(
    row,
    detail,
    productionRow?.latestUpdatedAt || '',
    pickupSummary,
  )
  const recentAction = buildRecentFactoryAction(record, pickupSummary)
  const issues = buildPlatformIssues(row, detail)
  const currentStage = getCurrentStage(row, record, pickupAggregate)
  const pendingIssueCount = issues.length
  const highRiskIssueCount = issues.filter((item) => item.level === 'HIGH').length
  const mainIssue = issues[0]

  const executionSummaryText = `唛架已维护 ${record.markerSummary.markerMaintainedCount} / ${record.cutPieceOrderCount} · 铺布 ${record.spreadingSummary.spreadingRecordCount} 条`
  const replenishmentSummaryText = `建议 ${record.replenishmentSummary.suggestionCount} · 待处理 ${record.replenishmentSummary.pendingReviewCount + record.replenishmentSummary.needMoreInfoCount} · 已通过 ${record.replenishmentSummary.approvedCount}`
  const warehouseSummaryText = `待入仓 ${record.warehouseSummary.cutPiecePendingInboundCount} · 待交接 ${record.warehouseSummary.waitingHandoverCount} · 未分配区 ${record.warehouseSummary.unassignedZoneCount}`
  const sampleSummaryText =
    record.sampleSummary.sampleWaitingReturnCount > 0 || record.sampleSummary.overdueReturnCount > 0
      ? `待归还 ${record.sampleSummary.sampleWaitingReturnCount} · 超期 ${record.sampleSummary.overdueReturnCount}`
      : '当前无样衣风险'
  const pickupSummaryText = `${pickupAggregate.materialReceiveSummaryText} · ${pickupSummary.summaryText}`
  const suggestedRoute = mainIssue?.suggestedRoute
    || (row.nextActions[0]
      ? buildNavigationRoute(row.nextActions[0].target, row.nextActions[0].payload)
      : defaultRoutes.orderProgress)

  return {
    id: `cutting-summary-${row.productionOrderId || row.productionOrderNo}`,
    sourceRowId: row.rowId,
    productionOrderId: row.productionOrderId,
    productionOrderNo: row.productionOrderNo,
    originalCutOrderIds: [...row.relatedOriginalCutOrderIds],
    originalCutOrderNos: [...row.relatedOriginalCutOrderNos],
    mergeBatchIds: [...row.relatedMergeBatchIds],
    mergeBatchNos: [...row.relatedMergeBatchNos],
    productionOrderRef: cuttingIdentityRegistry.productionOrdersById[row.productionOrderId] || null,
    originalCutOrderRefs: row.relatedOriginalCutOrderIds
      .map((originalCutOrderId) => cuttingIdentityRegistry.originalCutOrdersById[originalCutOrderId])
      .filter((ref): ref is OriginalCutOrderRef => Boolean(ref)),
    mergeBatchRefs: row.relatedMergeBatchIds
      .map((mergeBatchId) => cuttingIdentityRegistry.mergeBatchesById[mergeBatchId])
      .filter((ref): ref is MergeBatchRef => Boolean(ref)),
    cuttingTaskRef: productionRow?.cuttingTaskNo
      ? cuttingIdentityRegistry.cuttingTasksByNo[productionRow.cuttingTaskNo] || null
      : null,
    purchaseDate: productionRow?.purchaseDate || '-',
    orderQty: productionRow?.orderQty || detail.originalRows.length,
    plannedShipDate: productionRow?.plannedShipDateDisplay || productionRow?.plannedShipDate || '-',
    urgencyLevel: (productionRow?.urgency.key || 'D') as CuttingUrgencyLevel,
    cuttingTaskNo: productionRow?.cuttingTaskNo || '-',
    assignedFactoryName: productionRow?.assignedFactoryName || '-',
    platformStageSummary: buildPlatformStageSummary(row),
    currentStage,
    overallRiskLevel: row.overallRiskLevel,
    pendingIssueCount,
    highRiskIssueCount,
    pickupSlipNo: pickupSummary.pickupSlipNo,
    latestPrintVersionNo: pickupSummary.latestPrintVersionNo,
    printCopyCount: pickupSummary.printCopyCount,
    pickupSummary,
    pickupAggregate,
    pickupSummaryText,
    executionSummaryText,
    replenishmentSummaryText,
    warehouseSummaryText,
    sampleSummaryText,
    recentFactoryActionAt: recentAction.at,
    recentFactoryActionBy: recentAction.by || '-',
    recentFactoryActionSource: recentAction.source,
    mainIssueTitle: mainIssue?.title || '当前无明显风险',
    mainIssueDescription: mainIssue?.description || row.completionDetailText,
    mainIssueSourceLabel: mainIssue ? getIssueSourceLabel(mainIssue.sourcePage) : '平台跟进',
    suggestedActionText: mainIssue?.suggestedAction || row.nextActions[0]?.label || '继续跟进当前裁片任务。',
    suggestedRoute,
    issueFlags: [...row.riskTags],
    issues,
    linkedPages: buildLinkedPages(
      row,
      pickupSummaryText,
      executionSummaryText,
      replenishmentSummaryText,
      warehouseSummaryText,
    ),
    nextActionSuggestions: row.nextActions.map((item) => item.label),
    hasPendingReplenishment:
      record.replenishmentSummary.pendingReviewCount > 0 || record.replenishmentSummary.needMoreInfoCount > 0,
    hasReceiveRecheck: pickupSummary.needsRecheck,
    hasPhotoEvidence: pickupSummary.hasPhotoEvidence,
    hasExecutionStalled:
      record.markerSummary.pendingMarkerCount > 0 || record.spreadingSummary.pendingSpreadingCount > 0,
    hasPendingInbound:
      record.warehouseSummary.cutPiecePendingInboundCount > 0 || record.warehouseSummary.unassignedZoneCount > 0,
    hasPendingHandover: record.warehouseSummary.waitingHandoverCount > 0,
    hasSampleRisk:
      record.sampleSummary.sampleWaitingReturnCount > 0 || record.sampleSummary.overdueReturnCount > 0,
    isPendingFollowUp: row.completionState !== 'COMPLETED' || pendingIssueCount > 0,
    record,
    routes: defaultRoutes,
  }
}

export function buildPlatformCuttingRuntimeOverviewData(
  runtime: FcsCuttingRuntimeSummaryResult = buildFcsCuttingRuntimeSummaryResult(),
): PlatformCuttingRuntimeOverviewData {
  const rows = runtime.viewModel.rows
    .map((row) => {
      const detail = buildFcsCuttingRuntimeDetailData(row.rowId, runtime)
      if (!detail) return null
      return buildOverviewRow(row, detail)
    })
    .filter((row): row is PlatformCuttingOverviewRow => Boolean(row))

  return { runtime, rows }
}

export function buildPlatformCuttingOverviewRows(): PlatformCuttingOverviewRow[] {
  return buildPlatformCuttingRuntimeOverviewData().rows
}

import { cutPieceOrderRecords } from './cut-piece-orders'
import { cuttingMaterialPrepGroups } from './material-prep'
import { replenishmentSuggestionRecords } from './replenishment'
import { cutPieceWarehouseRecords, cuttingFabricStockRecords, sampleWarehouseRecords } from './warehouse-management'
import type { CuttingUrgencyLevel } from './types'

export type CuttingSummaryStatus =
  | 'PENDING_PREP_CLOSURE'
  | 'PENDING_EXECUTION_CLOSURE'
  | 'PENDING_REPLENISHMENT'
  | 'PENDING_WAREHOUSE_HANDOVER'
  | 'PENDING_SAMPLE_RETURN'
  | 'DONE_PENDING_REVIEW'
  | 'CLOSED'

export type CuttingSummaryRiskLevel = 'HIGH' | 'MEDIUM' | 'LOW'
export type CuttingSummaryUpdatedSource = 'PLATFORM' | 'PCS' | 'FACTORY_APP'
export type CuttingSummaryIssueSourcePage = 'MATERIAL_PREP' | 'CUT_PIECE_ORDER' | 'REPLENISHMENT' | 'WAREHOUSE' | 'SAMPLE'

export interface CuttingSummaryMaterialSummary {
  configuredCount: number
  partiallyConfiguredCount: number
  fullyConfiguredCount: number
  printedSlipCount: number
  qrGeneratedCount: number
}

export interface CuttingSummaryReceiveSummary {
  receivedSuccessCount: number
  receivedPartialCount: number
  notReceivedCount: number
  receiveDiscrepancyCount: number
  latestReceiveAt: string
  latestReceiveBy: string
  photoProofCount: number
}

export interface CuttingSummaryMarkerSummary {
  markerMaintainedCount: number
  markerImageUploadedCount: number
  pendingMarkerCount: number
}

export interface CuttingSummarySpreadingSummary {
  spreadingRecordCount: number
  totalSpreadLength: number
  latestSpreadingAt: string
  latestSpreadingBy: string
  pendingSpreadingCount: number
}

export interface CuttingSummaryReplenishmentSummary {
  suggestionCount: number
  pendingReviewCount: number
  approvedCount: number
  rejectedCount: number
  needMoreInfoCount: number
  highRiskCount: number
  mayAffectPrintingCount: number
  mayAffectDyeingCount: number
}

export interface CuttingSummaryWarehouseSummary {
  cuttingFabricStockNeedRecheckCount: number
  cutPiecePendingInboundCount: number
  cutPieceInboundedCount: number
  waitingHandoverCount: number
  handedOverCount: number
  unassignedZoneCount: number
  latestInboundAt: string
  latestInboundBy: string
}

export interface CuttingSummarySampleSummary {
  sampleInUseCount: number
  sampleWaitingReturnCount: number
  sampleAvailableCount: number
  sampleCheckingCount: number
  overdueReturnCount: number
  latestSampleActionAt: string
  latestSampleActionBy: string
}

export interface CuttingSummaryIssue {
  issueType: string
  level: CuttingSummaryRiskLevel
  title: string
  description: string
  sourcePage: CuttingSummaryIssueSourcePage
  suggestedAction: string
  suggestedRoute: string
}

export interface CuttingSummaryLinkedPageSummary {
  pageKey: 'ORDER_PROGRESS' | 'MATERIAL_PREP' | 'CUT_PIECE_ORDER' | 'REPLENISHMENT' | 'WAREHOUSE'
  pageLabel: string
  route: string
  summaryText: string
}

export interface CuttingSummaryRecord {
  id: string
  productionOrderNo: string
  purchaseDate: string
  orderQty: number
  plannedShipDate: string
  urgencyLevel: CuttingUrgencyLevel
  cuttingTaskNo: string
  assignedFactoryName: string
  platformStageSummary: string
  cutPieceOrderCount: number
  materialTypeCount: number
  overallSummaryStatus: CuttingSummaryStatus
  overallRiskLevel: CuttingSummaryRiskLevel
  pendingIssueCount: number
  highRiskIssueCount: number
  lastUpdatedAt: string
  lastUpdatedSource: CuttingSummaryUpdatedSource
  materialSummary: CuttingSummaryMaterialSummary
  receiveSummary: CuttingSummaryReceiveSummary
  markerSummary: CuttingSummaryMarkerSummary
  spreadingSummary: CuttingSummarySpreadingSummary
  replenishmentSummary: CuttingSummaryReplenishmentSummary
  warehouseSummary: CuttingSummaryWarehouseSummary
  sampleSummary: CuttingSummarySampleSummary
  issueFlags: string[]
  nextActionSuggestions: string[]
  linkedPageSummary: CuttingSummaryLinkedPageSummary[]
  searchKeywords: string[]
  issues: CuttingSummaryIssue[]
  note: string
}

export interface CuttingSummaryFilters {
  keyword: string
  urgencyLevel: 'ALL' | CuttingUrgencyLevel
  summaryStatus: 'ALL' | CuttingSummaryStatus
  riskLevel: 'ALL' | CuttingSummaryRiskLevel
  issueSource: 'ALL' | 'PREP' | 'EXECUTION' | 'REPLENISHMENT' | 'WAREHOUSE' | 'SAMPLE'
  pendingOnly: 'ALL' | 'PENDING_ONLY'
}

const platformOrderMeta: Record<
  string,
  {
    purchaseDate: string
    orderQty: number
    plannedShipDate: string
    urgencyLevel: CuttingUrgencyLevel
    cuttingTaskNo: string
    assignedFactoryName: string
    platformStageSummary: string
    note: string
  }
> = {
  'PO-202603-018': {
    purchaseDate: '2026-03-08',
    orderQty: 6800,
    plannedShipDate: '2026-03-29',
    urgencyLevel: 'AA',
    cuttingTaskNo: 'CP-TASK-202603-018',
    assignedFactoryName: '晋江盛鸿裁片厂',
    platformStageSummary: '主布领料差异待核对，交期紧急。',
    note: '该生产单当前最关键的问题是补料建议待审核与主布领料差异未收口。',
  },
  'PO-202603-024': {
    purchaseDate: '2026-03-10',
    orderQty: 4200,
    plannedShipDate: '2026-04-03',
    urgencyLevel: 'A',
    cuttingTaskNo: 'CP-TASK-202603-024',
    assignedFactoryName: '石狮恒泰裁片厂',
    platformStageSummary: '染色主布已执行完成，当前主要关注样衣归还与后道交接。',
    note: '该生产单主体执行已完成，但样衣回收和后道交接仍需核查。',
  },
  'PO-202603-031': {
    purchaseDate: '2026-03-12',
    orderQty: 5100,
    plannedShipDate: '2026-04-08',
    urgencyLevel: 'B',
    cuttingTaskNo: 'CP-TASK-202603-031',
    assignedFactoryName: '泉州嘉盛裁片厂',
    platformStageSummary: '补料建议已通过，当前主要卡在待发后道与追加配料确认。',
    note: '该生产单已进入收口阶段，重点核查补料已通过后的仓内节奏是否跟上。',
  },
  'PO-202603-027': {
    purchaseDate: '2026-03-07',
    orderQty: 2500,
    plannedShipDate: '2026-03-26',
    urgencyLevel: 'C',
    cuttingTaskNo: 'CP-TASK-202603-027',
    assignedFactoryName: '泉州协同裁片组',
    platformStageSummary: '裁片已交接后道，当前仅保留收口复核。',
    note: '作为收口样本，当前没有阻断性问题，可作为已收口对照记录。',
  },
}

const fallbackByOrderNo = {
  'PO-202603-027': {
    materialSummary: {
      configuredCount: 1,
      partiallyConfiguredCount: 0,
      fullyConfiguredCount: 1,
      printedSlipCount: 1,
      qrGeneratedCount: 1,
    },
    receiveSummary: {
      receivedSuccessCount: 1,
      receivedPartialCount: 0,
      notReceivedCount: 0,
      receiveDiscrepancyCount: 0,
      latestReceiveAt: '2026-03-20 11:20',
      latestReceiveBy: '李秀兰',
      photoProofCount: 0,
    },
    markerSummary: {
      markerMaintainedCount: 1,
      markerImageUploadedCount: 1,
      pendingMarkerCount: 0,
    },
    spreadingSummary: {
      spreadingRecordCount: 2,
      totalSpreadLength: 198,
      latestSpreadingAt: '2026-03-20 14:10',
      latestSpreadingBy: '黄秋月',
      pendingSpreadingCount: 0,
    },
  },
}

function maxDateTime(values: Array<string | undefined>): string {
  return values.filter(Boolean).sort().at(-1) ?? ''
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

function buildIssueFlags(issues: CuttingSummaryIssue[]): string[] {
  return unique(issues.map((item) => item.title))
}

function issueSourceMatches(
  issue: CuttingSummaryIssue,
  filter: CuttingSummaryFilters['issueSource'],
): boolean {
  if (filter === 'ALL') return true
  if (filter === 'PREP') return issue.sourcePage === 'MATERIAL_PREP'
  if (filter === 'EXECUTION') return issue.sourcePage === 'CUT_PIECE_ORDER'
  if (filter === 'REPLENISHMENT') return issue.sourcePage === 'REPLENISHMENT'
  if (filter === 'WAREHOUSE') return issue.sourcePage === 'WAREHOUSE'
  return issue.sourcePage === 'SAMPLE'
}

function buildRecord(productionOrderNo: string): CuttingSummaryRecord {
  const platform = platformOrderMeta[productionOrderNo]
  const prepGroup = cuttingMaterialPrepGroups.find((item) => item.productionOrderNo === productionOrderNo)
  const prepLines = prepGroup?.materialLines ?? []
  const cutPieceRecords = cutPieceOrderRecords.filter((item) => item.productionOrderNo === productionOrderNo)
  const replenishmentRecords = replenishmentSuggestionRecords.filter((item) => item.productionOrderNo === productionOrderNo)
  const fabricStocks = cuttingFabricStockRecords.filter((item) => item.productionOrderNo === productionOrderNo)
  const warehouseRecords = cutPieceWarehouseRecords.filter((item) => item.productionOrderNo === productionOrderNo)
  const sampleRecords = sampleWarehouseRecords.filter((item) => item.relatedProductionOrderNo === productionOrderNo)
  const fallback = fallbackByOrderNo[productionOrderNo as keyof typeof fallbackByOrderNo] ?? {
    materialSummary: {
      configuredCount: 0,
      partiallyConfiguredCount: 0,
      fullyConfiguredCount: 0,
      printedSlipCount: 0,
      qrGeneratedCount: 0,
    },
    receiveSummary: {
      receivedSuccessCount: 0,
      receivedPartialCount: 0,
      notReceivedCount: 0,
      receiveDiscrepancyCount: 0,
      latestReceiveAt: '',
      latestReceiveBy: '',
      photoProofCount: 0,
    },
    markerSummary: {
      markerMaintainedCount: 0,
      markerImageUploadedCount: 0,
      pendingMarkerCount: 0,
    },
    spreadingSummary: {
      spreadingRecordCount: 0,
      totalSpreadLength: 0,
      latestSpreadingAt: '',
      latestSpreadingBy: '',
      pendingSpreadingCount: 0,
    },
  }

  const materialSummary: CuttingSummaryMaterialSummary = prepLines.length
    ? {
        configuredCount: prepLines.filter((item) => item.configStatus !== 'NOT_CONFIGURED').length,
        partiallyConfiguredCount: prepLines.filter((item) => item.configStatus === 'PARTIAL').length,
        fullyConfiguredCount: prepLines.filter((item) => item.configStatus === 'CONFIGURED').length,
        printedSlipCount: prepLines.filter((item) => item.printSlipStatus === 'PRINTED').length,
        qrGeneratedCount: prepLines.filter((item) => item.qrStatus === 'GENERATED').length,
      }
    : fallback.materialSummary

  const receiveSummary: CuttingSummaryReceiveSummary = prepLines.length
    ? {
        receivedSuccessCount: prepLines.filter((item) => item.receiveStatus === 'RECEIVED').length,
        receivedPartialCount: prepLines.filter((item) => item.receiveStatus === 'PARTIAL').length,
        notReceivedCount: prepLines.filter((item) => item.receiveStatus === 'NOT_RECEIVED').length,
        receiveDiscrepancyCount: prepLines.filter((item) => item.discrepancyStatus !== 'NONE').length,
        latestReceiveAt: maxDateTime(prepLines.map((item) => item.latestReceiveScanAt)),
        latestReceiveBy:
          prepLines
            .filter((item) => item.latestReceiveScanAt)
            .sort((a, b) => a.latestReceiveScanAt.localeCompare(b.latestReceiveScanAt))
            .at(-1)?.latestReceiverName ?? '',
        photoProofCount: prepLines.reduce((sum, item) => sum + item.photoProofCount, 0),
      }
    : fallback.receiveSummary

  const markerSummary: CuttingSummaryMarkerSummary = cutPieceRecords.length
    ? {
        markerMaintainedCount: cutPieceRecords.filter((item) => item.markerInfo.totalPieces > 0).length,
        markerImageUploadedCount: cutPieceRecords.filter((item) => item.hasMarkerImage).length,
        pendingMarkerCount: cutPieceRecords.filter((item) => item.markerInfo.totalPieces === 0).length,
      }
    : fallback.markerSummary

  const spreadingSummary: CuttingSummarySpreadingSummary = cutPieceRecords.length
    ? {
        spreadingRecordCount: cutPieceRecords.reduce((sum, item) => sum + item.spreadingRecords.length, 0),
        totalSpreadLength: cutPieceRecords.reduce(
          (sum, item) => sum + item.spreadingRecords.reduce((lineSum, record) => lineSum + record.calculatedRollLength, 0),
          0,
        ),
        latestSpreadingAt: maxDateTime(cutPieceRecords.map((item) => item.latestSpreadingAt)),
        latestSpreadingBy:
          cutPieceRecords
            .filter((item) => item.latestSpreadingAt)
            .sort((a, b) => a.latestSpreadingAt.localeCompare(b.latestSpreadingAt))
            .at(-1)?.latestSpreadingBy ?? '',
        pendingSpreadingCount: cutPieceRecords.filter((item) => item.spreadingRecordCount === 0).length,
      }
    : fallback.spreadingSummary

  const replenishmentSummary: CuttingSummaryReplenishmentSummary = {
    suggestionCount: replenishmentRecords.length,
    pendingReviewCount: replenishmentRecords.filter((item) => item.reviewStatus === 'PENDING').length,
    approvedCount: replenishmentRecords.filter((item) => item.reviewStatus === 'APPROVED').length,
    rejectedCount: replenishmentRecords.filter((item) => item.reviewStatus === 'REJECTED').length,
    needMoreInfoCount: replenishmentRecords.filter((item) => item.reviewStatus === 'NEED_MORE_INFO').length,
    highRiskCount: replenishmentRecords.filter((item) => item.riskLevel === 'HIGH').length,
    mayAffectPrintingCount: replenishmentRecords.filter((item) => item.impactFlags.includes('PRINTING_AFFECTED')).length,
    mayAffectDyeingCount: replenishmentRecords.filter((item) => item.impactFlags.includes('DYEING_AFFECTED')).length,
  }

  const warehouseSummary: CuttingSummaryWarehouseSummary = {
    cuttingFabricStockNeedRecheckCount: fabricStocks.filter((item) => item.stockStatus === 'NEED_RECHECK').length,
    cutPiecePendingInboundCount: warehouseRecords.filter((item) => item.inboundStatus === 'PENDING_INBOUND').length,
    cutPieceInboundedCount: warehouseRecords.filter((item) => item.inboundStatus !== 'PENDING_INBOUND').length,
    waitingHandoverCount: warehouseRecords.filter((item) => item.handoverStatus === 'WAITING_HANDOVER').length,
    handedOverCount: warehouseRecords.filter((item) => item.handoverStatus === 'HANDED_OVER').length,
    unassignedZoneCount: warehouseRecords.filter((item) => item.zoneCode === 'UNASSIGNED').length,
    latestInboundAt: maxDateTime(warehouseRecords.map((item) => item.inboundAt)),
    latestInboundBy:
      warehouseRecords
        .filter((item) => item.inboundAt)
        .sort((a, b) => a.inboundAt.localeCompare(b.inboundAt))
        .at(-1)?.inboundBy ?? '',
  }

  const sampleSummary: CuttingSummarySampleSummary = {
    sampleInUseCount: sampleRecords.filter((item) => item.currentStatus === 'IN_USE').length,
    sampleWaitingReturnCount: sampleRecords.filter((item) => item.currentStatus === 'WAITING_RETURN').length,
    sampleAvailableCount: sampleRecords.filter((item) => item.currentStatus === 'AVAILABLE').length,
    sampleCheckingCount: sampleRecords.filter((item) => item.currentStatus === 'CHECKING').length,
    overdueReturnCount: sampleRecords.filter(
      (item) => item.currentStatus === 'WAITING_RETURN' && item.currentLocationStage === 'FACTORY_CHECK',
    ).length,
    latestSampleActionAt: maxDateTime(sampleRecords.map((item) => item.latestActionAt)),
    latestSampleActionBy:
      sampleRecords
        .filter((item) => item.latestActionAt)
        .sort((a, b) => a.latestActionAt.localeCompare(b.latestActionAt))
        .at(-1)?.latestActionBy ?? '',
  }

  const issues: CuttingSummaryIssue[] = []

  if (receiveSummary.receiveDiscrepancyCount > 0) {
    issues.push({
      issueType: 'RECEIVE_DIFF',
      level: 'HIGH',
      title: '领料差异未收口',
      description: `当前共有 ${receiveSummary.receiveDiscrepancyCount} 条领料差异记录待核对，可能直接影响裁片收口和交期判断。`,
      sourcePage: 'MATERIAL_PREP',
      suggestedAction: '回仓库配料页核对差异、照片凭证和补配状态。',
      suggestedRoute: '/fcs/craft/cutting/material-prep',
    })
  }

  if (materialSummary.partiallyConfiguredCount > 0 || materialSummary.configuredCount < cutPieceRecords.length) {
    issues.push({
      issueType: 'PREP_PENDING',
      level: productionOrderNo === 'PO-202603-018' ? 'HIGH' : 'MEDIUM',
      title: '配料仍未完全收口',
      description: '仍有裁片单处于未配置或部分配置状态，当前不适合判定为已完成收口。',
      sourcePage: 'MATERIAL_PREP',
      suggestedAction: '返回仓库配料页继续补齐配料和打印状态。',
      suggestedRoute: '/fcs/craft/cutting/material-prep',
    })
  }

  if (markerSummary.pendingMarkerCount > 0) {
    issues.push({
      issueType: 'MARKER_PENDING',
      level: 'MEDIUM',
      title: '唛架信息仍待维护',
      description: `当前仍有 ${markerSummary.pendingMarkerCount} 张裁片单未维护唛架或未形成有效总件数。`,
      sourcePage: 'CUT_PIECE_ORDER',
      suggestedAction: '返回裁片单页补齐唛架配比、净长度和单件用量。',
      suggestedRoute: '/fcs/craft/cutting/cut-piece-orders',
    })
  }

  if (spreadingSummary.pendingSpreadingCount > 0) {
    issues.push({
      issueType: 'SPREAD_PENDING',
      level: 'MEDIUM',
      title: '铺布记录仍不完整',
      description: `仍有 ${spreadingSummary.pendingSpreadingCount} 张裁片单没有铺布回写，无法完全判断裁片执行收口。`,
      sourcePage: 'CUT_PIECE_ORDER',
      suggestedAction: '核查裁片单页中的铺布记录，并确认现场回写是否缺失。',
      suggestedRoute: '/fcs/craft/cutting/cut-piece-orders',
    })
  }

  if (replenishmentSummary.pendingReviewCount > 0 || replenishmentSummary.needMoreInfoCount > 0) {
    issues.push({
      issueType: 'REPLENISH_PENDING',
      level: replenishmentSummary.highRiskCount > 0 ? 'HIGH' : 'MEDIUM',
      title: '补料建议仍待审核',
      description: `当前仍有 ${replenishmentSummary.pendingReviewCount + replenishmentSummary.needMoreInfoCount} 条补料建议未最终收口。`,
      sourcePage: 'REPLENISHMENT',
      suggestedAction: '回补料管理页优先处理高风险和待补充说明的建议。',
      suggestedRoute: '/fcs/craft/cutting/replenishment',
    })
  }

  if (warehouseSummary.cutPiecePendingInboundCount > 0 || warehouseSummary.unassignedZoneCount > 0) {
    issues.push({
      issueType: 'WAREHOUSE_PENDING',
      level: warehouseSummary.unassignedZoneCount > 0 ? 'HIGH' : 'MEDIUM',
      title: '裁片仓入仓与区域提示未收口',
      description: '当前仍有裁片待入仓或未分配区域，后续查找与交接效率存在风险。',
      sourcePage: 'WAREHOUSE',
      suggestedAction: '回仓库管理页确认入仓区域与位置说明。',
      suggestedRoute: '/fcs/craft/cutting/warehouse-management',
    })
  } else if (warehouseSummary.waitingHandoverCount > 0) {
    issues.push({
      issueType: 'HANDOVER_PENDING',
      level: 'LOW',
      title: '后道交接待确认',
      description: `当前仍有 ${warehouseSummary.waitingHandoverCount} 条裁片记录待发后道。`,
      sourcePage: 'WAREHOUSE',
      suggestedAction: '回仓库管理页查看交接摘要并确认后道领取节奏。',
      suggestedRoute: '/fcs/craft/cutting/warehouse-management',
    })
  }

  if (sampleSummary.sampleWaitingReturnCount > 0 || sampleSummary.overdueReturnCount > 0) {
    issues.push({
      issueType: 'SAMPLE_PENDING',
      level: sampleSummary.overdueReturnCount > 0 ? 'HIGH' : 'MEDIUM',
      title: '样衣归还存在风险',
      description: `当前待归还样衣 ${sampleSummary.sampleWaitingReturnCount} 件，其中超期 ${sampleSummary.overdueReturnCount} 件。`,
      sourcePage: 'SAMPLE',
      suggestedAction: '回仓库管理页核对样衣流转并完成归还登记。',
      suggestedRoute: '/fcs/craft/cutting/warehouse-management',
    })
  }

  const overallRiskLevel: CuttingSummaryRiskLevel =
    issues.some((item) => item.level === 'HIGH') ? 'HIGH' : issues.some((item) => item.level === 'MEDIUM') ? 'MEDIUM' : 'LOW'

  const overallSummaryStatus: CuttingSummaryStatus = (() => {
    if (replenishmentSummary.pendingReviewCount > 0 || replenishmentSummary.needMoreInfoCount > 0) return 'PENDING_REPLENISHMENT'
    if (sampleSummary.sampleWaitingReturnCount > 0 || sampleSummary.overdueReturnCount > 0) return 'PENDING_SAMPLE_RETURN'
    if (warehouseSummary.cutPiecePendingInboundCount > 0 || warehouseSummary.unassignedZoneCount > 0 || warehouseSummary.waitingHandoverCount > 0) return 'PENDING_WAREHOUSE_HANDOVER'
    if (markerSummary.pendingMarkerCount > 0 || spreadingSummary.pendingSpreadingCount > 0) return 'PENDING_EXECUTION_CLOSURE'
    if (materialSummary.configuredCount < cutPieceRecords.length || receiveSummary.receivedPartialCount > 0 || receiveSummary.notReceivedCount > 0) return 'PENDING_PREP_CLOSURE'
    if (issues.length > 0) return 'DONE_PENDING_REVIEW'
    return 'CLOSED'
  })()

  const lastUpdatedCandidates: Array<{ value: string; source: CuttingSummaryUpdatedSource }> = [
    { value: receiveSummary.latestReceiveAt, source: 'FACTORY_APP' },
    { value: spreadingSummary.latestSpreadingAt, source: 'FACTORY_APP' },
    { value: warehouseSummary.latestInboundAt, source: 'FACTORY_APP' },
    { value: sampleSummary.latestSampleActionAt, source: 'PCS' },
    { value: maxDateTime(replenishmentRecords.map((item) => item.reviewedAt || item.suggestionCreatedAt)), source: 'PCS' },
  ].filter((item) => item.value)

  const lastUpdated = lastUpdatedCandidates.sort((a, b) => a.value.localeCompare(b.value)).at(-1)

  const linkedPageSummary: CuttingSummaryLinkedPageSummary[] = [
    {
      pageKey: 'ORDER_PROGRESS',
      pageLabel: '订单进度',
      route: '/fcs/craft/cutting/order-progress',
      summaryText: `${platform.urgencyLevel} 紧急 · ${platform.platformStageSummary}`,
    },
    {
      pageKey: 'MATERIAL_PREP',
      pageLabel: '仓库配料',
      route: '/fcs/craft/cutting/material-prep',
      summaryText: `已配置 ${materialSummary.fullyConfiguredCount} / ${cutPieceRecords.length || materialSummary.configuredCount}，领料成功 ${receiveSummary.receivedSuccessCount}`,
    },
    {
      pageKey: 'CUT_PIECE_ORDER',
      pageLabel: '裁片单',
      route: '/fcs/craft/cutting/cut-piece-orders',
      summaryText: `唛架已维护 ${markerSummary.markerMaintainedCount}，铺布记录 ${spreadingSummary.spreadingRecordCount} 条`,
    },
    {
      pageKey: 'REPLENISHMENT',
      pageLabel: '补料管理',
      route: '/fcs/craft/cutting/replenishment',
      summaryText: `补料建议 ${replenishmentSummary.suggestionCount}，待审核 ${replenishmentSummary.pendingReviewCount}`,
    },
    {
      pageKey: 'WAREHOUSE',
      pageLabel: '仓库管理',
      route: '/fcs/craft/cutting/warehouse-management',
      summaryText: `待入仓 ${warehouseSummary.cutPiecePendingInboundCount}，待发后道 ${warehouseSummary.waitingHandoverCount}`,
    },
  ]

  return {
    id: `cutting-summary-${productionOrderNo}`,
    productionOrderNo,
    purchaseDate: platform.purchaseDate,
    orderQty: platform.orderQty,
    plannedShipDate: platform.plannedShipDate,
    urgencyLevel: platform.urgencyLevel,
    cuttingTaskNo: platform.cuttingTaskNo,
    assignedFactoryName: platform.assignedFactoryName,
    platformStageSummary: platform.platformStageSummary,
    cutPieceOrderCount: cutPieceRecords.length || materialSummary.configuredCount || warehouseRecords.length || 1,
    materialTypeCount:
      unique((prepLines.length ? prepLines : cutPieceRecords.length ? cutPieceRecords : fabricStocks).map((item) => item.materialType)).length || 1,
    overallSummaryStatus,
    overallRiskLevel,
    pendingIssueCount: issues.length,
    highRiskIssueCount: issues.filter((item) => item.level === 'HIGH').length,
    lastUpdatedAt: lastUpdated?.value ?? platform.purchaseDate,
    lastUpdatedSource: lastUpdated?.source ?? 'PLATFORM',
    materialSummary,
    receiveSummary,
    markerSummary,
    spreadingSummary,
    replenishmentSummary,
    warehouseSummary,
    sampleSummary,
    issueFlags: buildIssueFlags(issues),
    nextActionSuggestions: unique(issues.map((item) => item.suggestedAction)).slice(0, 4),
    linkedPageSummary,
    searchKeywords: unique([
      productionOrderNo,
      platform.cuttingTaskNo,
      ...prepLines.map((item) => item.cutPieceOrderNo),
      ...prepLines.map((item) => item.materialSku),
      ...cutPieceRecords.map((item) => item.cutPieceOrderNo),
      ...cutPieceRecords.map((item) => item.materialSku),
      ...warehouseRecords.map((item) => item.cutPieceOrderNo),
      ...warehouseRecords.map((item) => item.materialSku),
    ]),
    issues,
    note: platform.note,
  }
}

export const cuttingSummaryRecords: CuttingSummaryRecord[] = ['PO-202603-018', 'PO-202603-024', 'PO-202603-031', 'PO-202603-027'].map(buildRecord)

export function cloneCuttingSummaryRecords(): CuttingSummaryRecord[] {
  return cuttingSummaryRecords.map((record) => ({
    ...record,
    materialSummary: { ...record.materialSummary },
    receiveSummary: { ...record.receiveSummary },
    markerSummary: { ...record.markerSummary },
    spreadingSummary: { ...record.spreadingSummary },
    replenishmentSummary: { ...record.replenishmentSummary },
    warehouseSummary: { ...record.warehouseSummary },
    sampleSummary: { ...record.sampleSummary },
    issueFlags: [...record.issueFlags],
    nextActionSuggestions: [...record.nextActionSuggestions],
    linkedPageSummary: record.linkedPageSummary.map((item) => ({ ...item })),
    searchKeywords: [...record.searchKeywords],
    issues: record.issues.map((item) => ({ ...item })),
  }))
}

export function filterIssuesBySource(
  records: CuttingSummaryRecord[],
  filter: CuttingSummaryFilters['issueSource'],
): CuttingSummaryRecord[] {
  if (filter === 'ALL') return records
  return records.filter((record) => record.issues.some((issue) => issueSourceMatches(issue, filter)))
}

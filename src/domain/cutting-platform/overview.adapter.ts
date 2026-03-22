import {
  cloneCuttingSummaryRecords,
  type CuttingSummaryIssue,
  type CuttingSummaryLinkedPageSummary,
  type CuttingSummaryRecord,
  type CuttingSummaryRiskLevel,
} from '../../data/fcs/cutting/cutting-summary'
import type { CuttingUrgencyLevel } from '../../data/fcs/cutting/types'
import { buildCuttingSummaryPickupView } from '../pickup/page-adapters/pcs-cutting-summary'
import {
  listCuttingPickupViewsByProductionOrder,
  type CuttingPickupView,
} from '../pickup/page-adapters/cutting-shared'
import {
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

export interface PlatformCuttingOverviewRow {
  id: string
  productionOrderNo: string
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
  issues: CuttingSummaryIssue[]
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
  record: CuttingSummaryRecord
  routes: PlatformCuttingOverviewRoutes
}

const defaultRoutes: PlatformCuttingOverviewRoutes = {
  orderProgress: '/fcs/craft/cutting/order-progress',
  materialPrep: '/fcs/craft/cutting/material-prep',
  cutPieceOrders: '/fcs/craft/cutting/cut-piece-orders',
  replenishment: '/fcs/craft/cutting/replenishment',
  warehouseManagement: '/fcs/craft/cutting/warehouse-management',
}

function compareDateTime(left: string, right: string): number {
  const safeLeft = left || ''
  const safeRight = right || ''
  return safeLeft.localeCompare(safeRight)
}

function getLatestPickupView(productionOrderNo: string): CuttingPickupView | null {
  return (
    [...listCuttingPickupViewsByProductionOrder(productionOrderNo)].sort((left, right) => {
      const scanDiff = compareDateTime(right.latestScannedAt === '-' ? '' : right.latestScannedAt, left.latestScannedAt === '-' ? '' : left.latestScannedAt)
      if (scanDiff !== 0) return scanDiff
      const printDiff = compareDateTime(right.latestPrintVersionNo === '-' ? '' : right.latestPrintVersionNo, left.latestPrintVersionNo === '-' ? '' : left.latestPrintVersionNo)
      if (printDiff !== 0) return printDiff
      return right.printCopyCount - left.printCopyCount
    })[0] ?? null
  )
}

function buildEmptyPickupSummary(): PlatformCuttingPickupSummary {
  return {
    pickupSlipNo: '-',
    qrStatus: '未生成二维码',
    latestResultStatus: 'NOT_SCANNED',
    latestResultLabel: '未扫码回写',
    needsRecheck: false,
    hasPhotoEvidence: false,
    latestScannedAt: '-',
    summaryText: '当前没有领料回执摘要。',
  }
}

function getCurrentStage(
  record: CuttingSummaryRecord,
  pickupAggregate: ReturnType<typeof buildCuttingSummaryPickupView>,
): PlatformCuttingOverviewStage {
  if (record.replenishmentSummary.pendingReviewCount > 0 || record.replenishmentSummary.needMoreInfoCount > 0) {
    return 'PENDING_REPLENISHMENT'
  }
  if (record.warehouseSummary.cutPiecePendingInboundCount > 0 || record.warehouseSummary.unassignedZoneCount > 0) {
    return 'PENDING_INBOUND'
  }
  if (record.warehouseSummary.waitingHandoverCount > 0) {
    return 'PENDING_HANDOVER'
  }
  if (pickupAggregate.receiveSuccessCount === 0 && (record.receiveSummary.notReceivedCount > 0 || record.receiveSummary.receivedPartialCount > 0)) {
    return 'PENDING_PICKUP'
  }
  if (
    record.overallSummaryStatus === 'PENDING_PREP_CLOSURE' ||
    record.overallSummaryStatus === 'PENDING_EXECUTION_CLOSURE' ||
    record.markerSummary.pendingMarkerCount > 0 ||
    record.spreadingSummary.pendingSpreadingCount > 0
  ) {
    return 'EXECUTING'
  }
  return 'ALMOST_DONE'
}

function pickMainIssue(record: CuttingSummaryRecord): CuttingSummaryIssue | null {
  return (
    [...record.issues].sort((left, right) => {
      const weight = { HIGH: 0, MEDIUM: 1, LOW: 2 }
      const levelDiff = weight[left.level] - weight[right.level]
      if (levelDiff !== 0) return levelDiff
      return left.title.localeCompare(right.title)
    })[0] ?? null
  )
}

function buildRecentFactoryAction(record: CuttingSummaryRecord): {
  at: string
  by: string
  source: PlatformCuttingOverviewRow['recentFactoryActionSource']
} {
  const candidates = [
    {
      at: record.receiveSummary.latestReceiveAt,
      by: record.receiveSummary.latestReceiveBy,
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
  if (!latest) {
    return { at: '-', by: '-', source: '暂无回写' }
  }
  return latest
}

export function buildPlatformCuttingOverviewRows(
  records: CuttingSummaryRecord[] = cloneCuttingSummaryRecords(),
): PlatformCuttingOverviewRow[] {
  return records.map((record) => {
    const pickupAggregate = buildCuttingSummaryPickupView(record.productionOrderNo)
    const latestPickupView = getLatestPickupView(record.productionOrderNo)
    const pickupSummary = latestPickupView
      ? buildPlatformCuttingPickupSummary(
          latestPickupView.slip,
          latestPickupView.receiptSummary,
          latestPickupView.qrBinding,
        )
      : buildEmptyPickupSummary()
    const currentStage = getCurrentStage(record, pickupAggregate)
    const mainIssue = pickMainIssue(record)
    const recentAction = buildRecentFactoryAction(record)

    return {
      id: record.id,
      productionOrderNo: record.productionOrderNo,
      purchaseDate: record.purchaseDate,
      orderQty: record.orderQty,
      plannedShipDate: record.plannedShipDate,
      urgencyLevel: record.urgencyLevel,
      cuttingTaskNo: record.cuttingTaskNo,
      assignedFactoryName: record.assignedFactoryName,
      platformStageSummary: record.platformStageSummary,
      currentStage,
      overallRiskLevel: record.overallRiskLevel,
      pendingIssueCount: record.pendingIssueCount,
      highRiskIssueCount: record.highRiskIssueCount,
      pickupSlipNo: pickupSummary.pickupSlipNo,
      latestPrintVersionNo: latestPickupView?.latestPrintVersionNo || '-',
      printCopyCount: latestPickupView?.printCopyCount || 0,
      pickupSummary,
      pickupAggregate,
      pickupSummaryText: `${pickupAggregate.materialReceiveSummaryText} · ${pickupSummary.summaryText}`,
      executionSummaryText: `唛架已维护 ${record.markerSummary.markerMaintainedCount} / ${record.cutPieceOrderCount} · 铺布 ${record.spreadingSummary.spreadingRecordCount} 条`,
      replenishmentSummaryText: `建议 ${record.replenishmentSummary.suggestionCount} · 待处理 ${record.replenishmentSummary.pendingReviewCount + record.replenishmentSummary.needMoreInfoCount} · 已通过 ${record.replenishmentSummary.approvedCount}`,
      warehouseSummaryText: `待入仓 ${record.warehouseSummary.cutPiecePendingInboundCount} · 待交接 ${record.warehouseSummary.waitingHandoverCount} · 未分配区 ${record.warehouseSummary.unassignedZoneCount}`,
      sampleSummaryText:
        record.sampleSummary.sampleWaitingReturnCount > 0 || record.sampleSummary.overdueReturnCount > 0
          ? `待归还 ${record.sampleSummary.sampleWaitingReturnCount} · 超期 ${record.sampleSummary.overdueReturnCount}`
          : '当前无样衣风险',
      recentFactoryActionAt: recentAction.at,
      recentFactoryActionBy: recentAction.by,
      recentFactoryActionSource: recentAction.source,
      mainIssueTitle: mainIssue?.title || '当前无明显风险',
      mainIssueDescription: mainIssue?.description || '当前没有阻断性问题，可继续按既有节奏跟进。',
      mainIssueSourceLabel:
        mainIssue?.sourcePage === 'MATERIAL_PREP'
          ? '仓库配料'
          : mainIssue?.sourcePage === 'CUT_PIECE_ORDER'
            ? '裁片执行'
            : mainIssue?.sourcePage === 'REPLENISHMENT'
              ? '补料处理'
              : mainIssue?.sourcePage === 'WAREHOUSE'
                ? '仓务收口'
                : mainIssue?.sourcePage === 'SAMPLE'
                  ? '样衣风险'
                  : '平台跟进',
      suggestedActionText: mainIssue?.suggestedAction || record.nextActionSuggestions[0] || '继续跟进当前裁片任务。',
      suggestedRoute: mainIssue?.suggestedRoute || defaultRoutes.orderProgress,
      issueFlags: [...record.issueFlags],
      issues: [...record.issues],
      linkedPages: [...record.linkedPageSummary],
      nextActionSuggestions: [...record.nextActionSuggestions],
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
      isPendingFollowUp: record.overallSummaryStatus !== 'CLOSED' || record.pendingIssueCount > 0,
      record,
      routes: defaultRoutes,
    }
  })
}

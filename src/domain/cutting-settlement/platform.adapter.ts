import { cloneCuttingExceptionRecords } from '../cutting-exception/mock'
import type { CuttingException } from '../cutting-exception/types'
import { buildPlatformCuttingDetailView } from '../cutting-platform/detail.adapter'
import { buildPlatformCuttingDetailRoute } from '../cutting-platform/detail.helpers'
import type { PlatformCuttingOverviewRow } from '../cutting-platform/overview.adapter'
import { clonePlatformCuttingOverviewRows } from '../cutting-platform/overview.mock'
import type {
  CuttingExceptionImpactSummary,
  CuttingExecutionInputSummary,
  CuttingFactoryScoreInput,
  CuttingInputReviewStatus,
  CuttingPickupInputSummary,
  CuttingReplenishmentInputSummary,
  CuttingRecommendedScoreBand,
  CuttingScoreFocusLevel,
  CuttingSettlementFocusLevel,
  CuttingSettlementInput,
  CuttingSettlementInputView,
  CuttingWarehouseInputSummary,
  GroupContributionSummary,
  OperatorContributionSummary,
} from './types'

const factoryCodeMap: Record<string, string> = {
  '晋江盛鸿裁片厂': 'CUT-F001',
  '石狮恒泰裁片厂': 'CUT-F002',
  '泉州嘉盛裁片厂': 'CUT-F003',
  '泉州协同裁片组': 'CUT-F004',
}

function buildFactoryCode(factoryName: string): string {
  return factoryCodeMap[factoryName] || `CUT-${factoryName.length}`
}

function buildPickupSummary(row: PlatformCuttingOverviewRow): CuttingPickupInputSummary {
  return {
    pickupSlipNo: row.pickupSummary.pickupSlipNo,
    latestPrintVersionNo: row.pickupSummary.latestPrintVersionNo,
    printCopyCount: row.pickupSummary.printCopyCount,
    printSlipStatusLabel: row.pickupSummary.printSlipStatusLabel,
    qrCodeValue: row.pickupSummary.qrCodeValue,
    qrStatus: row.pickupSummary.qrStatus,
    latestResultStatus: row.pickupSummary.latestResultStatus,
    latestResultLabel: row.pickupSummary.latestResultLabel,
    latestScannedAt: row.pickupSummary.latestScannedAt,
    latestScannedBy: row.pickupSummary.latestScannedBy,
    needsRecheck: row.pickupSummary.needsRecheck,
    hasPhotoEvidence: row.pickupSummary.hasPhotoEvidence,
    photoProofCount: row.pickupSummary.photoProofCount,
    receiptStatus: row.pickupSummary.receiptStatus,
    receiptStatusLabel: row.pickupSummary.receiptStatusLabel,
    printVersionSummaryText: row.pickupSummary.printVersionSummaryText,
    qrBindingSummaryText: row.pickupSummary.qrBindingSummaryText,
    resultSummaryText: row.pickupSummary.resultSummaryText,
    evidenceSummaryText: row.pickupSummary.evidenceSummaryText,
    summaryText: row.pickupSummary.summaryText,
  }
}

function buildExecutionSummary(row: PlatformCuttingOverviewRow): CuttingExecutionInputSummary {
  return {
    cutPieceOrderCount: row.record.cutPieceOrderCount,
    markerMaintainedCount: row.record.markerSummary.markerMaintainedCount,
    markerImageUploadedCount: row.record.markerSummary.markerImageUploadedCount,
    spreadingRecordCount: row.record.spreadingSummary.spreadingRecordCount,
    latestSpreadingAt: row.record.spreadingSummary.latestSpreadingAt || '-',
    latestSpreadingBy: row.record.spreadingSummary.latestSpreadingBy || '-',
    currentProgressText: row.executionSummaryText,
    summaryText: `唛架已维护 ${row.record.markerSummary.markerMaintainedCount} / ${row.record.cutPieceOrderCount}，铺布 ${row.record.spreadingSummary.spreadingRecordCount} 条。`,
  }
}

function buildReplenishmentSummary(row: PlatformCuttingOverviewRow): CuttingReplenishmentInputSummary {
  return {
    suggestionCount: row.record.replenishmentSummary.suggestionCount,
    pendingReviewCount: row.record.replenishmentSummary.pendingReviewCount,
    approvedCount: row.record.replenishmentSummary.approvedCount,
    rejectedCount: row.record.replenishmentSummary.rejectedCount,
    needMoreInfoCount: row.record.replenishmentSummary.needMoreInfoCount,
    highRiskCount: row.record.replenishmentSummary.highRiskCount,
    summaryText: row.replenishmentSummaryText,
  }
}

function buildWarehouseSummary(row: PlatformCuttingOverviewRow): CuttingWarehouseInputSummary {
  return {
    pendingInboundCount: row.record.warehouseSummary.cutPiecePendingInboundCount,
    inboundedCount: row.record.warehouseSummary.cutPieceInboundedCount,
    waitingHandoverCount: row.record.warehouseSummary.waitingHandoverCount,
    handedOverCount: row.record.warehouseSummary.handedOverCount,
    unassignedZoneCount: row.record.warehouseSummary.unassignedZoneCount,
    latestInboundAt: row.record.warehouseSummary.latestInboundAt || '-',
    latestInboundBy: row.record.warehouseSummary.latestInboundBy || '-',
    sampleWaitingReturnCount: row.record.sampleSummary.sampleWaitingReturnCount,
    sampleOverdueCount: row.record.sampleSummary.overdueReturnCount,
    summaryText: `${row.warehouseSummaryText} · ${row.sampleSummaryText}`,
  }
}

function groupExceptions(row: PlatformCuttingOverviewRow, allExceptions: CuttingException[]): CuttingException[] {
  return allExceptions.filter(
    (item) => item.productionOrderNo === row.productionOrderNo && item.cuttingTaskNo === row.cuttingTaskNo,
  )
}

function buildExceptionImpactSummary(row: PlatformCuttingOverviewRow, exceptions: CuttingException[]): CuttingExceptionImpactSummary {
  const openExceptions = exceptions.filter((item) => item.status !== 'CLOSED')
  const highRiskExceptionCount = openExceptions.filter((item) => item.riskLevel === 'HIGH').length
  const repeatedRecheckCount = openExceptions.filter((item) => item.exceptionType === 'RECEIVE_DISCREPANCY' || item.needsRecheck).length
  const insufficientEvidenceCount = openExceptions.filter((item) => item.exceptionType === 'MISSING_EVIDENCE').length
  const settlementAttentionExceptionCount = openExceptions.filter((item) => {
    return (
      item.exceptionType === 'RECEIVE_DISCREPANCY' ||
      item.exceptionType === 'MISSING_EVIDENCE' ||
      item.exceptionType === 'REPLENISHMENT_PENDING' ||
      item.exceptionType === 'INBOUND_PENDING' ||
      item.exceptionType === 'HANDOVER_PENDING'
    )
  }).length
  const scoreAttentionExceptionCount = openExceptions.filter((item) => {
    return (
      item.exceptionType === 'RECEIVE_DISCREPANCY' ||
      item.exceptionType === 'MISSING_EVIDENCE' ||
      item.exceptionType === 'SPREADING_DATA_INSUFFICIENT' ||
      item.exceptionType === 'MARKER_NOT_MAINTAINED' ||
      item.exceptionType === 'SAMPLE_OVERDUE'
    )
  }).length

  return {
    openExceptionCount: openExceptions.length,
    highRiskExceptionCount,
    repeatedRecheckCount,
    insufficientEvidenceCount,
    pendingExceptionCount: openExceptions.length,
    settlementAttentionExceptionCount,
    scoreAttentionExceptionCount,
    hasSettlementImpact: settlementAttentionExceptionCount > 0,
    hasScoreImpact: scoreAttentionExceptionCount > 0,
    summaryText:
      openExceptions.length > 0
        ? `未关闭异常 ${openExceptions.length} 项，高风险 ${highRiskExceptionCount} 项，多次复核 ${repeatedRecheckCount} 项，凭证不足 ${insufficientEvidenceCount} 项。`
        : '当前没有异常影响结算与评分输入。',
  }
}

function buildOperatorSummary(row: PlatformCuttingOverviewRow): OperatorContributionSummary[] {
  const seeds = [
    {
      operatorName: row.record.receiveSummary.latestReceiveBy,
      latestActionAt: row.record.receiveSummary.latestReceiveAt,
      key: 'pickup' as const,
      latestActionSummary: row.record.receiveSummary.latestReceiveAt ? '最近负责领料回写' : '',
    },
    {
      operatorName: row.record.spreadingSummary.latestSpreadingBy,
      latestActionAt: row.record.spreadingSummary.latestSpreadingAt,
      key: 'spreading' as const,
      latestActionSummary: row.record.spreadingSummary.latestSpreadingAt ? '最近负责铺布录入' : '',
    },
    {
      operatorName: row.record.warehouseSummary.latestInboundBy,
      latestActionAt: row.record.warehouseSummary.latestInboundAt,
      key: 'inbound' as const,
      latestActionSummary: row.record.warehouseSummary.latestInboundAt ? '最近负责入仓回写' : '',
    },
    {
      operatorName: row.record.sampleSummary.latestSampleActionBy,
      latestActionAt: row.record.sampleSummary.latestSampleActionAt,
      key: 'replenishment' as const,
      latestActionSummary: row.record.sampleSummary.latestSampleActionAt ? '最近负责样衣与执行协同' : '',
    },
  ].filter((item) => item.operatorName)

  const map = new Map<string, OperatorContributionSummary>()
  seeds.forEach((item, index) => {
    const current =
      map.get(item.operatorName) ||
      {
        operatorName: item.operatorName,
        operatorId: `OP-${String(index + 1).padStart(2, '0')}`,
        actionCount: 0,
        pickupActionCount: 0,
        spreadingActionCount: 0,
        inboundActionCount: 0,
        handoverActionCount: 0,
        replenishmentFeedbackCount: 0,
        latestActionAt: '-',
        latestActionSummary: '暂无动作摘要',
      }

    current.actionCount += 1
    if (item.key === 'pickup') current.pickupActionCount += 1
    if (item.key === 'spreading') current.spreadingActionCount += 1
    if (item.key === 'inbound') current.inboundActionCount += 1
    if (item.key === 'replenishment') current.replenishmentFeedbackCount += 1

    if ((item.latestActionAt || '-') >= current.latestActionAt) {
      current.latestActionAt = item.latestActionAt || '-'
      current.latestActionSummary = item.latestActionSummary
    }

    map.set(item.operatorName, current)
  })

  return [...map.values()].sort((left, right) => right.actionCount - left.actionCount)
}

function buildGroupSummary(row: PlatformCuttingOverviewRow, operators: OperatorContributionSummary[]): GroupContributionSummary[] {
  const actionCount = operators.reduce((sum, item) => sum + item.actionCount, 0)
  const latestOperator = [...operators].sort((left, right) => right.latestActionAt.localeCompare(left.latestActionAt))[0]

  return [
    {
      groupName: `${row.assignedFactoryName}裁片执行组`,
      memberCount: Math.max(operators.length, 1),
      actionCount,
      latestActionAt: latestOperator?.latestActionAt || row.recentFactoryActionAt || '-',
      latestActionSummary: latestOperator?.latestActionSummary || row.recentFactoryActionSource,
    },
  ]
}

function buildSettlementFocusLevel(row: PlatformCuttingOverviewRow, impact: CuttingExceptionImpactSummary): CuttingSettlementFocusLevel {
  if (impact.highRiskExceptionCount > 0 || row.hasPendingReplenishment || row.hasReceiveRecheck) return 'HIGH_FOCUS'
  if (impact.hasSettlementImpact || row.hasPendingInbound || row.hasPendingHandover || row.pendingIssueCount > 0) return 'FOCUS'
  return 'NORMAL'
}

function buildScoreFocusLevel(row: PlatformCuttingOverviewRow, impact: CuttingExceptionImpactSummary): CuttingScoreFocusLevel {
  if (impact.highRiskExceptionCount > 0 || impact.insufficientEvidenceCount > 0 || impact.repeatedRecheckCount > 1) return 'HIGH_ATTENTION'
  if (row.hasPendingReplenishment || row.hasSampleRisk || row.highRiskIssueCount > 0) return 'LOW_SCORE_RISK'
  if (impact.hasScoreImpact || row.pendingIssueCount > 0) return 'WATCH'
  return 'NORMAL'
}

function buildRecommendedScoreBand(scoreFocusLevel: CuttingScoreFocusLevel): CuttingRecommendedScoreBand {
  if (scoreFocusLevel === 'HIGH_ATTENTION') return 'LIMIT'
  if (scoreFocusLevel === 'LOW_SCORE_RISK') return 'WATCH'
  if (scoreFocusLevel === 'WATCH') return 'GOOD'
  return 'EXCELLENT'
}

function buildReviewStatus(
  settlementFocusLevel: CuttingSettlementFocusLevel,
  scoreFocusLevel: CuttingScoreFocusLevel,
  impact: CuttingExceptionImpactSummary,
): CuttingInputReviewStatus {
  if (impact.insufficientEvidenceCount > 0) return 'NEED_MORE_INFO'
  if (settlementFocusLevel === 'NORMAL' && scoreFocusLevel === 'NORMAL' && impact.openExceptionCount === 0) return 'CONFIRMED'
  if (impact.highRiskExceptionCount > 0) return 'REVIEWING'
  return 'PENDING'
}

export function buildPlatformCuttingSettlementInputViews(
  rows: PlatformCuttingOverviewRow[] = clonePlatformCuttingOverviewRows(),
  allExceptions: CuttingException[] = cloneCuttingExceptionRecords(),
): CuttingSettlementInputView[] {
  return rows.map((row) => {
    const detail = buildPlatformCuttingDetailView(row.id)
    const relatedExceptions = groupExceptions(row, allExceptions)
    const impact = buildExceptionImpactSummary(row, relatedExceptions)
    const operatorSummary = buildOperatorSummary(row)
    const groupSummary = buildGroupSummary(row, operatorSummary)
    const settlementFocusLevel = buildSettlementFocusLevel(row, impact)
    const scoreFocusLevel = buildScoreFocusLevel(row, impact)
    const reviewStatus = buildReviewStatus(settlementFocusLevel, scoreFocusLevel, impact)
    const latestActionAt = row.recentFactoryActionAt !== '-' ? row.recentFactoryActionAt : row.record.lastUpdatedAt
    const latestActionBy = row.recentFactoryActionBy !== '-' ? row.recentFactoryActionBy : row.assignedFactoryName

    const settlementInput: CuttingSettlementInput = {
      settlementInputNo: `SET-IN-${row.cuttingTaskNo}`,
      scenarioType: 'CUTTING',
      productionOrderNo: row.productionOrderNo,
      cuttingTaskNo: row.cuttingTaskNo,
      cutPieceOrderCount: row.record.cutPieceOrderCount,
      factoryName: row.assignedFactoryName,
      factoryCode: buildFactoryCode(row.assignedFactoryName),
      urgencyLevel: row.urgencyLevel,
      currentStage: row.currentStage,
      latestActionAt,
      latestActionBy,
      operatorSummary,
      groupSummary,
      pickupSummary: buildPickupSummary(row),
      executionSummary: buildExecutionSummary(row),
      replenishmentSummary: buildReplenishmentSummary(row),
      warehouseSummary: buildWarehouseSummary(row),
      exceptionImpactSummary: impact,
      settlementFocusLevel,
      needsManualReview: settlementFocusLevel !== 'NORMAL' || impact.openExceptionCount > 0,
      reviewStatus,
      reviewedBy: reviewStatus === 'CONFIRMED' ? '平台裁片跟进岗' : '',
      reviewedAt: reviewStatus === 'CONFIRMED' ? row.record.lastUpdatedAt : '',
      reviewNote: reviewStatus === 'CONFIRMED' ? '当前输入已基本收口，可作为常规结算关注样本。' : '',
      snapshotConfirmedAt: reviewStatus === 'CONFIRMED' ? row.record.lastUpdatedAt : '',
      snapshotConfirmedBy: reviewStatus === 'CONFIRMED' ? '平台裁片跟进岗' : '',
    }

    const scoreInput: CuttingFactoryScoreInput = {
      scoreInputNo: `SCORE-IN-${row.cuttingTaskNo}`,
      scenarioType: 'CUTTING',
      productionOrderNo: row.productionOrderNo,
      cuttingTaskNo: row.cuttingTaskNo,
      factoryName: row.assignedFactoryName,
      deliveryPerformanceSummary: `当前阶段 ${row.platformStageSummary}，紧急程度 ${row.urgencyLevel}。`,
      executionStabilitySummary: row.executionSummaryText,
      exceptionPenaltySummary: impact.summaryText,
      recheckSummary: impact.repeatedRecheckCount > 0 ? `当前有 ${impact.repeatedRecheckCount} 项复核相关异常。` : '当前没有复核阻断。',
      evidenceComplianceSummary: settlementInput.pickupSummary.hasPhotoEvidence
        ? `存在照片凭证留痕，需核对合规性。${settlementInput.pickupSummary.evidenceSummaryText}`
        : '当前没有照片凭证留痕。',
      sampleHandlingSummary: row.sampleSummaryText,
      scoreFocusLevel,
      recommendedScoreBand: buildRecommendedScoreBand(scoreFocusLevel),
      needsManualReview: scoreFocusLevel !== 'NORMAL' || impact.hasScoreImpact,
      reviewStatus,
      reviewedBy: settlementInput.reviewedBy,
      reviewedAt: settlementInput.reviewedAt,
      reviewNote: settlementInput.reviewNote,
    }

    return {
      id: row.id,
      scenarioType: 'CUTTING',
      productionOrderNo: row.productionOrderNo,
      cuttingTaskNo: row.cuttingTaskNo,
      factoryName: row.assignedFactoryName,
      urgencyLevel: row.urgencyLevel,
      currentStage: row.currentStage,
      settlementInput,
      scoreInput,
      routes: {
        ...row.routes,
        platformOverview: '/fcs/progress/cutting-overview',
        platformDetail: buildPlatformCuttingDetailRoute(row.id),
        platformExceptionCenter: '/fcs/progress/cutting-exception-center',
      },
      latestActionText: latestActionAt !== '-' ? `${row.recentFactoryActionSource} · ${latestActionAt} · ${latestActionBy}` : '当前暂无现场动作回写',
      suggestedActionText: detail?.attentionItems[0]?.suggestedFollowUp || row.suggestedActionText,
      executionSummaryText: row.executionSummaryText,
      exceptionImpactText: impact.summaryText,
      reviewStatus,
      hasExceptionImpact: impact.openExceptionCount > 0,
      requiresSettlementAttention: settlementFocusLevel !== 'NORMAL',
      requiresScoreAttention: scoreFocusLevel !== 'NORMAL',
      isPending: reviewStatus !== 'CONFIRMED' || settlementInput.snapshotConfirmedAt === '',
      relatedExceptionNos: relatedExceptions.map((item) => item.exceptionNo),
    }
  })
}

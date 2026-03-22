import type { CuttingUrgencyLevel } from '../../data/fcs/cutting/types'
import type { PlatformCuttingOverviewStage, PlatformCuttingOverviewRoutes } from '../cutting-platform/overview.adapter'

export type CuttingSettlementScenarioType = 'CUTTING'
export type CuttingSettlementFocusLevel = 'NORMAL' | 'FOCUS' | 'HIGH_FOCUS'
export type CuttingScoreFocusLevel = 'NORMAL' | 'WATCH' | 'LOW_SCORE_RISK' | 'HIGH_ATTENTION'
export type CuttingInputReviewStatus = 'PENDING' | 'REVIEWING' | 'CONFIRMED' | 'NEED_MORE_INFO'
export type CuttingRecommendedScoreBand = 'EXCELLENT' | 'GOOD' | 'WATCH' | 'LIMIT'

export interface OperatorContributionSummary {
  operatorName: string
  operatorId: string
  actionCount: number
  pickupActionCount: number
  spreadingActionCount: number
  inboundActionCount: number
  handoverActionCount: number
  replenishmentFeedbackCount: number
  latestActionAt: string
  latestActionSummary: string
}

export interface GroupContributionSummary {
  groupName: string
  memberCount: number
  actionCount: number
  latestActionAt: string
  latestActionSummary: string
}

export interface CuttingPickupInputSummary {
  pickupSlipNo: string
  latestPrintVersionNo: string
  printCopyCount: number
  qrCodeValue: string
  qrStatus: string
  latestResultLabel: string
  latestScannedAt: string
  latestScannedBy: string
  needsRecheck: boolean
  hasPhotoEvidence: boolean
  summaryText: string
}

export interface CuttingExecutionInputSummary {
  cutPieceOrderCount: number
  markerMaintainedCount: number
  markerImageUploadedCount: number
  spreadingRecordCount: number
  latestSpreadingAt: string
  latestSpreadingBy: string
  currentProgressText: string
  summaryText: string
}

export interface CuttingReplenishmentInputSummary {
  suggestionCount: number
  pendingReviewCount: number
  approvedCount: number
  rejectedCount: number
  needMoreInfoCount: number
  highRiskCount: number
  summaryText: string
}

export interface CuttingWarehouseInputSummary {
  pendingInboundCount: number
  inboundedCount: number
  waitingHandoverCount: number
  handedOverCount: number
  unassignedZoneCount: number
  latestInboundAt: string
  latestInboundBy: string
  sampleWaitingReturnCount: number
  sampleOverdueCount: number
  summaryText: string
}

export interface CuttingExceptionImpactSummary {
  openExceptionCount: number
  highRiskExceptionCount: number
  repeatedRecheckCount: number
  insufficientEvidenceCount: number
  pendingExceptionCount: number
  settlementAttentionExceptionCount: number
  scoreAttentionExceptionCount: number
  hasSettlementImpact: boolean
  hasScoreImpact: boolean
  summaryText: string
}

export interface CuttingSettlementInput {
  settlementInputNo: string
  scenarioType: CuttingSettlementScenarioType
  productionOrderNo: string
  cuttingTaskNo: string
  cutPieceOrderCount: number
  factoryName: string
  factoryCode: string
  urgencyLevel: CuttingUrgencyLevel
  currentStage: PlatformCuttingOverviewStage
  latestActionAt: string
  latestActionBy: string
  operatorSummary: OperatorContributionSummary[]
  groupSummary: GroupContributionSummary[]
  pickupSummary: CuttingPickupInputSummary
  executionSummary: CuttingExecutionInputSummary
  replenishmentSummary: CuttingReplenishmentInputSummary
  warehouseSummary: CuttingWarehouseInputSummary
  exceptionImpactSummary: CuttingExceptionImpactSummary
  settlementFocusLevel: CuttingSettlementFocusLevel
  needsManualReview: boolean
  reviewStatus: CuttingInputReviewStatus
  reviewedBy: string
  reviewedAt: string
  reviewNote: string
  snapshotConfirmedAt: string
  snapshotConfirmedBy: string
}

export interface CuttingFactoryScoreInput {
  scoreInputNo: string
  scenarioType: CuttingSettlementScenarioType
  productionOrderNo: string
  cuttingTaskNo: string
  factoryName: string
  deliveryPerformanceSummary: string
  executionStabilitySummary: string
  exceptionPenaltySummary: string
  recheckSummary: string
  evidenceComplianceSummary: string
  sampleHandlingSummary: string
  scoreFocusLevel: CuttingScoreFocusLevel
  recommendedScoreBand: CuttingRecommendedScoreBand
  needsManualReview: boolean
  reviewStatus: CuttingInputReviewStatus
  reviewedBy: string
  reviewedAt: string
  reviewNote: string
}

export interface CuttingSettlementInputRoutes extends PlatformCuttingOverviewRoutes {
  platformOverview: string
  platformDetail: string
  platformExceptionCenter: string
}

export interface CuttingSettlementInputView {
  id: string
  scenarioType: CuttingSettlementScenarioType
  productionOrderNo: string
  cuttingTaskNo: string
  factoryName: string
  urgencyLevel: CuttingUrgencyLevel
  currentStage: PlatformCuttingOverviewStage
  settlementInput: CuttingSettlementInput
  scoreInput: CuttingFactoryScoreInput
  routes: CuttingSettlementInputRoutes
  latestActionText: string
  suggestedActionText: string
  executionSummaryText: string
  exceptionImpactText: string
  reviewStatus: CuttingInputReviewStatus
  hasExceptionImpact: boolean
  requiresSettlementAttention: boolean
  requiresScoreAttention: boolean
  isPending: boolean
  relatedExceptionNos: string[]
}

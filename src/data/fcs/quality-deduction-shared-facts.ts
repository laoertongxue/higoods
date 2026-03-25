import type { QcDisposition, QcStatus, ReturnInboundProcessType, SettlementPartyType } from './store-domain-quality-types.ts'
import {
  RETURN_INBOUND_QC_CHAIN_SCENARIOS,
  type ReturnInboundQcChainScenario,
} from './return-inbound-quality-chain-facts.ts'
import {
  deriveQualityDeductionCaseStatus,
  type DeductionBasisFact,
  type DisputeCaseFact,
  type FactoryResponseFact,
  type QualityDeductionBasisStatus,
  type QualityDeductionCaseFact,
  type QualityDeductionCaseStatus,
  type QualityDeductionDisputeAdjudicationResult,
  type QualityDeductionDisputeStatus,
  type QualityDeductionFactoryResponseStatus,
  type QualityDeductionLiabilityStatus,
  type QualityDeductionQcResult,
  type QualityDeductionSettlementAdjustmentType,
  type QualityDeductionSettlementImpactStatus,
  type QualityEvidenceAsset,
  type QcRecordFact,
  type SettlementAdjustmentFact,
  type SettlementImpactFact,
} from './quality-deduction-domain.ts'

interface CaseOverride {
  isLegacy?: boolean
  sourceTypeLabel?: string
  qcStatus?: QcStatus
  qcRemark?: string
  liabilityStatus?: QualityDeductionLiabilityStatus
  factoryLiabilityQty?: number
  nonFactoryLiabilityQty?: number
  factoryResponseStatus?: QualityDeductionFactoryResponseStatus
  responseDeadlineAt?: string
  respondedAt?: string
  autoConfirmedAt?: string
  responderUserName?: string
  responseComment?: string
  disputeStatus?: QualityDeductionDisputeStatus
  disputeReasonCode?: string
  disputeReasonName?: string
  disputeDescription?: string
  adjudicationResult?: QualityDeductionDisputeAdjudicationResult
  resultWrittenBackAt?: string
  adjustedLiableQty?: number
  adjustedBlockedProcessingFeeAmount?: number
  adjustedEffectiveQualityDeductionAmount?: number
  adjustmentReasonSummary?: string
  deductionBasisStatus?: QualityDeductionBasisStatus
  settlementImpactStatus?: QualityDeductionSettlementImpactStatus
  blockedSettlementQty?: number
  blockedProcessingFeeAmount?: number
  proposedQualityDeductionAmount?: number
  effectiveQualityDeductionAmount?: number
  basisSummary?: string
  candidateSettlementCycleId?: string
  includedAt?: string
  includedSettlementStatementId?: string
  includedSettlementBatchId?: string
  statementLockedAt?: string
  eligibleAt?: string
  settledAt?: string
  lastWrittenBackAt?: string
  settlementSummary?: string
  writebackCompletedAt?: string
  writebackCompletedBy?: string
  adjustment?: {
    adjustmentId: string
    adjustmentNo?: string
    adjustmentType: QualityDeductionSettlementAdjustmentType
    adjustmentQty: number
    adjustmentAmount: number
    targetSettlementCycleId: string
    summary: string
    generatedAt: string
    currency?: string
    adjustmentReasonCode?: string
    adjustmentReasonSummary?: string
    writebackStatus?: 'NOT_WRITTEN' | 'PENDING_WRITEBACK' | 'WRITTEN'
    writtenBackAt?: string
  } | null
}

type RawCaseSeed = ReturnInboundQcChainScenario & {
  legacy?: boolean
  routeAliases?: string[]
}

const PROCESS_LABEL: Record<ReturnInboundProcessType, string> = {
  PRINT: '印花',
  DYE: '染色',
  CUT_PANEL: '裁片',
  SEW: '车缝',
  OTHER: '其他',
  DYE_PRINT: '染印',
}

const SEW_MODE_LABEL: Record<string, string> = {
  SEW_WITH_POST: '车缝（含后道）',
  SEW_WITHOUT_POST_WAREHOUSE_INTEGRATED: '车缝（后道仓一体）',
}

const PROCESSING_FEE_RATE: Record<ReturnInboundProcessType, number> = {
  PRINT: 4,
  DYE: 5,
  CUT_PANEL: 6,
  SEW: 12,
  OTHER: 3,
  DYE_PRINT: 6,
}

const LEGACY_QC_RAW_CASES: RawCaseSeed[] = [
  {
    qcId: 'QC-020',
    batchId: 'RIB-LEGACY-020',
    productionOrderId: 'PO-LEGACY-020',
    taskId: 'TASK-LEGACY-020',
    processType: 'SEW',
    returnedQty: 120,
    returnFactoryId: 'ID-F001',
    returnFactoryName: 'PT Sinar Garment Indonesia',
    warehouseId: 'WH-LEGACY-01',
    warehouseName: '历史归档仓',
    inboundAt: '2025-12-18 09:20:00',
    inboundBy: '历史仓库员',
    qcPolicy: 'REQUIRED',
    inspector: '历史质检员',
    inspectedAt: '2025-12-18 10:00:00',
    result: 'FAIL',
    inspectedQty: 120,
    qualifiedQty: 108,
    unqualifiedQty: 12,
    status: 'CLOSED',
    remark: '历史旧记录：已结案并完成结算',
    rootCauseType: 'PROCESS',
    liabilityStatus: 'CONFIRMED',
    sourceBusinessType: 'TASK',
    sourceBusinessId: 'TASK-LEGACY-020',
    disposition: 'ACCEPT_AS_DEFECT',
    affectedQty: 12,
    defectItems: [{ defectCode: 'L001', defectName: '车线断裂', qty: 12 }],
    responsiblePartyType: 'FACTORY',
    responsiblePartyId: 'ID-F001',
    responsiblePartyName: 'PT Sinar Garment Indonesia',
    deductionDecision: 'DEDUCT',
    deductionAmount: 600,
    deductionDecisionRemark: '历史批次已扣回',
    liabilityDecidedAt: '2025-12-18 10:00:00',
    liabilityDecidedBy: '历史质检员',
    dispositionRemark: '历史次品转尾货处理',
    basis: {
      basisId: 'DBI-033',
      sourceType: 'QC_DEFECT_ACCEPT',
      status: 'CONFIRMED',
      deductionQty: 12,
      deductionAmount: 600,
      settlementReady: true,
      summary: '历史旧记录，已结案并在旧结算批次中扣回',
      evidenceRefs: [{ name: '历史质检底稿', type: '文档' }],
      createdAt: '2025-12-18 10:05:00',
      updatedAt: '2025-12-18 10:20:00',
      deductionAmountEditable: false,
    },
    settlementImpact: {
      qcId: 'QC-020',
      basisId: 'DBI-033',
      factoryId: 'ID-F001',
      batchId: 'RIB-LEGACY-020',
      status: 'SETTLED',
      summary: '历史结算已扣回',
      settlementBatchId: 'STL-2025-12-LEGACY',
      settledAt: '2025-12-18 10:20:00',
    },
    legacy: true,
    routeAliases: ['TASK-LEGACY-020'],
  },
  {
    qcId: 'QC-021',
    batchId: 'RIB-LEGACY-021',
    productionOrderId: 'PO-LEGACY-021',
    taskId: 'TASK-LEGACY-021',
    processType: 'PRINT',
    returnedQty: 90,
    returnFactoryId: 'PROC-DP-001',
    returnFactoryName: 'Bandung Print House',
    warehouseId: 'WH-LEGACY-02',
    warehouseName: '历史归档仓',
    inboundAt: '2025-11-05 14:30:00',
    inboundBy: '历史仓库员',
    qcPolicy: 'OPTIONAL',
    inspector: '历史质检员',
    inspectedAt: '2025-11-05 15:00:00',
    result: 'FAIL',
    inspectedQty: 90,
    qualifiedQty: 81,
    unqualifiedQty: 9,
    status: 'CLOSED',
    remark: '历史旧记录：争议处理后归档',
    rootCauseType: 'DYE_PRINT',
    liabilityStatus: 'VOID',
    sourceBusinessType: 'DYE_PRINT_ORDER',
    sourceBusinessId: 'DPO-LEGACY-021',
    sourceOrderId: 'DPO-LEGACY-021',
    disposition: 'ACCEPT_AS_DEFECT',
    affectedQty: 9,
    defectItems: [{ defectCode: 'L002', defectName: '花型偏移', qty: 9 }],
    responsiblePartyType: 'PROCESSOR',
    responsiblePartyId: 'PROC-DP-001',
    responsiblePartyName: 'Bandung Print House',
    deductionDecision: 'DEDUCT',
    deductionAmount: 540,
    deductionDecisionRemark: '历史争议改判为非工厂责任，生成冲回调整项',
    liabilityDecidedAt: '2025-11-05 15:00:00',
    liabilityDecidedBy: '历史质检员',
    dispositionRemark: '历史记录已归档',
    basis: {
      basisId: 'DBI-034',
      sourceType: 'QC_DEFECT_ACCEPT',
      status: 'VOID',
      deductionQty: 9,
      deductionAmount: 540,
      settlementReady: false,
      settlementFreezeReason: '历史记录已归档',
      summary: '历史旧记录：争议改判后归档',
      evidenceRefs: [{ name: '历史争议结论', type: '文档' }],
      arbitrationResult: 'VOID_DEDUCTION',
      arbitrationRemark: '改判为非工厂责任并冲回',
      createdAt: '2025-11-05 15:05:00',
      updatedAt: '2025-11-05 15:10:00',
      deductionAmountEditable: false,
    },
    dispute: {
      disputeId: 'QCD-LEGACY-021',
      qcId: 'QC-021',
      basisId: 'DBI-034',
      factoryId: 'PROC-DP-001',
      status: 'ARCHIVED',
      summary: '历史争议已结案并归档，最终判定非工厂责任',
      submittedAt: '2025-11-05 15:02:00',
      submittedBy: '工厂财务-Dewi',
      resolvedAt: '2025-11-05 15:10:00',
      resolvedBy: '历史运营',
      requestedAmount: 540,
      finalAmount: 0,
    },
    settlementImpact: {
      qcId: 'QC-021',
      basisId: 'DBI-034',
      factoryId: 'PROC-DP-001',
      batchId: 'RIB-LEGACY-021',
      status: 'NO_IMPACT',
      summary: '历史争议改判后不再影响结算',
    },
    legacy: true,
    routeAliases: ['TASK-LEGACY-021'],
  },
]

const CASE_OVERRIDES: Record<string, CaseOverride> = {
  'QC-RIB-202603-0001': {
    sourceTypeLabel: '回货入仓批次',
    liabilityStatus: 'NON_FACTORY',
    factoryLiabilityQty: 0,
    nonFactoryLiabilityQty: 0,
    factoryResponseStatus: 'NOT_REQUIRED',
    settlementImpactStatus: 'NO_IMPACT',
  },
  'QC-RIB-202603-0002': {
    sourceTypeLabel: '回货入仓批次',
    liabilityStatus: 'FACTORY',
    factoryLiabilityQty: 42,
    nonFactoryLiabilityQty: 0,
    factoryResponseStatus: 'DISPUTED',
    responseDeadlineAt: '2026-03-10 18:00:00',
    respondedAt: '2026-03-08 18:10:00',
    responderUserName: '工厂财务-Adi',
    responseComment: '工厂对责任数量提出异议',
    disputeStatus: 'IN_REVIEW',
    disputeReasonCode: 'MATERIAL_VARIANCE',
    disputeReasonName: '面料弹性偏差',
    disputeDescription: '工厂认为问题源自面料弹性偏差，需平台复核扣款数量。',
    deductionBasisStatus: 'GENERATED',
    settlementImpactStatus: 'BLOCKED',
    blockedSettlementQty: 42,
    blockedProcessingFeeAmount: 504,
    proposedQualityDeductionAmount: 1260,
    effectiveQualityDeductionAmount: 1260,
    includedAt: '2026-03-07 09:30:00',
    includedSettlementStatementId: 'STMT-2026-W10-002',
    includedSettlementBatchId: 'STL-2026-W10',
    statementLockedAt: '2026-03-08 12:00:00',
  },
  'QC-RIB-202603-0003': {
    sourceTypeLabel: '回货入仓批次',
    qcStatus: 'SUBMITTED',
    qcRemark: '车缝回货抽检不合格，等待工厂在 48 小时内确认或发起异议。',
    liabilityStatus: 'FACTORY',
    factoryLiabilityQty: 28,
    nonFactoryLiabilityQty: 0,
    factoryResponseStatus: 'PENDING_RESPONSE',
    responseDeadlineAt: '2026-03-11 11:20:00',
    responseComment: '等待工厂响应，超过 48 小时将进入系统自动确认。',
    deductionBasisStatus: 'GENERATED',
    basisSummary: '车缝回货入仓已生成扣款依据，等待工厂确认责任与金额。',
    settlementImpactStatus: 'BLOCKED',
    blockedSettlementQty: 28,
    blockedProcessingFeeAmount: 336,
    proposedQualityDeductionAmount: 1680,
    effectiveQualityDeductionAmount: 1680,
    settlementSummary: '等待工厂响应，当前冻结对应加工费与质量扣款。',
    writebackCompletedAt: undefined,
    writebackCompletedBy: undefined,
    settledAt: undefined,
  },
  'QC-RIB-202603-0004': {
    sourceTypeLabel: '回货入仓批次',
    liabilityStatus: 'NON_FACTORY',
    factoryLiabilityQty: 0,
    nonFactoryLiabilityQty: 0,
    factoryResponseStatus: 'NOT_REQUIRED',
    settlementImpactStatus: 'ELIGIBLE',
    eligibleAt: '2026-03-10 10:15:00',
  },
  'QC-NEW-001': {
    sourceTypeLabel: '回货入仓批次',
    liabilityStatus: 'MIXED',
    factoryLiabilityQty: 20,
    nonFactoryLiabilityQty: 11,
    factoryResponseStatus: 'PENDING_RESPONSE',
    responseDeadlineAt: '2026-03-26 18:00:00',
    responseComment: '等待工厂确认混合责任与部分冻结金额',
    deductionBasisStatus: 'GENERATED',
    settlementImpactStatus: 'BLOCKED',
    blockedSettlementQty: 11,
    blockedProcessingFeeAmount: 132,
    proposedQualityDeductionAmount: 980,
    effectiveQualityDeductionAmount: 980,
  },
  'QC-NEW-002': {
    sourceTypeLabel: '回货入仓批次',
    liabilityStatus: 'FACTORY',
    factoryLiabilityQty: 37,
    nonFactoryLiabilityQty: 0,
    factoryResponseStatus: 'DISPUTED',
    responseDeadlineAt: '2026-03-13 18:00:00',
    respondedAt: '2026-03-11 16:20:00',
    responderUserName: '工厂财务-Adi',
    responseComment: '已提交异议并上传说明材料',
    disputeStatus: 'PENDING_REVIEW',
    disputeReasonCode: 'QTY_DISAGREEMENT',
    disputeReasonName: '可扣款数量异议',
    disputeDescription: '工厂认为仓库判定的可扣款数量偏高，请求复核。',
    deductionBasisStatus: 'GENERATED',
    settlementImpactStatus: 'BLOCKED',
    blockedSettlementQty: 37,
    blockedProcessingFeeAmount: 444,
    proposedQualityDeductionAmount: 1420,
    effectiveQualityDeductionAmount: 1420,
  },
  'QC-NEW-003': {
    sourceTypeLabel: '回货入仓批次',
    liabilityStatus: 'NON_FACTORY',
    factoryLiabilityQty: 0,
    nonFactoryLiabilityQty: 18,
    factoryResponseStatus: 'DISPUTED',
    responseDeadlineAt: '2026-03-14 14:00:00',
    respondedAt: '2026-03-12 14:00:00',
    responderUserName: '工厂财务-Dewi',
    responseComment: '工厂已发起异议，平台维持原判',
    disputeStatus: 'UPHELD',
    disputeReasonCode: 'PRINT_ALIGNMENT',
    disputeReasonName: '印花偏位责任申诉',
    disputeDescription: '工厂主张偏位与来料有关，平台复核后维持原扣款结论。',
    adjudicationResult: 'UPHELD',
    resultWrittenBackAt: '2026-03-12 14:30:00',
    deductionBasisStatus: 'EFFECTIVE',
    settlementImpactStatus: 'BLOCKED',
    blockedSettlementQty: 18,
    blockedProcessingFeeAmount: 72,
    proposedQualityDeductionAmount: 540,
    effectiveQualityDeductionAmount: 540,
  },
  'QC-NEW-004': {
    sourceTypeLabel: '回货入仓批次',
    liabilityStatus: 'FACTORY',
    factoryLiabilityQty: 26,
    nonFactoryLiabilityQty: 0,
    factoryResponseStatus: 'DISPUTED',
    responseDeadlineAt: '2026-03-14 16:00:00',
    respondedAt: '2026-03-12 16:05:00',
    responderUserName: '工厂财务-Adi',
    responseComment: '工厂异议后平台改判并下调金额',
    disputeStatus: 'PARTIALLY_ADJUSTED',
    disputeReasonCode: 'SEWING_REMEASURE',
    disputeReasonName: '复核后数量下调',
    disputeDescription: '平台复核后下调责任数量及扣款金额，按改判结果进入结算。',
    adjudicationResult: 'PARTIALLY_ADJUSTED',
    resultWrittenBackAt: '2026-03-12 16:18:00',
    adjustedLiableQty: 26,
    adjustedBlockedProcessingFeeAmount: 0,
    adjustedEffectiveQualityDeductionAmount: 860,
    adjustmentReasonSummary: '平台复核后下调责任数量及扣款金额，差额转入下周期调整。',
    deductionBasisStatus: 'ADJUSTED',
    settlementImpactStatus: 'NEXT_CYCLE_ADJUSTMENT_PENDING',
    blockedSettlementQty: 0,
    blockedProcessingFeeAmount: 0,
    proposedQualityDeductionAmount: 1100,
    effectiveQualityDeductionAmount: 860,
    candidateSettlementCycleId: 'STL-2026-03-W3',
    eligibleAt: '2026-03-12 16:18:00',
    adjustment: {
      adjustmentId: 'SADJ-202603-0001',
      adjustmentNo: 'ADJ-202603-0001',
      adjustmentType: 'DECREASE_DEDUCTION',
      adjustmentQty: 5,
      adjustmentAmount: 240,
      targetSettlementCycleId: 'STL-2026-03-W3',
      summary: '争议部分成立，下周期减少扣款 240 CNY',
      generatedAt: '2026-03-12 16:18:00',
      currency: 'CNY',
      adjustmentReasonCode: 'DISPUTE_PARTIAL_ADJUST',
      adjustmentReasonSummary: '平台复核后下调责任数量及质量扣款金额。',
      writebackStatus: 'PENDING_WRITEBACK',
    },
  },
  'QC-NEW-005': {
    sourceTypeLabel: '回货入仓批次',
    liabilityStatus: 'FACTORY',
    factoryLiabilityQty: 56,
    nonFactoryLiabilityQty: 0,
    factoryResponseStatus: 'PENDING_RESPONSE',
    responseDeadlineAt: '2026-03-27 18:00:00',
    responseComment: '等待工厂确认裁片报废责任',
    deductionBasisStatus: 'GENERATED',
    settlementImpactStatus: 'BLOCKED',
    blockedSettlementQty: 56,
    blockedProcessingFeeAmount: 336,
    proposedQualityDeductionAmount: 920,
    effectiveQualityDeductionAmount: 920,
  },
  'QC-NEW-006': {
    sourceTypeLabel: '回货入仓批次',
    liabilityStatus: 'FACTORY',
    factoryLiabilityQty: 22,
    nonFactoryLiabilityQty: 0,
    factoryResponseStatus: 'DISPUTED',
    responseDeadlineAt: '2026-03-15 18:00:00',
    respondedAt: '2026-03-13 14:20:00',
    responderUserName: '工厂财务-Siti',
    responseComment: '工厂已提交异议，等待平台裁决',
    disputeStatus: 'PENDING_REVIEW',
    disputeReasonCode: 'CUT_DAMAGE',
    disputeReasonName: '裁片缺口责任申诉',
    disputeDescription: '工厂对裁片缺口责任提出异议，当前等待平台完成裁决回写。',
    deductionBasisStatus: 'GENERATED',
    settlementImpactStatus: 'BLOCKED',
    blockedSettlementQty: 22,
    blockedProcessingFeeAmount: 132,
    proposedQualityDeductionAmount: 760,
    effectiveQualityDeductionAmount: 760,
    includedAt: '2026-03-13 17:00:00',
    includedSettlementStatementId: 'STMT-2026-W11-004',
    includedSettlementBatchId: 'STL-2026-W11',
    statementLockedAt: '2026-03-14 09:00:00',
  },
  'QC-NEW-007': {
    sourceTypeLabel: '回货入仓批次',
    liabilityStatus: 'NON_FACTORY',
    factoryLiabilityQty: 0,
    nonFactoryLiabilityQty: 0,
    factoryResponseStatus: 'NOT_REQUIRED',
    settlementImpactStatus: 'ELIGIBLE',
    eligibleAt: '2026-03-14 09:55:00',
  },
  'QC-NEW-008': {
    sourceTypeLabel: '回货入仓批次',
    liabilityStatus: 'NON_FACTORY',
    factoryLiabilityQty: 0,
    nonFactoryLiabilityQty: 12,
    factoryResponseStatus: 'NOT_REQUIRED',
    deductionBasisStatus: 'EFFECTIVE',
    settlementImpactStatus: 'ELIGIBLE',
    blockedSettlementQty: 0,
    blockedProcessingFeeAmount: 0,
    proposedQualityDeductionAmount: 430,
    effectiveQualityDeductionAmount: 430,
    eligibleAt: '2026-03-14 12:05:00',
  },
  'QC-NEW-009': {
    sourceTypeLabel: '回货入仓批次',
    liabilityStatus: 'NON_FACTORY',
    factoryLiabilityQty: 0,
    nonFactoryLiabilityQty: 23,
    factoryResponseStatus: 'NOT_REQUIRED',
    deductionBasisStatus: 'GENERATED',
    settlementImpactStatus: 'BLOCKED',
    blockedSettlementQty: 23,
    blockedProcessingFeeAmount: 115,
    proposedQualityDeductionAmount: 690,
    effectiveQualityDeductionAmount: 690,
  },
  'QC-NEW-010': {
    sourceTypeLabel: '回货入仓批次',
    liabilityStatus: 'FACTORY',
    factoryLiabilityQty: 52,
    nonFactoryLiabilityQty: 0,
    factoryResponseStatus: 'CONFIRMED',
    responseDeadlineAt: '2026-03-17 18:00:00',
    respondedAt: '2026-03-15 11:10:00',
    responderUserName: '工厂厂长-Siti',
    responseComment: '已确认裁片报废责任与扣款',
    deductionBasisStatus: 'EFFECTIVE',
    settlementImpactStatus: 'ELIGIBLE',
    blockedSettlementQty: 0,
    blockedProcessingFeeAmount: 0,
    proposedQualityDeductionAmount: 1180,
    effectiveQualityDeductionAmount: 1180,
    eligibleAt: '2026-03-15 11:05:00',
  },
  'QC-NEW-011': {
    sourceTypeLabel: '回货入仓批次',
    liabilityStatus: 'FACTORY',
    factoryLiabilityQty: 24,
    nonFactoryLiabilityQty: 0,
    factoryResponseStatus: 'CONFIRMED',
    responseDeadlineAt: '2026-03-18 18:00:00',
    respondedAt: '2026-03-16 09:35:00',
    responderUserName: '工厂财务-Adi',
    responseComment: '工厂已确认并在本周结算单执行扣回',
    deductionBasisStatus: 'EFFECTIVE',
    settlementImpactStatus: 'SETTLED',
    blockedSettlementQty: 0,
    blockedProcessingFeeAmount: 0,
    proposedQualityDeductionAmount: 1320,
    effectiveQualityDeductionAmount: 1320,
    includedSettlementStatementId: 'STMT-2026-W12-001',
    includedSettlementBatchId: 'STL-2026-W12',
    settledAt: '2026-03-20 17:00:00',
  },
  'QC-020': {
    sourceTypeLabel: '历史质检记录',
    liabilityStatus: 'FACTORY',
    factoryLiabilityQty: 12,
    nonFactoryLiabilityQty: 0,
    factoryResponseStatus: 'CONFIRMED',
    respondedAt: '2025-12-18 10:00:00',
    responderUserName: '历史工厂确认',
    deductionBasisStatus: 'EFFECTIVE',
    settlementImpactStatus: 'SETTLED',
    blockedSettlementQty: 0,
    blockedProcessingFeeAmount: 0,
    proposedQualityDeductionAmount: 600,
    effectiveQualityDeductionAmount: 600,
    includedSettlementStatementId: 'STMT-2025-12-LEGACY',
    includedSettlementBatchId: 'STL-2025-12-LEGACY',
    settledAt: '2025-12-18 10:20:00',
  },
  'QC-021': {
    sourceTypeLabel: '历史质检记录',
    liabilityStatus: 'NON_FACTORY',
    factoryLiabilityQty: 0,
    nonFactoryLiabilityQty: 9,
    factoryResponseStatus: 'DISPUTED',
    respondedAt: '2025-11-05 15:02:00',
    responderUserName: '工厂财务-Dewi',
    responseComment: '历史争议已提交',
    disputeStatus: 'REVERSED',
    disputeReasonCode: 'PRINT_ALIGNMENT',
    disputeReasonName: '印花偏移责任改判',
    disputeDescription: '历史争议改判为非工厂责任，原扣款冲回并归档。',
    adjudicationResult: 'REVERSED',
    resultWrittenBackAt: '2025-11-05 15:10:00',
    adjustedLiableQty: 0,
    adjustedBlockedProcessingFeeAmount: 0,
    adjustedEffectiveQualityDeductionAmount: 0,
    adjustmentReasonSummary: '历史争议改判为非工厂责任，原扣款全部冲回。',
    deductionBasisStatus: 'CANCELLED',
    settlementImpactStatus: 'NEXT_CYCLE_ADJUSTMENT_PENDING',
    blockedSettlementQty: 0,
    blockedProcessingFeeAmount: 0,
    proposedQualityDeductionAmount: 540,
    effectiveQualityDeductionAmount: 0,
    candidateSettlementCycleId: 'STL-2025-11-ROLLBACK',
    adjustment: {
      adjustmentId: 'SADJ-202511-0001',
      adjustmentNo: 'ADJ-202511-0001',
      adjustmentType: 'REVERSAL',
      adjustmentQty: 9,
      adjustmentAmount: 540,
      targetSettlementCycleId: 'STL-2025-11-ROLLBACK',
      summary: '历史争议改判后冲回原质量扣款 540 CNY',
      generatedAt: '2025-11-05 15:10:00',
      currency: 'CNY',
      adjustmentReasonCode: 'DISPUTE_REVERSAL',
      adjustmentReasonSummary: '历史争议改判为非工厂责任，原扣款冲回。',
      writebackStatus: 'WRITTEN',
      writtenBackAt: '2025-11-06 09:00:00',
    },
  },
}

const RAW_CASES: RawCaseSeed[] = [...RETURN_INBOUND_QC_CHAIN_SCENARIOS, ...LEGACY_QC_RAW_CASES]

function normalizeQty(value?: number): number {
  if (value === undefined || value === null || !Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

function parseDateMs(value?: string): number | null {
  if (!value) return null
  const timestamp = new Date(value.replace(' ', 'T')).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

function isPastDeadline(deadline?: string, now: Date = new Date()): boolean {
  const deadlineMs = parseDateMs(deadline)
  if (deadlineMs === null) return false
  return deadlineMs < now.getTime()
}

function resolveInspectionQtys(scenario: RawCaseSeed) {
  const inspectedQty = normalizeQty(scenario.inspectedQty || scenario.returnedQty)
  const defectQty = normalizeQty(
    scenario.defectItems?.reduce((sum, item) => sum + item.qty, 0) ?? scenario.affectedQty,
  )
  let qualifiedQty = normalizeQty(scenario.qualifiedQty)
  let unqualifiedQty = normalizeQty(scenario.unqualifiedQty)

  if (scenario.result === 'PASS') {
    qualifiedQty = inspectedQty
    unqualifiedQty = 0
  } else if (!scenario.inspectedQty && !scenario.qualifiedQty && !scenario.unqualifiedQty) {
    unqualifiedQty = Math.min(defectQty || inspectedQty, inspectedQty)
    qualifiedQty = Math.max(inspectedQty - unqualifiedQty, 0)
  } else if (qualifiedQty + unqualifiedQty !== inspectedQty) {
    unqualifiedQty = Math.min(unqualifiedQty || defectQty || inspectedQty, inspectedQty)
    qualifiedQty = Math.max(inspectedQty - unqualifiedQty, 0)
  }

  const qcResult: QualityDeductionQcResult =
    unqualifiedQty <= 0
      ? 'QUALIFIED'
      : qualifiedQty > 0
        ? 'PARTIALLY_QUALIFIED'
        : 'UNQUALIFIED'

  return { inspectedQty, qualifiedQty, unqualifiedQty, qcResult }
}

function createEvidenceAssets(qcId: string, assets: Array<{ name: string; type?: string; url?: string }>): QualityEvidenceAsset[] {
  return assets.map((asset, index) => ({
    assetId: `${qcId}-ASSET-${String(index + 1).padStart(2, '0')}`,
    name: asset.name,
    assetType:
      asset.type === '视频'
        ? 'VIDEO'
        : asset.type === '图片'
          ? 'IMAGE'
          : 'DOCUMENT',
    url: asset.url,
  }))
}

function resolveLiabilityStatus(
  scenario: RawCaseSeed,
  override: CaseOverride,
  unqualifiedQty: number,
): { status: QualityDeductionLiabilityStatus; factoryLiabilityQty: number; nonFactoryLiabilityQty: number } {
  const status = override.liabilityStatus ?? 'PENDING'
  const baseFactoryQty =
    override.factoryLiabilityQty ??
    (status === 'FACTORY' ? unqualifiedQty : status === 'MIXED' ? Math.max(Math.floor(unqualifiedQty * 0.6), 1) : 0)
  const baseNonFactoryQty =
    override.nonFactoryLiabilityQty ??
    (status === 'NON_FACTORY'
      ? unqualifiedQty
      : status === 'MIXED'
        ? Math.max(unqualifiedQty - baseFactoryQty, 0)
        : 0)

  return {
    status,
    factoryLiabilityQty: baseFactoryQty,
    nonFactoryLiabilityQty: baseNonFactoryQty,
  }
}

function resolveProcessLabel(scenario: RawCaseSeed): string {
  if (scenario.processType === 'SEW' && scenario.sewPostProcessMode) {
    return SEW_MODE_LABEL[scenario.sewPostProcessMode] ?? PROCESS_LABEL.SEW
  }
  return PROCESS_LABEL[scenario.processType] ?? '其他'
}

function resolveBlockedProcessingFeeAmount(
  scenario: RawCaseSeed,
  override: CaseOverride,
  blockedSettlementQty: number,
): number {
  if (override.blockedProcessingFeeAmount !== undefined) {
    return override.blockedProcessingFeeAmount
  }
  if (blockedSettlementQty <= 0) return 0
  return blockedSettlementQty * (PROCESSING_FEE_RATE[scenario.processType] ?? 0)
}

function createQcRecordFact(scenario: RawCaseSeed): QcRecordFact {
  const override = CASE_OVERRIDES[scenario.qcId] ?? {}
  const { inspectedQty, qualifiedQty, unqualifiedQty, qcResult } = resolveInspectionQtys(scenario)
  const liability = resolveLiabilityStatus(scenario, override, unqualifiedQty)
  const qcStatus = override.qcStatus ?? scenario.status
  const writebackCompletedAt =
    Object.prototype.hasOwnProperty.call(override, 'writebackCompletedAt')
      ? override.writebackCompletedAt
      : scenario.writeback?.completedAt
  const writebackCompletedBy =
    Object.prototype.hasOwnProperty.call(override, 'writebackCompletedBy')
      ? override.writebackCompletedBy
      : scenario.writeback?.completedBy
  const evidenceAssets = createEvidenceAssets(
    scenario.qcId,
    [
      ...(scenario.basis?.evidenceRefs ?? []),
      ...(scenario.dispute
        ? [{ name: scenario.dispute.summary, type: '文档' }]
        : []),
    ],
  )

  return {
    qcId: scenario.qcId,
    qcNo: scenario.qcId,
    routeAliases: Array.from(
      new Set([
        scenario.qcId,
        scenario.batchId,
        scenario.taskId,
        scenario.sourceBusinessId,
        scenario.sourceOrderId,
        ...(scenario.routeAliases ?? []),
      ].filter((item): item is string => Boolean(item))),
    ),
    isLegacy: Boolean(scenario.legacy),
    refType: 'RETURN_BATCH',
    refId: scenario.batchId,
    refTaskId: scenario.taskId,
    sourceTypeLabel: override.sourceTypeLabel ?? '回货入仓批次',
    returnInboundBatchNo: scenario.batchId,
    productionOrderNo: scenario.productionOrderId,
    taskId: scenario.taskId,
    processType: scenario.processType,
    processLabel: resolveProcessLabel(scenario),
    qcPolicy: scenario.qcPolicy,
    qcStatus,
    inspectorUserName: scenario.inspector,
    inspectedAt: scenario.inspectedAt,
    defectItems: scenario.defectItems ?? [],
    inspectedQty,
    qualifiedQty,
    unqualifiedQty,
    qcResult,
    unqualifiedDisposition: qcResult === 'QUALIFIED' ? undefined : scenario.disposition,
    unqualifiedReasonSummary: scenario.defectItems?.map((item) => `${item.defectName}×${item.qty}`).join('、') ?? '',
    remark: override.qcRemark ?? scenario.remark,
    rootCauseType: scenario.rootCauseType,
    liabilityStatus: liability.status,
    factoryLiabilityQty: liability.factoryLiabilityQty,
    nonFactoryLiabilityQty: liability.nonFactoryLiabilityQty,
    responsiblePartyType: scenario.responsiblePartyType,
    responsiblePartyId: scenario.responsiblePartyId,
    responsiblePartyName: scenario.responsiblePartyName,
    deductionDecision: scenario.deductionDecision,
    deductionDecisionRemark: scenario.deductionDecisionRemark,
    dispositionRemark: scenario.dispositionRemark,
    liabilityDecidedAt: scenario.liabilityDecidedAt,
    liabilityDecidedBy: scenario.liabilityDecidedBy,
    returnFactoryId: scenario.returnFactoryId,
    returnFactoryName: scenario.returnFactoryName,
    warehouseId: scenario.warehouseId,
    warehouseName: scenario.warehouseName,
    inboundAt: scenario.inboundAt,
    inboundBy: scenario.inboundBy,
    sourceBusinessType: scenario.sourceBusinessType,
    sourceBusinessId: scenario.sourceBusinessId,
    sourceOrderId: scenario.sourceOrderId,
    sewPostProcessMode: scenario.sewPostProcessMode,
    writebackAvailableQty: scenario.writeback?.availableQty,
    writebackAcceptedAsDefectQty: scenario.writeback?.acceptedAsDefectQty,
    writebackScrapQty: scenario.writeback?.scrapQty,
    writebackCompletedAt,
    writebackCompletedBy,
    downstreamUnblocked: scenario.writeback?.downstreamUnblocked,
    evidenceAssets,
    auditLogs: [
      {
        id: `AL-${scenario.qcId}-01`,
        action: 'CREATE_FROM_RETURN_INBOUND',
        detail: `回货入仓批次 ${scenario.batchId} 生成质检记录`,
        at: scenario.inspectedAt,
        by: '系统',
      },
      {
        id: `AL-${scenario.qcId}-02`,
        action: 'SUBMIT_QC',
        detail: `提交质检结果 ${qcResult === 'QUALIFIED' ? '合格' : qcResult === 'PARTIALLY_QUALIFIED' ? '部分合格' : '不合格'}`,
        at: scenario.inspectedAt,
        by: scenario.inspector,
      },
      ...(scenario.liabilityDecidedAt && scenario.liabilityDecidedBy
        ? [
            {
              id: `AL-${scenario.qcId}-03`,
              action: 'FINAL_LIABILITY_DECISION',
              detail: scenario.deductionDecision === 'DEDUCT'
                ? `完成责任判定并同步扣款 ${scenario.deductionAmount ?? 0} CNY`
                : '完成责任判定，不进入扣款',
              at: scenario.liabilityDecidedAt,
              by: scenario.liabilityDecidedBy,
            },
          ]
        : []),
      ...(writebackCompletedAt && writebackCompletedBy
        ? [
            {
              id: `AL-${scenario.qcId}-04`,
              action: 'WRITEBACK_SETTLEMENT_CHAIN',
              detail: scenario.settlementImpact.summary,
              at: writebackCompletedAt,
              by: writebackCompletedBy,
            },
          ]
        : []),
    ],
    createdAt: scenario.inspectedAt,
    updatedAt: writebackCompletedAt ?? scenario.liabilityDecidedAt ?? scenario.inspectedAt,
    closedAt:
      qcStatus === 'CLOSED'
        ? writebackCompletedAt ?? scenario.liabilityDecidedAt ?? scenario.inspectedAt
        : undefined,
    closedBy:
      qcStatus === 'CLOSED'
        ? writebackCompletedBy ?? scenario.liabilityDecidedBy ?? scenario.inspector
        : undefined,
  }
}

function createFactoryResponseFact(
  scenario: RawCaseSeed,
  qcRecord: QcRecordFact,
): FactoryResponseFact | null {
  const override = CASE_OVERRIDES[scenario.qcId] ?? {}
  const status = override.factoryResponseStatus
  if (!status) return null

  return {
    responseId: `QFR-${scenario.qcId}`,
    qcId: scenario.qcId,
    factoryId: scenario.returnFactoryId,
    factoryResponseStatus: status,
    responseDeadlineAt: override.responseDeadlineAt,
    respondedAt: override.respondedAt,
    autoConfirmedAt: override.autoConfirmedAt,
    responderUserName: override.responderUserName,
    responseAction:
      status === 'CONFIRMED'
        ? 'CONFIRM'
        : status === 'AUTO_CONFIRMED'
          ? 'AUTO_CONFIRM'
          : status === 'DISPUTED'
            ? 'DISPUTE'
            : undefined,
    responseComment: override.responseComment,
    isOverdue:
      Boolean(override.responseDeadlineAt) &&
      !override.respondedAt &&
      !override.autoConfirmedAt &&
      qcRecord.qcStatus !== 'CLOSED' &&
      isPastDeadline(override.responseDeadlineAt),
  }
}

function createDeductionBasisFact(
  scenario: RawCaseSeed,
  qcRecord: QcRecordFact,
): DeductionBasisFact | null {
  if (!scenario.basis) return null
  const override = CASE_OVERRIDES[scenario.qcId] ?? {}
  const status = override.deductionBasisStatus ?? 'GENERATED'
  const blockedSettlementQty = override.blockedSettlementQty ?? qcRecord.factoryLiabilityQty
  const blockedProcessingFeeAmount = resolveBlockedProcessingFeeAmount(
    scenario,
    override,
    blockedSettlementQty,
  )
  const proposedQualityDeductionAmount =
    override.proposedQualityDeductionAmount ?? scenario.dispute?.requestedAmount ?? scenario.basis.deductionAmount ?? 0
  const effectiveQualityDeductionAmount =
    override.effectiveQualityDeductionAmount ?? scenario.dispute?.finalAmount ?? scenario.basis.deductionAmount ?? 0

  return {
    basisId: scenario.basis.basisId,
    qcId: scenario.qcId,
    sourceType: scenario.basis.sourceType,
    status,
    productionOrderNo: scenario.productionOrderId,
    taskId: scenario.taskId,
    returnInboundBatchNo: scenario.batchId,
    sourceBusinessType: scenario.sourceBusinessType,
    sourceBusinessId: scenario.sourceBusinessId,
    processType: scenario.processType,
    processLabel: qcRecord.processLabel,
    settlementPartyType: scenario.responsiblePartyType,
    settlementPartyId: scenario.responsiblePartyId,
    responsiblePartyType: scenario.responsiblePartyType,
    responsiblePartyId: scenario.responsiblePartyId,
    responsiblePartyName: scenario.responsiblePartyName,
    rootCauseType: scenario.rootCauseType,
    deductionQty: scenario.basis.deductionQty ?? qcRecord.unqualifiedQty,
    blockedProcessingFeeAmount,
    proposedQualityDeductionAmount,
    effectiveQualityDeductionAmount,
    unqualifiedDisposition: qcRecord.unqualifiedDisposition,
    effectiveAt:
      status === 'EFFECTIVE' || status === 'ADJUSTED'
        ? override.eligibleAt ?? scenario.basis.updatedAt ?? scenario.liabilityDecidedAt
        : undefined,
    adjustedAt: status === 'ADJUSTED' ? override.eligibleAt ?? scenario.dispute?.resolvedAt : undefined,
    cancelledAt: status === 'CANCELLED' ? scenario.dispute?.resolvedAt : undefined,
    adjustmentReasonSummary: override.adjustmentReasonSummary,
    summary: override.basisSummary ?? scenario.basis.summary,
    evidenceAssets: createEvidenceAssets(scenario.basis.basisId, scenario.basis.evidenceRefs),
    auditLogs: [
      {
        id: `AL-${scenario.basis.basisId}-01`,
        action: 'CREATE_BASIS_FROM_QC',
        detail: `由 ${scenario.qcId} 生成扣款依据`,
        at: scenario.basis.createdAt,
        by: '系统',
      },
    ],
    createdAt: scenario.basis.createdAt,
    updatedAt: scenario.basis.updatedAt,
    createdBy: '系统',
    updatedBy: '系统',
  }
}

function createDisputeCaseFact(scenario: RawCaseSeed): DisputeCaseFact | null {
  if (!scenario.dispute) return null
  const override = CASE_OVERRIDES[scenario.qcId] ?? {}
  const status = override.disputeStatus ?? 'IN_REVIEW'
  const resolved =
    status === 'UPHELD' || status === 'PARTIALLY_ADJUSTED' || status === 'REVERSED' || status === 'CLOSED'

  return {
    disputeId: scenario.dispute.disputeId,
    qcId: scenario.qcId,
    basisId: scenario.dispute.basisId,
    status,
    disputeReasonCode: override.disputeReasonCode ?? 'GENERAL_QUALITY',
    disputeReasonName: override.disputeReasonName ?? '质量异议',
    disputeDescription: override.disputeDescription ?? scenario.dispute.summary,
    disputeEvidenceAssets: createEvidenceAssets(
      scenario.dispute.disputeId,
      scenario.basis?.evidenceRefs ?? [{ name: scenario.dispute.summary, type: '文档' }],
    ),
    submittedAt: scenario.dispute.submittedAt,
    submittedByUserName: scenario.dispute.submittedBy,
    reviewerUserName: resolved ? scenario.dispute.resolvedBy : undefined,
    adjudicatedAt: resolved ? scenario.dispute.resolvedAt : undefined,
    adjudicationResult:
      override.adjudicationResult ??
      (status === 'UPHELD' || status === 'PARTIALLY_ADJUSTED' || status === 'REVERSED'
        ? status
        : undefined),
    adjudicationComment: resolved ? scenario.dispute.summary : undefined,
    requestedAmount: scenario.dispute.requestedAmount,
    adjudicatedAmount: resolved ? scenario.dispute.finalAmount : undefined,
    adjustedLiableQty: override.adjustedLiableQty,
    adjustedBlockedProcessingFeeAmount: override.adjustedBlockedProcessingFeeAmount,
    adjustedEffectiveQualityDeductionAmount: override.adjustedEffectiveQualityDeductionAmount,
    adjustmentReasonSummary: override.adjustmentReasonSummary,
    resultWrittenBackAt: override.resultWrittenBackAt,
  }
}

function createSettlementImpactFact(
  scenario: RawCaseSeed,
  qcRecord: QcRecordFact,
  deductionBasis: DeductionBasisFact | null,
): SettlementImpactFact {
  const override = CASE_OVERRIDES[scenario.qcId] ?? {}
  const blockedSettlementQty = override.blockedSettlementQty ?? qcRecord.factoryLiabilityQty
  const blockedProcessingFeeAmount = resolveBlockedProcessingFeeAmount(
    scenario,
    override,
    blockedSettlementQty,
  )
  const effectiveQualityDeductionAmount =
    override.effectiveQualityDeductionAmount ??
    deductionBasis?.effectiveQualityDeductionAmount ??
    0

  return {
    impactId: `SIM-${scenario.qcId}`,
    qcId: scenario.qcId,
    basisId: scenario.basis?.basisId,
    factoryId: scenario.returnFactoryId,
    returnInboundBatchNo: scenario.batchId,
    status: override.settlementImpactStatus ?? 'NO_IMPACT',
    blockedSettlementQty,
    blockedProcessingFeeAmount,
    effectiveQualityDeductionAmount,
    candidateSettlementCycleId:
      override.candidateSettlementCycleId ?? scenario.settlementImpact.settlementBatchId,
    includedAt: override.includedAt,
    includedSettlementStatementId: override.includedSettlementStatementId,
    includedSettlementBatchId:
      override.includedSettlementBatchId ??
      (override.settlementImpactStatus === 'INCLUDED_IN_STATEMENT' ||
      override.settlementImpactStatus === 'SETTLED'
        ? scenario.settlementImpact.settlementBatchId
        : undefined),
    statementLockedAt: override.statementLockedAt,
    eligibleAt: override.eligibleAt,
    settledAt:
      Object.prototype.hasOwnProperty.call(override, 'settledAt')
        ? override.settledAt
        : scenario.settlementImpact.settledAt,
    lastWrittenBackAt: override.lastWrittenBackAt ?? override.adjustment?.writtenBackAt,
    totalFinancialImpactAmount: blockedProcessingFeeAmount + effectiveQualityDeductionAmount,
    summary: override.settlementSummary ?? scenario.settlementImpact.summary,
  }
}

function createSettlementAdjustmentFact(
  scenario: RawCaseSeed,
): SettlementAdjustmentFact | null {
  const override = CASE_OVERRIDES[scenario.qcId] ?? {}
  if (!override.adjustment || !scenario.basis || !scenario.dispute) return null

  return {
    adjustmentId: override.adjustment.adjustmentId,
    adjustmentNo: override.adjustment.adjustmentNo ?? override.adjustment.adjustmentId,
    qcId: scenario.qcId,
    basisId: scenario.basis.basisId,
    disputeId: scenario.dispute.disputeId,
    adjustmentType: override.adjustment.adjustmentType,
    adjustmentQty: override.adjustment.adjustmentQty,
    adjustmentAmount: override.adjustment.adjustmentAmount,
    currency: override.adjustment.currency ?? 'CNY',
    targetSettlementCycleId: override.adjustment.targetSettlementCycleId,
    adjustmentReasonCode: override.adjustment.adjustmentReasonCode,
    adjustmentReasonSummary: override.adjustment.adjustmentReasonSummary,
    writebackStatus: override.adjustment.writebackStatus ?? 'NOT_WRITTEN',
    generatedAt: override.adjustment.generatedAt,
    writtenBackAt: override.adjustment.writtenBackAt,
    summary: override.adjustment.summary,
  }
}

function createCaseFact(scenario: RawCaseSeed): QualityDeductionCaseFact {
  const qcRecord = createQcRecordFact(scenario)
  const factoryResponse = createFactoryResponseFact(scenario, qcRecord)
  const deductionBasis = createDeductionBasisFact(scenario, qcRecord)
  const disputeCase = createDisputeCaseFact(scenario)
  const settlementImpact = createSettlementImpactFact(scenario, qcRecord, deductionBasis)
  const settlementAdjustment = createSettlementAdjustmentFact(scenario)

  return {
    qcRecord,
    factoryResponse,
    deductionBasis,
    disputeCase,
    settlementImpact,
    settlementAdjustment,
  }
}

export const qualityDeductionSharedCaseFacts: QualityDeductionCaseFact[] = RAW_CASES.map(createCaseFact)

export const qualityDeductionSharedQcRecords: QcRecordFact[] = qualityDeductionSharedCaseFacts.map((item) => item.qcRecord)

export const qualityDeductionSharedFactoryResponses: FactoryResponseFact[] = qualityDeductionSharedCaseFacts
  .map((item) => item.factoryResponse)
  .filter((item): item is FactoryResponseFact => item !== null)

export const qualityDeductionSharedDeductionBases: DeductionBasisFact[] = qualityDeductionSharedCaseFacts
  .map((item) => item.deductionBasis)
  .filter((item): item is DeductionBasisFact => item !== null)

export const qualityDeductionSharedDisputeCases: DisputeCaseFact[] = qualityDeductionSharedCaseFacts
  .map((item) => item.disputeCase)
  .filter((item): item is DisputeCaseFact => item !== null)

export const qualityDeductionSharedSettlementImpacts: SettlementImpactFact[] = qualityDeductionSharedCaseFacts.map(
  (item) => item.settlementImpact,
)

export const qualityDeductionSharedSettlementAdjustments: SettlementAdjustmentFact[] = qualityDeductionSharedCaseFacts
  .map((item) => item.settlementAdjustment)
  .filter((item): item is SettlementAdjustmentFact => item !== null)

export function getQualityDeductionCaseStatus(caseFact: QualityDeductionCaseFact): QualityDeductionCaseStatus {
  return deriveQualityDeductionCaseStatus(caseFact)
}

export interface QualityDeductionValidationIssue {
  qcId: string
  message: string
}

export function validateQualityDeductionSharedFacts(
  cases: QualityDeductionCaseFact[] = qualityDeductionSharedCaseFacts,
): QualityDeductionValidationIssue[] {
  const issues: QualityDeductionValidationIssue[] = []

  for (const caseFact of cases) {
    const { qcRecord, settlementImpact, deductionBasis } = caseFact

    if (!settlementImpact) {
      issues.push({ qcId: qcRecord.qcId, message: '缺少 Settlement Impact' })
    }

    if (qcRecord.qcResult === 'QUALIFIED') {
      if (qcRecord.qualifiedQty !== qcRecord.inspectedQty || qcRecord.unqualifiedQty !== 0) {
        issues.push({ qcId: qcRecord.qcId, message: '合格记录数量关系不成立' })
      }
      if (qcRecord.unqualifiedDisposition) {
        issues.push({ qcId: qcRecord.qcId, message: '合格记录不应生成不合格品处置方式' })
      }
    }

    if (qcRecord.qcResult === 'PARTIALLY_QUALIFIED') {
      if (
        qcRecord.qualifiedQty <= 0 ||
        qcRecord.unqualifiedQty <= 0 ||
        qcRecord.qualifiedQty + qcRecord.unqualifiedQty !== qcRecord.inspectedQty
      ) {
        issues.push({ qcId: qcRecord.qcId, message: '部分合格记录数量关系不成立' })
      }
    }

    if (qcRecord.qcResult === 'UNQUALIFIED') {
      if (qcRecord.qualifiedQty !== 0 || qcRecord.unqualifiedQty !== qcRecord.inspectedQty) {
        issues.push({ qcId: qcRecord.qcId, message: '不合格记录数量关系不成立' })
      }
    }

    const textBlob = [
      qcRecord.remark,
      qcRecord.deductionDecisionRemark,
      qcRecord.dispositionRemark,
      deductionBasis?.summary,
      caseFact.disputeCase?.disputeDescription,
      settlementImpact.summary,
      caseFact.settlementAdjustment?.summary,
    ]
      .filter(Boolean)
      .join(' ')

    if (/(返工|重做|复检|原扣款解除|暂不结算|无法进入结算)/.test(textBlob)) {
      issues.push({ qcId: qcRecord.qcId, message: '存在已废止的返工/重做语义残留' })
    }

    if (deductionBasis) {
      if (deductionBasis.blockedProcessingFeeAmount < 0) {
        issues.push({ qcId: qcRecord.qcId, message: '冻结加工费金额不能为负数' })
      }
      if (deductionBasis.proposedQualityDeductionAmount < 0 || deductionBasis.effectiveQualityDeductionAmount < 0) {
        issues.push({ qcId: qcRecord.qcId, message: '质量扣款金额不能为负数' })
      }
      if (
        deductionBasis.status === 'ADJUSTED' &&
        deductionBasis.proposedQualityDeductionAmount === deductionBasis.effectiveQualityDeductionAmount
      ) {
        issues.push({ qcId: qcRecord.qcId, message: '调整态扣款依据应体现前后金额差异' })
      }
    }

    if (
      settlementImpact.totalFinancialImpactAmount !==
      settlementImpact.blockedProcessingFeeAmount + settlementImpact.effectiveQualityDeductionAmount
    ) {
      issues.push({ qcId: qcRecord.qcId, message: '总财务影响金额与子金额口径不一致' })
    }

    if (caseFact.disputeCase && caseFact.disputeCase.disputeEvidenceAssets.length === 0) {
      issues.push({ qcId: qcRecord.qcId, message: '异议单必须附带图片或视频证据' })
    }

    if (
      caseFact.disputeCase?.adjudicationResult &&
      !caseFact.disputeCase.resultWrittenBackAt
    ) {
      issues.push({ qcId: qcRecord.qcId, message: '已裁决异议缺少结果回写时间' })
    }

    const derivedCaseStatus = getQualityDeductionCaseStatus(caseFact)
    if (!derivedCaseStatus) {
      issues.push({ qcId: qcRecord.qcId, message: 'caseStatus 派生失败' })
    }
  }

  return issues
}

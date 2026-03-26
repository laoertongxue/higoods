import { buildDeductionEntryHrefByBasisId } from './quality-chain-adapter'
import { getFactoryByCode, getFactoryById } from './indonesia-factories'
import {
  getSettlementEffectiveInfoByFactory,
  type SettlementConfigSnapshot,
  type SettlementDefaultDeductionRuleSnapshot,
  type SettlementEffectiveInfoSnapshot,
} from './settlement-change-requests'
import type { MaterialStatementDraft } from './store-domain-dispatch-process'
import type {
  FactoryFeedbackStatus,
  PayableAdjustment,
  StatementDraft,
  StatementAdjustment,
  StatementFactoryAppealRecord,
  SettlementBatch,
  SettlementBatchItem,
  SettlementProfileSnapshot,
  ProductionOrderChange,
} from './store-domain-settlement-types'

export const initialMaterialStatementDrafts: MaterialStatementDraft[] = []

let statementAppealSeq = 1

const FALLBACK_SETTLEMENT_CONFIG: SettlementConfigSnapshot = {
  cycleType: 'WEEKLY',
  settlementDayRule: '每周五截止，次周三付款',
  pricingMode: 'BY_PIECE',
  currency: 'IDR',
}

const FALLBACK_RECEIVING_ACCOUNT = (partyId: string): SettlementEffectiveInfoSnapshot => ({
  accountHolderName: `${partyId} 收款主体`,
  idNumber: '待补充',
  bankName: 'Bank Central Asia',
  bankAccountNo: '000000000000',
  bankBranch: 'Jakarta Main Branch',
})

function cloneSettlementConfigSnapshot(snapshot: SettlementConfigSnapshot): SettlementConfigSnapshot {
  return { ...snapshot }
}

function cloneReceivingAccountSnapshot(snapshot: SettlementEffectiveInfoSnapshot): SettlementEffectiveInfoSnapshot {
  return { ...snapshot }
}

function cloneDeductionRulesSnapshot(
  snapshots: SettlementDefaultDeductionRuleSnapshot[],
): SettlementDefaultDeductionRuleSnapshot[] {
  return snapshots.map((item) => ({ ...item }))
}

function resolveSettlementEffectiveFactoryId(partyId: string): string | null {
  if (getSettlementEffectiveInfoByFactory(partyId)) return partyId
  const factoryById = getFactoryById(partyId)
  if (factoryById?.code && getSettlementEffectiveInfoByFactory(factoryById.code)) return factoryById.code
  const factoryByCode = getFactoryByCode(partyId)
  if (factoryByCode?.code && getSettlementEffectiveInfoByFactory(factoryByCode.code)) return factoryByCode.code
  return null
}

function buildSettlementProfileSnapshot(partyId: string): SettlementProfileSnapshot {
  const effectiveFactoryId = resolveSettlementEffectiveFactoryId(partyId)
  const effective = effectiveFactoryId ? getSettlementEffectiveInfoByFactory(effectiveFactoryId) : null
  const matchedFactory = getFactoryById(partyId) ?? (effectiveFactoryId ? getFactoryByCode(effectiveFactoryId) : undefined)

  if (!effective) {
    return {
      versionNo: 'V-FALLBACK',
      effectiveAt: '2026-01-01 00:00:00',
      sourceFactoryId: matchedFactory?.id ?? partyId,
      sourceFactoryName: matchedFactory?.name ?? partyId,
      settlementConfigSnapshot: cloneSettlementConfigSnapshot(FALLBACK_SETTLEMENT_CONFIG),
      receivingAccountSnapshot: cloneReceivingAccountSnapshot(FALLBACK_RECEIVING_ACCOUNT(partyId)),
      defaultDeductionRulesSnapshot: [],
    }
  }

  return {
    versionNo: effective.versionNo,
    effectiveAt: effective.effectiveAt,
    sourceFactoryId: matchedFactory?.id ?? effective.factoryId,
    sourceFactoryName: matchedFactory?.name ?? effective.factoryName,
    settlementConfigSnapshot: cloneSettlementConfigSnapshot(effective.settlementConfigSnapshot),
    receivingAccountSnapshot: cloneReceivingAccountSnapshot(effective.receivingAccountSnapshot),
    defaultDeductionRulesSnapshot: cloneDeductionRulesSnapshot(effective.defaultDeductionRulesSnapshot),
  }
}

function buildStatementPartyView(settlementPartyType: string, settlementPartyId: string): string {
  const matchedFactory = getFactoryById(settlementPartyId)
  if (matchedFactory) return `${matchedFactory.name}（${settlementPartyId}）`
  return `${settlementPartyType} / ${settlementPartyId}`
}

function createStatementAppealRecord(input: {
  reason: string
  description: string
  submittedAt: string
  submittedBy: string
  evidenceSummary?: string
}): StatementFactoryAppealRecord {
  const appealId = `STA-${String(statementAppealSeq).padStart(4, '0')}`
  statementAppealSeq += 1
  return {
    appealId,
    status: 'SUBMITTED',
    reason: input.reason,
    description: input.description,
    evidenceSummary: input.evidenceSummary,
    submittedAt: input.submittedAt,
    submittedBy: input.submittedBy,
  }
}

function enrichStatementDraftSeed(
  draft: Omit<StatementDraft, 'settlementProfileSnapshot' | 'settlementProfileVersionNo' | 'statementPartyView' | 'factoryFeedbackStatus'> &
    Partial<
      Pick<
        StatementDraft,
        | 'settlementProfileSnapshot'
        | 'settlementProfileVersionNo'
        | 'statementPartyView'
        | 'factoryFeedbackStatus'
        | 'factoryFeedbackAt'
        | 'factoryFeedbackBy'
        | 'factoryFeedbackRemark'
        | 'factoryAppealRecord'
      >
    >,
): StatementDraft {
  const snapshot = draft.settlementProfileSnapshot ?? buildSettlementProfileSnapshot(draft.settlementPartyId)
  return {
    ...draft,
    settlementProfileSnapshot: snapshot,
    settlementProfileVersionNo: draft.settlementProfileVersionNo ?? snapshot.versionNo,
    statementPartyView: draft.statementPartyView ?? buildStatementPartyView(draft.settlementPartyType, draft.settlementPartyId),
    factoryFeedbackStatus: draft.factoryFeedbackStatus ?? (draft.status === 'CONFIRMED' ? 'PENDING_FACTORY_CONFIRM' : 'NOT_SENT'),
  }
}

function buildBatchSnapshotRefs(items: SettlementBatchItem[]): SettlementProfileSnapshot[] {
  const refs = new Map<string, SettlementProfileSnapshot>()
  for (const item of items) {
    if (!item.settlementProfileSnapshot) continue
    refs.set(item.settlementProfileSnapshot.versionNo, item.settlementProfileSnapshot)
  }
  return Array.from(refs.values())
}

function nowText(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

export const initialStatementDrafts: StatementDraft[] = [
  {
    statementId: 'ST-202603-7002',
    settlementPartyType: 'FACTORY',
    settlementPartyId: 'ID-F002',
    itemCount: 2,
    totalQty: 16,
    totalAmount: 548,
    status: 'DRAFT',
    itemBasisIds: ['DBI-021'],
    itemSourceIds: ['DBI-021', 'PAD-202603-0002'],
    items: [
      {
        sourceItemId: 'DBI-021',
        sourceItemType: 'QUALITY_BASIS',
        sourceLabelZh: '质量来源',
        sourceRefLabel: 'DBI-021',
        routeToSource: buildDeductionEntryHrefByBasisId('DBI-021'),
        settlementPartyType: 'FACTORY',
        settlementPartyId: 'ID-F002',
        basisId: 'DBI-021',
        deductionQty: 15,
        deductionAmount: 360,
        currency: 'CNY',
        productionOrderId: 'PO-0005',
        taskId: 'TASK-0005-001',
        sourceType: 'QC_FAIL',
        remark: '熨烫不良质量来源，待纳入本期对账单。',
      },
      {
        sourceItemId: 'PAD-202603-0002',
        sourceItemType: 'PAYABLE_ADJUSTMENT',
        sourceLabelZh: '应付调整',
        sourceRefLabel: 'PAD-202603-0002',
        routeToSource: '/fcs/settlement/adjustments?keyword=PAD-202603-0002&view=bound',
        settlementPartyType: 'FACTORY',
        settlementPartyId: 'ID-F002',
        basisId: 'PAD-202603-0002',
        deductionQty: 1,
        deductionAmount: 188,
        currency: 'CNY',
        productionOrderId: 'PO-0005',
        taskId: 'TASK-0005-002',
        sourceType: 'PAYABLE_ADJUSTMENT',
        remark: '补录尾差扣款，已挂入当前对账单草稿。',
      },
    ],
    remark: '待工厂确认后再进入结算批次。',
    createdAt: '2026-03-04 11:00:00',
    createdBy: '平台运营B',
    updatedAt: '2026-03-04 11:20:00',
    updatedBy: '平台运营B',
  },
  {
    statementId: 'ST-202603-7003',
    settlementPartyType: 'PROCESSOR',
    settlementPartyId: 'PROC-DP-001',
    itemCount: 2,
    totalQty: 12,
    totalAmount: 228,
    status: 'CONFIRMED',
    itemBasisIds: ['DBI-028'],
    itemSourceIds: ['DBI-028', 'PAD-202603-0003'],
    items: [
      {
        sourceItemId: 'DBI-028',
        sourceItemType: 'QUALITY_BASIS',
        sourceLabelZh: '质量来源',
        sourceRefLabel: 'DBI-028',
        routeToSource: buildDeductionEntryHrefByBasisId('DBI-028'),
        settlementPartyType: 'PROCESSOR',
        settlementPartyId: 'PROC-DP-001',
        basisId: 'DBI-028',
        deductionQty: 11,
        deductionAmount: 132,
        currency: 'CNY',
        productionOrderId: 'PO-0002',
        taskId: 'TASK-0002-003',
        sourceType: 'QC_DEFECT_ACCEPT',
        remark: '印花套色偏差接受扣款，已形成正式来源项。',
      },
      {
        sourceItemId: 'PAD-202603-0003',
        sourceItemType: 'PAYABLE_ADJUSTMENT',
        sourceLabelZh: '应付调整',
        sourceRefLabel: 'PAD-202603-0003',
        routeToSource: '/fcs/settlement/adjustments?keyword=PAD-202603-0003&view=effective',
        settlementPartyType: 'PROCESSOR',
        settlementPartyId: 'PROC-DP-001',
        basisId: 'PAD-202603-0003',
        deductionQty: 1,
        deductionAmount: 96,
        currency: 'CNY',
        productionOrderId: 'PO-0002',
        taskId: 'TASK-0002-003',
        sourceType: 'PAYABLE_ADJUSTMENT',
        remark: '误扣冲回调整，已随确认对账单生效。',
      },
    ],
    remark: '已确认，后续可进入结算批次。',
    factoryFeedbackStatus: 'FACTORY_APPEALED',
    factoryFeedbackAt: '2026-03-07 15:30:00',
    factoryFeedbackBy: '工厂财务-Rina',
    factoryFeedbackRemark: '工厂已对本单金额提出申诉，等待平台处理。',
    factoryAppealRecord: createStatementAppealRecord({
      reason: '质量来源金额需复核',
      description: '工厂认为印花偏差扣款与实际责任数量不一致，请平台复核本单质量来源金额。',
      submittedAt: '2026-03-07 15:30:00',
      submittedBy: '工厂财务-Rina',
      evidenceSummary: '上传对账截图 2 份',
    }),
    createdAt: '2026-03-06 09:30:00',
    createdBy: '平台运营C',
    updatedAt: '2026-03-06 10:10:00',
    updatedBy: '平台运营C',
  },
  {
    statementId: 'ST-202603-7004',
    settlementPartyType: 'FACTORY',
    settlementPartyId: 'ID-F001',
    itemCount: 2,
    totalQty: 92,
    totalAmount: 696,
    status: 'CLOSED',
    itemBasisIds: ['DBI-033'],
    itemSourceIds: ['DBI-033', 'MST-PO-0001'],
    items: [
      {
        sourceItemId: 'DBI-033',
        sourceItemType: 'QUALITY_BASIS',
        sourceLabelZh: '质量来源',
        sourceRefLabel: 'DBI-033',
        routeToSource: buildDeductionEntryHrefByBasisId('DBI-033'),
        settlementPartyType: 'FACTORY',
        settlementPartyId: 'ID-F001',
        basisId: 'DBI-033',
        deductionQty: 12,
        deductionAmount: 600,
        currency: 'CNY',
        productionOrderId: 'PO-LEGACY-020',
        taskId: 'TASK-LEGACY-020',
        sourceType: 'QC_FAIL',
        remark: '历史旧记录已在结算批次中扣回。',
      },
      {
        sourceItemId: 'MST-PO-0001',
        sourceItemType: 'MATERIAL_STATEMENT',
        sourceLabelZh: '车缝领料对账',
        sourceRefLabel: 'MST-PO-0001',
        routeToSource: '/fcs/settlement/material-statements?view=confirmed&keyword=MST-PO-0001&detail=MST-PO-0001',
        settlementPartyType: 'FACTORY',
        settlementPartyId: 'ID-F001',
        basisId: 'MST-PO-0001',
        deductionQty: 80,
        deductionAmount: 96,
        currency: 'CNY',
        productionOrderId: 'PO-0001',
        sourceType: 'MATERIAL_STATEMENT',
        remark: '已确认的领料对账对象，作为历史来源项归档。',
      },
    ],
    remark: '历史对账单，保留查看口径。',
    createdAt: '2026-03-02 16:00:00',
    createdBy: '平台运营A',
    updatedAt: '2026-03-03 09:00:00',
    updatedBy: '平台运营A',
  },
  {
    statementId: 'ST-202603-7005',
    settlementPartyType: 'FACTORY',
    settlementPartyId: 'ID-F001',
    itemCount: 1,
    totalQty: 1,
    totalAmount: 420,
    status: 'CONFIRMED',
    itemBasisIds: [],
    itemSourceIds: ['PAD-202603-0001'],
    items: [
      {
        sourceItemId: 'PAD-202603-0001',
        sourceItemType: 'PAYABLE_ADJUSTMENT',
        sourceLabelZh: '应付调整',
        sourceRefLabel: 'PAD-202603-0001',
        routeToSource: '/fcs/settlement/adjustments?keyword=PAD-202603-0001&view=pending',
        settlementPartyType: 'FACTORY',
        settlementPartyId: 'ID-F001',
        basisId: 'PAD-202603-0001',
        deductionQty: 1,
        deductionAmount: 420,
        currency: 'CNY',
        productionOrderId: 'PO-0001',
        taskId: 'TASK-0001-003',
        sourceType: 'PAYABLE_ADJUSTMENT',
        remark: '交期顺延补差，已确认，可直接进入结算批次。',
      },
    ],
    remark: '已确认，等待工厂查看并反馈当前周期口径。',
    factoryFeedbackStatus: 'PENDING_FACTORY_CONFIRM',
    createdAt: '2026-03-19 10:20:00',
    createdBy: '平台运营A',
    updatedAt: '2026-03-19 10:30:00',
    updatedBy: '平台运营A',
  },
  {
    statementId: 'ST-202603-7006',
    settlementPartyType: 'FACTORY',
    settlementPartyId: 'ID-F003',
    itemCount: 1,
    totalQty: 18,
    totalAmount: 312,
    status: 'CONFIRMED',
    itemBasisIds: ['DBI-019'],
    itemSourceIds: ['DBI-019'],
    items: [
      {
        sourceItemId: 'DBI-019',
        sourceItemType: 'QUALITY_BASIS',
        sourceLabelZh: '质量来源',
        sourceRefLabel: 'DBI-019',
        routeToSource: buildDeductionEntryHrefByBasisId('DBI-019'),
        settlementPartyType: 'FACTORY',
        settlementPartyId: 'ID-F003',
        basisId: 'DBI-019',
        deductionQty: 18,
        deductionAmount: 312,
        currency: 'CNY',
        productionOrderId: 'PO-0011',
        taskId: 'TASK-0011-002',
        sourceType: 'QC_FAIL',
        remark: '质量来源已确认，当前已组入进行中批次。',
      },
    ],
    remark: '已确认，当前处于批次执行中。',
    factoryFeedbackStatus: 'FACTORY_CONFIRMED',
    factoryFeedbackAt: '2026-03-08 11:20:00',
    factoryFeedbackBy: '工厂财务-Adi',
    factoryFeedbackRemark: '工厂已确认对账口径。',
    createdAt: '2026-03-08 09:40:00',
    createdBy: '平台运营B',
    updatedAt: '2026-03-08 09:55:00',
    updatedBy: '平台运营B',
  },
  {
    statementId: 'ST-202603-7007',
    settlementPartyType: 'FACTORY',
    settlementPartyId: 'ID-F004',
    itemCount: 1,
    totalQty: 36,
    totalAmount: 288,
    status: 'CLOSED',
    itemBasisIds: ['DBI-021'],
    itemSourceIds: ['DBI-021'],
    items: [
      {
        sourceItemId: 'DBI-021',
        sourceItemType: 'QUALITY_BASIS',
        sourceLabelZh: '质量来源',
        sourceRefLabel: 'DBI-021',
        routeToSource: buildDeductionEntryHrefByBasisId('DBI-021'),
        settlementPartyType: 'FACTORY',
        settlementPartyId: 'ID-F004',
        basisId: 'DBI-021',
        deductionQty: 36,
        deductionAmount: 288,
        currency: 'CNY',
        productionOrderId: 'PO-0008',
        taskId: 'TASK-0008-001',
        sourceType: 'QC_FAIL',
        remark: '已随近期待打款批次完成结算。',
      },
    ],
    remark: '已进入待打款回写阶段。',
    createdAt: '2026-03-10 13:10:00',
    createdBy: '平台运营C',
    updatedAt: '2026-03-22 15:20:00',
    updatedBy: '平台运营C',
  },
  {
    statementId: 'ST-202603-7008',
    settlementPartyType: 'PROCESSOR',
    settlementPartyId: 'PROC-DP-003',
    itemCount: 1,
    totalQty: 64,
    totalAmount: 960,
    status: 'CLOSED',
    itemBasisIds: ['DBI-028'],
    itemSourceIds: ['DBI-028'],
    items: [
      {
        sourceItemId: 'DBI-028',
        sourceItemType: 'QUALITY_BASIS',
        sourceLabelZh: '质量来源',
        sourceRefLabel: 'DBI-028',
        routeToSource: buildDeductionEntryHrefByBasisId('DBI-028'),
        settlementPartyType: 'PROCESSOR',
        settlementPartyId: 'PROC-DP-003',
        basisId: 'DBI-028',
        deductionQty: 64,
        deductionAmount: 960,
        currency: 'CNY',
        productionOrderId: 'PO-0012',
        taskId: 'TASK-0012-004',
        sourceType: 'QC_DEFECT_ACCEPT',
        remark: '近期已完成批次样例，用于查看已完成回写结果。',
      },
    ],
    remark: '近期已完成回写，保留查看。',
    factoryFeedbackStatus: 'RESOLVED',
    factoryFeedbackAt: '2026-03-13 16:00:00',
    factoryFeedbackBy: '平台运营D',
    factoryFeedbackRemark: '工厂反馈已处理完成，本单已完成回写。',
    createdAt: '2026-03-12 11:00:00',
    createdBy: '平台运营D',
    updatedAt: '2026-03-24 09:30:00',
    updatedBy: '平台运营D',
  },
  {
    statementId: 'ST-202602-6801',
    settlementPartyType: 'FACTORY',
    settlementPartyId: 'ID-F006',
    itemCount: 1,
    totalQty: 48,
    totalAmount: 732,
    status: 'CLOSED',
    itemBasisIds: ['DBI-033'],
    itemSourceIds: ['DBI-033'],
    items: [
      {
        sourceItemId: 'DBI-033',
        sourceItemType: 'QUALITY_BASIS',
        sourceLabelZh: '质量来源',
        sourceRefLabel: 'DBI-033',
        routeToSource: buildDeductionEntryHrefByBasisId('DBI-033'),
        settlementPartyType: 'FACTORY',
        settlementPartyId: 'ID-F006',
        basisId: 'DBI-033',
        deductionQty: 48,
        deductionAmount: 732,
        currency: 'CNY',
        productionOrderId: 'PO-LEGACY-032',
        taskId: 'TASK-LEGACY-032',
        sourceType: 'QC_FAIL',
        remark: '历史归档批次样例，对应旧周期已完成回写。',
      },
    ],
    remark: '历史归档样例。',
    createdAt: '2026-02-18 10:10:00',
    createdBy: '平台运营A',
    updatedAt: '2026-02-25 17:20:00',
    updatedBy: '平台运营A',
  },
].map((draft) => enrichStatementDraftSeed(draft))

export const initialPayableAdjustments: PayableAdjustment[] = [
  {
    adjustmentId: 'PAD-202603-0001',
    adjustmentType: 'COMPENSATION',
    settlementPartyType: 'FACTORY',
    settlementPartyId: 'ID-F001',
    productionOrderId: 'PO-0001',
    taskId: 'TASK-0001-003',
    amount: 420,
    currency: 'CNY',
    remark: '交期顺延后按协议补差，待纳入本期对账单。',
    relatedBasisId: 'DBI-019',
    status: 'DRAFT',
    createdAt: '2026-03-03 09:30:00',
    createdBy: '平台运营A',
  },
  {
    adjustmentId: 'PAD-202603-0002',
    adjustmentType: 'DEDUCTION_SUPPLEMENT',
    settlementPartyType: 'FACTORY',
    settlementPartyId: 'ID-F002',
    productionOrderId: 'PO-0005',
    taskId: 'TASK-0005-002',
    amount: 188,
    currency: 'CNY',
    remark: '补录尾差扣款，已挂入当前对账单草稿。',
    relatedBasisId: 'DBI-021',
    status: 'DRAFT',
    linkedStatementId: 'ST-202603-7002',
    linkedStatementStatus: 'DRAFT',
    createdAt: '2026-03-04 10:00:00',
    createdBy: '平台运营B',
    updatedAt: '2026-03-04 10:25:00',
    updatedBy: '平台运营B',
  },
  {
    adjustmentId: 'PAD-202603-0003',
    adjustmentType: 'REVERSAL',
    settlementPartyType: 'PROCESSOR',
    settlementPartyId: 'PROC-DP-001',
    productionOrderId: 'PO-0002',
    taskId: 'TASK-0002-003',
    amount: 96,
    currency: 'CNY',
    remark: '前期误扣冲回，已随已确认对账单生效。',
    relatedBasisId: 'DBI-028',
    status: 'EFFECTIVE',
    linkedStatementId: 'ST-202603-7003',
    linkedStatementStatus: 'CONFIRMED',
    createdAt: '2026-03-05 14:10:00',
    createdBy: '平台运营C',
    updatedAt: '2026-03-06 09:00:00',
    updatedBy: '平台运营C',
  },
  {
    adjustmentId: 'PAD-202603-0004',
    adjustmentType: 'COMPENSATION',
    settlementPartyType: 'FACTORY',
    settlementPartyId: 'ID-F004',
    productionOrderId: 'PO-0009',
    taskId: 'TASK-0009-004',
    amount: 260,
    currency: 'CNY',
    remark: '工艺差异补差申请已撤回，当前仅保留历史。',
    status: 'VOID',
    createdAt: '2026-03-06 11:20:00',
    createdBy: '平台运营D',
    updatedAt: '2026-03-06 16:40:00',
    updatedBy: '平台运营D',
  },
]

export const initialStatementAdjustments: StatementAdjustment[] = initialPayableAdjustments

export const initialSettlementBatches: SettlementBatch[] = [
  {
    batchId: 'SB-202603-8101',
    batchName: '三月第一批进行中',
    itemCount: 1,
    totalAmount: 312,
    status: 'PENDING',
    statementIds: ['ST-202603-7006'],
    items: [
      {
        statementId: 'ST-202603-7006',
        settlementPartyType: 'FACTORY',
        settlementPartyId: 'ID-F003',
        totalAmount: 312,
      },
    ],
    remark: '已装配对账单，等待进入打款处理。',
    createdAt: '2026-03-20 10:00:00',
    createdBy: '平台运营B',
    updatedAt: '2026-03-20 10:00:00',
    updatedBy: '平台运营B',
  },
  {
    batchId: 'SB-202603-8102',
    batchName: '三月第二批待打款',
    itemCount: 1,
    totalAmount: 228,
    status: 'PROCESSING',
    statementIds: ['ST-202603-7003'],
    items: [
      {
        statementId: 'ST-202603-7003',
        settlementPartyType: 'PROCESSOR',
        settlementPartyId: 'PROC-DP-001',
        totalAmount: 228,
      },
    ],
    remark: '已进入待打款与回写阶段。',
    createdAt: '2026-03-21 09:20:00',
    createdBy: '平台运营B',
    updatedAt: '2026-03-23 11:45:00',
    updatedBy: '平台运营B',
  },
  {
    batchId: 'SB-202603-8103',
    batchName: '三月第三批已完成待回写',
    itemCount: 1,
    totalAmount: 288,
    status: 'COMPLETED',
    statementIds: ['ST-202603-7007'],
    items: [
      {
        statementId: 'ST-202603-7007',
        settlementPartyType: 'FACTORY',
        settlementPartyId: 'ID-F004',
        totalAmount: 288,
      },
    ],
    remark: '打款已完成，等待结果回写。',
    createdAt: '2026-03-18 15:10:00',
    createdBy: '平台运营C',
    completedAt: '2026-03-22 15:20:00',
    updatedAt: '2026-03-22 15:20:00',
    updatedBy: '平台运营C',
    paymentSyncStatus: 'UNSYNCED',
  },
  {
    batchId: 'SB-202603-8104',
    batchName: '三月第四批已完成',
    itemCount: 1,
    totalAmount: 960,
    status: 'COMPLETED',
    statementIds: ['ST-202603-7008'],
    items: [
      {
        statementId: 'ST-202603-7008',
        settlementPartyType: 'PROCESSOR',
        settlementPartyId: 'PROC-DP-003',
        totalAmount: 960,
      },
    ],
    remark: '已完成打款与结果回写。',
    createdAt: '2026-03-20 08:50:00',
    createdBy: '平台运营D',
    completedAt: '2026-03-24 09:30:00',
    updatedAt: '2026-03-24 09:30:00',
    updatedBy: '平台运营D',
    paymentSyncStatus: 'SUCCESS',
    paymentAmount: 960,
    paymentAt: '2026-03-24 09:10:00',
    paymentReferenceNo: 'PAY-20260324-1182',
    paymentRemark: '银行回单已核对。',
    paymentUpdatedAt: '2026-03-24 09:30:00',
    paymentUpdatedBy: '财务A',
  },
  {
    batchId: 'SB-202602-7901',
    batchName: '二月归档批次',
    itemCount: 1,
    totalAmount: 732,
    status: 'COMPLETED',
    statementIds: ['ST-202602-6801'],
    items: [
      {
        statementId: 'ST-202602-6801',
        settlementPartyType: 'FACTORY',
        settlementPartyId: 'ID-F006',
        totalAmount: 732,
      },
    ],
    remark: '历史归档批次样例。',
    createdAt: '2026-02-20 14:10:00',
    createdBy: '平台运营A',
    completedAt: '2026-02-25 17:20:00',
    archivedAt: '2026-03-01 09:00:00',
    updatedAt: '2026-03-01 09:00:00',
    updatedBy: '平台运营A',
    paymentSyncStatus: 'SUCCESS',
    paymentAmount: 732,
    paymentAt: '2026-02-25 16:40:00',
    paymentReferenceNo: 'PAY-20260225-9001',
    paymentRemark: '历史批次已归档。',
    paymentUpdatedAt: '2026-03-01 09:00:00',
    paymentUpdatedBy: '财务B',
  },
  {
    batchId: 'SB-202603-8105',
    batchName: '三月第五批工厂回写样例',
    itemCount: 1,
    totalAmount: 696,
    status: 'COMPLETED',
    statementIds: ['ST-202603-7004'],
    items: [
      {
        statementId: 'ST-202603-7004',
        settlementPartyType: 'FACTORY',
        settlementPartyId: 'ID-F001',
        totalAmount: 696,
      },
    ],
    remark: '当前工厂最近一次已完成回写的打款结果样例。',
    createdAt: '2026-03-14 10:20:00',
    createdBy: '平台运营A',
    completedAt: '2026-03-15 14:30:00',
    updatedAt: '2026-03-15 14:30:00',
    updatedBy: '平台运营A',
    paymentSyncStatus: 'SUCCESS',
    paymentAmount: 696,
    paymentAt: '2026-03-15 13:50:00',
    paymentReferenceNo: 'PAY-20260315-6601',
    paymentRemark: '当前工厂最近一次打款已完成回写。',
    paymentUpdatedAt: '2026-03-15 14:30:00',
    paymentUpdatedBy: '财务A',
  },
].map((batch) => {
  const items = batch.items.map((item) => {
    const statement = initialStatementDrafts.find((statementItem) => statementItem.statementId === item.statementId)
    return {
      ...item,
      settlementProfileVersionNo: statement?.settlementProfileVersionNo,
      settlementProfileSnapshot: statement?.settlementProfileSnapshot,
      factoryFeedbackStatus: statement?.factoryFeedbackStatus,
    }
  })

  const snapshotRefs = buildBatchSnapshotRefs(items)

  return {
    ...batch,
    items,
    settlementProfileSnapshotRefs: snapshotRefs,
    settlementProfileVersionSummary:
      snapshotRefs.length === 0
        ? '未绑定结算资料版本'
        : snapshotRefs.length === 1
          ? snapshotRefs[0].versionNo
          : `${snapshotRefs.length} 个版本快照`,
  }
})

function isSameSettlementPartyId(left: string, right: string): boolean {
  if (left === right) return true
  const leftFactory = getFactoryById(left) ?? getFactoryByCode(left)
  const rightFactory = getFactoryById(right) ?? getFactoryByCode(right)
  if (!leftFactory || !rightFactory) return false
  return leftFactory.id === rightFactory.id || leftFactory.code === rightFactory.code
}

export function getStatementDraftById(statementId: string): StatementDraft | null {
  return initialStatementDrafts.find((item) => item.statementId === statementId) ?? null
}

export function listSettlementStatementsByParty(settlementPartyId: string): StatementDraft[] {
  return initialStatementDrafts.filter((item) => isSameSettlementPartyId(item.settlementPartyId, settlementPartyId))
}

export function listSettlementBatchesByParty(settlementPartyId: string): SettlementBatch[] {
  return initialSettlementBatches.filter((batch) =>
    batch.items.some((item) => isSameSettlementPartyId(item.settlementPartyId, settlementPartyId)),
  )
}

export function listSettlementBatchesByStatement(statementId: string): SettlementBatch[] {
  return initialSettlementBatches.filter((batch) => batch.statementIds.includes(statementId))
}

export function buildStatementSettlementProfileSnapshot(
  settlementPartyType: string,
  settlementPartyId: string,
): SettlementProfileSnapshot {
  if (settlementPartyType === 'FACTORY') return buildSettlementProfileSnapshot(settlementPartyId)
  return buildSettlementProfileSnapshot(settlementPartyId)
}

export function submitStatementFactoryConfirmation(input: {
  statementId: string
  by: string
  remark?: string
  at?: string
}): { ok: boolean; message?: string; data?: StatementDraft } {
  const statement = getStatementDraftById(input.statementId)
  if (!statement) return { ok: false, message: '未找到对应对账单' }
  if (statement.status !== 'CONFIRMED') return { ok: false, message: '当前仅已确认对账单可由工厂反馈' }

  const timestamp = input.at ?? nowText()
  statement.factoryFeedbackStatus = 'FACTORY_CONFIRMED'
  statement.factoryFeedbackAt = timestamp
  statement.factoryFeedbackBy = input.by
  statement.factoryFeedbackRemark = input.remark?.trim() || '工厂已确认对账口径'
  statement.updatedAt = timestamp
  statement.updatedBy = input.by
  return { ok: true, data: statement }
}

export function submitStatementFactoryAppeal(input: {
  statementId: string
  by: string
  reason: string
  description: string
  evidenceSummary?: string
  at?: string
}): { ok: boolean; message?: string; data?: StatementDraft } {
  const statement = getStatementDraftById(input.statementId)
  if (!statement) return { ok: false, message: '未找到对应对账单' }
  if (statement.status !== 'CONFIRMED') return { ok: false, message: '当前仅已确认对账单可发起申诉' }
  if (!input.reason.trim() || !input.description.trim()) {
    return { ok: false, message: '请填写申诉原因和申诉说明' }
  }

  const timestamp = input.at ?? nowText()
  statement.factoryFeedbackStatus = 'FACTORY_APPEALED'
  statement.factoryFeedbackAt = timestamp
  statement.factoryFeedbackBy = input.by
  statement.factoryFeedbackRemark = input.description.trim()
  statement.factoryAppealRecord = createStatementAppealRecord({
    reason: input.reason.trim(),
    description: input.description.trim(),
    submittedAt: timestamp,
    submittedBy: input.by,
    evidenceSummary: input.evidenceSummary?.trim() || undefined,
  })
  statement.updatedAt = timestamp
  statement.updatedBy = input.by
  return { ok: true, data: statement }
}

export function getSettlementVersionUsageStats(factoryId: string): {
  openStatementCount: number
  activeBatchCount: number
} {
  const effectiveFactoryId = resolveSettlementEffectiveFactoryId(factoryId) ?? factoryId
  const effective = getSettlementEffectiveInfoByFactory(effectiveFactoryId)
  if (!effective) return { openStatementCount: 0, activeBatchCount: 0 }

  const relatedStatements = initialStatementDrafts.filter(
    (item) =>
      item.settlementProfileVersionNo === effective.versionNo &&
      item.settlementProfileSnapshot.sourceFactoryId === (getFactoryByCode(effectiveFactoryId)?.id ?? effectiveFactoryId) &&
      item.status !== 'CLOSED',
  )
  const relatedStatementIds = new Set(relatedStatements.map((item) => item.statementId))
  const activeBatchCount = initialSettlementBatches.filter(
    (item) => item.status !== 'COMPLETED' && item.statementIds.some((statementId) => relatedStatementIds.has(statementId)),
  ).length

  return {
    openStatementCount: relatedStatements.length,
    activeBatchCount,
  }
}

export const initialProductionOrderChanges: ProductionOrderChange[] = [
  {
    changeId: 'CHG-202603-0001',
    productionOrderId: 'PO-0001',
    changeType: 'QTY_CHANGE',
    beforeValue: '1000',
    afterValue: '1200',
    impactScopeZh: '染印加工单数量',
    reason: '客户追加订单',
    status: 'DONE',
    createdAt: '2026-03-01 09:00:00',
    createdBy: '王五',
    updatedAt: '2026-03-02 10:00:00',
    updatedBy: '王五',
  },
  {
    changeId: 'CHG-202603-0002',
    productionOrderId: 'PO-0003',
    changeType: 'DATE_CHANGE',
    beforeValue: '2026-03-20',
    afterValue: '2026-04-05',
    impactScopeZh: '交货期与生产排期',
    reason: '面料延期到货',
    status: 'PENDING',
    createdAt: '2026-03-03 14:00:00',
    createdBy: '跟单A',
  },
  {
    changeId: 'CHG-202603-0003',
    productionOrderId: 'PO-0005',
    changeType: 'FACTORY_CHANGE',
    beforeValue: 'Surabaya Factory',
    afterValue: 'Bandung Print House',
    impactScopeZh: '工厂分配、结算对象',
    reason: '原工厂产能不足',
    status: 'DRAFT',
    createdAt: '2026-03-05 11:30:00',
    createdBy: '跟单B',
  },
]

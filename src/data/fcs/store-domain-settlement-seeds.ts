import { getFactoryByCode, getFactoryById } from './indonesia-factories.ts'
import { processTasks } from './process-tasks.ts'
import { productionOrders } from './production-orders.ts'
import {
  getSettlementEffectiveInfoByFactory,
  type SettlementConfigSnapshot,
  type SettlementDefaultDeductionRuleSnapshot,
  type SettlementEffectiveInfoSnapshot,
} from './settlement-change-requests.ts'
import { deriveSettlementCycleFields, deriveTaskPricingFields } from './store-domain-statement-grain.ts'
import type { MaterialStatementDraft } from './store-domain-dispatch-process.ts'
import { settlementLinkedMockFactoryOutput } from './settlement-linked-mock-factory.ts'
import type {
  FeishuPaymentApproval,
  FactoryFeedbackStatus,
  PayableAdjustment,
  PaymentWriteback,
  PreSettlementLedger,
  PrepaymentBatchStatus,
  StatementAppealRecord,
  StatementDraft,
  StatementAdjustment,
  StatementDraftItem,
  StatementResolutionResult,
  SettlementBatch,
  SettlementBatchItem,
  SettlementProfileSnapshot,
  ProductionOrderChange,
  StatementStatus,
} from './store-domain-settlement-types.ts'

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
  statementId: string
  factoryId: string
  settlementCycleId?: string
  reasonCode: string
  reasonName: string
  reason: string
  description: string
  submittedAt: string
  submittedBy: string
  attachments?: string[]
  evidenceSummary?: string
}): StatementAppealRecord {
  const appealId = `STA-${String(statementAppealSeq).padStart(4, '0')}`
  statementAppealSeq += 1
  return {
    appealId,
    statementId: input.statementId,
    factoryId: input.factoryId,
    settlementCycleId: input.settlementCycleId,
    status: 'SUBMITTED',
    reasonCode: input.reasonCode || input.reason.trim(),
    reasonName: input.reasonName || input.reason.trim(),
    description: input.description,
    attachments: [...(input.attachments ?? [])],
    evidenceSummary: input.evidenceSummary,
    submittedAt: input.submittedAt,
    submittedBy: input.submittedBy,
  }
}

function normalizeAppealRecord(
  appeal: Partial<StatementAppealRecord> & {
    appealId?: string
    status?: StatementAppealRecord['status']
    submittedAt?: string
    submittedBy?: string
    reason?: string
    reasonCode?: string
    reasonName?: string
    evidenceSummary?: string
    platformRemark?: string
    handledAt?: string
    handledBy?: string
  },
  draft: Pick<StatementDraft, 'statementId' | 'settlementPartyId' | 'settlementCycleId'>,
): StatementAppealRecord {
  return {
    appealId: appeal.appealId ?? `STA-LEGACY-${draft.statementId}`,
    statementId: appeal.statementId ?? draft.statementId,
    factoryId: appeal.factoryId ?? draft.settlementPartyId,
    settlementCycleId: appeal.settlementCycleId ?? draft.settlementCycleId,
    status: appeal.status ?? 'SUBMITTED',
    reasonCode: appeal.reasonCode ?? appeal.reasonName ?? appeal.reason ?? '其他申诉',
    reasonName: appeal.reasonName ?? appeal.reason ?? appeal.reasonCode ?? '其他申诉',
    description: appeal.description ?? '',
    attachments: [...(appeal.attachments ?? [])],
    evidenceSummary: appeal.evidenceSummary,
    submittedAt: appeal.submittedAt ?? nowText(),
    submittedBy: appeal.submittedBy ?? '工厂财务',
    platformHandledAt: appeal.platformHandledAt ?? appeal.handledAt,
    platformHandledBy: appeal.platformHandledBy ?? appeal.handledBy,
    resolutionAt: appeal.resolutionAt ?? appeal.handledAt,
    resolutionResult:
      appeal.resolutionResult ?? ((appeal.status ?? 'SUBMITTED') === 'RESOLVED' ? 'UPHELD' : undefined),
    resolutionComment: appeal.resolutionComment ?? appeal.platformRemark,
  }
}

function getAppealRecords(statement: Pick<StatementDraft, 'statementId' | 'settlementPartyId' | 'settlementCycleId' | 'appealRecords' | 'factoryAppealRecord'>): StatementAppealRecord[] {
  if (statement.appealRecords?.length) {
    return statement.appealRecords.map((item) => normalizeAppealRecord(item, statement))
  }
  if (statement.factoryAppealRecord) {
    return [normalizeAppealRecord(statement.factoryAppealRecord, statement)]
  }
  return []
}

export function getLatestStatementAppeal(statement: Pick<StatementDraft, 'statementId' | 'settlementPartyId' | 'settlementCycleId' | 'appealRecords' | 'factoryAppealRecord'>): StatementAppealRecord | null {
  const appeals = getAppealRecords(statement)
  return appeals.length ? appeals[appeals.length - 1] : null
}

export function getOpenStatementAppeal(statement: Pick<StatementDraft, 'statementId' | 'settlementPartyId' | 'settlementCycleId' | 'appealRecords' | 'factoryAppealRecord'>): StatementAppealRecord | null {
  const appeals = getAppealRecords(statement)
  return appeals.find((item) => item.status === 'SUBMITTED' || item.status === 'PLATFORM_HANDLING') ?? null
}

function normalizeStatementStatus(
  draft: Pick<
    StatementDraft,
    'status' | 'factoryFeedbackStatus' | 'resolutionResult' | 'statementId' | 'settlementPartyId' | 'settlementCycleId' | 'appealRecords' | 'factoryAppealRecord'
  >,
): StatementStatus {
  if (
    draft.status === 'DRAFT' ||
    draft.status === 'PENDING_FACTORY_CONFIRM' ||
    draft.status === 'FACTORY_CONFIRMED' ||
    draft.status === 'READY_FOR_PREPAYMENT' ||
    draft.status === 'IN_PREPAYMENT_BATCH' ||
    draft.status === 'PREPAID' ||
    draft.status === 'CLOSED'
  ) {
    return draft.status
  }

  if ((draft.status as string) === 'READY_FOR_SETTLEMENT') return 'READY_FOR_PREPAYMENT'

  if ((draft.status as string) === 'CONFIRMED') {
    if (draft.factoryFeedbackStatus === 'FACTORY_CONFIRMED') return 'READY_FOR_PREPAYMENT'
    if (draft.factoryFeedbackStatus === 'RESOLVED') {
      if (draft.resolutionResult === 'REOPEN_REQUIRED') return 'CLOSED'
      return 'READY_FOR_PREPAYMENT'
    }
    return 'PENDING_FACTORY_CONFIRM'
  }

  return 'DRAFT'
}

export function canStatementEnterSettlement(statement: Pick<StatementDraft, 'status' | 'factoryFeedbackStatus' | 'resolutionResult'>): boolean {
  if (statement.status !== 'READY_FOR_PREPAYMENT') return false
  return (
    statement.factoryFeedbackStatus === 'FACTORY_CONFIRMED' ||
    (statement.factoryFeedbackStatus === 'RESOLVED' && statement.resolutionResult === 'UPHELD')
  )
}

export function canStatementEnterPrepayment(statement: Pick<StatementDraft, 'status' | 'factoryFeedbackStatus' | 'resolutionResult'>): boolean {
  return canStatementEnterSettlement(statement)
}

export function getStatementSettlementProgressView(statement: Pick<StatementDraft, 'status' | 'factoryFeedbackStatus' | 'resolutionResult'>): {
  canEnterSettlement: boolean
  summary: string
  detail: string
} {
  if (canStatementEnterSettlement(statement)) {
    return {
      canEnterSettlement: true,
      summary: '可进入预付款批次',
      detail: '当前单据已满足后续预付款批次入池条件，可继续进入预付款执行链路。',
    }
  }

  if (statement.status === 'DRAFT') {
    return {
      canEnterSettlement: false,
      summary: '仍是草稿',
      detail: '当前仍处于草稿阶段，需由平台确认后才能下发工厂反馈。',
    }
  }

  if (statement.factoryFeedbackStatus === 'FACTORY_APPEALED') {
    return {
      canEnterSettlement: false,
      summary: '待平台处理申诉',
      detail: '工厂已发起申诉，当前单据暂不可进入预付款批次，需先完成平台处理。',
    }
  }

  if (statement.factoryFeedbackStatus === 'PLATFORM_HANDLING') {
    return {
      canEnterSettlement: false,
      summary: '平台处理中',
      detail: '平台正在处理工厂申诉，处理完成前暂不可进入预付款批次。',
    }
  }

  if (statement.status === 'FACTORY_CONFIRMED') {
    return {
      canEnterSettlement: false,
      summary: '工厂已确认',
      detail: '工厂已确认当前对账单，等待平台将其切为可进入预付款批次的状态。',
    }
  }

  if (statement.status === 'IN_PREPAYMENT_BATCH') {
    return {
      canEnterSettlement: false,
      summary: '已进入预付款批次',
      detail: '当前单据已进入预付款批次，后续在预付款批次中继续执行。',
    }
  }

  if (statement.status === 'PREPAID') {
    return {
      canEnterSettlement: false,
      summary: '已预付',
      detail: '当前单据已完成预付款，仅保留后续回写和历史查看。',
    }
  }

  if (statement.status === 'CLOSED' && statement.resolutionResult === 'REOPEN_REQUIRED') {
    return {
      canEnterSettlement: false,
      summary: '已关闭并要求重算',
      detail: '平台已认定当前单据需要退回调整后重算，当前单据不能进入预付款批次。',
    }
  }

  if (statement.status === 'CLOSED') {
    return {
      canEnterSettlement: false,
      summary: '已关闭',
      detail: '当前单据已关闭，仅保留历史查看，不再进入预付款批次。',
    }
  }

  return {
    canEnterSettlement: false,
    summary: '待工厂反馈',
    detail: '当前单据已下发工厂，需等待工厂确认或申诉后才能决定是否进入预付款批次。',
  }
}

function resolveTaskNo(taskId?: string): string | undefined {
  if (!taskId) return undefined
  return processTasks.find((item) => item.taskId === taskId)?.taskNo
}

function resolveProductionOrderNo(productionOrderId?: string): string | undefined {
  if (!productionOrderId) return undefined
  return productionOrders.find((item) => item.productionOrderId === productionOrderId)?.legacyOrderNo
}

function enrichStatementDraftItemSeed(item: StatementDraftItem, draft: Pick<StatementDraft, 'settlementPartyId' | 'createdAt'>): StatementDraftItem {
  const cycleFields =
    item.settlementCycleId
      ? {
          settlementCycleId: item.settlementCycleId,
          settlementCycleLabel: item.settlementCycleLabel,
          settlementCycleStartAt: item.settlementCycleStartAt,
          settlementCycleEndAt: item.settlementCycleEndAt,
        }
      : deriveSettlementCycleFields(item.settlementPartyId ?? draft.settlementPartyId, draft.createdAt)
  const qty = item.returnInboundQty ?? item.deductionQty ?? 0
  const pricingFields = deriveTaskPricingFields(item.taskId, qty)
  const earningAmount =
    item.earningAmount ??
    (item.sourceItemType === 'TASK_EARNING'
      ? Math.max(item.netAmount ?? item.deductionAmount, 0)
      : pricingFields.earningAmount)
  const qualityDeductionAmount =
    item.qualityDeductionAmount ??
    (item.sourceItemType === 'QUALITY_DEDUCTION'
      ? Math.abs(item.netAmount ?? item.deductionAmount)
      : 0)
  const carryOverAdjustmentAmount = item.carryOverAdjustmentAmount ?? 0
  const otherAdjustmentAmount = item.otherAdjustmentAmount ?? 0

  return {
    ...item,
    ...cycleFields,
    statementLineGrainType:
      item.statementLineGrainType ??
      (item.returnInboundBatchId || item.returnInboundBatchNo
        ? 'RETURN_INBOUND_BATCH'
        : item.sourceItemType === 'QUALITY_DEDUCTION'
          ? 'NON_BATCH_QUALITY'
          : 'NON_BATCH_ADJUSTMENT'),
    returnInboundBatchId: item.returnInboundBatchId,
    returnInboundBatchNo: item.returnInboundBatchNo,
    returnInboundQty: item.returnInboundQty ?? qty,
    productionOrderNo: item.productionOrderNo ?? resolveProductionOrderNo(item.productionOrderId),
    taskNo: item.taskNo ?? resolveTaskNo(item.taskId),
    processLabel: item.processLabel ?? item.sourceProcessType,
    pricingSourceType: item.pricingSourceType ?? pricingFields.pricingSourceType,
    pricingSourceRefId: item.pricingSourceRefId ?? pricingFields.pricingSourceRefId,
    settlementUnitPrice: item.settlementUnitPrice ?? pricingFields.settlementUnitPrice,
    earningAmount,
    qualityDeductionAmount,
    carryOverAdjustmentAmount,
    otherAdjustmentAmount,
    netAmount:
      item.netAmount ??
      (earningAmount - qualityDeductionAmount + carryOverAdjustmentAmount + otherAdjustmentAmount),
  }
}

function finalizeStatementDraftFields(draft: StatementDraft): StatementDraft {
  const ledgerIds = Array.from(new Set(draft.items.map((item) => item.sourceItemId)))
  const earningLedgerIds = Array.from(
    new Set(
      draft.items.filter((item) => item.sourceItemType === 'TASK_EARNING').map((item) => item.sourceItemId),
    ),
  )
  const deductionLedgerIds = Array.from(
    new Set(
      draft.items.filter((item) => item.sourceItemType === 'QUALITY_DEDUCTION').map((item) => item.sourceItemId),
    ),
  )
  const totalQty = draft.items.reduce((sum, item) => sum + (item.returnInboundQty ?? item.deductionQty ?? 0), 0)
  const totalEarningAmount = roundAmount(
    draft.items.reduce((sum, item) => sum + (item.earningAmount ?? 0), 0),
  )
  const totalDeductionAmount = roundAmount(
    draft.items.reduce((sum, item) => sum + (item.qualityDeductionAmount ?? 0), 0),
  )
  const netPayableAmount = roundAmount(
    draft.items.reduce((sum, item) => sum + (item.netAmount ?? item.deductionAmount ?? 0), 0),
  )

  return {
    ...draft,
    statementNo: draft.statementNo ?? draft.statementId,
    factoryId: draft.factoryId ?? draft.settlementPartyId,
    factoryName:
      draft.factoryName ??
      getFactoryById(draft.settlementPartyId)?.name ??
      draft.statementPartyView ??
      draft.settlementPartyId,
    settlementCurrency:
      draft.settlementCurrency ?? draft.settlementProfileSnapshot.settlementConfigSnapshot.currency,
    ledgerIds,
    earningLedgerIds,
    deductionLedgerIds,
    itemSourceIds: draft.itemSourceIds?.length ? Array.from(new Set(draft.itemSourceIds)) : ledgerIds,
    itemCount: draft.items.length,
    totalQty,
    totalEarningAmount,
    totalDeductionAmount,
    totalAmount: netPayableAmount,
    netPayableAmount,
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
        | 'appealRecords'
        | 'appealSubmittedAt'
        | 'appealSubmittedBy'
        | 'platformHandledAt'
        | 'platformHandledBy'
        | 'resolutionAt'
        | 'resolutionResult'
        | 'resolutionComment'
      >
    >,
): StatementDraft {
  const snapshot = draft.settlementProfileSnapshot ?? buildSettlementProfileSnapshot(draft.settlementPartyId)
  const normalizedStatus = normalizeStatementStatus(draft as StatementDraft)
  const appealRecords = getAppealRecords(draft as StatementDraft)
  const latestAppeal = appealRecords.length ? appealRecords[appealRecords.length - 1] : null
  const cycleFields =
    draft.settlementCycleId
      ? {
          settlementCycleId: draft.settlementCycleId,
          settlementCycleLabel: draft.settlementCycleLabel,
          settlementCycleStartAt: draft.settlementCycleStartAt,
          settlementCycleEndAt: draft.settlementCycleEndAt,
        }
      : deriveSettlementCycleFields(draft.settlementPartyId, draft.createdAt)
  return finalizeStatementDraftFields({
    ...draft,
    status: normalizedStatus,
    settlementProfileSnapshot: snapshot,
    settlementProfileVersionNo: draft.settlementProfileVersionNo ?? snapshot.versionNo,
    statementPartyView: draft.statementPartyView ?? buildStatementPartyView(draft.settlementPartyType, draft.settlementPartyId),
    factoryFeedbackStatus:
      draft.factoryFeedbackStatus ??
      (normalizedStatus === 'DRAFT' ? 'NOT_SENT' : 'PENDING_FACTORY_CONFIRM'),
    appealSubmittedAt: draft.appealSubmittedAt ?? latestAppeal?.submittedAt,
    appealSubmittedBy: draft.appealSubmittedBy ?? latestAppeal?.submittedBy,
    platformHandledAt: draft.platformHandledAt ?? latestAppeal?.platformHandledAt,
    platformHandledBy: draft.platformHandledBy ?? latestAppeal?.platformHandledBy,
    resolutionAt: draft.resolutionAt ?? latestAppeal?.resolutionAt,
    resolutionResult: draft.resolutionResult ?? latestAppeal?.resolutionResult,
    resolutionComment: draft.resolutionComment ?? latestAppeal?.resolutionComment,
    appealRecords,
    factoryAppealRecord: latestAppeal ?? undefined,
    ...cycleFields,
    items: draft.items.map((item) => enrichStatementDraftItemSeed(item, draft)),
  } as StatementDraft)
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

function randomSuffix(length = 4): string {
  return Math.random()
    .toString(36)
    .slice(2, 2 + length)
    .toUpperCase()
    .padEnd(length, '0')
}

function roundAmount(value: number): number {
  return Number(value.toFixed(2))
}

function cloneSettlementProfileSnapshot(snapshot: SettlementProfileSnapshot): SettlementProfileSnapshot {
  return {
    ...snapshot,
    settlementConfigSnapshot: cloneSettlementConfigSnapshot(snapshot.settlementConfigSnapshot),
    receivingAccountSnapshot: cloneReceivingAccountSnapshot(snapshot.receivingAccountSnapshot),
    defaultDeductionRulesSnapshot: cloneDeductionRulesSnapshot(snapshot.defaultDeductionRulesSnapshot),
  }
}

function cloneStatementDraftItem(item: StatementDraftItem): StatementDraftItem {
  return {
    ...item,
  }
}

function cloneGeneratedStatementDraft(draft: StatementDraft): StatementDraft {
  return enrichStatementDraftSeed({
    ...draft,
    settlementProfileSnapshot: cloneSettlementProfileSnapshot(draft.settlementProfileSnapshot),
    items: draft.items.map((item) => cloneStatementDraftItem(item)),
    factoryAppealRecord: draft.factoryAppealRecord ? { ...draft.factoryAppealRecord } : undefined,
    appealRecords: draft.appealRecords?.map((item) => ({ ...item })) ?? [],
  })
}

function cloneGeneratedPayableAdjustment(adjustment: PayableAdjustment): PayableAdjustment {
  return {
    ...adjustment,
  }
}

function cloneGeneratedPreSettlementLedger(ledger: PreSettlementLedger): PreSettlementLedger {
  return {
    ...ledger,
  }
}

function cloneGeneratedFeishuPaymentApproval(approval: FeishuPaymentApproval): FeishuPaymentApproval {
  return {
    ...approval,
  }
}

function cloneGeneratedPaymentWriteback(writeback: PaymentWriteback): PaymentWriteback {
  return {
    ...writeback,
  }
}

function cloneGeneratedSettlementBatch(batch: SettlementBatch): SettlementBatch {
  const items = batch.items.map((item) => ({
    ...item,
    settlementProfileSnapshot: item.settlementProfileSnapshot
      ? cloneSettlementProfileSnapshot(item.settlementProfileSnapshot)
      : undefined,
    statementStatus: item.statementStatus,
    resolutionResult: item.resolutionResult,
  }))
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
}

export const initialStatementDrafts: StatementDraft[] = settlementLinkedMockFactoryOutput.statementDrafts.map((draft) =>
  cloneGeneratedStatementDraft(draft),
)

export const initialPayableAdjustments: PayableAdjustment[] = settlementLinkedMockFactoryOutput.payableAdjustments.map(
  (adjustment) => cloneGeneratedPayableAdjustment(adjustment),
)

export const initialTaskEarningLedgers: PreSettlementLedger[] = settlementLinkedMockFactoryOutput.taskEarningLedgers.map(
  (ledger) => cloneGeneratedPreSettlementLedger(ledger),
)

export const initialStatementAdjustments: StatementAdjustment[] = initialPayableAdjustments

export const initialFeishuPaymentApprovals: FeishuPaymentApproval[] = settlementLinkedMockFactoryOutput.feishuPaymentApprovals.map(
  (approval) => cloneGeneratedFeishuPaymentApproval(approval),
)

export const initialPaymentWritebacks: PaymentWriteback[] = settlementLinkedMockFactoryOutput.paymentWritebacks.map(
  (writeback) => cloneGeneratedPaymentWriteback(writeback),
)

export const initialSettlementBatches: SettlementBatch[] = settlementLinkedMockFactoryOutput.settlementBatches.map((batch) =>
  cloneGeneratedSettlementBatch(batch),
)

export const initialPrepaymentBatches = initialSettlementBatches

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

export function getStatementById(statementId: string): StatementDraft | null {
  return getStatementDraftById(statementId)
}

export function listStatements(options: {
  settlementPartyId?: string
  settlementCycleId?: string
  status?: StatementStatus | '__ALL__'
  keyword?: string
} = {}): StatementDraft[] {
  const keyword = options.keyword?.trim().toLowerCase() ?? ''
  return initialStatementDrafts.filter((item) => {
    if (options.settlementPartyId && !isSameSettlementPartyId(item.settlementPartyId, options.settlementPartyId)) return false
    if (options.settlementCycleId && item.settlementCycleId !== options.settlementCycleId) return false
    if (options.status && options.status !== '__ALL__' && item.status !== options.status) return false
    if (!keyword) return true

    const haystack = [
      item.statementId,
      item.statementNo ?? '',
      item.factoryName ?? '',
      item.settlementCycleLabel ?? '',
      item.settlementProfileVersionNo,
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(keyword)
  })
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

export function getPrepaymentBatchById(batchId: string): SettlementBatch | null {
  return initialSettlementBatches.find((batch) => batch.batchId === batchId) ?? null
}

export function listFeishuPaymentApprovals(batchId?: string): FeishuPaymentApproval[] {
  if (!batchId) return initialFeishuPaymentApprovals
  return initialFeishuPaymentApprovals.filter((item) => item.batchId === batchId)
}

export function getFeishuPaymentApprovalById(approvalId: string): FeishuPaymentApproval | null {
  return initialFeishuPaymentApprovals.find((item) => item.approvalId === approvalId) ?? null
}

export function listPaymentWritebacks(batchId?: string): PaymentWriteback[] {
  if (!batchId) return initialPaymentWritebacks
  return initialPaymentWritebacks.filter((item) => item.batchId === batchId)
}

export function getPaymentWritebackById(writebackId: string): PaymentWriteback | null {
  return initialPaymentWritebacks.find((item) => item.writebackId === writebackId) ?? null
}

function buildPayeeAccountSnapshotId(statement: Pick<StatementDraft, 'settlementProfileVersionNo' | 'settlementProfileSnapshot'>): string {
  return `${statement.settlementProfileVersionNo}:${statement.settlementProfileSnapshot.receivingAccountSnapshot.bankAccountNo}`
}

function isClosedBatchStatus(status: PrepaymentBatchStatus): boolean {
  return status === 'CLOSED'
}

function isPaidBatchStatus(status: PrepaymentBatchStatus): boolean {
  return status === 'PREPAID' || status === 'CLOSED'
}

function isApprovalActive(status: FeishuPaymentApproval['status']): boolean {
  return status !== 'REJECTED' && status !== 'CANCELED'
}

function nextFeishuApprovalStatus(status: FeishuPaymentApproval['status']): FeishuPaymentApproval['status'] {
  if (status === 'CREATED') return 'APPROVING'
  if (status === 'APPROVING') return 'APPROVED_PENDING_PAYMENT'
  if (status === 'APPROVED_PENDING_PAYMENT') return 'PAID'
  return status
}

function buildBatchStatementItems(statements: StatementDraft[]): SettlementBatchItem[] {
  return statements.map((statement) => ({
    statementId: statement.statementId,
    statementNo: statement.statementNo,
    factoryId: statement.factoryId,
    factoryName: statement.factoryName,
    settlementPartyType: statement.settlementPartyType,
    settlementPartyId: statement.settlementPartyId,
    settlementCycleId: statement.settlementCycleId,
    settlementCycleLabel: statement.settlementCycleLabel,
    totalAmount: statement.totalAmount,
    totalEarningAmount: statement.totalEarningAmount,
    totalDeductionAmount: statement.totalDeductionAmount,
    statementStatus: statement.status,
    settlementProfileVersionNo: statement.settlementProfileVersionNo,
    settlementProfileSnapshot: statement.settlementProfileSnapshot,
    factoryFeedbackStatus: statement.factoryFeedbackStatus,
    resolutionResult: statement.resolutionResult,
  }))
}

function updateStatementsForBatch(
  statements: StatementDraft[],
  batch: SettlementBatch,
  by: string,
  at: string,
): void {
  for (const statement of statements) {
    statement.prepaymentBatchId = batch.batchId
    statement.prepaymentBatchNo = batch.batchNo
    statement.prepaymentBatchStatus = batch.status
    statement.feishuApprovalId = batch.feishuApprovalId
    statement.feishuApprovalNo = batch.feishuApprovalNo
    statement.paymentWritebackId = batch.paymentWritebackId
    statement.prepaidAt = batch.prepaidAt
    statement.closedAt = batch.closedAt
    statement.updatedAt = at
    statement.updatedBy = by

    if (batch.paymentWritebackId && isPaidBatchStatus(batch.status)) {
      statement.status = 'PREPAID'
    } else {
      statement.status = 'IN_PREPAYMENT_BATCH'
    }
  }
}

function buildBatchLifecyclePaymentCompat(batch: SettlementBatch, writeback: PaymentWriteback | null, approval: FeishuPaymentApproval | null): void {
  if (writeback) {
    batch.paymentSyncStatus = 'SUCCESS'
    batch.paymentAmount = writeback.amount
    batch.paymentAt = writeback.paidAt
    batch.paymentReferenceNo = writeback.bankSerialNo
    batch.paymentRemark = '已完成打款回写'
    batch.paymentUpdatedAt = writeback.writtenBackAt
    batch.paymentUpdatedBy = writeback.writtenBackBy
    return
  }

  if (approval?.status === 'PAID') {
    batch.paymentSyncStatus = 'UNSYNCED'
    batch.paymentAmount = approval.amount
    batch.paymentAt = approval.paidAt
    batch.paymentReferenceNo = approval.bankSerialNo
    batch.paymentRemark = '飞书付款审批已显示已付款，待创建打款回写'
    batch.paymentUpdatedAt = approval.latestSyncedAt
    batch.paymentUpdatedBy = '财务共享'
    return
  }

  if (approval?.status === 'REJECTED' || approval?.status === 'CANCELED') {
    batch.paymentSyncStatus = 'FAILED'
    batch.paymentRemark = approval.status === 'REJECTED' ? '飞书付款审批已驳回' : '飞书付款审批已取消'
    batch.paymentUpdatedAt = approval.latestSyncedAt
    batch.paymentUpdatedBy = '财务共享'
    return
  }

  batch.paymentSyncStatus = 'UNSYNCED'
  batch.paymentRemark = '待申请付款'
}

export function createPrepaymentBatch(input: {
  statementIds: string[]
  batchName?: string
  remark?: string
  by: string
  at?: string
}): { ok: boolean; message?: string; data?: SettlementBatch } {
  if (!input.statementIds.length) return { ok: false, message: '请至少选择一张对账单' }
  const statements = input.statementIds
    .map((statementId) => getStatementById(statementId))
    .filter(Boolean) as StatementDraft[]

  if (statements.length !== input.statementIds.length) {
    return { ok: false, message: '存在未找到的对账单，无法创建预付款批次' }
  }

  const factoryId = statements[0].settlementPartyId
  const currency = statements[0].settlementCurrency ?? statements[0].settlementProfileSnapshot.settlementConfigSnapshot.currency
  const payeeVersion = statements[0].settlementProfileVersionNo
  const payeeSnapshotId = buildPayeeAccountSnapshotId(statements[0])

  if (statements.some((item) => item.settlementPartyId !== factoryId)) {
    return { ok: false, message: '预付款批次不能跨工厂组批' }
  }
  if (statements.some((item) => !canStatementEnterPrepayment(item))) {
    return { ok: false, message: '所选对账单中存在未达到可入预付款批次条件的单据' }
  }
  if (statements.some((item) => (item.settlementCurrency ?? item.settlementProfileSnapshot.settlementConfigSnapshot.currency) !== currency)) {
    return { ok: false, message: '所选对账单结算币种不一致，不能创建同一预付款批次' }
  }
  if (statements.some((item) => item.settlementProfileVersionNo !== payeeVersion || buildPayeeAccountSnapshotId(item) !== payeeSnapshotId)) {
    return { ok: false, message: '所选对账单的收款资料快照版本不一致，不能创建同一预付款批次' }
  }

  const occupied = initialSettlementBatches.find(
    (batch) =>
      !isClosedBatchStatus(batch.status) &&
      batch.statementIds.some((statementId) => input.statementIds.includes(statementId)),
  )
  if (occupied) {
    return { ok: false, message: `存在已在未关闭预付款批次中的对账单：${occupied.batchNo ?? occupied.batchId}` }
  }

  const timestamp = input.at ?? nowText()
  const batchNo = `PPB-${timestamp.slice(0, 7).replace('-', '')}-${randomSuffix(4)}`
  const items = buildBatchStatementItems(statements)
  const snapshotRefs = buildBatchSnapshotRefs(items)
  const batch: SettlementBatch = {
    batchId: `PPB-ID-${randomSuffix(6)}`,
    batchNo,
    batchName: input.batchName?.trim() || batchNo,
    factoryId,
    factoryName: statements[0].factoryName ?? statements[0].statementPartyView ?? factoryId,
    settlementCurrency: currency,
    payeeAccountSnapshotId: payeeSnapshotId,
    payeeAccountSnapshotVersion: payeeVersion,
    itemCount: items.length,
    totalStatementCount: statements.length,
    totalAmount: roundAmount(statements.reduce((sum, item) => sum + item.totalAmount, 0)),
    totalPayableAmount: roundAmount(statements.reduce((sum, item) => sum + item.totalAmount, 0)),
    totalEarningAmount: roundAmount(statements.reduce((sum, item) => sum + (item.totalEarningAmount ?? 0), 0)),
    totalDeductionAmount: roundAmount(statements.reduce((sum, item) => sum + (item.totalDeductionAmount ?? 0), 0)),
    status: 'READY_TO_APPLY_PAYMENT',
    statementIds: statements.map((item) => item.statementId),
    items,
    remark: input.remark?.trim() || undefined,
    notes: '已组批，待申请付款',
    createdAt: timestamp,
    createdBy: input.by,
    updatedAt: timestamp,
    updatedBy: input.by,
    settlementProfileSnapshotRefs: snapshotRefs,
    settlementProfileVersionSummary:
      snapshotRefs.length === 0
        ? '未绑定结算资料版本'
        : snapshotRefs.length === 1
          ? snapshotRefs[0].versionNo
          : `${snapshotRefs.length} 个版本快照`,
    paymentSyncStatus: 'UNSYNCED',
    paymentRemark: '待申请付款',
  }

  initialSettlementBatches.push(batch)
  updateStatementsForBatch(statements, batch, input.by, timestamp)
  return { ok: true, data: batch }
}

export function applyPrepaymentBatchForPayment(input: {
  batchId: string
  by: string
  at?: string
}): { ok: boolean; message?: string; data?: FeishuPaymentApproval } {
  const batch = getPrepaymentBatchById(input.batchId)
  if (!batch) return { ok: false, message: '未找到对应预付款批次' }
  if (batch.feishuApprovalId) {
    const existing = getFeishuPaymentApprovalById(batch.feishuApprovalId)
    if (existing && isApprovalActive(existing.status)) {
      return { ok: false, message: '当前批次已存在有效的飞书付款审批，不能重复申请付款' }
    }
  }
  if (batch.status !== 'READY_TO_APPLY_PAYMENT' && batch.status !== 'DRAFT') {
    return { ok: false, message: '当前批次状态不允许申请付款' }
  }

  const timestamp = input.at ?? nowText()
  const approval: FeishuPaymentApproval = {
    approvalId: `FPA-ID-${randomSuffix(6)}`,
    approvalNo: `FPA-${timestamp.slice(0, 7).replace('-', '')}-${randomSuffix(4)}`,
    batchId: batch.batchId,
    factoryId: batch.factoryId,
    factoryName: batch.factoryName,
    amount: batch.totalPayableAmount,
    currency: batch.settlementCurrency,
    payeeAccountSnapshotId: batch.payeeAccountSnapshotId,
    payeeAccountSnapshotVersion: batch.payeeAccountSnapshotVersion,
    title: `${batch.factoryName}预付款申请`,
    displayTitle: `${batch.factoryName} · ${batch.totalStatementCount} 张对账单预付款`,
    status: 'CREATED',
    createdAt: timestamp,
    createdBy: input.by,
    latestSyncedAt: timestamp,
    feishuRawStatus: 'CREATED',
    externalStatus: 'CREATED',
  }

  initialFeishuPaymentApprovals.push(approval)
  batch.appliedForPaymentAt = timestamp
  batch.feishuApprovalId = approval.approvalId
  batch.feishuApprovalNo = approval.approvalNo
  batch.status = 'FEISHU_APPROVAL_CREATED'
  batch.updatedAt = timestamp
  batch.updatedBy = input.by
  batch.paymentRemark = '已创建飞书付款审批，待同步审批进度'

  for (const statementId of batch.statementIds) {
    const statement = getStatementById(statementId)
    if (!statement) continue
    statement.feishuApprovalId = approval.approvalId
    statement.feishuApprovalNo = approval.approvalNo
    statement.updatedAt = timestamp
    statement.updatedBy = input.by
  }

  return { ok: true, data: approval }
}

export function syncFeishuPaymentApprovalStatus(input: {
  approvalId: string
  by: string
  at?: string
  status?: FeishuPaymentApproval['status']
}): { ok: boolean; message?: string; data?: FeishuPaymentApproval } {
  const approval = getFeishuPaymentApprovalById(input.approvalId)
  if (!approval) return { ok: false, message: '未找到对应飞书付款审批' }
  const batch = getPrepaymentBatchById(approval.batchId)
  if (!batch) return { ok: false, message: '未找到审批关联的预付款批次' }

  const nextStatus = input.status ?? nextFeishuApprovalStatus(approval.status)
  if (approval.status === nextStatus) {
    return { ok: true, data: approval }
  }

  const timestamp = input.at ?? nowText()
  approval.status = nextStatus
  approval.latestSyncedAt = timestamp
  approval.feishuRawStatus = nextStatus
  approval.externalStatus = nextStatus

  if (nextStatus === 'APPROVED_PENDING_PAYMENT') approval.approvedAt = timestamp
  if (nextStatus === 'PAID') {
    approval.approvedAt = approval.approvedAt ?? timestamp
    approval.paidAt = timestamp
    approval.bankReceiptRef = approval.bankReceiptRef ?? `receipt://feishu/${approval.approvalNo}.png`
    approval.bankReceiptName = approval.bankReceiptName ?? `${approval.approvalNo}-bank-receipt.png`
    approval.bankSerialNo = approval.bankSerialNo ?? `BSN-${randomSuffix(8)}`
    approval.payerBankAccountName = approval.payerBankAccountName ?? 'HiGood 运营付款户'
    approval.payerBankAccountNoMasked = approval.payerBankAccountNoMasked ?? '6222 **** **** 7812'
  }
  if (nextStatus === 'REJECTED') approval.rejectedAt = timestamp
  if (nextStatus === 'CANCELED') approval.canceledAt = timestamp

  if (nextStatus === 'PAID') {
    batch.status = 'FEISHU_PAID_PENDING_WRITEBACK'
  } else if (nextStatus === 'REJECTED') {
    batch.status = 'FEISHU_APPROVAL_REJECTED'
  } else if (nextStatus === 'CANCELED') {
    batch.status = 'FEISHU_APPROVAL_CANCELED'
  } else {
    batch.status = 'FEISHU_APPROVAL_CREATED'
  }
  batch.updatedAt = timestamp
  batch.updatedBy = input.by
  buildBatchLifecyclePaymentCompat(batch, null, approval)

  return { ok: true, data: approval }
}

export function createPaymentWriteback(input: {
  batchId: string
  by: string
  at?: string
  notes?: string
}): { ok: boolean; message?: string; data?: PaymentWriteback } {
  const batch = getPrepaymentBatchById(input.batchId)
  if (!batch) return { ok: false, message: '未找到对应预付款批次' }
  if (batch.paymentWritebackId) return { ok: false, message: '当前批次已存在正式打款回写，不能重复创建' }
  if (!batch.feishuApprovalId) return { ok: false, message: '当前批次尚未创建飞书付款审批' }

  const approval = getFeishuPaymentApprovalById(batch.feishuApprovalId)
  if (!approval) return { ok: false, message: '未找到对应飞书付款审批' }
  if (approval.status !== 'PAID') return { ok: false, message: '飞书付款审批未到已付款状态，不能创建打款回写' }

  const timestamp = input.at ?? nowText()
  const writeback: PaymentWriteback = {
    writebackId: `PWB-ID-${randomSuffix(6)}`,
    batchId: batch.batchId,
    approvalId: approval.approvalId,
    approvalNo: approval.approvalNo,
    factoryId: batch.factoryId,
    factoryName: batch.factoryName,
    amount: approval.amount,
    currency: approval.currency,
    paidAt: approval.paidAt ?? timestamp,
    bankReceiptRef: approval.bankReceiptRef ?? `receipt://feishu/${approval.approvalNo}.png`,
    bankReceiptName: approval.bankReceiptName ?? `${approval.approvalNo}-bank-receipt.png`,
    bankSerialNo: approval.bankSerialNo ?? `BSN-${randomSuffix(8)}`,
    payerBankAccountName: approval.payerBankAccountName,
    payerBankAccountNoMasked: approval.payerBankAccountNoMasked,
    payeeAccountSnapshotId: batch.payeeAccountSnapshotId,
    payeeAccountSnapshotVersion: batch.payeeAccountSnapshotVersion,
    writtenBackAt: timestamp,
    writtenBackBy: input.by,
    notes: input.notes?.trim() || '已根据飞书付款审批同步打款结果并回写银行信息',
  }

  initialPaymentWritebacks.push(writeback)
  batch.paymentWritebackId = writeback.writebackId
  batch.prepaidAt = writeback.paidAt
  batch.status = 'PREPAID'
  batch.updatedAt = timestamp
  batch.updatedBy = input.by
  buildBatchLifecyclePaymentCompat(batch, writeback, approval)

  const statements = batch.statementIds
    .map((statementId) => getStatementById(statementId))
    .filter(Boolean) as StatementDraft[]
  updateStatementsForBatch(statements, batch, input.by, timestamp)
  for (const statement of statements) {
    statement.status = 'PREPAID'
  }

  return { ok: true, data: writeback }
}

export function closePrepaymentBatch(input: {
  batchId: string
  by: string
  at?: string
}): { ok: boolean; message?: string; data?: SettlementBatch } {
  const batch = getPrepaymentBatchById(input.batchId)
  if (!batch) return { ok: false, message: '未找到对应预付款批次' }
  if (!isPaidBatchStatus(batch.status)) return { ok: false, message: '仅已预付批次允许关闭' }
  if (batch.status === 'CLOSED') return { ok: true, data: batch }

  const timestamp = input.at ?? nowText()
  batch.status = 'CLOSED'
  batch.closedAt = timestamp
  batch.updatedAt = timestamp
  batch.updatedBy = input.by

  const statements = batch.statementIds
    .map((statementId) => getStatementById(statementId))
    .filter(Boolean) as StatementDraft[]
  updateStatementsForBatch(statements, batch, input.by, timestamp)
  return { ok: true, data: batch }
}

export function findOpenStatementByPartyAndCycle(
  settlementPartyId: string,
  settlementCycleId: string,
): StatementDraft | null {
  return (
    initialStatementDrafts.find(
      (item) =>
        item.status !== 'CLOSED' &&
        item.settlementCycleId === settlementCycleId &&
        isSameSettlementPartyId(item.settlementPartyId, settlementPartyId),
    ) ?? null
  )
}

export function createStatementFromEligibleLedgers(input: {
  statementId: string
  settlementPartyType: string
  settlementPartyId: string
  settlementPartyLabel?: string
  settlementCycleId: string
  settlementCycleLabel: string
  settlementCycleStartAt: string
  settlementCycleEndAt: string
  itemSourceIds: string[]
  itemBasisIds: string[]
  items: StatementDraftItem[]
  remark?: string
  by: string
  at?: string
}): { ok: boolean; message?: string; existingStatementId?: string; data?: StatementDraft } {
  const existed = findOpenStatementByPartyAndCycle(input.settlementPartyId, input.settlementCycleId)
  if (existed) {
    return {
      ok: false,
      message: '该工厂该结算周期已存在未关闭对账单，请直接查看或继续编辑已有单据。',
      existingStatementId: existed.statementId,
    }
  }
  if (!input.items.length) return { ok: false, message: '当前工厂和结算周期暂无可入单的正式流水' }

  const timestamp = input.at ?? nowText()
  const snapshot = buildStatementSettlementProfileSnapshot(input.settlementPartyType, input.settlementPartyId)
  const draft = enrichStatementDraftSeed({
    statementId: input.statementId,
    statementNo: input.statementId,
    factoryId: input.settlementPartyId,
    factoryName: input.settlementPartyLabel,
    settlementPartyType: input.settlementPartyType,
    settlementPartyId: input.settlementPartyId,
    itemCount: input.items.length,
    totalQty: 0,
    totalAmount: 0,
    status: 'DRAFT',
    itemBasisIds: [...input.itemBasisIds],
    itemSourceIds: [...input.itemSourceIds],
    items: input.items,
    remark: input.remark?.trim() || undefined,
    settlementProfileSnapshot: snapshot,
    settlementProfileVersionNo: snapshot.versionNo,
    settlementCurrency: snapshot.settlementConfigSnapshot.currency,
    statementPartyView: input.settlementPartyLabel ?? buildStatementPartyView(input.settlementPartyType, input.settlementPartyId),
    settlementCycleId: input.settlementCycleId,
    settlementCycleLabel: input.settlementCycleLabel,
    settlementCycleStartAt: input.settlementCycleStartAt,
    settlementCycleEndAt: input.settlementCycleEndAt,
    factoryFeedbackStatus: 'NOT_SENT',
    createdAt: timestamp,
    createdBy: input.by,
  })
  initialStatementDrafts.push(draft)
  return { ok: true, data: draft }
}

export function updateStatementDraftRemark(input: {
  statementId: string
  remark: string
  by: string
  at?: string
}): { ok: boolean; message?: string; data?: StatementDraft } {
  const statement = getStatementDraftById(input.statementId)
  if (!statement) return { ok: false, message: '未找到对应对账单' }
  if (statement.status !== 'DRAFT') return { ok: false, message: '当前仅草稿可更新备注' }

  const timestamp = input.at ?? nowText()
  statement.remark = input.remark.trim()
  statement.updatedAt = timestamp
  statement.updatedBy = input.by
  return { ok: true, data: statement }
}

export function syncStatementDraftFromBuild(input: {
  statementId: string
  remark?: string
  itemSourceIds: string[]
  itemBasisIds: string[]
  items: StatementDraftItem[]
  by: string
  at?: string
}): { ok: boolean; message?: string; data?: StatementDraft } {
  const statement = getStatementDraftById(input.statementId)
  if (!statement) return { ok: false, message: '未找到对应对账单' }
  if (statement.status !== 'DRAFT') return { ok: false, message: '当前仅草稿可继续编辑' }
  if (!input.items.length) return { ok: false, message: '当前周期暂无可纳入的对账明细行' }

  const timestamp = input.at ?? nowText()
  const firstLine = input.items[0]
  statement.itemSourceIds = [...input.itemSourceIds]
  statement.itemBasisIds = [...input.itemBasisIds]
  statement.items = input.items.map((item) => enrichStatementDraftItemSeed(item, statement))
  statement.itemCount = statement.items.length
  statement.remark = input.remark?.trim() || undefined
  statement.settlementCycleId = firstLine.settlementCycleId
  statement.settlementCycleLabel = firstLine.settlementCycleLabel
  statement.settlementCycleStartAt = firstLine.settlementCycleStartAt
  statement.settlementCycleEndAt = firstLine.settlementCycleEndAt
  statement.updatedAt = timestamp
  statement.updatedBy = input.by
  const normalized = finalizeStatementDraftFields(statement)
  Object.assign(statement, normalized)
  return { ok: true, data: statement }
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
  if (statement.status !== 'PENDING_FACTORY_CONFIRM') return { ok: false, message: '当前仅待工厂反馈的对账单可确认' }

  const timestamp = input.at ?? nowText()
  statement.status = 'READY_FOR_PREPAYMENT'
  statement.factoryFeedbackStatus = 'FACTORY_CONFIRMED'
  statement.factoryFeedbackAt = timestamp
  statement.factoryFeedbackBy = input.by
  statement.factoryFeedbackRemark = input.remark?.trim() || '工厂已确认对账口径'
  statement.factoryConfirmedAt = timestamp
  statement.readyForPrepaymentAt = timestamp
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
  if (statement.status !== 'PENDING_FACTORY_CONFIRM') return { ok: false, message: '当前仅待工厂反馈的对账单可发起申诉' }
  if (!input.reason.trim() || !input.description.trim()) {
    return { ok: false, message: '请填写申诉原因和申诉说明' }
  }
  if (getOpenStatementAppeal(statement)) {
    return { ok: false, message: '当前已有待处理申诉，请等待平台处理完成后再提交新的申诉' }
  }

  const timestamp = input.at ?? nowText()
  statement.factoryFeedbackStatus = 'FACTORY_APPEALED'
  statement.factoryFeedbackAt = timestamp
  statement.factoryFeedbackBy = input.by
  statement.factoryFeedbackRemark = input.description.trim()
  statement.appealSubmittedAt = timestamp
  statement.appealSubmittedBy = input.by
  statement.platformHandledAt = undefined
  statement.platformHandledBy = undefined
  statement.resolutionAt = undefined
  statement.resolutionResult = undefined
  statement.resolutionComment = undefined
  const appeal = createStatementAppealRecord({
    statementId: statement.statementId,
    factoryId: statement.settlementPartyId,
    settlementCycleId: statement.settlementCycleId,
    reasonCode: input.reason.trim(),
    reasonName: input.reason.trim(),
    reason: input.reason.trim(),
    description: input.description.trim(),
    submittedAt: timestamp,
    submittedBy: input.by,
    attachments: [],
    evidenceSummary: input.evidenceSummary?.trim() || undefined,
  })
  statement.appealRecords = [...(statement.appealRecords ?? []), appeal]
  statement.factoryAppealRecord = appeal
  statement.updatedAt = timestamp
  statement.updatedBy = input.by
  return { ok: true, data: statement }
}

export function startStatementAppealHandling(input: {
  statementId: string
  by: string
  remark?: string
  at?: string
}): { ok: boolean; message?: string; data?: StatementDraft } {
  const statement = getStatementDraftById(input.statementId)
  if (!statement) return { ok: false, message: '未找到对应对账单' }
  const appeal = getOpenStatementAppeal(statement)
  if (!appeal) return { ok: false, message: '当前没有待处理申诉' }
  if (statement.factoryFeedbackStatus === 'PLATFORM_HANDLING' && appeal.status === 'PLATFORM_HANDLING') {
    return { ok: true, data: statement }
  }

  const timestamp = input.at ?? nowText()
  appeal.status = 'PLATFORM_HANDLING'
  appeal.platformHandledAt = timestamp
  appeal.platformHandledBy = input.by
  statement.factoryFeedbackStatus = 'PLATFORM_HANDLING'
  statement.platformHandledAt = timestamp
  statement.platformHandledBy = input.by
  statement.factoryFeedbackRemark = input.remark?.trim() || '平台已受理工厂申诉，处理中'
  statement.updatedAt = timestamp
  statement.updatedBy = input.by
  return { ok: true, data: statement }
}

export function resolveStatementAppeal(input: {
  statementId: string
  by: string
  result: StatementResolutionResult
  comment: string
  at?: string
}): { ok: boolean; message?: string; data?: StatementDraft } {
  const statement = getStatementDraftById(input.statementId)
  if (!statement) return { ok: false, message: '未找到对应对账单' }
  const appeal = getOpenStatementAppeal(statement)
  if (!appeal) return { ok: false, message: '当前没有待处理申诉' }
  if (!input.comment.trim()) return { ok: false, message: '请填写处理意见' }

  const timestamp = input.at ?? nowText()
  appeal.status = 'RESOLVED'
  appeal.platformHandledAt = timestamp
  appeal.platformHandledBy = input.by
  appeal.resolutionAt = timestamp
  appeal.resolutionResult = input.result
  appeal.resolutionComment = input.comment.trim()

  statement.factoryFeedbackStatus = 'RESOLVED'
  statement.platformHandledAt = timestamp
  statement.platformHandledBy = input.by
  statement.resolutionAt = timestamp
  statement.resolutionResult = input.result
  statement.resolutionComment = input.comment.trim()
  statement.factoryFeedbackRemark =
    input.result === 'UPHELD'
      ? '平台已维持当前对账口径，可继续进入后续预付款'
      : '平台已要求调整后重算，当前单据不再继续进入后续预付款'
  statement.status = input.result === 'UPHELD' ? 'READY_FOR_PREPAYMENT' : 'CLOSED'
  statement.readyForPrepaymentAt = input.result === 'UPHELD' ? timestamp : undefined
  statement.updatedAt = timestamp
  statement.updatedBy = input.by
  statement.factoryAppealRecord = appeal
  return { ok: true, data: statement }
}

export function markStatementReadyForPrepayment(input: {
  statementId: string
  by: string
  at?: string
}): { ok: boolean; message?: string; data?: StatementDraft } {
  const statement = getStatementDraftById(input.statementId)
  if (!statement) return { ok: false, message: '未找到对应对账单' }
  if (statement.status === 'CLOSED') return { ok: false, message: '已关闭单据不能进入预付款' }
  if (
    statement.factoryFeedbackStatus !== 'FACTORY_CONFIRMED' &&
    !(statement.factoryFeedbackStatus === 'RESOLVED' && statement.resolutionResult === 'UPHELD')
  ) {
    return { ok: false, message: '当前对账单尚未达到可进入预付款的条件' }
  }

  const timestamp = input.at ?? nowText()
  statement.status = 'READY_FOR_PREPAYMENT'
  statement.readyForPrepaymentAt = timestamp
  statement.updatedAt = timestamp
  statement.updatedBy = input.by
  return { ok: true, data: statement }
}

export function listFactoryConfirmedStatementsEligibleForPrepayment(): StatementDraft[] {
  return initialStatementDrafts.filter((statement) => canStatementEnterPrepayment(statement))
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
    (item) => item.status !== 'CLOSED' && item.statementIds.some((statementId) => relatedStatementIds.has(statementId)),
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

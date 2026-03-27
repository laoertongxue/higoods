import { getFactoryByCode, getFactoryById } from './indonesia-factories.ts'
import { processTasks } from './process-tasks.ts'
import { productionOrders } from './production-orders.ts'
import {
  getSettlementEffectiveInfoByFactoryAt,
  type SettlementEffectiveInfo,
} from './settlement-change-requests.ts'
import {
  getFormalQualityDeductionLedgerById,
  listFormalQualityDeductionLedgers,
  traceQualityDeductionLedgerSource,
} from './quality-deduction-repository.ts'
import { deriveSettlementCycleFields } from './store-domain-statement-grain.ts'
import { settlementLinkedMockFactoryOutput } from './settlement-linked-mock-factory.ts'
import {
  initialSettlementBatches,
  initialStatementDrafts,
  initialTaskEarningLedgers,
} from './store-domain-settlement-seeds.ts'
import type {
  FormalQualityDeductionLedgerFact,
  PendingQualityDeductionRecord,
  DisputeCaseFact,
  QcRecordFact,
} from './quality-deduction-domain.ts'
import type {
  PreSettlementLedger,
  PreSettlementLedgerPriceSourceType,
  PreSettlementLedgerStatus,
  StatementDraft,
  SettlementBatch,
} from './store-domain-settlement-types.ts'

export interface PreSettlementLedgerSourceTrace {
  ledger: PreSettlementLedger
  settlementProfile: SettlementEffectiveInfo | null
  statement: StatementDraft | null
  batch: SettlementBatch | null
  task?: typeof processTasks[number] | null
  productionOrder?: typeof productionOrders[number] | null
  qcRecord?: QcRecordFact | null
  pendingDeductionRecord?: PendingQualityDeductionRecord | null
  disputeCase?: DisputeCaseFact | null
  formalQualityLedger?: FormalQualityDeductionLedgerFact | null
}

function roundAmount(value: number): number {
  return Number(value.toFixed(2))
}

function normalizeFactoryId(factoryId: string): string {
  const factory = getFactoryById(factoryId) ?? getFactoryByCode(factoryId)
  return factory?.id ?? factoryId
}

function isSameFactory(left?: string, right?: string): boolean {
  if (!left || !right) return false
  return normalizeFactoryId(left) === normalizeFactoryId(right)
}

function getMockFxRate(originalCurrency: string, settlementCurrency: string): number {
  if (originalCurrency === settlementCurrency) return 1
  if (originalCurrency === 'IDR' && settlementCurrency === 'CNY') return 0.00046
  if (originalCurrency === 'CNY' && settlementCurrency === 'IDR') return 2175
  return 1
}

function getTaskSnapshot(taskId?: string) {
  if (!taskId) return null
  return (
    processTasks.find((item) => item.taskId === taskId)
    ?? settlementLinkedMockFactoryOutput.processTasks.find((item) => item.taskId === taskId)
    ?? null
  )
}

function getProductionOrderSnapshot(productionOrderId?: string) {
  if (!productionOrderId) return null
  return (
    productionOrders.find((item) => item.productionOrderId === productionOrderId)
    ?? settlementLinkedMockFactoryOutput.productionOrders.find((item) => item.productionOrderId === productionOrderId)
    ?? null
  )
}

function getStatementByTaskLedger(ledger: PreSettlementLedger): StatementDraft | null {
  return (
    initialStatementDrafts.find((statement) =>
      statement.items.some((item) =>
        (ledger.returnInboundBatchId && item.returnInboundBatchId === ledger.returnInboundBatchId)
        || item.sourceItemId === ledger.ledgerId
        || item.sourceRefLabel === ledger.returnInboundBatchId
      ),
    ) ?? null
  )
}

function getStatementByQualityLedger(ledger: FormalQualityDeductionLedgerFact): StatementDraft | null {
  return (
    initialStatementDrafts.find((statement) =>
      statement.items.some((item) =>
        item.sourceItemId === ledger.ledgerId ||
        item.qcRecordId === ledger.qcId ||
        item.pendingDeductionRecordId === ledger.pendingRecordId,
      ),
    ) ?? null
  )
}

function getBatchByStatement(statementId?: string): SettlementBatch | null {
  if (!statementId) return null
  return initialSettlementBatches.find((batch) => batch.statementIds.includes(statementId)) ?? null
}

function resolveTaskLedgerStatus(ledger: PreSettlementLedger, statement: StatementDraft | null, batch: SettlementBatch | null): PreSettlementLedgerStatus {
  if (batch?.paymentWritebackId || batch?.prepaidAt) return 'PREPAID'
  if (batch) return 'IN_PREPAYMENT_BATCH'
  if (statement) return 'IN_STATEMENT'
  return ledger.status
}

function mapQualityLedgerStatus(status: FormalQualityDeductionLedgerFact['status']): PreSettlementLedgerStatus {
  if (status === 'INCLUDED_IN_STATEMENT') return 'IN_STATEMENT'
  if (status === 'INCLUDED_IN_PREPAYMENT_BATCH') return 'IN_PREPAYMENT_BATCH'
  if (status === 'PREPAID') return 'PREPAID'
  if (status === 'WAIT_FINAL_SETTLEMENT') return 'RESERVED_FOR_FINAL_SETTLEMENT'
  return 'OPEN'
}

function mapTaskLedgerPriceSource(type: PreSettlementLedger['priceSourceType']): PreSettlementLedgerPriceSourceType {
  return type
}

function buildTaskEarningLedgerRuntime(ledger: PreSettlementLedger): PreSettlementLedger {
  const statement = getStatementByTaskLedger(ledger)
  const batch = getBatchByStatement(statement?.statementId)
  return {
    ...ledger,
    status: resolveTaskLedgerStatus(ledger, statement, batch),
    statementId: statement?.statementId,
    prepaymentBatchId: batch?.batchId,
    priceSourceType: mapTaskLedgerPriceSource(ledger.priceSourceType),
  }
}

function buildQualityDeductionPreSettlementLedger(ledger: FormalQualityDeductionLedgerFact): PreSettlementLedger {
  const trace = traceQualityDeductionLedgerSource(ledger.ledgerId)
  const qcRecord = trace?.caseFact.qcRecord ?? null
  const pendingRecord = trace?.pendingRecord ?? null
  const disputeCase = trace?.disputeCase ?? null
  const settlementPartyId = ledger.settlementPartyId ?? ledger.factoryId ?? '-'
  const settlementProfile = getSettlementEffectiveInfoByFactoryAt(settlementPartyId, ledger.generatedAt)
  const cycle = deriveSettlementCycleFields(
    settlementPartyId,
    qcRecord?.inboundAt ?? ledger.generatedAt,
  )
  const runtimeStatement = getStatementByQualityLedger(ledger)
  const runtimeBatch = getBatchByStatement(runtimeStatement?.statementId ?? ledger.includedStatementId)
  const qty =
    pendingRecord?.settlementAmount
      ? pendingRecord.originalAmount > 0 && qcRecord?.factoryLiabilityQty
        ? qcRecord.factoryLiabilityQty
        : 1
      : qcRecord?.factoryLiabilityQty ?? 1

  return {
    ledgerId: ledger.ledgerId,
    ledgerNo: ledger.ledgerNo,
    ledgerType: 'QUALITY_DEDUCTION',
    direction: 'DEDUCTION',
    sourceType: 'FORMAL_QUALITY_DEDUCTION_LEDGER',
    sourceRefId: ledger.ledgerId,
    factoryId: normalizeFactoryId(settlementPartyId),
    factoryName: ledger.factoryName ?? getFactoryById(settlementPartyId)?.name ?? settlementPartyId,
    taskId: ledger.taskId,
    taskNo: getTaskSnapshot(ledger.taskId)?.taskNo ?? ledger.taskId,
    productionOrderId: qcRecord?.productionOrderNo,
    productionOrderNo: getProductionOrderSnapshot(qcRecord?.productionOrderNo)?.legacyOrderNo ?? qcRecord?.productionOrderNo,
    returnInboundBatchId: qcRecord?.returnInboundBatchNo,
    returnInboundBatchNo: qcRecord?.returnInboundBatchNo,
    qcRecordId: ledger.qcId,
    pendingDeductionRecordId: ledger.pendingRecordId,
    disputeId: ledger.disputeId,
    priceSourceType: 'OTHER_COMPAT',
    qty,
    originalCurrency: ledger.originalCurrency,
    originalAmount: ledger.originalAmount,
    settlementCurrency: ledger.settlementCurrency,
    settlementAmount: ledger.settlementAmount,
    fxRate: ledger.fxRate,
    fxAppliedAt: ledger.fxAppliedAt,
    occurredAt: ledger.generatedAt,
    settlementCycleId: cycle.settlementCycleId,
    settlementCycleLabel: cycle.settlementCycleLabel,
    settlementCycleStartAt: cycle.settlementCycleStartAt,
    settlementCycleEndAt: cycle.settlementCycleEndAt,
    settlementProfileVersionNo: settlementProfile?.versionNo,
    statementId: runtimeStatement?.statementId ?? ledger.includedStatementId,
    prepaymentBatchId: runtimeBatch?.batchId ?? ledger.includedPrepaymentBatchId,
    status:
      runtimeBatch?.paymentWritebackId || runtimeBatch?.prepaidAt
        ? 'PREPAID'
        : runtimeBatch
          ? 'IN_PREPAYMENT_BATCH'
          : runtimeStatement
            ? 'IN_STATEMENT'
            : mapQualityLedgerStatus(ledger.status),
    sourceReason:
      disputeCase?.adjudicationResult
        ? '最终裁决后生成正式质量扣款流水'
        : ledger.triggerSource === 'AUTO_CONFIRM'
          ? '系统自动确认后生成正式质量扣款流水'
          : '工厂确认后生成正式质量扣款流水',
    remark: ledger.comment,
  }
}

function sortLedgers(items: PreSettlementLedger[]): PreSettlementLedger[] {
  return [...items].sort((left, right) => {
    if (left.settlementCycleEndAt !== right.settlementCycleEndAt) {
      return left.settlementCycleEndAt < right.settlementCycleEndAt ? 1 : -1
    }
    if (left.factoryName !== right.factoryName) {
      return left.factoryName.localeCompare(right.factoryName, 'zh-CN')
    }
    return right.occurredAt.localeCompare(left.occurredAt, 'zh-CN')
  })
}

export function listPreSettlementLedgers(options: {
  factoryId?: string
  settlementCycleId?: string
  ledgerType?: PreSettlementLedger['ledgerType'] | '__ALL__'
  status?: PreSettlementLedgerStatus | '__ALL__'
  keyword?: string
} = {}): PreSettlementLedger[] {
  const { factoryId, settlementCycleId, ledgerType = '__ALL__', status = '__ALL__', keyword } = options
  const qualityLedgers = listFormalQualityDeductionLedgers({ includeLegacy: false }).map((item) =>
    buildQualityDeductionPreSettlementLedger(item),
  )
  const taskLedgers = initialTaskEarningLedgers.map((item) => buildTaskEarningLedgerRuntime(item))
  const all = sortLedgers([...taskLedgers, ...qualityLedgers])
  const normalizedKeyword = keyword?.trim().toLowerCase() ?? ''

  return all.filter((ledger) => {
    if (factoryId && !isSameFactory(ledger.factoryId, factoryId)) return false
    if (settlementCycleId && ledger.settlementCycleId !== settlementCycleId) return false
    if (ledgerType !== '__ALL__' && ledger.ledgerType !== ledgerType) return false
    if (status !== '__ALL__' && ledger.status !== status) return false
    if (!normalizedKeyword) return true

    const haystack = [
      ledger.ledgerNo,
      ledger.factoryName,
      ledger.taskNo ?? '',
      ledger.returnInboundBatchNo ?? '',
      ledger.qcRecordId ?? '',
      ledger.statementId ?? '',
      ledger.prepaymentBatchId ?? '',
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(normalizedKeyword)
  })
}

export function listStatementEligiblePreSettlementLedgers(
  settlementPartyId?: string,
  settlementCycleId?: string,
): PreSettlementLedger[] {
  return listPreSettlementLedgers({
    factoryId: settlementPartyId,
    settlementCycleId,
    status: 'OPEN',
  })
}

export function getPreSettlementLedgerById(ledgerId: string): PreSettlementLedger | null {
  return listPreSettlementLedgers().find((item) => item.ledgerId === ledgerId || item.ledgerNo === ledgerId) ?? null
}

export function tracePreSettlementLedgerSource(ledgerId: string): PreSettlementLedgerSourceTrace | null {
  const ledger = getPreSettlementLedgerById(ledgerId)
  if (!ledger) return null

  const statement = ledger.statementId
    ? initialStatementDrafts.find((item) => item.statementId === ledger.statementId) ?? null
    : getStatementByTaskLedger(ledger)
  const batch = getBatchByStatement(statement?.statementId) ?? (ledger.prepaymentBatchId
    ? initialSettlementBatches.find((item) => item.batchId === ledger.prepaymentBatchId) ?? null
    : null)
  const settlementProfile = getSettlementEffectiveInfoByFactoryAt(ledger.factoryId, ledger.occurredAt)

  if (ledger.ledgerType === 'QUALITY_DEDUCTION') {
    const trace = traceQualityDeductionLedgerSource(ledger.sourceRefId)
    return {
      ledger,
      settlementProfile,
      statement,
      batch,
      task: getTaskSnapshot(ledger.taskId),
      productionOrder: getProductionOrderSnapshot(ledger.productionOrderId),
      qcRecord: trace?.caseFact.qcRecord ?? null,
      pendingDeductionRecord: trace?.pendingRecord ?? null,
      disputeCase: trace?.disputeCase ?? null,
      formalQualityLedger: getFormalQualityDeductionLedgerById(ledger.sourceRefId),
    }
  }

  return {
    ledger,
    settlementProfile,
    statement,
    batch,
    task: getTaskSnapshot(ledger.taskId),
    productionOrder: getProductionOrderSnapshot(ledger.productionOrderId),
    qcRecord: null,
    pendingDeductionRecord: null,
    disputeCase: null,
    formalQualityLedger: null,
  }
}

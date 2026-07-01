import { getFactoryByCode, getFactoryById } from './indonesia-factories.ts'
import { buildDeductionEntryHrefByBasisId } from './quality-chain-adapter.ts'
import {
  getPreSettlementLedgerById,
  listPreSettlementLedgers,
  listStatementEligiblePreSettlementLedgers,
  listStatementEligiblePreSettlementLedgersByRange,
  tracePreSettlementLedgerSource,
} from './pre-settlement-ledger-repository.ts'
import { processTasks } from './process-tasks.ts'
import { productionOrders } from './production-orders.ts'
import { listPostFinishingQcOrderEntities } from './post-finishing-domain.ts'
import { canStatementEnterPrepayment, initialStatementDrafts } from './store-domain-settlement-seeds.ts'
import {
  calculateProductionOrderSettlementSummary,
  type ProductionOrderSettlementProjection,
  type SettlementDefectReasonLine,
  type SettlementReworkLine,
} from './factory-settlement-reconciliation.ts'
import type { SettlementPartyType } from './store-domain-quality-types.ts'
import type {
  FactoryFeedbackStatus,
  PreSettlementLedger,
  PrepaymentBatchStatus,
  StatementConfirmationSource,
  StatementDeductionLineType,
  StatementDraft,
  StatementDraftItem,
  StatementProxyConfirmationMethod,
  StatementProxyNotificationStatus,
  StatementSettlementObjectMode,
  StatementSourceItemType,
  StatementStatus,
} from './store-domain-settlement-types.ts'

export interface StatementSourceItemViewModel {
  sourceItemId: string
  ledgerNo?: string
  sourceType: StatementSourceItemType
  sourceLabelZh: string
  direction: 'INCOME' | 'DEDUCTION'
  settlementPartyType: SettlementPartyType | string
  settlementPartyId: string
  settlementPartyLabel: string
  productionOrderId?: string
  productionOrderNo?: string
  taskId?: string
  taskNo?: string
  qty: number
  amount: number
  currency: string
  sourceStatus: string
  sourceStatusZh: string
  occurredAt?: string
  createdAt?: string
  updatedAt?: string
  routeToSource: string
  canEnterStatement: boolean
  alreadyBoundStatementId?: string
  sourceReason?: string
  remark?: string
  settlementCycleId: string
  settlementCycleLabel: string
  settlementCycleStartAt: string
  settlementCycleEndAt: string
  plannedPrepaymentAt?: string
  statementLineGrainType:
    | 'RETURN_INBOUND_BATCH'
    | 'NON_BATCH_QUALITY'
    | 'NON_BATCH_ADJUSTMENT'
    | 'OTHER_SOURCE_OBJECT'
  returnInboundBatchId?: string
  returnInboundBatchNo?: string
  returnInboundQty?: number
  qcRecordId?: string
  pendingDeductionRecordId?: string
  basisId?: string
  disputeId?: string
  processLabel?: string
  pricingSourceType: 'DISPATCH' | 'BIDDING' | 'OTHER_COMPAT' | 'NONE'
  pricingSourceRefId?: string
  settlementUnitPrice?: number
  earningAmount: number
  qualityDeductionAmount: number
  carryOverAdjustmentAmount: number
  otherAdjustmentAmount: number
  netAmount: number
}

export interface StatementBuildScopeViewModel {
  settlementPartyType: string
  settlementPartyId: string
  settlementPartyLabel: string
  settlementCycleId: string
  settlementCycleLabel: string
  settlementCycleStartAt: string
  settlementCycleEndAt: string
  plannedPrepaymentAt?: string
  candidateCount: number
  earningLedgerCount: number
  deductionLedgerCount: number
  totalQty: number
  totalEarningAmount: number
  totalDeductionAmount: number
  netPayableAmount: number
}

export interface StatementListItemViewModel {
  statementId: string
  statementNo: string
  settlementPartyType: string
  settlementPartyId: string
  settlementPartyLabel: string
  settlementCycleId?: string
  settlementCycleLabel?: string
  settlementCycleEndAt?: string
  plannedPrepaymentAt?: string
  currency: string
  status: StatementStatus
  factoryFeedbackStatus: FactoryFeedbackStatus
  confirmationSource?: StatementConfirmationSource
  proxyConfirmedAt?: string
  proxyConfirmedBy?: string
  proxyConfirmReason?: string
  proxyConfirmMethod?: StatementProxyConfirmationMethod
  proxyConfirmNotificationStatus?: StatementProxyNotificationStatus
  itemCount: number
  totalQty: number
  totalEarningAmount: number
  totalDeductionAmount: number
  netPayableAmount: number
  createdAt: string
  settlementProfileVersionNo: string
  maskedAccountTail: string
  hasFactoryAppeal: boolean
  prepaymentBatchId?: string
  prepaymentBatchNo?: string
  prepaymentBatchStatus?: PrepaymentBatchStatus
  readyForPrepaymentAt?: string
}

export interface StatementDetailLineViewModel extends StatementDraftItem {
  lineTypeZh: string
  sourceTypeZh: string
  productionOrderNoDisplay: string
  taskNoDisplay: string
  routeToSourceResolved: string
}

export interface StatementDetailViewModel {
  draft: StatementDraft
  settlementPartyLabel: string
  maskedAccountNo: string
  totalEarningAmount: number
  totalQualityDeductionAmount: number
  netPayableAmount: number
  totalQty: number
  hasFactoryAppeal: boolean
  sourceTypeSummary: string
  lines: StatementDetailLineViewModel[]
  earningLines: StatementDetailLineViewModel[]
  deductionLines: StatementDetailLineViewModel[]
}

export interface StatementConfirmedDeductionRow {
  statementId: string
  statementNo: string
  factoryId: string
  factoryName: string
  productionOrderNo?: string
  deductionLineType: StatementDeductionLineType
  deductionLineTypeLabel: string
  reasonName?: string
  qty: number
  amount: number
  currency: string
  occurredAt: string
  sourceQcRecordId?: string
  sourceRefLabel?: string
  includedPrepaymentBatchId?: string
}

const SOURCE_LABEL_ZH: Record<StatementSourceItemType, string> = {
  TASK_EARNING: '任务收入流水',
  QUALITY_DEDUCTION: '质量扣款流水',
}

const DEDUCTION_LINE_TYPE_LABEL: Record<StatementDeductionLineType, string> = {
  QUALITY_DEFECT: '质量扣款',
  POST_FACTORY_REWORK_CHARGEBACK: '后道返工反扣',
  DELAY: '延误扣款',
  OTHER_ADJUSTMENT: '其他调整',
}

const LEDGER_STATUS_ZH: Record<PreSettlementLedger['status'], string> = {
  OPEN: '待入对账单',
  IN_STATEMENT: '已入对账单',
  IN_PREPAYMENT_BATCH: '已入预付款批次',
  PREPAID: '已预付',
  RESERVED_FOR_FINAL_SETTLEMENT: '保留到后续分账',
}

const PARTY_TYPE_ZH: Record<string, string> = {
  FACTORY: '工厂',
  PROCESSOR: '加工方',
  SUPPLIER: '供应商',
  GROUP_INTERNAL: '内部主体',
  INTERNAL: '内部主体',
  OTHER: '其他',
}

function buildPartyLabel(type?: string, id?: string): string {
  if (!type || !id) return '-'
  if (type === 'FACTORY') {
    const factory = getFactoryById(id) ?? getFactoryByCode(id)
    if (factory) return factory.name
  }
  return `${PARTY_TYPE_ZH[type] ?? type} / ${id}`
}

function maskBankAccountNo(accountNo: string): string {
  const raw = accountNo.replace(/\s+/g, '')
  if (raw.length <= 8) return raw
  return `${raw.slice(0, 4)} **** **** ${raw.slice(-4)}`
}

function getTaskSnapshot(taskId?: string) {
  if (!taskId) return null
  return processTasks.find((item) => item.taskId === taskId) ?? null
}

function getProductionOrderSnapshot(productionOrderId?: string) {
  if (!productionOrderId) return null
  return productionOrders.find((item) => item.productionOrderId === productionOrderId) ?? null
}

function parseQty(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value !== 'string') return 0
  const parsed = Number(value.replace(/,/g, '').match(/-?\d+(\.\d+)?/)?.[0] ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function resolveCuttingCompletedQtyFromOrder(productionOrderNo: string): number | null {
  const order = productionOrders.find((item) => item.productionOrderNo === productionOrderNo)
  const cuttingRow = order?.ledgerDetails.quantityQuality.find((item) => item.quantityType === '裁片完成')
  if (!cuttingRow) return null
  return parseQty(cuttingRow.currentQty)
}

function resolvePostFinishingReworkLines(_productionOrderNo: string): SettlementReworkLine[] {
  return listPostFinishingQcOrderEntities()
    .filter((qc) => qc.productionOrderNo === _productionOrderNo)
    .flatMap((qc) =>
      qc.qcSkuResults
        .filter((result) => result.reworkQty > 0)
        .map((result) => {
          const receiveFactoryId = result.reworkReceiveFactoryId || qc.reworkReceiveFactoryId
          const receiveFactoryName = result.reworkReceiveFactoryName || qc.reworkReceiveFactoryName
          const receiveObject =
            !receiveFactoryId && !receiveFactoryName
              ? 'ORIGINAL_FACTORY'
              : receiveFactoryId === qc.sourceFactoryId || receiveFactoryName === qc.sourceFactoryName
                ? 'ORIGINAL_FACTORY'
                : 'POST_FACTORY'
          return {
            qcOrderId: qc.qcOrderId,
            receiveObject,
            reworkQty: result.reworkQty,
          }
        }),
    )
}

function resolvePostFinishingDefectReasonLines(_productionOrderNo: string): SettlementDefectReasonLine[] {
  return listPostFinishingQcOrderEntities()
    .filter((qc) => qc.productionOrderNo === _productionOrderNo)
    .flatMap((qc) =>
      qc.qcSkuResults.flatMap((result) =>
        result.defectReasonItems
          .filter((item) => item.qty > 0)
          .map((item) => ({
            reasonName: item.reasonName,
            qty: item.qty,
          })),
      ),
    )
}

function normalizeSettlementPartyId(partyId: string): string {
  const factory = getFactoryById(partyId) ?? getFactoryByCode(partyId)
  return factory?.id ?? partyId
}

function isSameSettlementParty(left: string, right: string): boolean {
  return normalizeSettlementPartyId(left) === normalizeSettlementPartyId(right)
}

function normalizeLedgerPriceSource(
  priceSourceType: PreSettlementLedger['priceSourceType'],
): StatementSourceItemViewModel['pricingSourceType'] {
  if (priceSourceType === 'BID') return 'BIDDING'
  if (priceSourceType === 'DISPATCH') return 'DISPATCH'
  return 'OTHER_COMPAT'
}

function buildTaskLedgerHref(ledger: PreSettlementLedger): string {
  if (ledger.taskId) return `/fcs/pda/task-receive/${encodeURIComponent(ledger.taskId)}`
  if (ledger.returnInboundBatchId) return `/fcs/pda/task-receive/${encodeURIComponent(ledger.returnInboundBatchId)}`
  return '/fcs/settlement/adjustments'
}

function buildQualityLedgerHref(ledger: PreSettlementLedger): string {
  const trace = tracePreSettlementLedgerSource(ledger.ledgerId)
  if (trace?.pendingDeductionRecord?.basisId) {
    return buildDeductionEntryHrefByBasisId(trace.pendingDeductionRecord.basisId)
  }
  if (ledger.qcRecordId) {
    return `/fcs/quality/qc-records/${encodeURIComponent(ledger.qcRecordId)}`
  }
  return '/fcs/quality/qc-records'
}

function resolveQualityLedgerBasisId(ledger: PreSettlementLedger): string | undefined {
  return tracePreSettlementLedgerSource(ledger.ledgerId)?.pendingDeductionRecord?.basisId
}

function getStatementBindingMap(): Map<string, string> {
  const map = new Map<string, string>()
  for (const statement of initialStatementDrafts) {
    if (statement.status === 'CLOSED') continue
    for (const item of statement.items) {
      const bindingKey = item.sourceItemId ?? item.basisId
      if (bindingKey) {
        map.set(bindingKey, statement.statementId)
      }
    }
    for (const sourceId of statement.itemSourceIds ?? []) {
      if (!map.has(sourceId)) map.set(sourceId, statement.statementId)
    }
  }
  return map
}

function sortSourceItems<T extends { settlementCycleEndAt?: string; occurredAt?: string; createdAt?: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftCycle = left.settlementCycleEndAt ?? ''
    const rightCycle = right.settlementCycleEndAt ?? ''
    if (leftCycle !== rightCycle) return leftCycle < rightCycle ? 1 : -1
    const leftTime = left.occurredAt ?? left.createdAt ?? ''
    const rightTime = right.occurredAt ?? right.createdAt ?? ''
    return leftTime < rightTime ? 1 : leftTime > rightTime ? -1 : 0
  })
}

function mapLedgerToStatementSourceItem(
  ledger: PreSettlementLedger,
  bindingMap: Map<string, string>,
): StatementSourceItemViewModel {
  const trace = tracePreSettlementLedgerSource(ledger.ledgerId)
  const alreadyBoundStatementId = ledger.statementId ?? bindingMap.get(ledger.ledgerId)
  const canEnterStatement = ledger.status === 'OPEN' && !alreadyBoundStatementId

  if (ledger.ledgerType === 'TASK_EARNING') {
    return {
      sourceItemId: ledger.ledgerId,
      ledgerNo: ledger.ledgerNo,
      sourceType: 'TASK_EARNING',
      sourceLabelZh: SOURCE_LABEL_ZH.TASK_EARNING,
      direction: 'INCOME',
      settlementPartyType: 'FACTORY',
      settlementPartyId: ledger.factoryId,
      settlementPartyLabel: buildPartyLabel('FACTORY', ledger.factoryId),
      productionOrderId: ledger.productionOrderId,
      productionOrderNo: ledger.productionOrderNo,
      taskId: ledger.taskId,
      taskNo: ledger.taskNo,
      qty: ledger.qty,
      amount: ledger.settlementAmount,
      currency: ledger.settlementCurrency,
      sourceStatus: ledger.status,
      sourceStatusZh: LEDGER_STATUS_ZH[ledger.status],
      occurredAt: ledger.occurredAt,
      createdAt: ledger.occurredAt,
      updatedAt: ledger.occurredAt,
      routeToSource: buildTaskLedgerHref(ledger),
      canEnterStatement,
      alreadyBoundStatementId,
      sourceReason: ledger.sourceReason ?? '按派单价或竞价中标价与回货数量生成正式任务收入流水',
      remark: ledger.remark,
      settlementCycleId: ledger.settlementCycleId,
      settlementCycleLabel: ledger.settlementCycleLabel,
      settlementCycleStartAt: ledger.settlementCycleStartAt,
      settlementCycleEndAt: ledger.settlementCycleEndAt,
      plannedPrepaymentAt: ledger.plannedPrepaymentAt,
      statementLineGrainType: 'RETURN_INBOUND_BATCH',
      returnInboundBatchId: ledger.returnInboundBatchId,
      returnInboundBatchNo: ledger.returnInboundBatchNo,
      returnInboundQty: ledger.qty,
      qcRecordId: undefined,
      pendingDeductionRecordId: undefined,
      disputeId: undefined,
      processLabel: trace?.qcRecord?.processLabel,
      pricingSourceType: normalizeLedgerPriceSource(ledger.priceSourceType),
      pricingSourceRefId: ledger.sourceRefId,
      settlementUnitPrice: ledger.unitPrice,
      earningAmount: ledger.settlementAmount,
      qualityDeductionAmount: 0,
      carryOverAdjustmentAmount: 0,
      otherAdjustmentAmount: 0,
      netAmount: ledger.settlementAmount,
    }
  }

  const basisId = resolveQualityLedgerBasisId(ledger)

  return {
    sourceItemId: ledger.ledgerId,
    ledgerNo: ledger.ledgerNo,
    sourceType: 'QUALITY_DEDUCTION',
    sourceLabelZh: SOURCE_LABEL_ZH.QUALITY_DEDUCTION,
    direction: 'DEDUCTION',
    settlementPartyType: 'FACTORY',
    settlementPartyId: ledger.factoryId,
    settlementPartyLabel: buildPartyLabel('FACTORY', ledger.factoryId),
    productionOrderId: ledger.productionOrderId,
    productionOrderNo: ledger.productionOrderNo,
    taskId: ledger.taskId,
    taskNo: ledger.taskNo,
    qty: ledger.qty,
    amount: ledger.settlementAmount,
    currency: ledger.settlementCurrency,
    sourceStatus: ledger.status,
    sourceStatusZh: LEDGER_STATUS_ZH[ledger.status],
    occurredAt: ledger.occurredAt,
    createdAt: ledger.occurredAt,
    updatedAt: ledger.occurredAt,
    routeToSource: buildQualityLedgerHref(ledger),
    canEnterStatement,
    alreadyBoundStatementId,
    sourceReason: ledger.sourceReason ?? '正式质量扣款流水',
    remark: ledger.remark,
    settlementCycleId: ledger.settlementCycleId,
    settlementCycleLabel: ledger.settlementCycleLabel,
    settlementCycleStartAt: ledger.settlementCycleStartAt,
    settlementCycleEndAt: ledger.settlementCycleEndAt,
    plannedPrepaymentAt: ledger.plannedPrepaymentAt,
    statementLineGrainType: ledger.returnInboundBatchId ? 'RETURN_INBOUND_BATCH' : 'NON_BATCH_QUALITY',
    returnInboundBatchId: ledger.returnInboundBatchId,
    returnInboundBatchNo: ledger.returnInboundBatchNo,
    returnInboundQty: ledger.qty,
    qcRecordId: ledger.qcRecordId,
    pendingDeductionRecordId: ledger.pendingDeductionRecordId,
    basisId,
    disputeId: ledger.disputeId,
    processLabel: trace?.qcRecord?.processLabel,
    pricingSourceType: trace?.task ? 'OTHER_COMPAT' : 'NONE',
    pricingSourceRefId: ledger.sourceRefId,
    settlementUnitPrice: undefined,
    earningAmount: 0,
    qualityDeductionAmount: ledger.settlementAmount,
    carryOverAdjustmentAmount: 0,
    otherAdjustmentAmount: 0,
    netAmount: -ledger.settlementAmount,
  }
}

function summarizeStatementLines(items: Array<Pick<StatementDraftItem, 'sourceItemType' | 'returnInboundQty' | 'deductionQty' | 'earningAmount' | 'qualityDeductionAmount' | 'netAmount' | 'deductionAmount'>>): {
  totalQty: number
  totalEarningAmount: number
  totalDeductionAmount: number
  netPayableAmount: number
} {
  return {
    totalQty: items.reduce((sum, item) => sum + (item.returnInboundQty ?? item.deductionQty ?? 0), 0),
    totalEarningAmount: items.reduce((sum, item) => sum + (item.earningAmount ?? 0), 0),
    totalDeductionAmount: items.reduce((sum, item) => sum + (item.qualityDeductionAmount ?? 0), 0),
    netPayableAmount: items.reduce((sum, item) => sum + (item.netAmount ?? item.deductionAmount ?? 0), 0),
  }
}

function getStatementSourceTypeSummary(items: StatementDraftItem[]): string {
  const summaryMap = new Map<string, number>()
  for (const item of items) {
    const label = item.sourceLabelZh ?? SOURCE_LABEL_ZH[item.sourceItemType] ?? item.sourceItemType
    summaryMap.set(label, (summaryMap.get(label) ?? 0) + 1)
  }

  return Array.from(summaryMap.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([label, count]) => `${label} ${count}条`)
    .join(' / ')
}

function getStatementLineTypeZh(item: StatementDraftItem): string {
  if (item.statementLineGrainType === 'RETURN_INBOUND_BATCH') return '回货批次行'
  if (item.statementLineGrainType === 'NON_BATCH_QUALITY') return '质量扣款流水行'
  if (item.statementLineGrainType === 'NON_BATCH_ADJUSTMENT') return '兼容来源行'
  return '其它来源行'
}

function buildStatementDetailLine(item: StatementDraftItem): StatementDetailLineViewModel {
  const task = getTaskSnapshot(item.taskId)
  const order = getProductionOrderSnapshot(item.productionOrderId)
  const sourceTypeZh = item.sourceLabelZh ?? SOURCE_LABEL_ZH[item.sourceItemType] ?? item.sourceItemType

  return {
    ...item,
    lineTypeZh: getStatementLineTypeZh(item),
    sourceTypeZh,
    productionOrderNoDisplay: item.productionOrderNo ?? order?.legacyOrderNo ?? item.productionOrderId ?? '-',
    taskNoDisplay: item.taskNo ?? task?.taskNo ?? item.taskId ?? '-',
    routeToSourceResolved: item.routeToSource ?? '/fcs/settlement/statements',
  }
}

export function listStatementSourceItems(): StatementSourceItemViewModel[] {
  const bindingMap = getStatementBindingMap()
  return sortSourceItems(listPreSettlementLedgers().map((ledger) => mapLedgerToStatementSourceItem(ledger, bindingMap)))
}

export function listStatementConfirmedDeductionRows(): StatementConfirmedDeductionRow[] {
  return initialStatementDrafts
    .filter((statement) => canStatementEnterPrepayment(statement))
    .flatMap((statement) =>
      statement.items
      .filter((item) => item.sourceItemType === 'QUALITY_DEDUCTION')
      .flatMap((item) => {
        const amount = Math.abs(item.qualityDeductionAmount ?? item.deductionAmount ?? 0)
        if (amount <= 0) return []
        const type = item.deductionLineType ?? 'QUALITY_DEFECT'
        return [
          {
            statementId: statement.statementId,
            statementNo: statement.statementNo ?? statement.statementId,
            factoryId: statement.settlementPartyId,
            factoryName: statement.factoryName ?? buildPartyLabel(statement.settlementPartyType, statement.settlementPartyId),
            productionOrderNo: item.productionOrderNo,
            deductionLineType: type,
            deductionLineTypeLabel: DEDUCTION_LINE_TYPE_LABEL[type],
            reasonName: item.remark,
            qty: item.deductionQty ?? item.returnInboundQty ?? 0,
            amount,
            currency:
              item.currency ??
              statement.settlementCurrency ??
              statement.settlementProfileSnapshot.settlementConfigSnapshot.currency,
            occurredAt: item.occurredAt ?? statement.createdAt,
            sourceQcRecordId: item.qcRecordId,
            sourceRefLabel: item.sourceRefLabel,
            includedPrepaymentBatchId: statement.prepaymentBatchId,
          },
        ]
      }),
    )
}

export function listStatementBuildScopes(): StatementBuildScopeViewModel[] {
  const scopeMap = new Map<string, StatementBuildScopeViewModel>()

  for (const item of listStatementEligiblePreSettlementLedgers().map((ledger) =>
    mapLedgerToStatementSourceItem(ledger, new Map()),
  )) {
    const key = `${normalizeSettlementPartyId(item.settlementPartyId)}__${item.settlementCycleId}`
    const existed = scopeMap.get(key)
    if (existed) {
      existed.candidateCount += 1
      if (item.sourceType === 'TASK_EARNING') existed.earningLedgerCount += 1
      if (item.sourceType === 'QUALITY_DEDUCTION') existed.deductionLedgerCount += 1
      existed.totalQty += item.qty
      existed.totalEarningAmount += item.earningAmount
      existed.totalDeductionAmount += item.qualityDeductionAmount
      existed.netPayableAmount += item.netAmount
      existed.plannedPrepaymentAt = existed.plannedPrepaymentAt ?? item.plannedPrepaymentAt
      continue
    }
    scopeMap.set(key, {
      settlementPartyType: String(item.settlementPartyType),
      settlementPartyId: item.settlementPartyId,
      settlementPartyLabel: item.settlementPartyLabel,
      settlementCycleId: item.settlementCycleId,
      settlementCycleLabel: item.settlementCycleLabel,
      settlementCycleStartAt: item.settlementCycleStartAt,
      settlementCycleEndAt: item.settlementCycleEndAt,
      plannedPrepaymentAt: item.plannedPrepaymentAt,
      candidateCount: 1,
      earningLedgerCount: item.sourceType === 'TASK_EARNING' ? 1 : 0,
      deductionLedgerCount: item.sourceType === 'QUALITY_DEDUCTION' ? 1 : 0,
      totalQty: item.qty,
      totalEarningAmount: item.earningAmount,
      totalDeductionAmount: item.qualityDeductionAmount,
      netPayableAmount: item.netAmount,
    })
  }

  return [...scopeMap.values()].sort((left, right) => {
    if (left.settlementCycleEndAt !== right.settlementCycleEndAt) {
      return left.settlementCycleEndAt < right.settlementCycleEndAt ? 1 : -1
    }
    return left.settlementPartyLabel.localeCompare(right.settlementPartyLabel, 'zh-CN')
  })
}

export function listStatementBuildCandidates(
  settlementPartyId: string,
  settlementCycleId: string,
): StatementSourceItemViewModel[] {
  return listStatementSourceItems().filter(
    (item) =>
      item.canEnterStatement &&
      item.settlementPartyType === 'FACTORY' &&
      isSameSettlementParty(item.settlementPartyId, settlementPartyId) &&
      item.settlementCycleId === settlementCycleId,
  )
}

export function listStatementEligibleLedgers(
  settlementPartyId: string,
  settlementCycleId: string,
): StatementSourceItemViewModel[] {
  return listStatementBuildCandidates(settlementPartyId, settlementCycleId)
}

export function toStatementDraftItemFromSource(item: StatementSourceItemViewModel): StatementDraftItem {
  return {
    ledgerNo: item.ledgerNo,
    sourceItemId: item.sourceItemId,
    sourceItemType: item.sourceType,
    direction: item.direction,
    sourceLabelZh: item.sourceLabelZh,
    sourceRefLabel: item.sourceItemId,
    routeToSource: item.routeToSource,
    settlementPartyType: item.settlementPartyType,
    settlementPartyId: item.settlementPartyId,
    basisId: item.basisId ?? item.sourceItemId,
    deductionQty: item.qty,
    deductionAmount: item.netAmount,
    currency: item.currency,
    remark: item.remark,
    sourceType: item.sourceType,
    productionOrderId: item.productionOrderId,
    productionOrderNo: item.productionOrderNo,
    taskId: item.taskId,
    taskNo: item.taskNo,
    settlementCycleId: item.settlementCycleId,
    settlementCycleLabel: item.settlementCycleLabel,
    settlementCycleStartAt: item.settlementCycleStartAt,
    settlementCycleEndAt: item.settlementCycleEndAt,
    plannedPrepaymentAt: item.plannedPrepaymentAt,
    statementLineGrainType: item.statementLineGrainType,
    returnInboundBatchId: item.returnInboundBatchId,
    returnInboundBatchNo: item.returnInboundBatchNo,
    returnInboundQty: item.returnInboundQty,
    qcRecordId: item.qcRecordId,
    pendingDeductionRecordId: item.pendingDeductionRecordId,
    disputeId: item.disputeId,
    processLabel: item.processLabel,
    pricingSourceType:
      item.pricingSourceType === 'OTHER_COMPAT'
        ? 'NONE'
        : item.pricingSourceType,
    pricingSourceRefId: item.pricingSourceRefId,
    settlementUnitPrice: item.settlementUnitPrice,
    earningAmount: item.earningAmount,
    qualityDeductionAmount: item.qualityDeductionAmount,
    carryOverAdjustmentAmount: item.carryOverAdjustmentAmount,
    otherAdjustmentAmount: item.otherAdjustmentAmount,
    netAmount: item.netAmount,
    occurredAt: item.occurredAt ?? item.createdAt,
  }
}

export function buildStatementDraftLines(
  settlementPartyId: string,
  settlementCycleId: string,
): StatementDraftItem[] {
  return listStatementBuildCandidates(settlementPartyId, settlementCycleId)
    .map((item) => toStatementDraftItemFromSource(item))
    .sort((left, right) => {
      const leftIsBatch = left.statementLineGrainType === 'RETURN_INBOUND_BATCH' ? 0 : 1
      const rightIsBatch = right.statementLineGrainType === 'RETURN_INBOUND_BATCH' ? 0 : 1
      if (leftIsBatch !== rightIsBatch) return leftIsBatch - rightIsBatch
      return (left.returnInboundBatchNo ?? left.sourceRefLabel ?? '').localeCompare(
        right.returnInboundBatchNo ?? right.sourceRefLabel ?? '',
        'zh-CN',
      )
    })
}

export function buildProductionOrderSettlementProjections(input: {
  factoryId: string
  occurredFrom: string
  occurredTo: string
}): ProductionOrderSettlementProjection[] {
  const ledgers = listStatementEligiblePreSettlementLedgersByRange({
    factoryId: input.factoryId,
    occurredFrom: input.occurredFrom,
    occurredTo: input.occurredTo,
  })
  const productionOrderNos = Array.from(
    new Set(ledgers.map((item) => item.productionOrderNo).filter(Boolean)),
  ) as string[]

  return productionOrderNos.map((productionOrderNo) => {
    const orderLedgers = ledgers.filter((item) => item.productionOrderNo === productionOrderNo)
    const normalHandoverQty = orderLedgers
      .filter((item) => item.ledgerType === 'TASK_EARNING')
      .reduce((sum, item) => sum + item.qty, 0)
    const cuttingCompletedQtyFromOrder = resolveCuttingCompletedQtyFromOrder(productionOrderNo)
    const hasCompletionBasis = cuttingCompletedQtyFromOrder != null || normalHandoverQty > 0
    const cuttingCompletedQty = cuttingCompletedQtyFromOrder ?? normalHandoverQty
    const summary = calculateProductionOrderSettlementSummary({
      cuttingCompletedQty,
      handoverLines: orderLedgers.map((item) => ({
        recordId: item.returnInboundBatchNo ?? item.ledgerId,
        handedOverAt: item.occurredAt,
        handedOverQty: item.ledgerType === 'TASK_EARNING' ? item.qty : 0,
      })),
      reworkLines: resolvePostFinishingReworkLines(productionOrderNo),
      defectReasonLines: resolvePostFinishingDefectReasonLines(productionOrderNo),
    })
    const isComplete = hasCompletionBasis && summary.isComplete

    return {
      productionOrderNo,
      productionOrderId: orderLedgers.find((item) => item.productionOrderId)?.productionOrderId,
      ...summary,
      isComplete,
      includedInStatement: isComplete,
      excludedReason: isComplete
        ? undefined
        : hasCompletionBasis
          ? `差 ${summary.shortageQty} 件`
          : '缺少裁片完成数量和交出流水',
      handoverDetailLines: orderLedgers.map((item) => ({
        recordId: item.returnInboundBatchNo ?? item.ledgerId,
        handedOverAt: item.occurredAt,
        handedOverQty: item.ledgerType === 'TASK_EARNING' ? item.qty : 0,
        qcOrderId: item.qcRecordId,
      })),
    }
  })
}

export function buildStatementDraftLinesFromSettlementSelection(input: {
  factoryId: string
  occurredFrom: string
  occurredTo: string
  objectMode: StatementSettlementObjectMode
  selectedLedgerIds?: string[]
  selectedProductionOrderNos?: string[]
}): StatementDraftItem[] {
  const ledgers = listStatementEligiblePreSettlementLedgersByRange({
    factoryId: input.factoryId,
    occurredFrom: input.occurredFrom,
    occurredTo: input.occurredTo,
  })
  const selected = input.objectMode === 'LEDGER'
    ? ledgers.filter((item) => input.selectedLedgerIds?.includes(item.ledgerId))
    : ledgers.filter((item) => input.selectedProductionOrderNos?.includes(item.productionOrderNo ?? ''))
  const bindingMap = getStatementBindingMap()

  return selected.map((ledger) => ({
    ...toStatementDraftItemFromSource(mapLedgerToStatementSourceItem(ledger, bindingMap)),
    settlementObjectMode: input.objectMode,
    sourceConfirmedByStatement: true,
  }))
}

export function getStatementListItems(): StatementListItemViewModel[] {
  return [...initialStatementDrafts]
    .filter((draft) => draft.settlementPartyType === 'FACTORY')
    .sort((left, right) => {
      const leftCycle = left.settlementCycleEndAt ?? ''
      const rightCycle = right.settlementCycleEndAt ?? ''
      if (leftCycle !== rightCycle) return leftCycle < rightCycle ? 1 : -1
      return left.createdAt < right.createdAt ? 1 : left.createdAt > right.createdAt ? -1 : 0
    })
    .map((draft) => {
      const totals = summarizeStatementLines(draft.items)
      return {
        statementId: draft.statementId,
        statementNo: draft.statementNo ?? draft.statementId,
        settlementPartyType: draft.settlementPartyType,
        settlementPartyId: draft.settlementPartyId,
        settlementPartyLabel: draft.factoryName ?? buildPartyLabel(draft.settlementPartyType, draft.settlementPartyId),
        settlementCycleId: draft.settlementCycleId,
        settlementCycleLabel: draft.settlementCycleLabel,
        settlementCycleEndAt: draft.settlementCycleEndAt,
        plannedPrepaymentAt: draft.plannedPrepaymentAt,
        currency: draft.settlementCurrency ?? draft.settlementProfileSnapshot.settlementConfigSnapshot.currency,
        status: draft.status,
        factoryFeedbackStatus: draft.factoryFeedbackStatus,
        confirmationSource: draft.confirmationSource,
        proxyConfirmedAt: draft.proxyConfirmedAt,
        proxyConfirmedBy: draft.proxyConfirmedBy,
        proxyConfirmReason: draft.proxyConfirmReason,
        proxyConfirmMethod: draft.proxyConfirmMethod,
        proxyConfirmNotificationStatus: draft.proxyConfirmNotificationStatus,
        itemCount: draft.itemCount,
        totalQty: draft.totalQty,
        totalEarningAmount: draft.totalEarningAmount ?? totals.totalEarningAmount,
        totalDeductionAmount: draft.totalDeductionAmount ?? totals.totalDeductionAmount,
        netPayableAmount: draft.netPayableAmount ?? totals.netPayableAmount,
        createdAt: draft.createdAt,
        settlementProfileVersionNo: draft.settlementProfileVersionNo,
        maskedAccountTail: maskBankAccountNo(draft.settlementProfileSnapshot.receivingAccountSnapshot.bankAccountNo),
        hasFactoryAppeal: Boolean(draft.factoryAppealRecord || draft.appealRecords?.length),
        prepaymentBatchId: draft.prepaymentBatchId,
        prepaymentBatchNo: draft.prepaymentBatchNo,
        prepaymentBatchStatus: draft.prepaymentBatchStatus,
        readyForPrepaymentAt: draft.readyForPrepaymentAt,
      }
    })
}

export function getStatementDetailViewModel(statementId: string): StatementDetailViewModel | null {
  const draft = initialStatementDrafts.find((item) => item.statementId === statementId)
  if (!draft) return null

  const lines = draft.items
    .map((item) => buildStatementDetailLine(item))
    .sort((left, right) => {
      const leftBatch = left.returnInboundBatchNo ?? ''
      const rightBatch = right.returnInboundBatchNo ?? ''
      if (left.statementLineGrainType !== right.statementLineGrainType) {
        return left.statementLineGrainType === 'RETURN_INBOUND_BATCH' ? -1 : 1
      }
      if (leftBatch !== rightBatch) return leftBatch.localeCompare(rightBatch, 'zh-CN')
      return left.sourceItemId.localeCompare(right.sourceItemId, 'zh-CN')
    })

  const totals = summarizeStatementLines(lines)
  return {
    draft,
    settlementPartyLabel: draft.factoryName ?? buildPartyLabel(draft.settlementPartyType, draft.settlementPartyId),
    maskedAccountNo: maskBankAccountNo(draft.settlementProfileSnapshot.receivingAccountSnapshot.bankAccountNo),
    totalEarningAmount: draft.totalEarningAmount ?? totals.totalEarningAmount,
    totalQualityDeductionAmount: draft.totalDeductionAmount ?? totals.totalDeductionAmount,
    netPayableAmount: draft.netPayableAmount ?? totals.netPayableAmount,
    totalQty: draft.totalQty ?? totals.totalQty,
    hasFactoryAppeal: Boolean(draft.factoryAppealRecord || draft.appealRecords?.length),
    sourceTypeSummary: getStatementSourceTypeSummary(draft.items),
    lines,
    earningLines: lines.filter((item) => item.sourceItemType === 'TASK_EARNING'),
    deductionLines: lines.filter((item) => item.sourceItemType === 'QUALITY_DEDUCTION'),
  }
}

export function getStatementSourceItemById(sourceItemId: string): StatementSourceItemViewModel | undefined {
  const direct = listStatementSourceItems().find((item) => item.sourceItemId === sourceItemId)
  if (direct) return direct
  const ledger = getPreSettlementLedgerById(sourceItemId)
  if (!ledger) return undefined
  return mapLedgerToStatementSourceItem(ledger, getStatementBindingMap())
}

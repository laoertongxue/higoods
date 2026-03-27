import type { ReturnInboundProcessType } from './store-domain-quality-types.ts'
import { listQualityDeductionCaseFacts } from './quality-deduction-repository.ts'
import { parseQualityDeductionTimestamp } from './quality-deduction-lifecycle.ts'
import { buildDeductionEntryHrefByBasisId } from './quality-chain-adapter.ts'
import type {
  QualityDeductionCaseFact,
  QualityDeductionDisputeStatus,
  QualityDeductionFactoryResponseStatus,
  QualityDeductionLiabilityStatus,
  QualityDeductionQcResult,
  QualityDeductionSettlementImpactStatus,
} from './quality-deduction-domain.ts'
import {
  QUALITY_DEDUCTION_DISPUTE_STATUS_LABEL,
  QUALITY_DEDUCTION_FACTORY_RESPONSE_STATUS_LABEL,
  QUALITY_DEDUCTION_LIABILITY_STATUS_LABEL,
  QUALITY_DEDUCTION_QC_RESULT_LABEL,
  QUALITY_DEDUCTION_SETTLEMENT_IMPACT_STATUS_LABEL,
} from './quality-deduction-selectors.ts'

export type QualityDeductionAnalysisTimeBasis = 'FINANCIAL_EFFECTIVE' | 'SETTLEMENT_CYCLE'

export type QualityDeductionAnalysisDimension =
  | 'FACTORY'
  | 'PROCESS'
  | 'WAREHOUSE'
  | 'QC_RESULT'
  | 'LIABILITY_STATUS'
  | 'FACTORY_RESPONSE_STATUS'
  | 'DISPUTE_STATUS'
  | 'SETTLEMENT_IMPACT_STATUS'

export interface QualityDeductionAnalysisQuery {
  keyword: string
  timeBasis: QualityDeductionAnalysisTimeBasis
  startDate: string
  endDate: string
  factoryId: string
  processType: string
  warehouseId: string
  qcResult: 'ALL' | QualityDeductionQcResult
  liabilityStatus: 'ALL' | QualityDeductionLiabilityStatus
  factoryResponseStatus: 'ALL' | QualityDeductionFactoryResponseStatus
  disputeStatus: 'ALL' | QualityDeductionDisputeStatus
  settlementImpactStatus: 'ALL' | QualityDeductionSettlementImpactStatus
  hasAdjustment: 'ALL' | 'YES' | 'NO'
  includedInStatement: 'ALL' | 'YES' | 'NO'
  settled: 'ALL' | 'YES' | 'NO'
  drilldownDimension?: QualityDeductionAnalysisDimension
  drilldownValue?: string
}

export interface QualityDeductionAnalysisFilterOption {
  value: string
  label: string
  count: number
}

export interface QualityDeductionAnalysisFilterOptions {
  factories: QualityDeductionAnalysisFilterOption[]
  processes: QualityDeductionAnalysisFilterOption[]
  warehouses: QualityDeductionAnalysisFilterOption[]
}

export interface QualityDeductionAnalysisKpis {
  qcRecordCount: number
  factoryCount: number
  blockedProcessingFeeAmount: number
  effectiveQualityDeductionAmount: number
  totalFinancialImpactAmount: number
  nextCycleAdjustmentAmount: number
  disputingAmount: number
  settledAmount: number
  includedAmount: number
}

export interface QualityDeductionAnalysisTrendPoint {
  key: string
  label: string
  recordCount: number
  blockedProcessingFeeAmount: number
  effectiveQualityDeductionAmount: number
  totalFinancialImpactAmount: number
  adjustmentAmount: number
  sortAt: string
}

export interface QualityDeductionAnalysisBreakdownRow {
  dimension: QualityDeductionAnalysisDimension
  key: string
  label: string
  recordCount: number
  blockedProcessingFeeAmount: number
  effectiveQualityDeductionAmount: number
  totalFinancialImpactAmount: number
  adjustmentAmount: number
  shareRate: number
}

export interface QualityDeductionAnalysisDetailRow {
  qcId: string
  qcNo: string
  basisId?: string
  productionOrderNo: string
  returnInboundBatchNo: string
  factoryId: string
  factoryName: string
  warehouseId: string
  warehouseName: string
  processType: ReturnInboundProcessType
  processLabel: string
  qcResult: QualityDeductionQcResult
  qcResultLabel: string
  liabilityStatus: QualityDeductionLiabilityStatus
  liabilityStatusLabel: string
  factoryResponseStatus: QualityDeductionFactoryResponseStatus
  factoryResponseStatusLabel: string
  disputeStatus: QualityDeductionDisputeStatus
  disputeStatusLabel: string
  settlementImpactStatus: QualityDeductionSettlementImpactStatus
  settlementImpactStatusLabel: string
  inspectedQty: number
  qualifiedQty: number
  unqualifiedQty: number
  factoryLiabilityQty: number
  blockedProcessingFeeAmount: number
  effectiveQualityDeductionAmount: number
  totalFinancialImpactAmount: number
  hasAdjustment: boolean
  adjustmentType?: string
  adjustmentTypeLabel?: string
  adjustmentAmount: number
  adjustmentAmountSigned: number
  targetSettlementCycleId?: string
  includedSettlementStatementId?: string
  includedSettlementBatchId?: string
  financialEffectiveAt?: string
  settlementCycleAt?: string
  settlementCycleLabel?: string
  displayTimeLabel: string
  detailSummary: string
  qcHref: string
  deductionHref?: string
}

export interface QualityDeductionAnalysisExportRow {
  质检单号: string
  回货批次号: string
  生产单号: string
  工厂: string
  工序: string
  质检结果: string
  工厂责任数量: number
  工厂处理状态: string
  异议状态: string
  结算影响状态: string
  冻结加工费金额: number
  正式质量扣款流水金额: number
  总财务影响金额: number
  兼容占位类型: string
  兼容占位金额: number
  统计时间: string
  结算周期: string
  扣款依据编号: string
}

export const QUALITY_DEDUCTION_ANALYSIS_TIME_BASIS_LABEL: Record<
  QualityDeductionAnalysisTimeBasis,
  string
> = {
  FINANCIAL_EFFECTIVE: '正式质量扣款流水生效时间',
  SETTLEMENT_CYCLE: '结算周期归属时间',
}

export const QUALITY_DEDUCTION_ANALYSIS_DIMENSION_LABEL: Record<
  QualityDeductionAnalysisDimension,
  string
> = {
  FACTORY: '按工厂',
  PROCESS: '按回货环节 / 工序',
  WAREHOUSE: '按仓库',
  QC_RESULT: '按质检结果',
  LIABILITY_STATUS: '按责任状态',
  FACTORY_RESPONSE_STATUS: '按工厂处理状态',
  DISPUTE_STATUS: '按异议状态',
  SETTLEMENT_IMPACT_STATUS: '按结算影响状态',
}

interface AnalysisRowBase extends QualityDeductionAnalysisDetailRow {
  timeBucketKey: string
}

function roundAmount(value: number): number {
  return Math.round(value * 100) / 100
}

function startOfDayTimestamp(value: string): number | null {
  if (!value) return null
  return parseQualityDeductionTimestamp(`${value} 00:00:00`)
}

function endOfDayTimestamp(value: string): number | null {
  if (!value) return null
  return parseQualityDeductionTimestamp(`${value} 23:59:59`)
}

function resolveFinancialEffectiveAt(caseFact: QualityDeductionCaseFact): string | undefined {
  return (
    caseFact.formalLedger?.generatedAt ??
    caseFact.disputeCase?.resultWrittenBackAt ??
    caseFact.pendingDeductionRecord?.handledAt ??
    caseFact.qcRecord.inspectedAt
  )
}

function resolveSettlementCycleLabel(caseFact: QualityDeductionCaseFact): string {
  return (
    caseFact.settlementImpact.candidateSettlementCycleId ??
    caseFact.settlementImpact.includedSettlementStatementId ??
    caseFact.settlementImpact.includedSettlementBatchId ??
    '待分配周期'
  )
}

function resolveSettlementCycleAt(caseFact: QualityDeductionCaseFact): string | undefined {
  return (
    caseFact.settlementImpact.includedAt ??
    caseFact.settlementImpact.eligibleAt ??
    caseFact.disputeCase?.resultWrittenBackAt ??
    caseFact.formalLedger?.generatedAt ??
    caseFact.qcRecord.inspectedAt
  )
}

function resolveDisplayTimeLabel(
  caseFact: QualityDeductionCaseFact,
  timeBasis: QualityDeductionAnalysisTimeBasis,
): string {
  if (timeBasis === 'SETTLEMENT_CYCLE') {
    const cycleLabel = resolveSettlementCycleLabel(caseFact)
    const cycleAt = resolveSettlementCycleAt(caseFact)
    return cycleAt ? `${cycleLabel} / ${cycleAt}` : cycleLabel
  }
  return resolveFinancialEffectiveAt(caseFact) ?? '—'
}

function resolveDetailSummary(caseFact: QualityDeductionCaseFact): string {
  if (caseFact.formalLedger) {
    return `已形成正式质量扣款流水 ${caseFact.formalLedger.ledgerNo}，后续按预结算链继续处理。`
  }
  if (
    caseFact.disputeCase &&
    (caseFact.disputeCase.status === 'PENDING_REVIEW' || caseFact.disputeCase.status === 'IN_REVIEW')
  ) {
    return '已生成质量异议单，待平台处理前不形成正式质量扣款流水。'
  }
  if (caseFact.pendingDeductionRecord?.status === 'PENDING_FACTORY_CONFIRM') {
    return '已生成待确认质量扣款记录，等待工厂在 48 小时内处理。'
  }
  if (caseFact.pendingDeductionRecord?.status === 'CLOSED_WITHOUT_LEDGER') {
    return '平台已判定当前记录不生成正式质量扣款流水。'
  }
  return caseFact.settlementImpact.summary
}

function belongsToAnalysis(caseFact: QualityDeductionCaseFact): boolean {
  return Boolean(
    caseFact.deductionBasis ||
      caseFact.pendingDeductionRecord ||
      caseFact.disputeCase ||
      caseFact.formalLedger,
  )
}

function toAnalysisRow(caseFact: QualityDeductionCaseFact, query: QualityDeductionAnalysisQuery): AnalysisRowBase {
  const qcRecord = caseFact.qcRecord
  const basis = caseFact.deductionBasis
  const dispute = caseFact.disputeCase
  const ledger = caseFact.formalLedger
  const impact = caseFact.settlementImpact
  const financialEffectiveAt = resolveFinancialEffectiveAt(caseFact)
  const settlementCycleAt = resolveSettlementCycleAt(caseFact)
  const settlementCycleLabel = resolveSettlementCycleLabel(caseFact)
  const displayTimeLabel = resolveDisplayTimeLabel(caseFact, query.timeBasis)
  const blockedProcessingFeeAmount = impact.blockedProcessingFeeAmount
  const effectiveQualityDeductionAmount = ledger?.settlementAmount ?? 0
  const totalFinancialImpactAmount = roundAmount(blockedProcessingFeeAmount + effectiveQualityDeductionAmount)
  const timeBucketKey =
    query.timeBasis === 'SETTLEMENT_CYCLE'
      ? settlementCycleLabel
      : (financialEffectiveAt ?? qcRecord.inspectedAt).slice(0, 10)

  return {
    qcId: qcRecord.qcId,
    qcNo: qcRecord.qcNo,
    basisId: basis?.basisId,
    productionOrderNo: qcRecord.productionOrderNo,
    returnInboundBatchNo: qcRecord.returnInboundBatchNo,
    factoryId: qcRecord.returnFactoryId ?? '',
    factoryName: qcRecord.returnFactoryName ?? '—',
    warehouseId: qcRecord.warehouseId ?? '',
    warehouseName: qcRecord.warehouseName ?? '—',
    processType: qcRecord.processType,
    processLabel: qcRecord.processLabel,
    qcResult: qcRecord.qcResult,
    qcResultLabel: QUALITY_DEDUCTION_QC_RESULT_LABEL[qcRecord.qcResult],
    liabilityStatus: qcRecord.liabilityStatus,
    liabilityStatusLabel: QUALITY_DEDUCTION_LIABILITY_STATUS_LABEL[qcRecord.liabilityStatus],
    factoryResponseStatus: caseFact.factoryResponse?.factoryResponseStatus ?? 'NOT_REQUIRED',
    factoryResponseStatusLabel:
      QUALITY_DEDUCTION_FACTORY_RESPONSE_STATUS_LABEL[
        caseFact.factoryResponse?.factoryResponseStatus ?? 'NOT_REQUIRED'
      ],
    disputeStatus: dispute?.status ?? 'NONE',
    disputeStatusLabel: QUALITY_DEDUCTION_DISPUTE_STATUS_LABEL[dispute?.status ?? 'NONE'],
    settlementImpactStatus: impact.status,
    settlementImpactStatusLabel: QUALITY_DEDUCTION_SETTLEMENT_IMPACT_STATUS_LABEL[impact.status],
    inspectedQty: qcRecord.inspectedQty,
    qualifiedQty: qcRecord.qualifiedQty,
    unqualifiedQty: qcRecord.unqualifiedQty,
    factoryLiabilityQty: qcRecord.factoryLiabilityQty,
    blockedProcessingFeeAmount,
    effectiveQualityDeductionAmount,
    totalFinancialImpactAmount,
    hasAdjustment: false,
    adjustmentType: undefined,
    adjustmentTypeLabel: undefined,
    adjustmentAmount: 0,
    adjustmentAmountSigned: 0,
    targetSettlementCycleId: undefined,
    includedSettlementStatementId: ledger?.includedStatementId ?? impact.includedSettlementStatementId,
    includedSettlementBatchId: ledger?.includedPrepaymentBatchId ?? impact.includedSettlementBatchId,
    financialEffectiveAt,
    settlementCycleAt,
    settlementCycleLabel,
    displayTimeLabel,
    detailSummary: resolveDetailSummary(caseFact),
    qcHref: `/fcs/quality/qc-records/${encodeURIComponent(qcRecord.qcId)}`,
    deductionHref: basis?.basisId ? buildDeductionEntryHrefByBasisId(basis.basisId) : undefined,
    timeBucketKey,
  }
}

function createBaseRows(query: QualityDeductionAnalysisQuery): AnalysisRowBase[] {
  return listQualityDeductionCaseFacts({ includeLegacy: true })
    .filter(belongsToAnalysis)
    .map((caseFact) => toAnalysisRow(caseFact, query))
}

function matchesKeyword(row: AnalysisRowBase, keyword: string): boolean {
  const normalized = keyword.trim().toLowerCase()
  if (!normalized) return true
  return [
    row.qcId,
    row.qcNo,
    row.basisId,
    row.productionOrderNo,
    row.returnInboundBatchNo,
    row.factoryName,
    row.factoryId,
    row.detailSummary,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalized))
}

function matchesTimeRange(row: AnalysisRowBase, query: QualityDeductionAnalysisQuery): boolean {
  const targetAt =
    query.timeBasis === 'SETTLEMENT_CYCLE' ? row.settlementCycleAt : row.financialEffectiveAt
  const targetMs = parseQualityDeductionTimestamp(targetAt)
  if (targetMs === null) return true
  const startMs = startOfDayTimestamp(query.startDate)
  const endMs = endOfDayTimestamp(query.endDate)
  if (startMs !== null && targetMs < startMs) return false
  if (endMs !== null && targetMs > endMs) return false
  return true
}

function matchesDrilldown(row: AnalysisRowBase, query: QualityDeductionAnalysisQuery): boolean {
  if (!query.drilldownDimension || !query.drilldownValue) return true
  switch (query.drilldownDimension) {
    case 'FACTORY':
      return row.factoryId === query.drilldownValue
    case 'PROCESS':
      return row.processType === query.drilldownValue
    case 'WAREHOUSE':
      return row.warehouseId === query.drilldownValue
    case 'QC_RESULT':
      return row.qcResult === query.drilldownValue
    case 'LIABILITY_STATUS':
      return row.liabilityStatus === query.drilldownValue
    case 'FACTORY_RESPONSE_STATUS':
      return row.factoryResponseStatus === query.drilldownValue
    case 'DISPUTE_STATUS':
      return row.disputeStatus === query.drilldownValue
    case 'SETTLEMENT_IMPACT_STATUS':
      return row.settlementImpactStatus === query.drilldownValue
  }
}

function filterRows(query: QualityDeductionAnalysisQuery): AnalysisRowBase[] {
  return createBaseRows(query)
    .filter((row) => matchesKeyword(row, query.keyword))
    .filter((row) => matchesTimeRange(row, query))
    .filter((row) => (query.factoryId === 'ALL' ? true : row.factoryId === query.factoryId))
    .filter((row) => (query.processType === 'ALL' ? true : row.processType === query.processType))
    .filter((row) => (query.warehouseId === 'ALL' ? true : row.warehouseId === query.warehouseId))
    .filter((row) => (query.qcResult === 'ALL' ? true : row.qcResult === query.qcResult))
    .filter((row) => (query.liabilityStatus === 'ALL' ? true : row.liabilityStatus === query.liabilityStatus))
    .filter((row) =>
      query.factoryResponseStatus === 'ALL' ? true : row.factoryResponseStatus === query.factoryResponseStatus,
    )
    .filter((row) => (query.disputeStatus === 'ALL' ? true : row.disputeStatus === query.disputeStatus))
    .filter((row) =>
      query.settlementImpactStatus === 'ALL' ? true : row.settlementImpactStatus === query.settlementImpactStatus,
    )
    .filter((row) => {
      if (query.hasAdjustment === 'ALL') return true
      return query.hasAdjustment === 'YES' ? row.hasAdjustment : !row.hasAdjustment
    })
    .filter((row) => {
      if (query.includedInStatement === 'ALL') return true
      return query.includedInStatement === 'YES'
        ? Boolean(row.includedSettlementStatementId)
        : !row.includedSettlementStatementId
    })
    .filter((row) => {
      if (query.settled === 'ALL') return true
      return query.settled === 'YES' ? Boolean(row.includedSettlementBatchId) : !row.includedSettlementBatchId
    })
    .filter((row) => matchesDrilldown(row, query))
    .sort((left, right) => {
      const leftMs = parseQualityDeductionTimestamp(left.financialEffectiveAt ?? left.qcId) ?? 0
      const rightMs = parseQualityDeductionTimestamp(right.financialEffectiveAt ?? right.qcId) ?? 0
      return rightMs - leftMs
    })
}

function buildOptionMap(values: Array<{ value: string; label: string }>): QualityDeductionAnalysisFilterOption[] {
  const countMap = new Map<string, { label: string; count: number }>()
  for (const item of values) {
    if (!item.value) continue
    const current = countMap.get(item.value)
    if (current) {
      current.count += 1
    } else {
      countMap.set(item.value, { label: item.label, count: 1 })
    }
  }
  return [...countMap.entries()]
    .map(([value, meta]) => ({ value, label: meta.label, count: meta.count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'zh-CN'))
}

export function createDefaultQualityDeductionAnalysisQuery(): QualityDeductionAnalysisQuery {
  return {
    keyword: '',
    timeBasis: 'FINANCIAL_EFFECTIVE',
    startDate: '',
    endDate: '',
    factoryId: 'ALL',
    processType: 'ALL',
    warehouseId: 'ALL',
    qcResult: 'ALL',
    liabilityStatus: 'ALL',
    factoryResponseStatus: 'ALL',
    disputeStatus: 'ALL',
    settlementImpactStatus: 'ALL',
    hasAdjustment: 'ALL',
    includedInStatement: 'ALL',
    settled: 'ALL',
  }
}

export function buildQualityDeductionAnalysisFilterOptions(): QualityDeductionAnalysisFilterOptions {
  const rows = createBaseRows(createDefaultQualityDeductionAnalysisQuery())
  return {
    factories: buildOptionMap(rows.map((item) => ({ value: item.factoryId, label: item.factoryName }))),
    processes: buildOptionMap(rows.map((item) => ({ value: item.processType, label: item.processLabel }))),
    warehouses: buildOptionMap(rows.map((item) => ({ value: item.warehouseId, label: item.warehouseName }))),
  }
}

export function buildQualityDeductionKpis(query: QualityDeductionAnalysisQuery): QualityDeductionAnalysisKpis {
  const rows = filterRows(query)
  return {
    qcRecordCount: rows.length,
    factoryCount: new Set(rows.map((item) => item.factoryId)).size,
    blockedProcessingFeeAmount: roundAmount(rows.reduce((sum, item) => sum + item.blockedProcessingFeeAmount, 0)),
    effectiveQualityDeductionAmount: roundAmount(
      rows.reduce((sum, item) => sum + item.effectiveQualityDeductionAmount, 0),
    ),
    totalFinancialImpactAmount: roundAmount(rows.reduce((sum, item) => sum + item.totalFinancialImpactAmount, 0)),
    nextCycleAdjustmentAmount: 0,
    disputingAmount: roundAmount(
      rows
        .filter((item) => item.disputeStatus === 'PENDING_REVIEW' || item.disputeStatus === 'IN_REVIEW')
        .reduce((sum, item) => sum + item.blockedProcessingFeeAmount, 0),
    ),
    settledAmount: roundAmount(
      rows
        .filter((item) => item.includedSettlementBatchId)
        .reduce((sum, item) => sum + item.effectiveQualityDeductionAmount, 0),
    ),
    includedAmount: roundAmount(
      rows
        .filter((item) => item.includedSettlementStatementId)
        .reduce((sum, item) => sum + item.effectiveQualityDeductionAmount, 0),
    ),
  }
}

export function buildQualityDeductionTrend(
  query: QualityDeductionAnalysisQuery,
): QualityDeductionAnalysisTrendPoint[] {
  const rows = filterRows(query)
  const groups = new Map<string, QualityDeductionAnalysisTrendPoint>()
  for (const row of rows) {
    const key = row.timeBucketKey
    const label = query.timeBasis === 'SETTLEMENT_CYCLE' ? row.settlementCycleLabel ?? row.timeBucketKey : row.timeBucketKey
    const sortAt = query.timeBasis === 'SETTLEMENT_CYCLE' ? row.settlementCycleAt ?? '' : row.financialEffectiveAt ?? ''
    const existed = groups.get(key)
    if (existed) {
      existed.recordCount += 1
      existed.blockedProcessingFeeAmount = roundAmount(existed.blockedProcessingFeeAmount + row.blockedProcessingFeeAmount)
      existed.effectiveQualityDeductionAmount = roundAmount(
        existed.effectiveQualityDeductionAmount + row.effectiveQualityDeductionAmount,
      )
      existed.totalFinancialImpactAmount = roundAmount(
        existed.totalFinancialImpactAmount + row.totalFinancialImpactAmount,
      )
      continue
    }
    groups.set(key, {
      key,
      label,
      recordCount: 1,
      blockedProcessingFeeAmount: row.blockedProcessingFeeAmount,
      effectiveQualityDeductionAmount: row.effectiveQualityDeductionAmount,
      totalFinancialImpactAmount: row.totalFinancialImpactAmount,
      adjustmentAmount: 0,
      sortAt,
    })
  }
  return [...groups.values()].sort((left, right) => {
    const leftSort = parseQualityDeductionTimestamp(left.sortAt) ?? 0
    const rightSort = parseQualityDeductionTimestamp(right.sortAt) ?? 0
    return leftSort - rightSort
  })
}

function resolveDimensionKeyAndLabel(
  row: AnalysisRowBase,
  dimension: QualityDeductionAnalysisDimension,
): { key: string; label: string } {
  switch (dimension) {
    case 'FACTORY':
      return { key: row.factoryId, label: row.factoryName }
    case 'PROCESS':
      return { key: row.processType, label: row.processLabel }
    case 'WAREHOUSE':
      return { key: row.warehouseId, label: row.warehouseName }
    case 'QC_RESULT':
      return { key: row.qcResult, label: row.qcResultLabel }
    case 'LIABILITY_STATUS':
      return { key: row.liabilityStatus, label: row.liabilityStatusLabel }
    case 'FACTORY_RESPONSE_STATUS':
      return { key: row.factoryResponseStatus, label: row.factoryResponseStatusLabel }
    case 'DISPUTE_STATUS':
      return { key: row.disputeStatus, label: row.disputeStatusLabel }
    case 'SETTLEMENT_IMPACT_STATUS':
      return { key: row.settlementImpactStatus, label: row.settlementImpactStatusLabel }
  }
}

export function buildQualityDeductionBreakdown(
  query: QualityDeductionAnalysisQuery,
  dimension: QualityDeductionAnalysisDimension,
): QualityDeductionAnalysisBreakdownRow[] {
  const rows = filterRows(query)
  const totalCount = rows.length || 1
  const groups = new Map<string, QualityDeductionAnalysisBreakdownRow>()
  for (const row of rows) {
    const meta = resolveDimensionKeyAndLabel(row, dimension)
    const existed = groups.get(meta.key)
    if (existed) {
      existed.recordCount += 1
      existed.blockedProcessingFeeAmount = roundAmount(existed.blockedProcessingFeeAmount + row.blockedProcessingFeeAmount)
      existed.effectiveQualityDeductionAmount = roundAmount(
        existed.effectiveQualityDeductionAmount + row.effectiveQualityDeductionAmount,
      )
      existed.totalFinancialImpactAmount = roundAmount(
        existed.totalFinancialImpactAmount + row.totalFinancialImpactAmount,
      )
      continue
    }
    groups.set(meta.key, {
      dimension,
      key: meta.key,
      label: meta.label,
      recordCount: 1,
      blockedProcessingFeeAmount: row.blockedProcessingFeeAmount,
      effectiveQualityDeductionAmount: row.effectiveQualityDeductionAmount,
      totalFinancialImpactAmount: row.totalFinancialImpactAmount,
      adjustmentAmount: 0,
      shareRate: 0,
    })
  }

  return [...groups.values()]
    .map((item) => ({
      ...item,
      shareRate: Math.round((item.recordCount / totalCount) * 1000) / 10,
    }))
    .sort((left, right) => right.recordCount - left.recordCount || left.label.localeCompare(right.label, 'zh-CN'))
}

export function buildQualityDeductionDetails(
  query: QualityDeductionAnalysisQuery,
): QualityDeductionAnalysisDetailRow[] {
  return filterRows(query)
}

export function buildQualityDeductionExportRows(
  query: QualityDeductionAnalysisQuery,
): QualityDeductionAnalysisExportRow[] {
  return buildQualityDeductionDetails(query).map((row) => ({
    质检单号: row.qcNo,
    回货批次号: row.returnInboundBatchNo,
    生产单号: row.productionOrderNo,
    工厂: row.factoryName,
    工序: row.processLabel,
    质检结果: row.qcResultLabel,
    工厂责任数量: row.factoryLiabilityQty,
    工厂处理状态: row.factoryResponseStatusLabel,
    异议状态: row.disputeStatusLabel,
    结算影响状态: row.settlementImpactStatusLabel,
    冻结加工费金额: row.blockedProcessingFeeAmount,
    正式质量扣款流水金额: row.effectiveQualityDeductionAmount,
    总财务影响金额: row.totalFinancialImpactAmount,
    兼容占位类型: row.adjustmentTypeLabel ?? '—',
    兼容占位金额: row.adjustmentAmountSigned,
    统计时间: row.displayTimeLabel,
    结算周期: row.settlementCycleLabel ?? '—',
    扣款依据编号: row.basisId ?? '—',
  }))
}

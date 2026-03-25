import type { ReturnInboundProcessType } from './store-domain-quality-types.ts'
import { listQualityDeductionCaseFacts } from './quality-deduction-repository.ts'
import { getQualityDeductionNow, parseQualityDeductionTimestamp } from './quality-deduction-lifecycle.ts'
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
  QUALITY_DEDUCTION_SETTLEMENT_ADJUSTMENT_TYPE_LABEL,
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
  工厂响应状态: string
  异议状态: string
  结算影响状态: string
  冻结加工费金额: number
  生效质量扣款金额: number
  总财务影响金额: number
  下周期调整类型: string
  下周期调整金额: number
  统计时间: string
  结算周期: string
  扣款依据编号: string
}

export const QUALITY_DEDUCTION_ANALYSIS_TIME_BASIS_LABEL: Record<
  QualityDeductionAnalysisTimeBasis,
  string
> = {
  FINANCIAL_EFFECTIVE: '财务影响生效时间',
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
  FACTORY_RESPONSE_STATUS: '按工厂响应状态',
  DISPUTE_STATUS: '按异议状态',
  SETTLEMENT_IMPACT_STATUS: '按结算影响状态',
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

function signedAdjustmentAmount(caseFact: QualityDeductionCaseFact): number {
  const adjustment = caseFact.settlementAdjustment
  if (!adjustment) return 0
  if (adjustment.adjustmentType === 'INCREASE_DEDUCTION') return adjustment.adjustmentAmount
  return -adjustment.adjustmentAmount
}

function resolveFinancialEffectiveAt(caseFact: QualityDeductionCaseFact): string | undefined {
  return (
    caseFact.settlementImpact.lastWrittenBackAt ??
    caseFact.settlementImpact.eligibleAt ??
    caseFact.deductionBasis?.adjustedAt ??
    caseFact.deductionBasis?.effectiveAt ??
    caseFact.disputeCase?.resultWrittenBackAt ??
    caseFact.factoryResponse?.autoConfirmedAt ??
    caseFact.factoryResponse?.respondedAt ??
    caseFact.qcRecord.inspectedAt
  )
}

function resolveSettlementCycleAt(caseFact: QualityDeductionCaseFact): string | undefined {
  return (
    caseFact.settlementImpact.settledAt ??
    caseFact.settlementImpact.includedAt ??
    caseFact.settlementAdjustment?.generatedAt ??
    caseFact.settlementImpact.eligibleAt ??
    caseFact.deductionBasis?.effectiveAt ??
    caseFact.qcRecord.inspectedAt
  )
}

function resolveSettlementCycleLabel(caseFact: QualityDeductionCaseFact): string {
  return (
    caseFact.settlementAdjustment?.targetSettlementCycleId ??
    caseFact.settlementImpact.includedSettlementBatchId ??
    caseFact.settlementImpact.includedSettlementStatementId ??
    caseFact.settlementImpact.candidateSettlementCycleId ??
    '待分配周期'
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

function belongsToAnalysis(caseFact: QualityDeductionCaseFact): boolean {
  return Boolean(
    caseFact.deductionBasis ||
      caseFact.settlementAdjustment ||
      caseFact.settlementImpact.status !== 'NO_IMPACT',
  )
}

function buildBaseRows(): QualityDeductionAnalysisDetailRow[] {
  return listQualityDeductionCaseFacts({ includeLegacy: true })
    .filter((caseFact) => belongsToAnalysis(caseFact))
    .map((caseFact) => {
      const { qcRecord, deductionBasis, disputeCase, settlementImpact, settlementAdjustment } = caseFact
      const adjustmentSigned = signedAdjustmentAmount(caseFact)
      return {
        qcId: qcRecord.qcId,
        qcNo: qcRecord.qcNo,
        basisId: deductionBasis?.basisId,
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
          QUALITY_DEDUCTION_FACTORY_RESPONSE_STATUS_LABEL[caseFact.factoryResponse?.factoryResponseStatus ?? 'NOT_REQUIRED'],
        disputeStatus: disputeCase?.status ?? 'NONE',
        disputeStatusLabel: QUALITY_DEDUCTION_DISPUTE_STATUS_LABEL[disputeCase?.status ?? 'NONE'],
        settlementImpactStatus: settlementImpact.status,
        settlementImpactStatusLabel:
          QUALITY_DEDUCTION_SETTLEMENT_IMPACT_STATUS_LABEL[settlementImpact.status],
        inspectedQty: qcRecord.inspectedQty,
        qualifiedQty: qcRecord.qualifiedQty,
        unqualifiedQty: qcRecord.unqualifiedQty,
        factoryLiabilityQty: qcRecord.factoryLiabilityQty,
        blockedProcessingFeeAmount: settlementImpact.blockedProcessingFeeAmount,
        effectiveQualityDeductionAmount: settlementImpact.effectiveQualityDeductionAmount,
        totalFinancialImpactAmount: settlementImpact.totalFinancialImpactAmount,
        hasAdjustment: Boolean(settlementAdjustment),
        adjustmentType: settlementAdjustment?.adjustmentType,
        adjustmentTypeLabel: settlementAdjustment
          ? QUALITY_DEDUCTION_SETTLEMENT_ADJUSTMENT_TYPE_LABEL[settlementAdjustment.adjustmentType]
          : undefined,
        adjustmentAmount: settlementAdjustment?.adjustmentAmount ?? 0,
        adjustmentAmountSigned: adjustmentSigned,
        targetSettlementCycleId: settlementAdjustment?.targetSettlementCycleId,
        includedSettlementStatementId: settlementImpact.includedSettlementStatementId,
        includedSettlementBatchId: settlementImpact.includedSettlementBatchId,
        financialEffectiveAt: resolveFinancialEffectiveAt(caseFact),
        settlementCycleAt: resolveSettlementCycleAt(caseFact),
        settlementCycleLabel: resolveSettlementCycleLabel(caseFact),
        displayTimeLabel: resolveDisplayTimeLabel(caseFact, 'FINANCIAL_EFFECTIVE'),
        detailSummary:
          settlementAdjustment?.summary ??
          settlementImpact.summary ??
          deductionBasis?.summary ??
          qcRecord.remark ??
          '—',
        qcHref: `/fcs/quality/qc-records/${qcRecord.qcId}`,
        deductionHref: deductionBasis ? buildDeductionEntryHrefByBasisId(deductionBasis.basisId) : undefined,
      }
    })
}

function matchesKeyword(row: QualityDeductionAnalysisDetailRow, keyword: string): boolean {
  if (!keyword) return true
  const haystack = [
    row.qcNo,
    row.returnInboundBatchNo,
    row.productionOrderNo,
    row.basisId,
    row.factoryName,
    row.warehouseName,
    row.processLabel,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(keyword.toLowerCase())
}

function matchesDateRange(row: QualityDeductionAnalysisDetailRow, query: QualityDeductionAnalysisQuery): boolean {
  if (!query.startDate && !query.endDate) return true
  const timeValue =
    query.timeBasis === 'SETTLEMENT_CYCLE' ? row.settlementCycleAt : row.financialEffectiveAt
  const timestamp = parseQualityDeductionTimestamp(timeValue)
  if (timestamp === null) return false
  const start = startOfDayTimestamp(query.startDate)
  const end = endOfDayTimestamp(query.endDate)
  if (start !== null && timestamp < start) return false
  if (end !== null && timestamp > end) return false
  return true
}

function matchesDrilldown(
  row: QualityDeductionAnalysisDetailRow,
  dimension?: QualityDeductionAnalysisDimension,
  value?: string,
): boolean {
  if (!dimension || !value) return true
  switch (dimension) {
    case 'FACTORY':
      return row.factoryId === value
    case 'PROCESS':
      return row.processType === value
    case 'WAREHOUSE':
      return row.warehouseId === value
    case 'QC_RESULT':
      return row.qcResult === value
    case 'LIABILITY_STATUS':
      return row.liabilityStatus === value
    case 'FACTORY_RESPONSE_STATUS':
      return row.factoryResponseStatus === value
    case 'DISPUTE_STATUS':
      return row.disputeStatus === value
    case 'SETTLEMENT_IMPACT_STATUS':
      return row.settlementImpactStatus === value
    default:
      return true
  }
}

function getFilteredRows(
  query: QualityDeductionAnalysisQuery,
  options: { applyDrilldown: boolean },
): QualityDeductionAnalysisDetailRow[] {
  return buildBaseRows()
    .filter((row) => matchesKeyword(row, query.keyword.trim()))
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
    .filter((row) =>
      query.hasAdjustment === 'ALL' ? true : query.hasAdjustment === 'YES' ? row.hasAdjustment : !row.hasAdjustment,
    )
    .filter((row) =>
      query.includedInStatement === 'ALL'
        ? true
        : query.includedInStatement === 'YES'
          ? Boolean(row.includedSettlementStatementId || row.includedSettlementBatchId)
          : !Boolean(row.includedSettlementStatementId || row.includedSettlementBatchId),
    )
    .filter((row) =>
      query.settled === 'ALL'
        ? true
        : query.settled === 'YES'
          ? row.settlementImpactStatus === 'SETTLED'
          : row.settlementImpactStatus !== 'SETTLED',
    )
    .filter((row) => matchesDateRange(row, query))
    .filter((row) =>
      options.applyDrilldown
        ? matchesDrilldown(row, query.drilldownDimension, query.drilldownValue)
        : true,
    )
}

function aggregateRows(rows: QualityDeductionAnalysisDetailRow[]) {
  return rows.reduce(
    (acc, row) => {
      acc.recordCount += 1
      acc.blockedProcessingFeeAmount += row.blockedProcessingFeeAmount
      acc.effectiveQualityDeductionAmount += row.effectiveQualityDeductionAmount
      acc.totalFinancialImpactAmount += row.totalFinancialImpactAmount
      acc.adjustmentAmount += row.adjustmentAmountSigned
      return acc
    },
    {
      recordCount: 0,
      blockedProcessingFeeAmount: 0,
      effectiveQualityDeductionAmount: 0,
      totalFinancialImpactAmount: 0,
      adjustmentAmount: 0,
    },
  )
}

function buildOptionMap(
  rows: QualityDeductionAnalysisDetailRow[],
  getValue: (row: QualityDeductionAnalysisDetailRow) => string,
  getLabel: (row: QualityDeductionAnalysisDetailRow) => string,
): QualityDeductionAnalysisFilterOption[] {
  const map = new Map<string, QualityDeductionAnalysisFilterOption>()
  for (const row of rows) {
    const value = getValue(row)
    if (!value) continue
    const current = map.get(value)
    map.set(value, {
      value,
      label: getLabel(row),
      count: (current?.count ?? 0) + 1,
    })
  }
  return Array.from(map.values()).sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'))
}

function resolveBreakdownKey(row: QualityDeductionAnalysisDetailRow, dimension: QualityDeductionAnalysisDimension): string {
  switch (dimension) {
    case 'FACTORY':
      return row.factoryId || 'UNASSIGNED_FACTORY'
    case 'PROCESS':
      return row.processType
    case 'WAREHOUSE':
      return row.warehouseId || 'UNASSIGNED_WAREHOUSE'
    case 'QC_RESULT':
      return row.qcResult
    case 'LIABILITY_STATUS':
      return row.liabilityStatus
    case 'FACTORY_RESPONSE_STATUS':
      return row.factoryResponseStatus
    case 'DISPUTE_STATUS':
      return row.disputeStatus
    case 'SETTLEMENT_IMPACT_STATUS':
      return row.settlementImpactStatus
  }
}

function resolveBreakdownLabel(row: QualityDeductionAnalysisDetailRow, dimension: QualityDeductionAnalysisDimension): string {
  switch (dimension) {
    case 'FACTORY':
      return row.factoryName
    case 'PROCESS':
      return row.processLabel
    case 'WAREHOUSE':
      return row.warehouseName
    case 'QC_RESULT':
      return row.qcResultLabel
    case 'LIABILITY_STATUS':
      return row.liabilityStatusLabel
    case 'FACTORY_RESPONSE_STATUS':
      return row.factoryResponseStatusLabel
    case 'DISPUTE_STATUS':
      return row.disputeStatusLabel
    case 'SETTLEMENT_IMPACT_STATUS':
      return row.settlementImpactStatusLabel
  }
}

export function createDefaultQualityDeductionAnalysisQuery(): QualityDeductionAnalysisQuery {
  const now = getQualityDeductionNow().toISOString().slice(0, 10)
  return {
    keyword: '',
    timeBasis: 'FINANCIAL_EFFECTIVE',
    startDate: '',
    endDate: now,
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
  const rows = buildBaseRows()
  return {
    factories: buildOptionMap(rows, (row) => row.factoryId, (row) => row.factoryName),
    processes: buildOptionMap(rows, (row) => row.processType, (row) => row.processLabel),
    warehouses: buildOptionMap(rows, (row) => row.warehouseId, (row) => row.warehouseName),
  }
}

export function buildQualityDeductionKpis(query: QualityDeductionAnalysisQuery): QualityDeductionAnalysisKpis {
  const rows = getFilteredRows(query, { applyDrilldown: false })
  const aggregated = aggregateRows(rows)
  return {
    qcRecordCount: rows.length,
    factoryCount: new Set(rows.map((row) => row.factoryId).filter(Boolean)).size,
    blockedProcessingFeeAmount: roundAmount(aggregated.blockedProcessingFeeAmount),
    effectiveQualityDeductionAmount: roundAmount(aggregated.effectiveQualityDeductionAmount),
    totalFinancialImpactAmount: roundAmount(aggregated.totalFinancialImpactAmount),
    nextCycleAdjustmentAmount: roundAmount(aggregated.adjustmentAmount),
    disputingAmount: roundAmount(
      rows
        .filter((row) => row.disputeStatus === 'PENDING_REVIEW' || row.disputeStatus === 'IN_REVIEW')
        .reduce((sum, row) => sum + row.totalFinancialImpactAmount, 0),
    ),
    settledAmount: roundAmount(
      rows
        .filter((row) => row.settlementImpactStatus === 'SETTLED')
        .reduce((sum, row) => sum + row.totalFinancialImpactAmount, 0),
    ),
    includedAmount: roundAmount(
      rows
        .filter((row) => Boolean(row.includedSettlementStatementId || row.includedSettlementBatchId))
        .reduce((sum, row) => sum + row.totalFinancialImpactAmount, 0),
    ),
  }
}

export function buildQualityDeductionTrend(query: QualityDeductionAnalysisQuery): QualityDeductionAnalysisTrendPoint[] {
  const rows = getFilteredRows(query, { applyDrilldown: false })
  const buckets = new Map<string, QualityDeductionAnalysisTrendPoint>()

  for (const row of rows) {
    const sortAt = query.timeBasis === 'SETTLEMENT_CYCLE' ? row.settlementCycleAt : row.financialEffectiveAt
    const bucketKey =
      query.timeBasis === 'SETTLEMENT_CYCLE'
        ? row.settlementCycleLabel ?? '待分配周期'
        : (sortAt?.slice(0, 10) ?? '未归属时间')
    const current = buckets.get(bucketKey) ?? {
      key: bucketKey,
      label: bucketKey,
      recordCount: 0,
      blockedProcessingFeeAmount: 0,
      effectiveQualityDeductionAmount: 0,
      totalFinancialImpactAmount: 0,
      adjustmentAmount: 0,
      sortAt: sortAt ?? '9999-12-31 23:59:59',
    }
    current.recordCount += 1
    current.blockedProcessingFeeAmount += row.blockedProcessingFeeAmount
    current.effectiveQualityDeductionAmount += row.effectiveQualityDeductionAmount
    current.totalFinancialImpactAmount += row.totalFinancialImpactAmount
    current.adjustmentAmount += row.adjustmentAmountSigned
    if (sortAt && sortAt < current.sortAt) current.sortAt = sortAt
    buckets.set(bucketKey, current)
  }

  return Array.from(buckets.values())
    .map((item) => ({
      ...item,
      blockedProcessingFeeAmount: roundAmount(item.blockedProcessingFeeAmount),
      effectiveQualityDeductionAmount: roundAmount(item.effectiveQualityDeductionAmount),
      totalFinancialImpactAmount: roundAmount(item.totalFinancialImpactAmount),
      adjustmentAmount: roundAmount(item.adjustmentAmount),
    }))
    .sort((left, right) => left.sortAt.localeCompare(right.sortAt, 'zh-CN'))
}

export function buildQualityDeductionBreakdown(
  query: QualityDeductionAnalysisQuery,
  dimension: QualityDeductionAnalysisDimension,
): QualityDeductionAnalysisBreakdownRow[] {
  const rows = getFilteredRows(query, { applyDrilldown: false })
  const totalImpact = rows.reduce((sum, row) => sum + row.totalFinancialImpactAmount, 0)
  const map = new Map<string, QualityDeductionAnalysisBreakdownRow>()

  for (const row of rows) {
    const key = resolveBreakdownKey(row, dimension)
    const current = map.get(key) ?? {
      dimension,
      key,
      label: resolveBreakdownLabel(row, dimension),
      recordCount: 0,
      blockedProcessingFeeAmount: 0,
      effectiveQualityDeductionAmount: 0,
      totalFinancialImpactAmount: 0,
      adjustmentAmount: 0,
      shareRate: 0,
    }

    current.recordCount += 1
    current.blockedProcessingFeeAmount += row.blockedProcessingFeeAmount
    current.effectiveQualityDeductionAmount += row.effectiveQualityDeductionAmount
    current.totalFinancialImpactAmount += row.totalFinancialImpactAmount
    current.adjustmentAmount += row.adjustmentAmountSigned
    map.set(key, current)
  }

  return Array.from(map.values())
    .map((item) => ({
      ...item,
      blockedProcessingFeeAmount: roundAmount(item.blockedProcessingFeeAmount),
      effectiveQualityDeductionAmount: roundAmount(item.effectiveQualityDeductionAmount),
      totalFinancialImpactAmount: roundAmount(item.totalFinancialImpactAmount),
      adjustmentAmount: roundAmount(item.adjustmentAmount),
      shareRate:
        totalImpact > 0
          ? Math.round((item.totalFinancialImpactAmount / totalImpact) * 1000) / 10
          : 0,
    }))
    .sort((left, right) => {
      if (right.totalFinancialImpactAmount !== left.totalFinancialImpactAmount) {
        return right.totalFinancialImpactAmount - left.totalFinancialImpactAmount
      }
      return right.recordCount - left.recordCount
    })
}

export function buildQualityDeductionDetails(
  query: QualityDeductionAnalysisQuery,
): QualityDeductionAnalysisDetailRow[] {
  return getFilteredRows(query, { applyDrilldown: true })
    .map((row) => ({
      ...row,
      displayTimeLabel:
        query.timeBasis === 'SETTLEMENT_CYCLE'
          ? `${row.settlementCycleLabel ?? '待分配周期'}${row.settlementCycleAt ? ` / ${row.settlementCycleAt}` : ''}`
          : row.financialEffectiveAt ?? '—',
    }))
    .sort((left, right) => {
      const leftTs = parseQualityDeductionTimestamp(
        query.timeBasis === 'SETTLEMENT_CYCLE' ? left.settlementCycleAt : left.financialEffectiveAt,
      ) ?? 0
      const rightTs = parseQualityDeductionTimestamp(
        query.timeBasis === 'SETTLEMENT_CYCLE' ? right.settlementCycleAt : right.financialEffectiveAt,
      ) ?? 0
      return rightTs - leftTs
    })
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
    工厂响应状态: row.factoryResponseStatusLabel,
    异议状态: row.disputeStatusLabel,
    结算影响状态: row.settlementImpactStatusLabel,
    冻结加工费金额: row.blockedProcessingFeeAmount,
    生效质量扣款金额: row.effectiveQualityDeductionAmount,
    总财务影响金额: row.totalFinancialImpactAmount,
    下周期调整类型: row.adjustmentTypeLabel ?? '—',
    下周期调整金额: row.adjustmentAmountSigned,
    统计时间: row.displayTimeLabel,
    结算周期: row.settlementCycleLabel ?? '—',
    扣款依据编号: row.basisId ?? '—',
  }))
}

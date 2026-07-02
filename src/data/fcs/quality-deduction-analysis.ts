import { parseQualityDeductionTimestamp } from './quality-deduction-lifecycle.ts'
import { listPostFinishingQcOrders } from './post-finishing-domain.ts'
import { listStatementConfirmedDeductionRows } from './store-domain-statement-source-adapter.ts'
import type { StatementDeductionLineType } from './store-domain-settlement-types.ts'
import type {
  QualityDeductionDisputeStatus,
  QualityDeductionFactoryResponseStatus,
  QualityDeductionLiabilityStatus,
  QualityDeductionQcResult,
  QualityDeductionSettlementImpactStatus,
} from './quality-deduction-domain.ts'

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
  recordSource: 'QC_REWORK_CHARGEBACK' | 'STATEMENT_FACTORY_DEFECT'
  recordSourceLabel: string
  qcId: string
  qcNo: string
  basisId?: string
  productionOrderNo: string
  returnInboundBatchNo: string
  factoryId: string
  factoryName: string
  warehouseId: string
  warehouseName: string
  processType: StatementDeductionLineType
  processLabel: string
  deductionReasonName?: string
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
  currency: string
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
  来源类型: string
  来源编号: string
  质检记录: string
  对账单编号: string
  生产单号: string
  工厂: string
  扣款类型: string
  扣款原因: string
  扣款数量: number
  对账单确认状态: string
  异议状态: string
  结算影响状态: string
  对账单扣款金额: number
  总财务影响金额: number
  统计时间: string
  来源证据: string
}

export const QUALITY_DEDUCTION_ANALYSIS_TIME_BASIS_LABEL: Record<
  QualityDeductionAnalysisTimeBasis,
  string
> = {
  FINANCIAL_EFFECTIVE: '对账单扣款确认时间',
  SETTLEMENT_CYCLE: '对账单归属时间',
}

export const QUALITY_DEDUCTION_ANALYSIS_DIMENSION_LABEL: Record<
  QualityDeductionAnalysisDimension,
  string
> = {
  FACTORY: '按工厂',
  PROCESS: '按扣款类型',
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

function numberValue(value: number | undefined): number {
  return Number(value) || 0
}

function getPostQcProductionOrderNo(row: ReturnType<typeof listPostFinishingQcOrders>[number]): string {
  return row.warehouseAllocations?.[0]?.productionOrderNo || row.qualityDeductionSnapshot?.productionOrderNo || '—'
}

function createQcReworkChargebackRows(query: QualityDeductionAnalysisQuery): AnalysisRowBase[] {
  return listPostFinishingQcOrders().flatMap((row) => {
    const amount = (row.qcSkuResults ?? []).reduce(
      (sum, item) => sum + numberValue(item.sourceChargeback?.amount ?? item.reworkDeductionAmountIdr),
      0,
    )
    if (amount <= 0) return []

    const occurredAt = row.finishedAt || row.startedAt || row.updatedAt || ''
    const occurredDate = occurredAt.slice(0, 10)
    const productionOrderNo = getPostQcProductionOrderNo(row)
    return [
      {
        recordSource: 'QC_REWORK_CHARGEBACK' as const,
        recordSourceLabel: '质检记录返工扣款',
        qcId: row.actionRecordId,
        qcNo: row.actionRecordNo,
        basisId: undefined,
        productionOrderNo,
        returnInboundBatchNo: row.actionRecordNo,
        factoryId: row.sourceFactoryName,
        factoryName: row.sourceFactoryName,
        warehouseId: '',
        warehouseName: '—',
        processType: 'POST_FACTORY_REWORK_CHARGEBACK' as const,
        processLabel: '返工扣款',
        deductionReasonName: row.reworkReceiveFactoryName ? `返工接收：${row.reworkReceiveFactoryName}` : '返工接收对象非来源工厂',
        qcResult: 'PARTIALLY_QUALIFIED' as const,
        qcResultLabel: '质检记录同步',
        liabilityStatus: 'FACTORY' as const,
        liabilityStatusLabel: '工厂原因',
        factoryResponseStatus: 'NOT_REQUIRED' as const,
        factoryResponseStatusLabel: '质检记录同步',
        disputeStatus: 'NONE' as const,
        disputeStatusLabel: '无异议',
        settlementImpactStatus: 'ELIGIBLE' as const,
        settlementImpactStatusLabel: '待进入对账单',
        inspectedQty: numberValue(row.inspectedGarmentQty ?? row.submittedGarmentQty),
        qualifiedQty: numberValue(row.passedGarmentQty ?? row.acceptedGarmentQty),
        unqualifiedQty: numberValue(row.reworkGarmentQty),
        factoryLiabilityQty: numberValue(row.reworkGarmentQty),
        blockedProcessingFeeAmount: 0,
        effectiveQualityDeductionAmount: roundAmount(amount),
        totalFinancialImpactAmount: roundAmount(amount),
        currency: row.qcSkuResults?.find((item) => item.sourceChargeback?.currency)?.sourceChargeback?.currency ?? 'IDR',
        hasAdjustment: false,
        adjustmentType: undefined,
        adjustmentTypeLabel: undefined,
        adjustmentAmount: 0,
        adjustmentAmountSigned: 0,
        targetSettlementCycleId: undefined,
        includedSettlementStatementId: undefined,
        includedSettlementBatchId: undefined,
        financialEffectiveAt: occurredAt,
        settlementCycleAt: occurredAt,
        settlementCycleLabel: '待进入对账单',
        displayTimeLabel: occurredAt || '—',
        detailSummary: `质检记录返工扣款 · ${amount} IDR · ${productionOrderNo}`,
        qcHref: `/fcs/quality/qc-records/${encodeURIComponent(row.actionRecordId)}`,
        deductionHref: undefined,
        timeBucketKey: query.timeBasis === 'SETTLEMENT_CYCLE' ? '待进入对账单' : occurredDate,
      },
    ]
  })
}

function createBaseRows(query: QualityDeductionAnalysisQuery): AnalysisRowBase[] {
  const statementRows = listStatementConfirmedDeductionRows().filter((row) => row.deductionLineType === 'QUALITY_DEFECT').map((row) => {
    const occurredDate = row.occurredAt.slice(0, 10)
    const statementHref = `/fcs/settlement/statements?statement=${encodeURIComponent(row.statementId)}`
    return {
      recordSource: 'STATEMENT_FACTORY_DEFECT' as const,
      recordSourceLabel: '对账单瑕疵扣款',
      qcId: row.sourceQcRecordId ?? row.statementId,
      qcNo: row.sourceRefLabel ?? row.statementNo,
      basisId: row.statementId,
      productionOrderNo: row.productionOrderNo ?? '—',
      returnInboundBatchNo: row.sourceRefLabel ?? '—',
      factoryId: row.factoryId,
      factoryName: row.factoryName,
      warehouseId: '',
      warehouseName: '—',
      processType: row.deductionLineType,
      processLabel: '瑕疵扣款',
      deductionReasonName: row.reasonName || '工厂原因瑕疵',
      qcResult: 'PARTIALLY_QUALIFIED',
      qcResultLabel: '对账单扣款',
      liabilityStatus: 'FACTORY',
      liabilityStatusLabel: '对账单确认',
      factoryResponseStatus: 'CONFIRMED',
      factoryResponseStatusLabel: '对账单确认',
      disputeStatus: 'NONE',
      disputeStatusLabel: '无异议',
      settlementImpactStatus: 'INCLUDED_IN_STATEMENT',
      settlementImpactStatusLabel: '已进入对账单',
      inspectedQty: row.qty,
      qualifiedQty: 0,
      unqualifiedQty: row.qty,
      factoryLiabilityQty: row.qty,
      blockedProcessingFeeAmount: 0,
      effectiveQualityDeductionAmount: row.amount,
      totalFinancialImpactAmount: row.amount,
      currency: 'IDR',
      hasAdjustment: false,
      adjustmentType: undefined,
      adjustmentTypeLabel: undefined,
      adjustmentAmount: 0,
      adjustmentAmountSigned: 0,
      targetSettlementCycleId: undefined,
      includedSettlementStatementId: row.statementId,
      includedSettlementBatchId: row.includedPrepaymentBatchId,
      financialEffectiveAt: row.occurredAt,
      settlementCycleAt: row.occurredAt,
      settlementCycleLabel: row.statementNo,
      displayTimeLabel: query.timeBasis === 'SETTLEMENT_CYCLE' ? `${row.statementNo} / ${row.occurredAt}` : row.occurredAt,
      detailSummary: `${row.deductionLineTypeLabel} · ${row.amount} IDR · 来源对账单 ${row.statementNo}`,
      qcHref: row.sourceQcRecordId ? `/fcs/quality/qc-records/${encodeURIComponent(row.sourceQcRecordId)}` : statementHref,
      deductionHref: statementHref,
      timeBucketKey: query.timeBasis === 'SETTLEMENT_CYCLE' ? row.statementNo : occurredDate,
    }
  })
  return [...createQcReworkChargebackRows(query), ...statementRows]
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
    row.recordSourceLabel,
    row.deductionReasonName,
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
    来源类型: row.recordSourceLabel,
    来源编号: row.qcNo,
    质检记录: row.qcNo,
    对账单编号: row.settlementCycleLabel ?? row.basisId ?? '—',
    生产单号: row.productionOrderNo,
    工厂: row.factoryName,
    扣款类型: row.processLabel,
    扣款原因: row.deductionReasonName ?? '—',
    扣款数量: row.factoryLiabilityQty,
    对账单确认状态: row.factoryResponseStatusLabel,
    异议状态: row.disputeStatusLabel,
    结算影响状态: row.settlementImpactStatusLabel,
    对账单扣款金额: row.effectiveQualityDeductionAmount,
    总财务影响金额: row.totalFinancialImpactAmount,
    统计时间: row.displayTimeLabel,
    来源证据: row.returnInboundBatchNo,
  }))
}

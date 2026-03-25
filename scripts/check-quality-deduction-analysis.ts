#!/usr/bin/env node

import process from 'node:process'
import {
  buildQualityDeductionAnalysisFilterOptions,
  buildQualityDeductionBreakdown,
  buildQualityDeductionDetails,
  buildQualityDeductionKpis,
  buildQualityDeductionTrend,
  createDefaultQualityDeductionAnalysisQuery,
} from '../src/data/fcs/quality-deduction-analysis.ts'
import {
  getFutureMobileFactoryQcDetail,
  getPlatformQcDetailViewModelByRouteKey,
  listPdaSettlementWritebackItems,
} from '../src/data/fcs/quality-deduction-selectors.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function main(): void {
  const query = createDefaultQualityDeductionAnalysisQuery()
  const filterOptions = buildQualityDeductionAnalysisFilterOptions()
  assert(filterOptions.factories.length >= 2, 'analysis filter options 缺少工厂维度')
  assert(filterOptions.processes.length >= 4, 'analysis filter options 缺少工序维度')
  assert(filterOptions.warehouses.length >= 2, 'analysis filter options 缺少仓库维度')

  const kpis = buildQualityDeductionKpis(query)
  const details = buildQualityDeductionDetails(query)
  assert(details.length === kpis.qcRecordCount, 'KPI 记录数与明细数不一致')

  const trend = buildQualityDeductionTrend(query)
  assert(trend.length > 0, '趋势数据为空')
  const trendBlocked = trend.reduce((sum, item) => sum + item.blockedProcessingFeeAmount, 0)
  const trendEffective = trend.reduce((sum, item) => sum + item.effectiveQualityDeductionAmount, 0)
  const trendTotal = trend.reduce((sum, item) => sum + item.totalFinancialImpactAmount, 0)
  const trendAdjustment = trend.reduce((sum, item) => sum + item.adjustmentAmount, 0)
  assert(Math.round(trendBlocked * 100) === Math.round(kpis.blockedProcessingFeeAmount * 100), '趋势冻结加工费金额汇总不一致')
  assert(Math.round(trendEffective * 100) === Math.round(kpis.effectiveQualityDeductionAmount * 100), '趋势生效质量扣款金额汇总不一致')
  assert(Math.round(trendTotal * 100) === Math.round(kpis.totalFinancialImpactAmount * 100), '趋势总财务影响金额汇总不一致')
  assert(Math.round(trendAdjustment * 100) === Math.round(kpis.nextCycleAdjustmentAmount * 100), '趋势 adjustment 金额汇总不一致')

  const factoryBreakdown = buildQualityDeductionBreakdown(query, 'FACTORY')
  assert(factoryBreakdown.length > 0, '按工厂分解为空')
  assert(factoryBreakdown.reduce((sum, item) => sum + item.recordCount, 0) === kpis.qcRecordCount, '按工厂分解记录数不一致')
  assert(
    Math.round(factoryBreakdown.reduce((sum, item) => sum + item.totalFinancialImpactAmount, 0) * 100) ===
      Math.round(kpis.totalFinancialImpactAmount * 100),
    '按工厂分解总财务影响金额不一致',
  )

  const disputeBreakdown = buildQualityDeductionBreakdown(query, 'DISPUTE_STATUS')
  const pendingReviewGroup = disputeBreakdown.find((item) => item.key === 'PENDING_REVIEW')
  assert(pendingReviewGroup && pendingReviewGroup.recordCount > 0, '缺少待平台处理异议分组')

  const drilldownQuery = {
    ...query,
    drilldownDimension: 'DISPUTE_STATUS' as const,
    drilldownValue: 'PENDING_REVIEW',
  }
  const drilldownDetails = buildQualityDeductionDetails(drilldownQuery)
  assert(drilldownDetails.length === pendingReviewGroup.recordCount, '维度钻取后的明细条数不一致')
  assert(drilldownDetails.every((item) => item.disputeStatus === 'PENDING_REVIEW'), '维度钻取后的明细状态不一致')

  const partialAdjustedRow = buildQualityDeductionDetails({
    ...query,
    keyword: 'QC-NEW-004',
  })[0]
  assert(partialAdjustedRow, '缺少部分调整样例')
  assert(partialAdjustedRow.effectiveQualityDeductionAmount === 860, '部分调整样例的生效质量扣款金额错误')
  assert(partialAdjustedRow.totalFinancialImpactAmount === 860, '部分调整样例的当前影响金额错误')
  assert(partialAdjustedRow.adjustmentAmountSigned === -240, '部分调整样例的 adjustment 金额应单独展示为 -240')

  const reversedRow = buildQualityDeductionDetails({
    ...query,
    keyword: 'QC-021',
  })[0]
  assert(reversedRow && reversedRow.totalFinancialImpactAmount === 0, '冲回样例当前影响应为 0')
  assert(reversedRow.adjustmentAmountSigned === -540, '冲回样例 adjustment 金额应为 -540')

  const consistentRow = buildQualityDeductionDetails({
    ...query,
    keyword: 'QC-NEW-006',
  })[0]
  const platformDetail = getPlatformQcDetailViewModelByRouteKey('QC-NEW-006')
  const mobileDetail = getFutureMobileFactoryQcDetail('QC-NEW-006', 'ID-F004')
  const pdaItem = listPdaSettlementWritebackItems(new Set(['ID-F004'])).find((item) => item.qcId === 'QC-NEW-006')
  assert(consistentRow && platformDetail && mobileDetail && pdaItem, '一致性样例缺失')
  assert(consistentRow.settlementImpactStatus === platformDetail.settlementImpact.status, 'analysis 与平台详情结算状态不一致')
  assert(consistentRow.settlementImpactStatus === mobileDetail.settlementImpactStatus, 'analysis 与工厂端结算状态不一致')
  assert(consistentRow.blockedProcessingFeeAmount === platformDetail.settlementImpact.blockedProcessingFeeAmount, 'analysis 与平台详情冻结加工费不一致')
  assert(consistentRow.effectiveQualityDeductionAmount === platformDetail.settlementImpact.effectiveQualityDeductionAmount, 'analysis 与平台详情生效质量扣款金额不一致')
  assert(consistentRow.effectiveQualityDeductionAmount === mobileDetail.effectiveQualityDeductionAmount, 'analysis 与工厂端生效质量扣款金额不一致')
  assert(consistentRow.effectiveQualityDeductionAmount === pdaItem.deductionAmountCny, 'analysis 与 PDA 结算感知生效质量扣款金额不一致')

  const cycleTrend = buildQualityDeductionTrend({
    ...query,
    timeBasis: 'SETTLEMENT_CYCLE',
  })
  assert(cycleTrend.length > 0, '结算周期视角趋势为空')
  assert(cycleTrend.some((item) => item.label.includes('STL-')), '结算周期视角趋势未展示周期归属')

  const factoryQuery = {
    ...query,
    factoryId: filterOptions.factories[0]?.value ?? 'ALL',
  }
  const factoryFiltered = buildQualityDeductionDetails(factoryQuery)
  assert(factoryFiltered.every((item) => item.factoryId === factoryQuery.factoryId), '工厂筛选未生效')

  console.log(
    JSON.stringify(
      {
        qcRecordCount: kpis.qcRecordCount,
        factoryCount: kpis.factoryCount,
        blockedProcessingFeeAmount: kpis.blockedProcessingFeeAmount,
        effectiveQualityDeductionAmount: kpis.effectiveQualityDeductionAmount,
        nextCycleAdjustmentAmount: kpis.nextCycleAdjustmentAmount,
        trendBuckets: trend.length,
        factoryBreakdownRows: factoryBreakdown.length,
        pendingReviewDetailCount: drilldownDetails.length,
      },
      null,
      2,
    ),
  )
}

try {
  main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
}

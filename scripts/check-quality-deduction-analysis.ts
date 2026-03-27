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
  assert(filterOptions.factories.length >= 2, '工厂筛选维度不足')
  assert(filterOptions.processes.length >= 4, '工序筛选维度不足')
  assert(filterOptions.warehouses.length >= 2, '仓库筛选维度不足')

  const kpis = buildQualityDeductionKpis(query)
  const details = buildQualityDeductionDetails(query)
  assert(details.length === kpis.qcRecordCount, '分析总数与明细数不一致')
  assert(kpis.nextCycleAdjustmentAmount === 0, '当前主链不应再输出旧兼容调整金额')

  const trend = buildQualityDeductionTrend(query)
  assert(trend.length > 0, '趋势视图为空')
  assert(
    Math.round(trend.reduce((sum, item) => sum + item.blockedProcessingFeeAmount, 0) * 100) ===
      Math.round(kpis.blockedProcessingFeeAmount * 100),
    '趋势待确认金额与总览不一致',
  )
  assert(
    Math.round(trend.reduce((sum, item) => sum + item.effectiveQualityDeductionAmount, 0) * 100) ===
      Math.round(kpis.effectiveQualityDeductionAmount * 100),
    '趋势正式质量扣款流水金额与总览不一致',
  )
  assert(
    Math.round(trend.reduce((sum, item) => sum + item.totalFinancialImpactAmount, 0) * 100) ===
      Math.round(kpis.totalFinancialImpactAmount * 100),
    '趋势总财务影响与总览不一致',
  )

  const disputeBreakdown = buildQualityDeductionBreakdown(query, 'DISPUTE_STATUS')
  const pendingReviewGroup = disputeBreakdown.find((item) => item.key === 'PENDING_REVIEW')
  assert(Boolean(pendingReviewGroup), '缺少待平台处理异议分组')

  const pendingRow = buildQualityDeductionDetails({ ...query, keyword: 'QC-NEW-005' })[0]
  const disputingRow = buildQualityDeductionDetails({ ...query, keyword: 'QC-NEW-006' })[0]
  const partialLedgerRow = buildQualityDeductionDetails({ ...query, keyword: 'QC-NEW-004' })[0]
  const reversedRow = buildQualityDeductionDetails({ ...query, keyword: 'QC-021' })[0]
  const autoConfirmedRow = buildQualityDeductionDetails({ ...query, keyword: 'QC-RIB-202603-0003' })[0]

  assert(pendingRow?.settlementImpactStatus === 'BLOCKED', '待工厂处理样例状态错误')
  assert(pendingRow?.effectiveQualityDeductionAmount === 0, '待工厂处理样例不应提前形成正式质量扣款流水金额')
  assert(disputingRow?.disputeStatus === 'PENDING_REVIEW', '待平台处理异议样例状态错误')
  assert(disputingRow?.effectiveQualityDeductionAmount === 0, '待平台处理异议样例不应提前形成正式质量扣款流水金额')
  assert(partialLedgerRow?.effectiveQualityDeductionAmount === 860, '最终部分工厂责任样例金额错误')
  assert(partialLedgerRow?.totalFinancialImpactAmount === 860, '最终部分工厂责任样例当前影响金额错误')
  assert(reversedRow?.totalFinancialImpactAmount === 0, '最终非工厂责任样例当前影响金额应为 0')
  assert(autoConfirmedRow?.settlementImpactStatus === 'ELIGIBLE', '系统自动确认样例应已生成正式质量扣款流水')

  const platformDetail = getPlatformQcDetailViewModelByRouteKey('QC-NEW-004')
  const mobileDetail = getFutureMobileFactoryQcDetail('QC-NEW-004', 'ID-F001')
  const pdaItem = listPdaSettlementWritebackItems(new Set(['ID-F001'])).find((item) => item.qcId === 'QC-NEW-004')
  assert(platformDetail && mobileDetail && pdaItem, '多端一致性样例缺失')
  assert(partialLedgerRow?.effectiveQualityDeductionAmount === platformDetail.formalLedger?.settlementAmount, '分析视图与平台正式流水金额不一致')
  assert(mobileDetail.formalLedgerStatusLabel === '已生成正式质量扣款流水', '工厂端未同步正式质量扣款流水状态')
  assert(pdaItem.settlementStatusText === platformDetail.settlementImpactStatusLabel, '工厂端预结算感知与平台状态不一致')

  const cycleTrend = buildQualityDeductionTrend({ ...query, timeBasis: 'SETTLEMENT_CYCLE' })
  assert(cycleTrend.length > 0, '结算周期视图为空')
  assert(cycleTrend.some((item) => item.label.includes('STL-')), '结算周期视图未展示周期信息')

  console.log(
    JSON.stringify(
      {
        qcRecordCount: kpis.qcRecordCount,
        blockedProcessingFeeAmount: kpis.blockedProcessingFeeAmount,
        effectiveQualityDeductionAmount: kpis.effectiveQualityDeductionAmount,
        totalFinancialImpactAmount: kpis.totalFinancialImpactAmount,
        cycleTrendCount: cycleTrend.length,
        pendingReviewCount: pendingReviewGroup?.recordCount ?? 0,
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

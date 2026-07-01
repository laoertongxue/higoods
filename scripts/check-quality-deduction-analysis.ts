#!/usr/bin/env node

import process from 'node:process'
import {
  buildQualityDeductionAnalysisFilterOptions,
  buildQualityDeductionBreakdown,
  buildQualityDeductionDetails,
  buildQualityDeductionKpis,
  buildQualityDeductionTrend,
  buildQualityDeductionExportRows,
  createDefaultQualityDeductionAnalysisQuery,
  QUALITY_DEDUCTION_ANALYSIS_DIMENSION_LABEL,
} from '../src/data/fcs/quality-deduction-analysis.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function main(): void {
  const query = createDefaultQualityDeductionAnalysisQuery()
  const filterOptions = buildQualityDeductionAnalysisFilterOptions()
  assert(filterOptions.factories.length >= 1, '工厂筛选维度不足')
  assert(filterOptions.processes.some((item) => item.label === '质量扣款'), '缺少扣款类型筛选维度')
  assert(QUALITY_DEDUCTION_ANALYSIS_DIMENSION_LABEL.PROCESS === '按扣款类型', '维度文案未切到扣款类型')

  const kpis = buildQualityDeductionKpis(query)
  const details = buildQualityDeductionDetails(query)
  assert(details.length === kpis.qcRecordCount, '分析总数与明细数不一致')
  assert(details.length > 0, '扣款分析明细为空')
  assert(details.every((row) => row.includedSettlementStatementId), '扣款分析明细必须来自对账单确认行')
  assert(details.every((row) => row.effectiveQualityDeductionAmount >= 0), '对账单扣款金额必须为非负分析金额')
  assert(details.every((row) => row.factoryResponseStatusLabel === '对账单确认'), '扣款确认状态必须来自对账单')
  assert(kpis.blockedProcessingFeeAmount === 0, '未进入对账单的质检事实不应计入扣款分析')

  const trend = buildQualityDeductionTrend(query)
  assert(trend.length > 0, '趋势视图为空')
  assert(
    Math.round(trend.reduce((sum, item) => sum + item.effectiveQualityDeductionAmount, 0) * 100) ===
      Math.round(kpis.effectiveQualityDeductionAmount * 100),
    '趋势对账单扣款金额与总览不一致',
  )
  assert(
    Math.round(trend.reduce((sum, item) => sum + item.totalFinancialImpactAmount, 0) * 100) ===
      Math.round(kpis.totalFinancialImpactAmount * 100),
    '趋势总财务影响与总览不一致',
  )

  const processBreakdown = buildQualityDeductionBreakdown(query, 'PROCESS')
  assert(processBreakdown.some((item) => item.label === '质量扣款'), '缺少扣款类型分组')
  const responseBreakdown = buildQualityDeductionBreakdown(query, 'FACTORY_RESPONSE_STATUS')
  assert(responseBreakdown.some((item) => item.label === '对账单确认'), '缺少对账单确认分组')
  const statementBreakdown = buildQualityDeductionBreakdown(query, 'SETTLEMENT_IMPACT_STATUS')
  assert(statementBreakdown.some((item) => item.key === 'INCLUDED_IN_STATEMENT'), '缺少已进入对账单分组')

  const exportRows = buildQualityDeductionExportRows(query)
  assert(exportRows.length === details.length, '导出行数与明细不一致')
  assert(exportRows.every((row) => row.对账单编号 && row.扣款类型), '导出缺少对账单或扣款类型字段')

  const cycleTrend = buildQualityDeductionTrend({ ...query, timeBasis: 'SETTLEMENT_CYCLE' })
  assert(cycleTrend.length > 0, '结算周期视图为空')
  assert(cycleTrend.some((item) => item.label.includes('ST-LINK-')), '结算周期视图未展示对账单信息')

  console.log(
    JSON.stringify(
      {
        statementDeductionRowCount: kpis.qcRecordCount,
        statementDeductionAmount: kpis.effectiveQualityDeductionAmount,
        totalFinancialImpactAmount: kpis.totalFinancialImpactAmount,
        cycleTrendCount: cycleTrend.length,
        deductionTypeCount: processBreakdown.length,
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

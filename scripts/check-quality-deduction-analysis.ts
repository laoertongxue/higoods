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
  assert(filterOptions.processes.some((item) => item.label === '瑕疵扣款'), '缺少瑕疵扣款筛选维度')
  assert(filterOptions.processes.some((item) => item.label === '返工扣款'), '缺少返工扣款筛选维度')
  assert(QUALITY_DEDUCTION_ANALYSIS_DIMENSION_LABEL.PROCESS === '按扣款类型', '维度文案未切到扣款类型')

  const kpis = buildQualityDeductionKpis(query)
  const details = buildQualityDeductionDetails(query)
  assert(details.length === kpis.qcRecordCount, '扣款记录总数与明细数不一致')
  assert(details.length > 0, '扣款记录明细为空')
  assert(details.some((row) => row.recordSource === 'QC_REWORK_CHARGEBACK'), '扣款记录缺少质检记录返工扣款来源')
  assert(details.some((row) => row.recordSource === 'STATEMENT_FACTORY_DEFECT'), '扣款记录缺少对账单工厂瑕疵扣款来源')
  assert(details.every((row) => row.factoryName && row.productionOrderNo && row.qcNo), '扣款记录必须按工厂、生产单、质检记录维度展示')
  assert(
    details
      .filter((row) => row.recordSource === 'STATEMENT_FACTORY_DEFECT')
      .every((row) => row.includedSettlementStatementId && row.processType === 'QUALITY_DEFECT'),
    '对账单来源必须只统计工厂原因瑕疵质量扣款行',
  )
  assert(
    details
      .filter((row) => row.recordSource === 'QC_REWORK_CHARGEBACK')
      .every((row) => !row.includedSettlementStatementId && row.processType === 'POST_FACTORY_REWORK_CHARGEBACK'),
    '质检记录来源必须只统计返工扣款事实',
  )
  assert(details.every((row) => row.effectiveQualityDeductionAmount >= 0), '扣款金额必须为非负金额')

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
  assert(processBreakdown.some((item) => item.label === '瑕疵扣款'), '缺少瑕疵扣款分组')
  assert(processBreakdown.some((item) => item.label === '返工扣款'), '缺少返工扣款分组')
  const responseBreakdown = buildQualityDeductionBreakdown(query, 'FACTORY_RESPONSE_STATUS')
  assert(responseBreakdown.some((item) => item.label === '对账单确认'), '缺少对账单确认分组')
  const statementBreakdown = buildQualityDeductionBreakdown(query, 'SETTLEMENT_IMPACT_STATUS')
  assert(statementBreakdown.some((item) => item.key === 'INCLUDED_IN_STATEMENT'), '缺少已进入对账单分组')

  const exportRows = buildQualityDeductionExportRows(query)
  assert(exportRows.length === details.length, '导出行数与明细不一致')
  assert(exportRows.every((row) => row.来源类型 && row.质检记录 && row.扣款类型), '导出缺少来源类型、质检记录或扣款类型字段')

  const cycleTrend = buildQualityDeductionTrend({ ...query, timeBasis: 'SETTLEMENT_CYCLE' })
  assert(cycleTrend.length > 0, '结算周期视图为空')
  assert(cycleTrend.some((item) => item.label.includes('ST-LINK-')), '结算周期视图未展示对账单信息')

  console.log(
    JSON.stringify(
      {
        deductionRecordCount: kpis.qcRecordCount,
        deductionRecordAmount: kpis.effectiveQualityDeductionAmount,
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

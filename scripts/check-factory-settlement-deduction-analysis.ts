import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildQualityDeductionDetails,
  createDefaultQualityDeductionAnalysisQuery,
} from '../src/data/fcs/quality-deduction-analysis.ts'
import {
  canStatementEnterPrepayment,
  canStatementEnterSettlement,
  getStatementSettlementProgressView,
  initialStatementDrafts,
} from '../src/data/fcs/store-domain-settlement-seeds.ts'
import { listStatementConfirmedDeductionRows } from '../src/data/fcs/store-domain-statement-source-adapter.ts'

const source = readFileSync(new URL('../src/data/fcs/quality-deduction-analysis.ts', import.meta.url), 'utf8')
const page = readFileSync(new URL('../src/pages/deduction-analysis.ts', import.meta.url), 'utf8')
const nonPositiveDeductionStatement = initialStatementDrafts.find(
  (statement) =>
    (statement.netPayableAmount ?? statement.totalAmount) <= 0 &&
    statement.items.some((item) => item.sourceItemType === 'QUALITY_DEDUCTION'),
)

assert(nonPositiveDeductionStatement, '缺少净额非正向的扣款对账单样例')

const confirmedNonPositiveStatement = {
  ...nonPositiveDeductionStatement,
  statementId: `${nonPositiveDeductionStatement.statementId}-CONFIRMED-CHECK`,
  statementNo: `${nonPositiveDeductionStatement.statementNo ?? nonPositiveDeductionStatement.statementId}-CONFIRMED-CHECK`,
  status: 'READY_FOR_PREPAYMENT' as const,
  factoryFeedbackStatus: 'FACTORY_CONFIRMED' as const,
  resolutionResult: undefined,
  netPayableAmount: Math.min(nonPositiveDeductionStatement.netPayableAmount ?? nonPositiveDeductionStatement.totalAmount, 0),
  totalAmount: Math.min(nonPositiveDeductionStatement.totalAmount, 0),
  prepaymentBatchId: undefined,
  prepaymentBatchNo: undefined,
}

assert(canStatementEnterSettlement(confirmedNonPositiveStatement), '确认态净额非正向样例应先满足业务确认状态')
assert(!canStatementEnterPrepayment(confirmedNonPositiveStatement), '确认态净额非正向样例不应满足预付款入池条件')

initialStatementDrafts.push(confirmedNonPositiveStatement)
const rows = buildQualityDeductionDetails(createDefaultQualityDeductionAnalysisQuery())
const statementById = new Map(initialStatementDrafts.map((statement) => [statement.statementId, statement]))
const confirmedFactoryDefectRows = listStatementConfirmedDeductionRows().filter(
  (row) => row.deductionLineType === 'QUALITY_DEFECT',
)
const nonPositiveProgress = getStatementSettlementProgressView(confirmedNonPositiveStatement)

initialStatementDrafts.pop()
statementById.delete(confirmedNonPositiveStatement.statementId)

assert(source.includes('listStatementConfirmedDeductionRows'))
assert(source.includes('listPostFinishingQcOrders'))
assert(page.includes('扣款记录'))
assert(page.includes('质检记录返工扣款'))
assert(page.includes('扣款类型'))
assert(page.includes('data-danalysis-filter-row'), '扣款记录筛选条件必须是一行筛选条')
assert(page.includes('data-danalysis-action="query"'), '扣款记录筛选条必须有查询按钮')
assert(page.includes('data-danalysis-action="reset"'), '扣款记录筛选条必须有重置按钮')
assert(page.includes('data-danalysis-stat-chip'), '扣款记录统计必须使用截图中的小标签样式')
assert(rows.length > 0, '扣款记录明细不能为空')
assert(rows.some((row) => row.recordSource === 'QC_REWORK_CHARGEBACK'), '扣款记录缺少质检记录返工扣款')
assert(rows.some((row) => row.recordSource === 'STATEMENT_FACTORY_DEFECT'), '扣款记录缺少对账单瑕疵扣款')
assert(
  rows
    .filter((row) => row.recordSource === 'STATEMENT_FACTORY_DEFECT')
    .every((row) => {
    const statement = statementById.get(row.includedSettlementStatementId ?? '')
    return statement ? canStatementEnterPrepayment(statement) : false
  }),
  '对账单瑕疵扣款必须来自业务已确认且可进入预付款的对账单',
)
assert(
  !rows.some((row) => row.includedSettlementStatementId === confirmedNonPositiveStatement.statementId),
  '确认态净额非正向对账单不得进入扣款记录',
)
assert(!nonPositiveProgress.canEnterSettlement, '确认态净额非正向对账单进度视图不应允许进入预付款')
assert.notEqual(nonPositiveProgress.summary, '可进入预付款批次', '确认态净额非正向对账单不应展示可进入预付款批次')
assert.notEqual(nonPositiveProgress.detail, '可进入预付款批次', '确认态净额非正向对账单详情不应展示可进入预付款批次')
assert(
  rows
    .filter((row) => row.recordSource === 'STATEMENT_FACTORY_DEFECT')
    .every((row) => {
    const statement = statementById.get(row.includedSettlementStatementId ?? '')
    return statement?.status !== 'DRAFT' && statement?.factoryFeedbackStatus !== 'NOT_SENT'
  }),
  'DRAFT / NOT_SENT 对账单扣款行不得进入扣款记录',
)
assert(
  rows
    .filter((row) => row.recordSource === 'STATEMENT_FACTORY_DEFECT')
    .every((row) => {
    return confirmedFactoryDefectRows.some(
      (sourceRow) =>
        sourceRow.statementId === row.includedSettlementStatementId &&
        sourceRow.sourceRefLabel === row.qcNo &&
        sourceRow.deductionLineType === 'QUALITY_DEFECT',
    )
  }),
  '对账单来源只能来自 QUALITY_DEDUCTION 里的 QUALITY_DEFECT 扣款行',
)
assert(rows.every((row) => row.effectiveQualityDeductionAmount >= 0))

for (const oldFilterLabel of [
  '入仓仓库',
  '质检结果',
  '责任状态',
  '工厂响应状态',
  '异议状态',
  '结算影响状态',
  '是否存在历史金额记录',
  '是否已纳入结算单',
]) {
  assert(!page.includes(oldFilterLabel), `扣款记录页面不应继续展示旧质检筛选：${oldFilterLabel}`)
}

console.log('check:factory-settlement-deduction-analysis passed')

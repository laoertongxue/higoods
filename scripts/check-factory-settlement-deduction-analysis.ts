import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildQualityDeductionDetails,
  createDefaultQualityDeductionAnalysisQuery,
} from '../src/data/fcs/quality-deduction-analysis.ts'
import {
  canStatementEnterSettlement,
  initialStatementDrafts,
} from '../src/data/fcs/store-domain-settlement-seeds.ts'

const source = readFileSync(new URL('../src/data/fcs/quality-deduction-analysis.ts', import.meta.url), 'utf8')
const page = readFileSync(new URL('../src/pages/deduction-analysis.ts', import.meta.url), 'utf8')
const rows = buildQualityDeductionDetails(createDefaultQualityDeductionAnalysisQuery())
const statementById = new Map(initialStatementDrafts.map((statement) => [statement.statementId, statement]))

assert(source.includes('listStatementConfirmedDeductionRows'))
assert(page.includes('对账单扣款'))
assert(page.includes('扣款类型'))
assert(rows.length > 0, '扣款分析明细不能为空')
assert(rows.every((row) => row.includedSettlementStatementId), '扣款分析明细必须来自对账单确认行')
assert(
  rows.every((row) => {
    const statement = statementById.get(row.includedSettlementStatementId ?? '')
    return statement ? canStatementEnterSettlement(statement) : false
  }),
  '扣款分析明细必须来自业务已确认且可进入预付款的对账单',
)
assert(
  rows.every((row) => {
    const statement = statementById.get(row.includedSettlementStatementId ?? '')
    return statement?.status !== 'DRAFT' && statement?.factoryFeedbackStatus !== 'NOT_SENT'
  }),
  'DRAFT / NOT_SENT 对账单扣款行不得进入扣款分析',
)
assert(
  rows.every((row) => {
    const statement = statementById.get(row.includedSettlementStatementId ?? '')
    const sourceItem = statement?.items.find(
      (item) => item.sourceItemId === row.qcNo || item.sourceRefLabel === row.qcNo,
    )
    return sourceItem?.sourceItemType === 'QUALITY_DEDUCTION'
  }),
  '扣款分析明细只能来自 QUALITY_DEDUCTION 对账单行',
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
  assert(!page.includes(oldFilterLabel), `扣款分析页面不应继续展示旧质检筛选：${oldFilterLabel}`)
}

console.log('check:factory-settlement-deduction-analysis passed')

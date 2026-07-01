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
assert(rows.every((row) => row.effectiveQualityDeductionAmount >= 0))

console.log('check:factory-settlement-deduction-analysis passed')

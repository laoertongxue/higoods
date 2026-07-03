import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { indonesiaFactories } from '../src/data/fcs/indonesia-factories.ts'
import { listSettlementStatementsByParty } from '../src/data/fcs/store-domain-settlement-seeds.ts'
import { listQcFactRows } from '../src/pages/qc-records/fact-view.ts'

const pda = readFileSync(new URL('../src/pages/pda-settlement.ts', import.meta.url), 'utf8')

function assertIncludes(source: string, token: string): void {
  assert.ok(source.includes(token), `PDA 结算缺少：${token}`)
}

function assertNotIncludes(source: string, token: string): void {
  assert.equal(source.includes(token), false, `PDA 结算不应出现：${token}`)
}

for (const token of [
  "type SettlementPageMode = 'home' | 'statement-list' | 'quality-list'",
  "type StatementFilterView = 'all' | 'pending-confirm' | 'disputing' | 'unpaid' | 'paid'",
  "type QualityRecordFilterView = 'all' | 'not-in-statement' | 'in-statement' | 'rework' | 'deducted'",
  'function buildSettlementHomeViewModel(',
  'function renderSettlementHomePage(',
  'function renderStatementListPage(',
  'function renderQualityRecordListPage(',
  'function renderQualityRecordDrawer(',
  '累计收入',
  '累计扣款',
  '已付款',
  '未付款',
  '未结算',
  '参考金额',
  '对账单',
  '质检记录',
  '结算资料',
  '结算明细',
  'data-pda-sett-action="open-statement-list"',
  'data-pda-sett-action="open-quality-list"',
  'data-pda-sett-action="open-settlement-profile"',
  'data-pda-sett-action="open-quality-record-detail"',
  'listQcFactRows',
  'hasPdaSettlementPermission',
  'SETTLEMENT_VIEW',
  'SETTLEMENT_CONFIRM',
  'SETTLEMENT_DISPUTE',
  'SETTLEMENT_CHANGE_REQUEST',
]) {
  assertIncludes(pda, token)
}

for (const token of [
  'type DetailTab =',
  'LedgerTypeView',
  'LedgerStatusView',
  'renderLedgersTab',
  'renderLedgerDrawer',
  '正式流水查看区',
  '对账与预付款',
  '预付款批次',
  '飞书付款审批编号',
  '申请付款',
  '打款回写',
  'data-batch-action=',
  'open-statement-payment',
]) {
  assertNotIncludes(pda, token)
}

const factoriesWithStatements = indonesiaFactories.filter((factory) => listSettlementStatementsByParty(factory.id).length > 0)
assert.ok(factoriesWithStatements.length > 0, '缺少 PDA 对账单样例')

const statements = factoriesWithStatements.flatMap((factory) => listSettlementStatementsByParty(factory.id))
assert.ok(statements.some((statement) => statement.factoryFeedbackStatus === 'WAIT_FACTORY_CONFIRM'), '缺少待确认对账单样例')
assert.ok(statements.some((statement) => statement.factoryFeedbackStatus === 'FACTORY_APPEALED'), '缺少异议中对账单样例')
assert.ok(statements.some((statement) => statement.prepaidAt || statement.paymentWritebackId || statement.status === 'PREPAID'), '缺少已付款对账单样例')
assert.ok(statements.some((statement) => !(statement.prepaidAt || statement.paymentWritebackId || statement.status === 'PREPAID')), '缺少未付款对账单样例')

const qcRows = listQcFactRows({ includeLegacy: false })
assert.ok(qcRows.some((row) => row.settlementTrace.statusLabel === '已进入对账' && row.settlementTrace.statementNo), '缺少已进对账质检记录样例')
assert.ok(qcRows.some((row) => row.settlementTrace.statusLabel !== '已进入对账'), '缺少未进对账质检记录样例')
assert.ok(qcRows.some((row) => row.reworkQty > 0), '缺少有返工质检记录样例')
assert.ok(qcRows.some((row) => row.reworkChargebackAmountText !== '—'), '缺少有扣款质检记录样例')

console.log('check:factory-settlement-pda passed')

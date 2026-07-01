import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/pages/statements.ts', import.meta.url), 'utf8')
let html = ''
try {
  html = (await import('../src/pages/statements.ts')).renderStatementsPage()
} catch {
  html = ''
}

for (const token of [
  'data-stm-build-field="start-date"',
  'data-stm-build-field="end-date"',
  'data-stm-build-field="object-mode"',
  'data-stm-build-field="currency"',
  '按预结算流水',
  '按生产单',
  '反查生产单',
  '未完成，不纳入本期对账',
  '差 ',
  '裁片完成数量',
  '结算口径累计交出',
  '后道返工反扣',
  '本期应付净额',
]) {
  assert(source.includes(token) || html.includes(token), `缺少对账单生成口径：${token}`)
}

assert(!source.includes('必须先选工厂和结算周期，再自动加载该范围内的回货批次明细行'))
assert(source.includes('buildStatementDraftLinesFromSettlementSelection'))
assert(source.includes('buildProductionOrderSettlementProjections'))
assert(source.includes('listStatementEligiblePreSettlementLedgersByRange'))
assert(!source.includes('listStatementBuildCandidates(selectedScope.settlementPartyId, selectedScope.settlementCycleId)'))
assert(!source.includes('当前工厂和结算周期暂无可'))

console.log('check:factory-settlement-statements passed')

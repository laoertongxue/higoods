import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pda = readFileSync(new URL('../src/pages/pda-settlement.ts', import.meta.url), 'utf8')
const batches = readFileSync(new URL('../src/pages/batches.ts', import.meta.url), 'utf8')

for (const token of ['应付', '扣款', '本期净额', '来源质检单', '确认对账单', '发起申诉', '打款结果']) {
  assert(pda.includes(token), `PDA 结算缺少：${token}`)
}

for (const forbidden of ['data-pda-sett-field="deduction-amount"', 'data-pda-sett-field="currency"', '修改扣款金额']) {
  assert(!pda.includes(forbidden), `PDA 不允许核算编辑：${forbidden}`)
}

assert(batches.includes('只消费已确认可付款对账单') || batches.includes('已确认可付款对账单'))
assert(batches.includes('锁账') || batches.includes('金额锁定'))

console.log('check:factory-settlement-pda passed')

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../../src/data/fcs/store-domain-statement-source-adapter.ts', import.meta.url), 'utf8')
const ast = ts.createSourceFile('adapter.ts', source, ts.ScriptTarget.Latest, true)
const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'listStatementBuildScopes')!
const javascript = ts.transpileModule(declaration.getText(ast).replace(/^export /, ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText

type Ledger = { factoryId: string; settlementCycleId: string; settlementCycleLabel: string; settlementCycleStartAt: string; settlementCycleEndAt: string; plannedPrepaymentAt?: string; ledgerType: string; qty: number; settlementAmount: number }
const ledger = (factoryId: string, ledgerType: string, qty: number, settlementAmount: number, cycle = '2026-10', plannedPrepaymentAt?: string): Ledger => ({
  factoryId, ledgerType, qty, settlementAmount, settlementCycleId: cycle, settlementCycleLabel: cycle,
  settlementCycleStartAt: cycle + '-01', settlementCycleEndAt: cycle + '-28', plannedPrepaymentAt,
})

test('statement scope totals use eligible ledger fields without constructing full source traces', () => {
  let rows = [ledger('B', 'TASK_EARNING', 2.5, 10.25), ledger('B', 'QUALITY_DEDUCTION', 0.5, 1.125, '2026-10', '2026-11-04'), ledger('A', 'TASK_EARNING', 3, 7.5), ledger('A', 'QUALITY_DEDUCTION', 1, 2, '2026-09')]
  const original = structuredClone(rows)
  const list = new Function('listStatementEligiblePreSettlementLedgers', 'normalizeSettlementPartyId', 'buildPartyLabel', 'mapLedgerToStatementSourceItem', `${javascript}; return listStatementBuildScopes`)(
    () => rows, (id: string) => id, (_type: string, id: string) => id,
    () => { throw new Error('scope aggregation must not build full source trace views') },
  ) as () => unknown[]
  const expected = (id: string, cycle: string, values: object) => ({ settlementPartyType: 'FACTORY', settlementPartyId: id, settlementPartyLabel: id, settlementCycleId: cycle, settlementCycleLabel: cycle, settlementCycleStartAt: cycle + '-01', settlementCycleEndAt: cycle + '-28', plannedPrepaymentAt: undefined, candidateCount: 1, earningLedgerCount: 1, deductionLedgerCount: 0, ...values })
  assert.deepEqual(list(), [
    expected('A', '2026-10', { totalQty: 3, totalEarningAmount: 7.5, totalDeductionAmount: 0, netPayableAmount: 7.5 }),
    expected('B', '2026-10', { candidateCount: 2, deductionLedgerCount: 1, plannedPrepaymentAt: '2026-11-04', totalQty: 3, totalEarningAmount: 10.25, totalDeductionAmount: 1.125, netPayableAmount: 9.125 }),
    expected('A', '2026-09', { earningLedgerCount: 0, deductionLedgerCount: 1, totalQty: 1, totalEarningAmount: 0, totalDeductionAmount: 2, netPayableAmount: -2 }),
  ])
  assert.deepEqual(rows, original, 'aggregation must not change source ledgers')
  rows = [ledger('A', 'TASK_EARNING', 0.25, 1.125)]
  assert.deepEqual(list(), [expected('A', '2026-10', { totalQty: 0.25, totalEarningAmount: 1.125, totalDeductionAmount: 0, netPayableAmount: 1.125 })], 'each call must read current ledgers without a stale cache')
  rows = []
  assert.deepEqual(list(), [])
})

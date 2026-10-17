import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import { isIsolatedCraftReadEntry } from '../../src/main-infrastructure/craft-read-entry.ts'
import { buildSpecialCraftTaskOrdersPath, listEnabledSpecialCraftOperationDefinitions } from '../../src/data/fcs/special-craft-operations.ts'

function variants(path: string): string[] {
  return [path, path + '/', path + '?source=list', path + '#details', path + '/?source=list#details']
}

test('all 16 actual enabled craft work-order lists and single-segment details are isolated read entries', () => {
  const operations = listEnabledSpecialCraftOperationDefinitions()
  assert.equal(operations.length, 16)
  assert.equal(new Set(operations.map(operation => operation.operationId)).size, 16)
  for (const operation of operations) {
    const list = buildSpecialCraftTaskOrdersPath(operation)
    for (const base of [list, list + '/ORDER-001', list + '/ORDER%2F001']) {
      for (const path of variants(base)) assert.equal(isIsolatedCraftReadEntry(path), true, path)
    }
  }
})

test('wool knitting/linking list/detail and web/PDA pending receipts keep the same bounded read entry', () => {
  for (const stage of ['knitting-orders', 'linking-orders']) {
    for (const base of [`/fcs/craft/wool/${stage}`, `/fcs/craft/wool/${stage}/MWO-001`, `/fcs/craft/wool/${stage}/MWO%2F001`]) {
      for (const path of variants(base)) assert.equal(isIsolatedCraftReadEntry(path), true, path)
    }
  }
  for (const base of ['/fcs/craft/wool/pending-receipts', '/fcs/pda/wool/pending-receipts']) {
    for (const path of variants(base)) assert.equal(isIsolatedCraftReadEntry(path), true, path)
  }
})

test('PDA wool execution recognizes the once-decoded KNITTING/LINKING suffix on one URL segment', () => {
  for (const stage of ['KNITTING', 'LINKING']) {
    for (const id of [`WOOL:MWO-001:${stage}`, `WOOL%3AMWO-001%3A${stage}`, `WOOL%3aMWO-001%3a${stage}`]) {
      for (const path of variants('/fcs/pda/exec/' + id)) assert.equal(isIsolatedCraftReadEntry(path), true, path)
    }
  }
})

test('unknown, nested, print, warehouse and adjacent routes are excluded', () => {
  const rejected = [
    '', '/', 'https://example.com/fcs/craft/wool/knitting-orders',
    '/fcs/process-factory/special-craft/unknown/work-orders',
    '/fcs/process-factory/special-craft/aux-op-unknown/work-orders',
    '/fcs/process-factory/special-craft/aux%2Dop-dalan/work-orders',
    '/fcs/process-factory/special-craft/AUX-OP-DALAN/work-orders',
    '/fcs/process-factory/special-craft/aux-op-dalan',
    '/fcs/process-factory/special-craft/aux-op-dalan/work-orders//',
    '/fcs/process-factory/special-craft/aux-op-dalan/work-orders/ORDER/nested',
    '/fcs/process-factory/special-craft/aux-op-dalan/work-orders/ORDER/handover-print',
    '/fcs/process-factory/special-craft/aux-op-dalan/wait-process-warehouse',
    '/fcs/craft/wool/knitting-orders/ORDER/handover-print',
    '/fcs/craft/wool/linking-orders/ORDER/nested', '/fcs/craft/wool/knitting-orders//',
    '/fcs/craft/wool/pending-receipts/ORDER', '/fcs/pda/wool/pending-receipts/ORDER',
    '/fcs/craft/wool/machines', '/fcs/process-factory/wool/machine-associations',
    '/fcs/craft/wool/wait-process-warehouse', '/fcs/craft/wool/wait-handover-warehouse',
    '/fcs/craft/wool/work-orders', '/fcs/craft/printing/work-orders', '/fcs/craft/dyeing/work-orders',
    '/fcs/pda/exec/TASK-PRINT-001', '/fcs/pda/exec/TASK-SEW-001', '/fcs/pda/exec/TASKGEN-001',
    '/fcs/pda/exec/WOOL:MWO-001:KNITTING/nested', '/fcs/pda/exec/WOOL:MWO-001:KNITTING//',
    '/fcs/pda/printing/exec/WOOL:MWO-001:KNITTING', '/fcs/pda/exec',
    '/fcs/pda/exec/WOOL:MWO-001:knitting', '/fcs/pda/exec/WOOL:MWO-001:LINKING-extra',
    '/fcs/pda/exec/TASK-PRINT-001?task=:KNITTING', '/fcs/pda/exec/TASK-SEW-001#task=:LINKING',
    '/fcs/sewing-outsourcing/daily-return-report', '/fcs/craft/post-finishing/wait-process-warehouse',
  ]
  for (const path of rejected) assert.equal(isIsolatedCraftReadEntry(path), false, path)
})

test('malformed or double-encoded PDA task identity cannot opt into wool read initialization', () => {
  for (const id of ['WOOL%:KNITTING', 'WOOL%E0%A4%A:LINKING', '%FF%3AKNITTING', 'WOOL%253AKNITTING']) {
    assert.doesNotThrow(() => isIsolatedCraftReadEntry('/fcs/pda/exec/' + id))
    assert.equal(isIsolatedCraftReadEntry('/fcs/pda/exec/' + id), false, id)
  }
})

test('helper has no imports and evaluates/calls without browser, storage or fetch effects', () => {
  const source = readFileSync(new URL('../../src/main-infrastructure/craft-read-entry.ts', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('craft-read-entry.ts', source, ts.ScriptTarget.Latest, true)
  assert.equal(ast.statements.some(node => ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node)), false)
  const context: Record<string, unknown> = { exports: {} }
  for (const key of ['window', 'document', 'localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'require']) {
    Object.defineProperty(context, key, { get: () => { throw Error('Unexpected effect: ' + key) } })
  }
  const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  runInNewContext(javascript, context)
  const predicate = (context.exports as { isIsolatedCraftReadEntry: (path: string) => boolean }).isIsolatedCraftReadEntry
  assert.equal(predicate('/fcs/process-factory/special-craft/aux-op-dalan/work-orders'), true)
  assert.equal(predicate('/fcs/pda/exec/WOOL%3AMWO-001%3AKNITTING'), true)
  assert.equal(predicate('/fcs/pda/exec/%FF%3AKNITTING'), false)
  assert.equal(predicate('/pms/purchase-suggestions'), false)
})

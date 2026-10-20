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

test('four affected settlement/quality/dye-report read entries are exact and do not include action or detail routes', () => {
  for (const base of ['/fcs/settlement/adjustments', '/fcs/settlement/statements', '/fcs/quality/deduction-analysis', '/fcs/craft/dyeing/reports']) {
    for (const path of [base, base + '?source=list', base + '#details']) assert.equal(isIsolatedCraftReadEntry(path), true, path)
    for (const suffix of ['-extra', '/', '/detail', '//']) assert.equal(isIsolatedCraftReadEntry(base + suffix), false, base + suffix)
  }
})

test('裁床日报精确隔离无关采购初始化，query/hash/尾斜杠不改变范围，邻接业务不受影响', () => {
  for (const path of variants('/fcs/craft/cutting/statistics/daily-production')) assert.equal(isIsolatedCraftReadEntry(path), true, path)
  for (const path of ['/fcs/craft/cutting/statistics/daily-production/details', '/fcs/craft/cutting/statistics/daily-production-extra', '/fcs/craft/cutting/cut-orders', '/pms/material-requirements']) assert.equal(isIsolatedCraftReadEntry(path), false, path)
})

test('日报无effects时不启动无关产物，已有effects仍完整await恢复，失败可重试', async () => {
  const source = readFileSync(new URL('../../src/main.ts', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('main.ts', source, ts.ScriptTarget.Latest, true)
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'hydrateProductionSourceEffectsForEntry')!
  const js = ts.transpileModule(fn.getText(ast).replaceAll('import(', 'loadModule('), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const build = (effects: string | null, fail = false) => {
    const reads: string[] = []
    const deps = {
      isIsolatedCraftReadEntry,
      productionSourceEffectsHydration: undefined as Promise<void> | undefined,
      loadModule: async (path: string) => {
        reads.push(path)
        if (path.endsWith('/production-context-records.ts')) return { PRODUCTION_CONTEXT_KEYS: { effects: 'effects' }, productionContextStorage: { getItem: (key: string) => { assert.equal(key, 'effects'); return effects } } }
        assert.ok(path.endsWith('/production-context-actions.ts'))
        return { hydrateProductionSourceEffects: async () => { await new Promise(resolve => setImmediate(resolve)); if (fail) throw Error('saved source read failed'); reads.push('restored') } }
      },
    }
    return { deps, reads, run: new Function('dependencies', `with (dependencies) { ${js}; return hydrateProductionSourceEffectsForEntry; }`)(deps) as (path: string) => Promise<void> }
  }
  const empty = build(null)
  await empty.run('/fcs/craft/cutting/statistics/daily-production')
  assert.equal(empty.reads.some(path => path.includes('actions')), false)
  const saved = build('existing saved effects')
  await saved.run('/fcs/craft/cutting/statistics/daily-production')
  assert.equal(saved.reads.at(-1), 'restored')
  const adjacent = build(null)
  await adjacent.run('/pms/material-purchase-orders')
  assert.equal(adjacent.reads.at(-1), 'restored')
  const fault = build('existing saved effects', true)
  await assert.rejects(fault.run('/fcs/craft/cutting/statistics/daily-production'), /saved source read failed/)
  assert.equal(fault.deps.productionSourceEffectsHydration, undefined)
})


test('入驻只跳过无关采购初始化，原PCS/FCS准备与PDA处理器保持，邻接路径不受影响', () => {
  const source = readFileSync(new URL('../../src/main.ts', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('main.ts', source, ts.ScriptTarget.Latest, true)
  const render = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'renderCurrentPageContent')!
  let condition: ts.Expression | undefined
  const visit = (node: ts.Node) => {
    if (ts.isIfStatement(node) && node.thenStatement.getText(ast) === 'startPmsInitialization()') condition = node.expression
    ts.forEachChild(node, visit)
  }
  visit(render)
  assert.ok(condition)
  const initialize = new Function('normalizedPathname', 'isIsolatedCraftReadEntry', `
    const factoryReceiptReadEntry = false, isolatedPcsList = false, postFinishingEntry = false,
      cuttingReleaseChainEntry = false, sewingPdaExecutionOrHandover = false, generatedPdaTask = null;
    return ${condition.getText(ast)};
  `) as (path: string, isolated: typeof isIsolatedCraftReadEntry) => boolean
  assert.equal(initialize('/fcs/pda/auth/onboarding', isIsolatedCraftReadEntry), false)
  for (const route of ['/fcs/pda/auth/onboarding-extra', '/fcs/pda/auth/onboarding/details', '/pms/material-purchase-orders']) {
    assert.equal(initialize(route, isIsolatedCraftReadEntry), true, route)
  }
  // This change modifies only the procurement condition; the exact onboarding
  // renderer is still resolved after the original shared preparation.
  assert.doesNotMatch(render.getText(ast), /return \(await import\('\.\/pages\/pda-onboarding/)
  assert.match(render.getText(ast), /await preparePageRouteEntry\(normalizedPathname\)/)
})

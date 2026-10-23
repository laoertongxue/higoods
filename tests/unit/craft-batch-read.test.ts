import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

function sourceDeclarations(path: string, functions: string[], variables: string[] = []): string {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
  for (const name of functions) assert.ok(ast.statements.some(node => ts.isFunctionDeclaration(node) && node.name?.text === name), name)
  const nodes = ast.statements.filter(node => ts.isFunctionDeclaration(node)
    ? functions.includes(node.name?.text || '')
    : ts.isVariableStatement(node) && node.declarationList.declarations.some(d => ts.isIdentifier(d.name) && variables.includes(d.name.text)))
  return ts.transpileModule(nodes.map(node => node.getText(ast).replace(/^export /, '')).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
}

test('pickup batch reads use their matching current head while ordinary/mismatched reads retain live lookup and records', () => {
  const code = sourceDeclarations('../../src/data/fcs/pda-handover-events.ts', ['getPdaPickupRecordsByHead'])
  let lookups = 0
  const current = { handoverId: 'PICKUP-1', headType: 'PICKUP', qtyExpectedTotal: 7 }
  const execute = new Function('dependencies', `with(dependencies){${code};return getPdaPickupRecordsByHead}`)({
    findHead: (id: string) => { lookups++;return id === current.handoverId ? current : undefined },
    getPickupRecordsForHeadInternal: (head: typeof current) => [{ head: head.handoverId, qty: head.qtyExpectedTotal }],
  })
  assert.deepEqual(execute('PICKUP-1', current), [{ head: 'PICKUP-1', qty: 7 }])
  assert.equal(lookups, 0)
  assert.deepEqual(execute('PICKUP-1'), [{ head: 'PICKUP-1', qty: 7 }])
  assert.deepEqual(execute('PICKUP-1', { ...current, handoverId: 'OTHER' }), [{ head: 'PICKUP-1', qty: 7 }])
  assert.deepEqual(execute('MISSING'), [])
  assert.deepEqual(execute('PICKUP-1', { ...current, headType: 'HANDOUT' }), [])
  assert.equal(lookups, 3)
})

test('one render reads each production snapshot once, including missing snapshots; reset reads current committed values', () => {
  const code = sourceDeclarations('../../src/pages/process-factory/special-craft/order-display.ts',
    ['productionSnapshot', 'buildContext', 'resetSpecialCraftDisplayContext', 'context'], ['productionSnapshots', 'contexts'])
  const reads: string[] = [], state = { version: 'v1' }
  const api = new Function('dependencies', `with(dependencies){let handoversByOrder;${code};return {context,resetSpecialCraftDisplayContext}}`)({
    productionOrders: [{ productionOrderId: 'PO-1' }],
    getProductionOrderTechPackSnapshot: (id: string) => { reads.push(id);return id === 'MISSING' ? undefined : { version: state.version, bomItems: [] } },
    handoverRecords: () => [],
  })
  const first = { productionOrderId: 'PO-1', demandLines: [] }
  const second = { productionOrderId: 'PO-1', demandLines: [] }
  assert.equal(api.context(first).snapshot.version, 'v1')
  assert.equal(api.context(second).snapshot.version, 'v1')
  api.context({ productionOrderId: 'MISSING' });api.context({ productionOrderId: 'MISSING' })
  assert.deepEqual(reads, ['PO-1', 'MISSING'])
  state.version = 'v2';api.resetSpecialCraftDisplayContext()
  assert.equal(api.context(first).snapshot.version, 'v2')
  assert.deepEqual(reads, ['PO-1', 'MISSING', 'PO-1'])
})

test('the actual prepared detail entry starts a fresh display context after preparation and on a later direct task entry', async () => {
  const display = sourceDeclarations('../../src/pages/process-factory/special-craft/order-display.ts',
    ['productionSnapshot', 'buildContext', 'resetSpecialCraftDisplayContext', 'context'], ['productionSnapshots', 'contexts'])
  const entrySource = sourceDeclarations('../../src/pages/process-factory/special-craft/task-detail.ts', ['renderSpecialCraftTaskDetailPage'])
  const entry = entrySource.replace("await (await import('../../../data/fcs/special-craft-records.ts')).ensureSpecialCraftRecords();", 'await prepareSpecialCraftRecords();')
  assert.notEqual(entry, entrySource, 'the real record-preparation boundary must remain present')
  const reads: string[] = [], state = { version: 'v1', failPreparation: false, afterPreparationVersion: '' }
  const preparations: string[] = []
  const tasks = new Map([['TASK-A', { productionOrderId: 'PO-1', demandLines: [] }], ['TASK-B', { productionOrderId: 'PO-1', demandLines: [] }]])
  const api = new Function('dependencies', `with(dependencies){let handoversByOrder;${display};${entry};
    function renderSpecialCraftTaskDetail(slug,id,source){
      const task=tasks.get(id);const first=context(task),second=context({...task});
      return [source.prepared,first.snapshot.version,second.snapshot.version].join('|');
    }
    return {context,entry:renderSpecialCraftTaskDetailPage}}`)({
    tasks, productionOrders: [{ productionOrderId: 'PO-1' }], handoverRecords: () => [],
    getProductionOrderTechPackSnapshot: (id: string) => { reads.push(state.version);return { version: state.version, bomItems: [] } },
    prepareSpecialCraftRecords: async () => { preparations.push('records') },
    readPreparedProcessOrderTaskDetail: async (render: (source: { prepared: boolean }) => string) => {
      preparations.push('sources')
      await Promise.resolve()
      if (state.failPreparation) throw Error('saved source unavailable')
      if (state.afterPreparationVersion) state.version = state.afterPreparationVersion
      return render({ prepared: true })
    },
  })
  assert.equal(api.context(tasks.get('TASK-A')).snapshot.version, 'v1')
  state.version = 'v2'
  assert.equal(await api.entry('aux-op-dalan', 'TASK-B'), 'true|v2|v2')
  assert.deepEqual(preparations, ['records', 'sources'])
  assert.deepEqual(reads, ['v1', 'v2'], 'one fresh snapshot for this render, reused by its two identity consumers')
  state.afterPreparationVersion = 'v3'
  assert.equal(await api.entry('aux-op-dalan', 'TASK-A'), 'true|v3|v3', 'read the restored version after the original async preparation')
  state.failPreparation = true
  await assert.rejects(api.entry('aux-op-dalan', 'TASK-B'), /saved source unavailable/)
  state.failPreparation = false;state.afterPreparationVersion = 'v4'
  assert.equal(await api.entry('aux-op-dalan', 'TASK-B'), 'true|v4|v4')
  assert.deepEqual(reads, ['v1', 'v2', 'v3', 'v4'])
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

test('a known printing source uses its current getter, without enumerating other printing, dyeing or water orders', () => {
  const source = readFileSync(new URL('../../src/data/fcs/factory-qc.ts', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('factory-qc.ts', source, ts.ScriptTarget.Latest, true)
  const node = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'listFactoryQcSources')!
  const code = ts.transpileModule(node.getText(ast).replace('export ', ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const calls: string[] = [], view: any = { workOrderId: 'PRINT-1', printOrderNo: 'P1', output: { qtyUnit: 'Yard', sku: 'SKU-1', materialName: '原料', imageUrl: '/actual.png' }, plannedInput: { sku: 'SKU-1' }, barcodes: [], productionBatches: [], handover: {}, demandSource: {} }
  const forbidden = () => { throw Error('unrelated full source read') }
  const deps = {
    listPrintingWorkOrders: forbidden, listDyeWorkOrders: forbidden, listWaterSolubleWorkOrders: forbidden,
    captureDyeProcessMutationState: forbidden, listWaterOutputRows: forbidden,
    getPrintingWorkOrderById: (id: string) => { calls.push(id); return id === 'PRINT-1' ? structuredClone(view) : undefined },
    getPrintWorkOrderById: (id: string) => ({ printOrderId: id, status: 'IN_PROGRESS', printFactoryId: 'SOURCE' }),
    addActualHandfeelTransfers: (value: unknown) => value, partner: () => ({ kind: 'UNKNOWN' }),
  }
  const project = new Function('deps', `with(deps){${code};return listFactoryQcSources}`)(deps)
  assert.equal(project({ kind: 'PRINTING', id: 'PRINT-1' })[0].materialSku, 'SKU-1')
  view.output.sku = 'SKU-CHANGED'
  assert.equal(project({ kind: 'PRINTING', id: 'PRINT-1' })[0].materialSku, 'SKU-CHANGED', 'later commands read changed original facts')
  assert.deepEqual(project({ kind: 'PRINTING', id: 'missing' }), [])
  assert.deepEqual(project({ kind: 'STENTER_HAND_FEEL', id: 'actual-output' }), [])
  assert.deepEqual(calls, ['PRINT-1', 'PRINT-1', 'missing'])
})

test('three actual domain source getters retain the complete-list projection for the same original order', async () => {
  const api = await import('../../src/data/fcs/factory-qc.ts')
  api.listFactoryQcSources() // Prepare the original static domain relations once.
  for (const kind of ['PRINTING', 'DYEING', 'WATER_SOLUBLE'] as const) {
    const source = api.listFactoryQcSources().find(row => row.kind === kind)
    assert.ok(source, kind)
    assert.deepEqual(api.listFactoryQcSources(source), [source], kind)
    assert.deepEqual(api.listFactoryQcSources({ kind, id: '__missing_source__' }), [])
  }
})

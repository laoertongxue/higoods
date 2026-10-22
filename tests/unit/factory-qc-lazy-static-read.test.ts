import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import { qcIdForSource } from '../../src/data/fcs/factory-qc-model.ts'

const path = new URL('../../src/data/fcs/factory-qc.ts', import.meta.url)
function facade() {
  const source = ts.createSourceFile('factory-qc.ts', readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)
  const names = ['ensureFactoryQcRecords', 'visibleState', 'staticQc']
  const functions = source.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text || ''))
  const declarations = source.statements.filter(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(row => ['staticState', 'listFactoryQcOrders', 'listStenterHandfeelOrders', 'getFactoryQcOrder'].includes(row.name.getText(source))))
  const code = ts.transpileModule([...declarations, ...functions].map(node => node.getText(source).replace(/^export /, '')).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const events: string[] = [], state = { qcOrders: [{ id: 'saved-qc', kind: 'PRINTING' }], handfeelOrders: [{ id: 'saved-handfeel' }], actions: [] }
  const deps = {
    qcIdForSource,
    ensureRecords: async (force: boolean) => { events.push('read:' + force) },
    readFactoryQcState: () => structuredClone(state),
    emptyFactoryQcState: () => ({ qcOrders: [], handfeelOrders: [], actions: [] }),
    listFactoryQcSources: () => { events.push('enumerate-static-sources'); return [{ kind: 'PRINTING', id: 'static-source', demo: true, hasFinalOutput: true, imageUrl: '/real-material.png' }] },
    upsertFactoryQc: (target: typeof state) => { target.qcOrders.push({ id: 'static-qc', kind: 'PRINTING' }) },
  }
  const api = new Function('deps', `with(deps){${code};return {ensureFactoryQcRecords,listFactoryQcOrders,listStenterHandfeelOrders,getFactoryQcOrder}}`)(deps)
  return { events, api }
}

test('committed-record hydration and handfeel reads do not enumerate unrelated static QC sources', async () => {
  const { api, events } = facade()
  await api.ensureFactoryQcRecords()
  assert.deepEqual(api.listStenterHandfeelOrders(), [{ id: 'saved-handfeel' }])
  await api.ensureFactoryQcRecords(true)
  assert.deepEqual(events, ['read:false', 'read:true'])
})

test('the QC list still exposes static examples beside saved records and builds that read projection only once', async () => {
  const { api, events } = facade()
  await api.ensureFactoryQcRecords()
  assert.deepEqual(api.listFactoryQcOrders('PRINTING').map((row: { id: string }) => row.id), ['static-qc', 'saved-qc'])
  assert.deepEqual(api.listFactoryQcOrders('PRINTING').map((row: { id: string }) => row.id), ['static-qc', 'saved-qc'])
  assert.deepEqual(events, ['read:false', 'enumerate-static-sources'])
})

test('saved QC and absent actual handfeel-output QC do not enumerate unrelated demos; demo lookup remains available', () => {
  const { api, events } = facade()
  assert.equal(api.getFactoryQcOrder('saved-qc').id, 'saved-qc')
  assert.equal(api.getFactoryQcOrder(qcIdForSource({ kind: 'STENTER_HAND_FEEL', id: 'actual-handfeel' })), undefined)
  assert.deepEqual(events, [])
  assert.equal(api.getFactoryQcOrder('static-qc').id, 'static-qc')
  assert.deepEqual(events, ['enumerate-static-sources'])
  assert.equal(api.getFactoryQcOrder('saved-qc').id, 'saved-qc')
  assert.deepEqual(events, ['enumerate-static-sources'])
})

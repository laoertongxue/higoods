import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../../src/data/fcs/pda-handover-events.ts', import.meta.url), 'utf8')
const ast = ts.createSourceFile('pda-handover-events.ts', source, ts.ScriptTarget.Latest, true)
function declarations(names: string[]): string {
  const nodes = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text || ''))
  assert.equal(nodes.length, names.length)
  return ts.transpileModule(nodes.map(node => node.getText(ast).replace(/^export /, '')).join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
}

function reader(legacyLookup = false) {
  const state = {
    heads: [
      { handoverId: 'PICKUP-1', headType: 'PICKUP' },
      { handoverId: 'HANDOUT-1', headType: 'HANDOUT', taskId: 'TASK-1', factoryId: 'F-1', sourceFactoryName: '工厂一', qtyUnit: '片' },
      { handoverId: 'HANDOUT-2', handoverOrderId: 'HO-2', headType: 'HANDOUT', taskId: 'TASK-2', factoryId: 'F-2', sourceFactoryName: '工厂二', receiverKind: 'FACTORY', receiverId: 'F-3', receiverName: '下游工厂', qtyUnit: 'kg' },
    ] as Array<Record<string, unknown>>,
    records: new Map<string, Array<Record<string, unknown>>>([
      ['HANDOUT-1', [
        { recordId: 'R-1', taskId: 'TASK-1', submittedQty: 10, receiverWrittenQty: 10, receiverWrittenAt: '2026-10-19 08:00:00', handoverRecordStatus: 'WRITTEN_BACK', receiverProofFiles: [{ fileId: 'IMAGE-1', name: '实收照片' }] },
        { recordId: 'R-2', sourceTaskId: 'TASK-1', plannedQty: 10, receiverWrittenQty: 8, receiverWrittenAt: '2026-10-19 09:00:00', handoverRecordStatus: 'OBJECTION_REPORTED', diffQty: -2, objectionReason: '少收', objectionProofFiles: [{ fileId: 'IMAGE-2' }] },
        { recordId: 'R-3', submittedQty: 10, receiverWrittenQty: 11, receiverWrittenAt: '', handoverRecordStatus: 'OBJECTION_PROCESSING', diffQty: 1, resolvedRemark: '核查中' },
      ]],
      ['HANDOUT-2', [
        { recordId: 'R-4', handoverRecordId: 'REC-4', quantityObjectionId: 'QO-4', submittedQty: 0, receiverWrittenQty: 0, receiverWrittenAt: '2026-10-19 10:00:00', handoverRecordStatus: 'OBJECTION_RESOLVED', qtyUnit: 'kg', resolvedRemark: '确认一致', factorySubmittedAt: '2026-10-19 07:00:00', factorySubmittedBy: '跟单员' },
        { recordId: 'R-5', submittedQty: 2, receiverWrittenQty: '2', receiverWrittenAt: '2026-10-19 11:00:00', handoverRecordStatus: 'PENDING' },
      ]],
    ]),
    lookups: 0, headReads: 0, fail: false,
  }
  const readRecords = new Function('dependencies', `with(dependencies){${declarations(['getPdaHandoverRecordsByHead'])};return getPdaHandoverRecordsByHead}`)({
    findHead: (id: string) => { state.lookups++; return state.heads.find(head => head.handoverId === id) },
    getHandoutRecordsForHeadInternal: (head: Record<string, unknown>) => {
      if (state.fail) throw Error('record source unavailable')
      return structuredClone(state.records.get(String(head.handoverId)) || [])
    },
  })
  const api = new Function('dependencies', `with(dependencies){${declarations(['listReceiverWritebacks', 'listQuantityObjections'])};return {listReceiverWritebacks,listQuantityObjections}}`)({
    listPdaHandoverHeads: () => { state.headReads++; return structuredClone(state.heads) },
    getPdaHandoverRecordsByHead: (id: string, head?: Record<string, unknown>) => readRecords(id, legacyLookup ? undefined : head),
    normalizeReceiverId: () => 'WAREHOUSE-1', normalizeReceiverName: () => '下游仓库',
    cloneProofFiles: (files: unknown[]) => structuredClone(files),
  })
  return { state, api, readRecords }
}

test('handover batch projections preserve every field while using the matching head already read in this synchronous iteration', () => {
  const current = reader(), baseline = reader(true)
  const actual = [current.api.listReceiverWritebacks(), current.api.listQuantityObjections()]
  assert.deepEqual(actual, [baseline.api.listReceiverWritebacks(), baseline.api.listQuantityObjections()])
  assert.equal(actual[0].length, 3, 'only numeric confirmed quantities with a timestamp are writebacks, including zero')
  assert.deepEqual(actual[0].map((row: { writebackResult: string }) => row.writebackResult), ['MATCH', 'SHORT', 'MATCH'])
  assert.deepEqual(actual[1].map((row: { status: string }) => row.status), ['REPORTED', 'PROCESSING', 'RESOLVED_PARTIAL'])
  assert.equal(actual[1][2].resolvedAt, '2026-10-19 10:00:00')
  assert.equal(actual[1][2].handoverOrderId, 'HO-2')
  assert.equal(current.state.headReads, 2)
  assert.equal(current.state.lookups, 0, 'do not rebuild/find all heads again for each known head')
  assert.equal(baseline.state.lookups, 4, 'comparator exercises the original default lookup contract')
  actual[0][0].proofFiles[0].name = 'changed caller copy'
  assert.equal((current.state.records.get('HANDOUT-1')![0].receiverProofFiles as Array<{ name: string }>)[0].name, '实收照片')
})

test('each subsequent batch reads current sources; empty and failed reads are neither cached nor hidden', () => {
  const { api, state } = reader()
  assert.equal(api.listReceiverWritebacks()[0].writtenQty, 10)
  state.records.get('HANDOUT-1')![0].receiverWrittenQty = 7
  assert.equal(api.listReceiverWritebacks()[0].writtenQty, 7)
  state.fail = true
  assert.throws(() => api.listQuantityObjections(), /record source unavailable/)
  state.fail = false
  assert.equal(api.listQuantityObjections().length, 3)
  state.heads = []
  assert.deepEqual(api.listReceiverWritebacks(), [])
  assert.deepEqual(api.listQuantityObjections(), [])
  assert.equal(state.lookups, 0)
})

test('direct, mismatched and wrong-type head reads retain the existing lookup and type guards', () => {
  const { readRecords, state } = reader()
  const expected = readRecords('HANDOUT-1')
  assert.deepEqual(readRecords('HANDOUT-1', { handoverId: 'OTHER', headType: 'HANDOUT' }), expected)
  assert.deepEqual(readRecords('HANDOUT-1', state.heads[1]), expected)
  assert.deepEqual(readRecords('HANDOUT-1', { handoverId: 'HANDOUT-1', headType: 'PICKUP' }), [])
  assert.deepEqual(readRecords('MISSING'), [])
  assert.equal(state.lookups, 3)
})

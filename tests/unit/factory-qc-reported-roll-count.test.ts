import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import { reportedDyeQcRollCount, qcProgress, upsertFactoryQc, emptyFactoryQcState, type FactoryQcSource } from '../../src/data/fcs/factory-qc-model.ts'

function actualFunctions(path: string, names: string[], deps: Record<string, unknown>) {
  const source = ts.createSourceFile(path, readFileSync(new URL('../../' + path, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true)
  const nodes = names.map(name => { const node = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name); assert.ok(node, name); return node.getText(source).replace(/^export /, '') })
  const code = ts.transpileModule(nodes.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return new Function('deps', `with(deps){${code};return {${names.join(',')}}}`)(deps)
}
const pack = { nodeRecordId: 'DYE-1-PACK-1', nodeCode: 'PACK', finishedAt: '2026-10-22 10:00:00', outputQty: 940, outputRollCount: 16 }

test('only actual finished PACK reports count; duplicated snapshots do not double-count and subsequent final batches add', () => {
  assert.equal(reportedDyeQcRollCount([{ ...pack }, { ...pack }]), 16)
  assert.equal(reportedDyeQcRollCount([{ ...pack }, { ...pack, nodeRecordId: 'DYE-1-PACK-2', finishedAt: '2026-10-22 11:00:00', outputQty: 100, outputRollCount: 2 }]), 18)
  for (const patch of [{ nodeCode: 'SET' }, { finishedAt: undefined }, { outputQty: 0 }, { outputRollCount: undefined }, { outputRollCount: 0 }, { outputRollCount: 2.5 }, { outputRollCount: NaN }]) assert.equal(reportedDyeQcRollCount([{ ...pack, ...patch }]), undefined)
})

test('one known barcode out of sixteen reported rolls cannot make the QC complete and new details append without fabricating identities', () => {
  const source: FactoryQcSource = { kind: 'DYEING', id: 'DYE-1', no: '染色-1', factoryId: 'ID-F003', factoryName: 'GTG', materialSku: 'FAB-1', materialName: '面料', imageUrl: '/fabric.jpg', requirementVersion: 'V1', unit: '米', hasFinalOutput: true, target: { id: 'F090', name: '下游非染厂', kind: 'FACTORY', isDyeingFactory: false }, reportedRollCount: 16, rolls: [{ id: 'R1', barcode: 'ROLL-1', batchId: 'B1', qty: 58.75, unit: '米', confirmed: true }], handedOutRollIds: [] }
  const state = emptyFactoryQcState(), qc = upsertFactoryQc(state, source, pack.finishedAt)!
  assert.equal(qc.rolls.length, 1); assert.deepEqual(qcProgress(qc), { total: 16, checked: 0, status: '待质检' })
  qc.rolls[0].completedAt = pack.finishedAt; qc.rolls[0].notes = '第一卷已发生检查保留'
  const completed = structuredClone(qc.rolls[0])
  assert.deepEqual(qcProgress(qc), { total: 16, checked: 1, status: '质检中' })
  const next = structuredClone(source); next.rolls.push(...Array.from({ length: 15 }, (_, i) => ({ ...source.rolls[0], id: 'R' + (i + 2), barcode: 'ROLL-' + (i + 2) })))
  upsertFactoryQc(state, next, '2026-10-22 11:00:00')
  assert.equal(state.qcOrders.length, 1); assert.equal(qc.rolls.length, 16); assert.equal(qcProgress(qc).total, 16); assert.equal(qcProgress(qc).checked, 1); assert.deepEqual(qc.rolls[0], completed)
})

test('the real Web/PDA shared PACK writeback forwards the actual roll count and leaves unrelated post nodes unchanged', () => {
  const calls: unknown[][] = []
  const api = actualFunctions('src/data/fcs/process-action-writeback-service.ts', ['executeDyeAction', 'getFormFieldValue'], {
    normalizeActionCode: (value: string) => value,
    completeDyeNode: (...args: unknown[]) => { calls.push(args) },
  })
  api.executeDyeAction({ sourceType: 'DYE', sourceId: 'DYE-1', sourceChannel: 'Web', actionCode: 'DYE_FINISH_PACKING', objectQty: 940, operatorName: '现场操作员', formData: { 包装卷数: 16, 每卷长度: 58.75 } })
  assert.deepEqual(calls[0], ['DYE-1', 'PACK', { outputQty: 940, operatorName: '现场操作员', outputRollCount: 16 }])
  api.executeDyeAction({ sourceType: 'DYE', sourceId: 'DYE-1', sourceChannel: '移动端', actionCode: 'DYE_FINISH_PACKING', objectQty: 940, operatorName: '现场操作员', formData: { 完成卷数: '16' } })
  assert.deepEqual(calls[1], calls[0])
  api.executeDyeAction({ sourceType: 'DYE', sourceId: 'DYE-1', sourceChannel: 'Web', actionCode: 'DYE_FINISH_ROLLING', objectQty: 940, operatorName: '现场操作员', formData: { 包装卷数: 16 } })
  assert.deepEqual(calls[2], ['DYE-1', 'ROLL', { outputQty: 940, operatorName: '现场操作员' }])
})

test('the actual final node stores the optional report without generating rolls or changing existing output identities', () => {
  let stored: any
  const order = { dyeOrderId: 'DYE-1', taskId: 'TASK-DYE-1', materialReceipts: [], handoverOrderId: 'EXISTING-HANDOVER', outputRolls: [{ id: 'R1', qty: 0 }] }
  const current = { nodeRecordId: 'PACK-1', startedAt: '2026-10-22 09:00:00', operatorUserId: 'QC' }
  const api = actualFunctions('src/data/fcs/dyeing-task-domain.ts', ['completeDyeNode'], {
    runDyeProcessMutation: (fn: () => unknown) => fn(), getMutableWorkOrder: () => order, assertDyePostNodeReady: () => {}, getMutableNodeRecord: () => current,
    DYE_POST_NODE_PREDECESSOR: { PACK: 'ROLL' }, DYE_NODE_LABEL: { PACK: '包装' }, nowTimestamp: () => pack.finishedAt,
    upsertNodeRecord: (_id: string, _code: string, fn: () => unknown) => { stored = fn() },
    getQtyUnit: () => '米', getNodeStatusAfterComplete: () => 'PACKED', updateOrderTimestamp: () => {},
    getDyeExecutionNodeRecord: () => stored,
  })
  assert.equal(api.completeDyeNode('DYE-1', 'PACK', { outputQty: 940, outputRollCount: 16, operatorName: '现场' }).outputRollCount, 16)
  assert.deepEqual(order.outputRolls, [{ id: 'R1', qty: 0 }])
  assert.equal(api.completeDyeNode('DYE-1', 'PACK', { outputQty: 940 }).outputRollCount, undefined, 'legacy no-count callers do not invent a reported count')
  assert.throws(() => api.completeDyeNode('DYE-1', 'PACK', { outputQty: 940, outputRollCount: 2.5 }), /正整数/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { productionOrders } from '../../src/data/fcs/production-orders.ts'
import { ensureSimpleCutPieceHandoverFixtures, SIMPLE_CUT_PIECE_DEMO_ORDER_ID } from '../../src/data/fcs/cutting/simple-cut-piece-handover-fixtures.ts'
import { listReplacementFabricOrderRows } from '../../src/data/fcs/cutting/replacement-fabric-source.ts'
import { requireCurrentScope } from '../../src/data/fcs/cutting/replacement-fabric-repository.ts'
import { createReplacementFabricTickets, confirmReplacementFabricPrint, type ReplacementFabricState } from '../../src/data/fcs/cutting/replacement-fabric-fei-tickets.ts'
import { clearRuntimeProcessTasksCache } from '../../src/data/fcs/runtime-process-tasks.ts'

test('同分配的同名 A/B 面料分别新增和打印；第二面料不被第一范围替代', () => {
  ensureSimpleCutPieceHandoverFixtures()
  const order = productionOrders.find(order => order.productionOrderId === SIMPLE_CUT_PIECE_DEMO_ORDER_ID)!
  const original = structuredClone(order.techPackSnapshot)
  try {
    const pack = order.techPackSnapshot!
    const a = pack.bomItems.find(item => item.type === '面料')!
    pack.bomItems.push({ ...structuredClone(a), id:'TEST-B', materialCode:'TEST-B', materialSkuId:'TEST-B', variantId:'TEST-B' })
    for (const mapping of pack.colorMaterialMappings) {
      const line = mapping.lines.find(line => line.bomItemId === a.id)
      if (line) mapping.lines.push({ ...structuredClone(line), id:'TEST-B-LINE', bomItemId:'TEST-B', materialCode:'TEST-B' })
    }
    clearRuntimeProcessTasksCache()
    const scopes = listReplacementFabricOrderRows().find(row => row.order.productionOrderId === order.productionOrderId)!.scopes
    assert.equal(scopes.length, 2)
    assert.equal(scopes[0].assignmentKey, scopes[1].assignmentKey)
    assert.equal(scopes[0].materials[0].name, scopes[1].materials[0].name)
    assert.notEqual(scopes[0].materials[0].key, scopes[1].materials[0].key)
    const state: ReplacementFabricState = { tickets:[], prints:[], receipts:[] }
    const command = (id:string) => ({id,at:'2026-09-25T00:00:00Z',operator:'专项验证'})
    for (const [index, scope] of scopes.entries()) {
      const current = requireCurrentScope(scope)
      assert.deepEqual(current.materials.map(material => material.key), scope.materials.map(material => material.key))
      createReplacementFabricTickets(state, current, scope.materials[0].key, 1, command('add-'+index))
    }
    const printed = confirmReplacementFabricPrint(state, state.tickets.map(ticket => ticket.id), scopes.map(requireCurrentScope), command('print-both'))
    assert.equal(printed.length, 2)
    assert.equal(new Set(state.tickets.map(ticket => ticket.material.key)).size, 2)
    assert.throws(() => requireCurrentScope({ ...scopes[1], materials:[{ ...scopes[1].materials[0], key:'removed-material' }] }), /分配已变化/)
    assert.throws(() => requireCurrentScope({ ...scopes[1], factoryId:'other-factory' }), /分配已变化/)
  } finally {
    order.techPackSnapshot = original
    clearRuntimeProcessTasksCache()
  }
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReplacementFabricDemoState, REPLACEMENT_FABRIC_DEMOS } from '../../src/data/fcs/cutting/replacement-fabric-demo.ts'

test('换片布固定演示：四个新增生产单覆盖部分打印、补打、交出备用及失效票', () => {
  const state = buildReplacementFabricDemoState()
  assert.equal(REPLACEMENT_FABRIC_DEMOS.length, 4)
  assert.equal(new Set(state.tickets.map(t => t.id)).size, state.tickets.length)
  assert.equal(new Set(state.tickets.map(t => t.ticketNo)).size, state.tickets.length)
  assert.ok(state.tickets.every(t => t.length === 5 && t.unit === 'Yard' && t.material.imageUrl))
  const tickets = (id: string) => state.tickets.filter(t => t.productionOrderId === id && !t.invalidatedAt)
  assert.equal(tickets('PO-202610-9001').length, 4)
  assert.equal(tickets('PO-202610-9001').filter(t => state.prints.some(p => p.ticketId === t.id)).length, 2)
  assert.equal(state.prints.filter(p => p.ticketId === tickets('PO-202610-9002')[0].id).length, 2)
  assert.equal(state.receipts.length, 2)
  assert.equal(new Set(state.receipts.map(r => r.ticket.material.key)).size, 2)
  assert.ok(state.receipts.every(r => state.prints.some(p => p.ticketId === r.ticket.id)))
  assert.equal(tickets('PO-202610-9003').filter(t => !state.receipts.some(r => r.ticket.id === t.id)).length, 2)
  assert.equal(state.tickets.filter(t => t.invalidatedAt).length, 1)
  state.tickets[0].invalidReason = 'changed'
  assert.equal(buildReplacementFabricDemoState().tickets[0].invalidReason, undefined)
})

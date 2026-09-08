// E2E-012 / GOV-004: explicit production-order completion, never a simulated status.
import assert from 'node:assert/strict'
import * as domain from '../src/data/fcs/production-orders.ts'
const complete = (domain as typeof domain & { completeProductionOrderManually?: (input: Record<string, unknown>) => unknown }).completeProductionOrderManually
assert.equal(typeof complete, 'function', '生产单缺少正式人工完成命令')
const base = structuredClone(domain.productionOrders[0])
const order: domain.ProductionOrder = { ...base, productionOrderId: 'PO-MANUAL-COMPLETION-CHECK', status: 'EXECUTING' as const, auditLogs: [] }
domain.productionOrders.push(order)
const input = { productionOrderId: order.productionOrderId, actorId: 'ADMIN-CHECK', actorName: '生产主管', actorRole: 'ADMIN', completedAt: '2026-09-07 15:00:00', confirmed: true }
const before = JSON.stringify(order)
for (const patch of [{ confirmed: false }, { actorId: '' }, { actorName: '' }, { actorRole: 'ROLE_OPERATOR' }, { completedAt: 'invalid' }]) {
  assert.throws(() => complete!({ ...input, ...patch }))
  assert.equal(JSON.stringify(order), before, '失败不得改变生产单')
}
const otherBefore = JSON.stringify(domain.productionOrders.filter(x => x !== order))
complete!(input)
assert.equal(order.status, 'COMPLETED')
assert.equal(order.auditLogs.length, 1)
assert.equal(order.auditLogs[0].action, 'MANUAL_COMPLETE')
assert.equal(order.auditLogs[0].by, input.actorName)
assert.deepEqual(order.techPackSnapshot, base.techPackSnapshot)
assert.deepEqual(order.demandSnapshot, base.demandSnapshot)
assert.equal(JSON.stringify(domain.productionOrders.filter(x => x !== order)), otherBefore)
const once = JSON.stringify(order)
complete!(input)
assert.equal(JSON.stringify(order), once, '重复确认不得新增日志')
const cancelled = { ...structuredClone(base), productionOrderId: 'PO-MANUAL-CANCELLED-CHECK', status: 'CANCELLED' as const }
domain.productionOrders.push(cancelled)
assert.throws(() => complete!({ ...input, productionOrderId: cancelled.productionOrderId }))
domain.productionOrders.splice(domain.productionOrders.indexOf(order), 1)
domain.productionOrders.splice(domain.productionOrders.indexOf(cancelled), 1)
console.log('production-order manual completion: confirmation, actor, cancellation, unique audit, frozen facts and cross-order isolation passed')

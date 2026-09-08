// E2E-004 / PREP-012: defining tasks must not wait for those tasks' finished stock.
import assert from 'node:assert/strict'
import * as context from '../src/pages/production/context.ts'
const base = context.state.orders.find(order => order.techPackSnapshot && !order.demandSnapshot.saleType?.includes('KOL'))!
assert.ok(base)
const order = structuredClone(base)
order.productionOrderId = 'PO-NEW-NO-STOCK-BOUNDARY'
order.productionOrderNo = order.productionOrderId
order.status = 'READY_FOR_BREAKDOWN'
order.taskBreakdownSummary.isBrokenDown = false
context.state.orders.push(order)
assert.equal(context.getMaterialPrepBreakdownReadinessForOrder(order.productionOrderId).ready, false)
assert.equal(context.canOrderStartTaskBreakdown(order), true, '缺库存不能令准备任务首次生成陷入循环等待')
assert.equal(context.getOrderTaskBreakdownDisabledReason(order), '')
order.taskBreakdownSummary.isBrokenDown = true
assert.equal(context.canOrderStartTaskBreakdown(order), false, '已拆解不得重复生成')
order.taskBreakdownSummary.isBrokenDown = false
order.status = 'COMPLETED'
assert.equal(context.canOrderStartTaskBreakdown(order), false)
context.state.orders.splice(context.state.orders.indexOf(order), 1)
console.log('task generation vs physical stock boundary passed; no stock, pickup, execution or handover was created')

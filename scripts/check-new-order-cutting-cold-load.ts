/** Cold lazy-load must not treat a newly converted order as a prebuilt execution fixture. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { productionOrders, initialProductionOrderIds } from '../src/data/fcs/production-orders.ts'
const archive=JSON.parse(fs.readFileSync('output/verification/seven-demand-acceptance/seven-live-43183/seven-live-facts-final.json','utf8'))
const order=structuredClone(archive.orders.find((row:any)=>row.productionOrderId==='PO-202603-0104'))
productionOrders.push(order)
assert.equal(initialProductionOrderIds.has(order.productionOrderId),false)
const {listCurrentCuttingOrderProgressRecords}=await import('../src/data/fcs/cutting/order-progress.ts')
const row=listCurrentCuttingOrderProgressRecords().find(item=>item.productionOrderId===order.productionOrderId)!
assert.ok(row)
assert.equal(row.hasSpreadingRecord,false)
assert.equal(row.hasInboundRecord,false)
assert.equal(row.spreadingStartedAt,'')
assert.equal(row.completedAt,'')
assert.equal(row.lastOperatorName,'')
assert.equal(row.productionOrderCreatedAt,order.createdAt)
assert.ok(row.materialLines.every(line=>line.configuredLength===0&&line.receivedLength===0))
console.log('PASS cold lazy-load: new frozen order has no seeded receipt, spreading, completion or operator')

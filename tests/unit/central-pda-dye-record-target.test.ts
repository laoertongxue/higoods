import test from 'node:test'
import assert from 'node:assert/strict'
import { dyeingCommandOrders } from '../../src/data/fcs/dyeing-records.ts'
import { listDyeWorkOrders } from '../../src/data/fcs/dyeing-task-domain.ts'

// Isolated read snapshots normally prepared by the browser route; no user DB.
await (await import('../../src/data/fcs/cutting/part-ticket-records.ts')).hydratePartTicketRecords({ revision: 0, records: [] })
await (await import('../../src/data/fcs/production-context-records.ts')).hydrateProductionContextRecords({ revision: 0, records: [] })

test('C03.33 original dye identity is exact; factory, SKU and a note cannot acquire an order', () => {
  const order = listDyeWorkOrders()[0]
  assert.ok(order)
  assert.deepEqual(dyeingCommandOrders(order.dyeOrderId), [order.dyeOrderId])
  for (const value of [order.dyeFactoryId, order.dyeFactoryName, order.rawMaterialSku, 'note ' + order.dyeOrderId, 'DWO-NOT-EXISTING']) {
    assert.deepEqual(dyeingCommandOrders(value), [], value)
  }
})

test('C03.33 multiple actual dye identities resolve once in stable order, retaining both handover participants', () => {
  const [first, second] = listDyeWorkOrders()
  assert.ok(first && second)
  assert.deepEqual(dyeingCommandOrders([second.dyeOrderId, first.dyeOrderId, second.dyeOrderId]), [first.dyeOrderId, second.dyeOrderId].sort())
  assert.deepEqual(dyeingCommandOrders({ orderId: first.dyeOrderId, related: [second.dyeOrderId, 'UNKNOWN'] }), [first.dyeOrderId, second.dyeOrderId].sort())
})

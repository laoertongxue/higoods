import test from 'node:test'
import assert from 'node:assert/strict'
import { listDyeWorkOrderOnlineRows } from '../../src/data/fcs/dye-work-order-online-view.ts'

test('交出列表省略详情路线读取时保留全部输出字段', () => {
  const output = listDyeWorkOrderOnlineRows({ forOutputList: true })
  const full = listDyeWorkOrderOnlineRows()
  assert.ok(output.length > 0)
  assert.equal(output.length, full.length)
  for (const row of output) {
    const expected = full.find(item => item.dyeOrderId === row.dyeOrderId)!
    for (const key of ['factoryId','factoryName','workOrderNo','taskNo','productCode','productName','productImageUrl','productionOrderNo','purchaseOrderNo','receiverName','downstreamPartner','materialName','colorSku','outputImageUrl','composition','width','weightGsm','isYarn','rawMaterialQty','completedQty','qtyUnit','orderedAt','handoverRecords','sourceType','designRevisionTaskNo'] as const) assert.deepEqual(row[key], expected[key], `${row.dyeOrderId}: ${key}`)
  }
})

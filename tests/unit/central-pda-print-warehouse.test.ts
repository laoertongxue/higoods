import test from 'node:test'
import assert from 'node:assert/strict'
import { readCentralPrintWarehouse } from '../../src/pages/central-pda/print-warehouse-model.ts'
import { captureFactoryReceivingData, restoreFactoryReceivingData, registerFactoryReceivingSource,
  prepareFactoryReceipt, savePreparedFactoryReceipt, type FactoryReceiptInput } from '../../src/data/fcs/factory-receiving.ts'
import { withWashingStaticRead } from '../../src/data/fcs/fabric-washing-storage-bridge.ts'
import { readFactoryPdaExecutionUsers } from '../../src/data/fcs/store-domain-pda.ts'
import { centralPrintInputLabel } from '../../src/pages/central-pda/print-input-label.ts'
import { normalizePrintingUnit } from '../../src/data/fcs/printing-statistics.ts'
import { centralPrintEntryFactory } from '../../src/pages/central-pda/print-model.ts'

await (await import('../../src/data/fcs/cutting/part-ticket-records.ts')).hydratePartTicketRecords({ revision: 0, records: [] })
await (await import('../../src/data/fcs/production-context-records.ts')).hydrateProductionContextRecords({ revision: 0, records: [] })
const factory = 'F090', at = '2026-10-22 08:00:00'
const sourceId = 'QA-PRINT-WH-SOURCE', receiptId = 'QA-PRINT-WH-RECEIPT'

function fixture(run: () => void) {
  const view = readCentralPrintWarehouse(factory), original = captureFactoryReceivingData()
  const actor = readFactoryPdaExecutionUsers(factory).find(user => user.roleId === 'ROLE_ADMIN')!
  const positions = view.positions.filter(row => row.warehouse.warehouseKind === 'WAIT_PROCESS')
  const material = original.receipts.flatMap(receipt => receipt.lines).find(line => line.material.kind === 'FABRIC')!.material
  assert.ok(positions.length >= 2)
  return withWashingStaticRead(() => {
    try {
      registerFactoryReceivingSource({ id: sourceId, documentNo: sourceId, type: 'ISSUE', processCode: 'PRINT',
        origin: { kind: 'WAREHOUSE', id: 'WH-FABRIC-001', name: '面料中央仓(GKP)', warehouseAttribute: '面料中央仓' },
        targetFactoryId: factory, targetFactoryName: 'Central fixture', createdAt: at, createdBy: 'Original warehouse sender',
        approvedAt: at, approvedBy: 'Original warehouse reviewer',
        lines: [{ id: sourceId + '-L1', material, plannedQty: 22, sentQty: 22, unit: 'Yard', label: sourceId,
          rolls: [{ barcode: 'QA-PRINT-RAW-A', yard: 10 }, { barcode: 'QA-PRINT-RAW-B', yard: 12 }] }] })
      const input: FactoryReceiptInput = { id: receiptId, factoryId: factory, operatorId: actor.userId, operatorName: actor.name,
        receivedAt: at, remark: '', lines: [{ sourceId, sourceLineId: sourceId + '-L1',
          warehouseId: positions[0].warehouse.warehouseId, locationId: positions[0].location.locationId,
          rolls: positions.slice(0, 2).map((position, index) => ({ barcode: index ? 'QA-PRINT-RAW-B' : 'QA-PRINT-RAW-A', yard: index ? 12 : 10,
            warehouseId: position.warehouse.warehouseId, locationId: position.location.locationId })) }] }
      savePreparedFactoryReceipt(prepareFactoryReceipt(input))
      const saved = captureFactoryReceivingData(), line = saved.receipts.find(receipt => receipt.id === receiptId)!.lines[0]
      saved.materialUses ||= []
      saved.materialUses.push({ id: 'QA-PRINT-HISTORICAL-USE', printingOrderId: 'PWO-PRINT-001', factoryId: factory, at, operatorName: 'Fixture historical worker',
        lines: [{ receiptLineId: line.id, barcode: 'QA-PRINT-RAW-A', qty: 2, unit: 'Yard' }] })
      restoreFactoryReceivingData(saved)
      run()
    } finally { restoreFactoryReceivingData(original) }
  })
}

test('C04.10/14: actual registry includes empty bins and a Central factory without print orders', () => {
  const view = readCentralPrintWarehouse('OWN_WOOL_FACTORY')
  assert.equal(view.printOrderIds.length, 0)
  assert.ok(view.positions.length > 0)
  assert.ok(view.warehouses.every(warehouse => warehouse.factoryId === 'OWN_WOOL_FACTORY'))
  assert.ok(view.positions.every(row => row.key === JSON.stringify([row.warehouse.warehouseId, row.location.locationId])))
  assert.throws(() => readCentralPrintWarehouse('ID-F021'), /PRINT_centralOnly/)
})

test('C04.16: entry retains a valid empty Central factory and rejects third-party preferences', () => {
  assert.equal(centralPrintEntryFactory(['OWN_WOOL_FACTORY', 'F090']), 'OWN_WOOL_FACTORY')
  assert.equal(centralPrintEntryFactory(['ID-F021', 'not-a-factory', 'F090']), 'F090')
  assert.equal(centralPrintEntryFactory(['ID-F021', 'not-a-factory']), '')
})

test('C04.14: rolls in one receipt retain distinct actual bins and subtract original per-roll use once', () => fixture(() => {
  const before = JSON.stringify(captureFactoryReceivingData()), view = readCentralPrintWarehouse(factory)
  const rows = view.input.filter(row => row.stock.receiptLineId === receiptId + '-L1')
  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map(row => row.quantity), [8, 12])
  assert.equal(rows.reduce((sum, row) => sum + row.quantity!, 0), 20)
  assert.equal(new Set(rows.map(row => row.position?.key)).size, 2)
  assert.ok(rows.every(row => row.stock.unit === 'Yard' && row.stock.imageUrl && row.position))
  assert.equal(view.inboundRecords.find(row => row.inboundRecordNo === receiptId)?.receiverUserId, factory + '_admin')
  assert.equal(JSON.stringify(captureFactoryReceivingData()), before, 'reads must not rewrite receipt/use facts')
}))

test('C04.14: historical roll without its actual position stays unlocated, never inherits the parent bin', () => fixture(() => {
  const saved = captureFactoryReceivingData(), receipt = saved.receipts.find(row => row.id === receiptId)!
  const roll = receipt.lines[0].rolls![1]
  Reflect.deleteProperty(roll, 'warehouseId'); Reflect.deleteProperty(roll, 'locationId')
  restoreFactoryReceivingData(saved)
  const before = JSON.stringify(captureFactoryReceivingData()), rows = readCentralPrintWarehouse(factory).input
  const actual = rows.find(row => row.barcode === 'QA-PRINT-RAW-B')!
  assert.equal(actual.quantity, 12)
  assert.equal(actual.position, undefined)
  assert.equal(JSON.stringify(captureFactoryReceivingData()), before)
}))

test('C04.17: pending output reconciles the original Web remainder without becoming a measured physical roll', () => {
  const view = readCentralPrintWarehouse(factory), sums: Record<string, number> = {}
  for (const row of view.pendingOutput) {
    assert.ok(row.quantity > 0 && row.order.output.imageUrl)
    const unit = normalizePrintingUnit(row.order.output.qtyUnit)
    sums[unit] = (sums[unit] || 0) + row.quantity
  }
  assert.deepEqual(sums, view.unlocatedOutputByUnit)
})

test('C04.17: original input labels retain exact codes, received/current amounts and bin, with no stock write', () => fixture(() => {
  const before = JSON.stringify(captureFactoryReceivingData()), view = readCentralPrintWarehouse(factory)
  const row = view.input.find(row => row.barcode === 'QA-PRINT-RAW-A')!
  const label = centralPrintInputLabel(factory, row.key, 'id')
  assert.equal(label.barcode, 'QA-PRINT-RAW-A')
  assert.match(label.html, /size:100mm 70mm/)
  assert.match(label.html, /Diterima 10 Yard · Stok 8 Yard/)
  assert.ok(label.html.includes(row.position!.location.locationNo) && label.html.includes(row.stock.materialSku!))
  assert.ok(label.html.includes('<svg') && !/[\u3400-\u9fff]/.test(label.html))
  assert.equal(JSON.stringify(captureFactoryReceivingData()), before)
  assert.throws(() => centralPrintInputLabel('ID-F021', row.key, 'id'), /PRINT_centralOnly/)
  assert.throws(() => centralPrintInputLabel(factory, 'other-source|line', 'id'), /PRINT_labelNotReady/)
}))

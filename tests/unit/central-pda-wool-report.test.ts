import test from 'node:test'
import assert from 'node:assert/strict'
import { centralWoolFacts, centralWoolExecutionRows, centralWoolReportRequest, centralWoolReportSource, centralWoolIncoming, centralWoolReceiptRequest } from '../../src/pages/central-pda/wool-model.ts'
import { readFactoryPdaExecutionUsers } from '../../src/data/fcs/store-domain-pda.ts'
import { getFactoryReceiptLocations, captureFactoryReceivingData, restoreFactoryReceivingData } from '../../src/data/fcs/factory-receiving.ts'
import { confirmFactoryMaterialReceipt } from '../../src/data/fcs/factory-receiving-links.ts'
import { addWoolProcessReport } from '../../src/data/fcs/wool-domain/commands.ts'
import { readWoolStore, replaceWoolStore } from '../../src/data/fcs/wool-domain/store.ts'
import { changedWoolCommandOrderIds } from '../../src/data/fcs/wool-domain/command-order-scope.ts'
import { pcsRecordStore } from '../../src/data/pcs-record-runtime.ts'
import { WOOL_DOMAIN_STORE_KEY } from '../../src/data/fcs/wool-domain/store.ts'

const factory = 'OWN_WOOL_FACTORY', orderId = 'WOOL-STAGE-001:KNITTING', sku = 'CARDIGAN-CREAM-M'
const actor = () => readFactoryPdaExecutionUsers(factory).find(user => user.roleId === 'ROLE_ADMIN')!
const row = () => centralWoolExecutionRows(centralWoolFacts(factory)).find(row => row.order.woolOrderId === orderId)!
function ready(run: () => void) {
  const wool = readWoolStore(), receiving = captureFactoryReceivingData()
  try {
    const source = centralWoolIncoming(factory).find(row => row.line.woolOrderId === orderId)!
    const p = getFactoryReceiptLocations(factory)[0]
    const request = centralWoolReceiptRequest(source, { kind: 'YARN', grossKg: 1.062,
      tubes: { PAPER: 1, CONICAL: 0, PAGODA: 0 }, warehouseId: p.warehouse.warehouseId, locationId: p.location.locationId }, actor(), 'C02-REPORT-YARN', '2026-10-21T07:00:00Z')
    confirmFactoryMaterialReceipt(request.input, actor()); readWoolStore(); run()
  } finally { restoreFactoryReceivingData(receiving); replaceWoolStore(wool) }
}

test('C02.03: execution reads original stages/actions and garment-equivalent units without writing a report', () => {
  const before = readWoolStore().processReports.length, facts = centralWoolFacts(factory)
  assert.ok(centralWoolExecutionRows(facts).some(row => row.order.stage === 'KNITTING'))
  assert.ok(centralWoolExecutionRows(facts).some(row => row.order.stage === 'LINKING'))
  assert.ok(centralWoolExecutionRows(facts).every(row => row.order.factoryId === factory && row.lines.every(line => line.line.qtyUnit === '件')))
  assert.equal(readWoolStore().processReports.length, before)
  assert.throws(() => centralWoolReportRequest(row(), sku, 1, actor(), 'C02-NO-YARN', '2026-10-21T07:01:00Z'), /WOOL_missingYarn/)
})

test('C02.03: actual report request preserves the original quota, SKU and current actor', () => ready(() => {
  const current = row(), request = centralWoolReportRequest(current, sku, 25, actor(), 'C02-REPORT-REQUEST', '2026-10-21T07:01:00Z')
  assert.equal(request.input.reportedQty, 25)
  assert.equal(request.input.reportedBy, actor().name)
  assert.equal(request.actorId, actor().userId)
  assert.equal(request.expectedSource, centralWoolReportSource(current, current.lines[0]))
  for (const quantity of [0, -1, 1.5, Infinity]) assert.throws(() => centralWoolReportRequest(current, sku, quantity, actor(), 'C02-BAD-QTY', 'now'), /WOOL_reportQuantity/)
  assert.throws(() => centralWoolReportRequest(current, sku, 151, actor(), 'C02-OVER', 'now'), /WOOL_reportLimit/)
  assert.throws(() => centralWoolReportRequest(current, 'OTHER-SKU', 1, actor(), 'C02-WRONG-SKU', 'now'), /WOOL_reportSource/)
  assert.throws(() => centralWoolReportRequest({ ...current, order: { ...current.order, factoryId: 'ID-F021' } }, sku, 1, actor(), 'C02-WRONG-FACTORY', 'now'), /WOOL_actor/)
}))

test('C02.03/07: original knitting report changes both actual owners and auto-linking cannot be manually reported again', () => ready(() => {
  const before = readWoolStore(), source = row(), request = centralWoolReportRequest(source, sku, 25, actor(), 'C02-REPORT-AUTO', '2026-10-21T07:01:00Z')
  addWoolProcessReport(orderId, request.input)
  const after = readWoolStore(), facts = centralWoolFacts(factory), linking = centralWoolExecutionRows(facts).find(row => row.order.woolOrderId === source.order.pairedWorkOrderId)!
  assert.deepEqual(changedWoolCommandOrderIds(before, after), [orderId, source.order.pairedWorkOrderId].sort())
  assert.equal(linking.lines[0].readiness.reportedQty, 25)
  assert.equal(linking.lines[0].automatic, true)
  assert.equal(linking.lines[0].readiness.canReport, false)
  assert.throws(() => centralWoolReportRequest(linking, sku, 1, actor(), 'C02-NO-SECOND-LINKING', 'now'), /WOOL_automatic/)
  const internal = after.handovers.filter(record => record.automatic && record.woolOrderId === orderId)
  assert.equal(internal.length, 1)
  assert.equal(internal[0].handoverQty, 25)
  assert.equal(internal[0].qtyUnit, '件')
  assert.equal(internal[0].downstreamReceipt?.actualReceivedQty, 25)
  assert.notEqual(centralWoolReportSource(row(), row().lines[0]), request.expectedSource)
  assert.deepEqual(changedWoolCommandOrderIds(after, structuredClone(after)), [])
}))

test('C02.07: persisted work-order owners differ from private query projections', () => {
  const before = readWoolStore(), after = structuredClone(before)
  const original = before.workOrders[orderId]
  after.workOrders['FROZEN-NEW-KNITTING'] = { ...structuredClone(original), woolOrderId: 'FROZEN-NEW-KNITTING' }
  assert.deepEqual(changedWoolCommandOrderIds(before, after), ['FROZEN-NEW-KNITTING'])
  const changed = structuredClone(before)
  changed.workOrders[orderId].styleName += ' changed'
  assert.deepEqual(changedWoolCommandOrderIds(before, changed), [orderId])
  const raw = pcsRecordStore.getItem(WOOL_DOMAIN_STORE_KEY)
  centralWoolFacts(factory)
  assert.equal(pcsRecordStore.getItem(WOOL_DOMAIN_STORE_KEY), raw, 'private query projections do not change the staged snapshot')
})

test('C02.03: automatic linking is per SKU; external M and ordinary L in one order stay distinct', () => {
  const wool = readWoolStore(), receiving = captureFactoryReceivingData(), id = 'WOOL-STAGE-012:KNITTING'
  try {
    const facts = centralWoolFacts(factory), current = centralWoolExecutionRows(facts, id)[0]
    assert.ok(current.order.externalPieces.some(piece => piece.skuCode === 'CARDIGAN-CREAM-M'))
    assert.ok(!current.order.externalPieces.some(piece => piece.skuCode === 'CARDIGAN-CREAM-L'))
    const ids = new Set(wool.processReports.map(report => report.reportId))
    for (const [outputSkuCode, reportedQty] of [['CARDIGAN-CREAM-M', 7], ['CARDIGAN-CREAM-L', 3]] as const) {
      const row = centralWoolExecutionRows(centralWoolFacts(factory), id)[0]
      const request = centralWoolReportRequest(row, outputSkuCode, reportedQty, actor(), `C02-PER-SKU-${outputSkuCode}`, '2026-10-21T09:00:00Z')
      addWoolProcessReport(id, request.input)
    }
    const reports = readWoolStore().processReports.filter(report => !ids.has(report.reportId))
    assert.equal(reports.length, 3)
    assert.ok(reports.some(report => report.woolOrderId === id && report.outputSkuCode === 'CARDIGAN-CREAM-M' && report.reportedQty === 7))
    assert.ok(reports.some(report => report.woolOrderId === current.order.pairedWorkOrderId && report.outputSkuCode === 'CARDIGAN-CREAM-L' && report.reportedQty === 3))
    assert.ok(!reports.some(report => report.woolOrderId === current.order.pairedWorkOrderId && report.outputSkuCode === 'CARDIGAN-CREAM-M'))
    const linking = centralWoolExecutionRows(centralWoolFacts(factory), current.order.pairedWorkOrderId)[0]
    assert.equal(linking.lines.find(line => line.line.outputSkuCode === 'CARDIGAN-CREAM-M')?.automatic, false)
    assert.equal(linking.lines.find(line => line.line.outputSkuCode === 'CARDIGAN-CREAM-L')?.automatic, true)
  } finally { restoreFactoryReceivingData(receiving); replaceWoolStore(wool) }
})

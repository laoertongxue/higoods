import test from 'node:test'
import assert from 'node:assert/strict'
import { centralWoolFactories, centralWoolOrders, centralWoolIncoming, centralWoolReceiptRequest,
  assertCentralWoolActor, centralWoolFacts, centralWoolInitialFactory } from '../../src/pages/central-pda/wool-model.ts'
import { readFactoryPdaExecutionUsers, createPdaSessionFromUser, setPdaSession } from '../../src/data/fcs/store-domain-pda.ts'
import { confirmFactoryMaterialReceipt } from '../../src/data/fcs/factory-receiving-links.ts'
import { getFactoryReceiptLocations } from '../../src/data/fcs/factory-receiving.ts'
import { pcsRecordStore } from '../../src/data/pcs-record-runtime.ts'
import { WOOL_DOMAIN_STORE_KEY, readWoolStore, replaceWoolStore } from '../../src/data/fcs/wool-domain/store.ts'

const factoryId = 'OWN_WOOL_FACTORY'
const actor = () => readFactoryPdaExecutionUsers(factoryId).find(user => user.roleId === 'ROLE_ADMIN')!
const incoming = () => centralWoolIncoming(factoryId).find(row => row.line.woolOrderId === 'WOOL-STAGE-001:KNITTING')!
const position = () => { const p = getFactoryReceiptLocations(factoryId)[0]; return { warehouseId: p.warehouse.warehouseId, locationId: p.location.locationId } }
const values = () => ({ kind: 'YARN' as const, grossKg: 10, tubes: { PAPER: 2, CONICAL: 0, PAGODA: 0 }, ...position() })

test('C02.01: only actual Central wool factories/orders are exposed; current projected reads do not write the wool snapshot', () => {
  assert.ok(centralWoolFactories().some(factory => factory.id === factoryId))
  const orders = centralWoolOrders(factoryId)
  assert.ok(orders.length >= 28)
  assert.ok(orders.every(order => order.factoryId === factoryId))
  assert.ok(orders.some(order => order.stage === 'KNITTING') && orders.some(order => order.stage === 'LINKING'))
  assert.ok(orders.every(order => order.outputPlanLines.every(line => line.qtyUnit === '件')))
  const before = pcsRecordStore.getItem(WOOL_DOMAIN_STORE_KEY)
  centralWoolFacts(factoryId); centralWoolIncoming(factoryId)
  assert.equal(pcsRecordStore.getItem(WOOL_DOMAIN_STORE_KEY), before)
  assert.deepEqual(centralWoolOrders('ID-F021'), [])
  assert.throws(() => centralWoolFacts('ID-F021'), /WOOL_actor/)
})

test('C02.02: current yarn receipt computes pcs and exact gram tare, preserving upstream and actual operator', () => {
  const row = incoming(), request = centralWoolReceiptRequest(row, values(), actor(), 'C02-UNIT-RCV', '2026-10-21T04:00:00Z')
  assert.equal(request.input.lines[0].pcs, 2)
  assert.equal(request.prepared.lines[0].qty, 9.876)
  assert.equal(request.prepared.lines[0].unit, 'kg')
  assert.equal(request.prepared.lines[0].yarn?.tareGrams, 124)
  assert.equal(request.prepared.operatorId, actor().userId)
  assert.equal(request.prepared.lines[0].origin?.id, row.source.origin.id)
  assert.equal(request.prepared.lines[0].woolOrderId, row.line.woolOrderId)
  assert.equal(request.input.lines[0].sourceId, row.source.id)
})

test('C02.02: original yarn precision, bound-source net cap and actual factory position block invalid receipts', () => {
  const row = incoming()
  assert.throws(() => centralWoolReceiptRequest(row, { ...values(), grossKg: 26 }, actor(), 'C02-OVER', '2026-10-21T04:00:00Z'), /超过/)
  assert.throws(() => centralWoolReceiptRequest(row, { ...values(), grossKg: 10.0001 }, actor(), 'C02-PRECISION', '2026-10-21T04:00:00Z'), /三位/)
  assert.throws(() => centralWoolReceiptRequest(row, { ...values(), warehouseId: 'OTHER', locationId: 'OTHER' }, actor(), 'C02-POSITION', '2026-10-21T04:00:00Z'))
  assert.throws(() => centralWoolReceiptRequest(row, { kind: 'WOOL_PIECE', quantity: 1, ...position() }, actor(), 'C02-WRONG-KIND', '2026-10-21T04:00:00Z'), /WOOL_source/)
  assert.throws(() => assertCentralWoolActor({ ...actor(), name: 'forged' }), /WOOL_actor/)
})

test('C02.02: zero yarn receipt keeps the current Web rule without inventing stock or a completed input gate', () => {
  const result = centralWoolReceiptRequest(incoming(), { ...values(), grossKg: 0, tubes: { PAPER: 0, CONICAL: 0, PAGODA: 0 } }, actor(), 'C02-ZERO', '2026-10-21T04:00:00Z')
  assert.equal(result.prepared.lines[0].qty, 0)
  assert.equal(result.prepared.lines[0].pcs, 0)
})

test('C02.02: explicit receipt identity is checked without weakening existing device-session callers', () => {
  const request = centralWoolReceiptRequest(incoming(), values(), actor(), 'C02-IDENTITY', '2026-10-21T04:00:00Z')
  const other = readFactoryPdaExecutionUsers('ID-F021').find(user => user.roleId === 'ROLE_ADMIN')!
  setPdaSession(createPdaSessionFromUser(other))
  try {
    assert.throws(() => confirmFactoryMaterialReceipt(request.input), /只能接收本厂/)
    assert.throws(() => confirmFactoryMaterialReceipt(request.input, { ...actor(), name: 'forged' }), /接收人/)
    assert.throws(() => confirmFactoryMaterialReceipt(request.input, { ...actor(), factoryId: other.factoryId }), /接收人/)
  } finally { setPdaSession(null) }
})

test('C02.01/02: a completed order keeps its source identity for history and has no receiving action', () => {
  const before = readWoolStore(), row = incoming(), next = structuredClone(before)
  next.completions.push({ completionId: 'C02-CLOSED-READ-FIXTURE', woolOrderId: row.line.woolOrderId!,
    completedAt: '2026-10-21T04:00:00Z', completedBy: actor().name,
    confirmationSnapshot: { yarnReceiptSummary: [], outputReadinessSummary: [], processReportSummary: [],
      handoverSummary: [], waitProcessStockSummary: [], waitHandoverStockSummary: [], releasedMachineIds: [] } })
  try {
    replaceWoolStore(next)
    const closed = centralWoolIncoming(factoryId).find(item => item.key === row.key)!
    assert.equal(closed.source.id, row.source.id)
    assert.equal(closed.canReceive, false)
    assert.equal(closed.orderCompleted, true)
    assert.throws(() => centralWoolReceiptRequest(closed, values(), actor(), 'C02-CLOSED-RCV', '2026-10-21T04:00:00Z'), /WOOL_changed/)
  } finally { replaceWoolStore(before) }
})

test('C02.01: initial prototype factory follows actual work while keeping an existing explicit factory choice', () => {
  assert.equal(centralWoolInitialFactory([])?.id, factoryId)
  const other = centralWoolFactories().find(factory => factory.id !== factoryId)!
  assert.ok(other)
  assert.equal(centralWoolInitialFactory([other.id])?.id, other.id)
  assert.equal(centralWoolInitialFactory(['MISSING-FACTORY'])?.id, factoryId)
})

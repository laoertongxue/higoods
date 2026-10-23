import test from 'node:test'
import assert from 'node:assert/strict'
import { centralWoolWarehouseReceipts, centralWoolWarehouseHandovers, centralWoolWarehouseFacts, centralWoolYarnRequest, centralWoolAllocationRequest, centralWoolStockSource, centralWoolAllocationSource } from '../../src/pages/central-pda/wool-warehouse-model.ts'
import { readFactoryPdaExecutionUsers, createPdaSessionFromUser, setPdaSession } from '../../src/data/fcs/store-domain-pda.ts'
import { readWoolStore, replaceWoolStore, WOOL_DOMAIN_STORE_KEY } from '../../src/data/fcs/wool-domain/store.ts'
import { captureFactoryReceivingData, restoreFactoryReceivingData, listReceivingAllocations } from '../../src/data/fcs/factory-receiving.ts'
import { allocateReceivedMaterialToOrder } from '../../src/data/fcs/factory-receiving-links.ts'
import { issueWoolYarn, returnWoolYarn } from '../../src/data/fcs/wool-domain/commands.ts'
import { pcsRecordStore } from '../../src/data/pcs-record-runtime.ts'

const factory = 'OWN_WOOL_FACTORY', at = '2026-10-21T12:00:00Z'
const actor = () => readFactoryPdaExecutionUsers(factory).find(u => u.roleId === 'ROLE_ADMIN')!
const facts = () => centralWoolWarehouseFacts(factory)
const saveAllocation = (r: ReturnType<typeof centralWoolAllocationRequest>) => { allocateReceivedMaterialToOrder(r.input, actor()); readWoolStore() }
const saveYarn = (r: ReturnType<typeof centralWoolYarnRequest>) => r.kind === 'issue' ? issueWoolYarn(r.woolOrderId, r.input) : returnWoolYarn(r.woolOrderId, r.input)
const allocation = () => facts().preparation.find(r => r.line.id === 'WDEMO-YARN-STOCK-R:20260918-L1')!
async function isolated(run: () => void | Promise<void>) {
  facts(); const before = readWoolStore(), receiving = captureFactoryReceivingData()
  try { await run() } finally { restoreFactoryReceivingData(receiving); replaceWoolStore(before); setPdaSession(null) }
}

test('C02.04: original factory ledger is read-only, preserves kg/pieces/garments and preparation quota', () => {
  const initial = facts(), before = pcsRecordStore.getItem(WOOL_DOMAIN_STORE_KEY)
  facts(); assert.equal(pcsRecordStore.getItem(WOOL_DOMAIN_STORE_KEY), before)
  assert.ok(initial.stocks.every(row => !row.order || row.order.factoryId === factory))
  assert.ok(initial.stocks.filter(r => r.stock.objectType === 'YARN').every(r => r.stock.unit === 'kg'))
  assert.equal(allocation().remainingQty, 10)
  assert.ok(allocation().targets.length > 1)
  assert.ok(allocation().targets.every(o => o.stage === 'KNITTING' && o.factoryId === factory))
  assert.throws(() => centralWoolWarehouseFacts('ID-F021'), /WOOL_actor/)
})

test('C02.04: explicit registered allocator is independent of old PDA, with old callers and identity guards retained', async () => isolated(async () => {
  const a = actor(), other = readFactoryPdaExecutionUsers('ID-F021').find(u => u.roleId === 'ROLE_ADMIN')!
  setPdaSession(createPdaSessionFromUser(other))
  const r = centralWoolAllocationRequest(allocation(), allocation().targets[0].woolOrderId, 2.3456, a, 'WST-IDENTITY', at)
  assert.throws(() => allocateReceivedMaterialToOrder(r.input), /只能分配本厂/)
  assert.throws(() => allocateReceivedMaterialToOrder(r.input, { ...a, name: 'forged' }), /分配人/)
  assert.throws(() => allocateReceivedMaterialToOrder(r.input, other), /分配人/)
  saveAllocation(r)
  assert.equal(listReceivingAllocations().find(x => x.id === r.input.id)?.qty, 2.3456)
  assert.equal(allocation().remainingQty, 7.6544)
  const source = facts().stocks.find(s => s.stock.woolOrderId === r.input.woolOrderId && s.stock.batchNo === allocation().line.material.batchNo)!
  assert.equal(source.stock.currentQty, 2.3456)
  assert.equal(source.stock.unit, 'kg')
  assert.equal(facts().stocks.filter(s => s.stock.batchNo === allocation().line.material.batchNo).reduce((s, r) => s + r.stock.currentQty, 0), 10)
  saveAllocation(r)
  assert.equal(listReceivingAllocations().filter(x => x.id === r.input.id).length, 1)
  assert.throws(() => saveAllocation({ ...r, input: { ...r.input, qty: 2 } }), /确认号已使用/)
}))

test('C02.04: issue/return keep exact kg, original physical row and zero-stock return eligibility; retries do not double post', async () => isolated(async () => {
  const a = actor(), prep = allocation(), order = prep.targets[0].woolOrderId
  saveAllocation(centralWoolAllocationRequest(prep, order, 2.3456, a, 'WST-ALLOC-ISSUE', at))
  const get = () => facts().stocks.find(s => s.stock.woolOrderId === order && s.stock.batchNo === prep.line.material.batchNo)!
  const row = get()
  assert.ok(row.canIssue && !row.canReturn)
  assert.throws(() => centralWoolYarnRequest(row, 'issue', 3, a, 'WST-OVER', at), /WST_limit/)
  assert.throws(() => centralWoolYarnRequest(row, 'issue', 0, a, 'WST-ZERO', at), /WST_quantity/)
  const r = centralWoolYarnRequest(row, 'issue', 2.3456, a, 'WST-ISSUE', at)
  const saved = saveYarn(r); saveYarn(r)
  assert.equal(get().stock.currentQty, 0)
  assert.equal(get().canIssue, false)
  assert.equal(get().canReturn, true)
  assert.equal(get().returnableQty, 2.3456)
  assert.throws(() => centralWoolYarnRequest(get(), 'return', 2.4, a, 'WST-RET-OVER', at), /WST_limit/)
  const back = centralWoolYarnRequest(get(), 'return', 1.2345, a, 'WST-RETURN', at)
  saveYarn(back); saveYarn(back)
  assert.equal(get().stock.currentQty, 1.2345)
  assert.equal(get().returnableQty, 2.3456 - 1.2345)
  const flow = facts().flows.find(f => f.sourceRecordId === ('issueId' in saved ? saved.issueId : ''))!
  assert.equal(flow.unit, 'kg')
  assert.equal(flow.physicalLocationId, prep.line.locationId)
  assert.equal(flow.operatedBy, a.name)
  assert.equal(facts().flows.filter(f => f.sourceRecordId === flow.sourceRecordId).length, 1)
}))

test('C02.04: allocation/stock fingerprints change after adjacent facts; wrong target and forged actor are refused', async () => isolated(async () => {
  const a = actor(), prep = allocation(), order = prep.targets[0].woolOrderId
  assert.throws(() => centralWoolAllocationRequest(prep, 'WRONG', 1, a, 'WST-WRONG', at), /WST_target/)
  assert.throws(() => centralWoolAllocationRequest(prep, order, 11, a, 'WST-ALLOC-OVER', at), /WST_limit/)
  const stale = centralWoolAllocationRequest(prep, order, 2, a, 'WST-STALE', at)
  saveAllocation(centralWoolAllocationRequest(prep, order, 1, a, 'WST-FIRST', at))
  assert.notEqual(centralWoolAllocationSource(allocation(), order), stale.expectedSource)
  const row = facts().stocks.find(s => s.stock.woolOrderId === order && s.stock.batchNo === prep.line.material.batchNo)!
  const old = centralWoolYarnRequest(row, 'issue', 1, a, 'WST-OLD-STOCK', at)
  saveYarn(centralWoolYarnRequest(row, 'issue', 0.5, a, 'WST-NEW-STOCK', at))
  assert.notEqual(centralWoolStockSource(facts().stocks.find(r => r.stock.stockKey === row.stock.stockKey)!), old.expectedSource)
  assert.throws(() => centralWoolYarnRequest(row, 'issue', 0.5, { ...a, name: 'forged' }, 'WST-ACTOR', at), /WOOL_actor/)
}))

test('C02.04: one lot in two real locations stays separate; return cap follows original lot total across locations', async () => isolated(async () => {
  const { centralWoolIncoming, centralWoolReceiptRequest } = await import('../../src/pages/central-pda/wool-model.ts')
  const { getFactoryReceiptLocations } = await import('../../src/data/fcs/factory-receiving.ts')
  const { confirmFactoryMaterialReceipt } = await import('../../src/data/fcs/factory-receiving-links.ts')
  const a = actor(), order = 'WOOL-STAGE-001:KNITTING', positions = getFactoryReceiptLocations(factory)
  assert.ok(positions.length >= 2)
  const incoming = () => centralWoolIncoming(factory).find(r => r.line.woolOrderId === order && r.line.material.kind === 'YARN')!
  for (const [index, net] of [1, 2].entries()) {
    const p = positions[index]
    const r = centralWoolReceiptRequest(incoming(), { kind:'YARN', grossKg:net + 0.062,
      tubes:{ PAPER:1, CONICAL:0, PAGODA:0 }, warehouseId:p.warehouse.warehouseId, locationId:p.location.locationId }, a, `WST-TWO-POS-${index}`, at)
    confirmFactoryMaterialReceipt(r.input, a); readWoolStore()
  }
  const batch = incoming().line.material.batchNo, rows = () => facts().stocks.filter(r => r.stock.woolOrderId === order && r.stock.batchNo === batch)
  assert.equal(rows().length, 2)
  assert.deepEqual(rows().map(r => r.stock.currentQty).sort(), [1, 2])
  assert.throws(() => issueWoolYarn(order, { commandId:'WST-AMBIGUOUS', yarnSkuCode:incoming().line.material.sku, batchNo:batch,
    issuedQty:0.5, issuedAt:at, issuedBy:a.name }), /多个库位/)
  const first = rows().find(r => r.stock.currentQty === 1)!, second = rows().find(r => r.stock.currentQty === 2)!
  saveYarn(centralWoolYarnRequest(first, 'issue', 0.75, a, 'WST-EXACT-POS', at))
  assert.equal(rows().find(r => r.stock.stockKey === first.stock.stockKey)?.stock.currentQty, 0.25)
  assert.equal(rows().find(r => r.stock.stockKey === second.stock.stockKey)?.stock.currentQty, 2)
  const target = rows().find(r => r.stock.stockKey === second.stock.stockKey)!
  assert.equal(target.returnableQty, 0.75)
  saveYarn(centralWoolYarnRequest(target, 'return', 0.5, a, 'WST-RETURN-SECOND-POS', at))
  assert.equal(rows().find(r => r.stock.stockKey === second.stock.stockKey)?.stock.currentQty, 2.5)
  assert.ok(rows().every(r => r.returnableQty === 0.25))
}))

test('C02.04: an explicit closed-order read fixture keeps history and blocks yarn actions/allocation targets', async () => isolated(() => {
  const a = actor(), p = allocation(), order = p.targets[0].woolOrderId
  saveAllocation(centralWoolAllocationRequest(p, order, 1, a, 'WST-BEFORE-CLOSED', at))
  const next = readWoolStore()
  next.completions.push({ completionId:'WST-CLOSED-READ-FIXTURE', woolOrderId:order, completedAt:at, completedBy:a.name,
    confirmationSnapshot:{ yarnReceiptSummary:[], outputReadinessSummary:[], processReportSummary:[], handoverSummary:[],
      waitProcessStockSummary:[], waitHandoverStockSummary:[], releasedMachineIds:[] } })
  replaceWoolStore(next)
  const row = facts().stocks.find(r => r.stock.woolOrderId === order && r.stock.batchNo === p.line.material.batchNo)!
  assert.equal(row.stock.currentQty, 1)
  assert.equal(row.stock.completed, true)
  assert.equal(row.canIssue, false); assert.equal(row.canReturn, false)
  assert.ok(!allocation().targets.some(o => o.woolOrderId === order))
  assert.throws(() => centralWoolYarnRequest(row, 'issue', 0.1, a, 'WST-CLOSED-ISSUE', at), /WST_blocked/)
}))

test('C02.04: warehouse history reads original effective quantities without replacing unknown receipts or changing facts', () => {
  const current = facts(), before = JSON.stringify(current.store)
  const original = current.store.handovers.find(r => r.handoverQty > 1)!
  const changed = structuredClone(current)
  changed.store.qtyChangeLogs.push({ changeId:'WST-READ-CHANGE-FIXTURE', recordType:'HANDOVER', recordId:original.handoverId,
    objectSkuCode:original.outputSkuCode, beforeQty:original.handoverQty, afterQty:original.handoverQty - 1,
    qtyUnit:original.qtyUnit, reason:'Explicit original change-log projection fixture', changedAt:at, changedBy:actor().name })
  const row = centralWoolWarehouseHandovers(changed).find(r => r.record.handoverId === original.handoverId)!
  assert.equal(row.quantity, original.handoverQty - 1)
  assert.equal(row.record.handoverQty, original.handoverQty)
  assert.deepEqual(row.record.downstreamReceipt, original.downstreamReceipt)
  assert.equal(JSON.stringify(current.store), before)
})

test('C02.06: warehouse receiving history includes original legacy and current receipts once and retains original operators',()=>{
 const f=facts(),before=JSON.stringify(f.store),rows=centralWoolWarehouseReceipts(f,factory)
 const orders=new Set(f.orders.map(o=>o.woolOrderId))
 const yarn=f.store.yarnReceipts.filter(r=>r.factoryId===factory||orders.has(r.woolOrderId)).flatMap(r=>r.lines)
 const pieces=f.store.pieceReceipts.filter(r=>orders.has(r.woolOrderId))
 assert.equal(rows.length,yarn.length+pieces.length)
 assert.equal(new Set(rows.map(r=>r.id)).size,rows.length)
 assert.ok(rows.some(r=>r.unit==='kg'&&r.source&&r.actorName))
 assert.ok(rows.some(r=>r.unit==='片'&&r.piece&&r.actorName))
 assert.equal(JSON.stringify(f.store),before)
})

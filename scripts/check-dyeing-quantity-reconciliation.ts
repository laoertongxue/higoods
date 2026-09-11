import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
const replay = process.env.DYE_QUANTITY_REPLAY
const values = new Map<string, string>(replay ? JSON.parse(readFileSync(replay, 'utf8')) : [])
const storage = {
  getItem: (k: string) => values.get(k) ?? null,
  setItem: (k: string, v: string) => values.set(k, v),
  removeItem: (k: string) => values.delete(k),
}
Object.defineProperty(globalThis, 'window', {
  value: {
    localStorage: storage,
    sessionStorage: storage,
    addEventListener: () => {},
    dispatchEvent: () => {},
    location: { pathname: '/fcs/craft/dyeing/work-orders' },
  },
  configurable: true,
})
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
Object.defineProperty(globalThis, 'document', { value: { addEventListener: () => {} }, configurable: true })
const d = await import('../src/data/fcs/dyeing-task-domain.ts'),
  r = await import('../src/data/fcs/factory-receiving.ts'),
  l = await import('../src/data/fcs/factory-receiving-links.ts'),
  w = await import('../src/data/fcs/dyeing-warehouse-view.ts'),
  stats = await import('../src/data/fcs/process-statistics-domain.ts'),
  facts = await import('../src/data/fcs/dyeing-quantity-facts.ts')
const near = (actual: number, expected: number) =>
  assert(Math.abs(actual - expected) < 0.000001, `${actual} != ${expected}`)
const stock = () => w.getDyeingWarehouseView().waitProcessItems.find((s) => s.stockItemId.includes('QR-FAB-L1'))!
function verify() {
  near(stock().availableQty!, 100 - 85 / 0.9144)
  near(stock().issuedQty!, 85 / 0.9144)
  near(d.getDyeExecutionNodeRecord('DWO-001', 'DYE')!.inputQty!, 5)
  near(d.getDyeWorkOrderById('DWO-001')!.completedExecutionBatches![0].find((n) => n.nodeCode === 'DYE')!.inputQty!, 80)
  near(facts.getDyeingQuantityFacts().find((f) => f.order.dyeOrderId === 'DWO-001')!.received, 128.016)
  assert(
    w
      .getDyeingWarehouseView({ factoryId: 'ID-F002' })
      .waitProcessItems.some((s) => s.stockItemId.includes('QR-DOWN-1')),
  )
  near(stats.getDyeingExecutionStatistics({workOrderId:'DWO-001'}).quantityGroups.find(g=>g.unit==='米')!.availableInput,128.016-85)
  const q = stats.getDyeingExecutionStatistics().quantityGroups
  for (const group of q) {
    const ff = facts.getDyeingQuantityFacts().filter((f) => f.order.qtyUnit === group.unit)
    near(
      group.handed,
      ff.reduce((n, f) => n + f.handed, 0),
    )
    near(
      group.downstreamReceived,
      ff.reduce((n, f) => n + f.downstreamReceived, 0),
    )
    near(
      group.packed,
      ff.reduce((n, f) => n + f.packed, 0),
    )
    near(
      group.availableInput,
      w
        .getDyeingWarehouseView()
        .waitProcessItems.filter((s) => s.unit === group.unit)
        .reduce((n, s) => n + (s.availableQty ?? 0), 0),
    )
  }
  const outbound = w.getDyeingWarehouseView().outboundRecords.filter((o) => o.sourceRecordId === 'DYE-DISPATCH-DEMO-1')
  assert(outbound.some((o) => o.outboundQty === 120 && o.receiverWrittenQty === 121 && o.differenceQty === 1))
  assert(w.getDyeingWarehouseView().usageRecords.some((u) => u.sourceRecordId === 'DWO-001' && u.usedBy === 'hilon'))
}
if (replay) {
  verify()
  assert.throws(
    () => d.startDyeing('DWO-001', { inputQty: 1, dyeVatNo: 'VAT-01', operatorName: 'hilon' }),
    /尚未包装完成/,
  )
  console.log(
    'PASS round 2: cold restart preserves receipts, actual use, roll stock, dispatch, actual downstream quantities and unit groups',
  )
  process.exit(0)
}
d.listDyeWorkOrders()
const src = r.getFactoryReceivingSource('RCV-SRC-001')!,
  pos = r.getDefaultFactoryReceiptPosition('ID-F003')
l.confirmFactoryMaterialReceipt({
  id: 'QR-FAB',
  factoryId: 'ID-F003',
  operatorName: 'hilon',
  operatorId: 'RCV-HILON',
  receivedAt: '2026-09-12 12:00:00',
  remark: '数量闭环验收',
  lines: [
    {
      sourceId: src.id,
      sourceLineId: src.lines[0].id,
      ...pos,
      rolls: [{ ...pos, barcode: src.lines[0].rolls[0].barcode, yard: 100 }],
    },
  ],
})
near(stock().availableQty!, 100)
assert(!d.getDyeExecutionNodeRecord('DWO-001', 'DYE')?.startedAt)
const actions = await import('../src/data/fcs/process-action-writeback-service.ts')
actions.executeDyeAction({
  sourceType: 'DYE_WORK_ORDER',
  sourceId: 'DWO-001',
  actionCode: 'DYE_START_DYEING',
  sourceChannel: 'Web',
  operatorName: 'hilon',
  objectQty: 80,
  formData: { dyeVatNo: 'VAT-01' },
} as Parameters<typeof actions.executeDyeAction>[0])
near(stock().availableQty!, 100 - 80 / 0.9144)
assert.throws(() => d.completeDyeing('DWO-001', { inputQty: 1, outputQty: 70 }), /不能修改/)
assert.throws(() => d.completeDyeing('DWO-001', { outputQty: 81 }), /不能超过/)
d.completeDyeing('DWO-001', { outputQty: 70, operatorName: 'hilon' })
near(stock().issuedQty!, 80 / 0.9144)
assert.throws(
  () =>
    r.recordFactoryMaterialUsage({
      id: 'OVER',
      dyeOrderId: 'DWO-001',
      factoryId: 'ID-F003',
      operatorName: 'hilon',
      at: '2026-09-12 12:30:00',
      qty: 12,
      unit: '米',
      legacyAvailableQty: 0,
    }),
  /超过/,
)
const spare = r.getFactoryReceivingSource('RCV-SRC-004')!
const reserve = l.confirmFactoryMaterialReceipt({
  id: 'QR-RESERVE',
  factoryId: 'ID-F003',
  operatorName: 'hilon',
  operatorId: 'RCV-HILON',
  receivedAt: '2026-09-12 12:00:00',
  remark: '备料关联验收',
  lines: [
    {
      sourceId: spare.id,
      sourceLineId: spare.lines[0].id,
      ...pos,
      rolls: [{ ...pos, barcode: spare.lines[0].rolls[0].barcode, yard: 100 }],
    },
  ],
})
assert(l.listReceivingAllocationTargets(reserve.lines[0].id).some((t) => t.id === 'DWO-001'))
const balance = w.getDyeingWarehouseView().waitProcessItems.reduce((n, s) => n + (s.availableQty ?? 0), 0)
l.allocateReceivedMaterialToOrder({
  id: 'QR-ALLOC',
  receiptLineId: reserve.lines[0].id,
  dyeOrderId: 'DWO-001',
  qty: 40,
  operatorName: 'hilon',
  at: '2026-09-12 12:35:00',
})
near(
  w.getDyeingWarehouseView().waitProcessItems.reduce((n, s) => n + (s.availableQty ?? 0), 0),
  balance,
)
// Allocation adds availability to the order, not a second physical inbound.
near(facts.getDyeingQuantityFacts().find((f) => f.order.dyeOrderId === 'DWO-001')!.received, 128.016)
assert.throws(
  () =>
    l.allocateReceivedMaterialToOrder({
      id: 'WRONG',
      receiptLineId: reserve.lines[0].id,
      dyeOrderId: 'DYE-YARN-DEMO-1',
      qty: 1,
      operatorName: 'hilon',
      at: '2026-09-12 12:35:00',
    }),
  /同一物料/,
)
// Independent multi-SKU input must not be arbitrarily pooled.
for (let i = 1; i <= 2; i++) {
  const copy = structuredClone(src)
  copy.id = `QR-MULTI-${i}`
  copy.documentNo = copy.id
  copy.lines = [
    {
      ...copy.lines[0],
      id: `QR-MULTI-L${i}`,
      dyeOrderId: 'DWO-002',
      material: { ...copy.lines[0].material, sku: `QR-SKU-${i}` },
      rolls: [{ barcode: `QR-ROLL-${i}`, yard: 20 }],
    },
  ]
  r.registerFactoryReceivingSource(copy)
  l.confirmFactoryMaterialReceipt({
    id: `QR-MULTI-R${i}`,
    factoryId: 'ID-F003',
    operatorName: 'hilon',
    operatorId: 'RCV-HILON',
    receivedAt: '2026-09-12 12:00:00',
    remark: '不同投入规格',
    lines: [
      {
        sourceId: copy.id,
        sourceLineId: copy.lines[0].id,
        ...pos,
        rolls: [{ ...pos, barcode: `QR-ROLL-${i}`, yard: 20 }],
      },
    ],
  })
}
assert.throws(() => d.startDyeing('DWO-002', { inputQty: 5, dyeVatNo: 'VAT-01' }), /多个投入 SKU/)
d.startDyeing('DWO-002', { inputQty: 5, dyeVatNo: 'VAT-01', materialSku: 'QR-SKU-2', operatorName: 'hilon' })
assert(
  r
    .listFactoryMaterialUses()
    .find((u) => u.dyeOrderId === 'DWO-002')!
    .lines.every((line) => line.receiptLineId === 'QR-MULTI-R2-L1'),
)
for (const node of ['DEHYDRATE', 'DRY', 'SET', 'ROLL', 'PACK'] as const) {
  d.startDyeNode('DWO-001', node)
  d.completeDyeNode('DWO-001', node, { outputQty: 70, operatorName: 'hilon' })
}
const legacy = await import('../src/data/fcs/process-execution-writeback.ts')
assert.throws(
  () => legacy.submitDyeHandover(d.getDyeWorkOrderById('DWO-001')!.taskId, { submittedQty: 70 }),
  /逐卷建单/,
)
const output = d
  .saveDyeOutputRolls('DWO-001', [
    { qty: 70, weightKg: 24.64, widthCm: 160, gsm: 220, vatNo: 'VAT-01', remark: '第一批包装70米' },
  ])
  .at(-1)!
d.markDyeOutputRolls('DWO-001', [output.id], 'print')
const firstBatch = d.createDyeDispatchDocument([{ orderId: 'DWO-001', rollIds: [output.id] }], 'hilon')
d.scanDyeDispatchRoll(firstBatch.id, output.barcode, 'hilon')
d.saveDyeDispatchTransport(firstBatch.id, { driver: 'Andi', vehicle: '货车', plate: 'B 1200 QA', note: '首批70米' })
const done = d.finishDyeDispatchDocument(firstBatch.id, 'confirm')
const pda = await import('../src/data/fcs/pda-handover-events.ts')
d.startDyeing('DWO-001', { inputQty: 5, dyeVatNo: 'VAT-01', operatorName: 'hilon' })
near(stock().availableQty!, 100 - 85 / 0.9144)
near(facts.getDyeingQuantityFacts().find((f) => f.order.dyeOrderId === 'DWO-001')!.used, 85)
near(facts.getDyeingQuantityFacts().find((f) => f.order.dyeOrderId === 'DWO-001')!.packed, 70)
assert.throws(() => d.submitDyeHandover('DYE-DISPATCH-DEMO-4', { handoverQty: 60 }), /逐卷建单/)
assert.throws(() => d.confirmDyeReceipt('DYE-DISPATCH-DEMO-4', { receivedBy: 'hilon' }), /接收方/)
const id = 'DYE-DISPATCH-DEMO-1',
  rolls = d
    .getDyeOutputRolls(id)
    .filter((x) => d.isDyeRollAvailable(id, x))
    .slice(0, 2)
const before = facts.getDyeingQuantityFacts().find((f) => f.order.dyeOrderId === id)!
const doc = d.createDyeDispatchDocument([{ orderId: id, rollIds: rolls.map((x) => x.id) }], 'hilon')
near(facts.getDyeingQuantityFacts().find((f) => f.order.dyeOrderId === id)!.handed, before.handed)
for (const roll of rolls) d.scanDyeDispatchRoll(doc.id, roll.barcode, 'hilon')
d.saveDyeDispatchTransport(doc.id, { driver: 'Andi', vehicle: '货车', plate: 'B 1234 QR', note: '数量闭环验收' })
const sent = d.finishDyeDispatchDocument(doc.id, 'confirm'),
  line = sent.lines[0]
near(d.getDyeDispatchAvailableQty(id), before.availableOutput - 120)
near(
  facts.getDyeingQuantityFacts().find((f) => f.order.dyeOrderId === id)!.downstreamReceived,
  before.downstreamReceived,
)
const source = r.getFactoryReceivingSource(line.receivingSourceId!)!,
  mp = r.getDefaultFactoryReceiptPosition('ID-F002')
function receive(id: string, barcodes: Array<{ barcode: string; yard: number }>) {
  l.confirmFactoryMaterialReceipt({
    id,
    factoryId: 'ID-F002',
    operatorName: 'dewi',
    operatorId: 'RCV-DEWI',
    receivedAt: '2026-09-12 13:00:00',
    remark: '分次登记实际数量',
    lines: [
      { sourceId: source.id, sourceLineId: source.lines[0].id, ...mp, rolls: barcodes.map((x) => ({ ...mp, ...x })) },
    ],
  })
}
receive('QR-DOWN-ZERO', [])
let actual = w.getDyeingWarehouseView().outboundRecords.find((o) => o.handoverRecordId === line.handoverRecordId)!
assert.equal(actual.receiverWrittenQty, 0)
assert.equal(actual.differenceQty, -120)
receive('QR-DOWN-1', [{ barcode: rolls[0].barcode, yard: 55 }])
near(facts.getDyeingQuantityFacts().find((f) => f.order.dyeOrderId === id)!.downstreamReceived, 55)
receive('QR-DOWN-2', [{ barcode: rolls[1].barcode, yard: 66 }])
assert.throws(() => receive('QR-DOWN-DUP', [{ barcode: rolls[1].barcode, yard: 66 }]), /重复入库/)
const oldStock = w.getDyeingWarehouseView({ timeRange: '7D' }).waitProcessItems
assert(oldStock.some((s) => s.stockItemId.startsWith('DYE-HISTORY-')))
// Associated reserve quantity changes order availability without a second physical inbound.
const expectedReceived = 128.016
near(facts.getDyeingQuantityFacts().find((f) => f.order.dyeOrderId === 'DWO-001')!.received, expectedReceived)
console.log(
  'PASS round 1: receipt does not start processing; 100 Yard - 80 m; immutable batch input; stock limit; reserve allocation conservation; multi-SKU selection; roll dispatch; zero/short/over/duplicate receipts; MJS and older stock; separate units',
)
const path = join(mkdtempSync(join(tmpdir(), 'dye-quantities-')), 'state.json')
writeFileSync(path, JSON.stringify([...values]))
const child = spawnSync(process.execPath, ['--import', 'tsx', import.meta.filename], {
  env: { ...process.env, DYE_QUANTITY_REPLAY: path },
  encoding: 'utf8',
})
assert.equal(child.status, 0, child.stdout + child.stderr)
console.log(child.stdout.trim())
if (process.env.DYE_QUANTITY_BROWSER_STATE)
  writeFileSync(process.env.DYE_QUANTITY_BROWSER_STATE, JSON.stringify([...values]))

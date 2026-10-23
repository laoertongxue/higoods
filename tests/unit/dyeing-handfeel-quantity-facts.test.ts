import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { applyFactoryQcCommand, emptyFactoryQcState, upsertFactoryQc, type FactoryQcCommand, type FactoryQcSource } from '../../src/data/fcs/factory-qc-model.ts'
import { convertReceiptQuantity } from '../../src/data/fcs/factory-receiving.ts'
import { listDyeWorkOrders } from '../../src/data/fcs/dyeing-task-domain.ts'

function functions(path: string, names: string[], dependencies: Record<string, unknown>): any {
  const ast = ts.createSourceFile(path, readFileSync(new URL('../../' + path, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true)
  const bodies = names.map(name => {
    const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)
    assert.ok(declaration, name)
    return declaration.getText(ast).replace(/^export\s+/, '')
  })
  const code = ts.transpileModule(bodies.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return new Function('dependencies', `with (dependencies) { ${code};return { ${names.join(',')} } }`)(dependencies)
}
const at = '2026-10-22T10:00:00+08:00'
function fixture(factoryId: string, native: any[] = []) {
  // A read-back native order supplies the schema. The final 360m batch is an explicit
  // isolated fixture; this test does not claim to execute automatic upstream completion.
  const dye = { ...structuredClone(listDyeWorkOrders()[0]), dyeOrderId: 'DWO-HF-QTY', dyeOrderNo: 'DYE-HF-QTY', taskId: 'TASK-HF-QTY', taskNo: 'TASK-HF-QTY', dyeFactoryId: factoryId, dyeFactoryName: factoryId === 'ID-F003' ? 'GTG' : '外部染厂', qtyUnit: '米', plannedQty: 360, materialReceipts: [{ receiptId: 'LEGACY-FIXTURE', qty: 360 }], outputMaterial: { sku: 'FAB-OUT', name: '实际面料', kind: 'FABRIC', imageUrl: '/fabric.jpg' }, completedExecutionBatches: [] }
  const source: FactoryQcSource = { kind: 'DYEING', id: dye.dyeOrderId, no: dye.dyeOrderNo, factoryId, factoryName: dye.dyeFactoryName, materialSku: 'FAB-OUT', materialName: '实际面料', imageUrl: '/fabric.jpg', requirementVersion: 'V1', unit: '米', target: { id: 'CENTRAL-WAREHOUSE', name: '中央仓', kind: 'WAREHOUSE', warehouseId: 'CENTRAL-WAREHOUSE', isDyeingFactory: false }, hasFinalOutput: true, rolls: [1, 2].map(n => ({ id: 'R' + n, barcode: 'DYE-ROLL-' + n, batchId: 'PACK-1', qty: 180, unit: '米', confirmed: true })), handedOutRollIds: [] }
  let state = emptyFactoryQcState(), sequence = 0
  const qc = upsertFactoryQc(state, source, at)!
  const act = (command: FactoryQcCommand) => { state = applyFactoryQcCommand(state, command, '实际记录员', 'OP-' + ++sequence, at, source) }
  const execute = (type: 'SEND' | 'RECEIVE' | 'START' | 'OUTPUT' | 'HANDOUT' | 'DOWNSTREAM_RECEIVE', rolls: Array<{ id: string; barcode?: string; qty?: number; warehouseId?: string; locationId?: string }>, differenceConfirmed = false) => {
    const order = state.handfeelOrders[0]
    act({ type, orderId: order.id, expectedVersion: order.version, rolls, differenceConfirmed })
  }
  const dependencies = {
    listDyeWorkOrders: () => [dye], listDyeExecutionNodeRecords: () => [{ nodeCode: 'DYE', startedAt: at, finishedAt: at, inputQty: 360, outputQty: 360 }, { nodeCode: 'PACK', finishedAt: at, outputQty: 360 }],
    getDyeOrderHandoverRecords: () => structuredClone(native), listFactoryMaterialUses: () => [], listFactoryReceipts: () => [], getFactoryReceivingSource: () => undefined,
    convertReceiptQuantity, readFactoryQcState: () => state, DYE_WORK_ORDER_STATUS_LABEL: {}, DYE_DEMO_DETAILS: {},
    dyeFactoryTabLabel: (_id: string, name: string) => name, getDyeOrderImageManifest: () => undefined, isDyeYarnOrder: () => false,
  }
  const quantities = functions('src/data/fcs/dyeing-quantity-facts.ts', ['getDyeingQuantityFacts', 'groupDyeQuantities'], dependencies)
  const warehouses = functions('src/data/fcs/dyeing-warehouse-view.ts', ['getDyeingWarehouseView'], {
    ...dependencies, getDyeingQuantityFacts: quantities.getDyeingQuantityFacts,
    listFactoryInternalWarehouses: () => [], listFactoryWaitProcessStockItems: () => [], listFactoryWarehouseInboundRecords: () => [], listStenterHandfeelOutputStock: () => [],
    listFactoryWarehouseNodeRows: () => [], listFactoryWarehouseStocktakeOrders: () => [],
  })
  const fact = () => quantities.getDyeingQuantityFacts()[0]
  const stock = () => warehouses.getDyeingWarehouseView().waitHandoverItems.find((row: any) => row.stockItemId === 'DYE-OUTPUT-' + dye.dyeOrderId)
  const outbound = () => warehouses.getDyeingWarehouseView().outboundRecords
  return { dye, source, native, state: () => state, qc, act, execute, fact, stock, outbound, quantities }
}

for (const factoryId of ['ID-F003', 'EXTERNAL-DYE']) {
  test(`AC-023/025: ${factoryId} actual SEND and short RECEIVE conserve the source without synthetic native handovers`, () => {
    const h = fixture(factoryId), original = structuredClone(h.dye)
    assert.equal(h.fact().availableOutput, 360)
    h.act({ type: 'DECIDE', qcId: h.qc.id, expectedVersion: 0, needs: true, target: '柔软手感' })
    assert.equal(h.fact().availableOutput, 360, 'QC/processing order creation cannot reduce source stock')
    assert.equal(h.outbound().length, 0)
    h.execute('SEND', [{ id: 'R1', barcode: 'DYE-ROLL-1' }])
    assert.equal(h.fact().handed, 180); assert.equal(h.fact().availableOutput, 180)
    assert.equal(h.stock().waitHandoverQty, 180); assert.equal(h.stock().inTransitQty, 180)
    assert.equal(h.stock().receiverWrittenQty, undefined); assert.equal(h.fact().difference, 0)
    assert.equal(h.outbound()[0].status, '已出库'); assert.equal(h.outbound()[0].receiverWrittenQty, undefined)
    assert.equal(h.outbound()[0].handoverOrderId, undefined)
    assert.equal(h.outbound()[0].handoverRecordId, undefined)
    assert.equal(h.outbound()[0].fabricRollNo, 'DYE-ROLL-1')
    h.execute('RECEIVE', [{ id: 'R1', barcode: 'DYE-ROLL-1', qty: 175, warehouseId: 'GTG-WH', locationId: 'A-01' }], true)
    assert.equal(h.fact().downstreamReceived, 175); assert.equal(h.fact().difference, -5)
    assert.equal(h.fact().availableOutput, 180); assert.equal(h.stock().inTransitQty, 0)
    assert.equal(h.outbound()[0].status, '差异'); assert.equal(h.outbound()[0].receiverWrittenQty, 175)
    assert.equal(h.fact().availableOutput + h.fact().handfeelReceived - h.fact().handfeelDifference, 360)
    h.execute('SEND', [{ id: 'R2', barcode: 'DYE-ROLL-2' }])
    assert.equal(h.stock().waitHandoverQty, 0); assert.equal(h.stock().inTransitQty, 180)
    assert.equal(h.stock().status, '已交出', 'empty native records/actual cannot imply written back')
    h.execute('RECEIVE', [{ id: 'R2', barcode: 'DYE-ROLL-2', qty: 180, warehouseId: 'GTG-WH', locationId: 'A-01' }])
    assert.equal(h.stock().inTransitQty, 0); assert.equal(h.stock().receiverWrittenQty, 355)
    assert.equal(h.fact().difference, -5); assert.equal(h.fact().downstreamRollCount, 2)
    const sourceFacts = structuredClone(h.fact())
    h.execute('START', [{ id: 'R1' }, { id: 'R2' }])
    h.execute('OUTPUT', [{ id: 'R1', barcode: 'GTG-OUT-1', qty: 170 }, { id: 'R2', barcode: 'GTG-OUT-2', qty: 178 }], true)
    assert.deepEqual(h.fact(), sourceFacts, 'handfeel use/output and generated QC cannot change earlier dye batch facts')
    h.execute('HANDOUT', [{ id: 'R1', barcode: 'GTG-OUT-1' }, { id: 'R2', barcode: 'GTG-OUT-2' }])
    h.execute('DOWNSTREAM_RECEIVE', [{ id: 'R1', qty: 170 }, { id: 'R2', qty: 178 }])
    const order = h.state().handfeelOrders[0]
    h.act({ type: 'COMPLETE', orderId: order.id, expectedVersion: order.version })
    assert.deepEqual(h.fact(), sourceFacts)
    assert.deepEqual(h.dye, original); assert.deepEqual(h.fact().records, []); assert.deepEqual(h.fact().actual, [])
    assert.equal(h.outbound().length, 2); assert.ok(h.outbound().every((row: any) => row.receiverName === 'GTG' && row.operatorName === '实际记录员'))
  })
}

test('native quantities and units remain separate, then add to disjoint handfeel physical transfers exactly once', () => {
  const native = [{ recordId: 'NATIVE-1', handoverRecordId: 'NATIVE-1', submittedQty: 20, receiverWrittenQty: 18, qtyUnit: 'Yard', receiverWrittenAt: at, factorySubmittedAt: at }]
  const h = fixture('EXTERNAL-DYE', native), before = structuredClone(native)
  h.act({ type: 'DECIDE', qcId: h.qc.id, expectedVersion: 0, needs: true, target: '柔软手感' })
  h.execute('SEND', [{ id: 'R1', barcode: 'DYE-ROLL-1' }])
  const f = h.fact(), sent = convertReceiptQuantity(20, 'Yard', '米')!, received = convertReceiptQuantity(18, 'Yard', '米')!
  assert.equal(f.nativeHanded, sent); assert.equal(f.nativeDownstreamReceived, received)
  assert.equal(f.handed, sent + 180); assert.equal(f.availableOutput, 360 - sent - 180)
  assert.equal(f.downstreamReceived, received); assert.equal(f.difference, received - sent)
  assert.equal(f.records.length, 1); assert.equal(f.actual.length, 1); assert.equal(f.handfeelTransfers.length, 1)
  assert.equal(f.downstreamRollCount, undefined, 'unknown native roll count cannot be replaced by handfeel-only count')
  assert.deepEqual(native, before)
  const group = h.quantities.groupDyeQuantities([f])[0]
  assert.equal(group.handed, f.handed); assert.equal(group.downstreamReceived, f.downstreamReceived)
})

test('unrelated printing sources and unsent rolls do not reduce dye stock or create source outbound projections', () => {
  const h = fixture('ID-F003')
  h.act({ type: 'DECIDE', qcId: h.qc.id, expectedVersion: 0, needs: true })
  h.state().handfeelOrders[0].source.kind = 'PRINTING'
  h.state().handfeelOrders[0].rolls[0].sentAt = at
  assert.equal(h.fact().handed, 0); assert.equal(h.fact().availableOutput, 360); assert.equal(h.outbound().length, 0)
})

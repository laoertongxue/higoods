import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyFactoryQcRecipient } from '../../src/data/fcs/factory-qc-recipient.ts'
import { resolveTerminalProcessOrderReceivingTarget } from '../../src/data/fcs/process-order-receiving-target.ts'
import { applyFactoryQcCommand, emptyFactoryQcState, upsertFactoryQc, type FactoryQcCommand, type FactoryQcSource } from '../../src/data/fcs/factory-qc-model.ts'

const at = '2026-10-22T10:00:00+08:00'
function source(kind: FactoryQcSource['kind'], targetId: string, factoryType?: string): FactoryQcSource {
  return {
    kind, id: 'SOURCE-1', no: '来源加工单', factoryId: 'SOURCE-FACTORY', factoryName: '来源工厂',
    materialSku: 'FAB-1', materialName: '面料', imageUrl: '/fabric/1.jpg', requirementVersion: 'V1', unit: '米',
    target: { id: targetId, name: '接收方', kind: 'WAREHOUSE', warehouseId: targetId, isDyeingFactory: classifyFactoryQcRecipient({ id: targetId, kind: 'WAREHOUSE', factoryType }) },
    hasFinalOutput: true, rolls: [{ id: 'R1', barcode: 'ROLL-1', batchId: 'B1', qty: 12.345, unit: '米', confirmed: true }], handedOutRollIds: [],
  }
}

test('AC-005: generic factory types and unregistered warehouse IDs remain unknown', () => {
  for (const factoryType of [undefined, '', '加工厂', '工厂', '其他', '未知染厂类型', 'FUTURE_DYE']) {
    assert.equal(classifyFactoryQcRecipient({ id: 'UNREGISTERED-FACTORY', factoryType }), undefined)
    assert.equal(classifyFactoryQcRecipient({ id: 'UNREGISTERED-WAREHOUSE', factoryType }), undefined)
  }
  for (const id of ['UNKNOWN', 'WH-NEW-001', 'CUTTING-', 'EARLY-PROCESS-']) {
    assert.equal(classifyFactoryQcRecipient({ id }), undefined)
    const state = emptyFactoryQcState()
    assert.equal(upsertFactoryQc(state, source('DYEING', id), at), undefined)
  }
  assert.equal(classifyFactoryQcRecipient({ id: 'CUTTING-UNKNOWN-FACTORY', kind: 'FACTORY', factoryType: '加工厂' }), undefined)
})

test('AC-004/005: explicit dye and print classifications are exact known types', () => {
  for (const factoryType of ['CENTRAL_DYE', '染厂']) assert.equal(classifyFactoryQcRecipient({ id: 'FACTORY-UNKNOWN', factoryType }), true)
  for (const factoryType of ['CENTRAL_PRINT', '印花厂', '印花加工厂', 'CENTRAL_CUTTING', '裁床厂']) {
    assert.equal(classifyFactoryQcRecipient({ id: 'FACTORY-UNKNOWN', factoryType }), false)
  }
})

test('AC-004/005: direct/warehouse-owner factory master classification overrides partner hints and business IDs', () => {
  assert.equal(classifyFactoryQcRecipient({ id: 'CENTRAL-WAREHOUSE', masterFactoryType: 'CENTRAL_DYE', factoryType: '印花厂' }), true)
  assert.equal(classifyFactoryQcRecipient({ id: 'DYE-WH-1', masterFactoryType: 'CENTRAL_DYE', factoryType: '加工厂' }), true)
  assert.equal(classifyFactoryQcRecipient({ id: 'FACTORY-1', masterFactoryType: 'CENTRAL_PRINT', factoryType: '染厂' }), false)
  assert.equal(classifyFactoryQcRecipient({ id: 'FACTORY-1', masterFactoryType: 'UNCLASSIFIED', factoryType: '印花厂' }), undefined)
})

test('AC-004/026: all fixed central warehouses have an explicit non-dye identity', () => {
  for (const id of ['WH-FABRIC-001', 'WH-ACCESSORY-001', 'CENTRAL-WAREHOUSE']) {
    assert.equal(classifyFactoryQcRecipient({ id, factoryType: '加工厂' }), false)
    assert.equal(upsertFactoryQc(emptyFactoryQcState(), source('DYEING', id), at)?.kind, 'DYEING')
  }
})

test('AC-004/005: registered accessory and cutting-transfer warehouses are known, while a similar unregistered name remains unknown', () => {
  for (const id of ['WH-FITTING-001', 'WH-BDG-005', 'WH-BDG-009']) assert.equal(classifyFactoryQcRecipient({ id, kind: 'WAREHOUSE' }), false)
  assert.equal(classifyFactoryQcRecipient({ id: 'WH-BDG-UNKNOWN', kind: 'WAREHOUSE' }), undefined)
})

test('AC-004: terminal business targets produced by the existing resolver are explicitly non-dye', () => {
  const terminals = [
    resolveTerminalProcessOrderReceivingTarget({ sourceType: 'STOCK' }),
    resolveTerminalProcessOrderReceivingTarget({ sourceType: 'PRODUCTION_ORDER', productionOrderNo: 'PO-001' }),
    resolveTerminalProcessOrderReceivingTarget({ sourceType: 'PRODUCTION_DEMAND', productionDemandNo: 'PD-001' }),
    resolveTerminalProcessOrderReceivingTarget({ sourceType: 'CUT_PIECE_SUPPLEMENT', supplementRecordNo: 'SUP-001' }),
    resolveTerminalProcessOrderReceivingTarget({ sourceType: 'DESIGN_REVISION', receivingTeamName: 'DESIGN-TEAM', receivingLocationName: 'DESIGN-LOCATION' }),
  ]
  for (const terminal of terminals) for (const id of [terminal.targetBusinessId, terminal.targetWarehouseId]) {
    assert.equal(classifyFactoryQcRecipient({ id, kind: 'WAREHOUSE' }), false, id)
    assert.equal(upsertFactoryQc(emptyFactoryQcState(), source('WATER_SOLUBLE', id), at)?.kind, 'DYEING')
  }
})

test('AC-001/005: printing QC remains independent of the downstream classification', () => {
  for (const factoryType of [undefined, '加工厂', '染厂', '印花厂']) {
    assert.equal(upsertFactoryQc(emptyFactoryQcState(), source('PRINTING', 'UNKNOWN-RECIPIENT', factoryType), at)?.kind, 'PRINTING')
  }
})

test('AC-026: first actual GTG output bound for a fixed central warehouse still creates dye QC', () => {
  for (const id of ['WH-FABRIC-001', 'WH-ACCESSORY-001', 'CENTRAL-WAREHOUSE']) {
    const s = source('PRINTING', id)
    let state = emptyFactoryQcState(), operation = 0
    const qc = upsertFactoryQc(state, s, at)!
    const apply = (command: FactoryQcCommand) => { state = applyFactoryQcCommand(state, command, '现场操作员', 'OP-' + ++operation, at, s) }
    apply({ type: 'DECIDE', qcId: qc.id, expectedVersion: 0, needs: true, target: '柔软手感' })
    const execute = (type: 'SEND' | 'RECEIVE' | 'START' | 'OUTPUT', rolls: Array<{ id: string; barcode?: string; qty?: number; warehouseId?: string; locationId?: string }>) => {
      const order = state.handfeelOrders[0]
      apply({ type, orderId: order.id, expectedVersion: order.version, rolls })
    }
    execute('SEND', [{ id: 'R1', barcode: 'ROLL-1' }])
    execute('RECEIVE', [{ id: 'R1', barcode: 'ROLL-1', qty: 12.345, warehouseId: 'GTG-WH', locationId: 'A-01' }])
    execute('START', [{ id: 'R1' }])
    execute('OUTPUT', [{ id: 'R1', barcode: 'GTG-OUT-1', qty: 12.345 }])
    const downstream = state.qcOrders.find(order => order.source.kind === 'STENTER_HAND_FEEL')
    assert.equal(downstream?.kind, 'DYEING', id)
    assert.equal(downstream?.source.target.id, id)
    assert.equal(downstream?.rolls[0].barcode, 'GTG-OUT-1')
    assert.equal(state.handfeelOrders[0].completedAt, undefined)
  }
})

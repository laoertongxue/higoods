import assert from 'node:assert/strict'
import test from 'node:test'
import { processTasks, splitGeneratedProcessTasksByReceivingTarget } from '../../src/data/fcs/process-tasks.ts'
import { getRuntimeTaskById } from '../../src/data/fcs/runtime-process-tasks.ts'
import { listFactoryMasterRecords, upsertFactoryMasterRecord, removeFactoryMasterRecord } from '../../src/data/fcs/factory-master-store.ts'
import { productionOrders, registerProductionOrderSewingFactory } from '../../src/data/fcs/production-orders.ts'

test('派单新增主档工厂可登记承接关系，未知工厂仍阻断', () => {
  const order = productionOrders.find(o => o.productionOrderId === 'PO-202603-0002')!
  const before = structuredClone(order)
  const factory = { ...listFactoryMasterRecords()[0], id: 'PPIC-NEW-FACTORY', code: 'PPIC-NEW', name: '新增车缝承接厂' }
  upsertFactoryMasterRecord(factory)
  try {
    const result = registerProductionOrderSewingFactory({ productionOrderId: order.productionOrderId, factoryId: factory.id, by: '验收' })
    assert.ok(result?.sewingFactorySnapshots?.some(f => f.id === factory.id && f.name === factory.name))
    assert.equal(registerProductionOrderSewingFactory({ productionOrderId: order.productionOrderId, factoryId: 'UNKNOWN-FACTORY', by: '验收' }), null)
  } finally {
    Object.assign(order, before)
    removeFactoryMasterRecord(factory.id)
  }
})

test('专属任务保留整单身份、数量和接收方，工艺分支保留全部前置关系', () => {
  for (const code of ['SEW', 'CUT_PANEL', 'WOOL', 'POST_FINISHING']) {
    const source = { ...structuredClone(processTasks[0]), taskId: 'SOURCE', taskNo: 'SOURCE', rootTaskNo: 'SOURCE', processBusinessCode: code, qty: 100, receiverId: 'DOMAIN', receiverName: '专属接收仓', dependsOnTaskIds: [] }
    const input = [source, ...['A', 'B'].map(id => ({ ...structuredClone(source), taskId: id, taskNo: id, rootTaskNo: id, processBusinessCode: 'DYE', dependsOnTaskIds: ['SOURCE'] }))]
    const result = splitGeneratedProcessTasksByReceivingTarget(input)
    assert.equal(result.length, 3)
    const kept = result.find(t => t.taskId === 'SOURCE')!
    assert.equal(kept.qty, 100)
    assert.equal(kept.receiverId, 'DOMAIN')
    assert.deepEqual(kept.detailRows, source.detailRows)
    for (const id of ['A', 'B']) assert.deepEqual(result.find(t => t.taskId === id)?.dependsOnTaskIds, ['SOURCE'])
  }
})

test('原生产单车缝任务仍可被 PPIC 分配与责任移交识别，SKU 总量完整', () => {
  const task = getRuntimeTaskById('TASKGEN-202603-0002-002__ORDER')
  assert.ok(task)
  assert.equal(task.scopeQty, 2500)
  assert.equal(task.scopeSkuLines.reduce((sum, line) => sum + line.qty, 0), 2500)
})

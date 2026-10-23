import assert from 'node:assert/strict'
import test from 'node:test'
import { listFactoryMasterRecords } from '../../src/data/fcs/factory-master-store.ts'
import { isCentralPdaFactory } from '../../src/data/fcs/pda-experience-scope.ts'
import { buildWorkOrderQrValue, buildTaskQrValue, buildHandoverRecordQrValue } from '../../src/data/fcs/task-qr.ts'
import { listCentralSpecialOrders, listCentralSpecialFactories, centralSpecialScanOrders, centralSpecialScanKey } from '../../src/pages/central-pda/special-model.ts'

test('中央辅助及特种原加工单纸码逐工序找到原单，禁止跨工厂和跨工序', () => {
  const orders=listCentralSpecialOrders()
  assert.ok(orders.length>0)
  for(const order of orders){
    const matches=centralSpecialScanOrders(buildWorkOrderQrValue(order.taskOrderId),order.factoryId,order.operationId)
    assert.ok(matches.some(row=>row.taskOrderId===order.taskOrderId),order.taskOrderNo)
    assert.deepEqual(centralSpecialScanOrders(buildWorkOrderQrValue(order.taskOrderId),'FOREIGN',order.operationId),[])
    assert.deepEqual(centralSpecialScanOrders(buildWorkOrderQrValue(order.taskOrderId),order.factoryId,'OTHER-OPERATION'),[])
    if(order.sourceTaskId)assert.ok(centralSpecialScanOrders(buildTaskQrValue(order.sourceTaskId),order.factoryId,order.operationId).some(row=>row.taskOrderId===order.taskOrderId))
  }
})
test('扫码不改原ID，保留多SKU与菲票歧义，不把交接记录或未知版本当加工单',()=>{
  const order=listCentralSpecialOrders().find(order=>order.feiTicketNos.length>0)!
  assert.ok(order)
  const code=order.feiTicketNos[0]
  assert.ok(centralSpecialScanOrders(' '+code.toLowerCase()+' ',order.factoryId,order.operationId).some(row=>row.taskOrderId===order.taskOrderId))
  assert.equal(centralSpecialScanKey('FCS:WORK_ORDER:v1:ORDER:SPEC:001'),'order:spec:001')
  assert.deepEqual(centralSpecialScanOrders(buildHandoverRecordQrValue(order.taskOrderId),order.factoryId,order.operationId),[])
  assert.deepEqual(centralSpecialScanOrders('FCS:WORK_ORDER:v99:'+order.taskOrderId,order.factoryId,order.operationId),[])
  assert.deepEqual(centralSpecialScanOrders('WRONG-SCAN',order.factoryId,order.operationId),[])
})

test('没有辅助工艺任务的有效中央工厂仍可作为本人当前工厂，不能借此列出外厂任务',()=>{
  const source=listFactoryMasterRecords().find(f=>f.status==='active'&&isCentralPdaFactory(f)&&!listCentralSpecialOrders(f.id).length)
  assert.ok(source)
  assert.ok(listCentralSpecialFactories(source.id).some(f=>f.id===source.id))
  assert.deepEqual(listCentralSpecialOrders(source.id),[])
  assert.ok(!listCentralSpecialFactories('FOREIGN').some(f=>f.id==='FOREIGN'))
})

import { centralWoolCraftAssignments, centralWoolCraftContexts } from '../../src/pages/central-pda/wool-craft-model.ts'
test('C08 factory and operation assignment menus preserve original wool tasks without receiving projections',()=>{
  const assignments=centralWoolCraftAssignments(), contexts=centralWoolCraftContexts()
  assert.deepEqual(assignments.map(t=>t.taskOrderId).sort(),contexts.map(c=>c.task.taskOrderId).sort())
  for(const factory of new Set(assignments.map(t=>t.factoryId)))assert.deepEqual(centralWoolCraftAssignments(factory).map(t=>t.taskOrderId).sort(),contexts.filter(c=>c.task.factoryId===factory).map(c=>c.task.taskOrderId).sort())
  assert.deepEqual(centralWoolCraftAssignments('DYE-GOTO-GLOBAL'),[])
  assert.deepEqual(centralWoolCraftContexts('DYE-GOTO-GLOBAL'),[])
})

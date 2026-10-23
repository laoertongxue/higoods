import assert from 'node:assert/strict'
import test from 'node:test'
import { centralLaceActions, centralLaceOrders, centralLaceScan, centralLaceActor, centralLaceRevision, saveCentralLaceCommand } from '../../src/pages/central-pda/lace-model.ts'
import { captureLaceFactoryRuntime, restoreLaceFactoryRuntime, listLaceProductionOrders, PLATFORM_ADMIN } from '../../src/data/fcs/lace-factory-domain.ts'
import { listExecutableLaceWorkOrderActions } from '../../src/pages/process-factory/accessory/lace/work-order-action-policy.ts'
import { readFactoryPdaExecutionUsers } from '../../src/data/fcs/store-domain-pda.ts'
import { buildWorkOrderQrValue } from '../../src/data/fcs/task-qr.ts'

test('C09 lace four execution actions match current Web on all actual original orders',()=>{
  const map:Record<string,string>={'confirm-receive':'receive','report-completion':'work','handover':'handoff','complete-production':'finish'}
  for(const order of listLaceProductionOrders(PLATFORM_ADMIN))assert.deepEqual(centralLaceActions(order).sort(),listExecutableLaceWorkOrderActions(order,PLATFORM_ADMIN,false).filter(a=>map[a.key]).map(a=>map[a.key]).sort())
})
test('C09 lace scanner preserves original paper IDs, order unit, source and factory',()=>{
  for(const order of listLaceProductionOrders(PLATFORM_ADMIN)){
    assert.ok(centralLaceScan(buildWorkOrderQrValue(order.workOrderId),order.factoryOrgId).some(o=>o.workOrderId===order.workOrderId))
    assert.ok(centralLaceScan(order.workOrderNo,order.factoryOrgId).some(o=>o.workOrderId===order.workOrderId))
    assert.deepEqual(centralLaceScan(order.workOrderNo,'FOREIGN'),[])
    assert.equal(centralLaceOrders(order.factoryOrgId).find(o=>o.workOrderId===order.workOrderId)!.unit,order.unit)
    assert.deepEqual(centralLaceScan('FCS:HANDOVER:v1:'+order.workOrderId,order.factoryOrgId),[])
  }
})
test('C09 lace actual account is canonical and a fabricated name is rejected',()=>{
  const order=listLaceProductionOrders(PLATFORM_ADMIN)[0],user=readFactoryPdaExecutionUsers(order.factoryOrgId).find(u=>u.status==='ACTIVE')!
  assert.ok(user);assert.equal(centralLaceActor(user).actorId,user.userId)
  assert.throws(()=>centralLaceActor({...user,name:'Not actual name'}))
})
test('C09 lace pending receipt confirms the task, not quantity, and keeps its original Yard unit',async()=>{
  const before=captureLaceFactoryRuntime()
  try{
    const order=listLaceProductionOrders(PLATFORM_ADMIN).find(o=>o.status==='待接收')!,user=readFactoryPdaExecutionUsers(order.factoryOrgId).find(u=>u.status==='ACTIVE')!
    await saveCentralLaceCommand({workOrderId:order.workOrderId,action:'receive',operationId:'LACE-MODEL-RECEIVE',expectedRevision:centralLaceRevision(order.workOrderId)},user)
    const saved=centralLaceOrders(user.factoryId).find(o=>o.workOrderId===order.workOrderId)!
    assert.equal(saved.status,'加工中');assert.equal(saved.unit,order.unit);assert.equal(saved.completedQty,0);assert.equal(saved.receivedQty,0)
    assert.equal(captureLaceFactoryRuntime().logs.at(-1)!.actorId,user.userId)
  }finally{restoreLaceFactoryRuntime(before)}
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { captureLaceFactoryRuntime, restoreLaceFactoryRuntime, createLaceFactoryStaticSnapshot, confirmLaceProductionReceipt, createLaceCompletionReport, LACE_FACTORY_OPERATOR, listLaceProductionOrders, PLATFORM_ADMIN } from '../../src/data/fcs/lace-factory-domain.ts'
import { runLaceFactoryRecordCommand } from '../../src/data/fcs/lace-factory-records.ts'

test('C09 lace static baseline is detached and does not reset actual execution state', () => {
  const before=captureLaceFactoryRuntime()
  try {
    const order=listLaceProductionOrders(PLATFORM_ADMIN).find(o=>o.status==='待接收')!
    confirmLaceProductionReceipt(order.workOrderId,LACE_FACTORY_OPERATOR)
    const actual=captureLaceFactoryRuntime(),base=createLaceFactoryStaticSnapshot()
    assert.equal(base.workOrders.find(o=>o.workOrderId===order.workOrderId)!.status,'待接收')
    assert.deepEqual(captureLaceFactoryRuntime(),actual)
    base.workOrders.length=0
    assert.ok(captureLaceFactoryRuntime().workOrders.length)
  } finally {restoreLaceFactoryRuntime(before)}
})
test('C09 lace original receive and later invalid report roll back together', async()=>{
  const before=captureLaceFactoryRuntime()
  try{
    const order=listLaceProductionOrders(PLATFORM_ADMIN).find(o=>o.status==='待接收')!
    await assert.rejects(runLaceFactoryRecordCommand('LACE-ROLLBACK','receive+invalid',()=>{
      confirmLaceProductionReceipt(order.workOrderId,LACE_FACTORY_OPERATOR)
      createLaceCompletionReport({workOrderId:order.workOrderId,qty:-1,clientActionId:'INVALID',actor:LACE_FACTORY_OPERATOR})
    }))
    assert.deepEqual(captureLaceFactoryRuntime(),before)
  } finally {restoreLaceFactoryRuntime(before)}
})
test('C09 lace stale order is rejected before original mutation',async()=>{
  const before=captureLaceFactoryRuntime(),order=before.workOrders.find(o=>o.status==='待接收')!
  let called=false
  await assert.rejects(runLaceFactoryRecordCommand('LACE-STALE','receive',()=>{called=true},{workOrderId:order.workOrderId,expected:'stale'}),/已变化/)
  assert.equal(called,false);assert.deepEqual(captureLaceFactoryRuntime(),before)
})

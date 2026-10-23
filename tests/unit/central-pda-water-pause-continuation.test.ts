import assert from 'node:assert/strict'
import test from 'node:test'
import { waterErrorText } from '../../src/pages/central-pda/water-ui.ts'
import { listWaterSolubleWorkOrders, restoreWaterSolubleOrderMutation, resolveWaterSolublePause } from '../../src/data/fcs/water-soluble-task-domain.ts'

test('C06.18: continuing a paused cumulative order preserves already handed quantities and receipt responsibility',()=>{
  const original=listWaterSolubleWorkOrders().find(order=>order.status==='PRODUCTION_PAUSED')!
  const history=[{batchId:'HANDOUT-CONTINUE-100',handoverQty:100,receivedQty:100}]
  const paused={...original,handoverQty:100,receivedQty:100,handoverBatches:history}
  restoreWaterSolubleOrderMutation(paused)
  try{
    const result=resolveWaterSolublePause(original.waterOrderId,'CONTINUE_PROCESSING')
    assert.equal(result.ok,true);assert.equal(result.order!.status,'WAIT_WATER_SOLUBLE')
    assert.equal(result.order!.completedQty,paused.completedQty)
    assert.equal(result.order!.handoverQty,100)
    assert.equal(result.order!.completedQty-result.order!.handoverQty!,paused.completedQty-100)
    assert.equal(result.order!.receivedQty,100)
    assert.deepEqual(result.order!.handoverBatches,history)
  }finally{restoreWaterSolubleOrderMutation(original)}
})

test('C06.18: an unshipped paused order retains its existing continue, actual-output and rework decisions',()=>{
  const original=listWaterSolubleWorkOrders().find(order=>order.status==='PRODUCTION_PAUSED')!
  try{
    for(const decision of ['CONTINUE_PROCESSING','CONTINUE_WITH_ACTUAL_QTY','RETURN_FOR_REWORK'] as const){
      restoreWaterSolubleOrderMutation(original)
      const result=resolveWaterSolublePause(original.waterOrderId,decision)
      assert.equal(result.ok,true)
      assert.equal(result.order!.completedQty,decision==='RETURN_FOR_REWORK'?0:original.completedQty)
      assert.equal(result.order!.handoverQty,original.handoverQty)
      assert.equal(result.order!.status,decision==='CONTINUE_WITH_ACTUAL_QTY'?'WAIT_HANDOVER':'WAIT_WATER_SOLUBLE')
    }
  }finally{restoreWaterSolubleOrderMutation(original)}
})

test('C06.20: rework cannot reset a real handed/received batch, including a historical cleared total',()=>{
  const original=listWaterSolubleWorkOrders().find(order=>order.status==='PRODUCTION_PAUSED')!
  try{
    for(const total of [100,undefined]){
      const paused={...original,handoverQty:total,receivedQty:100,handoverBatches:[{batchId:'ACTUAL-HANDOUT-100',handoverQty:100,receivedQty:100}]}
      restoreWaterSolubleOrderMutation(paused)
      const result=resolveWaterSolublePause(original.waterOrderId,'RETURN_FOR_REWORK')
      assert.equal(result.ok,false,'rework must not erase actual handed quantities')
      const current=listWaterSolubleWorkOrders().find(order=>order.waterOrderId===original.waterOrderId)!
      assert.equal(current.completedQty,paused.completedQty)
      assert.equal(current.handoverQty,total)
      assert.equal(current.receivedQty,100)
      assert.equal(current.status,'PRODUCTION_PAUSED')
      assert.deepEqual(current.handoverBatches,paused.handoverBatches)
    }
  }finally{restoreWaterSolubleOrderMutation(original)}
})


test('C06.20: rework handover guard has an actionable Indonesian message without changing units',()=>{
  const message=waterErrorText(new Error('已有实际交出，不能清空完成数量。可继续加工或按实际数量交出。'),'id')
  assert.match(message,/Total hasil tidak dapat dihapus/)
  assert.match(message,/lanjut proses/)
  assert.doesNotMatch(message,/[\u3400-\u9fff]/)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { printDispatchGroup } from '../../src/pages/central-pda/print-dispatch-model.ts'
import { printDispatchError } from '../../src/pages/central-pda/print-dispatch-view.ts'
import { isKnownWashingPrintDemoIdentity } from '../../src/data/fcs/printing-factories.ts'

const base={printFactoryId:'F090',receivingTargetId:'WH-FABRIC-001',receivingTargetName:'GKP',receivingTargetWarehouseName:'GKP fabric',output:{qtyUnit:'Yard',sku:'FIRST'}}
test('native dispatch grouping allows different source orders and SKUs, while keeping factory, recipient warehouse and original unit boundaries',()=>{
 const key=printDispatchGroup(base)
 assert.equal(printDispatchGroup({...base,workOrderId:'ANOTHER',output:{qtyUnit:'Yard',sku:'SECOND'}}),key)
 for(const changed of [{...base,printFactoryId:'OTHER'},{...base,receivingTargetId:'OTHER'},{...base,receivingTargetName:'OTHER'},{...base,receivingTargetWarehouseName:'OTHER'},...['m','米','件','kg'].map(qtyUnit=>({...base,output:{qtyUnit}}))])assert.notEqual(printDispatchGroup(changed),key)
})
test('wrapped physical scan and touch-gate errors remain actionable Indonesian without exposing technical codes',()=>{
 assert.match(printDispatchError(new Error('印花操作未保存，原动作已撤回。PD_duplicate'),'id'),/sudah diperiksa/)
 for(const error of ['请先扫齐交出单内的全部卷，再确认实际交出。','请先实际触摸本卷面料，登记是否需要洗水。','PD_reserved','PD_targetMissing'])assert.doesNotMatch(printDispatchError(new Error(error),'id'),/[\u3400-\u9fff]|PD_/)
})
test('washing print handovers recognize only the twelve fixed source/task/factory identities',()=>{
 for(const type of ['PRODUCTION','PRODUCTION_DEMAND','PURCHASE','STOCK','SUPPLEMENT','DESIGN_REVISION'])for(const state of ['DONE','PAPER']){
  const id=`PWO-WASH-DEMO-${type}-${state}`,task=`TASK-${id}`
  assert.equal(isKnownWashingPrintDemoIdentity(id,task,'F090'),true)
  assert.equal(isKnownWashingPrintDemoIdentity(id,task,'OTHER'),false)
  assert.equal(isKnownWashingPrintDemoIdentity(id,task+'-OTHER','F090'),false)
 }
 assert.equal(isKnownWashingPrintDemoIdentity('PWO-WASH-DEMO-OTHER-DONE','TASK-PWO-WASH-DEMO-OTHER-DONE','F090'),false)
})

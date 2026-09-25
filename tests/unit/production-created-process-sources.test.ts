import test from 'node:test'
import assert from 'node:assert/strict'
import { validateProductionCreatedProcessSources, type ProductionCreatedProcessSourceFact } from '../../src/data/fcs/production-created-process-source-types.ts'
import { shouldApplyProductionCreatedProcessSource, withProductionCreationSourceStage, isProductionCreationSourceStage, recordProductionCreatedProcessSource } from '../../src/data/fcs/production-created-process-sources.ts'
import { productionOrders } from '../../src/data/fcs/production-orders.ts'
import type { ProcessWorkOrderSourceSnapshot } from '../../src/data/fcs/process-work-order-domain.ts'

const fact: ProductionCreatedProcessSourceFact = {processCode:'DYE',workOrderId:'EARLY-1',decision:{matchStatus:'MATCH_FAILED',checkedAt:'2026-09-25 12:00:00',operatorName:'系统',productionOrderId:'PO-TEST',productionOrderNo:'PO-TEST',failureReason:'未匹配'}}
const source: ProcessWorkOrderSourceSnapshot = {sourceType:'PRODUCTION_DEMAND',productionDemandId:'DEM-1',matchStatus:'WAIT_TECH_PACK'}
test('生产单创建来源只覆盖旧匹配事实，不复活已取消或覆盖更新后的匹配',()=>{
 assert.equal(shouldApplyProductionCreatedProcessSource(source,fact),true)
 assert.equal(shouldApplyProductionCreatedProcessSource({...source,matchStatus:'CANCELLED'},fact),false)
 assert.equal(shouldApplyProductionCreatedProcessSource({...source,matchCheckedAt:'2026-09-26'},fact),false)
 assert.equal(shouldApplyProductionCreatedProcessSource({...source,matchCheckedAt:fact.decision.checkedAt,matchStatus:'MATCH_FAILED',productionOrderId:'PO-TEST'},fact),false)
})
test('提前来源随PO唯一保存，重复生成不会追加第二份事实；查询投影不反向写PO',()=>{
 const order={...structuredClone(productionOrders[0]),productionOrderId:'PO-TEST',productionCreatedProcessSources:undefined};productionOrders.push(order)
 try{
  withProductionCreationSourceStage(()=>{recordProductionCreatedProcessSource(fact);recordProductionCreatedProcessSource(fact)},true)
  assert.equal(order.productionCreatedProcessSources?.length,1)
  withProductionCreationSourceStage(()=>recordProductionCreatedProcessSource({...fact,workOrderId:'READ-ONLY'}))
  assert.equal(order.productionCreatedProcessSources?.length,1)
 }finally{productionOrders.splice(productionOrders.indexOf(order),1)}
})
test('失败和嵌套投影后创建stage标记恢复，不影响后续染印执行保存',()=>{
 assert.equal(isProductionCreationSourceStage(),false)
 assert.throws(()=>withProductionCreationSourceStage(()=>{assert.equal(isProductionCreationSourceStage(),true);withProductionCreationSourceStage(()=>{throw Error('abort')})}),/abort/)
 assert.equal(isProductionCreationSourceStage(),false)
})
test('备份拒绝错误归属、重复、未知状态和缺少正式冻结来源的匹配',()=>{
 assert.doesNotThrow(()=>validateProductionCreatedProcessSources([fact],'PO-TEST'))
 for(const value of [null,[fact,fact],[{...fact,processCode:'CUT'}],[{...fact,decision:{...fact.decision,productionOrderId:'OTHER'}}],[{...fact,decision:{...fact.decision,matchStatus:'MATCHED'}}]])assert.throws(()=>validateProductionCreatedProcessSources(value,'PO-TEST'))
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { projectTmfUpstreamProcessOrders } from '../../src/data/fcs/tmf-upstream-process-orders.ts'
import type { TmfProductionDemand } from '../../src/data/fcs/webbing-production-demands.ts'
import type { DyeWorkOrder } from '../../src/data/fcs/dyeing-task-domain.ts'
import type { PrintWorkOrder } from '../../src/data/fcs/printing-task-domain.ts'

function fixture() {
  const route = (id:string,processCode:string,input:string,output:string,predecessorEntryIds:string[]) => ({id,processCode,processName:id,inputMaterialSkuId:input,outputMaterialSkuId:output,predecessorEntryIds})
  const demand = {id:'S',productionOrderId:'PROD',techPackSnapshotId:'SNAP',techPackVersionId:'V1',routeEntryId:'CUT',bomItemId:'BOM',routeSnapshot:[route('CUT','WEBBING_CUT','PATTERN','PATTERN',['PRINT']),route('PRINT','PRINT','BLUE','PATTERN',['DYE']),route('DYE','DYE','WHITE','BLUE',[])]} as TmfProductionDemand
  const source = {sourceType:'PRODUCTION_ORDER' as const,productionOrderId:'PROD',techPackVersionId:'V1',bomItemId:'BOM'}
  const dye = {dyeOrderId:'D/1',dyeOrderNo:'DYE-1',dyeFactoryId:'DYE-F',dyeFactoryName:'染厂',sourceSnapshot:{...source,processEntryId:'DYE'},rawMaterialSku:'WHITE',outputMaterial:{sku:'BLUE'},plannedQty:650,qtyUnit:'米',status:'WAIT_MATERIAL'} as DyeWorkOrder
  const print = {printOrderId:'P/1',printOrderNo:'PRINT-1',printFactoryId:'PRINT-F',printFactoryName:'印花厂',sourceSnapshot:{...source,processEntryId:'PRINT'},materialSku:'BLUE',outputMaterialSku:'PATTERN',plannedQty:640,qtyUnit:'米',status:'WAIT_MATERIAL'} as PrintWorkOrder
  return {demand,dye,print}
}
test('N01采用路线按染色→印花关联原单，多尺码不重复列工序，不修改印染数量',()=>{
 const {demand,dye,print}=fixture(),before=structuredClone([dye,print])
 const rows=projectTmfUpstreamProcessOrders([demand,{...demand,id:'M'}],[dye],[print])
 assert.deepEqual(rows.map(r=>r.entryId),['DYE','PRINT'])
 assert.deepEqual(rows.map(r=>r.matchedOrderId),['D/1','P/1'])
 assert.equal(rows[0].rows[0].route,'/fcs/craft/dyeing/work-orders/D%2F1')
 assert.deepEqual([dye,print],before)
})
test('旧版本、错误SKU、码制单位、取消或变更待处理均不作为有效关联',()=>{
 const {demand,dye}=fixture()
 for(const patch of [{sourceSnapshot:{...dye.sourceSnapshot!,techPackVersionId:'V0'}},{rawMaterialSku:'OTHER'},{outputMaterial:{sku:'OTHER'}},{qtyUnit:'Yard'},{status:'CANCELLED'},{changeImpact:[{}]},{dyeFactoryId:''}]){
  const row=projectTmfUpstreamProcessOrders([demand],[{...dye,...patch} as DyeWorkOrder],[])[0]
  assert.equal(row.matchedOrderId,undefined)
  assert.equal(row.state,'来源不匹配')
 }
})
test('同号不同生产单或BOM不得关联，重复来源不静默选择，混合快照阻断',()=>{
 const {demand,dye}=fixture()
 for(const sourceSnapshot of [{...dye.sourceSnapshot!,productionOrderId:'OTHER'},{...dye.sourceSnapshot!,bomItemId:'OTHER'}]) assert.equal(projectTmfUpstreamProcessOrders([demand],[{...dye,sourceSnapshot}],[])[0].state,'缺少对应加工单')
 assert.equal(projectTmfUpstreamProcessOrders([demand],[dye,{...dye,dyeOrderId:'D2'}],[])[0].state,'多个来源待核对')
 assert.throws(()=>projectTmfUpstreamProcessOrders([demand,{...demand,techPackSnapshotId:'SNAP2'}],[],[]),/采用快照/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { applyWashingCommand, emptyWashingState, type WashingSource } from '../../src/data/fcs/fabric-washing-model.ts'
import { printingWashingLogs, printingWashingOrders, technicalWashingOrders, printingDownstreamNames, withPrintingWashingRead } from '../../src/data/fcs/fabric-washing-views.ts'
import { registerWashingProjection } from '../../src/data/fcs/fabric-washing-repository.ts'
import { washingInformationColumns, washingQuantities, upgradeWashingColumnPreferences } from '../../src/pages/process-factory/dyeing/washing/order-presentation.ts'
import { normalizeListColumnPreferences } from '../../src/components/ui/list-table-model.ts'

function fixture(){
  const source:WashingSource={objectType:'FABRIC',id:'print/batch',printOrderId:'PRINT-VIEWS',printOrderNo:'PH-VIEWS',batchId:'B1',sourceType:'PRODUCTION',sourceNo:'PO-A',productionOrderId:'PO-A',techPackVersionId:'tdv_demand_SPU_A',factoryId:'PRINT-A',factoryName:'印花厂 A',materialSku:'FAB-A',materialName:'印花面料 A',imageUrl:'/materials/fei-ticket/blue-white-print-cotton.png',revision:'v1',actualCompleted:true,target:{id:'WH-A',name:'原面料仓',warehouseId:'WH-A'},rolls:[1,2].map(n=>({id:'R'+n,barcode:'BAR-'+n,qty:50,unit:'Yard',confirmed:true,handedOut:false}))}
  const actor={id:'site-A',name:'张三',role:'现场判断人员' as const,factoryId:'PRINT-A'}
  const command={type:'JUDGE' as const,source,rollIds:['R1'],decision:'WASH' as const,handFeel:'柔软手感' as const}
  return {source,actor,command,state:applyWashingCommand(emptyWashingState(),command,actor,'VIEW-1','2026-10-15T09:00:00+08:00').state}
}
test('WASH-230/232/241/243: links and initiation logs derive from the same atomic order and action',()=>{
  const {state,source}=fixture(),before=JSON.stringify(state)
  const orders=printingWashingOrders(source.printOrderId,state),logs=printingWashingLogs(source.printOrderId,state)
  assert.equal(orders.length,1);assert.equal(orders[0].assignedFactoryName,'GTG');assert.deepEqual(orders[0].rollIds,['R1'])
  assert.equal(logs.length,1);assert.equal(logs[0].operatorName,'张三');assert.equal(logs[0].operatedAt,'2026-10-15T09:00:00+08:00')
  assert.match(logs[0].remark,/柔软手感/);assert.match(logs[0].remark,/BAR-1/);assert.doesNotMatch(logs[0].remark,/BAR-2/)
  assert.equal(printingWashingOrders('OTHER',state).length,0);assert.equal(JSON.stringify(state),before)
})
test('WASH-233/234/235: actual route additions are isolated by exact version and production order',()=>{
  const {state}=fixture()
  assert.equal(technicalWashingOrders('tdv_demand_SPU_A','PO-A',state).length,1)
  assert.equal(technicalWashingOrders('TDV-DEMAND-SPU_A','PO-A',state).length,1)
  assert.equal(technicalWashingOrders('tdv_demand_SPU_A-v2',undefined,state).length,0)
  assert.equal(technicalWashingOrders('tdv_demand_SPU_A','PO-B',state).length,0)
  assert.equal(technicalWashingOrders('',undefined,state).length,0)
})
test('WASH-236/237/247: no-wash never creates a route; retry and cancellation do not duplicate active additions',()=>{
  const {state,source,actor,command}=fixture()
  const retried=applyWashingCommand(state,command,actor,'VIEW-1','2026-10-15T09:00:00+08:00').state
  assert.equal(technicalWashingOrders(source.techPackVersionId!,undefined,retried).length,1)
  const none=applyWashingCommand(emptyWashingState(),{...command,decision:'NO_WASH',handFeel:undefined},actor,'NO-1','2026-10-15T09:00:00+08:00').state
  assert.equal(technicalWashingOrders(source.techPackVersionId!,undefined,none).length,0)
  const cancelled=applyWashingCommand(state,{type:'CANCEL',orderId:state.orders[0].id,reason:'重新核对',confirmed:true},{id:'plan',name:'李四',role:'计划跟单'},'CANCEL-1','2026-10-15T10:00:00+08:00').state
  assert.equal(technicalWashingOrders(source.techPackVersionId!,undefined,cancelled).length,0)
  assert.equal(printingWashingOrders(source.printOrderId,cancelled).length,0)
  assert.equal(printingWashingLogs(source.printOrderId,cancelled).length,1)
})
test('WASH-266: a legacy order reads its production frozen version without rewriting the saved source',()=>{
  const {state}=fixture()
  delete state.orders[0].source.techPackVersionId
  state.orders[0].source.productionOrderId='PO-202603-0003'
  const before=JSON.stringify(state)
  assert.equal(technicalWashingOrders('tdv_demand_SPU_2024_009','PO-202603-0003',state).length,1)
  assert.equal(technicalWashingOrders('tdv_demand_SPU_2024_010',undefined,state).length,0)
  assert.equal(JSON.stringify(state),before)
})
test('WASH-248–254: washing columns have seven business groups and retain the original downstream',()=>{
  const {state}=fixture(),order=state.orders[0],columns=washingInformationColumns((url,name)=>`<img src="${url}" alt="${name}">`,(name,url)=>`<a href="${url}">${name}</a>`)
  assert.deepEqual(columns.map(c=>c.title),['加工单/商品','加工投入/上游','加工要求','处理进度','加工产出/下游','时间','数量'])
  assert.match(columns.find(c=>c.key==='output')!.render(order),/原面料仓/)
  assert.match(columns.find(c=>c.key==='input')!.render(order),/印花厂 A/)
  assert.match(columns.find(c=>c.key==='requirements')!.render(order),/柔软手感/)
  assert.equal(washingQuantities(order).input,50);assert.equal(washingQuantities(order).received,0)
})
test('partial and full washing scopes drive the current downstream without changing the original target',()=>{
  const {state,source,actor,command}=fixture()
  const print={workOrderId:source.printOrderId,receivingTargetName:'原面料仓',barcodes:source.rolls}
  assert.deepEqual(printingDownstreamNames(print,emptyWashingState()),['原面料仓'])
  assert.deepEqual(printingDownstreamNames(print,state),['GTG','原面料仓'])
  const full=applyWashingCommand(state,{...command,rollIds:['R2'],handFeel:'硬挺手感'},actor,'VIEW-2','2026-10-15T09:01:00+08:00').state
  assert.deepEqual(printingDownstreamNames(print,full),['GTG'])
  assert.equal(full.orders[0].source.target?.name,'原面料仓')
  assert.equal(print.receivingTargetName,'原面料仓')
})
test('legacy column preferences reveal all seven groups while preserving page size and current preferences',()=>{
  const columns=[...washingInformationColumns(()=>'',()=>''),{key:'action',title:'操作',render:()=>''}]
  const old={order:['material','source','handFeel','factory','qty','status','action'],visibleKeys:['material','qty','action'],frozenKeys:[],pageSize:20}
  const upgraded=normalizeListColumnPreferences(columns,upgradeWashingColumnPreferences(old),[10,20,50])
  assert.deepEqual(upgraded.order,columns.map(c=>c.key));assert.deepEqual(upgraded.visibleKeys,columns.map(c=>c.key));assert.equal(upgraded.pageSize,20)
  const current={order:['order','qty','requirements','action'],visibleKeys:['order','qty','requirements','action'],frozenKeys:[],pageSize:50}
  assert.equal(upgradeWashingColumnPreferences(current),current)
})
test('a synchronous print view remains consistent and releases its snapshot after completion or failure',()=>{
  const {state,source,actor,command}=fixture()
  let committed=state
  registerWashingProjection(()=>committed)
  try{
    withPrintingWashingRead(()=>{
      assert.equal(printingWashingOrders(source.printOrderId).length,1)
      committed=applyWashingCommand(state,{...command,rollIds:['R2']},actor,'SNAPSHOT-2','2026-10-15T10:00:00+08:00').state
      assert.equal(printingWashingOrders(source.printOrderId).length,1)
    })
    assert.equal(printingWashingOrders(source.printOrderId).length,2)
    assert.throws(()=>withPrintingWashingRead(()=>{throw new Error('render failed')}),/render failed/)
    committed=emptyWashingState()
    assert.equal(printingWashingOrders(source.printOrderId).length,0)
  }finally{registerWashingProjection(value=>value)}
})

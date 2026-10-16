import test from 'node:test'
import assert from 'node:assert/strict'
import { applyWashingCommand, emptyWashingState, type WashingOrder, type WashingSource } from '../../src/data/fcs/fabric-washing-model.ts'
import { renderWashingExecutionDialog, washingExecutionRolls, type WashingExecutionAction } from '../../src/pages/process-factory/dyeing/washing/execution-dialog.ts'

const at='2026-10-16T11:00:00+08:00'
function mixedOrder():WashingOrder {
  const source:WashingSource={objectType:'FABRIC',id:'PRINT/BATCH',printOrderId:'PRINT',printOrderNo:'PH-001',batchId:'BATCH',sourceType:'PRODUCTION',sourceNo:'PO-001',factoryId:'PRINT',factoryName:'印花厂',materialSku:'FAB-001',materialName:'面料',imageUrl:'/materials/fabric.jpg',revision:'1',actualCompleted:true,target:{id:'F090',factoryId:'F090',name:'原接收工厂'},rolls:Array.from({length:6},(_,i)=>({id:'R'+(i+1),barcode:'ROLL-'+(i+1),qty:50,unit:'Yard',confirmed:true,handedOut:false}))}
  const order=applyWashingCommand(emptyWashingState(),{type:'JUDGE',source,rollIds:source.rolls.map(r=>r.id),decision:'WASH',handFeel:'柔软手感'},{id:'site',name:'现场人员',role:'现场判断人员',factoryId:'PRINT'},'DIALOG-TEST',at).state.orders[0]
  for(let i=1;i<6;i++){
    const roll=order.rolls[i];roll.sentAt=at
    if(i>=2){roll.receivedAt=at;roll.receivedQty=50}
    if(i>=3)roll.startedAt=at
    if(i>=4){roll.completedAt=at;roll.outputQty=49}
    if(i>=5)roll.handedOutAt=at
  }
  return order
}
const options={image:()=>'<img alt="面料">',button:(label:string,action:string)=>`<button data-fabric-washing-action="${action}">${label}</button>`,positions:[{value:'GTG-WH|A1',label:'GTG · A1'}]}

test('WASH-297: mixed-stage rolls are offered only by their currently valid operation, without rewriting facts',()=>{
  const order=mixedOrder(),before=structuredClone(order)
  const actions:WashingExecutionAction[]=['send','receive','start','output','handout','downstream-receive']
  actions.forEach((action,index)=>assert.deepEqual(washingExecutionRolls(order,action).map(r=>r.id),['R'+(index+1)]))
  assert.deepEqual(order,before)
  order.rolls[5].downstreamReceivedAt=at
  assert.deepEqual(washingExecutionRolls(order,'downstream-receive'),[])
})
test('WASH-292-WASH-296: every operation exposes only its own required form fields',()=>{
  const contracts:Array<[WashingExecutionAction,number,number,number,number]>=[['send',0,0,1,0],['receive',1,1,0,0],['start',0,0,0,0],['output',1,0,0,1],['handout',0,0,1,0],['downstream-receive',1,1,0,0]]
  for(const [action,qty,position,scan,repack] of contracts){
    const html=renderWashingExecutionDialog(mixedOrder(),action,options)
    for(const [name,count] of [['qty',qty],['position',position],['scan',scan],['output-code',repack]] as const)assert.equal((html.match(new RegExp('data-washing-'+name+'(?:=|>)','g'))||[]).length,count,action+': '+name)
    assert.match(html,/data-washing-operation-action="submit"/)
    assert.doesNotMatch(html,/登记异常|作废本单|拒单|>接单</)
  }
})
test('WASH-296: original central warehouse receipt uses its own location and offers no factory selection',()=>{
  const order=mixedOrder();order.source.target={id:'WH-FABRIC-001',warehouseId:'WH-FABRIC-001',name:'面料中央仓'}
  const html=renderWashingExecutionDialog(order,'downstream-receive',options)
  assert.match(html,/data-washing-central-location/);assert.match(html,/面料中央仓/)
  assert.doesNotMatch(html,/data-washing-position|data-washing-scan/)
})
test('WASH-297: blocked, completed and historically unassigned orders expose no new factory execution',()=>{
  for(const field of ['exception','completedAt','cancelledAt'] as const){const order=mixedOrder();order[field]=at;assert.deepEqual(washingExecutionRolls(order,'receive'),[])}
  const order=mixedOrder();order.acceptance='UNASSIGNED';delete order.assignedFactoryId
  assert.deepEqual(washingExecutionRolls(order,'send'),[])
  order.acceptance='PENDING';order.assignedFactoryId='ID-F003'
  assert.deepEqual(washingExecutionRolls(order,'receive').map(r=>r.id),['R2'])
})

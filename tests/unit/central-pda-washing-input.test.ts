import assert from 'node:assert/strict'
import test from 'node:test'
import { applyWashingCommand, emptyWashingState, washingExecutionRolls, type WashingSource, type WashingOrder, type WashingCommand, type WashingState } from '../../src/data/fcs/fabric-washing-model.ts'
import { centralWashingRolls, centralWashingCanComplete, centralWashingInput, scanCentralWashingRoll, assertCentralWashingActor, centralWashingPositions, type CentralWashingDraft } from '../../src/pages/central-pda/washing-model.ts'
import { readFactoryPdaExecutionUsers } from '../../src/data/fcs/store-domain-pda.ts'

function fixture(unit='Yard'){
 const source:WashingSource={objectType:'FABRIC',id:'PRINT-1/BATCH-1',printOrderId:'PRINT-1',printOrderNo:'YH-1',batchId:'BATCH-1',sourceType:'PRODUCTION',sourceNo:'PO-1',factoryId:'F090',factoryName:'中央测试工厂',materialSku:'FAB-P200-BLUE-FLORAL',materialName:'印花面料',imageUrl:'/materials/fei-ticket/blue-white-print-cotton.png',revision:'V1',actualCompleted:true,target:{id:'F090',name:'原工厂',factoryId:'F090'},rolls:[{id:'R1',barcode:'ROLL-1',qty:50,unit,confirmed:true,handedOut:false},{id:'R2',barcode:'ROLL-2',qty:40,unit,confirmed:true,handedOut:false}]}
 let state:WashingState=emptyWashingState(),i=0
 const site={id:'qa-site',name:'原印花发送人',factoryId:'F090',role:'现场判断人员' as const},actor={id:'qa-gtg',name:'实际加工人',factoryId:'ID-F003',role:'染厂人员' as const}
 const apply=(c:WashingCommand,a=actor)=>{state=applyWashingCommand(state,c,a,'QA-'+(++i),'2026-10-21T08:00:00+07:00').state}
 apply({type:'JUDGE',source,decision:'WASH',handFeel:'柔软手感',rollIds:['R1','R2']},site)
 const id=state.orders[0].id
 apply({type:'SEND',orderId:id,rollIds:['R1','R2'],scannedCodes:['ROLL-1','ROLL-2']},site)
 return{order:()=>state.orders[0],apply,id}
}
const draft=(selected=['R1']):CentralWashingDraft=>({selected,quantities:{},newCodes:{},scans:[],scan:'',position:'',revision:'V1',operationId:'QA-DRAFT'})

test('canonical existing accounts are required without a role selector',()=>{
 const user=readFactoryPdaExecutionUsers('ID-F003').find(u=>u.status==='ACTIVE')!
 assert.ok(user)
 assert.doesNotThrow(()=>assertCentralWashingActor(user))
 for(const patch of [{name:'伪造姓名'},{userId:'missing'},{factoryId:'OTHER'}])assert.throws(()=>assertCentralWashingActor({...user,...patch}),/CW_actor/)
})
for(const unit of ['Yard','米'])test('physical receipt retains '+unit+' and does not re-offer the unreceived difference of a received roll',()=>{
 const h=fixture(unit),position=centralWashingPositions('ID-F003')[0];assert.ok(position)
 const d=draft();d.position=position.warehouse.warehouseId+'|'+position.location.locationId;d.quantities.R1='49,5'
 assert.throws(()=>centralWashingInput(h.order(),'receive',d,'ID-F003','id'),/CW_confirmAmounts/)
 const command=centralWashingInput(h.order(),'receive',d,'ID-F003','id',true)
 assert.equal(command.type,'RECEIVE');if(command.type!=='RECEIVE')throw Error()
 assert.equal(command.lines[0].qty,49.5);h.apply(command)
 assert.deepEqual(centralWashingRolls(h.order(),'receive','ID-F003').map(r=>r.id),['R2'])
 assert.equal(h.order().rolls[0].unit,unit)
 assert.equal(h.order().rolls[0].receivedQty,49.5)
 assert.deepEqual(centralWashingRolls(h.order(),'receive','F090'),[])
 assert.throws(()=>centralWashingInput(h.order(),'receive',d,'ID-F003','id',true),/CW_select/)
 d.selected=['R2'];d.quantities.R2='40,1';assert.throws(()=>centralWashingInput(h.order(),'receive',d,'ID-F003','id',true),/CW_overReceipt/)
})

test('PDA output keeps the original positive quantity rule and explicit change confirmation, without inventing an input upper limit',()=>{
 const h=fixture(),o=h.order();o.rolls[0].receivedAt='now';o.rolls[0].receivedQty=49.5;o.rolls[0].startedAt='now'
 const d=draft();d.quantities.R1='50,25';d.newCodes.R1='REPACK-1'
 assert.throws(()=>centralWashingInput(o,'output',d,'ID-F003','id'),/CW_confirmAmounts/)
 const c=centralWashingInput(o,'output',d,'ID-F003','id',true);h.apply(c)
 assert.equal(h.order().rolls[0].outputQty,50.25);assert.equal(h.order().rolls[0].barcode,'ROLL-1');assert.equal(h.order().rolls[0].outputBarcode,'REPACK-1')
 assert.equal(centralWashingCanComplete(h.order(),'ID-F003'),false)
 const outgoing=draft([]);scanCentralWashingRoll(h.order(),'handout',outgoing,'ID-F003','REPACK-1')
 assert.throws(()=>scanCentralWashingRoll(h.order(),'handout',outgoing,'ID-F003','REPACK-1'),/CW_duplicate/)
 assert.throws(()=>scanCentralWashingRoll(h.order(),'handout',outgoing,'ID-F003','ROLL-1'),/CW_scan/)
 assert.deepEqual(outgoing.scans,['REPACK-1'])
 const send=centralWashingInput(h.order(),'handout',outgoing,'ID-F003','id');assert.equal(send.type,'HANDOUT');if(send.type==='HANDOUT')assert.deepEqual(send.target,o.source.target)
 h.apply(send);assert.equal(h.order().rolls[0].downstreamQty,undefined)
 assert.deepEqual(centralWashingRolls(h.order(),'handout','ID-F003'),[])
})

test('the Web and PDA share physical eligibility and completion requires every independent downstream receipt',async()=>{
 const {washingExecutionRolls:webRolls}=await import('../../src/pages/process-factory/dyeing/washing/execution-dialog.ts')
 assert.equal(webRolls,washingExecutionRolls)
 const h=fixture(),o=h.order()
 for(const r of o.rolls){r.receivedAt='now';r.receivedQty=r.inputQty;r.startedAt='now';r.completedAt='now';r.outputQty=r.inputQty;r.handedOutAt='now'}
 o.rolls[0].downstreamReceivedAt='now';o.rolls[0].downstreamQty=50
 assert.equal(centralWashingCanComplete(o,'ID-F003'),false)
 assert.deepEqual(centralWashingRolls(o,'downstream-receive','F090').map(r=>r.id),['R2'])
 o.rolls[1].downstreamReceivedAt='now';o.rolls[1].downstreamQty=40
 assert.equal(centralWashingCanComplete(o,'ID-F003'),true)
 assert.equal(centralWashingCanComplete(o,'F090'),false)
 o.completedAt='now';assert.equal(centralWashingCanComplete(o,'ID-F003'),false);assert.deepEqual(centralWashingRolls(o,'output','ID-F003'),[])
})

test('a factory account cannot impersonate a final central warehouse receiver',()=>{
 const o=fixture().order();o.source.target={id:'GKP',name:'GKP',warehouseId:'GKP',factoryId:'F090'};o.rolls[0].handedOutAt='now';o.rolls[0].completedAt='now';o.rolls[0].outputQty=50
 assert.deepEqual(centralWashingRolls(o,'downstream-receive','F090'),[])
})

test('printing metadata does not invalidate physical continuation; quantity, identity and status still do',async()=>{
 const {centralWashingRevision}=await import('../../src/pages/central-pda/washing-model.ts')
 const original=fixture().order(),before=centralWashingRevision(original)
 assert.equal(centralWashingRevision({...original,printedRevision:original.revision,printedContentSignature:'printed'}),before)
 const different=[{...original,revision:original.revision+1},{...original,completedAt:'actual completion'},{...original,handFeel:'硬挺手感' as const},{...original,source:{...original.source,target:{id:'OTHER',name:'Other',factoryId:'OTHER'}}},{...original,rolls:original.rolls.map((r,i)=>i?r:{...r,outputQty:123,outputBarcode:'ACTUAL-NEW-CODE'})}]
 for(const changed of different)assert.notEqual(centralWashingRevision(changed),before)
})


test('readonly rolls show actual receipt, output and final receipt without replacing the original quantity or roll',async()=>{
 const {renderWashingRollSummary}=await import('../../src/pages/central-pda/washing-view.ts')
 const roll={id:'R1',sourceRollId:'R1',barcode:'ORIGIN-1',inputQty:50,receivedQty:40,outputQty:39.75,outputBarcode:'REPACK-1',downstreamQty:38,unit:'米',receivedAt:'actual',completedAt:'actual',downstreamReceivedAt:'actual'}
 const before=structuredClone(roll),html=renderWashingRollSummary(roll,'id')
 for(const value of ['ORIGIN-1','REPACK-1','50 m','40 m','39,75 m','38 m','Diterima pabrik cuci','Diterima tujuan'])assert.ok(html.includes(value),value)
 assert.deepEqual(roll,before)
 const pending=renderWashingRollSummary({id:'R2',sourceRollId:'R2',barcode:'PENDING-2',inputQty:50,unit:'Yard'},'id')
 assert.ok(!pending.includes('Diterima pabrik cuci'));assert.ok(!pending.includes('Diterima tujuan'));assert.ok(pending.includes('50 Yard'))
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { centralWoolCraftContexts, assertCentralWoolCraftActor, centralWoolCraftReceiptRequest,
  centralWoolCraftReceiptSource, centralWoolCraftActionRequest } from '../../src/pages/central-pda/wool-craft-model.ts'
import { centralWoolIncoming, centralWoolReceiptRequest } from '../../src/pages/central-pda/wool-model.ts'
import { addWoolHandover, addWoolProcessReport } from '../../src/data/fcs/wool-domain/commands.ts'
import { executeWoolCraftAction } from '../../src/data/fcs/wool-domain/craft-flow.ts'
import { readWoolStore, replaceWoolStore, WOOL_DOMAIN_STORE_KEY } from '../../src/data/fcs/wool-domain/store.ts'
import { pcsRecordStore } from '../../src/data/pcs-record-runtime.ts'
import { captureFactoryReceivingData, restoreFactoryReceivingData, getDefaultFactoryReceiptPosition, listFactoryReceivingSources } from '../../src/data/fcs/factory-receiving.ts'
import { confirmFactoryMaterialReceipt } from '../../src/data/fcs/factory-receiving-links.ts'
import { readFactoryPdaExecutionUsers, setPdaSession, createPdaSessionFromUser } from '../../src/data/fcs/store-domain-pda.ts'

const ownerId='OWN_WOOL_FACTORY',factory='FAC-APF',id='WOOL-STAGE-006:KNITTING',sku='CARDIGAN-CREAM-M',at='2026-10-21T10:00:00Z'
const actor=(f=factory)=>readFactoryPdaExecutionUsers(f).find(user=>user.roleId==='ROLE_ADMIN')!
function scope(run:()=>void){const wool=readWoolStore(),receiving=captureFactoryReceivingData();try{run()}finally{setPdaSession(null);restoreFactoryReceivingData(receiving);replaceWoolStore(wool)}}
function ready(){
 const incoming=centralWoolIncoming(ownerId).find(row=>row.line.woolOrderId===id)!
 confirmFactoryMaterialReceipt(centralWoolReceiptRequest(incoming,{kind:'YARN',grossKg:1.062,tubes:{PAPER:1,CONICAL:0,PAGODA:0},...getDefaultFactoryReceiptPosition(ownerId)},actor(ownerId),'WC-YARN',at).input,actor(ownerId))
 addWoolProcessReport(id,{commandId:'WC-KNIT',outputSkuCode:sku,reportedQty:5,reportedAt:at,reportedBy:actor(ownerId).name})
 const piece=readWoolStore().workOrders[id].externalPieces[0]
 const h=addWoolHandover(id,{commandId:'WC-HO-3',outputSkuCode:sku,pieceKey:piece.pieceKey,handoverQty:3,handedOverAt:at,handedOverBy:actor(ownerId).name})
 return centralWoolCraftContexts(factory).find(context=>context.task.taskOrderId===h.targetWorkOrderId)!
}
const refresh=(taskId:string)=>centralWoolCraftContexts(factory).find(context=>context.task.taskOrderId===taskId)!
function accept(context:ReturnType<typeof ready>,qty:number,commandId:string){
 const row=context.incoming[0],request=centralWoolCraftReceiptRequest(context,row,qty,actor(),commandId,at)
 confirmFactoryMaterialReceipt(request.input,actor());return request
}

test('C02.03b: only actual Central craft nodes are read; no ordinary task, yarn or garment aggregate is relabelled',()=>scope(()=>{
 const current=ready(),before=pcsRecordStore.getItem(WOOL_DOMAIN_STORE_KEY)
 const all=centralWoolCraftContexts(factory)
 assert.ok(all.length>0&&all.every(context=>context.task.woolPieceKey&&context.task.factoryId===factory&&context.owner.stage==='KNITTING'))
 assert.ok(all.every(context=>context.task.unit==='片'))
 assert.equal(centralWoolCraftContexts(factory,current.task.operationId).some(context=>context.task.taskOrderId===current.task.taskOrderId),true)
 assert.deepEqual(centralWoolCraftContexts('ID-F021'),[])
 assert.deepEqual(centralWoolCraftContexts(factory,'UNKNOWN_OPERATION'),[])
 assert.equal(pcsRecordStore.getItem(WOOL_DOMAIN_STORE_KEY),before)
}))

test('C02.03b: original actual batch, default position, physical unit and actual receiving account are preserved without the legacy device session',()=>scope(()=>{
 const context=ready(),row=context.incoming[0]
 setPdaSession(createPdaSessionFromUser(actor('ID-F021')))
 const request=accept(context,2,'WC-RCV-2')
 assert.equal(request.prepared.lines[0].qty,2);assert.equal(request.prepared.lines[0].unit,'片')
 assert.equal(request.prepared.lines[0].woolCraftOrderId,context.task.taskOrderId)
 assert.equal(request.prepared.lines[0].woolPieceKey,context.piece.pieceKey)
 assert.equal(request.input.lines[0].sourceId,row.source.id)
 assert.deepEqual({warehouseId:request.input.lines[0].warehouseId,locationId:request.input.lines[0].locationId},getDefaultFactoryReceiptPosition(factory))
 assert.equal(request.input.operatorId,actor().userId)
 assert.equal(row.source.origin.id,ownerId)
 const current=refresh(context.task.taskOrderId)
 assert.equal(current.task.receivedQty,2);assert.equal(current.incoming[0].remainingQty,1)
 assert.equal(current.incoming[0].receipts[0].operatorName,actor().name)
 const h=readWoolStore().handovers.find(h=>h.handoverId===row.source.originalRecordId)!
 assert.equal(h.downstreamReceipt?.actualReceivedQty,2);assert.equal(h.downstreamReceipt?.status,'PENDING')
}))

test('C02.03b: two actual batches of the same part retain independent remaining counts and changed-source fingerprints',()=>scope(()=>{
 const context=ready(),first=context.incoming[0]
 const second=addWoolHandover(id,{commandId:'WC-HO-2',outputSkuCode:sku,pieceKey:context.piece.pieceKey,handoverQty:2,handedOverAt:at,handedOverBy:actor(ownerId).name})
 const before=refresh(context.task.taskOrderId),fingerprint=centralWoolCraftReceiptSource(before,before.incoming.find(row=>row.key===first.key)!)
 accept(before,2,'WC-BATCH-FIRST-2')
 const after=refresh(context.task.taskOrderId)
 assert.equal(after.incoming.length,2)
 assert.equal(after.incoming.find(row=>row.key===first.key)?.remainingQty,1)
 assert.equal(after.incoming.find(row=>row.source.originalRecordId===second.handoverId)?.remainingQty,2)
 assert.notEqual(centralWoolCraftReceiptSource(after,after.incoming.find(row=>row.key===first.key)!),fingerprint)
 assert.equal(after.task.receivedQty,2)
}))

test('C02.03b: positive integer pieces, source factory/node, current assignment and actual actor are mandatory',()=>scope(()=>{
 const context=ready(),row=context.incoming[0]
 for(const qty of [0,-1,1.5,NaN,Infinity])assert.throws(()=>centralWoolCraftReceiptRequest(context,row,qty,actor(),'WC-INVALID',at),/WOOL_CRAFT_quantity/)
 assert.throws(()=>centralWoolCraftReceiptRequest(context,row,4,actor(),'WC-OVER',at),/WOOL_CRAFT_receiveLimit/)
 assert.throws(()=>centralWoolCraftReceiptRequest(context,{...row,taskOrderId:'OTHER'},1,actor(),'WC-WRONG-NODE',at),/WOOL_CRAFT_source/)
 assert.throws(()=>centralWoolCraftReceiptRequest(context,row,1,actor(ownerId),'WC-WRONG-FACTORY',at),/WOOL_CRAFT_source/)
 assert.throws(()=>centralWoolCraftReceiptRequest({...context,currentFactory:false},row,1,actor(),'WC-OLD-ASSIGNMENT',at),/WOOL_CRAFT_changed/)
 assert.throws(()=>assertCentralWoolCraftActor({...actor(),name:'forged'}),/WOOL_CRAFT_actor/)
 assert.throws(()=>assertCentralWoolCraftActor(actor('ID-F021')),/WOOL_CRAFT_actor/)
}))

test('C02.03b: processing uses received pieces, outgoing uses actual output and a real source; neither fabricates returned linking stock',()=>scope(()=>{
 const context=ready();accept(context,2,'WC-REAL-IN')
 let current=refresh(context.task.taskOrderId)
 assert.throws(()=>centralWoolCraftActionRequest(current,'work',3,actor(),'WC-OVER-PROCESS',at),/WOOL_CRAFT_workLimit/)
 const process=centralWoolCraftActionRequest(current,'work',2,actor(),'WC-PROCESS-2',at)
 executeWoolCraftAction(process.input);current=refresh(context.task.taskOrderId)
 assert.equal(current.task.completedQty,2)
 assert.throws(()=>centralWoolCraftActionRequest(current,'handoff',3,actor(),'WC-OVER-HO',at),/WOOL_CRAFT_handoffLimit/)
 const outgoing=centralWoolCraftActionRequest(current,'handoff',1,actor(),'WC-RETURN-1',at)
 executeWoolCraftAction(outgoing.input);current=refresh(context.task.taskOrderId)
 assert.equal(current.task.returnedQty,1);assert.equal(current.task.waitHandoverQty,1)
 const source=listFactoryReceivingSources(undefined,true).find(source=>source.originalRecordId==='WCF:WC-RETURN-1')!
 assert.equal(source.lines[0].sentQty,1);assert.equal(source.lines[0].unit,'片')
 assert.equal(source.targetFactoryId,current.next?.factoryId||ownerId)
 assert.equal(readWoolStore().pieceReceipts.some(receipt=>receipt.sourceHandoverId==='WCF:WC-RETURN-1'),false)
 const finish=centralWoolCraftActionRequest(current,'finish',0,actor(),'WC-EARLY-FINISH',at)
 assert.throws(()=>executeWoolCraftAction(finish.input),/计划加工未完成|直接下游/)
}))

test('C02.03b: stable craft retries preserve exact command content and cannot turn another action into a duplicate',()=>scope(()=>{
 const context=ready();accept(context,2,'WC-RETRY-IN');let current=refresh(context.task.taskOrderId)
 const request=centralWoolCraftActionRequest(current,'work',1,actor(),'WC-STABLE',at)
 executeWoolCraftAction(request.input);executeWoolCraftAction(request.input)
 assert.equal(readWoolStore().craftRecords.filter(record=>record.commandId==='WC-STABLE').length,1)
 assert.throws(()=>executeWoolCraftAction({...request.input,qty:2}),/重复请求/)
 assert.throws(()=>executeWoolCraftAction({...request.input,actionCode:'SPECIAL_CRAFT_SUBMIT_HANDOVER'}),/重复请求/)
 assert.throws(()=>executeWoolCraftAction({...request.input,actionCode:'SPECIAL_CRAFT_CONFIRM_RECEIVE'}),/按实际交出批次/)
}))

test('C02.03b: a closed historical craft task keeps actual batch history and blocks all new actions',()=>scope(()=>{
 const context=ready();accept(context,1,'WC-CLOSED-IN')
 // Explicit unit fixture for the already-closed branch, not a legal completion
 // or a claim that the partial real task can be completed.
 const store=readWoolStore();store.craftRecords.push({recordId:'WC-CLOSED-FIXTURE',commandId:'WC-CLOSED-FIXTURE',taskOrderId:context.task.taskOrderId,
  action:'COMPLETE',qty:0,pieceKey:context.piece.pieceKey,routeNodeId:context.node.sourceEntryId,woolOrderId:context.owner.woolOrderId,operatedAt:at,operatedBy:actor().name});replaceWoolStore(store)
 const current=refresh(context.task.taskOrderId)
 assert.equal(current.completed,true);assert.equal(current.incoming[0].receipts.length,1);assert.equal(current.incoming[0].canReceive,false)
 assert.throws(()=>centralWoolCraftReceiptRequest(current,current.incoming[0],1,actor(),'WC-CLOSED-RECEIVE',at),/WOOL_CRAFT_changed/)
 for(const action of ['work','handoff','finish']as const)assert.throws(()=>centralWoolCraftActionRequest(current,action,1,actor(),'WC-CLOSED-ACTION',at),/WOOL_CRAFT_changed/)
}))

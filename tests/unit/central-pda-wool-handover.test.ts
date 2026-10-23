import test from 'node:test'
import assert from 'node:assert/strict'
import { centralWoolFacts, centralWoolExecutionRows, centralWoolIncoming, centralWoolReceiptRequest, centralWoolReportRequest } from '../../src/pages/central-pda/wool-model.ts'
import { centralWoolHandoverTargets, centralWoolHandoverRequest, centralWoolHandoverSource, centralWoolScannedHandover, centralWoolHandoverReceiptActors } from '../../src/pages/central-pda/wool-handover-model.ts'
import { renderWoolHandoverRecords } from '../../src/pages/central-pda/wool-handover-view.ts'
import { centralWoolWarehouseHandovers } from '../../src/pages/central-pda/wool-warehouse-model.ts'
import { parseWoolHandoverCode } from '../../src/data/fcs/wool-domain/handover-code.ts'
import { readWoolStore, replaceWoolStore } from '../../src/data/fcs/wool-domain/store.ts'
import { addWoolHandover, addWoolProcessReport, confirmWoolDownstreamReceipt } from '../../src/data/fcs/wool-domain/commands.ts'
import { captureFactoryReceivingData, restoreFactoryReceivingData, getDefaultFactoryReceiptPosition, listFactoryReceivingSources, listFactoryReceipts } from '../../src/data/fcs/factory-receiving.ts'
import { confirmFactoryMaterialReceipt } from '../../src/data/fcs/factory-receiving-links.ts'
import { readFactoryPdaExecutionUsers } from '../../src/data/fcs/store-domain-pda.ts'
import { executeWoolCraftAction } from '../../src/data/fcs/wool-domain/craft-flow.ts'

const factory='OWN_WOOL_FACTORY', sku='CARDIGAN-CREAM-M', at='2026-10-21T08:00:00Z'
const actor=(id=factory)=>readFactoryPdaExecutionUsers(id).find(user=>user.roleId==='ROLE_ADMIN')!
const facts=()=>centralWoolFacts(factory)
function scope(run:()=>void){const wool=readWoolStore(),receiving=captureFactoryReceivingData();try{run()}finally{restoreFactoryReceivingData(receiving);replaceWoolStore(wool)}}
function row(id:string){return centralWoolExecutionRows(facts(),id)[0]}
function readyPieces(){
 const id='WOOL-STAGE-006:KNITTING', incoming=centralWoolIncoming(factory).find(row=>row.line.woolOrderId===id)!
 const request=centralWoolReceiptRequest(incoming,{kind:'YARN',grossKg:1.062,tubes:{PAPER:1,CONICAL:0,PAGODA:0},...getDefaultFactoryReceiptPosition(factory)},actor(),'C02-HO-YARN',at)
 confirmFactoryMaterialReceipt(request.input,actor())
 addWoolProcessReport(id,{commandId:'C02-HO-PROCESS',outputSkuCode:sku,reportedQty:5,reportedAt:at,reportedBy:actor().name})
 return row(id)
}

test('C02.03: existing delivery-note URI is parsed exactly, never by its last segment',()=>{
 const id='WOOL-STAGE-003:LINKING', h='WHO-formal-123', path=`/fcs/craft/wool/linking-orders/${encodeURIComponent(id)}/handover-print/${h}`
 assert.deepEqual(parseWoolHandoverCode('https://higood.12lab.cn'+path),{stage:'LINKING',woolOrderId:id,handoverId:h})
 assert.deepEqual(parseWoolHandoverCode(path),{stage:'LINKING',woolOrderId:id,handoverId:h})
 const encodedId='WHO-WEB-HANDOVER-WOOL-STAGE-003%3ALINKING-1'
 assert.equal(parseWoolHandoverCode(path.replace(h,encodeURIComponent(encodedId)))?.handoverId,encodedId,'decode a printed identifier exactly once')
 for(const code of [h,'javascript:'+path,'/other/'+h,path+'/extra','/fcs/craft/wool/linking-orders/%ZZ/handover-print/'+h])assert.equal(parseWoolHandoverCode(code),undefined)
})

test('C02.03: actual linking output uses original available stock, fixed downstream and garment units',()=>scope(()=>{
 const current=row('WOOL-STAGE-003:LINKING'), target=centralWoolHandoverTargets(current,facts().store)[0]
 assert.equal(target.unit,'件');assert.equal(target.availableQty,40);assert.equal(target.receiverId,'PF-DEDICATED-001')
 const request=centralWoolHandoverRequest(current,target,15,actor(),'C02-LINKING-HO',at)
 assert.equal(request.input.handedOverBy,actor().name);assert.equal(request.actorId,actor().userId);assert.equal(request.expectedSource,centralWoolHandoverSource(current,target))
 const saved=addWoolHandover(current.order.woolOrderId,request.input)
 assert.equal(saved.handoverQty,15);assert.equal(saved.qtyUnit,'件');assert.equal(saved.receiverId,target.receiverId)
 assert.equal(saved.downstreamReceipt?.status,'PENDING');assert.equal(saved.downstreamReceipt?.actualReceivedQty,undefined)
 const remaining=centralWoolHandoverTargets(row(current.order.woolOrderId),facts().store)[0]
 assert.equal(remaining.availableQty,25)
 assert.notEqual(centralWoolHandoverSource(row(current.order.woolOrderId),remaining),request.expectedSource)
}))

test('C02.03: outgoing validation rejects missing output, wrong identity, non-integer, excess and completion',()=>scope(()=>{
 const current=row('WOOL-STAGE-003:LINKING'),target=centralWoolHandoverTargets(current,facts().store)[0]
 for(const qty of [0,-1,1.5,Infinity])assert.throws(()=>centralWoolHandoverRequest(current,target,qty,actor(),'bad',at),/WOOL_handoverQuantity/)
 assert.throws(()=>centralWoolHandoverRequest(current,target,41,actor(),'bad',at),/WOOL_handoverLimit/)
 assert.throws(()=>centralWoolHandoverRequest({...current,completed:true},target,1,actor(),'bad',at),/WOOL_changed/)
 assert.throws(()=>centralWoolHandoverRequest(current,{...target,sku:'WRONG',key:'WRONG'},1,actor(),'bad',at),/WOOL_handoverSource/)
 assert.throws(()=>centralWoolHandoverRequest({...current,order:{...current.order,factoryId:'OTHER'}},target,1,actor(),'bad',at),/WOOL_actor/)
 const empty=row('WOOL-STAGE-006:KNITTING')
 assert.ok(centralWoolHandoverTargets(empty,facts().store).every(target=>target.availableQty===0))
 assert.throws(()=>centralWoolHandoverRequest(empty,centralWoolHandoverTargets(empty,facts().store)[0],1,actor(),'bad',at),/WOOL_handoverBlocked/)
 assert.equal(centralWoolHandoverTargets(row('WOOL-STAGE-002:KNITTING'),facts().store).length,0,'automatic internal transfer adds no manual outgoing action')
}))

test('C02.03: external pieces keep separate balances, actual first craft destination and pending receipt',()=>scope(()=>{
 const current=readyPieces(),targets=centralWoolHandoverTargets(current,facts().store)
 assert.equal(targets.length,2);assert.ok(targets.every(target=>target.unit==='片'&&target.availableQty===5&&target.receiverId==='FAC-APF'))
 const request=centralWoolHandoverRequest(current,targets[0],3,actor(),'C02-PIECE-HO',at),h=addWoolHandover(current.order.woolOrderId,request.input)
 const source=listFactoryReceivingSources('FAC-APF').find(source=>source.originalRecordId===h.handoverId)!
 assert.ok(source);assert.equal(source.lines[0].sentQty,3);assert.equal(source.lines[0].unit,'片');assert.equal(source.origin.id,factory)
 assert.equal(source.lines[0].woolCraftOrderId,h.targetWorkOrderId);assert.equal(h.downstreamReceipt?.actualReceivedQty,undefined)
 assert.deepEqual(centralWoolHandoverTargets(row(current.order.woolOrderId),facts().store).map(target=>target.availableQty),[2,5])
 const before=listFactoryReceipts('FAC-APF').length;addWoolHandover(current.order.woolOrderId,request.input)
 assert.equal(listFactoryReceipts('FAC-APF').length,before,'stable sender retry never accepts goods for the recipient')
 assert.equal(listFactoryReceivingSources('FAC-APF').filter(source=>source.originalRecordId===h.handoverId).length,1)
}))

test('C02.03/X02: only actual receiver split receipts acknowledge a piece; real craft return reaches linking',()=>scope(()=>{
 const current=readyPieces(),target=centralWoolHandoverTargets(current,facts().store)[0]
 const h=addWoolHandover(current.order.woolOrderId,centralWoolHandoverRequest(current,target,3,actor(),'C02-RECEIVER-HO',at).input)
 const source=listFactoryReceivingSources('FAC-APF').find(source=>source.originalRecordId===h.handoverId)!, receiver=actor('FAC-APF')
 assert.ok(receiver)
 const accept=(id:string,qty:number)=>confirmFactoryMaterialReceipt({id,factoryId:receiver.factoryId,operatorId:receiver.userId,operatorName:receiver.name,receivedAt:at,remark:'',lines:[{sourceId:source.id,sourceLineId:source.lines[0].id,businessQty:qty,businessUnit:'片',...getDefaultFactoryReceiptPosition(receiver.factoryId)}]},receiver)
 accept('C02-RECEIVER-2',2)
 let actual=facts().store.handovers.find(record=>record.handoverId===h.handoverId)!
 assert.equal(actual.downstreamReceipt?.status,'PENDING');assert.equal(actual.downstreamReceipt?.actualReceivedQty,2)
 const partialHistory=centralWoolWarehouseHandovers(facts()).find(r=>r.record.handoverId===h.handoverId)!
 assert.equal(partialHistory.quantity,3)
 assert.equal(partialHistory.record.downstreamReceipt?.actualReceivedQty,2)
 assert.deepEqual(partialHistory.receiptActor,{operatorId:receiver.userId,operatorName:receiver.name})
 accept('C02-RECEIVER-1',1)
 actual=facts().store.handovers.find(record=>record.handoverId===h.handoverId)!
 assert.equal(actual.downstreamReceipt?.status,'CONFIRMED');assert.equal(actual.downstreamReceipt?.actualReceivedQty,3);assert.equal(actual.downstreamReceipt?.receivedBy,receiver.name)
 const identity=centralWoolHandoverReceiptActors(row(current.order.woolOrderId),facts().store)
 assert.deepEqual(identity.get(h.handoverId),{operatorId:receiver.userId,operatorName:receiver.name})
 const unrelated={...facts().store,handovers:[{...actual,receiverId:'OTHER_FACTORY'}]}
 assert.equal(centralWoolHandoverReceiptActors(row(current.order.woolOrderId),unrelated).size,0)
 const wrongPart={...facts().store,handovers:[{...actual,pieceKey:'OTHER_PIECE'}]}
 assert.equal(centralWoolHandoverReceiptActors(row(current.order.woolOrderId),wrongPart).size,0)
 for(const [actionCode,commandId]of [['SPECIAL_CRAFT_PROCESS_REPORT','C02-CRAFT-REPORT'],['SPECIAL_CRAFT_SUBMIT_HANDOVER','C02-CRAFT-RETURN']])executeWoolCraftAction({taskOrderId:h.targetWorkOrderId!,actionCode,qty:3,operatorName:receiver.name,operatedAt:at,commandId})
 const incoming=centralWoolIncoming(factory).find(row=>row.source.originalRecordId==='WCF:C02-CRAFT-RETURN')!
 assert.ok(incoming);assert.equal(incoming.line.woolOrderId,current.order.pairedWorkOrderId);assert.equal(incoming.line.unit,'片')
 confirmFactoryMaterialReceipt(centralWoolReceiptRequest(incoming,{kind:'WOOL_PIECE',quantity:3,...getDefaultFactoryReceiptPosition(factory)},actor(),'C02-REAL-RETURN-3',at).input,actor())
 const returned=facts().store.pieceReceipts.filter(record=>record.sourceHandoverId==='WCF:C02-CRAFT-RETURN')
 assert.equal(returned.length,1);assert.equal(returned[0].qty,3)
 const linking=row(current.order.pairedWorkOrderId)
 assert.equal(linking.lines[0].readiness.canReport,false,'the other required piece is still missing; one returned part cannot unlock an entire garment')
 const secondTarget=centralWoolHandoverTargets(row(current.order.woolOrderId),facts().store)[1]
 const second=addWoolHandover(current.order.woolOrderId,centralWoolHandoverRequest(row(current.order.woolOrderId),secondTarget,3,actor(),'C02-SECOND-PART-HO',at).input)
 const secondSource=listFactoryReceivingSources(receiver.factoryId).find(source=>source.originalRecordId===second.handoverId)!
 confirmFactoryMaterialReceipt({id:'C02-SECOND-PART-IN',factoryId:receiver.factoryId,operatorId:receiver.userId,operatorName:receiver.name,receivedAt:at,remark:'',lines:[{sourceId:secondSource.id,sourceLineId:secondSource.lines[0].id,businessQty:3,businessUnit:'片',...getDefaultFactoryReceiptPosition(receiver.factoryId)}]},receiver)
 for(const [actionCode,commandId]of [['SPECIAL_CRAFT_PROCESS_REPORT','C02-SECOND-PART-REPORT'],['SPECIAL_CRAFT_SUBMIT_HANDOVER','C02-SECOND-PART-RETURN']])executeWoolCraftAction({taskOrderId:second.targetWorkOrderId!,actionCode,qty:3,operatorName:receiver.name,operatedAt:at,commandId})
 const secondIncoming=centralWoolIncoming(factory).find(row=>row.source.originalRecordId==='WCF:C02-SECOND-PART-RETURN')!
 confirmFactoryMaterialReceipt(centralWoolReceiptRequest(secondIncoming,{kind:'WOOL_PIECE',quantity:3,...getDefaultFactoryReceiptPosition(factory)},actor(),'C02-SECOND-REAL-RETURN',at).input,actor())
 const ready=row(current.order.pairedWorkOrderId)
 assert.equal(ready.lines[0].readiness.canReport,true)
 assert.equal(ready.lines[0].readiness.remainingReportQty,3)
 assert.ok(ready.lines[0].readiness.missingYarnSkus.length,'the linking projection may list knitting yarn, but its readiness is based on returned pieces')
 const report=centralWoolReportRequest(ready,sku,3,actor(),'C02-LINKING-RETURN-REPORT',at)
 addWoolProcessReport(ready.order.woolOrderId,report.input)
 assert.equal(row(ready.order.woolOrderId).lines[0].readiness.reportedQty,3)

}))

test('C02.03/X11: delivery-note scan checks exact order, stage and sender factory before selecting a saved batch',()=>scope(()=>{
 const current=row('WOOL-STAGE-003:LINKING'),t=centralWoolHandoverTargets(current,facts().store)[0]
 const h=addWoolHandover(current.order.woolOrderId,centralWoolHandoverRequest(current,t,10,actor(),'C02-SCAN-HO',at).input)
 const path=`/fcs/craft/wool/linking-orders/${encodeURIComponent(current.order.woolOrderId)}/handover-print/${encodeURIComponent(h.handoverId)}`
 assert.equal(centralWoolScannedHandover(facts(),path)?.record.handoverId,h.handoverId)
 assert.equal(centralWoolScannedHandover(facts(),'https://higood.12lab.cn'+path)?.order.factoryId,factory)
 assert.equal(centralWoolScannedHandover(facts(),h.handoverId)?.record.handoverId,h.handoverId)
 assert.equal(centralWoolScannedHandover(facts(),path.replace('linking-orders','knitting-orders')),undefined)
 assert.equal(centralWoolScannedHandover(facts(),path.replace(encodeURIComponent(current.order.woolOrderId),'OTHER')),undefined)
 assert.equal(centralWoolScannedHandover({...facts(),orders:[]},path),undefined)
}))


test('C02.03/X02: read-only receipt view preserves an actual confirmed zero, distinct from unknown or pending',()=>scope(()=>{
 const current=row('WOOL-STAGE-003:LINKING'),target=centralWoolHandoverTargets(current,facts().store)[0]
 const h=addWoolHandover(current.order.woolOrderId,centralWoolHandoverRequest(current,target,5,actor(),'C02-ZERO-RECEIPT-HO',at).input)
 confirmWoolDownstreamReceipt(h.handoverId,{commandId:'C02-ZERO-RECEIPT',actualReceivedQty:0,receivedAt:at,receivedBy:'QA receiving factory'})
 const html=renderWoolHandoverRecords({row:row(current.order.woolOrderId),sku,store:facts().store,language:'id',operatorLabel:name=>name,selectedId:h.handoverId,forceOpen:true})
 assert.equal(centralWoolHandoverReceiptActors(row(current.order.woolOrderId),facts().store).size,0,'name-only historical confirmations must not acquire an invented receiving account')
 assert.match(html,/Diterima · 0 pcs/)
 assert.doesNotMatch(html,/Jumlah diterima belum tercatat/)
 assert.doesNotMatch(html,/data-central-action=".*(?:confirm|save)/)
}))

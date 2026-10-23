import test from 'node:test'
import assert from 'node:assert/strict'
import { centralSpreadingSourceSnapshot, prepareCentralSpreadingAction, type CentralSpreadingSource, type CentralSpreadingInput } from '../../src/data/fcs/cutting/cutting-spreading-command.ts'
import { createSpreadingDraftFromMarker, type MarkerRecord, type MarkerSpreadingContext, type SpreadingSession } from '../../src/pages/process-factory/cutting/marker-spreading-model.ts'
const source=():CentralSpreadingSource=>{
 const session={spreadingSessionId:'pb-one',sessionNo:'PB-001',contextType:'cut-order',cutOrderIds:['cut-one'],markerPlanId:'plan-one',markerPlanNo:'MKP-001',spreadingMode:'normal',status:'DRAFT',
   plannedLayers:10,actualLayers:0,rolls:[],operators:[],operationLogs:[],createdAt:'2026-10-21 08:00:00',updatedAt:'2026-10-21 08:00:00',sourceChannel:'MANUAL',
   planUnits:[{planUnitId:'unit-one',sourceType:'marker-line',materialSku:'fabric-one',color:'Black',garmentQtyPerUnit:2,plannedSpreadLengthM:45.6,plannedCutGarmentQty:20,sizeRows:[{size:'S',plannedQty:2}]}]} as unknown as SpreadingSession
 return{session,store:{markers:[],sessions:[session]},factoryId:'own',assignments:['cut-one','own'],order:{spreadingOrderId:'pb-one',spreadingOrderNo:'PB-001',sourceCutOrderIds:['cut-one'],sourceCutOrderNos:['CUT-001'],productionOrderNos:['PO-001'],status:'WAITING_SPREADING',materialIdentity:{materialSku:'fabric-one'},patternIdentity:{effectiveWidthValue:150}} as CentralSpreadingSource['order'],
 readiness:{canStartSpreading:true} as CentralSpreadingSource['readiness'],issues:[{issue:{eventId:'issue-one',refs:{spreadingOrderId:'pb-one'},material:{materialSku:'fabric-one'},inventoryEffect:{qty:180,unit:'yard'}} as CentralSpreadingSource['issues'][number]['issue'],returnedQty:0}],context:null}
}
const input=(s:CentralSpreadingSource,action:CentralSpreadingInput['action'],id=action):CentralSpreadingInput=>({operationId:id,spreadingOrderId:'pb-one',expectedSource:centralSpreadingSourceSnapshot(s),factoryId:'own',operatorId:'worker-one',operatorName:'Worker one',action,tableId:'cutting-table-1'})
const now=new Date('2026-10-21T02:00:00.000Z')
const start=()=>{const s=source(),r=prepareCentralSpreadingAction(s,input(s,'start-spreading'),now);return{...s,session:r.session,store:r.store}}
const report=(s:CentralSpreadingSource)=>({...input(s,'save-roll'),roll:{sourceIssueEventId:'issue-one',planUnitId:'unit-one',rollNo:'ACTUAL-ROLL-1',labeledLength:100,actualLength:4.5,headLength:.3,tailLength:.3,layerCount:10,actualGarmentQty:20}})
test('C01.07: actual roll uses Web metre/layer formula and keeps original operator and issue responsibility',()=>{
 const s=start(),result=prepareCentralSpreadingAction(s,report(s),now),roll=result.session.rolls[0]
 assert.equal(s.session.rolls.length,0);assert.equal(roll.usableLength,45.6);assert.equal(roll.remainingLength,54.4)
 assert.equal(result.session.actualCutGarmentQty,20);assert.equal(roll.sourceIssueEventId,'issue-one');assert.equal(roll.lastUpdatedById,'worker-one')
 assert.equal(result.session.operators[0].operatorAccountId,'worker-one');assert.equal(result.session.operationLogs?.[0].operatorId,'worker-one')
})
test('C01.07: source, unit, physical-length and state guards cannot be bypassed by a new confirmation',()=>{
 const s=start(),base=report(s)
 for(const change of [{roll:{...base.roll!,actualLength:20}},{roll:{...base.roll!,labeledLength:200}},{roll:{...base.roll!,planUnitId:'foreign-unit'}},{expectedSource:'old'}])assert.throws(()=>prepareCentralSpreadingAction(s,{...base,...change},now))
 assert.throws(()=>prepareCentralSpreadingAction(source(),input(source(),'finish-spreading'),now),/CUT_spreadState/)
 const unavailable=source();unavailable.readiness.canStartSpreading=false;assert.throws(()=>prepareCentralSpreadingAction(unavailable,input(unavailable,'start-spreading'),now),/CUT_spreadMaterial/)
})
test('C01.08: completion follows spread then cutting, terminal session is immutable',()=>{
 let s=start(),r=prepareCentralSpreadingAction(s,report(s),now);s={...s,session:r.session,store:r.store}
 r=prepareCentralSpreadingAction(s,input(s,'finish-spreading'),now);s={...s,session:r.session,store:r.store}
 assert.equal(s.session.status,'DONE');assert.equal(s.session.cuttingStatus,'WAITING_CUTTING');assert.equal(s.session.completedByUserId,'worker-one')
 assert.throws(()=>prepareCentralSpreadingAction(s,input(s,'finish-cutting'),now),/CUT_spreadState/)
 r=prepareCentralSpreadingAction(s,input(s,'start-cutting'),now);s={...s,session:r.session,store:r.store}
 r=prepareCentralSpreadingAction(s,input(s,'finish-cutting'),now);s={...s,session:r.session,store:r.store}
 assert.equal(s.session.cuttingStatus,'CUTTING_DONE');assert.equal(s.session.cuttingFinishedById,'worker-one')
 assert.throws(()=>prepareCentralSpreadingAction(s,report(s),now),/CUT_spreadClosed/)
})

test('C01.08: rebuilding from a confirmed bed preserves saved output, completion responsibility and void history',()=>{
 const base=source().session;Object.assign(base,{actualCutGarmentQty:20,completedAt:'2026-10-21 10:00:00',completedBy:'Actual worker',completedByUserId:'actual-uid',cuttingStartedById:'actual-cut-start',cuttingFinishedById:'actual-cut-finish',voidedAt:'2026-10-21 10:30:00',voidedBy:'actual-void-actor',voidReason:'Original recorded void',voidEventId:'original-void',updatedBy:'Actual editor'});
 const marker={markerId:'bed-one',markerNo:'A-1',markerMode:'normal',sizeDistribution:[{sizeLabel:'S',quantity:2}],totalPieces:2,lineItems:[],styleCode:'style',spuCode:'spu',materialSkuSummary:'fabric-one',colorSummary:'Black',plannedLayerCount:10} as unknown as MarkerRecord;
 const context={contextType:'cut-order',cutOrderIds:['cut-one'],cutOrderNos:['CUT-001'],markerPlanId:'plan-one',markerPlanNo:'MKP-001',productionOrderNos:['PO-001'],styleCode:'style',spuCode:'spu',styleName:'Actual style',materialSkuSummary:'fabric-one',materialPrepRows:[]} as MarkerSpreadingContext;
 const rebuilt=createSpreadingDraftFromMarker(marker,context,now,{baseSession:base});
 for(const key of ['actualCutGarmentQty','completedAt','completedBy','completedByUserId','cuttingStartedById','cuttingFinishedById','voidedAt','voidedBy','voidReason','voidEventId','updatedBy'] as const)assert.equal(rebuilt[key],base[key],key);
})

test('C01.07: another employee continues cumulative layers without taking over previous physical work',()=>{
 let s=start(),request=report(s)
 request.roll={...request.roll!,layerCount:5,actualGarmentQty:10}
 let result=prepareCentralSpreadingAction(s,request,now);s={...s,session:result.session,store:result.store}
 const second={...report(s),operationId:'second-employee',operatorId:'worker-two',operatorName:'Worker two',roll:{...report(s).roll!,rollRecordId:s.session.rolls[0].rollRecordId}}
 result=prepareCentralSpreadingAction(s,second,new Date(now.getTime()+60000));s={...s,session:result.session,store:result.store}
 assert.deepEqual(s.session.operators.map(row=>[row.operatorAccountId,row.startLayer,row.endLayer]),[['worker-one',1,5],['worker-two',6,10]])
 assert.equal(s.session.operators[0].nextOperatorAccountId,'worker-two');assert.equal(s.session.rolls[0].lastUpdatedById,'worker-two')
 assert.equal(s.session.totalActualLength,45.6);assert.equal(s.session.actualCutGarmentQty,20)
 assert.throws(()=>prepareCentralSpreadingAction(s,{...second,expectedSource:centralSpreadingSourceSnapshot(s),roll:{...second.roll!,layerCount:4}},now),/CUT_rollHandover/)
})

test('C01.07: return balance limits consumption while keeping original roll label measurements',()=>{
 let s=start(),request=report(s),result=prepareCentralSpreadingAction(s,request,now);s={...s,session:result.session,store:result.store,issues:[{...s.issues[0],returnedQty:130}]}
 // 180 yard minus 130 yard returned leaves 45.72 m; the historical 100 m label is not a new withdrawal.
 request={...report(s),roll:{...report(s).roll!,rollRecordId:s.session.rolls[0].rollRecordId}}
 assert.equal(prepareCentralSpreadingAction(s,request,now).session.totalActualLength,45.6)
 assert.throws(()=>prepareCentralSpreadingAction(s,{...request,roll:{...request.roll!,actualLength:4.6}},now),/CUT_rollIssueLimit/)
})

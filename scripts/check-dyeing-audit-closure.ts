import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
const replay = process.env.DYE_QUANTITY_REPLAY
const values = new Map<string, string>(replay ? JSON.parse(readFileSync(replay, 'utf8')) : [])
const storage = {
  getItem: (k: string) => values.get(k) ?? null,
  setItem: (k: string, v: string) => values.set(k, v),
  removeItem: (k: string) => values.delete(k),
}
Object.defineProperty(globalThis, 'window', {
  value: {
    localStorage: storage,
    sessionStorage: storage,
    addEventListener: () => {},
    dispatchEvent: () => {},
    location: { pathname: '/fcs/craft/dyeing/work-orders' },
  },
  configurable: true,
})
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
Object.defineProperty(globalThis, 'document', { value: { addEventListener: () => {} }, configurable: true })
const d=await import('../src/data/fcs/dyeing-task-domain.ts')
const r=await import('../src/data/fcs/factory-receiving.ts')
const links=await import('../src/data/fcs/factory-receiving-links.ts')
const water=await import('../src/data/fcs/water-soluble-task-domain.ts')
const sync=await import('../src/data/fcs/factory-receiving-source-sync.ts')
const warehouse=await import('../src/data/fcs/factory-internal-warehouse.ts')
const near=(a:number,b:number)=>assert(Math.abs(a-b)<.000001,`${a} != ${b}`)
d.listDyeWorkOrders()
const src=r.getFactoryReceivingSource('RCV-SRC-006')!;src.id='AUD-SOURCE';src.documentNo='AUD-TRANSFER';src.lines[0].id='AUD-SOURCE-L1';src.lines[0].plannedQty=500;src.lines[0].sentQty=100
r.registerFactoryReceivingSource(src)
const line={sourceId:src.id,sourceLineId:src.lines[0].id,qty:101,unit:'kg',rollBarcodes:[]}
assert.throws(()=>r.createFactoryDeliveryNote({id:'AUD-OVER',createdBy:'Sari',deliveredAt:'2026-09-12 09:00:00',lines:[line]}),/实际发出/)
const first=r.createFactoryDeliveryNote({id:'AUD-DELIVERY-1',createdBy:'Sari',deliveredAt:'2026-09-12 09:00:00',lines:[{...line,qty:100}]})
const pos=r.getDefaultFactoryReceiptPosition(src.targetFactoryId)
links.confirmFactoryMaterialReceipt({id:'AUD-R1',factoryId:src.targetFactoryId,operatorId:'HILON',operatorName:'hilon',receivedAt:'2026-09-12 10:00:00',remark:'首批少收',lines:[{sourceId:src.id,sourceLineId:line.sourceLineId,weightKg:95,...pos}]})
const next=structuredClone(src);next.lines[0].sentQty=200;r.registerFactoryReceivingSource(next)
r.createFactoryDeliveryNote({id:'AUD-DELIVERY-2',createdBy:'Sari',deliveredAt:'2026-09-12 11:00:00',lines:[{...line,qty:100}]})
const bad=structuredClone(next);bad.lines[0].material.sku='WRONG';assert.throws(()=>r.registerFactoryReceivingSource(bad),/不能覆盖/)
near(r.getSourceActualReceipts(src.id)[0].qty,95)
console.log('PASS AUD-006/007: delivery actual cap, second batch append, immutable old identity')
const awaitingRolls=structuredClone(r.listFactoryReceivingSources().find(s=>s.type!=='HANDOUT'&&s.lines[0]?.material.kind==='FABRIC')!)
awaitingRolls.id='AUD-APPROVED-AWAIT-ROLLS';awaitingRolls.documentNo='DB-AUD-APPROVED';awaitingRolls.lines=awaitingRolls.lines.slice(0,1);awaitingRolls.lines[0].id=awaitingRolls.id+'-L1';awaitingRolls.lines[0].rolls=[]
r.registerFactoryReceivingSource(awaitingRolls)
assert(r.listFactoryReceivingSources().some(s=>s.id===awaitingRolls.id),'approved warehouse document must appear before upstream roll registration')
assert.throws(()=>r.prepareFactoryReceipt({id:'AUD-NO-ROLLS',factoryId:awaitingRolls.targetFactoryId,operatorId:'HILON',operatorName:'hilon',receivedAt:'2026-09-12 10:00:00',remark:'不能补造原卷码',lines:[{sourceId:awaitingRolls.id,sourceLineId:awaitingRolls.lines[0].id,...r.getDefaultFactoryReceiptPosition(awaitingRolls.targetFactoryId),rolls:[{barcode:'INVENTED',yard:10,...r.getDefaultFactoryReceiptPosition(awaitingRolls.targetFactoryId)}]}]}),/卷码不属于/)

for(const id of ['DYE-YARN-DEMO-1','DYE-YARN-DEMO-2','DYE-YARN-DEMO-3']){
 const order=d.getDyeWorkOrderById(id)!,w=order.initialYarnReceipt!
 d.submitDyeHandover(id,{handoverAt:'2026-09-12 12:00:00',handoverPerson:'dewi',yarn:{commandId:id,grossKg:w.grossGrams/1000,pcs:w.pcs,tubes:w.tubes,receiverFactoryId:d.getDyeDispatchPartner(id).id}})
 near(d.getDyeDispatchAvailableQty(id),0)
}
console.log('PASS AUD-016: all three yarn boundary demos can fully ship')
sync.syncFactoryReceivingWarehouseSources()
const wo=water.listWaterSolubleWorkOrders().find(o=>o.productionOrderId==='PO-202603-081')!
assert(water.assignWaterSolubleFactory(wo.waterOrderId,'F090').ok);wo.factoryId='F090'
const upstream=await import('../src/data/fcs/warehouse-material-execution.ts');const original=structuredClone(upstream.buildWarehouseExecutionDocumentSnapshot().issueOrders.find(d=>d.id==='ISSUE-WATER-PO-202603-087')!);original.id='AUD-WATER-SOURCE';original.docNo='AUD-WATER-TRANSFER';original.runtimeTaskId=wo.taskId;original.baseTaskId=wo.taskId;original.taskNo=wo.taskNo;original.productionOrderId=wo.productionOrderId;original.lines[0].materialCode=wo.materialCode;original.lines[0].skuCode=wo.materialCode;original.lines[0].materialName=wo.materialName;original.lines[0].materialSpec=wo.materialSpec;sync.syncFactoryReceivingWarehouseSources([original])
const ws=r.listFactoryReceivingSources(wo.factoryId).find(s=>s.lines.some(l=>l.waterOrderId===wo.waterOrderId))!
assert(ws,'water source automatically derived from approved warehouse document')
const wp=r.getDefaultFactoryReceiptPosition(wo.factoryId!)
const receive=(id:string,kg:number,businessQty:number)=>links.confirmFactoryMaterialReceipt({id,factoryId:wo.factoryId!,operatorId:'RCV-TEST',operatorName:'测试仓管',receivedAt:'2026-09-12 11:00:00',remark:'水溶称重及实测米数',lines:[{sourceId:ws.id,sourceLineId:ws.lines[0].id,weightKg:kg,businessQty,businessUnit:wo.qtyUnit,...wp}]})
receive('AUD-WATER-ZERO',0,0)
assert.equal(water.getWaterSolubleWorkOrderById(wo.waterOrderId)!.status,'WAIT_MATERIAL')
receive('AUD-WATER-POSITIVE',1.5,1200)
near(water.getWaterSolubleReceivedMaterialQty(wo.waterOrderId),1200)
assert.equal(water.getWaterSolubleWorkOrderById(wo.waterOrderId)!.status,'WAIT_WATER_SOLUBLE')
assert(!water.receiveWaterSolubleInput(wo.waterOrderId,{qty:1,receiptId:'bad',upstreamRecordId:ws.id}).ok)
const started=water.startWaterSoluble(wo.waterOrderId,'测试仓管');assert(started.ok,started.message)
const stock=warehouse.listFactoryWaitProcessStockItems().find(s=>s.stockItemId.includes('AUD-WATER-POSITIVE'))!
near(stock.availableQty!,0);near(stock.issuedQty!,1.5)
const done=water.completeWaterSoluble(wo.waterOrderId,1200,'实际接收大于计划，按实测米数');assert(done.ok,done.message)
if(water.getWaterSolubleWorkOrderById(wo.waterOrderId)!.status==='PRODUCTION_PAUSED')assert(water.resolveWaterSolublePause(wo.waterOrderId,'CONTINUE_WITH_ACTUAL_QTY').ok)
receive('AUD-WATER-SECOND',0.25,200)
writeFileSync('/private/tmp/dye-water-ready-browser-state.json',JSON.stringify([...values]))
const actorDomain=await import('../src/data/fcs/store-domain-pda.ts')
let actor=actorDomain.createPdaSessionFromUser(actorDomain.listFactoryPdaUsers('F090').find(u=>u.roleId==='ROLE_OPERATOR'&&u.status==='ACTIVE')!)
actorDomain.setPdaSession(actor)
const extra=water.executeWaterSolublePdaAction({action:'START',orderId:wo.waterOrderId,taskId:wo.taskId,expectedStatus:'WAIT_HANDOVER',expectedNode:'HANDOVER',actor})
assert(extra.ok,extra.message);near(water.getWaterSolubleWorkOrderById(wo.waterOrderId)!.inputQty!,1400)
near(warehouse.listFactoryWaitProcessStockItems().find(s=>s.stockItemId.includes('AUD-WATER-SECOND'))!.availableQty!,0)
assert(water.completeWaterSoluble(wo.waterOrderId,1400,'本批实际累计完成').ok)
if(water.getWaterSolubleWorkOrderById(wo.waterOrderId)!.status==='PRODUCTION_PAUSED')assert(water.resolveWaterSolublePause(wo.waterOrderId,'CONTINUE_WITH_ACTUAL_QTY').ok)
const handover=await import('../src/data/fcs/pda-handover-events.ts')
const headId=handover.ensureHandoverOrderForStartedTask(wo.taskId).handoverOrderId
const head=handover.getHandoverOrderById(headId)!;head.receiverKind='MANAGED_POST_FACTORY';head.receiverId='ID-F002';head.receiverName='MJS';handover.upsertPdaHandoverHeadMock(head)
actor=actorDomain.createPdaSessionFromUser(actorDomain.listFactoryPdaUsers('F090').find(u=>u.roleId==='ROLE_ADMIN'&&u.status==='ACTIVE')!)
actorDomain.setPdaSession(actor)
const sent=handover.createFactoryHandoverRecord({handoverOrderId:headId,submittedQty:1400,qtyUnit:wo.qtyUnit,factorySubmittedAt:'2026-09-12 13:00:00',factorySubmittedBy:actor.userName,scanCode:wo.materialCode,actor})
const waterSource=r.getFactoryReceivingSource(`WATER-HANDOUT-${sent.handoverRecordId||sent.recordId}`)!;assert(waterSource,'water handoff creates pending receipt for actual downstream factory')
const mp=r.getDefaultFactoryReceiptPosition('ID-F002')
links.confirmFactoryMaterialReceipt({id:'AUD-WATER-DOWNSTREAM',factoryId:'ID-F002',operatorId:'DEWI',operatorName:'dewi',receivedAt:'2026-09-12 14:00:00',remark:'实收少于交出',lines:[{sourceId:waterSource.id,sourceLineId:waterSource.lines[0].id,weightKg:1.6,businessQty:1300,businessUnit:wo.qtyUnit,...mp}]})
near(water.getWaterSolubleWorkOrderById(wo.waterOrderId)!.receivedQty,1300)
near(handover.getPdaHandoverRecordsByHead(headId).at(-1)!.receiverWrittenQty!,1300)
near(warehouse.listFactoryWaitProcessStockItems().find(s=>s.stockItemId.includes('AUD-WATER-DOWNSTREAM'))!.receivedQty,1.6)
actorDomain.clearPdaSession()
console.log('PASS AUD-005/010: warehouse to water pending, zero/over receipt, no implicit start, kg stock actual use')
const noPreset=structuredClone(d.getDyeWorkOrderById('DYE-YARN-DEMO-1')!);delete noPreset.yarnOrderedWeightKg;assert(d.isDyeYarnOrder(noPreset))
console.log('PASS AUD-015: yarn identification independent from seed flag')

const pdaTasks=await import('../src/data/fcs/pda-task-mock-factory.ts')
const fresh=structuredClone(d.getDyeWorkOrderById('DYE-DISPATCH-DEMO-2')!),newId='AUD-NEW-DYE'
fresh.dyeOrderId=newId;fresh.dyeOrderNo='RS-AUD-NEW';fresh.taskId='TASK-AUD-NEW';fresh.taskNo='TK-AUD-NEW';fresh.outputRolls=[];fresh.dispatchDocuments=[];fresh.handoverOrderId=undefined;fresh.handoverOrderNo=undefined
fresh.downstreamPartner={kind:'FACTORY',id:'ID-F002',name:'MJS',factoryType:'染色厂'}
fresh.outputMaterial={...d.getDyeDispatchMaterial('DYE-DISPATCH-DEMO-2'),sku:'AUD-OUTPUT-SKU',batchNo:'AUD-NEW-BATCH'}
const capture=d.captureDyeProcessMutationState();capture.workOrders.push([newId,fresh]);capture.nodeRecords.push([newId,d.listDyeExecutionNodeRecords('DYE-DISPATCH-DEMO-2').map(n=>({...n,dyeOrderId:newId,taskId:fresh.taskId,nodeRecordId:`${newId}-${n.nodeCode}`}))]);d.restoreDyeProcessMutationState(capture)
const originalTask=pdaTasks.listPdaGenericProcessTasks().find(t=>t.taskId==='DYE-DISPATCH-DEMO-2')!;pdaTasks.registerPdaGenericProcessTask({...originalTask,taskId:fresh.taskId,taskNo:fresh.taskNo,taskOrderId:newId,receiverId:'ID-F002',receiverName:'MJS',receiverKind:'MANAGED_POST_FACTORY'})
const roll=d.saveDyeOutputRolls(newId,[{qty:60,weightKg:10.1,widthCm:150,gsm:180,vatNo:'GT-01',remark:'新增订单测试'}])[0];d.markDyeOutputRolls(newId,[roll.id],'print')
const dispatch=d.createDyeDispatchDocument([{orderId:newId,rollIds:[roll.id]}],'hilon');d.scanDyeDispatchRoll(dispatch.id,roll.barcode,'hilon');d.saveDyeDispatchTransport(dispatch.id,{driver:'Andi',vehicle:'厢式货车',plate:'B 1800 QA',note:'新单下游交接'});const final=d.finishDyeDispatchDocument(dispatch.id,'confirm')
const target=r.getFactoryReceivingSource(final.lines[0].receivingSourceId!)!;assert.equal(target.targetFactoryId,'ID-F002');assert.equal(target.lines[0].material.sku,'AUD-OUTPUT-SKU');assert.equal(target.lines[0].material.batchNo,'AUD-NEW-BATCH')
console.log('PASS AUD-014: new ID with explicit current output material creates downstream factory receipt')

writeFileSync('/private/tmp/dye-audit-browser-state.json',JSON.stringify([...values]))

import test from 'node:test'
import assert from 'node:assert/strict'
import { PART_TICKET_KEYS as K, decodePartTicketRecords as decode, encodePartTicketRecords as encode, validatePartTicketRecords, stagePartTicketSpreadingStore, stagePartTicketTransferBagStore } from '../../src/data/fcs/cutting/part-ticket-records.ts'
import { diffCuttingRecords } from '../../src/data/fcs/cutting/cutting-record-repository.ts'
const ticket = (id: string) => ({ticketRecordId:id,ticketNo:'FP-'+id,status:'PRINTED',quantity:10})
test('逐票与逐打印任务保持原结构，变更一条只保存一条',()=>{
 const before=decode(K.records,JSON.stringify([ticket('1'),ticket('2')]))
 assert.equal(before.length,2)
 const after=decode(K.records,JSON.stringify([{...ticket('1'),quantity:11},ticket('2')]))
 assert.equal(diffCuttingRecords(before,after).puts.length,1)
 assert.deepEqual(JSON.parse(encode(K.records,after)!),[{...ticket('1'),quantity:11},ticket('2')])
 const jobs=[{printJobId:'job1',ticketRecordIds:['1','2']}]
 assert.deepEqual(JSON.parse(encode(K.jobs,decode(K.jobs,JSON.stringify(jobs)))!),jobs)
})
test('草稿按原映射键保存；手工票与操作记录分离，删除票保留审计',()=>{
 const drafts={owner:{draftId:'d1',previewLabelRecords:[ticket('1')]}}
 assert.deepEqual(JSON.parse(encode(K.drafts,decode(K.drafts,JSON.stringify(drafts)))!),drafts)
 const manual={records:[{feiTicketId:'m1',feiTicketNo:'TM-1',manualBatchId:'b1',qrPayload:{}}],operationLogs:[{logId:'l1',feiTicketId:'m1',action:'新增菲票'}]}
 const rows=decode(K.manual,JSON.stringify(manual));assert.equal(rows.length,2)
 assert.deepEqual(JSON.parse(encode(K.manual,rows)!),manual)
 assert.deepEqual(JSON.parse(encode(K.manual,rows.slice(1))!),{records:[],operationLogs:manual.operationLogs})
 assert.deepEqual(JSON.parse(encode(K.manual,decode(K.manual,JSON.stringify(manual.records)))!),{records:manual.records,operationLogs:[]})
})
for(const [name,key,value] of [
 ['损坏JSON',K.records,'{'],['空字符串',K.records,''],['错误根',K.records,'{}'],['重复票号身份',K.records,JSON.stringify([ticket('1'),ticket('1')])],
 ['缺少票号',K.records,'[{"ticketRecordId":"a","status":"PRINTED"}]'],['错误状态',K.records,'[{"ticketRecordId":"a","ticketNo":"a","status":"bad"}]'],
 ['打印关联缺失',K.jobs,'[{"printJobId":"j"}]'],['草稿身份缺失',K.drafts,'{"a":{}}'],['手工日志缺失',K.manual,'{"records":[]}'],['手工二维码缺失',K.manual,'[{"feiTicketId":"a","feiTicketNo":"a","manualBatchId":"b"}]'],
] as const)test(`拒绝${name}且不冒充空数据`,()=>assert.throws(()=>decode(key,value)))
test('已保存实体与备份身份校验，不接受伪造集合或迁移元数据',()=>{
 const rows=decode(K.records,JSON.stringify([ticket('1')]))
 assert.doesNotThrow(()=>validatePartTicketRecords(rows))
 assert.throws(()=>validatePartTicketRecords([{...rows[0],id:'forged'}]))
 assert.throws(()=>validatePartTicketRecords([{id:'part-ticket:unknown:a',collection:'part-ticket:unknown',value:{}}]))
 const marker={id:'part-ticket-migration:'+K.records,collection:'part-ticket-migrations',value:{key:K.records,phase:'COMPLETE',fingerprint:'a'.repeat(64),targetFingerprint:'b'.repeat(64),count:1,copied:1,ids:[rows[0].id]}}
 assert.doesNotThrow(()=>validatePartTicketRecords([marker]))
 assert.throws(()=>validatePartTicketRecords([{...marker,value:{...marker.value,phase:'VERIFIED'}}]))
})

test('袋账派生绑定锁，无需持久化派生票快照；关闭周转解除旧快照锁',async()=>{
 const {applyPocketBindingLocksToTicketRecords:project}=await import('../../src/pages/process-factory/cutting/transfer-bags-model.ts')
 const records=[{...ticket('1'),downstreamLocked:false,boundPocketNo:'',boundUsageNo:''}] as unknown as Parameters<typeof project>[0]
 const store={usages:[{usageId:'u1',usageNo:'U1',usageStatus:'PACKING',styleCode:'S1'}],bindings:[{bindingId:'b1',ticketRecordId:'1',ticketNo:'FP-1',bagId:'bag1',bagCode:'BAG1',usageId:'u1',usageNo:'U1',boundAt:'now'}]} as unknown as Parameters<typeof project>[1]
 const bound=project(records,store)
 assert.equal(bound[0].downstreamLocked,true);assert.equal(bound[0].boundPocketNo,'BAG1');assert.equal(bound[0].boundUsageNo,'U1')
 assert.deepEqual(project(bound,store),project(records,store))
 store.usages[0].usageStatus='CLOSED'
 assert.deepEqual(project(bound,store),project(records,store))
 assert.equal(project(bound,store)[0].downstreamLocked,false)
})

test('唛架来源和铺布单逐实体保存，保留卷明细、层序及来源引用',()=>{
 const store={markers:[{markerId:'m1',markerNo:'M1',cutOrderIds:['c1']}],sessions:[{spreadingSessionId:'s1',markerId:'m1',rolls:[{rollRecordId:'r1',layerCount:10}],operationLogs:[{logId:'l1'}]}]}
 const rows=decode(K.spreading,JSON.stringify(store));assert.equal(rows.length,2)
 assert.deepEqual(JSON.parse(encode(K.spreading,rows)!),store)
 const changed=structuredClone(store);changed.sessions[0].rolls[0].layerCount=12
 assert.deepEqual(diffCuttingRecords(rows,decode(K.spreading,JSON.stringify(changed))).puts.map(r=>r.id),['part-ticket:spreading-sessions:s1'])
 const source=[{markerPlanId:'p1',markerPlanNo:'MP1',items:[{cutOrderId:'c1',productionOrderId:'po1'}]}]
 assert.deepEqual(JSON.parse(encode(K.markerSources,decode(K.markerSources,JSON.stringify(source)))!),source)
 assert.throws(()=>decode(K.spreading,'{"markers":[],"sessions":[{}]}'))
 assert.throws(()=>decode(K.markerSources,'[{"markerPlanNo":"MP"}]'))
})

test('指定保存对象不复制重复静态唛架，也不覆盖其他已保存铺布单',()=>{
 const values=new Map<string,string>()
 const prior=Object.getOwnPropertyDescriptor(globalThis,'localStorage')
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)}})
 try {
  values.set(K.spreading,JSON.stringify({markers:[],sessions:[{spreadingSessionId:'existing',note:'保持用户记录'}]}))
  const before={markers:[{markerId:'duplicate'},{markerId:'duplicate'}],sessions:[{spreadingSessionId:'selected',note:'原值'},{spreadingSessionId:'existing',note:'错误派生值'}]}
  const next=structuredClone(before);next.sessions[0].note='本次修改'
  stagePartTicketSpreadingStore(next,before,{sessions:['selected']})
  assert.deepEqual(JSON.parse(values.get(K.spreading)!),{markers:[],sessions:[{spreadingSessionId:'existing',note:'保持用户记录'},{spreadingSessionId:'selected',note:'本次修改'}]})
  assert.throws(()=>stagePartTicketSpreadingStore(next,before,{markers:['duplicate']}))
 } finally {if(prior)Object.defineProperty(globalThis,'localStorage',prior);else Reflect.deleteProperty(globalThis,'localStorage')}
})

test('旧袋账按实体保留绑定与历史，局部动作不复制静态袋档案',()=>{
 const prior=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),values=new Map<string,string>()
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)}})
 try {
  const source={masters:[{bagId:'b1',bagCode:'B1'}],usages:[{usageId:'u1',usageStatus:'PACKING'}],bindings:[{bindingId:'bind1',usageId:'u1',ticketRecordId:'t1',status:'BOUND'}]}
  const rows=decode(K.bags,JSON.stringify(source));assert.equal(rows.length,3)
  assert.equal((JSON.parse(encode(K.bags,rows)!).bindings[0]).ticketRecordId,'t1')
  const after=structuredClone(source);after.usages[0].usageStatus='CLOSED'
  stagePartTicketTransferBagStore(after,source)
  const saved=JSON.parse(values.get(K.bags)!);assert.equal(saved.masters.length,0);assert.equal(saved.bindings.length,0);assert.equal(saved.usages[0].usageStatus,'CLOSED')
  assert.throws(()=>decode(K.bags,JSON.stringify({...source,bindings:[{}]})))
  assert.throws(()=>decode(K.bags,JSON.stringify({...source,extraData:[{id:'do-not-drop'}]})))
 } finally {if(prior)Object.defineProperty(globalThis,'localStorage',prior);else Reflect.deleteProperty(globalThis,'localStorage')}
})

test('专用打印来源保留原票身份、数量、状态、袋锁及打印对象，不查询全量PDA与库存摘要',async()=>{
 const {buildFeiTicketPrintProjection:project}=await import('../../src/pages/process-factory/cutting/fei-ticket-print-projection.ts')
 const {buildFcsCuttingDomainSnapshot:snapshot}=await import('../../src/domain/fcs-cutting-runtime/domain-snapshot.ts')
 const full=project(snapshot()), scoped=project()
 const tickets=(p:typeof full)=>p.ticketRecords.map(t=>({id:t.ticketRecordId,no:t.ticketNo,status:t.status,quantity:t.quantity,cutOrderId:t.cutOrderId,boundPocketNo:t.boundPocketNo,boundUsageNo:t.boundUsageNo})).sort((a,b)=>a.id.localeCompare(b.id))
 const units=(p:typeof full)=>p.printableViewModel.units.map(u=>({id:u.printableUnitId,no:u.printableUnitNo,status:u.status})).sort((a,b)=>a.id.localeCompare(b.id))
 assert.ok(full.ticketRecords.length>0)
 assert.deepEqual(tickets(scoped),tickets(full));assert.deepEqual(units(scoped),units(full))
 assert.equal('pdaExecutionState' in scoped.snapshot,false);assert.equal('warehouseState' in scoped.snapshot,false)
})

test('实际输出首打保持原身份与数量；动态与普通来源均可打印，失效来源阻断，重复首打不新增',async()=>{
 const {executeGeneratedActualTicketFirstPrint:print}=await import('../../src/pages/process-factory/cutting/fei-tickets-model.ts')
 const {listGeneratedFeiTickets}=await import('../../src/data/fcs/cutting/generated-fei-tickets.ts')
 const all=listGeneratedFeiTickets().filter(ticket=>ticket.sourceBasisType==='ACTUAL_CUTTING_OUTPUT')
 const ordinary=all.find(ticket=>ticket.feiTicketId.startsWith('mock-fei-ticket-ordinary-'))!
 const dynamic=all.find(ticket=>!ticket.feiTicketId.startsWith('mock-fei-ticket-ordinary-'))!
 assert.ok(ordinary);assert.ok(dynamic)
 const options={tickets:[ordinary,dynamic],ticketRecords:[],printJobs:[],operator:'专项验证',operatedAt:'2026-09-25 11:20',templateName:'FEI_TICKET_LABEL'}
 const result=print(options)
 assert.equal(result.printedCount,2);assert.equal(result.nextJobs.length,1)
 assert.deepEqual(result.nextRecords.map(ticket=>ticket.ticketRecordId),[ordinary.feiTicketId,dynamic.feiTicketId])
 assert.deepEqual(result.nextRecords.map(ticket=>ticket.ticketNo),[ordinary.feiTicketNo,dynamic.feiTicketNo])
 assert.deepEqual(result.nextRecords.map(ticket=>ticket.quantity),[ordinary.actualCutPieceQty,dynamic.actualCutPieceQty])
 assert.equal(print({...options,ticketRecords:result.nextRecords,printJobs:result.nextJobs}).printedCount,0)
 assert.throws(()=>print({...options,tickets:[{...ordinary,sourceOutputLineId:''}]}))
 assert.throws(()=>print({...options,tickets:[{...ordinary,printStatus:'VOIDED'}]}))
 assert.throws(()=>print({...options,tickets:[ordinary],ticketRecords:[{...result.nextRecords[0],status:'VOIDED'}]}))
 assert.throws(()=>print({...options,tickets:[ordinary,ordinary]}))
 const {buildFeiTicketLabelPrintDocument}=await import('../../src/pages/print/templates/label-print-template.ts')
 assert.throws(()=>buildFeiTicketLabelPrintDocument({documentType:'FEI_TICKET_LABEL',sourceType:'FEI_TICKET_RECORD',sourceId:'unknown-fei-id'}))
 assert.throws(()=>buildFeiTicketLabelPrintDocument({documentType:'FEI_TICKET_LABEL',sourceType:'FEI_TICKET_RECORD',sourceId:ordinary.feiTicketId+',unknown-fei-id'}))
})

test('唛架引用读取失败明确阻断，不将迁移或读取错误伪装成空铺布来源',async()=>{
 const {partTicketStorage}=await import('../../src/data/fcs/cutting/part-ticket-records.ts')
 const {buildMarkerPlanViewModel}=await import('../../src/pages/process-factory/cutting/marker-plan-model.ts')
 const prior=partTicketStorage.getItem
 try {
  partTicketStorage.getItem=()=>{throw new Error('验收读取失败')}
  const sources={materialPrepRows:[],cutOrderRows:[],productionRows:[]} as unknown as Parameters<typeof buildMarkerPlanViewModel>[0]
  assert.throws(()=>buildMarkerPlanViewModel(sources),/验收读取失败/)
 } finally {partTicketStorage.getItem=prior}
})

test('用户唛架方案逐ID迁移保留床次和占用，修改一张不重写其它方案',()=>{
 const plans=[{id:'plan-1',markerNo:'MK-1',cutOrderIds:['cut-1'],beds:[{bedId:'b1',sizePiecePerLayer:{M:2}}],operationLogs:[{id:'log-1',action:'修改'}]},{id:'plan-2',markerNo:'MK-2',cutOrderIds:['cut-2'],beds:[]}]
 const rows=decode(K.markerPlans,JSON.stringify(plans));assert.equal(rows.length,2)
 assert.deepEqual(JSON.parse(encode(K.markerPlans,rows)!),plans)
 const next=structuredClone(plans);next[0].beds[0].sizePiecePerLayer!.M=3
 assert.deepEqual(diffCuttingRecords(rows,decode(K.markerPlans,JSON.stringify(next))).puts.map(r=>r.id),['part-ticket:marker-plans:plan-1'])
 assert.throws(()=>decode(K.markerPlans,'[{"markerNo":"missing-id"}]'))
})

test('PDA及手工票专用唛架定义与原完整投影等价，保留床次、数量和可铺布资格',async()=>{
 const {buildMarkerPlanProjection}=await import('../../src/pages/process-factory/cutting/marker-plan-projection.ts')
 const random=Math.random
 try {
  Math.random=()=>0.314159
  const full=buildMarkerPlanProjection(), scoped=buildMarkerPlanProjection(full.snapshot,{sourceIdentityOnly:true})
  assert.ok(full.viewModel.plans.length>0)
  assert.deepEqual(scoped.viewModel.plans,full.viewModel.plans)
 } finally {Math.random=random}
})

test('裁床配料按真实生产单范围读取与全量结果逐字段相等，保留库存、领取、状态与任务链接',async()=>{
 const {listMaterialPrepOrderProjections}=await import('../../src/data/fcs/cutting/production-material-prep.ts')
 const {listMaterialLedgerProjections}=await import('../../src/data/fcs/cutting/material-ledger.ts')
 const productionOrderIds=new Set(listMaterialLedgerProjections().map(row=>row.productionOrderId))
 const full=listMaterialPrepOrderProjections(null)
 const expected=full.filter(row=>productionOrderIds.has(row.order.productionOrderId))
 const scoped=listMaterialPrepOrderProjections(null,{productionOrderIds})
 assert.ok(expected.length>0)
 assert.ok(expected.length<full.length,'演示来源中有不属于裁床账的订单，不能只是换一个全量调用')
 assert.deepEqual(scoped,expected)
 assert.deepEqual(listMaterialPrepOrderProjections(null,{productionOrderIds:new Set()}),[])
 assert.deepEqual(listMaterialPrepOrderProjections(null),full,'范围读取不能污染默认全量投影缓存')
})

test('PDA铺布目标直接携带真实已保存铺布单的裁床与负责人，不另算整套列表',async()=>{
 const {buildFcsCuttingDomainSnapshot}=await import('../../src/domain/fcs-cutting-runtime/index.ts')
 const {getPdaCuttingTaskSnapshot,listPdaCuttingExecutionRowsByTaskId}=await import('../../src/data/fcs/pda-cutting-execution-source.ts')
 const {readMarkerSpreadingPrototypeData}=await import('../../src/pages/process-factory/cutting/marker-spreading-utils.ts')
 const snapshot=buildFcsCuttingDomainSnapshot(),taskId='TASK-CUT-000201'
 const execution=listPdaCuttingExecutionRowsByTaskId(taskId,snapshot)[0]
 assert.ok(execution)
 const original=readMarkerSpreadingPrototypeData().store.sessions[0]
 const session={...original,spreadingSessionId:'actual-session-defaults',cutOrderIds:[execution.cutOrderId],cuttingTableId:'CT-ACTUAL',ownerAccountId:'actual-owner',ownerName:'实际负责人'}
 snapshot.markerSpreadingState.store.sessions=[session] as typeof snapshot.markerSpreadingState.store.sessions
 const detail=getPdaCuttingTaskSnapshot(taskId,execution.executionOrderId,snapshot)
 const target=detail?.spreadingTargets.find(t=>t.spreadingSessionId==='actual-session-defaults')
 assert.ok(target);assert.equal(target.cuttingTableId,'CT-ACTUAL');assert.equal(target.ownerAccountId,'actual-owner');assert.equal(target.ownerName,'实际负责人')
})

test('铺布投影复用唛架定义仍保留已保存session的卷明细、裁床、负责人和实际裁剪数量',async()=>{
 const {buildMarkerSpreadingProjection}=await import('../../src/pages/process-factory/cutting/marker-spreading-projection.ts')
 const {readMarkerSpreadingPrototypeData}=await import('../../src/pages/process-factory/cutting/marker-spreading-utils.ts')
 const base=buildMarkerSpreadingProjection({includeCreateSources:false,includeViewModel:false})
 const first=readMarkerSpreadingPrototypeData().store.sessions[0];assert.ok(first)
 const saved={...structuredClone(first),cuttingTableId:'CT-SAVED',ownerAccountId:'saved-owner',ownerName:'已保存负责人',actualCutPieceQty:321,actualCutGarmentQty:321,rolls:[{...first.rolls[0],rollRecordId:'saved-roll',rollNo:'99',actualLength:12,layerCount:10}]}
 base.snapshot.markerSpreadingState.store.sessions=[saved] as typeof base.snapshot.markerSpreadingState.store.sessions
 const result=buildMarkerSpreadingProjection({snapshot:base.snapshot,includeCreateSources:false,includeViewModel:false}).store.sessions.find(s=>s.spreadingSessionId===saved.spreadingSessionId)
 assert.ok(result)
 for(const key of ['cuttingTableId','ownerAccountId','ownerName','actualCutPieceQty','actualCutGarmentQty','rolls','cutOrderIds','markerId'] as const)assert.deepEqual(result[key],saved[key],key)
})

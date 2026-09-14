import assert from 'node:assert/strict'
import {existsSync,writeFileSync,readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
const cold=process.argv.includes('--cold'), corrupt=process.argv.includes('--corrupt')
const bytes=new Map<string,string>(cold||corrupt?JSON.parse(readFileSync('/private/tmp/water-output-acceptance/storage.json','utf8')):[])
if(corrupt){const saved=JSON.parse(bytes.get('higoods.formal-water-execution.v1')!);const o=saved.orders.find((o:any)=>o.outputRolls?.length);o.outputRolls[0].qty=-1;bytes.set('higoods.formal-water-execution.v1',JSON.stringify(saved))}
let failKey=''
Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>bytes.get(k)??null,setItem:(k:string,v:string)=>{if(k===failKey)throw Error('模拟存储失败');bytes.set(k,v)},removeItem:(k:string)=>bytes.delete(k)}})
const water=await import('../src/data/fcs/water-soluble-output.ts')
const domain=await import('../src/data/fcs/water-soluble-task-domain.ts')
const pda=await import('../src/data/fcs/pda-handover-events.ts')
const auth=await import('../src/data/fcs/store-domain-pda.ts')
const render=await import('../src/pages/process-factory/dyeing/output-documents.ts')
const printing=await import('../src/pages/process-factory/dyeing/dispatch-print.ts')
if(corrupt){assert.throws(()=>water.listWaterOutputRows(),/卷码|数量无效/);console.log('PASS 损坏记录不覆盖');process.exit(0)}
if(cold){assert.equal(domain.getWaterSolubleWorkOrderById('WATER-OUTPUT-DEMO-1')!.receivedQty,240);const docs=water.listWaterDispatchDocuments();assert.equal(docs.filter(d=>d.status==='已交出').length,1);const row=water.listWaterOutputRows().find(r=>r.orderId==='WATER-OUTPUT-DEMO-1')!;assert.equal(row.handoverRecords[0].receiverWrittenQty,240,'冷恢复必须保留交接实收');assert.equal(row.handoverRecords[0].taskReceipts?.length,2,'冷恢复必须保留两次接收明细');assert(docs.some(d=>d.status==='已作废'));assert(docs.some(d=>d.status==='草稿'&&d.lines[0].rolls.length===2));console.log('PASS 冷恢复：原单交出实收、草稿占用、作废记录均保留');process.exit(0)}
const id1='WATER-OUTPUT-DEMO-1',id2='WATER-OUTPUT-DEMO-2',id4='WATER-OUTPUT-DEMO-4'
assert(water.listWaterOutputRows().some(row=>row.completedQty>0),'待交出必须有具名具体完成数量')
for(const r of water.listWaterOutputRows()){assert(r.orderId.startsWith('WATER-'));for(const x of [r.workOrderNo,r.taskNo,r.productCode,r.productName,r.purchaseOrderNo,r.materialName,r.colorSku,r.receiverName])assert(x);assert(existsSync(`public${r.outputImageUrl}`));assert(existsSync(`public${r.productImageUrl}`))}
assert(water.listWaterDispatchDocuments().length>0,'初始交出页有具体草稿单据')
for(const r of [render.renderWaterSolublePendingHandoverPage(),render.renderWaterSolubleHandoverDocumentsPage()])assert(r.includes('data-standard-list-page')&&r.includes('水溶'))
const initial=domain.listWaterSolubleWorkOrders()
assert.equal(new Set(initial.map(o=>o.sourceArtifactId)).size,initial.length,'每个水溶单必须保留独立来源标识')
assert.throws(()=>water.saveWaterOutputRolls(id1,[{qty:.001}]),/至少为 0.01/)
assert.throws(()=>water.createWaterDispatchDocument([{orderId:id4,rollIds:water.getWaterOutputRolls(id4).map(r=>r.id)}],'Budi'),/未打印/)
assert.throws(()=>water.saveWaterOutputRolls(id1,[{id:water.getWaterOutputRolls(id1)[0].id,qty:999}]),/超过/)
assert.deepEqual(domain.listWaterSolubleWorkOrders(),initial,'失败维护必须回滚')
domain.mutateWaterSolubleOutput(orders=>{orders.find(o=>o.waterOrderId===id2)!.factoryId='ID-F003'})
assert.throws(()=>water.createWaterDispatchDocument([id1,id2].map(orderId=>({orderId,rollIds:water.getWaterOutputRolls(orderId).map(r=>r.id)})),'Budi'),/不同加工厂/)
domain.mutateWaterSolubleOutput(orders=>{orders.find(o=>o.waterOrderId===id2)!.factoryId='F090'})
const selections=[id1,id2].map(orderId=>({orderId,rollIds:water.getWaterOutputRolls(orderId).map(r=>r.id)}))
const doc=water.createWaterDispatchDocument(selections,'Budi')
assert.equal(doc.lines.length,2);assert.equal(water.getWaterDispatchAvailableQty(id1),240);assert.equal(domain.getWaterSolubleWorkOrderById(id1)!.handoverQty,0)
assert.throws(()=>water.createWaterDispatchDocument(selections,'Budi'),/占用/)
assert.throws(()=>water.saveWaterOutputRolls(id1,[{id:selections[0].rollIds[0],qty:20}]),/占用/)
assert.throws(()=>water.scanWaterDispatchRoll(doc.id,'WRONG','Budi'),/不在/)
for(const l of doc.lines)for(const r of l.rolls)water.scanWaterDispatchRoll(doc.id,r.barcode,'Budi')
assert.throws(()=>water.scanWaterDispatchRoll(doc.id,doc.lines[0].rolls[0].barcode,'Budi'),/重复/)
water.saveWaterDispatchTransport(doc.id,{driver:'Agus',vehicle:'厢式货车',plate:'B 8261 KJ',note:'水溶花边'})
assert.throws(()=>water.finishWaterDispatchDocument(doc.id,'confirm'),/登录/)
const admin=auth.listAllFactoryPdaUsers().find(u=>u.factoryId==='F090'&&u.roleId==='ROLE_ADMIN')!
auth.setPdaSession(auth.createPdaSessionFromUser(auth.listAllFactoryPdaUsers().find(u=>u.factoryId==='F090'&&u.roleId==='ROLE_OPERATOR')!))
assert.throws(()=>water.finishWaterDispatchDocument(doc.id,'confirm'),/交接员|管理员/)
auth.setPdaSession(auth.createPdaSessionFromUser(admin))
const done=water.finishWaterDispatchDocument(doc.id,'confirm')
assert.equal(done.status,'已交出');assert.equal(domain.getWaterSolubleWorkOrderById(id1)!.handoverQty,240);assert.equal(domain.getWaterSolubleWorkOrderById(id1)!.receivedQty,0);assert.equal(water.getWaterDispatchAvailableQty(id1),0)
assert.throws(()=>water.finishWaterDispatchDocument(doc.id,'confirm'),/已处理/)
assert(done.lines.every(l=>l.handoverRecordId));assert.equal(water.listWaterDispatchDocuments().filter(d=>d.lines.some(l=>l.handoverRecordId===done.lines[0].handoverRecordId)).length,1)
const receiptInput={receiptId:'WOUT-FAIL',targetTaskOrderId:'CUTTING-PO-202603-081',qty:80,qtyUnit:'米',receiverName:'接收员 Agus',receivedAt:done.handedOverAt!}
failKey='higood.formal-merged-handout-actions.v1'
assert.throws(()=>pda.receivePreparationHandoverForTask(done.lines[0].handoverRecordId!,receiptInput),/未保存/)
failKey=''
assert.equal(domain.getWaterSolubleWorkOrderById(id1)!.receivedQty,0,'交接存储失败必须撤回水溶原单实收')
assert.equal(pda.findPdaHandoverRecord(done.lines[0].handoverRecordId!)!.taskReceipts?.length??0,0,'失败接收不能留下明细')
pda.receivePreparationHandoverForTask(done.lines[0].handoverRecordId!,{receiptId:'WOUT-R1',targetTaskOrderId:'CUTTING-PO-202603-081',qty:80,qtyUnit:'米',receiverName:'接收员 Agus',receivedAt:done.handedOverAt!})
pda.receivePreparationHandoverForTask(done.lines[0].handoverRecordId!,{receiptId:'WOUT-R2',targetTaskOrderId:'CUTTING-PO-202603-081',qty:160,qtyUnit:'米',receiverName:'接收员 Agus',receivedAt:done.handedOverAt!})
assert.equal(domain.getWaterSolubleWorkOrderById(id1)!.receivedQty,240)
const draft=water.listWaterDispatchDocuments().find(d=>d.status==='草稿')!;const oldQty=water.getWaterDispatchAvailableQty(draft.lines[0].orderId);water.finishWaterDispatchDocument(draft.id,'void');assert.equal(water.getWaterDispatchAvailableQty(draft.lines[0].orderId),oldQty);assert(water.isWaterRollAvailable(draft.lines[0].orderId,water.getWaterOutputRolls(draft.lines[0].orderId)[0]))
const r4=water.getWaterOutputRolls(id4);water.markWaterOutputRolls(id4,r4.map(r=>r.id),'Budi');const split=water.createWaterDispatchDocument([{orderId:id4,rollIds:[r4[0].id]}],'Budi');const joined=water.createWaterDispatchDocument([{orderId:id4,rollIds:[r4[1].id]}],'Budi',split.id);assert.equal(joined.lines.length,1);assert.equal(joined.lines[0].rolls.length,2)
const before=JSON.stringify(domain.listWaterSolubleWorkOrders());failKey='higoods.formal-water-execution.v1';assert.throws(()=>water.scanWaterDispatchRoll(split.id,r4[0].barcode,'Budi'),/未保存/);failKey='';assert.equal(JSON.stringify(domain.listWaterSolubleWorkOrders()),before)
const html=printing.renderDyeDispatchPrint(done,water.listWaterOutputRows(),'水溶');assert(html.includes('水溶交出单')&&!html.includes('染色交出单'));assert(html.includes('SURAT JALAN'));assert.equal(printing.dyeDispatchQuantities(done).meters,420)
const historyBefore=domain.listWaterSolubleWorkOrders()
domain.mutateWaterSolubleOutput(orders=>{orders.find(o=>o.waterOrderId===id1)!.dispatchDocuments=[]})
const history=water.listWaterDispatchDocuments().find(d=>d.historical&&d.lines[0].orderId===id1)!
assert(history,'原 PDA 交接未关联新单据时应投影历史单据');assert.equal(history.lines[0].historicalQty,240);assert.equal(history.lines[0].rolls.length,0);assert.equal(history.createdAt,'')
assert(printing.renderDyeDispatchPrint(history,water.listWaterOutputRows(),'水溶').includes('未登记'))
domain.mutateWaterSolubleOutput(orders=>{for(const o of orders)o.dispatchDocuments=historyBefore.find(b=>b.waterOrderId===o.waterOrderId)!.dispatchDocuments})
const mixed=structuredClone(done);mixed.lines[0].unit='kg';mixed.lines[1].unit='Yard'
assert(Math.abs(printing.dyeDispatchQuantities(mixed).meters-164.592)<1e-9,'kg 不得计入长度，180 Yard 按 0.9144 换算米')
writeFileSync('/private/tmp/water-output-acceptance/storage.json',JSON.stringify([...bytes]))
for(const mode of ['--cold','--corrupt']){const child=spawnSync(process.execPath,['--import','tsx','scripts/check-water-soluble-output.ts',mode],{encoding:'utf8'});assert.equal(child.status,0,child.stdout+child.stderr);console.log(child.stdout.trim())}
console.log('PASS: 水溶批量建单、卷码占用、扫码、身份、实际交出、分次实收、作废、合入、回滚、打印；染色身份未混入')

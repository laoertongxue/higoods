import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'
import assert from 'node:assert/strict'
const values=new Map<string,string>(process.env.RECEIVING_REPLAY_FILE?JSON.parse(readFileSync(process.env.RECEIVING_REPLAY_FILE,'utf8')):[]);const storage={getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)}
Object.defineProperty(globalThis,'window',{value:{localStorage:storage,sessionStorage:storage,addEventListener:()=>{},dispatchEvent:()=>{},location:{pathname:'/fcs/craft/dyeing/pending-receipts'}},configurable:true});Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true})
Object.defineProperty(globalThis,'document',{value:{addEventListener:()=>{}},configurable:true})
const core=await import('../src/data/fcs/factory-receiving.ts')
const dye=await import('../src/data/fcs/dyeing-task-domain.ts')
const warehouse=await import('../src/data/fcs/factory-internal-warehouse.ts')
const wool=await import('../src/data/fcs/wool-domain/store.ts')
const queries=await import('../src/data/fcs/wool-domain/queries.ts')
const old=await import('../src/data/fcs/dyeing-material-receipts.ts')
if(process.env.RECEIVING_REPLAY_FILE){
 const pda=await import('../src/data/fcs/pda-handover-events.ts')
 const order=dye.getDyeWorkOrderById('DYE-YARN-DEMO-1')!,heads=pda.listPdaHandoverHeads().filter(h=>h.taskId===order.taskId&&h.headType==='HANDOUT')
 assert.equal(heads.length,1)
 const records=pda.getPdaHandoverRecordsByHead(heads[0].handoverId)
 assert.equal(records.length,2);assert.equal(new Set(records.map(r=>r.recordId)).size,2)
 assert.equal(records.reduce((n,r)=>n+(r.submittedQty||0),0),11.518)
 assert.equal(records.reduce((n,r)=>n+(r.receiverWrittenQty||0),0),9.101)
 assert(Math.abs(dye.getDyeDispatchAvailableQty(order.dyeOrderId)-16.062)<.000001)
 wool.validateWoolStore(wool.readWoolStore());assert.equal(queries.listWoolWarehouseStocks('WAIT_PROCESS').filter(s=>s.objectSkuCode==='YARN-COTTON-MIXED').reduce((n,s)=>n+s.currentQty,0),8.101)
 console.log('PASS cold restart: original batch IDs, actual upstream receipt, wool net balance, no repeated inbound');process.exit(0)
}
const source=core.getFactoryReceivingSource('RCV-SRC-001')!,pos=core.getDefaultFactoryReceiptPosition('ID-F003')
const before=dye.getDyeWorkOrderById('DWO-001')!
assert.throws(()=>old.receiveDyeMaterial(before.dyeOrderId,{qty:10,receiptId:'OLD-BLOCK',operatorName:'hilon'}),/旧数量入口已停用/)
const r=core.prepareFactoryReceipt({id:'INT-FAB',factoryId:'ID-F003',operatorName:'hilon',operatorId:'RCV-HILON',receivedAt:'2026-09-11 15:00:00',remark:'一轮验收',lines:[{sourceId:source.id,sourceLineId:source.lines[0].id,...pos,rolls:[{...pos,barcode:source.lines[0].rolls[0].barcode,yard:101}]}]});core.savePreparedFactoryReceipt(r)
const after=dye.getDyeWorkOrderById('DWO-001')!;assert(after.materialReceipts?.some(x=>x.receiptId.includes('INT-FAB')&&Math.abs(x.qty-92.3544)<1e-6));assert.equal(dye.getDyeExecutionNodeRecord('DWO-001','DYE')?.startedAt,undefined)
const result=dye.submitDyeHandover('DYE-YARN-DEMO-1',{handoverPerson:'hilon',handoverAt:'2026-09-11 15:15:00',yarn:{commandId:'INT-YARN-SHIP',pcs:20,grossKg:12,tubes:{PAPER:0,CONICAL:0,PAGODA:20},receiverFactoryId:'OWN_WOOL_FACTORY'}})
assert(result.recordIds.length>0)
const ys=core.getFactoryReceivingSource('YARN-SHIP-INT-YARN-SHIP')!;assert.equal(ys.lines[0].yarn!.netGrams,9580);assert.equal(ys.originalRecordId,result.recordIds[0]);const wp=core.getDefaultFactoryReceiptPosition('OWN_WOOL_FACTORY')
const receipt=core.prepareFactoryReceipt({id:'INT-WOOL',factoryId:'OWN_WOOL_FACTORY',operatorName:'周哥',operatorId:'RCV-WOOL',receivedAt:'2026-09-11 16:00:00',remark:'实际19筒11.4kg',lines:[{sourceId:ys.id,sourceLineId:ys.lines[0].id,...wp,pcs:19,grossKg:11.4,tubes:{PAPER:0,CONICAL:0,PAGODA:19}}]});core.savePreparedFactoryReceipt(receipt)
const ws=wool.readWoolStore();wool.validateWoolStore(ws)
assert.equal(ws.warehouseFlows.filter(f=>f.factoryReceiptId==='INT-WOOL').reduce((n,f)=>n+f.qty,0),9.101)
assert.equal(queries.listWoolWarehouseStocks('WAIT_PROCESS').find(s=>s.objectSkuCode==='YARN-COTTON-MIXED')?.currentQty,9.101)
assert.equal(dye.getDyeDispatchAvailableQty('DYE-YARN-DEMO-1'),18)
core.clearFactoryReceivingCache();wool.clearWoolStoreMemoryCache();const reloaded=wool.readWoolStore();assert.equal(reloaded.warehouseFlows.filter(f=>f.factoryReceiptId==='INT-WOOL').length,1);wool.validateWoolStore(reloaded)
const duplicate=dye.submitDyeHandover('DYE-YARN-DEMO-1',{handoverPerson:'hilon',handoverAt:'2026-09-11 15:15:00',yarn:{commandId:'INT-YARN-SHIP',pcs:20,grossKg:12,tubes:{PAPER:0,CONICAL:0,PAGODA:20},receiverFactoryId:'OWN_WOOL_FACTORY'}});assert.deepEqual(duplicate.recordIds,[ys.originalRecordId])
assert.throws(()=>dye.submitDyeHandover('DYE-YARN-DEMO-1',{yarn:{commandId:'INT-OVER',pcs:20,grossKg:18.001,tubes:{PAPER:0,CONICAL:0,PAGODA:20},receiverFactoryId:'OWN_WOOL_FACTORY'}}),/累计出货毛重/)
const link=await import('../src/data/fcs/factory-receiving-links.ts')
assert(link.listReceivingAllocationTargets('INT-WOOL-L1').some(t=>t.id==='WOOL-RCV-DEMO-001'))
link.allocateReceivedMaterialToOrder({id:'INT-ALLOC-WOOL',receiptLineId:'INT-WOOL-L1',woolOrderId:'WOOL-RCV-DEMO-001',qty:5,operatorName:'周哥',at:'2026-09-11 16:15:00'})
const allocated=wool.readWoolStore();wool.validateWoolStore(allocated)
assert.equal(queries.listWoolWarehouseStocks('WAIT_PROCESS').filter(s=>s.objectSkuCode==='YARN-COTTON-MIXED').reduce((n,s)=>n+s.currentQty,0),9.101)
assert.equal(queries.getWoolWorkOrderReadinessProjection('WOOL-RCV-DEMO-001').yarnReceiptsBySku.get('YARN-COTTON-MIXED')?.receivedQty,5)
const commands=await import('../src/data/fcs/wool-domain/commands.ts')
commands.issueWoolYarn('WOOL-RCV-DEMO-001',{commandId:'INT-ISSUE',yarnSkuCode:'YARN-COTTON-MIXED',batchNo:'Y260911-01',issuedQty:2,issuedBy:'周哥',issuedAt:'2026-09-11 16:20:00'})
commands.returnWoolYarn('WOOL-RCV-DEMO-001',{commandId:'INT-RETURN',yarnSkuCode:'YARN-COTTON-MIXED',batchNo:'Y260911-01',returnedQty:1,returnedBy:'周哥',returnedAt:'2026-09-11 16:30:00'})
wool.validateWoolStore(wool.readWoolStore())
assert.equal(queries.listWoolWarehouseStocks('WAIT_PROCESS').filter(s=>s.objectSkuCode==='YARN-COTTON-MIXED').reduce((n,s)=>n+s.currentQty,0),8.101)
console.log('PASS integration: original scalar entry blocked, receipt projection does not start dyeing, 12kg gross -> 9.58kg dispatch, wool actual 9.101kg once, refresh and retry, cumulative gross limit')

const second=dye.submitDyeHandover('DYE-YARN-DEMO-1',{handoverPerson:'dewi',handoverAt:'2026-09-11 17:00:00',yarn:{commandId:'INT-YARN-SECOND',pcs:1,grossKg:2,tubes:{PAPER:1,CONICAL:0,PAGODA:0},receiverFactoryId:'OWN_WOOL_FACTORY'}})
assert.notEqual(core.getFactoryReceivingSource('YARN-SHIP-INT-YARN-SECOND')!.originalRecordId,ys.originalRecordId)
assert.equal(second.recordIds.length,2)
const dir=mkdtempSync(join(tmpdir(),'higood-receiving-replay-')),file=join(dir,'browser-state.json');writeFileSync(file,JSON.stringify([...values]))
const child=spawnSync(process.execPath,['--import','tsx',import.meta.filename],{env:{...process.env,RECEIVING_REPLAY_FILE:file},encoding:'utf8'})
assert.equal(child.status,0,child.stdout+child.stderr);console.log(child.stdout.trim())
const beforeLocations=queries.listWoolWarehouseStocks('WAIT_PROCESS').filter(s=>s.objectSkuCode==='YARN-COTTON-MIXED');assert(beforeLocations.every(s=>s.physicalLocationId))
const secondPosition=core.getFactoryReceiptLocations('OWN_WOOL_FACTORY')[1];const sourceTwo=core.getFactoryReceivingSource('YARN-SHIP-INT-YARN-SECOND')!
link.confirmFactoryMaterialReceipt({id:'INT-WOOL-SECOND-POS',factoryId:'OWN_WOOL_FACTORY',operatorName:'周哥',operatorId:'RCV-WOOL',receivedAt:'2026-09-11 17:15:00',remark:'另一个实际库位',lines:[{sourceId:sourceTwo.id,sourceLineId:sourceTwo.lines[0].id,warehouseId:secondPosition.warehouse.warehouseId,locationId:secondPosition.location.locationId,pcs:1,grossKg:2,tubes:{PAPER:1,CONICAL:0,PAGODA:0}}]})
const stocks=queries.listWoolWarehouseStocks('WAIT_PROCESS').filter(s=>s.objectSkuCode==='YARN-COTTON-MIXED');assert.equal(stocks.find(s=>s.physicalLocationId===secondPosition.location.locationId)!.currentQty,1.938);assert.equal(new Set(stocks.map(s=>s.physicalLocationId)).size,2)
assert.throws(()=>link.allocateReceivedMaterialToOrder({id:'WRONG-SKU',receiptLineId:'INT-WOOL-SECOND-POS-L1',dyeOrderId:'DWO-001',qty:1,operatorName:'周哥',at:'2026-09-11 17:30:00'}),/同一物料/)
console.log('PASS physical stock: receipt positions separated, allocation conserves net stock, issue/return keep actual position, wrong-factory/SKU allocation blocked')

const physicalTransfer={commandId:'INT-PHYSICAL-MOVE',woolOrderId:'WOOL-RCV-DEMO-001',objectSkuCode:'YARN-COTTON-MIXED',defaultLocationId:'WOOL-WP-YARN-DEFAULT' as const,batchNo:'Y260911-01',physicalWarehouseId:wp.warehouseId,physicalLocationId:wp.locationId,toWarehouseId:secondPosition.warehouse.warehouseId,toLocationId:secondPosition.location.locationId,qty:1,reason:'按实际库位移库',operatedAt:'2026-09-11 17:40:00',operatedBy:'周哥'}
const moved=commands.transferWoolWarehouseStock(physicalTransfer);assert(moved.physicalTransferDirection==='OUT');wool.validateWoolStore(wool.readWoolStore());const moveRows=queries.listWoolWarehouseStocks('WAIT_PROCESS').filter(s=>s.woolOrderId==='WOOL-RCV-DEMO-001'&&s.objectSkuCode==='YARN-COTTON-MIXED');assert.equal(moveRows.find(s=>s.physicalLocationId===wp.locationId)?.currentQty,3);assert.equal(moveRows.find(s=>s.physicalLocationId===secondPosition.location.locationId)?.currentQty,1);assert.equal(commands.transferWoolWarehouseStock(physicalTransfer).flowId,moved.flowId);assert.throws(()=>commands.transferWoolWarehouseStock({...physicalTransfer,commandId:'INT-MOVE-OVER',qty:3.001}),/来源实际库位库存/);console.log('PASS physical transfer: own-location 1kg move, net conserved, replay once, source balance protected')

assert(moveRows.every(s=>s.objectName===ys.lines[0].material.name), '库位移库后仍显示原物料名称')

const view=await import('../src/data/fcs/dye-work-order-online-view.ts')
const yarnRow=view.listDyeWorkOrderOnlineRows().find(r=>r.dyeOrderId==='DYE-YARN-DEMO-1')!
assert(yarnRow.upstreamDocuments.some(d=>d.documentNo==='DB-YARN-SEED-1'&&d.status==='已调拨'&&d.sentQty===27.58))
assert(yarnRow.upstreamDocuments.every(d=>d.partner.kind!=='WAREHOUSE'||d.partner.warehouseAttribute==='纱线中央仓'))
assert.equal(yarnRow.yarnQuantities?.received[0].netGrams,27580)
assert.equal(yarnRow.yarnQuantities?.shipped.reduce((n,w)=>n+w.netGrams,0),11518)
assert.equal(yarnRow.downstreamReceivedQty,11.039)
assert.equal(yarnRow.pendingInboundQty,.479)
const book=await import('../src/data/fcs/warehouse-material-execution.ts')
const issue={...core.getFactoryReceivingSource('RCV-SRC-006')!,id:'INT-ISSUE-SOURCE',documentNo:'CK-260911-001',type:'ISSUE' as const,lines:core.getFactoryReceivingSource('RCV-SRC-006')!.lines.map(l=>({...l,id:'INT-ISSUE-L1'}))}
core.registerFactoryReceivingSource(issue)
assert(book.listWarehouseIssueOrders().some(d=>d.id===issue.id&&d.docType==='ISSUE'))
assert(!book.listWarehouseInternalTransferOrders().some(d=>d.id===issue.id))
console.log('PASS yarn list three measurements and 0.001kg precision; original ISSUE preserved in warehouse book')

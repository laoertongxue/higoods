import assert from 'node:assert/strict'
import {existsSync} from 'node:fs'
import {getFactoryReceivingSource,listFactoryReceivingSources,prepareFactoryReceipt,savePreparedFactoryReceipt,createFactoryDeliveryNote,resolveFactoryReceiptScan,listFactoryReceipts,getDefaultFactoryReceiptPosition,getSourceActualReceipts,allocateFactoryReceivedMaterial,approveFactoryTransfer,confirmFactorySourceHandout,clearFactoryReceivingCache,FACTORY_RECEIVING_KEY,type FactoryReceiptInput} from '../src/data/fcs/factory-receiving.ts'
import {buildFactoryReceiptInboundRecords} from '../src/data/fcs/factory-receiving-warehouse.ts'
const storage=new Map<string,string>();let fail=false
Object.defineProperty(globalThis,'window',{value:{localStorage:{getItem:(k:string)=>storage.get(k)||null,setItem:(k:string,v:string)=>{if(fail)throw new Error('保存失败');storage.set(k,v)}}},configurable:true})
clearFactoryReceivingCache()
const pos=getDefaultFactoryReceiptPosition('ID-F003'),source=(n:number)=>getFactoryReceivingSource(`RCV-SRC-${String(n).padStart(3,'0')}`)!
assert.equal(listFactoryReceivingSources().length,13)
assert(!listFactoryReceivingSources().some(s=>[11,12,13].map(n=>source(n).id).includes(s.id)))
assert(listFactoryReceivingSources().some(s=>s.id===source(4).id))
assert.equal(buildFactoryReceiptInboundRecords().length,0)
for(const s of listFactoryReceivingSources(undefined,true))for(const l of s.lines){for(const field of ['sku','name','kind','imageUrl','color','composition','specification','batchNo'] as const)assert(l.material[field].trim(),`${s.id}:${field}`);assert(existsSync(`public${l.material.imageUrl}`),l.material.imageUrl);for(const n of [l.plannedQty,l.sentQty])assert(Number.isFinite(n));if(l.material.kind==='FABRIC')assert(l.rolls.every(r=>r.barcode&&r.yard>0))}
const input=(id:string,n:number,rolls:number[],yard=100):FactoryReceiptInput=>({id,factoryId:'ID-F003',operatorId:'RCV-HILON',operatorName:'hilon',receivedAt:'2026-09-11 10:00:00',remark:'验收实收',lines:[{sourceId:source(n).id,sourceLineId:source(n).lines[0].id,...pos,rolls:rolls.map(i=>({...pos,barcode:source(n).lines[0].rolls[i].barcode,yard}))}]})
const receive=(i:FactoryReceiptInput)=>{const r=prepareFactoryReceipt(i);savePreparedFactoryReceipt(r);return r}
const dl=createFactoryDeliveryNote({id:'S-MIX',deliveredAt:'2026-09-11 09:30:00',createdBy:'dewi',lines:[1,2,3].map(n=>({sourceId:source(n).id,sourceLineId:source(n).lines[0].id,qty:100,unit:'Yard',rollBarcodes:[source(n).lines[0].rolls[0].barcode]}))})
assert.equal(resolveFactoryReceiptScan(dl.barcode,'ID-F003').sources.length,3)
assert.equal(buildFactoryReceiptInboundRecords().length,0)
receive(input('FR-EXACT',1,[0]));receive(input('FR-SHORT',2,[0],80));receive(input('FR-OVER',3,[0],120));receive(input('FR-ZERO',4,[]))
assert.equal(getSourceActualReceipts(source(3).id)[0].qty,120)
assert.equal(getSourceActualReceipts(source(4).id)[0].qty,0)
assert.equal(buildFactoryReceiptInboundRecords().reduce((n,r)=>n+r.receivedQty,0),300)
receive(input('FR-EXACT',1,[0]));assert.equal(listFactoryReceipts().length,4)
assert.throws(()=>receive(input('FR-REPEAT',1,[0])),/已经接收/)
assert.throws(()=>receive({...input('FR-WRONG',1,[1]),factoryId:'ID-F002'}),/本厂/)
assert.throws(()=>receive({...input('FR-LOC',1,[1]),lines:[{...input('FR-LOC',1,[1]).lines[0],locationId:'DOES-NOT-EXIST'}]}),/库位/)
const prep=input('FR-PREP',5,[0,1,2,3]);receive(prep);receive(input('FR-PART2',5,[4,5]));receive(input('FR-PART3',5,[6,7,8,9]));assert.equal(getSourceActualReceipts(source(5).id).reduce((n,r)=>n+r.qty,0),1000)
receive(input('FR-PREP-BLUE',9,[1],200))
allocateFactoryReceivedMaterial({id:'ALLOC-1',receiptLineId:'FR-PREP-BLUE-L1',dyeOrderId:'DWO-001',qty:200,operatorName:'hilon',at:'2026-09-11 12:00:00'})
assert.throws(()=>allocateFactoryReceivedMaterial({id:'ALLOC-2',receiptLineId:'FR-PREP-BLUE-L1',dyeOrderId:'DWO-001',qty:1,operatorName:'hilon',at:'2026-09-11 12:00:00'}),/分配数量/)
const accessory=input('FR-ACC',6,[]);accessory.lines=[{sourceId:source(6).id,sourceLineId:source(6).lines[0].id,...pos,weightKg:12.345}];assert.equal(receive(accessory).lines[0].qty,12.345)
const yarn=input('FR-YARN',8,[]);yarn.lines=[{sourceId:source(8).id,sourceLineId:source(8).lines[0].id,...pos,pcs:19,grossKg:11.4,tubes:{PAPER:0,CONICAL:0,PAGODA:19}}];assert.equal(receive(yarn).lines[0].qty,9.101)
const before=listFactoryReceipts().length;fail=true;assert.throws(()=>receive(input('FR-FAIL',9,[0])),/保存失败/);fail=false;assert.equal(listFactoryReceipts().length,before);assert(!buildFactoryReceiptInboundRecords().some(r=>r.inboundRecordId.includes('FR-FAIL')))
clearFactoryReceivingCache();assert.equal(listFactoryReceipts().length,before);assert.equal(getSourceActualReceipts(source(4).id)[0].qty,0);assert(storage.get(FACTORY_RECEIVING_KEY))
approveFactoryTransfer(source(11).id,'主管 Budi','2026-09-11 12:00:00');confirmFactorySourceHandout(source(12).id,'dewi','2026-09-11 12:10:00');assert.equal(listFactoryReceivingSources().length,15)
console.log('PASS factory receiving: eligible sources, real image fields, mixed delivery, short/over/zero, rolls, positions, incremental stock, allocation, grams, idempotence, failed save, reload')

// Independent complete-delivery and split-delivery scenarios use fresh demo storage.
storage.clear();clearFactoryReceivingCache()
const full=createFactoryDeliveryNote({id:'S01-FULL',deliveredAt:'2026-09-11 09:00:00',createdBy:'Sari',lines:[1,2].map(n=>({sourceId:source(n).id,sourceLineId:source(n).lines[0].id,qty:400,unit:'Yard',rollBarcodes:source(n).lines[0].rolls.map(r=>r.barcode)}))})
const fullInput:FactoryReceiptInput={...input('S01-RECEIPT',1,[0,1,2,3]),deliveryId:full.id,lines:[1,2].map((n,i)=>({...input('unused',n,[0,1,2,3]).lines[0],deliveryLineId:full.lines[i].id}))}
receive(fullInput);assert.equal(buildFactoryReceiptInboundRecords().length,8);assert.equal(buildFactoryReceiptInboundRecords().reduce((n,r)=>n+r.receivedQty,0),800)
assert.throws(()=>receive({...fullInput,remark:'修改已确认内容'}),/同一确认号/)
const deliveries=[[0,1,2,3,4,5],[6,7,8,9]].map((indexes,i)=>createFactoryDeliveryNote({id:`S05-BATCH-${i+1}`,deliveredAt:'2026-09-11 10:00:00',createdBy:'Sari',lines:[{sourceId:source(5).id,sourceLineId:source(5).lines[0].id,qty:indexes.length*100,unit:'Yard',rollBarcodes:indexes.map(n=>source(5).lines[0].rolls[n].barcode)}]}))
for(const [index,rollIndexes] of [[0,[0,1,2,3]],[0,[4,5]],[1,[6,7,8,9]]] as [number,number[]][]){const base=input(`S05-${rollIndexes[0]}`,5,rollIndexes);receive({...base,deliveryId:deliveries[index].id,lines:base.lines.map(l=>({...l,deliveryLineId:deliveries[index].lines[0].id}))})}
assert.equal(getSourceActualReceipts(source(5).id).reduce((n,r)=>n+r.qty,0),1000);assert.equal(buildFactoryReceiptInboundRecords().filter(r=>r.sourceRecordNo===source(5).documentNo).length,10)
assert.throws(()=>receive({...input('WRONG-LINE',1,[0]),lines:[{...input('unused',1,[0]).lines[0],sourceLineId:source(2).lines[0].id}]}),/原单/)
assert.throws(()=>receive({...input('BLANK',6,[]),lines:[{sourceId:source(6).id,sourceLineId:source(6).lines[0].id,...pos}]}),/请填写实收重量/)
console.log('PASS S01 2 originals / 8 rolls / 800 Yard; S05 600+400 delivery, 400+200+400 receipts exactly once; changed-confirmation and blank/source mismatch blocked')

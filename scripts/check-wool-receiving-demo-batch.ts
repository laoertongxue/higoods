import assert from 'node:assert/strict'
import { captureFactoryReceivingData, restoreFactoryReceivingData, initializeFactoryReceivingDemoBatch, registerFactoryReceivingSource, prepareFactoryReceipt, savePreparedFactoryReceipt, getDefaultFactoryReceiptPosition, FACTORY_RECEIVING_KEY } from '../src/data/fcs/factory-receiving.ts'
const original=captureFactoryReceivingData(), source=structuredClone(original.sources.find(s=>s.lines[0]?.material.kind==='YARN')!)
source.id='BATCH-TEST';source.documentNo='BATCH-TEST';source.targetFactoryId='OWN_WOOL_FACTORY';source.targetFactoryName='周哥毛织厂';source.type='TRANSFER';source.approvedAt='2026-09-18 08:00:00';delete source.originalRecordId
source.lines=[{...source.lines[0],id:'BATCH-LINE',woolOrderId:undefined,dyeOrderId:undefined,printingOrderId:undefined,plannedQty:10,sentQty:10}]
const input={id:'BATCH-RECEIPT',factoryId:source.targetFactoryId,operatorId:'DEMO',operatorName:'演示仓管',receivedAt:'2026-09-18 09:00:00',remark:'',lines:[{sourceId:source.id,sourceLineId:source.lines[0].id,...getDefaultFactoryReceiptPosition(source.targetFactoryId),grossKg:1.062,pcs:1,tubes:{PAPER:1,CONICAL:0,PAGODA:0}}]}
const initial=(globalThis as any).window,raw=new Map<string,string>();let saves=0,fail=false
;(globalThis as any).window={localStorage:{getItem:(k:string)=>raw.get(k)||null,setItem:(k:string,v:string)=>{if(fail)throw Error('模拟磁盘满');raw.set(k,v);if(k===FACTORY_RECEIVING_KEY)saves++},removeItem:(k:string)=>raw.delete(k)}}
try {
 initializeFactoryReceivingDemoBatch(()=>{registerFactoryReceivingSource(source);savePreparedFactoryReceipt(prepareFactoryReceipt(input))})
 assert.equal(saves,1);assert.equal(captureFactoryReceivingData().receipts.find(r=>r.id===input.id)!.lines[0].qty,1)
 const saved=captureFactoryReceivingData(),stored=raw.get(FACTORY_RECEIVING_KEY)
 assert.throws(()=>initializeFactoryReceivingDemoBatch(()=>{registerFactoryReceivingSource({...source,id:'BAD-SOURCE',lines:[{...source.lines[0],id:'BAD-LINE'}]});throw Error('模拟中途失败')}),/中途/)
 assert.deepEqual(captureFactoryReceivingData(),saved);assert.equal(raw.get(FACTORY_RECEIVING_KEY),stored)
 fail=true;assert.throws(()=>initializeFactoryReceivingDemoBatch(()=>registerFactoryReceivingSource({...source,id:'DISK-SOURCE',lines:[{...source.lines[0],id:'DISK-LINE'}]})),/磁盘满/);fail=false
 assert.deepEqual(captureFactoryReceivingData(),saved);assert.equal(raw.get(FACTORY_RECEIVING_KEY),stored)
 console.log('PASS 演示收货批次单次持久化、普通数量验证、中途及存储失败均原子回退')
} finally {(globalThis as any).window=initial;restoreFactoryReceivingData(original)}

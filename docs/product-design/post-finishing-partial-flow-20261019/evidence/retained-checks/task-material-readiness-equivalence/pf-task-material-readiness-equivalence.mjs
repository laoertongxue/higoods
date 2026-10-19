import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root='/Users/laoer/.codex/worktrees/81b7/higoods';
const load=p=>import(root+'/'+p);
const {installPmsMemoryIdb}=await load('tests/helpers/pms-memory-idb.ts');
const memory=installPmsMemoryIdb();
globalThis.IDBKeyRange={bound:(lower,upper)=>({lower,upper})};
const open=indexedDB.open.bind(indexedDB),adapted=new WeakSet();
indexedDB.open=(...args)=>{const request=open(...args),db=request.result;if(!adapted.has(db)){adapted.add(db);const transaction=db.transaction.bind(db);db.transaction=(...args)=>{const tx=transaction(...args),objectStore=tx.objectStore.bind(tx);tx.objectStore=name=>{const s=objectStore(name);if(!s.add)s.add=s.put.bind(s);return s};return tx}}return request};
// Empty readonly PCS source fixture: the narrow Node helper lacks upgrade indexes.
await new Promise((ok,fail)=>{const r=indexedDB.open('higood-pcs-records',2);r.onupgradeneeded=()=>{for(const name of ['records','files','operations','meta'])r.result.createObjectStore(name,{keyPath:'id'})};r.onsuccess=()=>ok();r.onerror=()=>fail(r.error)});
const sources=await load('src/data/wls/accessory-warehouse-sources.ts');
const post=await load('src/data/wls/accessory-warehouse-post-finishing.ts');
const f=await load('src/data/fcs/post-finishing-full-flow.ts');
const records=await load('src/data/wls/accessory-warehouse-records.ts');
const {productionOrders}=await load('src/data/fcs/production-orders.ts');
const unknown='READINESS-NOT-A-PRODUCTION-SOURCE';
const output=[];
async function capture(stage,extra=[]){await post.prepareAccessoryPostFinishing();const preps=sources.listAccessoryPreparations();assert.ok(preps.length>0);const keys=[...new Set([...preps.flatMap(row=>[row.productionOrderId,row.productionOrderNo]),...f.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.flatMap(row=>[row.productionOrderId,row.productionOrderNo]),unknown,'',...extra])];output.push({stage,preparationCount:preps.length,values:keys.map(key=>({key,value:f.getPostFinishingMaterialReadiness(key)}))});return preps}
try {
 f.loadPostFinishingDemoData();const preps=await capture('actual-nonempty-sources-and-public-demo');assert.equal(preps.length,21);
 const first=preps[0],alias=first.productionOrderNo+'-READINESS-SAVED-ALIAS';const saved=records.accessoryRecord('preparation',first.id,{...structuredClone(first),productionOrderNo:alias});
 await records.saveAccessoryWarehouseAction({commandId:'READINESS-SAVED-ALIAS',intent:'valid saved alias',result:saved.id,change:{puts:[saved]}});await capture('saved-production-number-alias',[first.productionOrderNo,alias]);
 await records.saveAccessoryWarehouseAction({commandId:'READINESS-DELETE-SAVED-ALIAS',intent:'restore isolated fixture',result:saved.id,change:{puts:[],deletes:[saved.id]}});
 const live=productionOrders.find(row=>row.productionOrderId===first.productionOrderId);assert.ok(live);const before=live.productionOrderNo;
 try {live.productionOrderNo=before+'-READINESS-LIVE';await capture('current-live-production-number',[before,live.productionOrderNo])}finally{live.productionOrderNo=before}
 await capture('restored-source-currentness');
 const errors=[];Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:{getItem:()=>'{invalid-json'}}});
 try {for(const key of [unknown,first.productionOrderNo]){let message='';try{f.getPostFinishingMaterialReadiness(key)}catch(error){message=error.message}assert.match(message,/原配料资料格式损坏/);errors.push({key,message})}}finally{Reflect.deleteProperty(globalThis,'window')}
 let sticky='';try{f.getPostFinishingMaterialReadiness(unknown)}catch(error){sticky=error.message}assert.match(sticky,/原配料资料格式损坏/);errors.push({key:'restored-storage-still-sticky',message:sticky});
 await capture('explicit-source-reread-recovers');
 const bytes=JSON.stringify({errors,boundary:'Actual nonempty material projections and public saved-record commands via existing narrow Node memory helper; no browser transaction, physical operation or performance claim.',output});writeFileSync(process.argv[2],bytes);console.log(JSON.stringify({stages:output.length,queries:output.reduce((s,x)=>s+x.values.length,0),bytes:Buffer.byteLength(bytes),sha256:createHash('sha256').update(bytes).digest('hex')}));
} finally {memory.restore();Reflect.deleteProperty(globalThis,'IDBKeyRange')}

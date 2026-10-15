import { readPcsRecords, commitPcsRecords, pcsFileReferences, cleanupUnreferencedPcsFiles, type PcsStoredRecord, type PcsStoredFile } from '../pcs-record-db.ts'
import { WASHING_COLLECTION, WASHING_BRIDGE_COLLECTION, ensureWashingRecords, readWashingState } from './fabric-washing-repository.ts'
import { WASHING_HAND_FEELS, washingJudgmentId } from './fabric-washing-model.ts'
import { WASHING_LEGACY_KEYS } from './fabric-washing-storage-bridge.ts'
const scope=[WASHING_COLLECTION,WASHING_BRIDGE_COLLECTION]
export interface WashingBackup {format:'higood-fcs-fabric-washing';version:1;records:PcsStoredRecord[];files:Array<{id:string;type:string;base64:string}>}
/** Export the actual committed source association as a frozen backup snapshot.
 * The original production transaction continues to own the live matching fact. */
function withCommittedSourceLinks(records:PcsStoredRecord[]):PcsStoredRecord[]{
 const views=new Map(readWashingState().orders.map(order=>[order.id,order.source]))
 return records.map(record=>{
  const value=record.value as any,source=value?.kind==='orders'?views.get(value.data?.id):undefined
  if(record.collection!==WASHING_COLLECTION||!source)return record
  return {...record,value:{...value,data:{...value.data,source:{...value.data.source,productionOrderId:source.productionOrderId,techPackVersionId:source.techPackVersionId,target:source.target}}}}
 })
}
export async function washingStorageStats(){
 const [snapshot,estimate]=await Promise.all([readPcsRecords(scope),navigator.storage?.estimate?.()??Promise.resolve({usage:undefined,quota:undefined})])
 return {records:snapshot.records.length,files:snapshot.files.length,bytes:snapshot.files.reduce((n,f)=>n+f.blob.size,0),usage:estimate.usage,quota:estimate.quota}
}
export async function exportWashingBackup():Promise<WashingBackup>{
 const saved=await readPcsRecords(scope)
 const files=await Promise.all(saved.files.map(async f=>{const data=new Uint8Array(await f.blob.arrayBuffer());let binary='';for(let i=0;i<data.length;i+=16384)binary+=String.fromCharCode(...data.subarray(i,i+16384));return{id:f.id,type:f.blob.type,base64:btoa(binary)}}))
 return {format:'higood-fcs-fabric-washing',version:1,records:withCommittedSourceLinks(saved.records),files}
}
export function validateWashingBackup(value:unknown):{backup:WashingBackup;files:PcsStoredFile[]}{
 const b=value as WashingBackup
 if(!b||b.format!=='higood-fcs-fabric-washing'||b.version!==1||!Array.isArray(b.records)||!Array.isArray(b.files))throw new Error('水洗资料备份格式或版本不支持，原资料未改变。')
 const ids=new Set<string>(),fileIds=new Set<string>()
 const files=b.files.map(f=>{if(!f||typeof f.id!=='string'||!f.id||fileIds.has(f.id)||typeof f.base64!=='string'||typeof f.type!=='string')throw new Error('备份附件格式或编号无效。');fileIds.add(f.id);let binary:string;try{binary=atob(f.base64)}catch{throw new Error('备份附件字节损坏。')};return{id:f.id,blob:new Blob([Uint8Array.from(binary,c=>c.charCodeAt(0))],{type:f.type})}})
 for(const r of b.records){if(!r||!scope.includes(r.collection)||!r.id?.startsWith(r.collection+'/')||ids.has(r.id)||!Number.isSafeInteger(r.version)||r.version<1||(r.deleted!==undefined&&typeof r.deleted!=='boolean'))throw new Error('备份记录范围、版本或编号无效，未处理 PCS 资料。');ids.add(r.id);for(const id of pcsFileReferences(r.value))if(!fileIds.has(id))throw new Error('备份缺少被引用的附件。')}
 const data=b.records.filter(r=>r.collection===WASHING_COLLECTION).map(r=>r.value as any)
 for(const r of b.records){
  if(r.collection===WASHING_BRIDGE_COLLECTION){const v=r.value as any;if(!v||!WASHING_LEGACY_KEYS.includes(v.legacyKey)||!v.path||!v.key||r.id!==WASHING_BRIDGE_COLLECTION+'/'+encodeURIComponent(v.legacyKey)+'/'+encodeURIComponent(v.path+'/'+v.key))throw new Error('备份来源映射不完整。');continue}
  const v=r.value as any,d=v?.data
  if(!v||!['orders','judgments','actions'].includes(v.kind)||typeof d?.id!=='string'||r.id!==WASHING_COLLECTION+'/'+v.kind+'/'+encodeURIComponent(d.id))throw new Error('备份业务对象不完整。')
  if(v.kind==='orders'&&(!WASHING_HAND_FEELS.includes(d.handFeel)||d.source?.objectType!=='FABRIC'||!d.source?.printOrderId||!d.source?.batchId||!d.source?.materialSku||!Array.isArray(d.rolls)||!d.rolls.length||!Array.isArray(d.rollIds)||d.rollIds.length!==d.rolls.length||new Set(d.rollIds).size!==d.rollIds.length||d.rolls.some((roll:any)=>!d.rollIds.includes(roll.id)||roll.id!==roll.sourceRollId||!roll.barcode||!Number.isFinite(roll.inputQty)||roll.inputQty<=0||!roll.unit)||new Set(d.rolls.map((roll:any)=>roll.unit)).size!==1||!['UNASSIGNED','PENDING','ACCEPTED','REJECTED'].includes(d.acceptance)))throw new Error('备份水洗单的实物范围、手感或状态无效。')
  if(v.kind==='judgments'&&(d.id!==washingJudgmentId(d.printOrderId,d.rollId)||!['WASH','NO_WASH'].includes(d.decision)||!Array.isArray(d.history)||d.decision==='WASH'&&(!d.orderId||!WASHING_HAND_FEELS.includes(d.handFeel))))throw new Error('备份触摸判断无效。')
  if(v.kind==='actions'&&(!d.intent||!d.actor?.id||!Array.isArray(d.rollIds)||!d.action))throw new Error('备份动作记录不完整。')
 }
 const orderIds=new Set(data.filter(v=>v.kind==='orders').map(v=>v.data.id))
 for(const v of data)if(v.kind==='judgments'&&v.data.orderId&&!orderIds.has(v.data.orderId))throw new Error('备份缺少判断关联的水洗单。')
 return {backup:b,files}
}
export async function restoreWashingBackup(value:unknown){
 await ensureWashingRecords(true)
 const {backup,files}=validateWashingBackup(value),existing=await readPcsRecords(scope),old=new Map(withCommittedSourceLinks(existing.records).map(r=>[r.id,r])),known=new Map(existing.files.map(f=>[f.id,f]))
 for(const r of backup.records){const current=old.get(r.id);if(current&&JSON.stringify({...current,version:0})!==JSON.stringify({...r,version:0}))throw new Error('当前已有不同版本的同号记录，恢复已取消以保护原资料。')}
 for(const f of files){const current=known.get(f.id);if(current){const a=new Uint8Array(await current.blob.arrayBuffer()),b=new Uint8Array(await f.blob.arrayBuffer());if(a.length!==b.length||a.some((n,i)=>n!==b[i]))throw new Error('同号附件内容冲突，恢复已取消。')}}
 for(const file of files)if(file.id.startsWith('wash-file-')){const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.blob.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join('');if(file.id!=='wash-file-'+hash)throw new Error('备份附件内容与原文件指纹不符，未覆盖原资料。')}
 const puts=backup.records.filter(r=>!old.has(r.id)).map(({version,...r})=>({...r,expectedVersion:0}))
 if(!puts.length&&files.every(f=>known.has(f.id)))return 0
 await commitPcsRecords({guards:[...old.values()].map(r=>({id:r.id,expectedVersion:r.version})),puts,deletes:[],files:files.filter(f=>!known.has(f.id)),operationId:crypto.randomUUID(),intent:'restore-fcs-fabric-washing'})
 await ensureWashingRecords(true)
 const readBack=await exportWashingBackup();if(backup.records.some(r=>!readBack.records.some(s=>s.id===r.id&&JSON.stringify(s.value)===JSON.stringify(r.value))))throw new Error('恢复后回读不一致，请保留备份核对。')
 return puts.length
}
export async function cleanupWashingFiles(){return cleanupUnreferencedPcsFiles('wash-file-')}

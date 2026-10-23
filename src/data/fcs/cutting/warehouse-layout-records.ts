import { listFactoryInternalWarehouses, type FactoryInternalWarehouse, type FactoryInternalWarehouseKind } from '../factory-internal-warehouse-locations.ts'
import { ProductionContextReadError } from '../production-context-records.ts'
import { readCuttingRecords, readCuttingCommand, commitCuttingRecords, type CuttingRecordSnapshot, type CuttingStoredRecord } from './cutting-record-repository.ts'
import { cuttingRecordFingerprint as fingerprint } from './cutting-record-identity.ts'
import { buildInitialWarehouseLayoutSnapshot, installWarehouseLayoutRecordReadBridge, isWarehouseLayoutSnapshot, warehouseLayoutSourceKeys, type FactoryWarehouseLayoutSnapshot, type WarehouseLayoutChangeRecord } from '../../../pages/process-factory/cutting/warehouse-location-layout-store.ts'
import { layoutRecordId, layoutChangeRecordId, isWarehouseLayoutChange, validateWarehouseLayoutStoredRecords, type WarehouseLayoutMigration } from './warehouse-layout-record-contract.ts'

let view:CuttingStoredRecord[]|undefined
const clone=<T>(s:T):T=>structuredClone(s)
function nativeValue(key:string):string|null {try{return localStorage.getItem(key)}catch(cause){throw new ProductionContextReadError('本机库位资料无法读取，原资料已保留。',{cause})}}
function warehouseFor(s:Pick<FactoryWarehouseLayoutSnapshot,'factoryId'|'warehouseKind'|'warehouseId'>):FactoryInternalWarehouse {
 const w=listFactoryInternalWarehouses(s.factoryId).find(w=>w.warehouseId===s.warehouseId&&w.warehouseKind===s.warehouseKind)
 if(!w)throw new ProductionContextReadError('库位资料不属于当前仓库，原资料已保留。')
 return w
}
function assertOldSourceAbsent(w:FactoryInternalWarehouse):void {
 if(warehouseLayoutSourceKeys(w.factoryId,w.warehouseKind,w.warehouseId).some(key=>nativeValue(key)!==null))throw new ProductionContextReadError('发现本机旧库位配置或历史，请先迁移并读回核对。')
}
export function hydrateWarehouseLayoutRecords(snapshot:CuttingRecordSnapshot):void {validateWarehouseLayoutStoredRecords(snapshot.records);view=clone(snapshot.records.filter(row=>row.collection.startsWith('warehouse-layout')))}
function rows():CuttingStoredRecord[]{if(!view)throw new ProductionContextReadError('库位记录尚未读取，请重新进入页面。');return view}
export function readCuttingWarehouseLayout(w:FactoryInternalWarehouse):FactoryWarehouseLayoutSnapshot {
 assertOldSourceAbsent(w)
 const saved=rows().find(row=>row.id===layoutRecordId(w))
 if(saved){if(!isWarehouseLayoutSnapshot(saved.value,w))throw new ProductionContextReadError('库位资料与当前仓库结构不一致，原资料已保留。');return clone(saved.value)}
 if(rows().some(row=>row.collection==='warehouse-layout-changes'&&(row.value as WarehouseLayoutChangeRecord).factoryId===w.factoryId&&(row.value as WarehouseLayoutChangeRecord).warehouseKind===w.warehouseKind&&(row.value as WarehouseLayoutChangeRecord).warehouseId===w.warehouseId))throw new ProductionContextReadError('当前库位配置缺失，修改历史已保留，请先核对。')
 return buildInitialWarehouseLayoutSnapshot(w,'系统初始化')
}
export function readCuttingWarehouseLayoutHistory(factoryId:string,kind:FactoryInternalWarehouseKind,warehouseId:string):WarehouseLayoutChangeRecord[]{
 const w=warehouseFor({factoryId,warehouseKind:kind,warehouseId});assertOldSourceAbsent(w)
 return clone(rows().filter(row=>row.collection==='warehouse-layout-changes').map(row=>row.value as WarehouseLayoutChangeRecord).filter(s=>s.factoryId===factoryId&&s.warehouseKind===kind&&s.warehouseId===warehouseId).sort((a,b)=>b.afterVersion-a.afterVersion).slice(0,100))
}
installWarehouseLayoutRecordReadBridge({read:readCuttingWarehouseLayout,history:readCuttingWarehouseLayoutHistory})

/** Configuration and its existing 100-entry audit history commit in the same database as cutting facts. */
export async function saveCuttingWarehouseLayout(next:FactoryWarehouseLayoutSnapshot,expectedVersion:number,operationId:string,signal?:AbortSignal):Promise<FactoryWarehouseLayoutSnapshot>{
 if(signal?.aborted)throw new DOMException('本次保存已取消。','AbortError')
 if(!operationId)throw new Error('本次操作编号缺失，请重新核对。')
 const w=warehouseFor(next)
 if(!isWarehouseLayoutSnapshot(next,w)||next.layoutVersion!==expectedVersion+1)throw new Error('库位配置或版本不完整，请重新核对。')
 const intent=JSON.stringify({next,expectedVersion}),id=`warehouse-layout:${operationId}`,prior=await readCuttingCommand(id)
 if(prior){if(prior.intent!==intent)throw new Error('本次操作编号已用于其他内容，请重新读取。');hydrateWarehouseLayoutRecords(await readCuttingRecords());return clone(prior.result as FactoryWarehouseLayoutSnapshot)}
 const snapshot=await readCuttingRecords();hydrateWarehouseLayoutRecords(snapshot)
 const current=readCuttingWarehouseLayout(w)
 if(current.layoutVersion!==expectedVersion)throw new Error('库位图已被更新，请重新读取后核对。')
 const change:WarehouseLayoutChangeRecord={changeRecordId:`${next.factoryId}:${next.warehouseKind}:v${next.layoutVersion}:${next.updatedAt}`,factoryId:next.factoryId,warehouseKind:next.warehouseKind,warehouseId:next.warehouseId,beforeVersion:expectedVersion,afterVersion:next.layoutVersion,beforeSnapshot:current,afterSnapshot:clone(next),updatedAt:next.updatedAt,updatedBy:next.updatedBy}
 const puts:CuttingStoredRecord[]=[{id:layoutRecordId(next),collection:'warehouse-layouts',value:clone(next)},{id:layoutChangeRecordId(change),collection:'warehouse-layout-changes',value:change}]
 validateWarehouseLayoutStoredRecords(puts)
 const history=[...snapshot.records.filter(row=>row.collection==='warehouse-layout-changes'&&(row.value as WarehouseLayoutChangeRecord).factoryId===w.factoryId&&(row.value as WarehouseLayoutChangeRecord).warehouseKind===w.warehouseKind&&(row.value as WarehouseLayoutChangeRecord).warehouseId===w.warehouseId),puts[1]].sort((a,b)=>(b.value as WarehouseLayoutChangeRecord).afterVersion-(a.value as WarehouseLayoutChangeRecord).afterVersion)
 const deletes=history.slice(100).map(row=>row.id)
 const base=JSON.stringify(w)
 await commitCuttingRecords({revision:snapshot.revision,change:{puts,deletes},signal,assertSourcesCurrent:()=>{assertOldSourceAbsent(w);if(JSON.stringify(warehouseFor(next))!==base)throw new Error('仓库主数据已变化，请重新读取。')},command:{id,intent,result:clone(next),at:new Date().toISOString()}})
 // The transaction has completed. Publish only these committed rows; a view read is not another save.
 const merged=new Map(rows().filter(row=>!deletes.includes(row.id)).map(row=>[row.id,row]));for(const row of puts)merged.set(row.id,row);view=[...merged.values()]
 return clone(next)
}

async function verifyTargets(job:WarehouseLayoutMigration):Promise<void>{const snapshot=await readCuttingRecords(),map=new Map(snapshot.records.map(row=>[row.id,row]));const targets=job.recordIds.map(id=>map.get(id));if(targets.some(row=>!row)||await fingerprint(JSON.stringify(targets))!==job.contentFingerprint)throw new Error('库位迁移目标已变化，旧资料未清理。')}
async function finishMigration(row:CuttingStoredRecord<WarehouseLayoutMigration>):Promise<void>{
 const job=row.value;await verifyTargets(job)
 const keys=warehouseLayoutSourceKeys(job.factoryId,job.warehouseKind,job.warehouseId)
 if(keys.some(key=>!job.sources.some(source=>source.key===key)&&nativeValue(key)!==null))throw new Error('迁移期间出现了其他旧库位版本，原资料已保留。')
 for(const source of job.sources){const raw=nativeValue(source.key);if(raw!==null&&await fingerprint(raw)!==source.fingerprint)throw new Error('旧库位资料在迁移期间变化，原资料已保留。')}
 for(const source of job.sources){const raw=nativeValue(source.key);if(raw!==null){if(await fingerprint(raw)!==source.fingerprint)throw new Error('旧库位资料在清理前变化，原资料已保留。');localStorage.removeItem(source.key)}}
 if(keys.some(key=>nativeValue(key)!==null))throw new Error('旧页面重新写入库位资料，迁移尚未完成。')
 const snapshot=await readCuttingRecords();await commitCuttingRecords({revision:snapshot.revision,change:{puts:[{...row,value:{...job,phase:'COMPLETE'}}]},assertSourcesCurrent:()=>{if(keys.some(key=>nativeValue(key)!==null))throw new Error('旧库位资料重新出现，未标记完成。')},command:{id:`${job.id}:complete`,intent:job.contentFingerprint,result:true,at:new Date().toISOString()}})
}
/** Explicit migration only; normal reads never copy or clean legacy configuration. */
export async function migrateLegacyWarehouseLayouts(input:{otherPagesClosed:boolean;progress:(message:string)=>void}):Promise<number>{
 if(!input.otherPagesClosed)throw new Error('请先关闭其他 HiGood 页面并确认；旧库位资料尚未清理。')
 const initial=await readCuttingRecords();validateWarehouseLayoutStoredRecords(initial.records)
 for(const row of initial.records.filter(row=>row.collection==='warehouse-layout-migrations'&&(row.value as WarehouseLayoutMigration).phase==='VERIFIED'))await finishMigration(row as CuttingStoredRecord<WarehouseLayoutMigration>)
 let migrated=0
 for(const w of listFactoryInternalWarehouses()){
  const keys=warehouseLayoutSourceKeys(w.factoryId,w.warehouseKind,w.warehouseId),values=keys.map(key=>nativeValue(key))
  if(!values.some(raw=>raw!==null))continue
  if(values.slice(2).some(raw=>raw!==null))throw new Error('发现旧版库位编排，不能按现行v3格式自动转换；原资料已保留。')
  if(values[0]===null)throw new Error('旧库位资料只有历史、缺少当前配置，原资料已保留。')
  let layout:unknown,history:unknown
  try{layout=JSON.parse(values[0]!);history=values[1]===null?[]:JSON.parse(values[1]!)}catch{throw new Error('旧库位配置或历史格式不完整，原资料未覆盖。')}
  if(!isWarehouseLayoutSnapshot(layout,w)||!Array.isArray(history)||history.some(s=>!isWarehouseLayoutChange(s)||s.factoryId!==w.factoryId||s.warehouseKind!==w.warehouseKind||s.warehouseId!==w.warehouseId))throw new Error('旧库位配置或历史与当前仓库不一致，原资料已保留。')
  const targets:CuttingStoredRecord[]=[{id:layoutRecordId(layout),collection:'warehouse-layouts',value:layout},...history.map(value=>({id:layoutChangeRecordId(value),collection:'warehouse-layout-changes',value}))]
  if(new Set(targets.map(row=>row.id)).size!==targets.length)throw new Error('旧库位历史编号重复，原资料已保留。')
  validateWarehouseLayoutStoredRecords(targets)
  const sources=await Promise.all(values.slice(0,2).map(async(raw,i)=>raw===null?null:{key:keys[i],fingerprint:await fingerprint(raw)})),activeSources=sources.filter((s):s is NonNullable<typeof s>=>s!==null)
  const digest=await fingerprint(JSON.stringify(activeSources)),id=`warehouse-layout-migration:${digest}`
  const snapshot=await readCuttingRecords(),existing=new Map(snapshot.records.map(row=>[row.id,row]))
  if(targets.some(row=>existing.has(row.id)&&JSON.stringify(existing.get(row.id))!==JSON.stringify(row)))throw new Error('旧库位资料与记录库版本冲突，双方资料均已保留。')
  const job:WarehouseLayoutMigration={id,phase:'VERIFIED',factoryId:w.factoryId,warehouseKind:w.warehouseKind,warehouseId:w.warehouseId,sources:activeSources,recordIds:targets.map(row=>row.id),contentFingerprint:await fingerprint(JSON.stringify(targets))}
  const row:CuttingStoredRecord<WarehouseLayoutMigration>={id,collection:'warehouse-layout-migrations',value:job}
  await commitCuttingRecords({revision:snapshot.revision,change:{puts:[...targets.filter(row=>!existing.has(row.id)),row]},assertSourcesCurrent:()=>{if(keys.some((key,i)=>nativeValue(key)!==values[i]))throw new Error('旧库位资料在保存前变化，未清理。')},command:{id:`${id}:copy`,intent:job.contentFingerprint,result:targets.length,at:new Date().toISOString()}})
  await finishMigration(row);migrated++;input.progress(`已核对库位 ${w.factoryId} / ${w.warehouseKind}，旧源已清理。`)
 }
 hydrateWarehouseLayoutRecords(await readCuttingRecords());return migrated
}

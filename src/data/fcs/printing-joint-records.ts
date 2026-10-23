import { readPcsRecords, type PcsStoredRecord } from '../pcs-record-db.ts'
import { runPcsRecordCommand, type PcsJoinedPrintWrites } from '../pcs-record-runtime.ts'
import { PCS_FCS_COLLECTIONS, getDesignRevisionFcsStorage, getDesignRevisionLedgerRows } from './design-revision-pcs-storage.ts'
import { CENTRAL_EXECUTION_COLLECTIONS, SPECIAL_CRAFT_RECORDS, SPECIAL_CRAFT_LEDGER_RECORDS, CENTRAL_EXECUTION_COMMAND_GUARDS } from './central-execution-record-bridge.ts'
import { ensureSpecialCraftRecords } from './special-craft-records.ts'
import { ensureWashingRecords, WASHING_BRIDGE_COLLECTION } from './fabric-washing-repository.ts'
import { WASHING_LEGACY_KEYS, getWashingLedgerSnapshot, splitWashingLedger, rebuildWashingLedger, sameProcessLedgerRow, withWashingStaticRead, withPrintingLedgerStage, withDyeingLedgerStage, type ProcessLedgerRow } from './fabric-washing-storage-bridge.ts'

const identity=(key:string,row:Pick<ProcessLedgerRow,'path'|'key'>)=>JSON.stringify([key,row.path,row.key])
type Owner={record:PcsStoredRecord;pcs:boolean;legacyKey:string;path:string;key:string}
function ownerOf(record:PcsStoredRecord):Owner|undefined {
 const bridge=record.value as ProcessLedgerRow&{legacyKey?:string}
 if([SPECIAL_CRAFT_LEDGER_RECORDS,WASHING_BRIDGE_COLLECTION].includes(record.collection)&&bridge?.legacyKey&&WASHING_LEGACY_KEYS.includes(bridge.legacyKey))return{record,pcs:false,legacyKey:bridge.legacyKey,path:bridge.path,key:bridge.key}
 const index=PCS_FCS_COLLECTIONS.findIndex(key=>record.collection===key+'/items')
 if(index<0)return undefined
 const row=(record.value as {data?:ProcessLedgerRow})?.data
 if(row?.path&&row.key)return{record,pcs:true,legacyKey:WASHING_LEGACY_KEYS[index],path:row.path,key:row.key}
 if(record.deleted){
  const local=decodeURIComponent(record.id.slice((PCS_FCS_COLLECTIONS[index]+'/items/').length)),split=local.indexOf('/')
  if(split>0)return{record,pcs:true,legacyKey:WASHING_LEGACY_KEYS[index],path:local.slice(0,split),key:decodeURIComponent(local.slice(split+1))}
 }
 return undefined
}

/** Fixed printing and dyeing adapters share the existing native PCS transaction.
 * Original rows retain their collection/id/version; neither adapter copies owners. */
export function runJoinedPrintingRecordCommand<T>(target:unknown,orderIds:readonly string[],recipe:()=>T,operationId:string,intent:string):Promise<T> {
 return runJoinedProcessRecordCommand('print',target,orderIds,recipe,operationId,intent)
}
export function runJoinedDyeingRecordCommand<T>(target:unknown,orderIds:readonly string[],recipe:()=>T,operationId:string,intent:string):Promise<T> {
 return runJoinedProcessRecordCommand('dye',target,orderIds,recipe,operationId,intent)
}
/** Unassigned Print supplies still use their existing source/receipt owners. */
export async function runPrintingPreparationRecordCommand<T>(sourceIds: readonly string[], recipe: () => T, operationId: string, intent: string): Promise<T> {
 if (!sourceIds.length) throw new Error('来料不存在，请重新读取。')
 await ensureSpecialCraftRecords(true)
 return runJoinedProcessRecordCommand('print', {sourceIds}, [], recipe, operationId, intent, sourceIds.map(id => 'print/source/' + id), sourceIds)
}
async function runJoinedProcessRecordCommand<T>(kind:'print'|'dye',target:unknown,orderIds:readonly string[],recipe:()=>T,operationId:string,intent:string,extraGuards:readonly string[]=[],sourceIds:readonly string[]=[]):Promise<T> {
 const operation=kind==='print'?'印花':'染色',ledgerKey=kind==='print'?'higoods.formal-print-execution.v1':'higoods.formal-dye-execution.v1'
 await ensureWashingRecords(true)
 const saved=await readPcsRecords([...CENTRAL_EXECUTION_COLLECTIONS,WASHING_BRIDGE_COLLECTION,...PCS_FCS_COLLECTIONS]),records=new Map(saved.records.map(row=>[row.id,row]))
 const commandId=`${SPECIAL_CRAFT_RECORDS}/commands/${encodeURIComponent(operationId)}`,previous=records.get(commandId)?.value as {intent:string;result:T}|undefined
 if(previous){if(previous.intent!==intent)throw new Error('本次确认号已用于其他填写，请重新打开操作。');return structuredClone(previous.result)}
 const owners=new Map<string,Owner>()
 for(const record of saved.records){const owner=ownerOf(record);if(!owner)continue;const key=identity(owner.legacyKey,owner)
  if(owners.has(key))throw new Error('同一加工资料存在多个保存来源，未覆盖原记录，请先核对。')
  owners.set(key,owner)
 }
 const initial=new Map(WASHING_LEGACY_KEYS.map(key=>[key,withWashingStaticRead(()=>getWashingLedgerSnapshot(key))??getDesignRevisionFcsStorage().getItem(key)]))
 const pending=new Map<string,string>(),joined:PcsJoinedPrintWrites={puts:[],guards:[],intent,rereadCollections:PCS_FCS_COLLECTIONS,committedFailure:`${operation}操作已保存，但页面未能更新，请重新读取后查看。`}
 for(const id of orderIds){
  const owner=owners.get(identity(ledgerKey,{path:'state.workOrders',key:id}))
  if(owner)joined.guards.push({id:owner.record.id,expectedVersion:owner.record.version})
  const key=kind+'/'+id,marker=`${CENTRAL_EXECUTION_COMMAND_GUARDS}/${encodeURIComponent(key)}`
  joined.puts.push({id:marker,collection:CENTRAL_EXECUTION_COMMAND_GUARDS,value:{key,operationId},expectedVersion:records.get(marker)?.version||0})
 }
 for (const key of new Set(extraGuards)) {
  const marker=`${CENTRAL_EXECUTION_COMMAND_GUARDS}/${encodeURIComponent(key)}`
  joined.puts.push({id:marker,collection:CENTRAL_EXECUTION_COMMAND_GUARDS,value:{key,operationId},expectedVersion:records.get(marker)?.version||0})
 }
 const pcsRaw=(key:string,raw:string)=>rebuildWashingLedger(raw,splitWashingLedger(raw).filter(row=>{const owner=owners.get(identity(key,row));return owner&&!owner.pcs}).map(row=>({...row,deleted:true})))!
 const stage=kind==='print'?withPrintingLedgerStage:withDyeingLedgerStage
 await runPcsRecordCommand(()=>stage(pending,pcsRaw,()=>{
  const result=recipe()
  if(result&&typeof(result as {then?:unknown}).then==='function')throw new Error(`先完成资料读取，再保存${operation}动作。`)
  for(const [key,raw]of pending){
   const before=new Map(splitWashingLedger(initial.get(key)??null).map(row=>[identity(key,row),row])),after=new Map(splitWashingLedger(raw).map(row=>[identity(key,row),row]))
   const selected=new Set(getDesignRevisionLedgerRows(key).map(row=>identity(key,row)))
   const append=(row:ProcessLedgerRow,deleted=false)=>{
    const rowKey=identity(key,row),owner=owners.get(rowKey)
    if(owner?.pcs||!owner&&selected.has(rowKey))return
    const id=owner?.record.id??`${SPECIAL_CRAFT_LEDGER_RECORDS}/${encodeURIComponent(key)}/${encodeURIComponent(row.path+'/'+row.key)}`
    joined.puts.push({id,collection:owner?.record.collection??SPECIAL_CRAFT_LEDGER_RECORDS,value:{...row,legacyKey:key,...(deleted?{deleted:true}:{})},...(deleted?{deleted:true}:{}),expectedVersion:owner?.record.version||0})
   }
   for(const [id,row]of after)if(!sameProcessLedgerRow(row,before.get(id)))append(row)
   // Only direct sources of this receipt are retained for independent cold reads.
   // Existing PCS/common/historical owners are not copied or moved.
   if (key === 'higood-factory-material-receiving-v1') for (const row of after.values()) {
    if (row.path !== 'sources' || !sourceIds.includes(row.key)) continue
    const owner = owners.get(identity(key, row))
    if (!owner && sameProcessLedgerRow(row, before.get(identity(key, row)))) append(row)
    else if (owner && !joined.puts.some(put => put.id === owner.record.id)) joined.guards.push({id:owner.record.id,expectedVersion:owner.record.version})
   }
   for(const [id,row]of before)if(!after.has(id))append(row,true)
  }
  joined.puts.push({id:commandId,collection:SPECIAL_CRAFT_RECORDS,value:{intent,result,...(typeof target==='string'?{target}:{})},expectedVersion:0})
  return result
 }),operationId,PCS_FCS_COLLECTIONS,[],joined)
 // Read the committed command result even if another tab won the same operation.
 // The native recipe's newly issued document number is not proof of the writer.
 try{
  await ensureSpecialCraftRecords(true);await ensureWashingRecords(true)
  const command=(await readPcsRecords([SPECIAL_CRAFT_RECORDS])).records.find(row=>row.id===commandId)?.value as {intent:string;result:T}|undefined
  if(!command||command.intent!==intent)throw new Error('原确认结果尚未读回。')
  return structuredClone(command.result)
 }catch{throw Object.assign(new Error(`${operation}操作已保存，但页面未能更新，请重新读取后查看。`),{committed:true})}
}

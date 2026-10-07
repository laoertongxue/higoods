/** DDS follow-ups and forecasts only. No demonstration seed copies or source/config writes. */
export interface FollowupRecord {id:string;taskId:string;nodeId:string;author:string;at:string;reason:string;action:string;expectedAt:string;kind:string}
export interface ForecastRecord {id:string;taskId:string;nodeId:string;endAt:string;version:number}
interface ForecastEvent {operationId:string;sequence?:number;taskId:string;nodeId:string;endAt:string;legacyOrder?:number}
const DATABASE='higood-dds-followups',legacyKeys=['dds-pf-followups-v1','dds-pf-forecasts-v1'] as const
let opening:Promise<IDBDatabase>|undefined
let cache:{followups:FollowupRecord[];forecasts:ForecastRecord[];events:ForecastEvent[]}={followups:[],forecasts:[],events:[]}
let state={loaded:false,error:'',legacyCount:0,legacyWarning:''}
let readGeneration=0
export function followupStorageState(){return {...state}}
export function readFollowups():FollowupRecord[]{return cache.followups}
export function readForecasts():ForecastRecord[]{return cache.forecasts}
export function readForecastHistory():ForecastEvent[]{return cache.events.slice().sort((a,b)=>a.legacyOrder!==undefined&&b.legacyOrder!==undefined?a.legacyOrder-b.legacyOrder:a.legacyOrder!==undefined?-1:b.legacyOrder!==undefined?1:(a.sequence||0)-(b.sequence||0))}
function message(error:unknown):string {
  if((error as {name?:string})?.name==='QuotaExceededError')return '空间不足，本次未保存；请保留输入，空间恢复后重试。'
  if((error as {name?:string})?.name==='AbortError')return '保存事务已中止，原有记录不变，请保留输入后重试。'
  if(typeof DOMException!=='undefined'&&error instanceof DOMException)return '跟进资料无法读取或保存，请保留输入，重新读取后重试。'
  return error instanceof Error?error.message:'跟进资料无法读取或保存，请保留输入后重试。'
}
function open():Promise<IDBDatabase> {
  if(opening)return opening
  opening=new Promise<IDBDatabase>((resolve,reject)=>{
    if(typeof indexedDB==='undefined'){reject(new Error('跟进资料无法读取或保存，请重新读取；当前展示来源业务事实。'));return}
    const req=indexedDB.open(DATABASE,2);let blocked=false
    req.onupgradeneeded=()=>{
      for(const name of ['followups','forecasts'])if(!req.result.objectStoreNames.contains(name))req.result.createObjectStore(name,{keyPath:'id'})
      if(!req.result.objectStoreNames.contains('forecast-events'))req.result.createObjectStore('forecast-events',{keyPath:'sequence',autoIncrement:true}).createIndex('operationId','operationId',{unique:true})
    }
    req.onblocked=()=>{blocked=true;reject(new Error('跟进数据库被旧页面阻塞，请关闭其他 DDS 页面后重新读取。'))}
    req.onerror=()=>reject(req.error)
    req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>{db.close();opening=undefined};if(blocked)db.close();else resolve(db)}
  }).catch(error=>{opening=undefined;throw error})
  return opening
}
function result<T>(req:IDBRequest<T>):Promise<T>{return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function transaction<T>(mode:IDBTransactionMode,action:(tx:IDBTransaction)=>Promise<T>):Promise<T> {
  const db=await open(),tx=db.transaction(['followups','forecasts','forecast-events'],mode)
  const complete=new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error||new Error('保存事务已中止，原有记录不变，请保留输入后重试。'))})
  complete.catch(()=>undefined)
  try{const value=await action(tx);await complete;return value}catch(error){try{tx.abort()}catch{}await complete.catch(()=>undefined);throw new Error(message(error))}
}
function validateFollowup(value:unknown):asserts value is FollowupRecord {
  const row=value as FollowupRecord
  if(!row||!['id','taskId','author','at','reason','action','kind'].every(key=>typeof (row as unknown as Record<string,unknown>)[key]==='string'&&Boolean((row as unknown as Record<string,string>)[key].trim()))||typeof row.nodeId!=='string'||typeof row.expectedAt!=='string'||!Number.isFinite(Date.parse(row.at)))throw new Error('跟进记录格式不完整；旧资料保留，请核对后重试。')
}
function validateForecast(value:unknown):asserts value is ForecastRecord {
  const row=value as ForecastRecord
  if(!row||!['id','taskId','nodeId','endAt'].every(key=>typeof (row as unknown as Record<string,unknown>)[key]==='string')||row.id!==row.taskId+'/'+row.nodeId||!Number.isFinite(Date.parse(row.endAt))||!Number.isSafeInteger(row.version)||row.version<1)throw new Error('预计记录无法读取，请保留已有资料后核对。')
}
function legacy(){return legacyKeys.map(key=>({key,text:globalThis.localStorage.getItem(key)}))}
export async function loadFollowups():Promise<void> {
  const generation=++readGeneration
  try{
    const bundle=await transaction('readonly',async tx=>({followups:await result(tx.objectStore('followups').getAll()) as FollowupRecord[],forecasts:await result(tx.objectStore('forecasts').getAll()) as ForecastRecord[],events:await result(tx.objectStore('forecast-events').getAll()) as ForecastEvent[]}))
    if(generation!==readGeneration)return
    bundle.followups.forEach(validateFollowup);bundle.forecasts.forEach(validateForecast)
    for(const event of bundle.events)if(!event.operationId||!event.taskId||!event.nodeId||!Number.isFinite(Date.parse(event.endAt))||!Number.isSafeInteger(event.sequence))throw new Error('预计调整历史无法读取，请保留已有资料后核对。')
    cache=bundle;state.loaded=true;state.error=''
  }catch(error){if(generation!==readGeneration)return;state.error=message(error);state.loaded=false}
  state.legacyCount=0;state.legacyWarning=''
  try{for(const source of legacy()){if(source.text){const records:unknown=JSON.parse(source.text);if(!Array.isArray(records))throw new Error('旧跟进资料格式无法识别，已保留原资料。');state.legacyCount+=records.length}}}catch(error){state.legacyWarning='旧资料无法检查：'+message(error)}
}
/** Append-only follow-up ID deduplicates retries; mutable forecast is guarded within the same transaction. */
export async function saveFollowup(record:FollowupRecord,forecast?:{endAt:string;expectedVersion:number}):Promise<void> {
  validateFollowup(record)
  if(!state.loaded)throw new Error('跟进资料尚未成功读取，请重新读取后保存；当前输入保留。')
  if(forecast&&(!record.nodeId||!Number.isFinite(Date.parse(forecast.endAt))))throw new Error('预计结束时间或对应工作无效。')
  await transaction('readwrite',async tx=>{
    const logs=tx.objectStore('followups'),existing=await result(logs.get(record.id)) as FollowupRecord|undefined
    if(existing){if(JSON.stringify(existing)!==JSON.stringify(record))throw new Error('操作编号冲突，请关闭表单后重新登记。');return}
    if(forecast){const store=tx.objectStore('forecasts'),id=record.taskId+'/'+record.nodeId,old=await result(store.get(id)) as ForecastRecord|undefined
      if((old?.version||0)!==forecast.expectedVersion)throw new Error('其他页面已修改此工作的预计结束，请重新读取后确认；本次未保存。')
      store.put({id,taskId:record.taskId,nodeId:record.nodeId,endAt:forecast.endAt,version:forecast.expectedVersion+1})
      tx.objectStore('forecast-events').add({operationId:record.id,taskId:record.taskId,nodeId:record.nodeId,endAt:forecast.endAt})}
    logs.put(record)
  })
  await loadFollowups()
  if(state.error)throw new Error('记录已提交，但读回失败；请重新读取确认。'+state.error)
}
/** Explicit migration: validate all, write bounded batches, read back, compare unchanged legacy bytes, then remove those two keys. */
export async function migrateLegacyFollowups(oldPagesClosed:boolean):Promise<void> {
  if(!oldPagesClosed)throw new Error('请先关闭其他旧版本 DDS 页面，避免迁移期间旧页面继续保存。')
  const sources=legacy(),followups:FollowupRecord[]=JSON.parse(sources[0].text||'[]'),rawForecasts:unknown=JSON.parse(sources[1].text||'[]')
  if(!Array.isArray(followups)||!Array.isArray(rawForecasts))throw new Error('旧资料格式不正确，未删除原资料。')
  followups.forEach(validateFollowup)
  const forecasts=new Map<string,ForecastRecord>()
  const events:ForecastEvent[]=[]
  for(const [index,value] of rawForecasts.entries()){const row=value as ForecastRecord;if(!row||typeof row.taskId!=='string'||typeof row.nodeId!=='string'||!Number.isFinite(Date.parse(row.endAt)))throw new Error('旧预计记录无法识别，未删除原资料。');const id=row.taskId+'/'+row.nodeId;forecasts.set(id,{id,taskId:row.taskId,nodeId:row.nodeId,endAt:row.endAt,version:1});events.push({operationId:'legacy-forecast-'+index,taskId:row.taskId,nodeId:row.nodeId,endAt:row.endAt,legacyOrder:index})}
  const writes=[...followups.map(value=>({store:'followups',value})),...[...forecasts.values()].map(value=>({store:'forecasts',value}))]
  for(let offset=0;offset<writes.length;offset+=100)await transaction('readwrite',async tx=>{
    for(const row of writes.slice(offset,offset+100)){const store=tx.objectStore(row.store),existing=await result(store.get(row.value.id))
      if(existing){if(JSON.stringify(existing)!==JSON.stringify(row.value))throw new Error('旧资料与当前记录冲突；迁移已写入部分可验证记录，原资料保留，可核对后重试。')}else store.put(row.value)}
  })
  for(let offset=0;offset<events.length;offset+=100)await transaction('readwrite',async tx=>{
    const store=tx.objectStore('forecast-events')
    for(const event of events.slice(offset,offset+100)){
      const existing=await result(store.index('operationId').get(event.operationId)) as ForecastEvent|undefined
      if(existing){const {sequence,...previous}=existing;if(JSON.stringify(previous)!==JSON.stringify(event))throw new Error('旧预计历史与已迁移记录不一致，原资料保留，请核对。')}else store.add(event)
    }
  })
  await loadFollowups();if(state.error)throw new Error('迁移读回失败，原资料保留。')
  const lookup=new Map<string,unknown>([...cache.followups.map(row=>['followups/'+row.id,row] as const),...cache.forecasts.map(row=>['forecasts/'+row.id,row] as const)])
  if(writes.some(row=>JSON.stringify(lookup.get(row.store+'/'+row.value.id))!==JSON.stringify(row.value)))throw new Error('迁移读回不一致，原资料保留。')
  if(events.some(event=>{const existing=cache.events.find(row=>row.operationId===event.operationId);if(!existing)return true;const {sequence,...value}=existing;return JSON.stringify(value)!==JSON.stringify(event)}))throw new Error('预计历史读回不一致，原资料保留。')
  for(const source of sources){if(globalThis.localStorage.getItem(source.key)!==source.text)throw new Error('旧页面仍在修改资料，迁移未完成，原资料保留。')}
  for(const source of sources)if(source.text!==null)globalThis.localStorage.removeItem(source.key)
  await loadFollowups()
}

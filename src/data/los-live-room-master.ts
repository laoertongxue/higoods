import { commitPcsRecords, readPcsRecords, type PcsStoredRecord } from './pcs-record-db.ts'
import { listConfigDimensionOptions } from './pcs-config-workspace-repository.ts'
// LOS owns these records. PCS may consume location IDs; it never edits this master.
// Only the existing low-level IndexedDB adapter is shared, not PCS business rules.
const KEY = 'higood-los-live-room-master-v1'
export interface LiveSite { siteId: string; code: string; name: string; enabled: boolean; updatedAt: string }
export interface LiveRoom { roomId: string; code: string; siteId: string; floor: number; sequence: number; name: string; categoryNumberIds: string[]; opm: string; so: string; enabled: boolean; updatedAt: string; logs: Array<{time:string; action:string; actor:string}> }
let sites: LiveSite[] = [], rooms: LiveRoom[] = [], rows = new Map<string,PcsStoredRecord>(), loaded = false
let loadError = ''
const copy = <T>(v:T):T => structuredClone(v)
export function liveRoomCode(siteCode:string, floor:number, sequence:number):string {
  if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(siteCode) || siteCode.length>20) throw new Error('地点编码须为不超过20位的大写英文、数字或短横线。')
  if (!Number.isInteger(floor)||floor<1||floor>99) throw new Error('楼层须为1～99的整数。')
  if (!Number.isInteger(sequence)||sequence<1||sequence>999) throw new Error('房间序列号须为1～999的整数。')
  return `${siteCode}-${String(floor).padStart(2,'0')}-${String(sequence).padStart(3,'0')}`
}
function seeds(): { sites:LiveSite[]; rooms:LiveRoom[] } {
  const date='2026-10-06 09:00:00', categories=listConfigDimensionOptions('categoryNumbers')
  const ids=(codes:string[])=>codes.map(code=>categories.find(o=>o.code===code)?.id).filter((id):id is string=>!!id)
  return { sites:[{siteId:'JKT-A',code:'JKT-A',name:'雅加达地点 A（演示）',enabled:true,updatedAt:date},{siteId:'JKT-B',code:'JKT-B',name:'雅加达地点 B（演示）',enabled:true,updatedAt:date}],
    rooms:[{roomId:'loc-live-01',siteId:'JKT-A',code:liveRoomCode('JKT-A',4,2),floor:4,sequence:2,name:'402 房间（演示）',categoryNumberIds:ids(['11','54']),opm:'SELVI',so:'LUSI',enabled:true,updatedAt:date,logs:[]},
    {roomId:'loc-live-02',siteId:'JKT-B',code:liveRoomCode('JKT-B',3,1),floor:3,sequence:1,name:'连衣裙直播房间（演示）',categoryNumberIds:ids(['17','18','20','21']),opm:'FIFI',so:'DIAH',enabled:true,updatedAt:date,logs:[]}] }
}
const rowId=(kind:'sites'|'rooms',id:string)=>`${KEY}/${kind}/${id}`
function merge<T extends {siteId?:string;roomId?:string}>(base:T[], kind:'sites'|'rooms'):T[] {
  const getId=(r:T)=>kind==='sites'?r.siteId!:r.roomId!;const result=new Map(base.map(r=>[getId(r),r]));
  for(const row of rows.values())if(row.collection===kind){if(row.deleted)result.delete(row.id.split('/').at(-1)!);else {const r=row.value as T;result.set(getId(r),copy(r))}}
  return [...result.values()]
}
export async function ensureLosLiveRoomState():Promise<void> {
  try { const read=await readPcsRecords([KEY]); rows=new Map(read.records.map(r=>[r.id,r]));const base=seeds();sites=merge(base.sites,'sites');rooms=merge(base.rooms,'rooms');loaded=true;loadError='' }
  catch(e){loadError=e instanceof Error?e.message:'直播房间资料读取失败，请重新读取。';throw e}
}
export function getLosLiveRoomReadError():string{return loadError}
export function listLiveSites():LiveSite[]{return copy(loaded?sites:seeds().sites)}
export function listLiveRooms():LiveRoom[]{return copy(loaded?rooms:seeds().rooms)}
export function getLiveRoom(id:string):LiveRoom|null{return listLiveRooms().find(r=>r.roomId===id)||null}
export function liveRoomAvailable(room:LiveRoom):boolean{return room.enabled&&listLiveSites().some(s=>s.siteId===room.siteId&&s.enabled)}
export function liveRoomCategories(room:LiveRoom):Array<{id:string;code:string;nameEn:string;nameZh:string}> {
  const all=listConfigDimensionOptions('categoryNumbers');return room.categoryNumberIds.map(id=>{const o=all.find(o=>o.id===id);return {id,code:o?.code||'',nameEn:o?.name_en||'',nameZh:o?.name_zh||'配置项已删除'}})
}
export function liveRoomLocationName(room:LiveRoom):string {return `${listLiveSites().find(s=>s.siteId===room.siteId)?.name||'地点已停用'} · ${room.code} · ${room.name}`}
export function losRecordVersion(kind:'sites'|'rooms',id:string):number { return rows.get(rowId(kind,id))?.version||0 }
/** Read-only guards join the sample transaction; PCS never rewrites LOS master records. */
export function liveRoomTransferGuards(id:string):Array<{id:string;expectedVersion:number}> {
  const room=getLiveRoom(id);if(!room)return []
  if(!liveRoomAvailable(room))throw new Error('目标直播房间或地点已停用，请重新选择接收位置。')
  return [{id:rowId('rooms',id),expectedVersion:losRecordVersion('rooms',id)},{id:rowId('sites',room.siteId),expectedVersion:losRecordVersion('sites',room.siteId)}]
}
async function commit(kind:'sites'|'rooms',id:string,value:LiveSite|LiveRoom,expectedVersion:number,operationId:string,siteGuard?:LiveSite):Promise<void> {
  if(loadError||!loaded)throw new Error('资料未成功读取，请先重新读取，输入已保留。')
  const puts=[{id:rowId(kind,id),collection:kind,value,expectedVersion}]
  // Guard the parent site in the same transaction: a concurrent disable invalidates
  // this room save. No extra site business event or timestamp is manufactured.
  const guards=siteGuard?[{id:rowId('sites',siteGuard.siteId),expectedVersion:losRecordVersion('sites',siteGuard.siteId)}]:[]
  await commitPcsRecords({puts,guards,deletes:[],operationId,intent:JSON.stringify({kind,id,value})})
  rows.set(rowId(kind,id),{id:rowId(kind,id),collection:kind,value:copy(value),version:expectedVersion+1})
  const base=seeds();sites=merge(base.sites,'sites');rooms=merge(base.rooms,'rooms')
}
export async function saveLiveSite(input:{siteId?:string;code:string;name:string;enabled?:boolean},expectedVersion:number,operationId=crypto.randomUUID()):Promise<LiveSite> {
  const code=input.code.trim().toUpperCase();liveRoomCode(code,1,1)
  const old=listLiveSites().find(s=>s.code===code)
  if(old&&input.siteId!==old.siteId)throw new Error('地点编码已存在，请编辑已有地点或使用其他编码。')
  if(input.siteId&&input.siteId!==code)throw new Error('已有地点编码固定，不能修改。')
  if(!input.name.trim())throw new Error('请填写直播地点名称。')
  const site:LiveSite={siteId:code,code,name:input.name.trim(),enabled:input.enabled??old?.enabled??true,updatedAt:new Date().toLocaleString('sv-SE')}
  await commit('sites',code,site,expectedVersion,operationId);return copy(site)
}
export async function saveLiveRoom(input:Omit<LiveRoom,'code'|'updatedAt'|'logs'>,expectedVersion:number,operationId=crypto.randomUUID()):Promise<LiveRoom> {
  const site=listLiveSites().find(s=>s.siteId===input.siteId);if(!site?.enabled)throw new Error('请选择已启用的直播地点。')
  const code=liveRoomCode(site.code,input.floor,input.sequence),old=getLiveRoom(input.roomId)
  if(old&&expectedVersion===0&&losRecordVersion('rooms',old.roomId)>0)throw new Error('此地点、楼层、序列号的房间标号已存在。')
  if(old&&(old.siteId!==input.siteId||old.floor!==input.floor||old.sequence!==input.sequence))throw new Error('已有房间标号固定；地点、楼层、序列号不能修改。')
  if(!input.name.trim()||!input.opm.trim()||!input.so.trim())throw new Error('请填写房间名称、OPM 和 S.O。')
  const options=listConfigDimensionOptions('categoryNumbers'), selected=[...new Set(input.categoryNumberIds)]
  if(!selected.length||selected.some(id=>!options.some(o=>o.id===id&&(o.status==='ENABLED'||old?.categoryNumberIds.includes(id)))))throw new Error('请关联有效的品类编号，至少一个。')
  if(listLiveRooms().some(r=>r.code===code&&r.roomId!==input.roomId))throw new Error('此地点、楼层、序列号的房间标号已存在。')
  if(!old&&input.roomId!==code)throw new Error('新房间身份须使用生成的唯一标号。')
  const time=new Date().toLocaleString('sv-SE'), room:LiveRoom={...copy(input),name:input.name.trim(),opm:input.opm.trim(),so:input.so.trim(),categoryNumberIds:selected,code,updatedAt:time,logs:[...(old?.logs||[]),{time,action:old?'维护房间资料':'新增房间',actor:'当前用户'}]}
  await commit('rooms',room.roomId,room,expectedVersion,operationId,site);return copy(room)
}
export async function setLiveRoomEnabled(id:string,enabled:boolean,expectedVersion:number):Promise<void> {
  const old=getLiveRoom(id);if(!old)throw new Error('房间不存在。')
  const time=new Date().toLocaleString('sv-SE');await commit('rooms',id,{...old,enabled,updatedAt:time,logs:[...old.logs,{time,action:enabled?'启用房间':'停用房间',actor:'当前用户'}]},expectedVersion,crypto.randomUUID())
}

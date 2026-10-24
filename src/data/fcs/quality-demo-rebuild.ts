import { pcsFileReferences } from '../pcs-record-db.ts'
import { createFinishedInventorySeed } from '../wls/finished-inventory-quality-seed.ts'
/** One-off external maintenance for the 2026-10-23 prototype change.
 * Not imported by ordinary routes: invoke before opening the new version.
 * Each database has its own committed marker; retries never erase new records.
 */
export const QUALITY_DEMO_REBUILD_ID = 'quality-post-demo-rebuild-20261023-v1'
const post = 'higood-fcs-post-finishing-records/'
const quality = 'higood-fcs-quality-management/'
const inventory = 'higood-finished-inventory/'
const sampleKey = 'higood:sewing-sample-approval:v3'
const garmentLogStages=new Set(['送货登记','回货确认','送检','质检','后道','复检','出货','仓库收货','授权','质检参考资料'])
const garmentCollections = new Set(['deliveries','waitProcessWarehouseRecords','waitProcessWarehouseMovements','waitHandoverWarehouseRecords','waitHandoverWarehouseMovements','processCompletions','returnConfirmationVersions','qcTasks','postTasks','fullCoverages','recheckOrders','outboundOrders','warehouseReceipts','defects','migration'])
interface Row { id:string; collection?:string; value?:any; [key:string]:any }
export interface DemoRebuildResult { database:string; alreadyCompleted:boolean; deletedRecords:number; deletedFiles:number; retainedInventoryApplications:number }
function refs(value:unknown, knownIds:Set<string>):Set<string> {
  const found=pcsFileReferences(value,knownIds,false)
  const visit=(item:any)=>{if(!item || typeof item!=='object' || item instanceof Blob)return
    if(typeof item.$productionFile==='string')found.add(item.$productionFile)
    for(const child of Object.values(item))visit(child)
  }
  visit(value)
  return found
}
function inventorySelection(rows:Row[]) {
  const lots=rows.filter(row=>row.id.startsWith(inventory+'lots/'))
  const seedIds=new Set(createFinishedInventorySeed().lots.map(lot=>lot.id))
  const seedLot=(id:string)=>seedIds.has(id)
  const owned=new Set(lots.filter(row=>row.deleted || /^STATIC:2026-10-(22|23)-quality-/.test(String(row.value?.sourceRef||''))).map(row=>decodeURIComponent(row.id.split('/').at(-1)!)).filter(seedLot))
  const apps=rows.filter(row=>row.id.startsWith(inventory+'applications/') && !row.deleted)
  // Only complete chains rooted in this task's static inventory are reset.
  const selected=new Set<string>()
  let changed=true
  while(changed){changed=false;for(const row of apps){const app=row.value;if(selected.has(app?.id))continue
    const allocations=app?.lines?.flatMap((line:any)=>line.allocations||[])||[]
    if(allocations.length && allocations.every((item:any)=>owned.has(item.lotId) || seedLot(item.lotId) && !lots.some(lot=>lot.value?.id===item.lotId))){selected.add(app.id);changed=true
      const transfers=new Set(rows.filter(r=>r.id.startsWith(inventory+'transfers/') && r.value?.applicationId===app.id).map(r=>r.value.id))
      lots.filter(lot=>transfers.has(lot.value?.sourceRef)).forEach(lot=>owned.add(lot.value.id))
    }
  }}
  // Protect the whole connected component when any application also consumes
  // a non-demo lot. This includes the creator of a shared returned child lot.
  const appLots = new Map(apps.map(row => [row.value.id, new Set<string>((row.value.lines || []).flatMap((line:any) => (line.allocations || []).map((a:any) => a.lotId)))]))
  for(const row of rows.filter(row => row.id.startsWith(inventory+'transfers/'))) {
    const linked=appLots.get(row.value?.applicationId)
    if(linked) for(const lot of lots) if(lot.value?.sourceRef===row.value.id) linked.add(lot.value.id)
  }
  const protectedIds=new Set<string>()
  let protectChanged=true
  while(protectChanged){protectChanged=false
    for(const [id,linked] of appLots) {
      if(!selected.has(id) || [...linked].some(lot=>protectedIds.has(lot))) {
        if(selected.delete(id))protectChanged=true
        for(const lot of linked)if(!protectedIds.has(lot)){protectedIds.add(lot);protectChanged=true}
      }
    }
  }
  for(const id of protectedIds)owned.delete(id)
  const protectedLots=new Set(apps.filter(row=>!selected.has(row.value?.id)).flatMap(row=>row.value.lines.flatMap((l:any)=>l.allocations.map((a:any)=>a.lotId))))
  const scopeIds=new Set(apps.filter(row=>selected.has(row.value?.id)).map(row=>`${row.value.warehouseId}:${row.value.styleId}`))
  return {selected,retained:apps.length-selected.size,remove:(row:Row)=>{
    if(!row.id.startsWith(inventory))return false
    const collection=row.id.slice(inventory.length).split('/')[0],value=row.value
    if(collection==='applications')return selected.has(value?.id)
    if(['transfers','movements','differences'].includes(collection))return selected.has(value?.applicationId)
    if(collection==='lots'){const id=value?.id || decodeURIComponent(row.id.split('/').at(-1)!);return owned.has(id)&&!protectedLots.has(id)}
    if(collection==='scopes')return scopeIds.has(`${value?.warehouseId}:${value?.styleId}`) && !apps.some(r=>!selected.has(r.value?.id)&&r.value.warehouseId===value?.warehouseId&&r.value.styleId===value?.styleId)
    return false
  }}
}
export const INVENTORY_HANDOFF_REBUILD_ID = 'inventory-quality-handoff-20261024-v2'
async function rebuildDatabase(database:string, inventoryOnly=false):Promise<DemoRebuildResult> {
  const rebuildId = inventoryOnly ? INVENTORY_HANDOFF_REBUILD_ID : QUALITY_DEMO_REBUILD_ID
  const available=await indexedDB.databases()
  if(!available.some(db=>db.name===database))return {database,alreadyCompleted:false,deletedRecords:0,deletedFiles:0,retainedInventoryApplications:0}
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(database);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
  try{return await new Promise((resolve,reject)=>{
    const stores=database==='higood-cutting-records-v1'?['records','files','meta','commands']:['records','files','meta']
    const tx=db.transaction(stores,'readwrite'),records=tx.objectStore('records'),meta=tx.objectStore('meta')
    let report:DemoRebuildResult={database,alreadyCompleted:false,deletedRecords:0,deletedFiles:0,retainedInventoryApplications:0}
    tx.oncomplete=()=>resolve(report);tx.onabort=()=>reject(tx.error||new Error('演示数据重建未完成，可重试'));tx.onerror=()=>{}
    const marker=meta.get(rebuildId)
    marker.onsuccess=()=>{
      if(marker.result){report.alreadyCompleted=true;return}
      const commandRead=database==='higood-cutting-records-v1'?tx.objectStore('commands').getAll():null
      const fileKeys=tx.objectStore('files').getAllKeys()
      const read=records.getAll();read.onsuccess=()=>{
        const knownFiles=new Set(fileKeys.result.map(String))
        const rows=read.result as Row[],stock=inventorySelection(rows)
        const retainedQc=new Set(rows.filter(row=>row.id.startsWith(inventory+'applications/')&&!stock.selected.has(row.value?.id)).map(row=>row.value?.qcTaskId).filter(Boolean))
        report.retainedInventoryApplications=stock.retained
        const selectedQc=new Set(rows.filter(row=>row.id.startsWith(inventory+'applications/')&&stock.selected.has(row.value?.id)).map(row=>row.value?.qcTaskId).filter(Boolean))
        const selectedPost=new Set(rows.filter(row=>row.id.startsWith(post+'flow/postTasks/') && (selectedQc.has(row.value?.qcTaskId) || stock.selected.has(row.value?.inventoryApplicationId))).map(row=>row.value?.postTaskId).filter(Boolean))
        const removed:Row[]=[],kept:Row[]=[]
        for(const row of rows){let remove=false
          if(database==='higood-pcs-records'){
            if(!inventoryOnly && row.id.startsWith(quality))remove=true
            if(row.id.startsWith(post) && !inventoryOnly){
              const [scope,collection]=row.id.slice(post.length).split('/')
              if(scope==='flow'&&garmentCollections.has(collection))remove=!(collection==='qcTasks'&&retainedQc.has(row.value?.qcTaskId))
              if(['numbering','references','authorizations'].includes(scope))remove=true
              if(scope==='logs')remove=garmentLogStages.has(row.value?.stage)
              // Shared auxiliary archives stay with their existing owner.
              if(scope==='archive') remove = ['higood-fcs-post-finishing-spu-technical-parameters-v1','higood-fcs-post-finishing-outbound-orders-v1'].some(key => row.id===post+'archive/'+encodeURIComponent(key))
            }
            if(inventoryOnly && row.id.startsWith(post+'flow/qcTasks/'))remove=selectedQc.has(row.value?.qcTaskId)
            if(inventoryOnly && row.id.startsWith(post+'logs/'))remove=selectedQc.has(row.value?.objectId) || selectedPost.has(row.value?.objectId)
            if(inventoryOnly && (row.id.startsWith(post+'flow/postTasks/') || row.id.startsWith(post+'flow/processCompletions/')))remove=selectedPost.has(row.value?.postTaskId)
            remove ||= stock.remove(row)
          }else remove=/^production-context:(samples|sample-commands|sample-meta):/.test(row.id)||row.id===`source-migration:${sampleKey}`
          ;(remove?removed:kept).push(row)
        }
        const removedSamples=new Set(removed.filter(row=>row.id.startsWith('production-context:samples:')).map(row=>row.value?.assignmentId))
        const keptCommands:any[]=[],removedCommands:any[]=[]
        for(const command of commandRead?.result || []) {
          if(command.id.startsWith('SAMPLE-UI:') && removedSamples.has(command.result?.assignmentId)) {
            tx.objectStore('commands').delete(command.id);removedCommands.push(command)
          }else keptCommands.push(command)
        }
        const used=new Set([...kept.flatMap(row=>[...refs(row.value,knownFiles)]),...keptCommands.flatMap(command=>[...refs(command.result,knownFiles)])]),candidates=new Set([...removed.flatMap(row=>[...refs(row.value,knownFiles)]),...removedCommands.flatMap(command=>[...refs(command.result,knownFiles)])])
        for(const row of removed)records.delete(row.id)
        if(inventoryOnly){
          // Materialize only the reset demo lots/scopes with newer CAS versions.
          // Tabs holding pre-switch stock cannot overwrite this new baseline.
          const seeds=createFinishedInventorySeed()
          for(const lot of seeds.lots){const id=inventory+'lots/'+encodeURIComponent(lot.id),prior=rows.find(row=>row.id===id)
            if(!prior || removed.includes(prior))records.put({id,collection:'higood-finished-inventory/lots',value:lot,version:((prior as any)?.version||0)+1})}
          for(const row of removed.filter(row=>row.id.startsWith(inventory+'scopes/')))records.put({...row,value:{...row.value,revision:(row.value.revision||0)+1},version:((row as any).version||0)+1})
        }
        for(const id of candidates)if(!used.has(id)){tx.objectStore('files').delete(id);report.deletedFiles++}
        report.deletedRecords=removed.length
        if(database==='higood-pcs-records'){
          const prior=rows.find(row=>row.id===post+'revision')
          const schema=rows.find(row=>row.id===post+'flow/schemaVersion/value')
          if(!inventoryOnly)records.put({id:post+'flow/schemaVersion/value',collection:'flow/schemaVersion',value:5,version:(schema?.version||0)+1})
          records.put({id:post+'revision',collection:'revision',value:{format:1},version:(prior?.version||0)+1})
        }else {
          const revision=meta.get('revision');revision.onsuccess=()=>meta.put({id:'revision',value:(revision.result?.value||0)+1})
        }
        meta.put({id:rebuildId,completedAt:new Date().toISOString(),report})
      }
    }
  })}finally{db.close()}
}
/** Call from an isolated maintenance tab on the exact target origin, with other
 * application tabs closed. No backup/migration or new business entry is created. */
export async function rebuildQualityPostFinishingDemo():Promise<DemoRebuildResult[]> {
  // Create only store structures before marking an empty origin, never seed records.
  await (await import('../pcs-record-db.ts')).readPcsRecordProjection([{prefix:quality}],()=>null)
  await (await import('./cutting/cutting-record-repository.ts')).readCuttingRecordRevision()
  const results=[]
  for(const db of ['higood-pcs-records','higood-cutting-records-v1'])results.push(await rebuildDatabase(db))
  // Only retired garment-specific keys; the mixed full-flow package retains
  // auxiliary and unknown fields verbatim at field level.
  if(localStorage.getItem(QUALITY_DEMO_REBUILD_ID+':retired-keys')==='done') return results
  const mixed='higood-fcs-post-finishing-full-flow-v1',raw=localStorage.getItem(mixed)
  if(raw){const value=JSON.parse(raw);for(const key of garmentCollections)value[key]!==undefined&&delete value[key];delete value.schemaVersion
    if(Object.keys(value).length)localStorage.setItem(mixed,JSON.stringify(value));else localStorage.removeItem(mixed)}
  const logKey='higood-fcs-post-finishing-full-flow-operation-logs-v1',oldLogs=localStorage.getItem(logKey)
  if(oldLogs){const logs=JSON.parse(oldLogs);if(Array.isArray(logs)){const keep=logs.filter(row=>!garmentLogStages.has(row?.stage));if(keep.length)localStorage.setItem(logKey,JSON.stringify(keep));else localStorage.removeItem(logKey)}}
  for(const key of [sampleKey,'higood-fcs-post-finishing-spu-technical-parameters-v1','higood-fcs-post-finishing-outbound-orders-v1','higood-fcs-post-finishing-outbound-orders-v1:archive','higood-fcs-post-finishing-document-numbering-v1','higood-fcs-post-finishing-qc-reference-v1','higood-fcs-post-finishing-authorization-consumptions-v1'])localStorage.removeItem(key)
  localStorage.setItem(QUALITY_DEMO_REBUILD_ID+':retired-keys','done')
  return results
}

/** External, one-time switch for this task only; never imported by business routes. */
export async function rebuildInventoryQualityHandoffDemo():Promise<DemoRebuildResult> {
  await (await import('../pcs-record-db.ts')).readPcsRecordProjection([{prefix:inventory}],()=>null)
  return rebuildDatabase('higood-pcs-records',true)
}

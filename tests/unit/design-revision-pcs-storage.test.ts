import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { chromium } from '@playwright/test'
import ts from 'typescript'

test('design revision FCS bridge: native isolation, IndexedDB atomicity and selective migration', async () => {
  const files = ['design-revision-pcs-storage.ts', 'printing-execution-storage.ts']
  const sources = new Map<string,string>()
  for (const file of files) sources.set('/'+file, ts.transpileModule(await readFile(new URL('../../src/data/fcs/'+file, import.meta.url),'utf8'), { compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext} }).outputText)
  sources.set('/pcs-record-db.ts', ts.transpileModule(await readFile(new URL('../../src/data/pcs-record-db.ts', import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText)
  const server=createServer((req,res)=>{res.setHeader('Content-Type',sources.has(req.url!)?'text/javascript':'text/html');res.end(sources.get(req.url!)??'<!doctype html><title>FCS transaction test</title>')})
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
  const browser=await chromium.launch({headless:true})
  try {
    const page=await browser.newPage();await page.addInitScript('globalThis.__name = (value) => value')
    await page.goto(`http://127.0.0.1:${(server.address() as {port:number}).port}`)
    const result=await page.evaluate(async()=>{
      const bridge=await import('/design-revision-pcs-storage.ts'),db=await import('/pcs-record-db.ts')
      let staging=false;const values=new Map<string,string>();const storage=bridge.getDesignRevisionFcsStorage()
      bridge.configureDesignRevisionPcsStorage({getItem:(key:string)=>values.get(key)??null,setItem:(key:string,raw:string)=>values.set(key,raw),isStaging:()=>staging})
      const key='higoods.formal-dye-execution.v1'
      const order=(id:string,sourceType:string)=>[id,{dyeOrderId:id,taskId:'task-'+id,sourceSnapshot:{sourceType}}]
      const old={version:1,state:{workOrders:[order('plain','PRODUCTION_ORDER')],nodeRecords:[],reviewRecords:[],vatSchedules:[],formulas:[]},tasks:[],demoOutput:[],demoHandovers:[]}
      localStorage.setItem(key,JSON.stringify(old))
      const next=structuredClone(old);next.state.workOrders.push(order('dr','DESIGN_REVISION'))
      let blocked=false;try{storage.setItem(key,JSON.stringify(next))}catch{blocked=true}
      if(!blocked)throw new Error('unguarded revision mutation accepted')
      staging=true;storage.setItem(key,JSON.stringify(next))
      if(localStorage.getItem(key)!==JSON.stringify(old))throw new Error('native data changed before commit')
      const rows=JSON.parse(values.get(bridge.PCS_FCS_COLLECTIONS[0])!)
      if(rows.length!==1||rows[0].key!=='dr')throw new Error('unrelated order migrated')
      const puts=rows.map((row:any)=>({id:'fcs/'+row.id,collection:'fcs',value:row,expectedVersion:0}))
      await db.commitPcsRecords({puts:[{id:'pcs-order',collection:'pcs',value:{status:'submitted'},expectedVersion:0},...puts],deletes:[],operationId:'together',intent:'together'})
      staging=false
      if(JSON.parse(storage.getItem(key)!).state.workOrders.length!==2)throw new Error('merged direct read missing records')
      const firstRead = storage.getItem(key)
      if (storage.getItem(key) !== firstRead) throw new Error('stable read changed facts')
      const overlayKey=bridge.PCS_FCS_COLLECTIONS[0], overlayBefore=values.get(overlayKey)!
      const changedOverlay=JSON.parse(overlayBefore);changedOverlay[0].value.note='changed-read'
      values.set(overlayKey,JSON.stringify(changedOverlay))
      if(!JSON.parse(storage.getItem(key)!).state.workOrders.some(([id,row]:[string,any])=>id==='dr'&&row.note==='changed-read'))throw new Error('PCS overlay update hidden by read cache')
      values.set(overlayKey,overlayBefore)
      if(storage.getItem(key)!==firstRead)throw new Error('rollback hidden by read cache')
      const saved=await db.readPcsRecords();if(saved.records.length!==2)throw new Error('PCS and FCS did not commit together')
      let rejected=false
      try{await db.commitPcsRecords({puts:[{id:'new-pcs',collection:'pcs',value:{},expectedVersion:0},{...puts[0],expectedVersion:0}],deletes:[],operationId:'fail',intent:'fail'})}catch{rejected=true}
      if(!rejected||(await db.readPcsRecords()).records.some((row:any)=>row.id==='new-pcs'))throw new Error('failed transaction partially saved')
      // A native snapshot containing both sources must lose only the verified slice.
      localStorage.setItem(key,JSON.stringify(next))
      localStorage.setItem('higood:dye-work-order:remark:dr','revision note')
      const slices=bridge.enumerateLegacySlices()
      if(slices.length!==1||!slices[0].auxiliary)throw new Error('legacy slice/remark missing')
      bridge.finalizeLegacySlices(slices)
      const remaining=JSON.parse(localStorage.getItem(key)!)
      if(remaining.state.workOrders.length!==1||remaining.state.workOrders[0][0]!=='plain')throw new Error('selective cleanup removed unrelated order')
      if(localStorage.getItem('higood:dye-work-order:remark:dr')!==null)throw new Error('migrated remark not removed')
      // Native updates after commit must remain visible; staged raw is not authoritative.
      const changed=structuredClone(old);changed.state.workOrders[0][1].extra='updated';localStorage.setItem(key,JSON.stringify(changed))
      if(JSON.parse(storage.getItem(key)!).state.workOrders[0][1].extra!=='updated')throw new Error('staged data masks native updates')
      const handoverKey='higood.formal-merged-handout-actions.v1'
      localStorage.setItem(handoverKey,JSON.stringify({version:1,handoverHeadAdditions:[['h-dr',{handoverId:'h-dr',taskId:'task-dr',sourceDocId:'dr'}],['h-plain',{handoverId:'h-plain',taskId:'task-plain'}]],handoutRecordAdditions:[['h-dr',[{recordId:'r-dr',handoverId:'h-dr'}]],['h-plain',[{recordId:'r-plain',handoverId:'h-plain'}]]],handoutRecordOverrides:[],pickupRecordAdditions:[],pickupRecordOverrides:[],handoutRecordVersionHistory:[],headCompletionOverrides:[]}))
      const receivingKey='higood-factory-material-receiving-v1'
      localStorage.setItem(receivingKey,JSON.stringify({version:1,sources:[{id:'s-dr',lines:[{id:'l-dr',dyeOrderId:'dr'}]},{id:'s-other',lines:[{id:'l-other'}]},{id:'s-alone',lines:[{id:'l-alone'}]}],receipts:[{id:'mixed',lines:[{id:'rl-dr',sourceId:'s-dr'},{id:'rl-other',sourceId:'s-other'}]}],deliveries:[],allocations:[],defaults:{warehouse:'retained'},materialUses:[]}))
      const sharedSlices=bridge.enumerateLegacySlices()
      const receiving=sharedSlices.find((slice:any)=>slice.legacyKey===receivingKey)
      if(!receiving||JSON.parse(receiving.raw).length!==3)throw new Error('mixed receipt must keep both complete source documents')
      bridge.finalizeLegacySlices(sharedSlices)
      const kept=JSON.parse(localStorage.getItem(receivingKey)!)
      if(kept.sources.length!==1||kept.sources[0].id!=='s-alone'||kept.defaults.warehouse!=='retained')throw new Error('unrelated receiving source/preferences changed')
      const keptHandovers=JSON.parse(localStorage.getItem(handoverKey)!)
      if(keptHandovers.handoverHeadAdditions.length!==1||keptHandovers.handoutRecordAdditions[0][0]!=='h-plain')throw new Error('handover partition not isolated')
      // Dye/print persist their generated heads inside their own execution bundle,
      // while receiving edits are shared tuple overrides without task/order fields.
      const bundled=structuredClone(next)
      bundled.demoHandovers=[{orderId:'dr',head:{handoverId:'bundle-head',taskId:'task-dr',factoryId:'factory-dr',sourceType:'DESIGN_REVISION',sourceSnapshot:{sourceType:'DESIGN_REVISION'}},records:[{recordId:'bundle-record',handoverId:'bundle-head'}]}]
      staging=true;storage.setItem(key,JSON.stringify(bundled))
      const shared={version:1,handoverHeadAdditions:[],handoutRecordAdditions:[],pickupRecordAdditions:[],pickupRecordOverrides:[],handoutRecordOverrides:[['bundle-record',{receiverWrittenQty:20}],['plain-record',{receiverWrittenQty:7}]],handoutRecordVersionHistory:[['bundle-record',[{receiverWrittenQty:20}]]],headCompletionOverrides:[['bundle-head',{completedAt:'2026-10-03'}]]}
      const nativeShared=localStorage.getItem(handoverKey)
      storage.setItem(handoverKey,JSON.stringify(shared))
      const bundledRows=JSON.parse(values.get(bridge.PCS_FCS_COLLECTIONS[2])??'[]')
      if(bundledRows.length!==3||bundledRows.some((row:any)=>row.key==='plain-record'))throw new Error('bundled design-revision handover receipt overrides were lost or captured unrelated records')
      staging=false
      if(!bridge.isStoredDesignRevisionHandoverHead(bundled.demoHandovers[0].head)||bridge.isStoredDesignRevisionHandoverHead({...bundled.demoHandovers[0].head,factoryId:'wrong-factory'}))throw new Error('design-revision head must match frozen order, task and factory')
      if(localStorage.getItem(handoverKey)!==nativeShared)throw new Error('bundled receipt wrote native storage')
      if(JSON.parse(storage.getItem(handoverKey)!).handoutRecordOverrides.find(([id]:[string])=>id==='bundle-record')?.[1].receiverWrittenQty!==20)throw new Error('bundled receipt not restored outside staging')
      const nativeGet = Storage.prototype.getItem
      Storage.prototype.getItem = () => { throw new DOMException('disabled', 'SecurityError') }
      try {
        if (!JSON.parse(storage.getItem(key)!).state.workOrders.some(([id]: [string]) => id === 'dr')) throw new Error('disabled native reads block persisted design revision')
        if (bridge.enumerateLegacySlices().length) throw new Error('disabled source must not be reported as migrated')
      } finally { Storage.prototype.getItem = nativeGet }
      Storage.prototype.getItem = () => { throw new Error('storage unavailable') }
      try {
        let failure = ''
        try { storage.getItem(key) } catch (error) { failure = String(error) }
        if (!failure.includes('storage unavailable')) throw new Error('ordinary business read failure was hidden as empty storage')
      } finally { Storage.prototype.getItem = nativeGet }
      return saved.records.length
    })
    assert.equal(result,2)
    await page.reload()
    assert.equal(await page.evaluate(async()=> (await (await import('/pcs-record-db.ts')).readPcsRecords()).records.length),2)
  } finally {await browser.close();await new Promise<void>(resolve=>server.close(()=>resolve()))}
})

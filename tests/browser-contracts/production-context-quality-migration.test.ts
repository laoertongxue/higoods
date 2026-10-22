import assert from 'node:assert/strict'
import test from 'node:test'
import { chromium } from '@playwright/test'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** DAT016/017: public explicit migration, original native cutting DB; no product hook or external database. */
const base = process.env.QUALITY_MANAGEMENT_TEST_URL || 'http://127.0.0.1:43127'
const reportPath = resolve(process.env.QUALITY_PRODUCTION_MIGRATION_REPORT_PATH || 'output/qc-implementation-20261022/production-context-quality-migration-results.json')
const image = readFileSync('public/tshirt-sample.jpg')
const imageSha256 = createHash('sha256').update(image).digest('hex')

test('DAT016/017原生：样衣旧源跨100实体checkpoint中断留源，Blob与内容读回后清理，续跑唯一且共用资料不动', {timeout:120000}, async () => {
  const browser = await chromium.launch({headless:true}), context = await browser.newContext(), page = await context.newPage()
  const evidence: Record<string, any> = {base,passed:false,kind:'隔离原生IndexedDB公开codec/显式迁移契约；非原页面操作、现场历史或性能'}
  const pageErrors: string[] = []
  await context.addInitScript(() => {(globalThis as any).__name=(value:unknown)=>value})
  page.on('pageerror',error=>pageErrors.push(error.message))
  await page.route('**/__production-quality-migration-contract',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="zh"><body></body></html>'}))
  try {
    await page.goto(base+'/__production-quality-migration-contract')
    const actual = await page.evaluate(async ({inline,imageHash,imageSize}) => {
      const production = await import('/src/data/fcs/production-context-records.ts')
      const repository = await import('/src/data/fcs/cutting/cutting-record-repository.ts')
      const demo = await import('/src/data/fcs/sewing-outsourcing-demo.ts')
      const samples = await import('/src/data/fcs/sewing-sample-approval-suggestion.ts')
      const source = (await import('/src/data/fcs/sample-quality-read-source.ts')).sampleQualityReadSource
      const orders = await import('/src/data/fcs/production-orders.ts')
      const pcs = await import('/src/data/pcs-record-db.ts')
      const key=production.PRODUCTION_CONTEXT_KEYS.samples,markerId=`source-migration:${key}`
      const fileId=`production-context-file:${imageHash}`,samplePrefix='production-context:samples:'
      const template=demo.getDefaultSewingSampleApprovalRecords()[0]
      if(template.sample.styleImageUrl!=='/tshirt-sample.jpg')throw Error('真实图片必须仍与原样衣款式对应，不能换任意照片通过')
      const orderTemplate=orders.productionOrders.find(order=>order.productionOrderId===template.sample.productionOrderId)!
      if(!orderTemplate?.techPackSnapshot)throw Error('缺少原正式绑定生产单技术资料')
      const sampleRecords=Array.from({length:105},(_,index)=>{
        const record=structuredClone(template),suffix=String(index).padStart(3,'0')
        record.assignmentId=`QC-MIGRATION-ASG-${suffix}`
        Object.assign(record.sample,{assignmentId:record.assignmentId,sampleId:`QC-MIGRATION-PPS-${suffix}`,sampleNo:`QC-MIGRATION-CY-${suffix}`,
          runtimeTaskId:`QC-MIGRATION-TASK-${suffix}`,taskNo:`QC-MIGRATION-TASK-${suffix}`,productionOrderId:`QC-MIGRATION-ORDER-${suffix}`,
          productionOrderNo:`QC-MIGRATION-ORDER-${suffix}`,status:'PPIC_RECEIVED',ppicReceivedAt:'2026-10-20 12:00:00',
          ppicReceivedBy:record.sample.currentPpicName,ppicReceivedSamplePhotoUrls:[index<2?inline:'/tshirt-sample.jpg'],samplePhotoUrls:index<2?[inline]:[]})
        record.assignmentAliases=[{assignmentId:record.assignmentId,runtimeTaskId:record.sample.runtimeTaskId}]
        for(const reference of record.referenceSnapshots)if(reference.sourceObjectId===template.sample.productionOrderId)reference.sourceObjectId=record.sample.productionOrderId
        return record
      })
      const upstreamOrders=sampleRecords.map(record=>{
        const order=structuredClone(orderTemplate)
        order.productionOrderId=record.sample.productionOrderId;order.productionOrderNo=record.sample.productionOrderNo
        order.techPackSnapshot={...order.techPackSnapshot!,productionOrderId:order.productionOrderId,productionOrderNo:order.productionOrderNo}
        order.selectedTechPackVersionId=order.techPackSnapshot.sourceTechPackVersionId
        return order
      })
      orders.validatePersistedProductionOrders(upstreamOrders)
      const upstreamRows=production.decodeProductionContextRecords(production.PRODUCTION_CONTEXT_KEYS.orders,JSON.stringify({version:1,orders:upstreamOrders}))
      const commands=sampleRecords.map(record=>[`QC-MIGRATION-RECEIVE:${record.assignmentId}`,{assignmentId:record.assignmentId,action:'PPIC_RECEIVED'}])
      const raw=JSON.stringify({version:3,records:sampleRecords,commands,sequence:105})
      const originalRows=production.decodeProductionContextRecords(key,raw)
      const targetIds=new Set(originalRows.map(row=>row.id))
      function expectedValue(value:any):any {
        if(value===inline)return {$productionFile:fileId}
        if(Array.isArray(value))return value.map(expectedValue)
        if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([name,item])=>[name,expectedValue(item)]))
        return value
      }
      const expectedRows=originalRows.map(row=>({...row,value:expectedValue(row.value)}))
      const auxiliary={id:'accessory-warehouse:QC-MIGRATION-KEEP',collection:'accessory-warehouse:quality-migration-sentinel',value:{quantity:7,fileId:'accessory-warehouse:QC-MIGRATION-KEEP-FILE',note:'范围外辅料标记，迁移不得改动'}}
      const otherFile={id:'accessory-warehouse:QC-MIGRATION-KEEP-FILE',blob:new Blob(['outside accessory bytes'],{type:'text/plain'})}
      const initial=await repository.readCuttingRecords()
      await repository.commitCuttingRecords({revision:initial.revision,change:{puts:[...upstreamRows,auxiliary],files:[otherFile]},command:{
        id:'QC-MIGRATION-UPSTREAM-PRECONDITIONS',intent:'隔离预装合法正式生产单和范围外辅料哨兵；不是已迁移或现场事实',result:upstreamRows.length,at:'2026-10-22T00:00:00.000Z'}})
      await pcs.commitPcsRecords({puts:[{id:'qc-migration-outside/KEEP',collection:'qc-migration-outside',value:{quantity:13},expectedVersion:0}],deletes:[],operationId:'QC-MIGRATION-PCS-KEEP',intent:'范围外PCS哨兵'})
      localStorage.setItem(key,raw);localStorage.setItem('qc-migration-outside-KEEP','quantity=9')
      const hash=async(bytes:BufferSource)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(value=>value.toString(16).padStart(2,'0')).join('')
      const result:any={phase:'prepared',expected:{samples:105,commands:105,entities:211,imageHash,imageSize,fileId,rawChars:raw.length,rawHash:await hash(new TextEncoder().encode(raw))}}
      const native={transaction:IDBDatabase.prototype.transaction,put:IDBObjectStore.prototype.put,add:IDBObjectStore.prototype.add,delete:IDBObjectStore.prototype.delete,
        get:IDBObjectStore.prototype.get,getAll:IDBObjectStore.prototype.getAll,removeItem:Storage.prototype.removeItem,setItem:Storage.prototype.setItem}
      const transactions=new WeakMap<IDBTransaction,any>()
      let event=0,writes=0,localWrites=0,armed=true,injected=false,committedMarker:any,copyCompleteEvent=0,verifiedEvent=0
      let latestRows:any,latestFile:any
      const cleanupObservations:any[]=[],commits:any[]=[],progress:string[]=[]
      IDBDatabase.prototype.transaction=function(...args:Parameters<typeof native.transaction>){
        const tx=native.transaction.apply(this,args),tracked:any={db:this.name,mode:tx.mode,puts:[],fileReads:[]}
        transactions.set(tx,tracked)
        // Register before the repository's oncomplete so these observations are
        // complete before its awaited business continuation can remove old data.
        tx.addEventListener('complete',()=>{
          const at=++event
          if(tracked.rows)latestRows={at,rows:tracked.rows}
          for(const file of tracked.fileReads)latestFile={...file,at}
          const marker=tracked.puts.find((row:any)=>row.id===markerId)
          if(marker){committedMarker=structuredClone(marker.value);if(marker.value.phase==='COPYING'&&marker.value.copied===211)copyCompleteEvent=at;if(marker.value.phase==='VERIFIED')verifiedEvent=at;commits.push({at,phase:marker.value.phase,copied:marker.value.copied,count:marker.value.count,ids:tracked.puts.filter((row:any)=>targetIds.has(row.id)).map((row:any)=>row.id)})}
        })
        return tx
      }
      IDBObjectStore.prototype.put=function(...args:Parameters<typeof native.put>){
        writes++
        const row=args[0],tracked=transactions.get(this.transaction)
        if(this.name==='records'&&armed&&row?.id===`${samplePrefix}QC-MIGRATION-ASG-100`){injected=true;throw new DOMException('隔离第二个100实体批次中断','QuotaExceededError')}
        if(this.name==='records')tracked?.puts.push(structuredClone(row))
        return native.put.apply(this,args)
      }
      IDBObjectStore.prototype.add=function(...args:Parameters<typeof native.add>){writes++;return native.add.apply(this,args)}
      IDBObjectStore.prototype.delete=function(...args:Parameters<typeof native.delete>){writes++;return native.delete.apply(this,args)}
      IDBObjectStore.prototype.getAll=function(...args:Parameters<typeof native.getAll>){
        const request=native.getAll.apply(this,args),tracked=transactions.get(this.transaction)
        if(this.transaction.db.name==='higood-cutting-records-v1'&&this.name==='records')request.addEventListener('success',()=>{tracked.rows=request.result.filter((row:any)=>targetIds.has(row.id))})
        return request
      }
      IDBObjectStore.prototype.get=function(...args:Parameters<typeof native.get>){
        const request=native.get.apply(this,args),tracked=transactions.get(this.transaction)
        if(this.transaction.db.name==='higood-cutting-records-v1'&&this.name==='files'&&args[0]===fileId)request.addEventListener('success',()=>{if(request.result?.blob)tracked.fileReads.push({id:fileId,blob:request.result.blob})})
        return request
      }
      Storage.prototype.removeItem=function(name:string){
        localWrites++
        if(name===key)cleanupObservations.push({at:++event,marker:structuredClone(committedMarker),copyCompleteEvent,verifiedEvent,rows:latestRows,file:latestFile})
        return native.removeItem.call(this,name)
      }
      Storage.prototype.setItem=function(...args:Parameters<typeof native.setItem>){localWrites++;return native.setItem.apply(this,args)}
      const snapshot=async()=>{
        const backup=await repository.exportCuttingRecordBackup(),rows=backup.records.filter(row=>targetIds.has(row.id))
        return {revision:(await repository.readCuttingRecords()).revision,targetRows:rows,targetSamples:rows.filter(row=>row.collection==='production-context:samples').length,
          targetCommands:rows.filter(row=>row.collection==='production-context:sample-commands').length,marker:backup.records.find(row=>row.id===markerId)?.value,
          commands:backup.commands.map(row=>row.id),upstreamPreserved:upstreamRows.every(row=>JSON.stringify(backup.records.find(actual=>actual.id===row.id))===JSON.stringify(row)),
          auxiliary:backup.records.find(row=>row.id===auxiliary.id),pcs:(await pcs.readPcsRecords(['qc-migration-outside'])).records,
          files:await Promise.all(backup.files.map(async file=>({id:file.id,size:file.blob.size,type:file.blob.type,sha256:await hash(await file.blob.arrayBuffer())}))),
          oldSourceHash:await hash(new TextEncoder().encode(localStorage.getItem(key)||'')),oldSourcePresent:localStorage.getItem(key)!==null,
          outsideLs:localStorage.getItem('qc-migration-outside-KEEP')}
      }
      const readOnly=async()=>{
        const beforeWrites=writes,beforeLocal=localWrites;let fullError='',narrowError=''
        try{await production.hydrateProductionContextRecords()}catch(error){fullError=String(error)}
        try{await source.prepare!()}catch(error){narrowError=String(error)}
        return {fullError,narrowError,writes:writes-beforeWrites,localWrites:localWrites-beforeLocal}
      }
      try{
        result.before=await snapshot()
        result.phase='ordinary-read-before-migration';result.beforeGate=await readOnly()
        const beforePermission=writes
        try{await production.migrateProductionContextRecords({otherPagesClosed:false,progress:text=>progress.push(text)})}catch(error){result.permissionError=String(error)}
        result.permissionWrites=writes-beforePermission
        result.phase='injected-second-batch'
        try{await production.migrateProductionContextRecords({otherPagesClosed:true,progress:text=>progress.push(text)})}catch(error){result.interruptedError=String(error)}
        result.injected=injected;result.partial=await snapshot();result.partialGate=await readOnly()
        const beforeBlockedWrite=writes,beforeBlockedLocal=localWrites
        let blockedActionCalls=0,blockedWriteError=''
        try{await production.saveProductionContextAction({id:'QC-MIGRATION-MUST-BLOCK',intent:'迁移未完成时必须在实际动作前阻断',
          capture:()=>({}),restore:()=>{},action:()=>{blockedActionCalls++;return true}})}catch(error){blockedWriteError=String(error)}
        result.partialWriteGate={error:blockedWriteError,actionCalls:blockedActionCalls,writes:writes-beforeBlockedWrite,localWrites:localWrites-beforeBlockedLocal}
        armed=false;result.phase='resume'
        result.migratedCount=await production.migrateProductionContextRecords({otherPagesClosed:true,progress:text=>progress.push(text)})
        result.final=await snapshot()
        result.contentMatches=expectedRows.every(expected=>JSON.stringify(result.final.targetRows.find((row:any)=>row.id===expected.id))===JSON.stringify(expected))
        result.uniqueIds=new Set(result.final.targetRows.map((row:any)=>row.id)).size
        result.referenceIds=result.final.targetRows.flatMap((row:any)=>production.productionContextFileIds(row.value))
        production.validateProductionContextRecords((await repository.readCuttingRecords()).records)
        result.phase='ordinary-read-after-complete'
        result.afterGate=await readOnly()
        const beforeRead=writes,beforeLocal=localWrites
        const loaded=samples.getSewingSampleApprovalRecord(sampleRecords[0].assignmentId)!
        result.readbackPhotoHash=await hash(await (await fetch(loaded.sample.ppicReceivedSamplePhotoUrls[0])).arrayBuffer())
        result.loadedStatus=loaded.sample.status
        result.readbackWrites=writes-beforeRead;result.readbackLocalWrites=localWrites-beforeLocal
        const beforeReplay=writes,beforeReplayLocal=localWrites
        result.repeatCount=await production.migrateProductionContextRecords({otherPagesClosed:true,progress:text=>progress.push(text)})
        result.repeatWrites=writes-beforeReplay;result.repeatLocalWrites=localWrites-beforeReplayLocal
        result.replayed=await snapshot()
        result.phase='complete'
      }catch(error){result.unexpectedError=String(error);try{result.failureState=await snapshot()}catch(readError){result.failureReadError=String(readError)}}
      finally{
        result.progress=progress;result.commits=commits
        result.cleanup=await Promise.all(cleanupObservations.map(async observation=>({at:observation.at,marker:observation.marker,
          copyCompleteEvent:observation.copyCompleteEvent,verifiedEvent:observation.verifiedEvent,rowsReadEvent:observation.rows?.at,fileReadEvent:observation.file?.at,
          recordCount:observation.rows?.rows.length,contentMatches:expectedRows.every(expected=>JSON.stringify(observation.rows?.rows.find((row:any)=>row.id===expected.id))===JSON.stringify(expected)),
          fileId:observation.file?.id,fileSize:observation.file?.blob.size,fileSha256:observation.file?await hash(await observation.file.blob.arrayBuffer()):undefined})))
        IDBDatabase.prototype.transaction=native.transaction;IDBObjectStore.prototype.put=native.put;IDBObjectStore.prototype.add=native.add;IDBObjectStore.prototype.delete=native.delete
        IDBObjectStore.prototype.get=native.get;IDBObjectStore.prototype.getAll=native.getAll;Storage.prototype.removeItem=native.removeItem;Storage.prototype.setItem=native.setItem
      }
      return result
    },{inline:`data:image/jpeg;base64,${image.toString('base64')}`,imageHash:imageSha256,imageSize:image.length})
    evidence.actual=actual
    assert.equal(actual.unexpectedError,undefined,actual.unexpectedError)
    assert.deepEqual(pageErrors,[])
    assert.equal(actual.expected.entities,211)
    assert.match(actual.beforeGate.fullError,/旧生产来源|先.*迁移/);assert.match(actual.beforeGate.narrowError,/旧生产来源|先.*迁移/)
    for(const read of [actual.beforeGate,actual.partialGate,actual.afterGate]){assert.equal(read.writes,0);assert.equal(read.localWrites,0)}
    assert.match(actual.permissionError,/关闭其他/);assert.equal(actual.permissionWrites,0)
    assert.equal(actual.injected,true);assert.match(actual.interruptedError,/QuotaExceeded|未保存/)
    assert.equal(actual.partial.targetSamples,100);assert.equal(actual.partial.targetCommands,0)
    assert.equal(actual.partial.marker.phase,'COPYING');assert.equal(actual.partial.marker.copied,100);assert.equal(actual.partial.marker.count,211)
    assert.equal(actual.partial.oldSourcePresent,true);assert.equal(actual.partial.oldSourceHash,actual.expected.rawHash)
    assert.match(actual.partialGate.fullError,/迁移尚未|未完成/);assert.match(actual.partialGate.narrowError,/迁移尚未|未完成/)
    assert.match(actual.partialWriteGate.error,/迁移尚未|未完成/);assert.equal(actual.partialWriteGate.actionCalls,0)
    assert.equal(actual.partialWriteGate.writes,0);assert.equal(actual.partialWriteGate.localWrites,0)
    assert.equal(actual.migratedCount,211);assert.equal(actual.final.targetSamples,105);assert.equal(actual.final.targetCommands,105)
    assert.equal(actual.final.targetRows.length,211);assert.equal(actual.uniqueIds,211);assert.equal(actual.contentMatches,true)
    assert.equal(actual.final.marker.phase,'COMPLETE');assert.equal(actual.final.marker.copied,211);assert.equal(actual.final.oldSourcePresent,false)
    const copiedBatches=actual.commits.filter((commit:any)=>commit.phase==='COPYING')
    assert.deepEqual(copiedBatches.map((commit:any)=>commit.copied),[100,200,211])
    assert.deepEqual(copiedBatches.map((commit:any)=>commit.ids.length),[100,100,11], '续跑不再次写入已核对的首个100实体批次')
    const files=actual.final.files.filter((file:any)=>file.id===actual.expected.fileId)
    assert.equal(files.length,1);assert.equal(files[0].sha256,imageSha256);assert.equal(files[0].size,image.length)
    assert.equal(actual.referenceIds.length,4);assert.ok(actual.referenceIds.every((id:string)=>id===actual.expected.fileId))
    assert.ok(!/data:image|blob:/.test(JSON.stringify(actual.final.targetRows)))
    assert.equal(actual.cleanup.length,1)
    const cleanup=actual.cleanup[0]
    assert.equal(cleanup.marker.phase,'VERIFIED');assert.equal(cleanup.marker.copied,211);assert.equal(cleanup.recordCount,211);assert.equal(cleanup.contentMatches,true)
    assert.equal(cleanup.fileId,actual.expected.fileId);assert.equal(cleanup.fileSha256,imageSha256);assert.equal(cleanup.fileSize,image.length)
    assert.ok(cleanup.copyCompleteEvent<cleanup.rowsReadEvent);assert.ok(cleanup.rowsReadEvent<cleanup.fileReadEvent)
    assert.ok(cleanup.fileReadEvent<cleanup.verifiedEvent);assert.ok(cleanup.verifiedEvent<cleanup.at)
    assert.equal(actual.afterGate.fullError,'');assert.equal(actual.afterGate.narrowError,'')
    assert.equal(actual.readbackPhotoHash,imageSha256);assert.equal(actual.loadedStatus,'PPIC_RECEIVED')
    assert.equal(actual.readbackWrites,0);assert.equal(actual.readbackLocalWrites,0)
    assert.equal(actual.repeatCount,0);assert.equal(actual.repeatWrites,0);assert.equal(actual.repeatLocalWrites,0)
    assert.deepEqual(actual.replayed.targetRows,actual.final.targetRows)
    assert.deepEqual(actual.replayed.commands,actual.final.commands)
    for(const state of [actual.partial,actual.final,actual.replayed]){
      assert.equal(state.upstreamPreserved,true);assert.deepEqual(state.auxiliary,actual.before.auxiliary);assert.deepEqual(state.pcs,actual.before.pcs)
      assert.equal(state.outsideLs,'quantity=9')
      assert.deepEqual(state.files.find((file:any)=>file.id==='accessory-warehouse:QC-MIGRATION-KEEP-FILE'),actual.before.files.find((file:any)=>file.id==='accessory-warehouse:QC-MIGRATION-KEEP-FILE'))
    }
    // A fresh document has no migration/materialization cache. Read through the
    // same public source and record getters, without calling migration again.
    await page.reload()
    evidence.coldRead=await page.evaluate(async()=>{
      const originals={put:IDBObjectStore.prototype.put,add:IDBObjectStore.prototype.add,delete:IDBObjectStore.prototype.delete,
        setItem:Storage.prototype.setItem,removeItem:Storage.prototype.removeItem}
      let writes=0,localWrites=0
      for(const method of ['put','add','delete'] as const)(IDBObjectStore.prototype as any)[method]=function(...args:any[]){writes++;return (originals[method] as any).apply(this,args)}
      Storage.prototype.setItem=function(...args:Parameters<typeof originals.setItem>){localWrites++;return originals.setItem.apply(this,args)}
      Storage.prototype.removeItem=function(...args:Parameters<typeof originals.removeItem>){localWrites++;return originals.removeItem.apply(this,args)}
      try{
        const p=await import('/src/data/fcs/production-context-records.ts'),s=await import('/src/data/fcs/sewing-sample-approval-suggestion.ts')
        const repository=await import('/src/data/fcs/cutting/cutting-record-repository.ts')
        await p.hydrateProductionContextRecords()
        const loaded=s.getSewingSampleApprovalRecord('QC-MIGRATION-ASG-000')!,bytes=await(await fetch(loaded.sample.ppicReceivedSamplePhotoUrls[0])).arrayBuffer()
        const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('')
        const saved=await repository.readCuttingRecords()
        return {writes,localWrites,count:s.listSewingSampleApprovalRecords().filter(record=>record.assignmentId.startsWith('QC-MIGRATION-ASG-')).length,
          status:loaded.sample.status,imageHash:hash,oldSource:localStorage.getItem(p.PRODUCTION_CONTEXT_KEYS.samples),
          phase:(saved.records.find(row=>row.id===`source-migration:${p.PRODUCTION_CONTEXT_KEYS.samples}`)?.value as any)?.phase}
      }finally{
        IDBObjectStore.prototype.put=originals.put;IDBObjectStore.prototype.add=originals.add;IDBObjectStore.prototype.delete=originals.delete
        Storage.prototype.setItem=originals.setItem;Storage.prototype.removeItem=originals.removeItem
      }
    })
    assert.equal(evidence.coldRead.writes,0);assert.equal(evidence.coldRead.localWrites,0)
    assert.equal(evidence.coldRead.count,105);assert.equal(evidence.coldRead.status,'PPIC_RECEIVED')
    assert.equal(evidence.coldRead.imageHash,imageSha256);assert.equal(evidence.coldRead.oldSource,null);assert.equal(evidence.coldRead.phase,'COMPLETE')
    evidence.passed=true
  }catch(error){evidence.error=String(error);throw error}
  finally{
    evidence.pageErrors=pageErrors
    mkdirSync(resolve('output/qc-implementation-20261022'),{recursive:true})
    writeFileSync(reportPath,JSON.stringify(evidence,null,2))
    await context.close();await browser.close()
  }
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { chromium } from '@playwright/test'

const base = process.env.QUALITY_MANAGEMENT_TEST_URL || 'http://127.0.0.1:43127'

test('生产来源原生读取：同版本复用已验证读视图，跨标签新版本完整恢复，错误不作空记录', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext(), page = await context.newPage()
  try {
    await context.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
    await page.route('**/__quality-revision-contract', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="zh"><body></body></html>' }))
    await page.goto(base + '/__quality-revision-contract')
    const result = await page.evaluate(async () => {
      const production = await import('/src/data/fcs/production-context-records.ts')
      const repository = await import('/src/data/fcs/cutting/cutting-record-repository.ts')
      const key = production.PRODUCTION_CONTEXT_KEYS.runtime
      const originalGetAll = IDBObjectStore.prototype.getAll
      let fullReads = 0, writes = 0
      const originalTransaction = IDBDatabase.prototype.transaction
      IDBObjectStore.prototype.getAll = function (...args: Parameters<typeof originalGetAll>) {
        if (this.transaction.db.name === 'higood-cutting-records-v1' && this.name === 'records') fullReads++
        return originalGetAll.apply(this, args)
      }
      IDBDatabase.prototype.transaction = function (...args: Parameters<typeof originalTransaction>) {
        const tx = originalTransaction.apply(this, args)
        if (tx.mode === 'readwrite') writes++
        return tx
      }
      const runtime = (sequence: number) => JSON.stringify({ version: 1, taskOverrides: [], splitPlans: [], mergedPlans: [], reassignedTasks: [], auditSeq: sequence })
      const seed = async (sequence: number) => {
        const snapshot = await repository.readCuttingRecords()
        await repository.commitCuttingRecords({ revision: snapshot.revision, change: { puts: production.decodeProductionContextRecords(key, runtime(sequence)) }, command: {
          id: `REVISION-CONTRACT-${sequence}`, intent: `隔离真实原生版本变更${sequence}`, result: sequence, at: '2026-10-22T00:00:00.000Z',
        } })
      }
      try {
        await seed(1)
        await production.hydrateProductionContextRecords()
        const first = JSON.parse(production.productionContextStorage.getItem(key)!)
        const before = { fullReads, writes }
        await production.hydrateProductionContextRecords()
        const unchanged = { fullReads: fullReads - before.fullReads, writes: writes - before.writes, ready: production.isProductionContextReady() }
        await seed(2)
        const changedBefore = { fullReads, writes }
        await production.hydrateProductionContextRecords()
        const changed = { fullReads: fullReads - changedBefore.fullReads, writes: writes - changedBefore.writes, runtime: JSON.parse(production.productionContextStorage.getItem(key)!) }
        const snapshot = await repository.readCuttingRecords()
        const metadata = snapshot.records.find(row => row.collection === 'production-context:runtime-meta')!
        await repository.commitCuttingRecords({ revision: snapshot.revision, change: { puts: [{ ...metadata, value: { auditSeq: -1 } }] }, command: {
          id: 'REVISION-CONTRACT-INVALID', intent: '隔离无效版本：必须拒绝而非空记录', result: null, at: '2026-10-22T00:00:00.000Z',
        } })
        let rejected = ''
        try { await production.hydrateProductionContextRecords() } catch (error) { rejected = String(error) }
        return { first, unchanged, changed, rejected, readyAfterFailure: production.isProductionContextReady() }
      } finally { IDBObjectStore.prototype.getAll = originalGetAll; IDBDatabase.prototype.transaction = originalTransaction }
    })
    assert.equal(result.first.auditSeq, 1)
    assert.deepEqual(result.unchanged, { fullReads: 0, writes: 0, ready: true })
    assert.equal(result.changed.fullReads, 1)
    assert.equal(result.changed.writes, 0)
    assert.equal(result.changed.runtime.auditSeq, 2)
    assert.match(result.rejected, /序号|序列|无效|错误/)
    assert.equal(result.readyAfterFailure, false)
  } finally { await context.close(); await browser.close() }
})

test('原后道收货部位票按原库范围读取含迁移门禁，后续保存仍完整回读且保留无关记录', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext(), page = await context.newPage()
  try {
    await context.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
    await page.route('**/__quality-part-ticket-read-contract', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }))
    await page.goto(base + '/__quality-part-ticket-read-contract')
    const result = await page.evaluate(async () => {
      const repository = await import('/src/data/fcs/cutting/cutting-record-repository.ts')
      const parts = await import('/src/data/fcs/cutting/part-ticket-records.ts')
      const key = parts.PART_TICKET_KEYS.drafts
      const rows = parts.decodePartTicketRecords(key, JSON.stringify({ draft: { draftId: 'NARROW-DRAFT', note: '原草稿' } }))
      const marker = { id: `part-ticket-migration:${parts.PART_TICKET_KEYS.records}`, collection: 'part-ticket-migrations', value: {
        key: parts.PART_TICKET_KEYS.records, fingerprint: '0'.repeat(64), targetFingerprint: '0'.repeat(64), phase: 'COMPLETE', count: 0, copied: 0, ids: [],
      } }
      const unrelated = { id: 'production-context:preserved-source', collection: 'production-context:source', value: { original: '保留原生产资料'.repeat(2000) } }
      await repository.commitCuttingRecords({ revision: 0, change: { puts: [...rows, marker, unrelated] }, command: { id: 'PART-READ-SEED', intent: '隔离原生资料', result: null, at: '2026-10-22T00:00:00Z' } })
      const originalGetAll = IDBObjectStore.prototype.getAll
      const originalTransaction = IDBDatabase.prototype.transaction
      let fullReads = 0, boundedReads = 0, writes = 0
      IDBObjectStore.prototype.getAll = function (...args: Parameters<typeof originalGetAll>) {
        if (this.name === 'records' && this.transaction.db.name === repository.CUTTING_RECORD_DB) { if (args[0]) boundedReads++; else fullReads++ }
        return originalGetAll.apply(this, args)
      }
      IDBDatabase.prototype.transaction = function (...args: Parameters<typeof originalTransaction>) { const tx = originalTransaction.apply(this, args); if (tx.mode === 'readwrite') writes++; return tx }
      const snapshot = await repository.readCuttingRecordsByPrefix('part-ticket')
      await parts.hydratePartTicketRecords(snapshot)
      const read = { fullReads, boundedReads, writes, revision: snapshot.revision, ids: snapshot.records.map(row => row.id), draft: JSON.parse(parts.partTicketStorage.getItem(key)!) }
      await parts.savePartTicketAction({ id: 'PART-READ-THEN-SAVE', intent: '修改原草稿', action: () => { parts.partTicketStorage.setItem(key, JSON.stringify({ draft: { draftId: 'NARROW-DRAFT', note: '已保存' } })); return 'saved' } })
      const saved = await repository.readCuttingRecords()
      const after = { fullReads, preserved: saved.records.find(row => row.id === unrelated.id), draft: JSON.parse(parts.partTicketStorage.getItem(key)!) }
      await repository.commitCuttingRecords({ revision: saved.revision, change: { puts: [{ ...marker, value: { ...marker.value, phase: 'COPYING', count: 1, copied: 0, ids: ['unfinished'] } }] }, command: { id: 'PART-READ-BLOCKED', intent: '隔离未完迁移', result: null, at: '2026-10-22T00:00:00Z' } })
      let rejected = ''
      try { await parts.hydratePartTicketRecords(await repository.readCuttingRecordsByPrefix('part-ticket')) } catch (error) { rejected = String(error) }
      return { read, after, rejected, readyAfterFailure: parts.isPartTicketReady(), unrelated }
    })
    assert.equal(result.read.fullReads, 0)
    assert.equal(result.read.boundedReads, 1)
    assert.equal(result.read.writes, 0)
    assert.equal(result.read.revision, 1)
    assert.deepEqual(result.read.ids.sort(), ['part-ticket-migration:cuttingFeiTicketRecords', 'part-ticket:drafts:draft'].sort())
    assert.equal(result.read.draft.draft.note, '原草稿')
    assert.ok(result.after.fullReads >= 2, '真正保存仍恢复完整原库，不将限定快照当作全部资料')
    assert.deepEqual(result.after.preserved, result.unrelated)
    assert.equal(result.after.draft.draft.note, '已保存')
    assert.match(result.rejected, /迁移尚未完成/)
    assert.equal(result.readyAfterFailure, false)
  } finally { await context.close(); await browser.close() }
})

test('后道七类生产来源与样衣明确隔离：范围快照不能冒充完整准备，后续保存完整回读且不删原样衣', {timeout:60000}, async()=>{
 const browser=await chromium.launch({headless:true}),context=await browser.newContext(),page=await context.newPage()
 try{
  await context.addInitScript(()=>{(globalThis as any).__name=(value:unknown)=>value})
  await page.route('**/__quality-finishing-scope-contract',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'}))
  await page.goto(base+'/__quality-finishing-scope-contract')
  const result=await page.evaluate(async()=>{
   const p=await import('/src/data/fcs/production-context-records.ts'),r=await import('/src/data/fcs/cutting/cutting-record-repository.ts')
   const runtimeKey=p.PRODUCTION_CONTEXT_KEYS.runtime,sampleKey=p.PRODUCTION_CONTEXT_KEYS.samples
   const sample={assignmentId:'KEEP-ASSIGNMENT',qualitySchemaVersion:1,sample:{assignmentId:'KEEP-ASSIGNMENT',sampleId:'KEEP-SAMPLE',factoryId:'KEEP-FACTORY',runtimeTaskId:'KEEP-TASK',productionOrderId:'KEEP-ORDER',status:'WAITING_PPIC_RECEIVE'},suggestionVersions:[],untouched:{note:'原样衣及历史全文不可删'}}
   const records=[...p.decodeProductionContextRecords(runtimeKey,JSON.stringify({version:1,taskOverrides:[],splitPlans:[],mergedPlans:[],reassignedTasks:[],auditSeq:7})),...p.decodeProductionContextRecords(sampleKey,JSON.stringify({version:3,records:[sample],commands:[],sequence:12})),{id:'unrelated:keep',collection:'unrelated',value:{unchanged:true}}]
   await r.commitCuttingRecords({revision:0,change:{puts:records},command:{id:'finishing-scope-seed',intent:'隔离范围验证原数据',result:null,at:'2026-10-22T00:00:00Z'}})
   let writes=0;const original=IDBDatabase.prototype.transaction
   IDBDatabase.prototype.transaction=function(...args){const tx=original.apply(this,args);if(tx.mode==='readwrite')writes++;return tx}
   let scopedReadTransactions=0;const request=IDBIndex.prototype.getAll;IDBIndex.prototype.getAll=function(...args){scopedReadTransactions++;return request.apply(this,args)}
   let sampleChanges=0;p.onProductionContextChanged(sampleKey,()=>{sampleChanges++})
   const partial=await r.readPostFinishingProductionRecords()
   await p.hydratePostFinishingProductionContextRecords(partial)
   const firstReadTransactions=scopedReadTransactions
   await p.hydratePostFinishingProductionContextRecords()
   const repeatReadTransactions=scopedReadTransactions
   const read={scope:partial.readScope,ids:partial.records.map(row=>row.id),ready:p.isProductionContextReady(),runtimeReady:p.isProductionContextReady(runtimeKey),sampleReady:p.isProductionContextReady(sampleKey),runtime:JSON.parse(p.productionContextStorage.getItem(runtimeKey)!),writes,sampleChanges}
   let rejected='';try{p.productionContextStorage.getItem(sampleKey)}catch(error){rejected=String(error)}
   let initializationRejected='';try{p.productionContextInitializationRecords()}catch(error){initializationRejected=String(error)}
   await r.commitCuttingRecords({revision:1,change:{puts:p.decodeProductionContextRecords(runtimeKey,JSON.stringify({version:1,taskOverrides:[],splitPlans:[],mergedPlans:[],reassignedTasks:[],auditSeq:9}))},command:{id:'scope-external-change',intent:'另一标签页更新原任务',result:null,at:'2026-10-22T00:00:01Z'}})
   await p.hydratePostFinishingProductionContextRecords()
   const refreshed={auditSeq:JSON.parse(p.productionContextStorage.getItem(runtimeKey)!).auditSeq,sampleReady:p.isProductionContextReady(sampleKey),sampleChanges}
   await p.hydrateProductionContextRecords(partial)
   const restored=JSON.parse(p.productionContextStorage.getItem(sampleKey)!)
   const fullReady=p.isProductionContextReady()
   await p.saveProductionContextAction({id:'finishing-scope-save',intent:'只改原任务序号，保留独立样衣',capture:()=>null,restore:()=>{},action:()=>{p.productionContextStorage.setItem(runtimeKey,JSON.stringify({...JSON.parse(p.productionContextStorage.getItem(runtimeKey)!),auditSeq:8}));return 'saved'}})
   const after=await r.readCuttingRecords()
   return{read,firstReadTransactions,repeatReadTransactions,refreshed,rejected,initializationRejected,restored,fullReady,after:after.records.filter(row=>row.id.startsWith('production-context:sample')||row.id==='unrelated:keep'),expected:records.filter(row=>row.id.startsWith('production-context:sample')||row.id==='unrelated:keep'),runtime:JSON.parse(p.productionContextStorage.getItem(runtimeKey)!)}
  })
  assert.equal(result.read.scope,'POST_FINISHING_WITHOUT_SAMPLES');assert.equal(result.read.ready,false);assert.equal(result.read.runtimeReady,true);assert.equal(result.read.sampleReady,false);assert.equal(result.read.writes,0);assert.equal(result.read.sampleChanges,0)
  assert.ok(result.read.ids.includes('unrelated:keep'));assert.ok(!result.read.ids.some(id=>id.startsWith('production-context:sample')))
  assert.equal(result.repeatReadTransactions,result.firstReadTransactions,'同版本只核对修订号，不重复读取七类正文');assert.deepEqual(result.refreshed,{auditSeq:9,sampleReady:false,sampleChanges:0});
  assert.equal(result.read.runtime.auditSeq,7);assert.match(result.rejected,/尚未读取/);assert.match(result.initializationRejected,/完整生产来源/)
  assert.equal(result.fullReady,true);assert.equal(result.restored.records[0].sample.sampleId,'KEEP-SAMPLE');assert.equal(result.restored.sequence,12)
  assert.deepEqual(result.after.sort((a,b)=>a.id.localeCompare(b.id)),result.expected.sort((a,b)=>a.id.localeCompare(b.id)));assert.equal(result.runtime.auditSeq,8)
 }finally{await context.close();await browser.close()}
})

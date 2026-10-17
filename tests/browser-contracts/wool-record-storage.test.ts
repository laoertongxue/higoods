import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { createServer } from 'vite'
import { chromium } from '@playwright/test'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const ownedServer = process.env.WOOL_STORAGE_TEST_URL ? undefined : await createServer({ server: { host: '127.0.0.1', port: 0, strictPort: true, hmr: false, watch: { ignored: ['**/*'] } } })
await ownedServer?.listen()
after(async () => { await ownedServer?.close() })
const address = ownedServer?.httpServer?.address()
const base = process.env.WOOL_STORAGE_TEST_URL || `http://127.0.0.1:${typeof address === 'object' && address ? address.port : ''}`
const evidenceDir = resolve(process.env.WOOL_STORAGE_EVIDENCE_DIR || 'output/verification/wool-storage')
async function evidence(name: string, value: unknown): Promise<void> {
  await mkdir(evidenceDir, {recursive:true})
  await writeFile(resolve(evidenceDir, name+'.json'), JSON.stringify({base,capturedAt:new Date().toISOString(),value},null,2))
}

// Build authentic historical facts from their immutable source version. Nothing
// historical is seeded into a user's browser or retained in the current source.
async function readLegacyFixture() {
  if (process.env.WOOL_LEGACY_FIXTURE_PATH) return JSON.parse(await readFile(process.env.WOOL_LEGACY_FIXTURE_PATH, 'utf8'))
  const legacyRoot = await mkdtemp(join(tmpdir(), 'higoods-wool-legacy-'))
  const sourceCommit = '821b9ea54040ec03662acbe6ae3d2c62608fe273'
  try {
    const archive = execFileSync('git', ['archive', sourceCommit, 'src', 'package.json'], { maxBuffer: 64 * 1024 * 1024 })
    execFileSync('tar', ['-x', '-C', legacyRoot], { input: archive })
    await symlink(resolve('node_modules'), join(legacyRoot, 'node_modules'), 'dir')
    const generator = `import{readWoolStore}from${JSON.stringify(join(legacyRoot, 'src/data/fcs/wool-domain/store.ts'))};import{captureFactoryReceivingData}from${JSON.stringify(join(legacyRoot, 'src/data/fcs/factory-receiving.ts'))};console.log(JSON.stringify({sourceCommit:${JSON.stringify(sourceCommit)},wool:readWoolStore(),receiving:captureFactoryReceivingData()}));`
    return JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', generator], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }))
  } finally { await rm(legacyRoot, { recursive: true, force: true }) }
}

test('毛织首次只读、逐记录保存、shared receiving原子中止与刷新回读', {timeout:180000}, async () => {
  const browser=await chromium.launch({headless:true})
  const context=await browser.newContext()
  const page=await context.newPage()
  await page.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
  try {
    await page.goto(base+'/fcs/craft/wool/knitting-orders')
    await page.locator('[data-wool-work-orders-root]').waitFor()
    const result=await page.evaluate(async()=>{
      const store=await import('/src/data/fcs/wool-domain/store.ts')
      const commands=await import('/src/data/fcs/wool-domain/commands.ts')
      const receiving=await import('/src/data/fcs/factory-receiving.ts')
      const db=await import('/src/data/pcs-record-db.ts')
      const key=store.WOOL_DOMAIN_STORE_KEY
      const records=()=>db.readPcsRecords().then(x=>x.records.filter(row=>row.id.startsWith(key+'/')||row.id.startsWith('higood-pcs-fcs-design-revision-receiving-v1/')))
      const initial=await records()
      const before=JSON.stringify(store.readWoolStore()),beforeReceiving=JSON.stringify(receiving.captureFactoryReceivingData())
      const order=store.readWoolStore().workOrders['WOOL-STAGE-008:KNITTING']
      const input={commandId:'atomic-wool-handover',outputSkuCode:order.outputPlanLines[0].outputSkuCode,pieceKey:order.externalPieces[0].pieceKey,handoverQty:5,handedOverAt:'2026-10-17 12:00:00',handedOverBy:'存储验收'}
      const put=IDBObjectStore.prototype.put
      IDBObjectStore.prototype.put=function(...args:Parameters<typeof put>){if(this.name==='records')throw new DOMException('模拟事务失败','QuotaExceededError');return put.apply(this,args)}
      let failure=''
      try{await store.runWoolRecordCommand(()=>commands.addWoolHandover(order.woolOrderId,input))}catch(error){failure=String(error)}finally{IDBObjectStore.prototype.put=put}
      const rolledBack=before===JSON.stringify(store.readWoolStore())&&beforeReceiving===JSON.stringify(receiving.captureFactoryReceivingData())
      const afterFailure=await records()
      let duringSource: string | undefined
      const saved=await store.runWoolRecordCommand(()=>{const saved=commands.addWoolHandover(order.woolOrderId,input);duringSource=receiving.listFactoryReceivingSources(undefined,true).find(source=>source.originalRecordId===saved.handoverId)?.id;return saved})
      const after=await records()
      const raw=localStorage.getItem(key)
      return {initial:initial.length,failure,rolledBack,afterFailure:afterFailure.length,savedId:saved.handoverId,duringSource,rows:after.map(row=>({id:row.id,value:row.value,deleted:row.deleted})),legacyRaw:raw,receivingSource:receiving.listFactoryReceivingSources(undefined,true).find(source=>source.originalRecordId===saved.handoverId)?.id}
    })
    assert.equal(result.initial,0,'ordinary reads must not persist seeds')
    assert.match(result.failure, /空间不足.*未保存|模拟事务失败/)
    assert.equal(result.rolledBack,true)
    assert.equal(result.afterFailure,0)
    assert.equal(result.legacyRaw,null)
    assert.ok(result.receivingSource,JSON.stringify({duringSource:result.duringSource,ids:result.rows.map(row=>row.id)}))
    assert.ok(result.rows.some(row=>row.id.includes('/handovers/')&&row.id.includes(encodeURIComponent(result.savedId))))
    assert.equal(result.rows.filter(row=>row.id.includes('/workOrders/')).length,0,'unchanged seed orders must not be copied')
    assert.ok(result.rows.some(row=>row.id.startsWith('higood-pcs-fcs-design-revision-receiving-v1/')&&JSON.stringify(row.value).includes(result.receivingSource!)))
    await page.reload();await page.locator('[data-wool-work-orders-root]').waitFor()
    const reread=await page.evaluate(async id=>{const s=await import('/src/data/fcs/wool-domain/store.ts');const r=await import('/src/data/fcs/factory-receiving.ts');return {handover:s.readWoolStore().handovers.find(h=>h.handoverId===id)?.handoverQty,source:r.listFactoryReceivingSources(undefined,true).some(source=>source.originalRecordId===id)}},result.savedId)
    assert.deepEqual(reread,{handover:5,source:true})
    const downstream=await context.newPage()
    await downstream.goto(base+'/fcs/craft/cutting/warehouse-management/wait-handover')
    await downstream.waitForFunction(()=>document.body.innerText.includes('待交出')&&!document.body.innerText.includes('正在加载页面'))
    const direct=await downstream.evaluate(async id=>{const s=await import('/src/data/fcs/wool-domain/store.ts');return s.readWoolStoreForCuttingReceipts().handovers.find(row=>row.handoverId===id)?.handoverQty},result.savedId)
    assert.equal(direct,5,'fresh downstream entry must hydrate saved wool facts independently')
    await evidence('atomic-and-downstream', {result,reread,direct,downstreamUrl:downstream.url()})
    await downstream.screenshot({path:resolve(evidenceDir,'direct-cutting-read.png'),fullPage:true})
    await downstream.close()
  } finally {await context.close();await browser.close()}
})

test('毛织实际Web保存失败保留弹窗输入，恢复后完成事务并刷新回读', {timeout:180000},async()=>{
  const browser=await chromium.launch({headless:true}),context=await browser.newContext(),page=await context.newPage()
  await page.addInitScript(()=>{(globalThis as any).__name=(value:unknown)=>value})
  try{
    await page.goto(base+'/fcs/craft/wool/knitting-orders');await page.locator('[data-wool-work-orders-root]').waitFor()
    const before=await page.evaluate(async()=>JSON.stringify((await import('/src/data/fcs/wool-domain/store.ts')).readWoolStore()))
    await page.locator('[data-wool-work-orders-action="open-report"][data-wool-order-id="WOOL-STAGE-002:KNITTING"]').click()
    await page.locator('[data-wool-dialog-field="qty"]').fill('2')
    await page.evaluate(()=>{(globalThis as any).__woolOriginalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args:any[]){if(this.name==='records')throw new DOMException('full','QuotaExceededError');return (globalThis as any).__woolOriginalPut.apply(this,args)}})
    await page.locator('[data-wool-work-orders-action="save-report"]').click()
    await page.waitForFunction(()=>document.querySelector('[data-wool-overlay-error]')?.textContent?.includes('未保存'))
    assert.equal(await page.locator('[data-wool-dialog-field="qty"]').inputValue(),'2')
    assert.equal(await page.evaluate(async()=>JSON.stringify((await import('/src/data/fcs/wool-domain/store.ts')).readWoolStore())),before)
    await mkdir(evidenceDir,{recursive:true})
    const failure={error:await page.locator('[data-wool-overlay-error]').textContent(),qty:await page.locator('[data-wool-dialog-field="qty"]').inputValue(),cachePreserved:true}
    await page.screenshot({path:resolve(evidenceDir,'web-save-failure-input-retained.png'),fullPage:true})
    await page.evaluate(()=>{IDBObjectStore.prototype.put=(globalThis as any).__woolOriginalPut})
    await page.locator('[data-wool-work-orders-action="save-report"]').click()
    await page.waitForFunction(()=>!document.querySelector('[data-wool-business-dialog]'))
    const qty=()=>page.evaluate(async()=>{const s=await import('/src/data/fcs/wool-domain/store.ts');return s.readWoolStore().processReports.filter(row=>row.woolOrderId==='WOOL-STAGE-002:KNITTING').reduce((sum,row)=>sum+row.reportedQty,0)})
    const saved=await qty();assert.ok(saved>=2)
    await page.reload();await page.locator('[data-wool-work-orders-root]').waitFor();assert.equal(await qty(),saved)
    await evidence('web-failure-and-retry',{failure,saved,reread:await qty()})
  }finally{await context.close();await browser.close()}
})

test('旧wool源只读规范、显式升级逐记录读回，验证后方可finalize', {timeout:180000}, async()=>{
  const browser=await chromium.launch({headless:true}),context=await browser.newContext(),page=await context.newPage()
  await page.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
  try{
    await page.goto(base+'/fcs/craft/wool/knitting-orders');await page.locator('[data-wool-work-orders-root]').waitFor()
    const original=await page.evaluate(async()=>{const s=await import('/src/data/fcs/wool-domain/store.ts');const value=s.readWoolStore();const order=Object.values(value.workOrders).find(o=>o.externalPieces.length)!;const node=order.externalPieces[0].routeNodes[0];node.craftCode='CRAFT_'+3000004;const raw=JSON.stringify(value);localStorage.setItem(s.WOOL_DOMAIN_STORE_KEY,raw);return {raw,id:order.woolOrderId,entry:node.sourceEntryId,factory:node.factoryId}})
    await page.reload();await page.locator('[data-wool-work-orders-root]').waitFor()
    const result=await page.evaluate(async input=>{
      const s=await import('/src/data/fcs/wool-domain/store.ts'),rt=await import('/src/data/pcs-record-runtime.ts'),db=await import('/src/data/pcs-record-db.ts')
      const key=s.WOOL_DOMAIN_STORE_KEY,read=s.readWoolStore(),node=read.workOrders[input.id].externalPieces[0].routeNodes[0]
      const initial=(await db.readPcsRecords()).records.filter(r=>r.id.startsWith(key+'/')).length
      const rawUnchanged=localStorage.getItem(key)===input.raw
      await rt.upgradePcsLegacyRecords([key])
      const persisted=(await db.readPcsRecords()).records.filter(r=>r.id.startsWith(key+'/'))
      const retained=localStorage.getItem(key)===input.raw
      const codec=await import('/src/data/pcs-record-codec.ts')
      const expected=codec.decodePcsRecordSnapshot(key,input.raw)
      const mismatches=expected.flatMap(row=>{const saved=persisted.find(saved=>saved.id===row.id);return !saved||JSON.stringify(row.value)!==JSON.stringify(saved.value)?[{id:row.id,expected:row.value,saved:saved?.value}]:[]})
      if(mismatches.length)throw Error(JSON.stringify(mismatches.slice(0,2)))
      await rt.finalizePcsLegacyMigration(true)
      return {initial,rawUnchanged,retained,removed:localStorage.getItem(key)===null,code:node.craftCode,entry:node.sourceEntryId,factory:node.factoryId,orders:persisted.filter(r=>r.collection===key+'/workOrders').length,meta:persisted.find(r=>r.id===key+'/meta')?.value}
    },original)
    assert.equal(result.initial,0);assert.equal(result.rawUnchanged,true);assert.equal(result.retained,true);assert.equal(result.removed,true)
    assert.equal(result.code,'CRAFT_'+3000010);assert.equal(result.entry,original.entry);assert.equal(result.factory,original.factory)
    assert.ok(result.orders>=28);assert.equal('workOrders' in (result.meta as {fields:object}).fields,false)
    await page.reload();await page.locator('[data-wool-work-orders-root]').waitFor()
    const code=await page.evaluate(async id=>(await import('/src/data/fcs/wool-domain/store.ts')).readWoolStore().workOrders[id].externalPieces[0].routeNodes[0].craftCode,original.id)
    assert.equal(code,'CRAFT_'+3000010)
    await evidence('legacy-read-upgrade-finalize',{result,code,sourceId:original.id})
  } finally {await context.close();await browser.close()}
})

test('真实旧821b毛织与接收事实冷读保留全部来源实收，历史工厂只读阻断', {timeout:180000}, async()=>{
  const fixture=await readLegacyFixture()
  const browser=await chromium.launch({headless:true}),context=await browser.newContext(),page=await context.newPage()
  await page.addInitScript(()=>{(globalThis as any).__name=(value:unknown)=>value})
  try {
    await page.goto(base+'/fcs/craft/wool/knitting-orders');await page.locator('[data-wool-work-orders-root]').waitFor()
    await page.evaluate(({wool,receiving})=>{localStorage.setItem('higood-fcs-wool-stage-store-v3',JSON.stringify(wool));localStorage.setItem('higood-factory-material-receiving-v1',JSON.stringify(receiving))},fixture)
    await page.reload();await page.locator('[data-wool-work-orders-root]').waitFor()
    const result=await page.evaluate(async input=>{
      const s=await import('/src/data/fcs/wool-domain/store.ts'),r=await import('/src/data/fcs/factory-receiving.ts'),craft=await import('/src/data/fcs/wool-domain/craft-flow.ts'),db=await import('/src/data/pcs-record-db.ts'),ops=await import('/src/data/fcs/special-craft-operations.ts')
      const read=s.readWoolStore(),actual=r.captureFactoryReceivingData()
      const mismatches=['sources','receipts'].flatMap(kind=>input.receiving[kind].flatMap((old:any)=>{const current=(actual as any)[kind].find((row:any)=>row.id===old.id);return JSON.stringify(old)===JSON.stringify(current)?[]:[{kind,id:old.id,old,current}]}))
      const tasks=craft.listWoolCraftTaskOrders(),historic=tasks.filter(task=>task.factoryId==='F090')
      const target=historic.find(task=>task.receivedQty>0)!
      const before=JSON.stringify(read),receivingBefore=JSON.stringify(actual)
      let failure=''
      try{await s.runWoolRecordCommand(()=>craft.executeWoolCraftAction({taskOrderId:target.taskOrderId,actionCode:'SPECIAL_CRAFT_PROCESS_REPORT',qty:1,operatorName:'验收',operatedAt:'2026-10-17 12:00:00',commandId:'old-factory-readonly'}))}catch(error){failure=String(error)}
      return {mismatches,sources:input.receiving.sources.length,receipts:input.receiving.receipts.length,historicalReceipts:actual.receipts.filter(row=>row.factoryId==='F090').length,historicalTasks:historic.map(task=>({id:task.taskOrderId,factory:task.factoryId,received:task.receivedQty,code:task.craftCode})),failure,unchanged:before===JSON.stringify(s.readWoolStore())&&receivingBefore===JSON.stringify(r.captureFactoryReceivingData()),persisted:(await db.readPcsRecords()).records.length,path:ops.buildSpecialCraftTaskDetailPath(target,target.taskOrderId),targetId:target.taskOrderId,rawUnchanged:localStorage.getItem(s.WOOL_DOMAIN_STORE_KEY)===JSON.stringify(input.wool)&&localStorage.getItem(r.FACTORY_RECEIVING_KEY)===JSON.stringify(input.receiving)}
    },fixture)
    assert.deepEqual(result.mismatches,[],'every old source and receipt must retain all original fields')
    assert.equal(result.historicalReceipts,9)
    assert.ok(result.historicalTasks.length)
    assert.ok(result.historicalTasks.some(task=>task.code==='CRAFT_'+3000010&&task.received===100))
    assert.match(result.failure,/历史工厂归属/);assert.equal(result.unchanged,true);assert.equal(result.persisted,0);assert.equal(result.rawUnchanged,true)
    await page.goto(base+result.path)
    await page.locator('[data-wool-craft-detail]').waitFor()
    assert.match(await page.locator('[data-wool-craft-detail]').innerText(),/历史承接工厂.*全能力测试工厂.*不一致/s)
    assert.equal(await page.locator('[data-wool-craft-detail] [data-action-code]').count(),0)
    await evidence('legacy-821b-factory-facts',{sourceCommit:fixture.sourceCommit,result,detailText:await page.locator('[data-wool-craft-detail]').innerText()})
    await page.screenshot({path:resolve(evidenceDir,'legacy-factory-readonly-detail.png'),fullPage:true})
    const migrated=await page.evaluate(async()=>{
      const rt=await import('/src/data/pcs-record-runtime.ts'),db=await import('/src/data/pcs-record-db.ts')
      const keys=['higood-fcs-wool-stage-store-v3','higood-pcs-fcs-design-revision-receiving-v1']
      await rt.upgradePcsLegacyRecords(keys)
      const saved=(await db.readPcsRecords()).records
      await rt.finalizePcsLegacyMigration(true)
      return {orders:saved.filter(row=>row.collection===keys[0]+'/workOrders').length,receiving:saved.filter(row=>row.id.startsWith(keys[1]+'/')).length,woolSourceRemoved:localStorage.getItem(keys[0])===null,remainingReceiving:JSON.parse(localStorage.getItem('higood-factory-material-receiving-v1')||'{}')}
    })
    assert.equal(migrated.orders,28);assert.ok(migrated.receiving>0);assert.equal(migrated.woolSourceRemoved,true)
    assert.equal((migrated.remainingReceiving.sources||[]).some((source:any)=>source.lines?.some((line:any)=>line.woolOrderId||line.woolCraftOrderId)),false)
    await page.reload();await page.locator('[data-wool-craft-detail]').waitFor()
    const readback=await page.evaluate(async input=>{
      const r=await import('/src/data/fcs/factory-receiving.ts'),craft=await import('/src/data/fcs/wool-domain/craft-flow.ts'),actual=r.captureFactoryReceivingData()
      return {mismatches:['sources','receipts'].flatMap(kind=>input.receiving[kind].flatMap((old:any)=>JSON.stringify(old)===JSON.stringify((actual as any)[kind].find((row:any)=>row.id===old.id))?[]:[{kind,id:old.id}])),historicalReceipts:actual.receipts.filter(row=>row.factoryId==='F090').length,conflict:craft.getWoolCraftFactoryConflict(craft.listWoolCraftTaskOrders().find(task=>task.taskOrderId===input.targetId)!)}
    },{receiving:fixture.receiving,targetId:result.targetId})
    assert.deepEqual(readback.mismatches,[]);assert.equal(readback.historicalReceipts,9);assert.match(readback.conflict,/历史承接工厂/)
    await evidence('legacy-821b-shared-migration',{migrated,readback})
  } finally {await context.close();await browser.close()}
})

import assert from 'node:assert/strict'
import test,{before,after} from 'node:test'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {chromium,expect,type Browser,type Page} from '@playwright/test'
const base=process.env.PROTOTYPE_ROLE_TEST_URL||'http://127.0.0.1:43270'
const output=process.env.PROTOTYPE_ROLE_TEST_OUTPUT||'output/verification/prototype-full-function-cleanup/role-tests'
let browser:Browser
const results:Record<string,unknown>={}
before(async()=>{await mkdir(output,{recursive:true});browser=await chromium.launch({headless:true})})
after(async()=>{await browser?.close();await writeFile(output+'/results.json',JSON.stringify({base,at:new Date().toISOString(),results},null,2))})
async function run(name:string,fn:(page:Page)=>Promise<void>){
 const context=await browser.newContext({viewport:{width:1366,height:768}}),page=await context.newPage(),errors:string[]=[]
 page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{(globalThis as any).__name=(v:unknown)=>v})
 try{await fn(page);assert.deepEqual(errors,[]);results[name]={passed:true,errors}}
 catch(error){results[name]={passed:false,error:String(error),errors};await page.screenshot({path:output+'/'+name+'-failure.png',fullPage:true}).catch(()=>{});throw error}
 finally{await context.close()}
}

test('演示角色解析与入驻伪造身份证快捷处理链已删除',async()=>{
 await assert.rejects(readFile('src/data/fcs/action-permissions.ts','utf8'),{code:'ENOENT'})
 const pda=await readFile('src/pages/pda-handover-detail.ts','utf8')
 assert.doesNotMatch(pda,/resolveFcsDemoRole|demoRole|action-permissions/)
 assert.match(pda,/canWaterSolubleRolePerform/);assert.match(pda,/canPdaFactoryAccessHandoverHead/)
 const progress=await readFile('src/pages/progress-material.ts','utf8')
 assert.doesNotMatch(progress,/warehouseActor|原型角色演示/)
 assert.match(progress,/qty > line.preparedQty/);assert.match(progress,/targetFactoryId: doc.targetFactoryId/)
 assert.doesNotMatch(await readFile('src/pages/pda-onboarding.ts','utf8'),/use-demo-identity-file|IDF-DEMO-/)
})

test('通用静态Mock交接忽略URL和DOM演示角色，数量校验及原会话边界保留',{timeout:90000},async()=>run('handover',async page=>{
 await page.goto(base+'/fcs/progress/material')
 await page.locator('main').waitFor()
 const seed=await page.evaluate(async()=>{
  const e=await import('/src/data/fcs/pda-handover-events.ts'),pda=await import('/src/data/fcs/store-domain-pda.ts')
  const head=e.getPdaHandoutHeads().find(h=>h.handoverId==='HOH-MOCK-IRON-PACK-404')!
  const record=e.getPdaHandoverRecordsByHead(head.handoverId).find(r=>r.status==='PENDING_WRITEBACK')!
  if(!record)throw Error('No pending receipt fixture')
  const user=pda.listFactoryPdaUsers(head.factoryId).find(u=>u.status==='ACTIVE'&&u.roleId==='ROLE_ADMIN')||pda.listFactoryPdaUsers(head.factoryId).find(u=>u.status==='ACTIVE')
  if(user)localStorage.setItem('fcs_pda_session',JSON.stringify(pda.createPdaSessionFromUser(user)))
  return {head:head.handoverId,id:record.recordId,qty:record.submittedQty||record.plannedQty}
 })
 await page.goto(base+'/fcs/pda/handover/'+encodeURIComponent(seed.head)+'?demoRole=VIEWER')
 const open=page.locator(`[data-pda-handoverd-action="open-receiver-writeback"][data-record-id="${seed.id}"]`)
 await expect(open).toBeVisible();await open.click()
 await page.locator('[data-pda-handoverd-field="writebackQty"]').fill('-1')
 await page.locator('[data-pda-handoverd-action="submit-receiver-writeback"]').click()
 await expect(page.getByText('请先填写有效实收对象数量',{exact:true})).toBeVisible()
 assert.equal(await page.evaluate(async id=>(await import('/src/data/fcs/pda-handover-events.ts')).findPdaHandoverRecord(id)?.receiverWrittenQty,seed.id),undefined)
 await page.evaluate(()=>{document.body.dataset.demoRole='VIEWER'})
 await page.locator('[data-pda-handoverd-field="writebackQty"]').fill(String(seed.qty))
 await page.locator('[data-pda-handoverd-action="submit-receiver-writeback"]').click()
 await expect.poll(()=>page.evaluate(async id=>(await import('/src/data/fcs/pda-handover-events.ts')).findPdaHandoverRecord(id)?.receiverWrittenQty,seed.id)).toBe(seed.qty)
 await page.reload()
 await page.locator(`[data-handout-record-id="${seed.id}"]`).waitFor({state:"attached"})
 assert.equal(await page.evaluate(async id=>(await import('/src/data/fcs/pda-handover-events.ts')).findPdaHandoverRecord(id)?.receiverWrittenQty,seed.id),undefined)
 // 静态通用Mock本来只在当前会话变化；正式水溶流程的持久回读由Task9集成测试覆盖。
}))

test('物料进度无需演示身份即可登记，姓名、超配量和未分配工厂继续阻断',{timeout:90000},async()=>run('material-handover',async page=>{
 await page.goto(base+'/fcs/progress/material');await page.locator('main').waitFor()
 const seed=await page.evaluate(async()=>{
  const w=await import('/src/data/fcs/warehouse-material-execution.ts'),e=await import('/src/data/fcs/pda-handover-events.ts')
  const doc=w.listWarehouseIssueOrders().find(d=>d.id==='ISSUE-LLXQ2026030001')!
  const line=doc.lines[0],head=e.getPdaPickupHeads().find(h=>h.sourceDocId===doc.id)!
  const record=e.getPdaPickupRecordsByHead(head.handoverId).find(r=>r.recordId===`PKR-${doc.id}-001`)!
  return {doc:doc.id,po:doc.productionOrderId,line:line.lineId,prepared:line.preparedQty,record:record.recordId,before:record.warehouseHandedQty}
 })
 await page.goto(base+'/fcs/progress/material?po='+encodeURIComponent(seed.po)+'&docId='+encodeURIComponent(seed.doc))
 await expect(page.locator('[data-material-field="warehouseActor"]')).toHaveCount(0)
 const button=page.locator(`[data-material-action="warehouse-handout"][data-line-id="${seed.line}"]`)
 await expect(button).toBeEnabled()
 let answers:(string|null)[]=['', '验收仓管',String(seed.prepared+1),'验收仓管','2', 'accept']
 const messages:string[]=[]
 page.on('dialog',async d=>{messages.push(d.message());if(d.type()==='alert'){await d.accept();return}const answer=answers.shift();if(answer===null)await d.dismiss();else await d.accept(answer||'')})
 await button.click()
 await expect.poll(()=>messages.length).toBe(1)
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))))
 assert.equal(await page.evaluate(async id=>(await import('/src/data/fcs/pda-handover-events.ts')).findPdaPickupRecord(id)?.warehouseHandedQty,seed.record),seed.before)
 await button.click()
 await expect.poll(()=>messages.length).toBe(4)
 assert(messages.some(m=>m.includes('不能超过已确认配料')))
 assert.equal(await page.evaluate(async id=>(await import('/src/data/fcs/pda-handover-events.ts')).findPdaPickupRecord(id)?.warehouseHandedQty,seed.record),seed.before)
 await button.click()
 await expect.poll(()=>messages.length).toBe(8)
 assert(messages.some(m=>m.includes('确认由 验收仓管')))
 assert(messages.some(m=>m.includes('接收工厂已变化')))
 assert(!messages.some(m=>m.includes('实际交付已保存')))
 assert.equal(await page.evaluate(async id=>(await import('/src/data/fcs/pda-handover-events.ts')).findPdaPickupRecord(id)?.warehouseHandedQty,seed.record),seed.before)
 await page.reload()
 await page.locator('[data-material-action="close-drawer"]').first().waitFor()
 assert.equal(await page.evaluate(async id=>(await import('/src/data/fcs/pda-handover-events.ts')).findPdaPickupRecord(id)?.warehouseHandedQty,seed.record),seed.before)
}))


test('入驻直接使用真实文件选择，空资料仍校验',{timeout:90000},async()=>run('onboarding-file',async page=>{
 await page.goto(base+'/fcs/pda/auth/onboarding')
 await expect(page.locator('[data-pda-onboarding-file="identityFile"]')).toBeAttached({timeout:20000})
 await expect(page.getByRole('button',{name:'使用演示身份文件'})).toHaveCount(0)
 await page.locator('[data-pda-onboarding-action="submit"]').click()
 await expect(page.getByText('请填写工厂简称',{exact:true})).toBeVisible()
 await page.locator('[data-pda-onboarding-file="identityFile"]').setInputFiles({name:'identity-test.pdf',mimeType:'application/pdf',buffer:Buffer.concat([Buffer.from('%PDF-1.4\n'),Buffer.alloc(16*1024,32),Buffer.from('\n%%EOF')])})
 await expect(page.locator('body')).toContainText('当前文件：identity-test.pdf')
 await page.locator('[data-pda-onboarding-action="submit"]').click()
 await expect(page.getByText('请填写工厂简称',{exact:true})).toBeVisible()
}))

test('裁床报表总是直接展示Mock，URL不能关闭数据',{timeout:90000},async()=>run('report-mode',async page=>{
 await page.goto(base+'/fcs/craft/cutting/statistics/daily-production')
 await page.locator('[data-testid="cutting-daily-production-report-page"]').first().waitFor()
 const before=await page.locator('main').innerText()
 await page.goto(base+'/fcs/craft/cutting/statistics/daily-production?includeDemoData=0')
 await page.locator('[data-testid="cutting-daily-production-report-page"]').first().waitFor()
 assert.equal(await page.locator('main').innerText(),before)
}))

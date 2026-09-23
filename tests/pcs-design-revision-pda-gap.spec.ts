import { test, expect } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

async function fixture(stage: string, factoryId: string) {
  const values: Record<string, string> = JSON.parse(await readFile(`output/playwright/design-revision-gap/fixtures/${stage}.json`, 'utf8'))
  values.fcs_pda_session = JSON.stringify({userId:`${factoryId}_operator`,loginId:`${factoryId}_operator`,userName:'设计改款验收操作员',roleId:'ROLE_OPERATOR',factoryId,factoryName:factoryId,loggedAt:'2026-09-24 09:00:00'})
  const orders = JSON.parse(values['higoods.formal-print-execution.v1']).state.workOrders as [string, {sourceType:string,taskId:string}][]
  const order = orders.find(([,o])=>o.sourceType==='DESIGN_REVISION')!
  return { values, orderId:order[0], taskId:order[1].taskId }
}

test('设计改款印花 PDA 使用实际领料和工序事实，不出现花型测试或无关转印', async ({browser, baseURL}, info) => {
  const samples: Record<string, number[]> = {}
  for(let round=0;round<5;round++){
  const {values, orderId, taskId} = await fixture('print-received','FAC-FLOWER')
  const context=await browser.newContext({viewport:{width:390,height:844},storageState:{cookies:[],origins:[{origin:new URL(baseURL!).origin,localStorage:Object.entries(values).map(([name,value])=>({name,value}))}]}})
  const page=await context.newPage()
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  const measure = async (key: string, run: () => Promise<void>) => {
    await page.evaluate(() => document.addEventListener('click', e => (window as any).__start = e.timeStamp, { capture: true, once: true }))
    await run()
    const ms = await page.evaluate(async () => {
      await Promise.all([...document.images].filter(i => {const r=i.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0}).map(i=>i.decode()))
      await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())))
      return performance.now()-(window as any).__start
    });(samples[key]??=[]).push(ms)
    await writeFile(info.outputPath('performance.json'),JSON.stringify({samples,distSha:createHash('sha256').update(await readFile('dist/index.html')).digest('hex')},null,2))
  }
  const responses=['20','20','20','1','1','0']
  page.on('dialog',d=>d.accept(responses.shift() ?? ''))
  await page.goto(`${baseURL}/fcs/pda/exec/${taskId}`)
  await expect(page.getByText('设计改款任务号',{exact:true})).toBeVisible()
  await expect(page.getByRole('heading',{name:'花型测试',exact:true})).toHaveCount(0)
  await expect(page.getByRole('heading',{name:'转印',exact:true})).toHaveCount(0)
  await expect(page.getByText('待调色测试',{exact:true})).toHaveCount(0)
  const start=page.locator('[data-pda-execd-action="print-start-printing"]')
  await expect(start).toBeEnabled()
  await measure('startPrint', async()=>{ await start.click(); await expect(page.locator('[data-pda-execd-action="print-complete-printing"]')).toBeEnabled() })
  await measure('completePrint',async()=>{ await page.locator('[data-pda-execd-action="print-complete-printing"]').click(); await expect(page.locator('[data-pda-execd-action="print-register-output"]')).toBeEnabled() })
  await measure('registerOutput',async()=>{ await page.locator('[data-pda-execd-action="print-register-output"]').click(); await expect(page.locator('[data-pda-execd-action="print-start-printing"]')).toBeDisabled() })
  const saved=await page.evaluate(id=>{
    const data=JSON.parse(localStorage.getItem('higoods.formal-print-execution.v1')!)
    return data.state.workOrders.find(([key]:[string])=>key===id)[1]
  },orderId)
  expect(saved.businessView.actualInput.usedQty).toBe(20)
  expect(saved.businessView.output.completedQty).toBe(20)
  expect(saved.businessView.output.completedRollCount).toBe(1)
  expect(saved.businessView.productionActions.map((a:{stage:string})=>a.stage)).toEqual(['PRINT','PRINT'])
  expect(saved.businessView.productionBatches.at(-1).lossQty).toBe(0)
  await page.reload()
  await expect(page.locator('[data-pda-execd-action="print-start-printing"]')).toBeDisabled()
  await expect(page.getByRole('heading',{name:'转印',exact:true})).toHaveCount(0)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390)
  expect(errors).toEqual([])
  await context.close()
  }
  for(const [key,values] of Object.entries(samples))for(const ms of values)expect(ms,key).toBeLessThan(500)
})

test('设计改款 PDA 完单后交出状态一致，禁止再次交出',async({browser,baseURL})=>{
 const {values,taskId}=await fixture('completed','FAC-FLOWER')
 const context=await browser.newContext({viewport:{width:390,height:844},storageState:{cookies:[],origins:[{origin:new URL(baseURL!).origin,localStorage:Object.entries(values).map(([name,value])=>({name,value}))}]}})
 const page=await context.newPage();await page.goto(`${baseURL}/fcs/pda/exec/${taskId}`)
 await expect(page.getByText('已部分交出',{exact:true})).toHaveCount(0)
 await expect(page.locator('[data-pda-execd-action="print-submit-handover"]')).toBeDisabled()
 const add=page.locator('[data-pda-execd-action="new-handover-record"]')
 for(let i=0;i<await add.count();i++)await expect(add.nth(i)).toBeDisabled()
 await expect(page.locator('[data-pda-execd-action="print-start-printing"]')).toBeDisabled()
 await context.close()
})

 test('设计改款染色 PDA 完单后全部加工入口禁用',async({browser,baseURL})=>{
 const {values}=await fixture('completed','F090')
 const dye=JSON.parse(values['higoods.formal-dye-execution.v1']).state.workOrders.find(([,o]:[string,{sourceType:string}])=>o.sourceType==='DESIGN_REVISION')[1]
 const context=await browser.newContext({viewport:{width:390,height:844},storageState:{cookies:[],origins:[{origin:new URL(baseURL!).origin,localStorage:Object.entries(values).map(([name,value])=>({name,value}))}]}})
 const page=await context.newPage();await page.goto(`${baseURL}/fcs/pda/exec/${dye.taskId}`)
 const actions=page.locator('[data-pda-execd-action^="dye-start"],[data-pda-execd-action^="dye-complete"],[data-pda-execd-action="dye-plan-vat"]')
 await expect(actions.first()).toBeVisible();expect(await actions.count()).toBeGreaterThan(0)
 for(let i=0;i<await actions.count();i++)await expect(actions.nth(i)).toBeDisabled()
 await context.close()
})

for (const craft of ['dye','print']) test(`${craft} 设计改款产出就绪后仅允许逐卷交出`, async ({browser,baseURL},info)=>{
 const samples:number[]=[]
 for(let round=0;round<5;round++){
  const values:Record<string,string>=JSON.parse(await readFile(`output/playwright/design-revision-gap/fixtures/${craft}-output-ready.json`,'utf8'))
  const factoryId=craft==='dye'?'F090':'FAC-FLOWER'
  values.fcs_pda_session=JSON.stringify({userId:`${factoryId}_operator`,loginId:`${factoryId}_operator`,userName:'验收操作员',roleId:'ROLE_OPERATOR',factoryId,factoryName:factoryId,loggedAt:'2026-09-24 09:00:00'})
  const order=JSON.parse(values[`higoods.formal-${craft}-execution.v1`]).state.workOrders.find(([,o]:any)=>o.sourceType==='DESIGN_REVISION')[1]
  const c=await browser.newContext({viewport:{width:390,height:844},storageState:{cookies:[],origins:[{origin:new URL(baseURL!).origin,localStorage:Object.entries(values).map(([name,value])=>({name,value}))}]}}),p=await c.newPage()
  await p.goto(`${baseURL}/fcs/pda/exec/${order.taskId}`)
  if(craft==='print'){
   await expect(p.locator('[data-pda-execd-action="print-submit-handover"]').first()).toBeDisabled()
   await expect(p.locator('[data-pda-execd-action="print-submit-handover"]:enabled')).toHaveCount(0)
   await expect(p.getByText('请在管理端印花待交出列表逐卷建单、扫码并确认交出。',{exact:true}).first()).toBeVisible()
  }else{
   await expect(p.locator('[data-pda-execd-action="go-dye-pending-handover"]')).toBeVisible()
   await expect(p.locator('[data-pda-execd-action="dye-submit-handover"]:enabled')).toHaveCount(0)
  }
  await p.evaluate(()=>document.addEventListener('click',e=>(window as any).__start=e.timeStamp,{once:true,capture:true}))
  await p.locator('[data-pda-tab="exec"]').click()
  await expect(p.locator('[data-pda-exec-action="switch-tab"]').first()).toBeVisible()
  samples.push(await p.evaluate(async()=>{await Promise.all([...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0}).map(i=>i.decode()));await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));return performance.now()-(window as any).__start}))
  await c.close()
 }
 await writeFile(info.outputPath('performance.json'),JSON.stringify({craft,samples,distSha:createHash('sha256').update(await readFile('dist/index.html')).digest('hex')},null,2))
 for(const ms of samples)expect(ms).toBeLessThan(500)
})

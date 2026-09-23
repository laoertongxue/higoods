import { test, expect } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

for (const [craft,factory] of [['dye','F090'],['print','FAC-FLOWER']]) test(`${craft} PDA 设计改款加工单接单与刷新持久化五次`,async({browser,baseURL},info)=>{
  const samples:number[]=[],errors:string[]=[]
  for(let round=0;round<5;round++){
    const values=JSON.parse(await readFile(`output/playwright/design-revision-gap/fixtures/${craft}-assigned.json`,'utf8'))
    const key=`higoods.formal-${craft}-execution.v1`
    const order=JSON.parse(values[key]).state.workOrders.find(([,o]:any)=>o.sourceType==='DESIGN_REVISION')[1]
    values.fcs_pda_session=JSON.stringify({userId:`${factory}_operator`,loginId:`${factory}_operator`,userName:'设计改款验收',roleId:'ROLE_OPERATOR',factoryId:factory,factoryName:factory,loggedAt:'2026-09-24 09:00:00'})
    const context=await browser.newContext({viewport:{width:390,height:844},storageState:{cookies:[],origins:[{origin:new URL(baseURL!).origin,localStorage:Object.entries(values).map(([name,value])=>({name,value:String(value)}))}]}})
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
    await page.goto(`${baseURL}/fcs/pda/task-receive/${order.taskId}?tab=pending-accept`)
    const accept=page.locator('[data-pda-trd-action="accept"]');await expect(accept).toBeEnabled()
    await page.evaluate(()=>document.addEventListener('click',e=>sessionStorage.setItem('accept-start',String(performance.timeOrigin+e.timeStamp)),{capture:true,once:true}))
    await accept.click();await expect(page).toHaveURL(/\/fcs\/pda\/task-receive(?:\?|$)/)
    await expect(page.locator('[data-pda-tr-action="switch-tab"]').first()).toBeVisible()
    samples.push(await page.evaluate(async()=>{await Promise.all([...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0}).map(i=>i.decode()));await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));return performance.timeOrigin+performance.now()-Number(sessionStorage.getItem('accept-start'))}))
    const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).state.workOrders.find(([,o]:any)=>o.sourceType==='DESIGN_REVISION')[1],key)
    expect(saved.acceptanceStatus).toBe('ACCEPTED')
    await page.goto(`${baseURL}/fcs/pda/task-receive/${order.taskId}?tab=pending-accept`);await expect(accept).toHaveCount(0)
    await context.close()
    await writeFile(info.outputPath('performance.json'),JSON.stringify({craft,samples,errors,distSha:createHash('sha256').update(await readFile('dist/index.html')).digest('hex')},null,2))
  }
  expect(errors).toEqual([]);for(const ms of samples)expect(ms).toBeLessThan(500)
})

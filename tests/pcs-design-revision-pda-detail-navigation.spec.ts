import { test, expect } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

for(const [factory,task] of [['F090','DWO-AUTO-000001'],['FAC-FLOWER','PWO-PRINT-AUTO-000001']]) test(`${factory} PDA 详情图片及交出单导航五次`,async({browser,baseURL},info)=>{
  const samples:Record<string,number[]>={},errors:string[]=[]
  for(let round=0;round<5;round++){
    const values=JSON.parse(await readFile('output/playwright/design-revision-gap/fixtures/completed.json','utf8'))
    values.fcs_pda_session=JSON.stringify({userId:`${factory}_operator`,loginId:`${factory}_operator`,userName:'验收',roleId:'ROLE_OPERATOR',factoryId:factory,factoryName:factory,loggedAt:'2026-09-24 09:00:00'})
    const c=await browser.newContext({viewport:{width:390,height:844},storageState:{cookies:[],origins:[{origin:new URL(baseURL!).origin,localStorage:Object.entries(values).map(([name,value])=>({name,value:String(value)}))}]}})
    const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message))
    const measure=async(key:string,run:()=>Promise<void>,ev='click')=>{await p.evaluate(ev=>document.addEventListener(ev,e=>sessionStorage.setItem('detail-start',String(performance.timeOrigin+e.timeStamp)),{capture:true,once:true}),ev);await run();const ms=await p.evaluate(async()=>{await Promise.all([...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0}).map(i=>i.decode()));await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));return performance.timeOrigin+performance.now()-Number(sessionStorage.getItem('detail-start'))});(samples[key]??=[]).push(ms);await writeFile(info.outputPath('performance.json'),JSON.stringify({factory,samples,errors,distSha:createHash('sha256').update(await readFile('dist/index.html')).digest('hex')},null,2))}
    await p.goto(`${baseURL}/fcs/pda/exec/${task}`)
    const images=p.locator('[data-pda-image-preview-url]');await expect(images.first()).toBeVisible();expect(await images.count()).toBeGreaterThanOrEqual(2)
    for(let index=0;index<await images.count();index++)for(const close of ['button','escape','shade']){
      await measure(`image:${index}:open:${close}`,async()=>{await images.nth(index).click();await expect(p.locator('[data-pda-image-preview-root] img')).toBeVisible()})
      await measure(`image:${index}:close:${close}`,async()=>{if(close==='escape')await p.keyboard.press('Escape');else if(close==='shade')await p.locator('[data-pda-image-preview-root] [aria-label="关闭大图预览"]').click({position:{x:3,y:3}});else await p.locator('[data-pda-image-preview-root]').getByRole('button',{name:'关闭',exact:true}).click();await expect(p.locator('[data-pda-image-preview-root]')).toHaveCount(0)},close==='escape'?'keydown':'click')
    }
    await measure('viewHandover',async()=>{await p.locator('[data-pda-execd-action="view-handover-order"]').first().click();await expect(p).toHaveURL(/\/fcs\/pda\/handover\//);await expect(p.getByText('正在加载页面',{exact:false})).toHaveCount(0);await expect(p.locator('[data-pda-handoverd-action]').first()).toBeVisible()})
    await measure('returnExecutionList',async()=>{await p.locator('[data-pda-tab="exec"]').click();await expect(p).toHaveURL(/\/fcs\/pda\/exec$/);await expect(p.locator('[data-pda-exec-action="switch-tab"]').first()).toBeVisible()})
    expect(await p.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    await c.close()
  }
  expect(errors).toEqual([]);for(const [key,v] of Object.entries(samples))for(const ms of v)expect(ms,key).toBeLessThan(500)
})

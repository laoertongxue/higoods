import {test,expect} from '@playwright/test'
import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'

test('设计改款仓库调拨送货单包含来源、实际卷码和数量，打印不增加库存',async({browser,baseURL},info)=>{
 const samples:number[]=[],operations:Record<string,number[]>={}
 for(let n=0;n<5;n++){
  const values:Record<string,string>=JSON.parse(await readFile('output/playwright/design-revision-gap/fixtures/dye-received.json','utf8'))
  const receiving=JSON.parse(values['higood-factory-material-receiving-v1'])
  const source=receiving.sources.find((s:{id:string})=>s.id.startsWith('DR-MATERIAL-DYEING-'))
  const ctx=await browser.newContext({viewport:{width:1366,height:768},storageState:{cookies:[],origins:[{origin:new URL(baseURL!).origin,localStorage:Object.entries(values).map(([name,value])=>({name,value}))}]}})
  await ctx.addInitScript(()=>{
   if(window===window.top)return
   const ready=async()=>{
    if(!window.frameElement?.hasAttribute('data-receiving-print')||!document.querySelector('h1')){requestAnimationFrame(ready);return}
    await Promise.all(Array.from(document.images).map(i=>i.decode()))
    await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())))
    ;(window.parent as Window & {__transferPrintEnd?:number}).__transferPrintEnd=window.parent.performance.now()
   };requestAnimationFrame(ready)
  })
  const p=await ctx.newPage();await p.goto(`${baseURL}/fcs/craft/dyeing/pending-receipts?view=deliveries`)
  const measure=async(key:string,run:()=>Promise<void>,event='click')=>{await p.evaluate(event=>{(window as any).__deliveryStart=null;document.addEventListener(event,e=>(window as any).__deliveryStart=e.timeStamp,{once:true,capture:true})},event);await run();const ms=await p.evaluate(async()=>{if((window as any).__deliveryStart===null)throw Error('未捕获送货操作事件');await Promise.all([...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0}).map(i=>i.decode()));await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));return performance.now()-(window as any).__deliveryStart});(operations[key]??=[]).push(ms)}
  const action=(a:string)=>p.locator(`[data-factory-receiving-action="${a}"]`)
  await measure('newDelivery',async()=>{await action('new-delivery').click();await expect(p.locator('[data-rfield="deliveryNo"]')).toBeVisible()})
  await measure('sourceGroup',async()=>{await p.locator('[data-rfield="group"]').selectOption('')},'change')
  const line=p.locator(`[data-delivery-source="${source.id}"]`).first()
  await measure('selectMaterial',async()=>{await line.locator('[data-dinclude]').check();await expect(line.locator('[data-dinclude]')).toBeChecked()})
  await measure('selectOriginalRoll',async()=>{await line.locator('[data-droll]').first().check();await expect(line.locator('[data-droll]').first()).toBeChecked()})
  await measure('deliveryNumber',async()=>{await p.locator('[data-rfield="deliveryNo"]').fill(`SH-DR-PRINT-VERIFY-${n}`)},'input')
  await measure('saveDelivery',async()=>{await action('save-delivery').click();await expect(p.getByText(`SH-DR-PRINT-VERIFY-${n}`,{exact:true})).toBeVisible();expect(await p.evaluate(id=>JSON.parse(localStorage.getItem('higood-factory-material-receiving-v1')!).deliveries.some((d:any)=>d.id===id),`SH-DR-PRINT-VERIFY-${n}`)).toBe(true)})
  const print=action('print-delivery').filter({hasText:'打印送货单'}).last()
  await p.evaluate(()=>document.addEventListener('click',e=>(window as Window & {__transferPrintStart?:number}).__transferPrintStart=e.timeStamp,{capture:true,once:true}))
  await print.click()
  const frame=p.frameLocator('[data-receiving-print]')
  await expect(frame.getByText('需求来源：设计改款任务',{exact:true})).toBeVisible()
  await expect(frame.getByText('本次携带：20 Yard',{exact:true})).toBeVisible()
  await expect(frame.locator('body')).toContainText(source.lines[0].rolls[0].barcode)
  await p.waitForFunction(()=>(window as Window & {__transferPrintEnd?:number}).__transferPrintEnd)
  samples.push(await p.evaluate(()=>{const w=window as Window & {__transferPrintEnd:number;__transferPrintStart:number};return w.__transferPrintEnd-w.__transferPrintStart}))
  const after=await p.evaluate(()=>JSON.parse(localStorage.getItem('higood-factory-material-receiving-v1')!))
  expect(after.receipts).toEqual(receiving.receipts)
  if(n===0){const f=await (await p.locator('[data-receiving-print]').elementHandle())!.contentFrame();const pdf=await ctx.newPage();await pdf.goto(baseURL!);await pdf.setContent(await f!.content());await pdf.evaluate(async()=>Promise.all(Array.from(document.images).map(i=>i.decode())));await pdf.pdf({path:info.outputPath('warehouse-dye-delivery.pdf'),preferCSSPageSize:true,printBackground:true});await pdf.screenshot({path:info.outputPath('warehouse-dye-delivery.png'),fullPage:true})}
  await ctx.close()
 }
 await writeFile(info.outputPath('transfer-print-performance.json'),JSON.stringify({measuredAt:new Date().toISOString(),distSha:createHash('sha256').update(await readFile('dist/index.html')).digest('hex'),samples,operations},null,2))
 for(const ms of samples)expect(ms).toBeLessThan(500)
 for(const[key,values]of Object.entries(operations)){expect(values).toHaveLength(5);for(const ms of values)expect(ms,key).toBeLessThan(500)}
})

import {test,expect} from '@playwright/test'
import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'

for(const [stage,factory,sourcePrefix] of [
 ['warehouse-dispatched','F090','DR-MATERIAL-DYEING-'],
 ['dye-dispatched','FAC-FLOWER','DYE-DISPATCH-'],
 ['print-dispatched','DYE-GOTO-GLOBAL','PRINT-HANDOUT-'],
])test(`PDA ${stage} 按原卷实收、刷新可读且重复扫码不能重复入库`,async({browser,baseURL},info)=>{
 const measurements:Record<string,number[]>={}
 for(let n=0;n<5;n++){
  const values:Record<string,string>=JSON.parse(await readFile(`output/playwright/design-revision-gap/fixtures/${stage}.json`,'utf8'))
  const before=JSON.parse(values['higood-factory-material-receiving-v1'])
  const source=before.sources.find((s:{id:string,targetFactoryId:string,lines:{material:{sku:string}}[]})=>s.id.startsWith(sourcePrefix)&&s.targetFactoryId===factory&&s.lines[0].material.sku.startsWith('DR-COTTON-'))
  expect(source).toBeTruthy()
  values.fcs_pda_session=JSON.stringify({userId:factory+'_operator',loginId:factory+'_operator',userName:'设计改款验收仓管',roleId:'ROLE_OPERATOR',factoryId:factory,factoryName:factory,loggedAt:'2026-09-24 09:00:00'})
  const c=await browser.newContext({viewport:{width:390,height:844},storageState:{cookies:[],origins:[{origin:new URL(baseURL!).origin,localStorage:Object.entries(values).map(([name,value])=>({name,value}))}]}})
  const p=await c.newPage();const errors:string[]=[];p.on('pageerror',e=>errors.push(e.message))
  const action=(a:string)=>p.locator(`[data-factory-receiving-action="${a}"]`)
  const measure=async(key:string,fn:()=>Promise<unknown>,event='click')=>{
   await p.evaluate(event=>{document.addEventListener(event,e=>(window as any).__actionStart=e.timeStamp,{once:true,capture:true})},event)
   await fn()
   const ms=await p.evaluate(async()=>{await Promise.all([...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0}).map(i=>i.decode()));await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));return performance.now()-(window as any).__actionStart})
   ;(measurements[key]??=[]).push(ms)
  }
  await p.goto(`${baseURL}/fcs/pda/factory-receipts`)
  await measure('openScanner',async()=>{await action('scan').click();await expect(p.locator('[data-rfield="scan"]')).toBeVisible()})
  await measure('scanInput',()=>p.locator('[data-rfield="scan"]').fill(source.lines[0].rolls[0].barcode),'input')
  await measure('resolveRoll',async()=>{await action('scan-input').click();await expect(p.getByRole('heading',{name:'本次实际接收',exact:true})).toBeVisible()})
  const line=p.locator(`[data-receipt-line][data-source="${source.id}"]`)
  await measure('selectLine',()=>line.locator('[data-rinclude]').check())
  await measure('selectRoll',()=>line.locator('[data-rroll]').check())
  await measure('actualQuantity',()=>line.locator('input[data-rfield^="yard-"]').fill('20'),'input')
  await measure('review',async()=>{await action('review').click();await expect(action('save')).toBeVisible()})
  await measure('returnToEdit',async()=>{await action('edit').click();await expect(line.locator('input[data-rfield^="yard-"]')).toHaveValue('20')})
  await action('review').click()
  await measure('save',async()=>{await action('save').click();await expect(p.getByText('接收已保存',{exact:false})).toBeVisible()})
  const read=()=>p.evaluate(id=>JSON.parse(localStorage.getItem('higood-factory-material-receiving-v1')!).receipts.flatMap((r:any)=>r.lines).filter((l:any)=>l.sourceId===id),source.id)
  let actual=await read();expect(actual.reduce((s:number,l:any)=>s+l.qty,0)).toBe(20);expect(actual.flatMap((l:any)=>l.rolls).map((r:any)=>r.barcode)).toContain(source.lines[0].rolls[0].barcode)
  await p.reload();expect(await read()).toEqual(actual)
  await action('scan').click();await p.locator('[data-rfield="scan"]').fill(source.lines[0].rolls[0].barcode);await action('scan-input').click()
  await expect(line).toBeVisible()
  if(await line.count()){
   await line.locator('[data-rinclude]').check();await line.locator('[data-rroll]').check();await line.locator('input[data-rfield^="yard-"]').fill('20');await action('review').click()
  }
  await expect(p.locator('[data-receiving-feedback]')).toContainText(/重复|已接收|已登记|已入库/)
  expect(await read()).toEqual(actual);expect(errors).toEqual([])
  if(n===0)await p.screenshot({path:info.outputPath(`${stage}.png`),fullPage:true})
  await c.close()
 }
 await writeFile(info.outputPath('performance.json'),JSON.stringify({stage,factory,viewport:'390x844',distSha:createHash('sha256').update(await readFile('dist/index.html')).digest('hex'),measurements},null,2))
 for(const [key,samples] of Object.entries(measurements))for(const ms of samples)expect(ms,`${stage} ${key}`).toBeLessThan(500)
})

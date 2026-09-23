import { test, expect } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

for (const craft of ['dye', 'print']) test(`${craft} 设计改款交出草稿扫码、防错、确认和持久化五次`, async ({ browser, baseURL }, info) => {
  const samples: Record<string, number[]> = {}, errors: string[] = []
  for (let round = 0; round < 5; round++) {
    const values = JSON.parse(await readFile(`output/playwright/design-revision-gap/fixtures/${craft}-dispatch-draft.json`, 'utf8'))
    delete values.fcs_pda_session
    const storageKey = `higoods.formal-${craft}-execution.v1`
    const order = JSON.parse(values[storageKey]).state.workOrders.find(([,o]: any) => o.sourceType === 'DESIGN_REVISION')[1]
    const doc = (craft === 'dye' ? order : order.businessView).dispatchDocuments.at(-1)
    const barcode = doc.lines[0].rolls[0].barcode
    const context = await browser.newContext({ viewport: {width:1366,height:768}, storageState:{cookies:[],origins:[{origin:new URL(baseURL!).origin,localStorage:Object.entries(values).map(([name,value])=>({name,value:String(value)}))}]}})
    const page = await context.newPage(); page.on('pageerror', e=>errors.push(e.message)); page.on('dialog',d=>d.accept())
    const action = (name:string) => page.locator(craft === 'dye' ? `[data-dye-output-action="${name}"]` : `[data-printing-dispatch="${name}"]`)
    const measure = async (key:string, run:()=>Promise<void>, event='click') => {
      await page.evaluate(event=>document.addEventListener(event,e=>(window as any).__probeStart=e.timeStamp,{capture:true,once:true}),event)
      await run()
      const ms=await page.evaluate(async()=>{await Promise.all([...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0}).map(i=>i.decode()));await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));return performance.now()-(window as any).__probeStart})
      ;(samples[key]??=[]).push(ms)
      await writeFile(info.outputPath('performance.json'),JSON.stringify({craft,samples,errors,distSha:createHash('sha256').update(await readFile('dist/index.html')).digest('hex')},null,2))
    }
    const savedDoc = () => page.evaluate(({storageKey,craft,id})=>{const order=JSON.parse(localStorage.getItem(storageKey)!).state.workOrders.find(([,o]:any)=>o.sourceType==='DESIGN_REVISION')[1];return (craft==='dye'?order:order.businessView).dispatchDocuments.find((d:any)=>d.id===id)}, {storageKey,craft,id:doc.id})
    if(craft==='dye'){
      await page.goto(`${baseURL}/fcs/craft/dyeing/pending-handover`)
      const row=page.locator('main table tbody tr').filter({hasText:order.dyeOrderNo}).first()
      await expect(row).toContainText('设计改款任务');await expect(row).toContainText('ES-DR-025');await expect(row).not.toContainText('备料，未关联生产单')
    }
    await page.goto(`${baseURL}/fcs/craft/${craft==='dye'?'dyeing':'printing'}/handover-documents`)
    await measure('openDetail',async()=>{await action('detail').filter({visible:true}).and(page.locator(`[data-id="${doc.id}"]`)).first().click();await expect(page.getByRole('dialog')).toBeVisible()})
    const thumbnails=page.getByRole('dialog').locator('[data-pda-image-preview-url]')
    for(let imageIndex=0;imageIndex<await thumbnails.count();imageIndex++){
      await measure(`image:${imageIndex}:open`,async()=>{await thumbnails.nth(imageIndex).click();await expect(page.locator('[data-pda-image-preview-root] img')).toBeVisible()})
      await measure(`image:${imageIndex}:close`,async()=>{await page.locator('[data-pda-image-preview-root]').getByRole('button',{name:'关闭',exact:true}).click();await expect(page.locator('[data-pda-image-preview-root]')).toHaveCount(0)})
    }
    const scan=page.locator(craft==='dye'?'[data-dye-output-field="scan"]':'[data-dispatch-scan]')
    await expect(action('confirm')).toBeDisabled()
    await measure('wrongBarcodeInput',async()=>{await scan.fill('WRONG-DR-ROLL');await expect(scan).toHaveValue('WRONG-DR-ROLL')},'input')
    await measure('wrongBarcodeBlocked',async()=>{await action('scan').click();await expect(page.locator(craft==='dye'?'[data-dye-output-modal-feedback]':'[data-dispatch-overlay-feedback]')).not.toHaveText('')})
    expect((await savedDoc()).scans??[]).toHaveLength(0)
    await measure('correctBarcodeInput',async()=>{await scan.fill(barcode);await expect(scan).toHaveValue(barcode)},'input')
    await measure('scanRoll',async()=>{await action('scan').click();await expect(action('confirm')).toBeEnabled()})
    expect((await savedDoc()).scans).toHaveLength(1)
    if(craft==='dye'){
      for(const [field,value] of [['driver','验收司机'],['vehicle','厢式货车'],['plate','DR-TEST'],['note','送印花厂']]) await measure(`transport:${field}`,async()=>{const input=page.locator(`[data-dye-output-field="${field}"]`);await input.fill(value);await expect(input).toHaveValue(value)},'input')
      await measure('saveTransport',async()=>{await action('save-transport').click();await expect(page.locator('[data-dye-output-modal-feedback]')).toContainText('已保存')})
      expect((await savedDoc()).transport.plate).toBe('DR-TEST')
    }
    await measure('confirmActualHandover',async()=>{await action('confirm').click();await expect(action('confirm')).toHaveCount(0);expect((await savedDoc()).status).toBe('已交出')})
    await page.reload();expect((await savedDoc()).status).toBe('已交出')
    const receiving=await page.evaluate(()=>JSON.parse(localStorage.getItem('higood-factory-material-receiving-v1')!).sources)
    expect(receiving.some((s:any)=>s.type==='HANDOUT'&&s.lines.some((l:any)=>l.rolls.some((r:any)=>r.barcode===barcode)&&l.sentQty===20))).toBe(true)
    await context.close()
  }
  expect(errors).toEqual([])
  for(const [key,values] of Object.entries(samples))for(const ms of values)expect(ms,key).toBeLessThan(500)
})

for(const craft of ['dye','print']) test(`${craft} 产出卷选择与交出草稿生成五次`,async({browser,baseURL},info)=>{
 const samples:Record<string,number[]>={}
 for(let round=0;round<5;round++){
  const values=JSON.parse(await readFile(`output/playwright/design-revision-gap/fixtures/${craft}-output-ready.json`,'utf8'));delete values.fcs_pda_session
  const key=`higoods.formal-${craft}-execution.v1`,order=JSON.parse(values[key]).state.workOrders.find(([,o]:any)=>o.sourceType==='DESIGN_REVISION')[1]
  const c=await browser.newContext({viewport:{width:1366,height:768},storageState:{cookies:[],origins:[{origin:new URL(baseURL!).origin,localStorage:Object.entries(values).map(([name,value])=>({name,value:String(value)}))}]}}),p=await c.newPage()
  const action=(a:string)=>p.locator(craft==='dye'?`[data-dye-output-action="${a}"]`:`[data-printing-dispatch="${a}"]`)
  const measure=async(name:string,fn:()=>Promise<void>)=>{await p.evaluate(()=>document.addEventListener('click',e=>(window as any).__creationStart=e.timeStamp,{capture:true,once:true}));await fn();const t=await p.evaluate(async()=>{await Promise.all([...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0}).map(i=>i.decode()));await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));return performance.now()-(window as any).__creationStart});(samples[name]??=[]).push(t);await writeFile(info.outputPath('performance.json'),JSON.stringify({craft,samples,distSha:createHash('sha256').update(await readFile('dist/index.html')).digest('hex')},null,2))}
  await p.goto(`${baseURL}/fcs/craft/${craft==='dye'?'dyeing':'printing'}/pending-handover`)
  const orderNo=craft==='dye'?order.dyeOrderNo:order.printOrderNo
  expect(orderNo).toBeTruthy()
  if(craft==='print'){
    await p.getByRole('textbox',{name:'关键词',exact:true}).fill(orderNo)
    await p.getByRole('button',{name:'查询',exact:true}).click()
  }
  const row=p.locator('main table tbody tr').filter({hasText:orderNo}).first()
  const roll=row.locator(craft==='dye'?'[data-dye-output-select]:not(:disabled)':'[data-dispatch-roll]:not(:disabled)').first()
  await measure('selectOriginalRoll',async()=>{await roll.check();await expect(action('create')).toBeEnabled()})
  await measure('createPreview',async()=>{await action('create').click();await expect(p.getByRole('dialog')).toContainText('20')})
  await measure('cancelPreview',async()=>{await action(craft==='dye'?'close-overlay':'cancel-preview').last().click();await expect(p.getByRole('dialog')).toHaveCount(0)})
  await measure('reopenPreview',async()=>{await action('create').click();await expect(p.getByRole('dialog')).toBeVisible()})
  await measure('saveDraft',async()=>{await action(craft==='dye'?'save-document':'commit-preview').click();await expect(action('scan')).toBeVisible()})
  const saved=await p.evaluate(({key,craft})=>{const o=JSON.parse(localStorage.getItem(key)!).state.workOrders.find(([,o]:any)=>o.sourceType==='DESIGN_REVISION')[1];return(craft==='dye'?o:o.businessView).dispatchDocuments.at(-1)},{key,craft})
  expect(saved.status).toBe('草稿');expect(craft==='dye'?saved.lines[0].rolls:saved.lines[0].barcodeIds).toHaveLength(1);expect(saved.scans??[]).toHaveLength(0)
  await p.reload();const persisted=await p.evaluate(key=>localStorage.getItem(key),key);expect(persisted).toContain(saved.id)
  await c.close()
 }
 for(const [key,values] of Object.entries(samples))for(const ms of values)expect(ms,key).toBeLessThan(500)
})

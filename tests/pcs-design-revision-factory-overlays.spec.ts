import {test,expect} from '@playwright/test'
import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
test.use({video:'off',trace:'off'})
for(const craft of ['dye','print'])test(`${craft} 工厂查看编辑日志卷码和备注入口五次`,async({browser,baseURL},info)=>{
 test.setTimeout(120000)
 const samples:Record<string,number[]>={},errors:string[]=[]
 for(let n=0;n<5;n++){
  const values=JSON.parse(await readFile(`output/playwright/design-revision-gap/fixtures/${craft==='print'?'print-received':'completed'}.json`,'utf8'));delete values.fcs_pda_session
  const c=await browser.newContext({viewport:{width:1366,height:768},storageState:{cookies:[],origins:[{origin:new URL(baseURL!).origin,localStorage:Object.entries(values).map(([name,value])=>({name,value:String(value)}))}]}}),p=await c.newPage()
  p.on('pageerror',e=>errors.push(e.message))
  const measure=async(key:string,fn:()=>Promise<void>,event='click')=>{await p.evaluate(event=>document.addEventListener(event,e=>(window as any).__overlayStart=e.timeStamp,{once:true,capture:true}),event);await fn();const ms=await p.evaluate(async()=>{const scope=document.querySelector('[data-printing-image-preview], [data-pda-image-preview-root]')||[...document.querySelectorAll('[role=dialog]')].at(-1)||document.querySelector('[data-dye-work-orders-overlay] > div')||document;await Promise.all([...scope.querySelectorAll('img')].filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0}).map(i=>i.decode()));await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));return performance.now()-(window as any).__overlayStart});(samples[key]??=[]).push(ms);await writeFile(info.outputPath('performance.json'),JSON.stringify({craft,samples,errors,distSha:createHash('sha256').update(await readFile('dist/index.html')).digest('hex')},null,2))}
  await p.goto(`${baseURL}/fcs/craft/${craft==='dye'?'dyeing':'printing'}/work-orders`)
  const keyword=p.locator(craft==='dye'?'[data-dye-work-orders-field="keyword"]':'[data-printing-work-orders-field="keyword"]')
  await keyword.fill(craft==='dye'?'DY-20260923-000001':'PH-20260923-000001')
  await p.getByRole('button',{name:'查询',exact:true}).click()
  const action=(a:string)=>p.locator(craft==='dye'?`[data-dye-work-orders-action="${a}"]`:`[data-printing-action="${a}"]`)
  for(const a of craft==='dye'?['view','edit','logs','barcodes','remark']:['edit-info','logs','open-barcodes','remarks']){
   const d=craft==='dye'&&a!=='barcodes'?p.locator('[data-dye-work-orders-overlay] > div'):p.getByRole('dialog').last()
   await measure('open:'+a,async()=>{await action(a).filter({visible:true}).first().click();await expect(d.locator('h2,h3').first()).toBeVisible()})
   const images=d.locator('[data-pda-image-preview-url], [data-printing-action="preview-image"]')
   for(let i=0;i<await images.count();i++){
    const preview=p.locator(craft==='dye'?'[data-pda-image-preview-root]':'[data-printing-image-preview]')
    await measure(`image:${a}:${i}`,async()=>{await images.nth(i).click();await expect(preview.locator('img')).toBeVisible()})
    await measure(`imageClose:${a}:${i}`,async()=>{await p.keyboard.press('Escape');await expect(preview).toHaveCount(0)},'keydown')
   }
   for(const [i,summary]of (await d.locator('summary').all()).entries())await measure(`expand:${a}:${i}`,async()=>{await summary.click();await expect(summary.locator('..')).toHaveAttribute('open','')})
   if(a==='edit'||a==='edit-info'){
    const fields=d.locator('input:not([readonly]):not([type="hidden"]):not(:disabled),select:not(:disabled),textarea:not([readonly]):not(:disabled)').filter({visible:true})
    for(let i=0;i<await fields.count();i++){
     const input=fields.nth(i),value=await input.inputValue(),tag=await input.evaluate(e=>e.tagName)
     await measure(`edit:field:${i}`,async()=>{if(tag==='SELECT')await input.selectOption(value);else await input.fill(value);await expect(input).toHaveValue(value)},tag==='SELECT'?'change':'input')
    }
    const field=d.locator('textarea').first()
    if(await field.count())await measure('edit:remarkInput',async()=>{await field.fill('设计改款原型验收备注');await expect(field).toHaveValue('设计改款原型验收备注')},'input')
    await measure('edit:save',async()=>{await action(craft==='dye'?'save-edit':'submit-dialog').filter({visible:true}).last().click();await expect(d).toHaveCount(0)})
    await measure('edit:reopenPersisted',async()=>{await action(a).filter({visible:true}).first().click();await expect(d.locator('textarea').first()).toHaveValue('设计改款原型验收备注')})
   }
   await measure('close:'+a,async()=>{if(craft==='dye'&&a!=='barcodes')await action('close-overlay').filter({visible:true}).last().click();else await d.getByRole('button',{name:'关闭',exact:true}).last().click();await expect(d).toHaveCount(0)})
  }
  expect(await p.locator('main').last().innerText()).toContain('ES-DR-025')
  if(craft==='print')expect(await p.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name).filter(name=>/cut-piece-return-domain|transfer-bag-return-model/.test(name)))).toEqual([])
  await c.close()
 }
 expect(errors).toEqual([])
 for(const[key,vs]of Object.entries(samples)){expect(vs).toHaveLength(5);for(const ms of vs)expect(ms,key).toBeLessThan(500)}
})

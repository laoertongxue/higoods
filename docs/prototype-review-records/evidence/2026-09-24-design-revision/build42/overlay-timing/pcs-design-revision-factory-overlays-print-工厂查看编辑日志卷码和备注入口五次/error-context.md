# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pcs-design-revision-factory-overlays.spec.ts >> print 工厂查看编辑日志卷码和备注入口五次
- Location: tests/pcs-design-revision-factory-overlays.spec.ts:4:36

# Error details

```
Error: imageClose:edit-info:1

expect(received).toBeLessThan(expected)

Expected: < 500
Received:   1233.2000000029802
```

# Test source

```ts
  1  | import {test,expect} from '@playwright/test'
  2  | import {readFile,writeFile} from 'node:fs/promises'
  3  | import {createHash} from 'node:crypto'
  4  | for(const craft of ['dye','print'])test(`${craft} 工厂查看编辑日志卷码和备注入口五次`,async({browser,baseURL},info)=>{
  5  |  test.setTimeout(120000)
  6  |  const samples:Record<string,number[]>={},errors:string[]=[]
  7  |  for(let n=0;n<5;n++){
  8  |   const values=JSON.parse(await readFile(`output/playwright/design-revision-gap/fixtures/${craft==='print'?'print-received':'completed'}.json`,'utf8'));delete values.fcs_pda_session
  9  |   const c=await browser.newContext({viewport:{width:1366,height:768},storageState:{cookies:[],origins:[{origin:new URL(baseURL!).origin,localStorage:Object.entries(values).map(([name,value])=>({name,value:String(value)}))}]}}),p=await c.newPage()
  10 |   p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.text().includes('SLOW_IMAGE'))console.log(m.text())})
  11 |   const measure=async(key:string,fn:()=>Promise<void>,event='click')=>{await p.evaluate(event=>document.addEventListener(event,e=>(window as any).__overlayStart=e.timeStamp,{once:true,capture:true}),event);await fn();if(key.startsWith('image'))console.log(key,'afterFn',await p.evaluate(()=>performance.now()-(window as any).__overlayStart));const ms=await p.evaluate(async()=>{const scope=document.querySelector('[data-printing-image-preview], [data-pda-image-preview-root]')||[...document.querySelectorAll('[role=dialog]')].at(-1)||document.querySelector('[data-dye-work-orders-overlay] > div')||document;await Promise.all([...scope.querySelectorAll('img')].filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0}).map(async i=>{const start=performance.now();await i.decode();if(performance.now()-start>200)console.log('SLOW_IMAGE_DECODE',i.src,performance.now()-start)}));await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));return performance.now()-(window as any).__overlayStart});(samples[key]??=[]).push(ms);await writeFile(info.outputPath('performance.json'),JSON.stringify({craft,samples,errors,distSha:createHash('sha256').update(await readFile('dist/index.html')).digest('hex')},null,2))}
  12 |   await p.goto(`${baseURL}/fcs/craft/${craft==='dye'?'dyeing':'printing'}/work-orders`)
  13 |   const keyword=p.locator(craft==='dye'?'[data-dye-work-orders-field="keyword"]':'[data-printing-work-orders-field="keyword"]')
  14 |   await keyword.fill(craft==='dye'?'DY-20260923-000001':'PH-20260923-000001')
  15 |   await p.getByRole('button',{name:'查询',exact:true}).click()
  16 |   const action=(a:string)=>p.locator(craft==='dye'?`[data-dye-work-orders-action="${a}"]`:`[data-printing-action="${a}"]`)
  17 |   for(const a of craft==='dye'?['view','edit','logs','barcodes','remark']:['edit-info','logs','open-barcodes','remarks']){
  18 |    const d=craft==='dye'&&a!=='barcodes'?p.locator('[data-dye-work-orders-overlay] > div'):p.getByRole('dialog').last()
  19 |    await measure('open:'+a,async()=>{await action(a).filter({visible:true}).first().click();await expect(d.locator('h2,h3').first()).toBeVisible()})
  20 |    const images=d.locator('[data-pda-image-preview-url], [data-printing-action="preview-image"]')
  21 |    for(let i=0;i<await images.count();i++){
  22 |     const preview=p.locator(craft==='dye'?'[data-pda-image-preview-root]':'[data-printing-image-preview]')
  23 |     await measure(`image:${a}:${i}`,async()=>{await images.nth(i).click();await expect(preview.locator('img')).toBeVisible()})
  24 |     await measure(`imageClose:${a}:${i}`,async()=>{await p.keyboard.press('Escape');await expect(preview).toHaveCount(0)},'keydown')
  25 |    }
  26 |    for(const [i,summary]of (await d.locator('summary').all()).entries())await measure(`expand:${a}:${i}`,async()=>{await summary.click();await expect(summary.locator('..')).toHaveAttribute('open','')})
  27 |    if(a==='edit'||a==='edit-info'){
  28 |     const fields=d.locator('input:not([readonly]):not([type="hidden"]):not(:disabled),select:not(:disabled),textarea:not([readonly]):not(:disabled)').filter({visible:true})
  29 |     for(let i=0;i<await fields.count();i++){
  30 |      const input=fields.nth(i),value=await input.inputValue(),tag=await input.evaluate(e=>e.tagName)
  31 |      await measure(`edit:field:${i}`,async()=>{if(tag==='SELECT')await input.selectOption(value);else await input.fill(value);await expect(input).toHaveValue(value)},tag==='SELECT'?'change':'input')
  32 |     }
  33 |     const field=d.locator('textarea').first()
  34 |     if(await field.count())await measure('edit:remarkInput',async()=>{await field.fill('设计改款原型验收备注');await expect(field).toHaveValue('设计改款原型验收备注')},'input')
  35 |     await measure('edit:save',async()=>{await action(craft==='dye'?'save-edit':'submit-dialog').filter({visible:true}).last().click();await expect(d).toHaveCount(0)})
  36 |     await measure('edit:reopenPersisted',async()=>{await action(a).filter({visible:true}).first().click();await expect(d.locator('textarea').first()).toHaveValue('设计改款原型验收备注')})
  37 |    }
  38 |    await measure('close:'+a,async()=>{if(craft==='dye'&&a!=='barcodes')await action('close-overlay').filter({visible:true}).last().click();else await d.getByRole('button',{name:'关闭',exact:true}).last().click();await expect(d).toHaveCount(0)})
  39 |   }
  40 |   expect(await p.locator('main').last().innerText()).toContain('ES-DR-025')
  41 |   await c.close()
  42 |  }
  43 |  expect(errors).toEqual([])
> 44 |  for(const[key,vs]of Object.entries(samples)){expect(vs).toHaveLength(5);for(const ms of vs)expect(ms,key).toBeLessThan(500)}
     |                                                                                                            ^ Error: imageClose:edit-info:1
  45 | })
  46 |
```

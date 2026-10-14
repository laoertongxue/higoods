import { expect, test, type Page, type Locator } from '@playwright/test'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { buildPmsHtmlTemplateFile } from '../src/utils/pms-export.ts'
import type { PmsMaterialPurchaseOrder } from '../src/data/pms/material-purchase-orders.ts'

const ROUTE='/pms/material-purchase-orders'
const ROOT='[data-pms-mpo-barcode-root]'
const STORE='pmsMaterialPurchaseOrderDeltas'
const OUTPUT=resolve('output/playwright/mpo-barcode-parity-20261014')
const CALIBRATION=process.env.MPO_BARCODE_CALIBRATION==='true'
const N=CALIBRATION?1:5
const RUN=`${CALIBRATION?'calibration':'acceptance'}-barcode-${Date.now()}`
const DIR=join(OUTPUT,RUN)
const sourceFiles=['src/pages/pms/material-purchase-barcodes.ts','src/pages/pms/material-purchase-orders.ts','src/pages/pms/material-purchase-order-parity.ts','src/data/pms/material-purchase-orders.ts','src/data/pms/material-purchase-lines.ts','src/utils/static-image-thumbnails.json','tests/material-purchase-barcode-online-parity.spec.ts','dist/index.html']
type Sample={family:string;label:string;elapsed:number|null;event:string;trusted:boolean|null;error:string|null;completion:string}
type Ready={selector:string;text?:string;absent?:string;rowCount?:number;orderNo?:string;codes?:string[];missingCodes?:string[];barcode?:{code:string;quantity?:number;warehouse?:string;status?:string}}
const samples:Sample[]=[]
const errors:string[]=[]
const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex')

async function records(page:Page):Promise<PmsMaterialPurchaseOrder[]> {
 return page.evaluate(store=>new Promise((resolve,reject)=>{
  const request=indexedDB.open('higood-pms')
  request.onupgradeneeded=()=>{request.transaction?.abort();reject(new Error('Readonly evidence cannot initialize a database'))}
  request.onerror=()=>reject(request.error)
  request.onsuccess=()=>{const db=request.result,tx=db.transaction(store,'readonly'),read=tx.objectStore(store).getAll();let rows:PmsMaterialPurchaseOrder[]=[];read.onsuccess=()=>rows=read.result;tx.oncomplete=()=>{db.close();resolve(rows)};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error)}}
 }),STORE)
}
async function order(page:Page,no:string):Promise<PmsMaterialPurchaseOrder> {const row=(await records(page)).find(row=>row.purchaseOrderNo===no);expect(row).toBeDefined();return row!}
async function settle(page:Page,selector:string):Promise<void> {
 await page.locator(selector).first().waitFor({state:'visible'})
 await page.locator(selector).first().evaluate(async node=>{const images=[...node.querySelectorAll<HTMLImageElement>('img')];await document.fonts.ready;await Promise.all(images.map(image=>image.decode()));await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))})
}

// The capture starts at the actual browser click/file-input event. Completion includes visible
// final DOM, decoded business images, two animation frames, and readonly IDB transaction complete.
async function measured(page:Page,family:string,label:string,eventSelector:string,ready:Ready,perform:()=>Promise<unknown>,event='click'):Promise<void> {
 await page.evaluate(({eventSelector,ready,event})=>{
  const state={start:null as number|null,elapsed:null as number|null,error:null as string|null,trusted:null as boolean|null}
  ;(window as unknown as {__mpoBarcodeSample:typeof state}).__mpoBarcodeSample=state
  const capture=(e:Event)=>{
   if(!(e.target instanceof Element)||!e.target.closest(eventSelector))return
   document.removeEventListener(event,capture,true)
   state.start=performance.now();state.trusted=e.isTrusted
   if(event==='click'&&!e.isTrusted){state.error='No trusted browser click';return}
   const finish=async()=>{
    try{
     while(performance.now()-state.start!<7000){
      const node=document.querySelector<HTMLElement>(ready.selector)
      if(!node||!node.isConnected||node.getBoundingClientRect().width===0||ready.text&&!node.textContent?.includes(ready.text)||ready.absent&&document.querySelector(ready.absent)||ready.rowCount!==undefined&&node.querySelectorAll('tbody tr').length!==ready.rowCount){await new Promise(resolve=>setTimeout(resolve,4));continue}
      if(ready.orderNo){
       const saved=await new Promise<{detailBarcodes?:Array<Record<string,unknown>>}|undefined>((resolve,reject)=>{const request=indexedDB.open('higood-pms');request.onupgradeneeded=()=>{request.transaction?.abort();reject(new Error('Evidence cannot initialize DB'))};request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('pmsMaterialPurchaseOrderDeltas','readonly'),read=tx.objectStore('pmsMaterialPurchaseOrderDeltas').get(ready.orderNo!);let value:typeof saved;read.onsuccess=()=>value=read.result;tx.oncomplete=()=>{db.close();resolve(value)};tx.onabort=tx.onerror=()=>{db.close();reject(tx.error)}}})
       const rows=saved?.detailBarcodes||[]
       if(!saved||ready.codes?.some(code=>!rows.some(row=>row.code===code))||ready.missingCodes?.some(code=>rows.some(row=>row.code===code))||ready.barcode&&!rows.some(row=>Object.entries(ready.barcode!).every(([key,value])=>row[key]===value))){await new Promise(resolve=>setTimeout(resolve,4));continue}
      }
      const images=[...node.querySelectorAll<HTMLImageElement>('img')]
      if(images.some(image=>!image.complete)){await new Promise(resolve=>setTimeout(resolve,4));continue}
      if(images.some(image=>image.naturalWidth===0))throw new Error('Required business image failed')
      await document.fonts.ready;await Promise.all(images.map(image=>image.decode()))
      await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))
      if(!node.isConnected)continue
      state.elapsed=performance.now()-state.start!;return
     }
     throw new Error('Final rendered result/readback exceeded 7000 ms')
    }catch(error){state.error=error instanceof Error?error.message:String(error)}
   }
   void finish()
  }
  document.addEventListener(event,capture,true)
 },{eventSelector,ready,event})
 await perform()
  await page.waitForFunction(()=>{const sample=(window as unknown as {__mpoBarcodeSample?:{elapsed:number|null;error:string|null}}).__mpoBarcodeSample;return sample&&(sample.elapsed!==null||sample.error!==null)},undefined,{timeout:8000}).catch(async error=>{const current=await page.evaluate(()=>(window as unknown as {__mpoBarcodeSample:{elapsed:number|null;trusted:boolean|null;error:string|null}}).__mpoBarcodeSample);samples.push({family,label,elapsed:current.elapsed,event,trusted:current.trusted,error:current.error||String(error),completion:'No final result; failed sample retained'});writeFileSync(join(DIR,'raw-performance.json'),JSON.stringify(samples,null,2));throw error})
 const result=await page.evaluate(()=>(window as unknown as {__mpoBarcodeSample:{elapsed:number|null;trusted:boolean|null;error:string|null}}).__mpoBarcodeSample)
 samples.push({family,label,elapsed:result.elapsed,event,trusted:result.trusted,error:result.error,completion:'final DOM + decoded images + 2 rAF'+(ready.orderNo?' + IDB readonly transaction complete':'')})
 writeFileSync(join(DIR,'raw-performance.json'),JSON.stringify(samples,null,2))
 expect(result.error,label).toBeNull();expect(result.elapsed,label).not.toBeNull()
}

async function menuAction(page:Page,no:string,action:string):Promise<Locator> {
 await page.locator(`[data-pms-mpo-action="parity-row-menu"][data-order-no="${no}"]`).click()
 return page.locator(`[data-mpo-row-menu] [data-pms-mpo-action="${action}"]`)
}
async function openLedger(page:Page,no:string,initial='parity-barcodes',family?:string,label?:string):Promise<void> {
 const button=await menuAction(page,no,initial),selector=`[data-mpo-row-menu] [data-pms-mpo-action="${initial}"]`
 if(family)await measured(page,family,label||initial,selector,{selector:ROOT},()=>button.click())
 else await button.click()
 await expect(page.locator(ROOT)).toBeVisible()
}
async function queryOrder(page:Page,no:string):Promise<void> {await page.locator('[data-pms-mpo-field="keyword"]').fill(no);await page.locator('[data-pms-mpo-action="query"]').click();await expect(page.locator(`[data-pms-mpo-action="parity-row-menu"][data-order-no="${no}"]`)).toBeVisible()}
const childAction=(name:string)=>`${ROOT} [data-pms-mpo-barcode-action="${name}"]`
const childField=(name:string)=>`${ROOT} [data-pms-mpo-barcode-field="${name}"]`
async function closeLedger(page:Page):Promise<void> {await page.locator(childAction('close')).filter({hasText:'关闭'}).click();await expect(page.locator(ROOT)).toHaveCount(0)}
function excel(name:string,rows:Array<Array<string|number>>):string {const path=join(DIR,`${name}.xls`);writeFileSync(path,buildPmsHtmlTemplateFile(name,['SKU','条码','数量','单位','仓库'],rows));return path}

test('面辅料多 SKU 条码：全部动作、持久回读与真实交互性能',async({page,baseURL},testInfo)=>{
 test.setTimeout(180000)
 mkdirSync(DIR,{recursive:true});samples.length=0;errors.length=0
 const version={run:RUN,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),origin:new URL(baseURL!).origin,sourceHashes:Object.fromEntries(sourceFiles.map(path=>[path,sha(readFileSync(path))]))}
 writeFileSync(join(DIR,'version.json'),JSON.stringify(version,null,2))
 const assets:Array<{url:string;sha256:string;bytes:number}>=[]
 page.on('pageerror',error=>errors.push(error.message))
 page.on('response',async response=>{if(response.url().includes('/assets/')&&/\.(js|css)(\?|$)/.test(response.url())){const bytes=await response.body().catch(()=>null);if(bytes)assets.push({url:response.url(),sha256:sha(bytes),bytes:bytes.length})}})
 try{
  await page.setViewportSize({width:1366,height:768});await page.goto(ROUTE);await expect(page.locator('[data-pms-mpo-root]')).toBeVisible()
  await page.locator('[data-pms-mpo-action="parity-new"][data-purchase-kind="面料"]').click()
  const form=page.locator('[data-mpo-parity-form]')
  const options=await form.locator('[name="spu"] option').evaluateAll(options=>options.map(option=>(option as HTMLOptionElement).value).filter(Boolean))
  let found=false
  for(const spu of options){await form.locator('[name="spu"]').selectOption(spu);await page.locator('[data-pms-mpo-action="parity-load-skus"]').click();if(await page.locator('[data-pms-confirm-accept]').count())await page.locator('[data-pms-confirm-accept]').click();if(await form.locator('[data-parity-line]').count()>=2){found=true;break}}
  expect(found,'真实物料档案至少两个可采购 SKU').toBe(true)
  const skuRows=form.locator('[data-parity-line]')
  for(let index=0;index<2;index++){await skuRows.nth(index).locator('[name="selected"]').check();await skuRows.nth(index).locator('[name="quantity"]').fill(index?'20':'10');await skuRows.nth(index).locator('[name="unitPrice"]').fill('3.5')}
  const supplierOptions=await form.locator('[name="supplierName"] option').evaluateAll(options=>options.map(option=>(option as HTMLOptionElement).value).filter(Boolean));await form.locator('[name="supplierName"]').selectOption(supplierOptions[0])
  const warehouseOptions=await form.locator('[name="warehouse"] option').evaluateAll(options=>options.map(option=>(option as HTMLOptionElement).value).filter(Boolean));await form.locator('[name="warehouse"]').selectOption(warehouseOptions[0])
  const remark=`条码独立核验 ${RUN}`;await form.locator('[name="remark"]').fill(remark)
  await page.locator('[data-pms-mpo-action="parity-save"]').click();await expect(page.locator('[data-mpo-parity-dialog]')).toHaveCount(0)
  const created=(await records(page)).find(row=>row.remark===remark)!;expect(created?.lines).toHaveLength(2)
  const no=created.purchaseOrderNo,lines=created.lines!,warehouse=created.warehouse
  writeFileSync(join(DIR,'created-order.json'),JSON.stringify(created,null,2));await queryOrder(page,no)
  for(let index=0;index<N;index++){await openLedger(page,no,'parity-barcodes','ledger-open',`open-${index}`);await closeLedger(page)}
  await openLedger(page,no)
  // Same-unit variants still require exact SKU identity and individual quantity ownership.
  for(let index=0;index<N;index++){
   await page.locator(childAction('create')).click()
   await page.locator(childField('form-purchaseLineId')).selectOption(lines[index%2].lineId)
   const code=`BC-UI-${index}`;await page.locator(childField('form-code')).fill(code);await page.locator(childField('form-quantity')).fill('1')
   await measured(page,'barcode-save',`create-${index}`,childAction('save-form'),{selector:ROOT,text:'采购条码已保存',absent:`${ROOT} [aria-label="补充条码"]`,orderNo:no,codes:[code]},()=>page.locator(childAction('save-form')).click())
  }
  for(let index=0;index<N;index++){
   const code=`BC-UI-${index}`;await page.locator(childField('keyword')).fill(code)
   await measured(page,'barcode-query',`query-${index}`,childAction('query'),{selector:ROOT,text:code,rowCount:1},()=>page.locator(childAction('query')).click())
   await expect(page.locator(`${ROOT} tbody tr`)).toHaveCount(1)
  }
  const exportEvent=page.waitForEvent('download');await page.locator(childAction('export')).click();const exported=await exportEvent;await exported.saveAs(join(DIR,'filtered-export.csv'))
  const csv=readFileSync(join(DIR,'filtered-export.csv'),'utf8');expect(csv).toContain('SKU');expect(csv).toContain(`BC-UI-${N-1}`);expect(csv).not.toContain(N>1?`BC-UI-${N-2}`:'BC-UI-999')
  await page.locator(childAction('reset')).click()
  for(let index=0;index<N;index++){
   await page.locator(childAction('import')).click()
   if(index===0){const templateEvent=page.waitForEvent('download');await page.locator(childAction('template')).click();const template=await templateEvent;await template.saveAs(join(DIR,'downloaded-template.xls'));const text=readFileSync(join(DIR,'downloaded-template.xls'),'utf8');for(const line of lines){expect(text).toContain(line.materialCode);expect(text).toContain(line.unit)}}
   const codes=[`BC-IMPORT-${index}-A`,`BC-IMPORT-${index}-B`],file=excel(`import-${index}`,lines.map((line,lineIndex)=>[line.materialCode,codes[lineIndex],2,line.unit,warehouse]))
   // File input emits input before change; the product handles input and replaces the
   // control, so its detached change event cannot reach a document capture listener.
   await measured(page,'barcode-import-file',`file-${index}`,childField('import-file'),{selector:ROOT,text:codes[1]},()=>page.locator(childField('import-file')).setInputFiles(file),'input')
   await expect(page.locator(ROOT)).toContainText('可导入')
   await measured(page,'barcode-import-save',`import-save-${index}`,childAction('save-import'),{selector:ROOT,text:'已导入 2 个条码',absent:`${ROOT} [aria-label="导入细码"]`,orderNo:no,codes},()=>page.locator(childAction('save-import')).click())
  }
  await page.screenshot({path:join(DIR,'ledger-1366.png'),fullPage:true});writeFileSync(join(DIR,'ledger-dom.html'),await page.locator(ROOT).evaluate(node=>node.outerHTML))
  await page.setViewportSize({width:1280,height:720});await expect(page.locator(ROOT)).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:join(DIR,'ledger-1280.png'),fullPage:true});await page.setViewportSize({width:1366,height:768})
  if(N>1){await page.locator(childAction('next-page')).click();await expect(page.locator(ROOT)).toContainText('2 /');await page.locator(childAction('prev-page')).click()}
  await page.locator(childField('pageSize')).selectOption('20');await expect(page.locator(`${ROOT} tbody tr`)).toHaveCount(3*N)
  await page.locator(childField('purchaseLineId')).selectOption(lines[1].lineId);await page.locator(childAction('query')).click();expect(await page.locator(`${ROOT} tbody tr`).count()).toBe(N+Math.floor(N/2));for(const row of await page.locator(`${ROOT} tbody tr`).all())await expect(row).toContainText(lines[1].materialCode)
  await page.locator(childAction('reset')).click()
  // Single-row edits use the same immutable SKU association as the batch path.
  for(let index=0;index<N;index++){
   const code=`BC-UI-${index}`;await page.locator(childField('keyword')).fill(code);await page.locator(childAction('query')).click();await page.locator(`${childAction('edit')}[data-code="${code}"]`).click();await expect(page.locator(childField('form-purchaseLineId'))).toHaveCount(0);await expect(page.locator(ROOT)).toContainText(lines[index%2].materialCode);await page.locator(childField('form-quantity')).fill('1.5')
   await measured(page,'barcode-single-edit',`edit-${index}`,childAction('save-form'),{selector:ROOT,text:'采购条码已保存',absent:`${ROOT} [aria-label="修改条码"]`,orderNo:no,barcode:{code,quantity:1.5}},()=>page.locator(childAction('save-form')).click())
  }
  await page.locator(childAction('reset')).click()
  // Plan quantity is not a physical cap when no actual purchase quantity is registered.
  await page.locator(childAction('create')).click();await page.locator(childField('form-purchaseLineId')).selectOption(lines[0].lineId);await page.locator(childField('form-code')).fill('BC-OVER-PLAN');await page.locator(childField('form-quantity')).fill(String(lines[0].orderedQty+1));await page.locator(childAction('save-form')).click();expect((await order(page,no)).detailBarcodes!.some(row=>row.code==='BC-OVER-PLAN')).toBe(true)
  await page.locator(childField('keyword')).fill('BC-OVER-PLAN');await page.locator(childAction('query')).click();await page.locator(`${childAction('print-one')}[data-code="BC-OVER-PLAN"]`).click();await expect(page.locator(`${ROOT} article`)).toContainText(lines[0].materialCode);await expect(page.locator(`${ROOT} article`)).toContainText(`${lines[0].orderedQty+1} ${lines[0].unit}`);await settle(page,ROOT);await page.screenshot({path:join(DIR,'single-print-preview.png'),fullPage:true});await page.locator(childAction('cancel-form')).click()
  await page.locator(`${childAction('delete-one')}[data-code="BC-OVER-PLAN"]`).click();await page.locator('[data-pms-confirm-accept]').click();expect((await order(page,no)).detailBarcodes!.some(row=>row.code==='BC-OVER-PLAN')).toBe(false);await page.locator(childAction('reset')).click()
  await page.locator(childAction('create')).click();await page.locator(childField('form-purchaseLineId')).selectOption(lines[0].lineId);await page.locator(childField('form-code')).fill('BC-UI-0');await page.locator(childField('form-quantity')).fill('1');const beforeDuplicate=await order(page,no);await page.locator(childAction('save-form')).click();await expect(page.locator(ROOT)).toContainText(/重复/);expect(await order(page,no)).toEqual(beforeDuplicate);await page.locator(childAction('cancel-form')).click();await page.locator('[data-pms-confirm-accept]').click()
  await page.locator(childAction('import')).click()
  const bad=excel('invalid-sku-unit',[['UNKNOWN-SKU','BC-INVALID-SKU',1,lines[0].unit,warehouse],[lines[1].materialCode,'BC-INVALID-UNIT',1,'WRONG-UNIT',warehouse]])
  const beforeInvalid=await order(page,no);await page.locator(childField('import-file')).setInputFiles(bad);await expect(page.locator(ROOT)).toContainText(/不属于本采购单/);await expect(page.locator(ROOT)).toContainText(/单位须/);await page.locator(childAction('save-import')).click();await expect(page.locator(ROOT)).toContainText('导入资料有错误');expect(await order(page,no)).toEqual(beforeInvalid)
  await page.locator(childAction('clear-import')).click();await page.locator(childAction('cancel-form')).click()
  // Batch edits include actual save/readback; subsequent delete/offshelf use explicit final confirmation.
  for(let index=0;index<N;index++){
   await page.locator(childField('keyword')).fill(`BC-UI-${index}`);await page.locator(childAction('query')).click();await page.locator(`${ROOT} [data-pms-mpo-barcode-field="select-row"]`).check();await page.locator(childAction('batch-edit')).click();await page.locator(childField('form-quantity')).fill('2');await page.locator(childField('form-warehouse')).fill(warehouse)
   await measured(page,'barcode-batch-save',`batch-${index}`,childAction('save-form'),{selector:ROOT,text:'采购条码已保存',absent:`${ROOT} [aria-label="批量修改 1 个条码"]`,orderNo:no,barcode:{code:`BC-UI-${index}`,quantity:2,warehouse}},()=>page.locator(childAction('save-form')).click())
  }
  await page.locator(childAction('reset')).click()
  for(let index=0;index<N;index++){
   await page.locator(childField('keyword')).fill(`BC-UI-${index}`);await page.locator(childAction('query')).click();await page.locator(childField('select-row')).check();await page.locator(childAction('offshelf')).click();await expect(page.locator('[data-pms-confirm-accept]')).toBeVisible()
   await measured(page,'barcode-offshelf',`offshelf-${index}`,'[data-pms-confirm-accept]',{selector:ROOT,text:'已下架',orderNo:no,barcode:{code:`BC-UI-${index}`,status:'已下架'}},()=>page.locator('[data-pms-confirm-accept]').click())
  }
  await page.locator(childAction('reset')).click()
  for(let index=0;index<N;index++){
   await page.locator(childField('keyword')).fill(`BC-IMPORT-${index}-A`);await page.locator(childAction('query')).click();await page.locator(childField('select-row')).check();await page.locator(childAction('delete-selected')).click()
   await measured(page,'barcode-delete',`delete-${index}`,'[data-pms-confirm-accept]',{selector:ROOT,text:'当前条件下暂无条码',orderNo:no,missingCodes:[`BC-IMPORT-${index}-A`]},()=>page.locator('[data-pms-confirm-accept]').click())
  }
  await page.locator(childAction('reset')).click()
  for(let index=0;index<N;index++){
   await page.locator(childField('keyword')).fill(`BC-IMPORT-${index}-B`);await page.locator(childAction('query')).click();await page.locator(childField('select-row')).check()
   await measured(page,'barcode-print-preview',`preview-${index}`,childAction('print-selected'),{selector:ROOT,text:'打印预览 · 1 个条码'},()=>page.locator(childAction('print-selected')).click())
   const preview=page.locator(`${ROOT} article`);await expect(preview).toContainText(lines[1].materialCode);await expect(preview).toContainText(`2 ${lines[1].unit}`);expect(await preview.locator('[data-image-src]').getAttribute('data-image-src')).toBe(lines[1].imageUrl)
   const downloadEvent=page.waitForEvent('download')
   await measured(page,'barcode-print-download',`download-${index}`,childAction('download-print'),{selector:ROOT,text:'已生成条码打印文件'},()=>page.locator(childAction('download-print')).click())
   const download=await downloadEvent;await download.saveAs(join(DIR,`print-${index}.html`));const html=readFileSync(join(DIR,`print-${index}.html`),'utf8');expect(html).toContain(lines[1].materialCode);expect(html).toContain(`2 ${lines[1].unit}`);expect(html).toContain('<svg')
   if(index===0){const printPage=await page.context().newPage();await printPage.setViewportSize({width:1280,height:720});await printPage.setContent(html);await settle(printPage,'main');await expect(printPage.locator('article')).toContainText(lines[1].materialCode);const thumbnails=JSON.parse(readFileSync('src/utils/static-image-thumbnails.json','utf8')) as Record<string,{thumbnail:string}>;expect(await printPage.locator('article img').getAttribute('src')).toBe(new URL(thumbnails[lines[1].imageUrl]?.thumbnail||lines[1].imageUrl,version.origin).href);await printPage.screenshot({path:join(DIR,'downloaded-print-render.png'),fullPage:true});await printPage.close()}
   await page.locator(childAction('cancel-form')).click()
  }
  await page.locator(childAction('reset')).click();await closeLedger(page)
  // Verify import and print entry points really open the corresponding child surfaces.
  await openLedger(page,no,'parity-barcode-import');await expect(page.locator(childField('import-file'))).toBeVisible();await closeLedger(page)
  await openLedger(page,no,'parity-barcode-print');await expect(page.locator(ROOT)).toContainText('打印预览');await closeLedger(page)
  await page.locator(`[data-pms-mpo-field="select-row"][data-order-no="${no}"]`).check();await page.locator('[data-pms-mpo-action="parity-placed"]').click();await page.locator('[data-pms-confirm-accept]').click()
  await page.locator(`[data-pms-mpo-action="open-detail"][data-order-no="${no}"]`).click();await page.locator('[data-pms-mpo-action="parity-quantity"][data-stage="actualPurchased"]').click()
  for(const line of lines)await page.locator(`[data-parity-line="${line.lineId}"] [name="value"]`).fill('100')
  await page.locator('[data-pms-mpo-action="parity-save"]').click();await expect(page.locator('[data-mpo-parity-dialog]')).toHaveCount(0)
  await queryOrder(page,no);await openLedger(page,no)
  await page.locator(childAction('create')).click();await page.locator(childField('form-purchaseLineId')).selectOption(lines[0].lineId);await page.locator(childField('form-code')).fill('BC-OVER-LIMIT');await page.locator(childField('form-quantity')).fill('101');const beforeLimit=await order(page,no);await page.locator(childAction('save-form')).click();await expect(page.locator(ROOT)).toContainText(/超过可编数量/);expect(await order(page,no)).toEqual(beforeLimit)
  await page.screenshot({path:join(DIR,'quantity-guard.png'),fullPage:true});await page.locator(childAction('cancel-form')).click();await page.locator('[data-pms-confirm-accept]').click();await closeLedger(page)
  const durable=await order(page,no);await page.reload();await queryOrder(page,no);await openLedger(page,no);expect(await order(page,no)).toEqual(durable)
  const visibleRows=page.locator(`${ROOT} tbody tr`);await expect(visibleRows.first()).toBeVisible();await settle(page,ROOT);await page.screenshot({path:join(DIR,'refreshed-ledger.png'),fullPage:true});writeFileSync(join(DIR,'durable-order.json'),JSON.stringify(durable,null,2))
  expect(durable.inventoryPostings||[]).toEqual([]);expect(durable.detailBarcodes!.every(row=>!row.printedAt)).toBe(true);expect(errors).toEqual([])
  const families=[...new Set(samples.map(sample=>sample.family))]
  for(const family of families){const rows=samples.filter(sample=>sample.family===family);expect(rows.length,`${family} valid samples`).toBe(N);expect(rows.every(row=>row.error===null&&row.elapsed!==null),family).toBe(true);if(!CALIBRATION)expect(Math.max(...rows.map(row=>row.elapsed!)),`${family} <=1000 ms`).toBeLessThanOrEqual(1000)}
 }finally{
  writeFileSync(join(DIR,'loaded-assets.json'),JSON.stringify(assets,null,2));writeFileSync(join(DIR,'browser-errors.json'),JSON.stringify(errors,null,2));writeFileSync(join(DIR,'raw-performance.json'),JSON.stringify(samples,null,2))
  writeFileSync(join(DIR,'result.json'),JSON.stringify({run:RUN,calibration:CALIBRATION,status:testInfo.status,expectedStatus:testInfo.expectedStatus,sampleCount:samples.length,families:[...new Set(samples.map(row=>row.family))].map(family=>({family,count:samples.filter(row=>row.family===family).length,max:Math.max(...samples.filter(row=>row.family===family).map(row=>row.elapsed||0))})),errors:testInfo.errors.map(error=>({message:error.message,stack:error.stack}))},null,2))
 }
})

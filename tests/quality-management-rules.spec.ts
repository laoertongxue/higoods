import { useEmptyInventoryQualityFixture } from './helpers/inventory-quality-empty-fixture.ts'
import { inventoryClick, saveInventoryTimings } from './helpers/inventory-quality-timing.ts'
import { fillPostQcRow } from './helpers/post-finishing-qc-form.ts'
import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

// Business setup below only chooses an effective configurable rule in an
// isolated browser. All QC claiming, counts, audit decisions and completion
// exercised in these cases use the original business page controls.
async function openFinishingInventoryApplication(page: Page) {
  const id = new URL(page.url()).searchParams.get('id')
  if (!id) throw new Error('缺少本次库存送检申请身份')
  await page.goto(`/fcs/craft/post-finishing/inventory-quality?id=${encodeURIComponent(id)}`)
}

async function configuredSampling(page: Page) {
  await page.addInitScript(()=>{(window as any).__name=(value:unknown)=>value;localStorage.setItem('higood-fcs-post-finishing-current-actor-v1','PF-USER-QC-MGR')})
  await page.route('**/__quality-ui-setup',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><body></body>'}))
  await page.goto('/__quality-ui-setup')
  return await page.evaluate(async()=>{
    const path='/src/data/fcs/post-finishing-inventory-bridge.ts',q=await import(path)
    await (await import('/src/data/fcs/quality-management-records.ts')).prepareQualityConfigurationSchema()
    await q.ensureQualityManagementRecords()
    const rule=q.buildQualityConfigurationDraft('RULE','production-return-rule-v1')
    rule.initialFullInspection=null
    await q.saveQualityConfigurationDraft(rule);await q.publishQualityConfiguration(rule.id)
    const pending=q.listPostFinishingFullFlowQcTasks().find((row:any)=>row.status==='待质检' && row.lines.length===5 && row.lines.every((line:any)=>line.expectedQty===20 && line.sku.spuCode==='SPU-QC-001'))
    if(!pending)throw Error('缺少已实收且待领取的100件原生QC来源')
    return pending.qcTaskNo
  })
}
async function openConfiguredQc(page:Page,qcNo:string){
  await page.goto('/fcs/craft/post-finishing/qc-workbench?taskNo='+encodeURIComponent(qcNo))
  await page.getByRole('button',{name:'领取并固定本次检查要求',exact:true}).click()
  await expect(page.getByText('本次固定检查要求',{exact:true})).toBeVisible()
}
async function allocate(page:Page,values:Array<[number,number,number]>) {
  const lines=page.locator('[data-qc-result-line]')
  await expect(lines).toHaveCount(values.length)
  for(let i=0;i<values.length;i++) {
    const line=lines.nth(i),[passed,defect,rework]=values[i]
    await fillPostQcRow(line,passed,defect,rework)
  }
}
async function snapshot(page:Page) {
  return page.evaluate(async()=>{const path='/src/data/pcs-record-db.ts',db=await import(path);const data=await db.readPcsRecords(['higood-fcs-post-finishing-records','higood-finished-inventory']);return data.records.filter((row:any)=>!row.deleted).map((row:any)=>({id:row.id,collection:row.collection,value:row.value,version:row.version}))})
}
async function acceptClick(page:Page,name:string) {page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name,exact:true}).click()}

test('中心六类管理页面在两种命名桌面尺寸无主体横溢且键盘可进入查询',async({page},testInfo)=>{
  test.setTimeout(120000)
  const evidence=[]
  for(const viewport of [{width:1366,height:768},{width:1280,height:720}]){
    await page.setViewportSize(viewport)
    for(const section of ['basic-standards','additional-standards','inspection-rules','records','audits','statistics']){
      await page.goto('/fcs/quality-management/'+section)
      await expect(page.locator('[data-quality-management-page]')).toBeVisible()
      const layout=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,
        mainRight:document.querySelector('main')!.getBoundingClientRect().right,title:document.querySelector('main h1')?.textContent}))
      expect(layout.document).toBeLessThanOrEqual(viewport.width+1);expect(layout.body).toBeLessThanOrEqual(viewport.width+1)
      expect(layout.mainRight).toBeLessThanOrEqual(viewport.width+1)
      const input=page.locator('main input:not([type="hidden"]):visible').first()
      if(await input.count()){await input.focus();await expect(input).toBeFocused();await page.keyboard.press('Tab');expect(await page.evaluate(()=>document.activeElement!==document.body)).toBe(true)}
      evidence.push({section,viewport,...layout})
      await testInfo.attach(`${section}-${viewport.width}`,{body:await page.screenshot({fullPage:true}),contentType:'image/png'})
    }
  }
  await testInfo.attach('management-device-layouts',{body:JSON.stringify(evidence),contentType:'application/json'})
})

test('旧复检标签定域退出，正常业务标签与其他偏好在冷进入和刷新后保留',async({page},testInfo)=>{
  await page.addInitScript(()=>{(window as any).__name=(value:unknown)=>value})
  await page.route('**/__quality-tab-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><body></body>'}))
  await page.goto('/__quality-tab-fixture')
  const tabs={
    fcs:{activeKey:'old-fcs-recheck',tabs:[{key:'old-fcs-recheck',title:'旧复检详情',href:'/fcs/craft/post-finishing/recheck-orders/OLD-RC?from=history'},{key:'original-fee',title:'质量扣款历史',href:'/fcs/quality/deduction-analysis'}]},
    pfos:{activeKey:'old-pda-recheck',tabs:[{key:'old-list',title:'复检单',href:'/fcs/craft/post-finishing/recheck-orders'},{key:'old-pda-recheck',title:'复检执行',href:'/fcs/pda/post-finishing/recheck?id=OLD-RC'},{key:'kept-post',title:'后道加工单',href:'/fcs/craft/post-finishing/work-orders'}]},
    wls:{activeKey:'kept-stock',tabs:[{key:'kept-stock',title:'库存查询（复检历史备注保留）',href:'/wls/finished/stock/realtime'}]},
  }
  await page.evaluate(tabs=>{localStorage.setItem('higood-tabs',JSON.stringify(tabs));localStorage.setItem('quality-verification-unrelated-preference','keep-original-value')},tabs)
  for(const refresh of [false,true]){
    if(refresh)await page.reload();else await page.goto('/fcs/quality-management/basic-standards')
    await expect(page.locator('[data-quality-management-page]')).toBeVisible()
    const actual=await page.evaluate(async()=>({state:(await import('/src/state/store.ts')).appStore.getState().allTabs,saved:JSON.parse(localStorage.getItem('higood-tabs')!),other:localStorage.getItem('quality-verification-unrelated-preference')}))
    for(const collection of [actual.state,actual.saved]){
      const retired=Object.values(collection).flatMap((group:any)=>group.tabs).filter((tab:any)=>/^\/fcs\/(?:craft\/post-finishing\/recheck-orders|pda\/post-finishing\/recheck)(?:[/?]|$)/.test(tab.href))
      expect(retired).toEqual([])
      expect(collection.pfos.tabs.filter((tab:any)=>tab.href==='/fcs/craft/post-finishing/work-orders')).toHaveLength(1)
      expect(Object.values(collection).flatMap((group:any)=>group.tabs).filter((tab:any)=>tab.href==='/fcs/quality/deduction-analysis')).toHaveLength(1)
      expect(collection.wls.tabs).toEqual(tabs.wls.tabs)
      expect(collection.pfos.activeKey).not.toBe('old-pda-recheck')
    }
    expect(actual.other).toBe('keep-original-value')
    await testInfo.attach(`retired-tabs-${refresh?'refresh':'cold'}`,{body:JSON.stringify(actual),contentType:'application/json'})
  }
})

test('原QC真实文件预览、配额失败保留、同名替换释放未保存文件，已保存附件保持可读',async({page},testInfo)=>{
  test.setTimeout(120000)
  const qcNo=await configuredSampling(page);await page.setViewportSize({width:1024,height:768})
  await openConfiguredQc(page,qcNo)
  await expect(page.locator('[data-qc-result-line]')).toHaveCount(5)
  const zoom=page.locator('[data-post-finishing-action="full-flow-zoom-image"]').first()
  const pictureUrl=await zoom.getAttribute('data-image-url')
  for(const close of ['button','backdrop','escape']){
    await zoom.click();await expect(page.locator('[data-post-image-overlay]')).toBeVisible()
    await expect.poll(()=>page.locator('[data-post-image-overlay] img').evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true)
    const ratio=await page.locator('[data-post-image-overlay] img').evaluate((img:HTMLImageElement)=>({natural:img.naturalWidth/img.naturalHeight,shown:img.width/img.height}))
    expect(ratio.shown).toBeCloseTo(ratio.natural,2)
    if(close==='button')await page.getByRole('button',{name:'关闭图片',exact:true}).click()
    else if(close==='escape')await page.keyboard.press('Escape')
    else await page.locator('[data-post-image-overlay]').click({position:{x:2,y:2}})
    await expect(page.locator('[data-post-image-overlay]')).toHaveCount(0)
  }
  const brokenUrl=new URL(pictureUrl!,page.url()).href
  await page.route(brokenUrl,route=>route.abort('failed'))
  await zoom.click();await expect(page.locator('[data-post-image-status]')).toContainText('图片加载失败')
  await page.unroute(brokenUrl);await page.getByRole('button',{name:'重新加载图片',exact:true}).click()
  await expect.poll(()=>page.locator('[data-post-image-overlay] img').evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true)
  await page.keyboard.press('Escape')
  await page.evaluate(()=>{const original=URL.revokeObjectURL; (window as any).__qcRevoked=[];URL.revokeObjectURL=function(url){(window as any).__qcRevoked.push(url);return original.call(URL,url)}})
  const photo=page.locator('[data-qc-issue-files]').first()
  await photo.setInputFiles({name:'invalid.txt',mimeType:'text/plain',buffer:Buffer.from('not an image')})
  await expect(page.locator('[data-qc-selection-error]')).toContainText('问题照片')
  await expect(page.locator('[data-qc-selected-files] img')).toHaveCount(0)
  expect(await photo.evaluate((node:HTMLInputElement)=>node.files?.length)).toBe(0)
  const black=await readFile('public/materials/pcs-reviewed/tee-black.jpg'),white=await readFile('public/materials/pcs-reviewed/tee-white.jpg')
  await photo.setInputFiles({name:'同名现场测试图片.jpg',mimeType:'image/jpeg',buffer:black})
  const preview=page.locator('[data-qc-selected-files] img').first()
  await expect.poll(()=>preview.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true)
  const firstUrl=await preview.getAttribute('src')
  await allocate(page,[[20,0,0],[10,0,0],[0,0,0],[0,0,0],[0,0,0]])
  await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;(window as any).__qcOriginalPut=put;IDBObjectStore.prototype.put=function(...args:any[]){if(this.name==='records'&&String(args[0]?.id).includes('/flow/qcTasks/'))throw new DOMException('isolated UI attachment quota','QuotaExceededError');return put.apply(this,args as any)}})
  await page.getByRole('button',{name:'提交第1轮检查',exact:true}).click()
  await expect(page.locator('[data-qc-save-error]')).toContainText('当前输入和所选文件已保留')
  await expect(page.locator('[data-qc-result-field="passedQty"]').first()).toHaveValue('20')
  expect(await photo.evaluate((node:HTMLInputElement)=>node.files?.[0]?.name)).toBe('同名现场测试图片.jpg')
  expect(await page.evaluate(url=>(window as any).__qcRevoked.includes(url),firstUrl)).toBe(false)
  const before=await snapshot(page);expect(before.filter(row=>row.collection==='flow/qcTasks').some(row=>row.value.inspection?.rounds.some((round:any)=>round.lines.some((line:any)=>line.issuePhotoUrls?.length)))).toBe(false)
  await photo.setInputFiles({name:'同名现场测试图片.jpg',mimeType:'image/jpeg',buffer:white})
  await expect.poll(()=>page.evaluate(url=>(window as any).__qcRevoked.includes(url),firstUrl)).toBe(true)
  const secondUrl=await preview.getAttribute('src');expect(secondUrl).not.toBe(firstUrl)
  await expect.poll(()=>preview.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true)
  await page.evaluate(()=>{IDBObjectStore.prototype.put=(window as any).__qcOriginalPut})
  await page.getByRole('button',{name:'提交第1轮检查',exact:true}).click()
  await expect(page.getByRole('heading',{name:'完成本批QC并按去向办理',exact:true})).toBeVisible()
  expect(await page.evaluate(url=>(window as any).__qcRevoked.includes(url),secondUrl)).toBe(false)
  const saved=await snapshot(page),qc=saved.find(row=>row.collection==='flow/qcTasks'&&row.value.inspection?.rounds[0]?.lines.some((line:any)=>line.issuePhotoUrls?.length))!.value
  expect(qc.inspection.rounds).toHaveLength(1);expect(qc.inspection.rounds[0].lines[0].issuePhotoUrls[0]).toMatch(/^pcs-file:/)
  await page.reload();await expect(page.locator('[data-qc-workbench-task]')).toBeVisible()
  const image=page.locator('img[alt="第1轮问题照片"]').first()
  await expect.poll(()=>image.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true)
  await testInfo.attach('qc-file-failure-replace-refresh',{body:await page.screenshot({fullPage:true}),contentType:'image/png'})
})

test('QC分区保存保留其他未提交数量、原生文件与依据输入，完成前须处理剩余草稿',async({page},testInfo)=>{
  test.setTimeout(120000)
  const qcNo=await configuredSampling(page);await page.setViewportSize({width:1024,height:768})
  await openConfiguredQc(page,qcNo)
  await expect(page.locator('[data-qc-result-line]')).toHaveCount(5)
  await allocate(page,[[20,0,0],[10,0,0],[0,0,0],[0,0,0],[0,0,0]])
  const bytes=await readFile('public/materials/pcs-reviewed/tee-black.jpg')
  await page.locator('[data-qc-issue-files]').first().setInputFiles({name:'尚未提交的问题照片.jpg',mimeType:'image/jpeg',buffer:bytes})
  const basis=page.locator('details').filter({has:page.locator('[data-qc-basis-conflict]')})
  await basis.locator('summary').click();await page.locator('[data-qc-basis-conflict]').fill('保留中的冲突草稿')
  const readDraft=()=>page.locator('[data-qc-result-line]').evaluateAll(nodes=>nodes.map(row=>({sku:row.getAttribute('data-qc-result-line'),counts:[...row.querySelectorAll<HTMLInputElement>('[data-qc-result-field]')].map(node=>[node.getAttribute('data-qc-result-field'),node.value]),items:[...row.querySelectorAll('[data-qc-observation]')].map(item=>({id:item.getAttribute('data-qc-observation'),values:[...item.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>('input,select,textarea')].map(node=>node.value)}))})))
  const roundDraft=await readDraft()
  for(let sample=0;sample<5;sample++){
    const name=sample===0?'首次纸单.jpg':`本版补充纸单${sample+1}.jpg`
    await page.locator('[data-qc-paper-file]').setInputFiles({name,mimeType:'image/jpeg',buffer:bytes})
    await inventoryClick(page,'保存纸单并保留全部未提交检查项',page.getByRole('button',{name:'上传并保存当前纸单',exact:true}),async()=>{await expect(page.getByRole('link',{name,exact:true})).toBeVisible();expect(await readDraft()).toEqual(roundDraft)})
  }
  await expect(page.locator('[data-qc-result-field="passedQty"]').first()).toHaveValue('20')
  await expect(page.locator('[data-qc-result-field="passedQty"]').nth(1)).toHaveValue('10')
  await expect(page.locator('[data-qc-basis-conflict]')).toHaveValue('保留中的冲突草稿')
  expect(await page.locator('[data-qc-issue-files]').first().evaluate((node:HTMLInputElement)=>node.files?.[0]?.name)).toBe('尚未提交的问题照片.jpg')
  await expect.poll(()=>page.locator('[data-qc-selected-files] img').first().evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true)
  await page.locator('[data-qc-paper-file]').setInputFiles({name:'提交轮次前另选纸单.jpg',mimeType:'image/jpeg',buffer:bytes})
  await page.getByRole('button',{name:'提交第1轮检查',exact:true}).click()
  await expect(page.getByRole('heading',{name:'完成本批QC并按去向办理',exact:true})).toBeVisible()
  expect(await page.locator('[data-qc-paper-file]').evaluate((node:HTMLInputElement)=>node.files?.[0]?.name)).toBe('提交轮次前另选纸单.jpg')
  await expect(page.locator('[data-qc-basis-conflict]')).toHaveValue('保留中的冲突草稿')
  const qc=(await snapshot(page)).find(row=>row.collection==='flow/qcTasks'&&row.value.inspection?.rounds[0]?.lines[0].issuePhotoUrls?.length)!.value
  expect(qc.inspection.rounds).toHaveLength(1)
  // Completion cannot silently discard another section's draft.
  await page.getByRole('button',{name:'确认完成QC并生成对应去向',exact:true}).click()
  await expect(page.locator('[data-qc-save-error]')).toContainText('还有尚未提交')
  await page.locator('[data-qc-basis-conflict]').fill('')
  for(const item of await page.locator('[data-qc-process-item]').all())await item.uncheck()
  await page.getByRole('button',{name:'上传并保存当前纸单',exact:true}).click()
  await expect(page.getByRole('link',{name:'提交轮次前另选纸单.jpg',exact:true})).toBeVisible()
  expect(await page.locator('[data-qc-process-item]:checked').count()).toBe(0)
  // A chosen file can be explicitly discarded without changing either saved paper.
  await page.locator('[data-qc-paper-file]').setInputFiles({name:'主动清除的未保存文件.jpg',mimeType:'image/jpeg',buffer:bytes})
  await page.getByRole('button',{name:'清除此处所选文件',exact:true}).click()
  await expect.poll(()=>page.locator('[data-qc-paper-file]').evaluate((node:HTMLInputElement)=>node.files?.length)).toBe(0)
  await page.locator('[data-qc-paper-file]').setInputFiles({name:'超限无效纸单.jpg',mimeType:'image/jpeg',buffer:Buffer.alloc(20*1024*1024+1,1)})
  await expect(page.locator('[data-qc-selection-error]')).toContainText('本次无效选择已清除')
  expect(await page.locator('[data-qc-paper-file]').evaluate((node:HTMLInputElement)=>node.files?.length)).toBe(0)
  await expect(page.getByRole('link',{name:'首次纸单.jpg',exact:true})).toBeVisible()
  await expect(page.getByRole('link',{name:'提交轮次前另选纸单.jpg',exact:true})).toBeVisible()
  await acceptClick(page,'确认完成QC并生成对应去向')
  await expect(page.locator('[data-qc-workbench-task]')).toHaveCount(0)
  const final=(await snapshot(page)).find(row=>row.id.endsWith(encodeURIComponent(qc.qcTaskId)))!.value
  expect(final.status).toBe('质检完成');expect(final.inspection.papers).toHaveLength(6)
  expect(final.inspection.papers.map((paper:any)=>paper.name)).toEqual(expect.arrayContaining(['首次纸单.jpg','本版补充纸单2.jpg','本版补充纸单5.jpg','提交轮次前另选纸单.jpg']))
  await saveInventoryTimings(page,testInfo)
  expect(final.frozenProcessItems).toEqual([])
  await testInfo.attach('qc-local-section-save',{body:JSON.stringify({qc:final,nativeFileRetained:true,unsavedCompletionBlocked:true},null,2),contentType:'application/json'})
})

test('原QC完整30→50→100：分轮/稽查/当前纸单/正常出货，刷新同一事实',async({page},testInfo)=>{
  const qcNo=await configuredSampling(page)
  await openConfiguredQc(page,qcNo)
  await expect(page.locator('[data-qc-result-line]')).toHaveCount(5)
  await expect(page.locator('[data-qc-workbench-task]')).toContainText('尚需检查 30')
  await allocate(page,[[17,2,1],[10,0,0],[0,0,0],[0,0,0],[0,0,0]])
  const firstLine=page.locator('[data-qc-result-line]').first(),issueNote='应有扣子实物缺失，按辅料配件项目记录；一件多个问题不重复计件'
  const accessory=firstLine.locator('[data-qc-observation="garment-accessory"]')
  if(await accessory.count()){await accessory.locator('[data-qc-observation-result]').selectOption('FAIL');await accessory.locator('[data-qc-observation-defect]').selectOption({index:1});await accessory.locator('[data-qc-observation-note]').fill(issueNote)}
  else {await firstLine.locator('[data-qc-issue="garment-accessory"]').check();await firstLine.locator('[data-qc-issue-note]').fill(issueNote)}
  await page.getByRole('button',{name:'提交第1轮检查',exact:true}).click()
  await expect(page.getByRole('heading',{name:'处理本轮稽查'})).toBeVisible()
  await expect(page.getByRole('button',{name:'确认完成QC并生成对应去向',exact:true})).toHaveCount(0)
  await page.locator('[data-qc-paper-file]').setInputFiles({name:'旧30比例尚未上传纸单.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 old30 pending fixture')})
  await page.locator('[data-qc-upgrade-note]').fill('首轮坏3件，按已确认规则升到50%')
  await acceptClick(page,'确认提高检查比例')
  await expect(page.locator('[data-qc-workbench-task]')).toContainText('尚需检查 20')
  expect(await page.locator('[data-qc-paper-file]').evaluate((node:HTMLInputElement)=>node.files?.length)).toBe(0)
  await expect(page.locator('[data-qc-action-notice]')).toContainText('旧要求下尚未上传的纸单选择已清除')
  await allocate(page,[[0,0,0],[8,2,0],[10,0,0],[0,0,0],[0,0,0]])
  await page.getByRole('button',{name:'提交第2轮检查',exact:true}).click()
  await expect(page.getByRole('heading',{name:'处理本轮稽查'})).toBeVisible()
  await page.locator('[data-qc-upgrade-note]').fill('第二轮坏2件，升全检')
  await acceptClick(page,'确认提高检查比例')
  await expect(page.locator('[data-qc-workbench-task]')).toContainText('尚需检查 50')
  await allocate(page,[[0,0,0],[0,0,0],[10,0,0],[20,0,0],[20,0,0]])
  await page.getByRole('button',{name:'提交第3轮检查',exact:true}).click()
  await expect(page.getByRole('heading',{name:'处理本轮稽查'})).toHaveCount(0)
  for(const item of await page.locator('[data-qc-process-item]').all()) await item.uncheck()
  await acceptClick(page,'确认完成QC并生成对应去向')
  await expect(page.getByRole('alert')).toContainText('纸面双签单')
  await expect(page.locator('[data-qc-workbench-task]')).toContainText('质检中')
  // Explicit synthetic file checks upload/Blob persistence, never proves a
  // real factory signature. The printed double-signature layout is tested separately.
  const bytes=Buffer.from('%PDF-1.4\n% isolated signed-paper upload fixture, two test signatures\n%%EOF')
  await page.locator('[data-qc-paper-file]').setInputFiles({name:'隔离验收双签纸单示例.pdf',mimeType:'application/pdf',buffer:bytes})
  await page.getByRole('button',{name:'上传并保存当前纸单',exact:true}).click()
  await expect(page.getByRole('link',{name:'隔离验收双签纸单示例.pdf'})).toBeVisible()
  for(const item of await page.locator('[data-qc-process-item]').all()) await item.uncheck()
  await acceptClick(page,'确认完成QC并生成对应去向')
  await expect(page.locator('[data-qc-workbench-task]')).toHaveCount(0)
  const saved=await snapshot(page),qc=saved.find(row=>row.collection==='flow/qcTasks'&&row.value.inspection?.rounds.length===3)!.value
  expect(qc.status).toBe('质检完成');expect(qc.inspection.rounds.map((row:any)=>row.lines.reduce((n:number,line:any)=>n+line.passedQty+line.defectQty+line.returnQty,0))).toEqual([30,20,50])
  expect(qc.results.reduce((n:number,line:any)=>n+line.releasedQty,0)).toBe(95)
  const outbound=saved.find(row=>row.collection==='flow/outboundOrders'&&row.value.qcTaskId===qc.qcTaskId)!.value
  expect(outbound.status).toBe('待出货');expect(outbound.dispatchedAt).toBeUndefined()
  await page.goto(`/fcs/craft/post-finishing/qc-workbench?taskNo=${encodeURIComponent(qc.qcTaskNo)}&view=detail`)
  await expect(page.locator('[data-qc-workbench-task]')).toContainText('正常可放行95件')
  await page.reload();await expect(page.locator('[data-qc-workbench-task]')).toContainText('正常可放行95件')
  expect(qc.inspection.rounds[0].lines[0].issues).toEqual(expect.arrayContaining([expect.objectContaining({itemId:'garment-accessory',note:expect.stringContaining('应有扣子实物缺失')})]))
  await page.getByRole('link',{name:'登记另行安排的独立追检',exact:true}).click()
  const follow=page.locator('details').filter({has:page.locator('[data-qc-follow-object]')})
  await follow.locator('summary').click()
  await follow.locator('[data-qc-follow-object]').fill('已完成原QC的同批衣服')
  await follow.locator('[data-qc-follow-reason]').fill('标准更新后另行明确范围，原批次不自动重开')
  await follow.locator('[data-qc-follow-result]').fill('对明确10件实际追检，未发现新增问题')
  await follow.locator('[data-qc-follow-item]').first().check()
  await follow.getByRole('button',{name:'保存独立追检记录',exact:true}).click()
  await expect(page.locator('[data-qc-save-error]')).toContainText('须明确追检对象、范围、项目')
  await expect(follow.locator('[data-qc-follow-object]')).toHaveValue('已完成原QC的同批衣服')
  await follow.locator('[data-qc-follow-scope]').fill('另行明确10件，仅本次勾选项目')
  await follow.getByRole('button',{name:'保存独立追检记录',exact:true}).click()
  await expect(page.locator('[data-qc-action-notice]')).toContainText('独立追检记录已保存')
  const followed=await snapshot(page),updated=followed.find(row=>row.id.endsWith(encodeURIComponent(qc.qcTaskId)))!.value
  expect(updated.status).toBe('质检完成');expect(updated.results).toEqual(qc.results)
  expect(updated.inspection).toEqual(qc.inspection)
  expect(updated.independentChecks).toHaveLength(1)
  expect(updated.independentChecks[0]).toMatchObject({originalRecordId:qc.qcTaskId,scopeDescription:'另行明确10件，仅本次勾选项目'})
  expect(followed.filter(row=>row.collection==='flow/qcTasks')).toHaveLength(saved.filter(row=>row.collection==='flow/qcTasks').length)
  expect(followed.filter(row=>row.collection==='flow/outboundOrders')).toEqual(saved.filter(row=>row.collection==='flow/outboundOrders'))
  await page.reload();await expect(page.locator('[data-qc-workbench-task]')).toContainText('另行明确10件，仅本次勾选项目')
  expect((await snapshot(page)).find(row=>row.id.endsWith(encodeURIComponent(qc.qcTaskId)))!.value.independentChecks).toHaveLength(1)
  await testInfo.attach('original-qc-independent-followup-native',{body:JSON.stringify(updated,null,2),contentType:'application/json'})
  await page.screenshot({path:testInfo.outputPath('production-qc-complete.png'),fullPage:true})
  await testInfo.attach('production-qc-ui-persistent-result',{body:JSON.stringify({qc,outbound},null,2),contentType:'application/json'})
  // The original QC UI above creates every round and audit. The center only
  // reads these exact facts, including cumulative targets and later rounds.
  const nativeBefore=await snapshot(page)
  for(const [index,checked,target,needed] of [[0,30,50,20],[1,50,100,50]]){
    const audit=qc.inspection.audits[index]
    await page.goto('/fcs/quality-management/audits/'+encodeURIComponent(`PRODUCTION_RETURN|${qc.qcTaskId}|${audit.id}`))
    await expect(page.locator('main')).toContainText(`触发时累计已检：${checked}件；升检后累计应检：${target}件；本次需补检：${needed}件`)
    await expect(page.locator('main')).toContainText('第3轮：比例100%，累计应检100件；本轮合格50件')
    if(index===0)await expect(page.locator('main')).toContainText('第2轮：比例50%，累计应检50件；本轮合格18件、瑕疵2件、返工0件')
    await testInfo.attach(`audit-detail-original-rounds-${index+1}`,{body:await page.screenshot({fullPage:true}),contentType:'image/png'})
  }
  expect(await snapshot(page)).toEqual(nativeBefore)
})

test('六类中心真实原页面直达，记录/稽查/分析只读；旧复检地址全部退役',async({page},testInfo)=>{
  for(const [section,title] of [['basic-standards','基本质检标准'],['additional-standards','附加质检标准'],['inspection-rules','检验方式与升级规则'],['records','质检记录汇总'],['audits','稽查与升级记录'],['statistics','质检统计分析']]) {
    await page.goto('/fcs/quality-management/'+section)
    await expect(page.getByRole('heading',{name:title,exact:true}).first()).toBeVisible()
    await expect(page.locator('[data-quality-management-page]')).toBeVisible()
    await expect(page.locator('[data-post-finishing-action="full-flow-claim-qc"],[data-post-finishing-action="full-flow-complete-qc"]')).toHaveCount(0)
  }
  for(const route of ['/fcs/craft/post-finishing/recheck-orders','/fcs/craft/post-finishing/recheck-orders/retired','/fcs/pda/post-finishing/recheck']) {
    await page.goto(route)
    await expect(page.getByText(/页面不存在|页面未找到|未找到页面|404/).first()).toBeVisible()
    await expect(page.locator('[data-post-finishing-action*="recheck"],[data-pf-action*="recheck"]')).toHaveCount(0)
  }
  await testInfo.attach('retired-route-checks',{body:JSON.stringify({routes:['list','detail','PDA'],noExecution:true}),contentType:'application/json'})
})

for(const [received,target,escalate] of [[79,24,true],[81,25,false]] as const) test(`库存原页面→实际收${received}→QC应检${target}→真实分类/接收/上架完整闭环`,async({page},testInfo)=>{
  test.setTimeout(120000)
  await page.addInitScript(()=>{
    localStorage.setItem('higood-fcs-post-finishing-current-actor-v1','PF-USER-QC-MGR')
    ;(window as any).__inventoryQcCuttingReads=[]
    const original=IDBDatabase.prototype.transaction
    IDBDatabase.prototype.transaction=function(...args:Parameters<typeof original>){
      if(this.name==='higood-cutting-records-v1')(window as any).__inventoryQcCuttingReads.push({stores:args[0],mode:args[1]})
      return original.apply(this,args)
    }
  })
  await page.setViewportSize({width:1024,height:768})
  await page.goto('/wls/finished/stock/realtime')
  const row=page.locator('tr').filter({hasText:'SKU-GC-20001'}).first()
  await row.getByRole('link',{name:'本仓本款全部送检'}).click()
  await expect(page.locator('[data-fiq-form="apply"] input[name="operator"]')).toHaveCount(0)
  await page.getByRole('button',{name:'确认下架出库 80 件'}).click()
  await expect(page.getByRole('heading',{name:'库存送检流转详情'})).toBeVisible()
  const application=(await snapshot(page)).find(row=>row.collection==='higood-finished-inventory/applications')!.value
  await openFinishingInventoryApplication(page)
  const receive=page.locator('[data-fiq-form="receive"]')
  for(const [i,line] of application.lines.entries())await receive.locator(`input[name="quantity"][data-sku-id="${line.skuId}"]`).fill(String(line.outboundQty+(i===0?received-80:0)))
  await expect(receive.locator('input[name="operator"]')).toHaveCount(0)
  await receive.getByRole('button',{name:'确认整批实收并形成库存QC'}).click()
  const applicationUrl=page.url().replace('/wls/finished/inventory-quality','/fcs/craft/post-finishing/inventory-quality')
  await page.getByRole('link',{name:'进入后道原质检工作台'}).click()
  await page.getByRole('button',{name:'领取并固定本次检查要求',exact:true}).click()
  await expect(page.locator('[data-qc-workbench-task]')).toContainText(`实际接收${received}件`)
  await expect(page.locator('[data-qc-workbench-task]')).toContainText(`尚需检查 ${target}`)
  await expect(page.locator('[data-qc-workbench-task]')).toContainText('当前比例 30%')
  expect(await page.evaluate(()=>(window as any).__inventoryQcCuttingReads)).toEqual([])
  const inputs=page.locator('[data-qc-result-line]');await expect(inputs).toHaveCount(2)
  await allocate(page,escalate?[[target-3,2,1],[0,0,0]]:[[target-1,1,0],[0,0,0]])
  await page.getByRole('button',{name:'提交第1轮检查',exact:true}).click()
  if(escalate){
    await expect(page.getByRole('heading',{name:'处理本轮稽查'})).toBeVisible()
    await page.locator('[data-qc-upgrade-percent]').selectOption('100')
    await page.locator('[data-qc-upgrade-note]').fill('本申请发现3件问题，直接升为全检')
    await acceptClick(page,'确认提高检查比例')
    await expect(page.locator('[data-qc-result-line]')).toHaveCount(2)
    await expect(page.locator('[data-qc-workbench-task]')).toContainText(`尚需检查 ${received-target}`)
    const lines=page.locator('[data-qc-result-line]'),remaining=await lines.evaluateAll(nodes=>nodes.map(node=>Number((node as HTMLElement).dataset.remaining)))
    await allocate(page,remaining.map(n=>[n,0,0] as [number,number,number]))
    await page.getByRole('button',{name:'提交第2轮检查',exact:true}).click()
    await expect(page.getByRole('heading',{name:'处理本轮稽查'})).toHaveCount(0)
  }
  await expect(page.getByRole('heading',{name:'完成本批QC并按去向办理',exact:true})).toBeVisible()
  await expect(page.locator('[data-qc-workbench-task]')).toContainText('库存不额外要求纸面双签')
  await acceptClick(page,'确认完成QC并生成对应去向')
  await expect(page.locator('[data-qc-workbench-task]')).toHaveCount(0)
  const persisted=await snapshot(page),qc=persisted.find(row=>row.collection==='flow/qcTasks'&&row.value.sourceKind==='WAREHOUSE_STOCK')!.value
  expect(qc.status).toBe('质检完成');expect(qc.inspection.rounds[0].lines.reduce((n:number,line:any)=>n+line.passedQty+line.defectQty+line.returnQty,0)).toBe(target)
  expect(qc.results.reduce((n:number,line:any)=>n+line.releasedQty,0)).toBe(received-(escalate?3:1))
  expect(qc.inspection.papers).toHaveLength(0)
  expect(await page.evaluate(()=>(window as any).__inventoryQcCuttingReads)).toEqual([])
  await testInfo.attach(`inventory-${received}-actual-qc-completed`,{body:JSON.stringify({qc},null,2),contentType:'application/json'})
  if(received===79){
    const productionNo=await page.evaluate(async()=>{const path='/src/data/fcs/post-finishing-inventory-bridge.ts',flow=await import(path);return flow.listPostFinishingFullFlowQcTasks().find((row:any)=>row.sourceKind!=='WAREHOUSE_STOCK'&&row.status==='待质检')!.qcTaskNo})
    await page.goto('/fcs/craft/post-finishing/qc-workbench')
    await page.locator('[data-post-finishing-field="qc-task-input"]').fill(productionNo)
    await page.getByRole('button',{name:'领取并固定本次检查要求',exact:true}).click()
    await expect(page.locator('[data-qc-workbench-task]')).toContainText(productionNo)
    expect((await page.evaluate(()=>(window as any).__inventoryQcCuttingReads)).length).toBeGreaterThan(0)
    // An inventory source link retains its exact batch; an active production
    // task is a visible blocker and must never silently replace that batch.
    await page.goto(`/fcs/craft/post-finishing/qc-workbench?taskNo=${encodeURIComponent(qc.qcTaskNo)}`)
    await expect(page.locator('[data-qc-workbench-task]')).toHaveCount(0)
    await expect(page.getByRole('link',{name:'继续当前质检单'})).toBeVisible()
    await expect(page.locator('[data-post-finishing-field="qc-task-input"]')).toHaveValue(qc.qcTaskNo)
  }
  await page.goto(applicationUrl)
  await expect(page.getByRole('heading',{name:'库存送检流转详情',exact:true})).toBeVisible()
  await expect(page.locator('[data-fiq-form="ship"]')).toHaveCount(escalate?3:2)
  await expect(page.getByText('已完成',{exact:true})).toHaveCount(0)
  const shippingIds=await page.locator('[data-fiq-form="ship"]').evaluateAll(nodes=>nodes.map(node=>(node as HTMLElement).dataset.transferId!))
  for(const id of shippingIds){
    const form=page.locator(`[data-fiq-form="ship"][data-transfer-id="${id}"]`)
    await expect(form.locator('input[name="operator"]')).toHaveCount(0)
    await form.getByRole('button',{name:/确认整批交出/}).click();await expect(form).toHaveCount(0)
  }
  for(const form of await page.locator('[data-fiq-form="difference"]').all()){
    await expect(form.locator('input[name="operator"]')).toHaveCount(0)
    await form.locator('input[name="reason"]').fill(`实物点数${received}，保留原出80事实`)
    await form.locator('input[name="disposition"]').fill('真实差异独立登记，不改QC和出库')
    await form.getByRole('button',{name:'确认差异处理'}).click();await expect(form).toHaveCount(0)
  }
  await page.goto('/wls/finished/pre-inbound')
  const transfers=(await snapshot(page)).filter(row=>row.collection==='higood-finished-inventory/transfers'&&row.value.category!=='送后道').map(row=>row.value)
  expect(transfers).toHaveLength(escalate?3:2)
  for(const transfer of transfers){
    await page.goto(transfer.category === '返工交接' ? `/fcs/production/inventory-rework-receipts?id=${encodeURIComponent(transfer.applicationId)}` : '/wls/finished/pre-inbound');
    const form=page.locator(`[data-fiq-form="receive-transfer"][data-transfer-id="${transfer.id}"]`)
    for(const line of transfer.lines)await form.locator(`input[name="quantity"][data-sku-id="${line.skuId}"]`).fill(String(line.quantity))
    await expect(form.locator('input[name="operator"]')).toHaveCount(0)
    await form.getByRole('button',{name:/整批实收/}).click()
    await expect(form).toHaveCount(0)
  }
  await page.goto(applicationUrl);await expect(page.getByText('已完成',{exact:true})).toHaveCount(0)
  await page.goto('/wls/finished/putaway')
  await expect(page.locator('[data-fiq-form="putaway"]')).toHaveCount(2)
  const putawayIds=await page.locator('[data-fiq-form="putaway"]').evaluateAll(nodes=>nodes.map(node=>(node as HTMLElement).dataset.transferId!))
  expect(putawayIds).toHaveLength(2)
  for(const id of putawayIds){
    const form=page.locator(`[data-fiq-form="putaway"][data-transfer-id="${id}"]`)
    for(const select of await form.locator('select[name="location"]').all())await select.selectOption({index:1})
    await expect(form.locator('input[name="operator"]')).toHaveCount(0)
    await form.getByRole('button',{name:'确认本类实收全部上架'}).click();await expect(form).toHaveCount(0)
  }
  await page.goto(applicationUrl);await expect(page.getByText('已完成',{exact:true}).first()).toBeVisible()
  await page.reload();await expect(page.getByText('已完成',{exact:true}).first()).toBeVisible()
  await page.screenshot({path:testInfo.outputPath(`inventory-${received}-qc-wls-complete.png`),fullPage:true})
  await testInfo.attach(`inventory-${received}-qc-ui-facts`,{body:JSON.stringify({qc,persisted},null,2),contentType:'application/json'})
  if(received===79){
    // Navigate through the real shell in the same document. An inventory-only
    // entry must not mark the unrelated production context as initialized.
    await page.evaluate(()=>{const link=document.createElement('a');link.textContent='验收后转生产后道';link.href='/fcs/craft/post-finishing/qc-orders';link.dataset.nav='/fcs/craft/post-finishing/qc-orders';document.getElementById('app')!.append(link)})
    await page.getByRole('link',{name:'验收后转生产后道',exact:true}).click()
    await expect(page.getByRole('heading',{name:'质检清单',exact:true})).toBeVisible()
    expect((await page.evaluate(()=>(window as any).__inventoryQcCuttingReads)).length).toBeGreaterThan(0)
  }
})


test('条件检查项可按本批实际颜色尺码选择依据澄清，不适用SKU不增加该项',async({page},testInfo)=>{
  const qcNo=await configuredSampling(page)
  await page.evaluate(async()=>{
    const path='/src/data/fcs/quality-management-records.ts',q=await import(path)
    const draft=q.buildQualityConfigurationDraft('BASIC','garment-basic-v1')
    draft.items.push({id:'conditional-l-new-item',dimension:'缝制工艺',name:'仅L码袖口要求',content:'仅L码检查袖口',criterion:'本项目的正式要求',references:[],applicability:{sourceKinds:['PRODUCTION_RETURN'],stages:['POST_FINISHING_QC'],attributes:[{key:'size',value:'L'}]}})
    await q.saveQualityConfigurationDraft(draft);await q.publishQualityConfiguration(draft.id)
  })
  await openConfiguredQc(page,qcNo)
  const l=page.locator('[data-qc-result-line="SPU-QC-001-L"]'),m=page.locator('[data-qc-result-line="SPU-QC-001-M"]')
  await expect(l.locator('[data-qc-observation="conditional-l-new-item"], [data-qc-issue="conditional-l-new-item"]')).toHaveCount(1)
  await expect(m.locator('[data-qc-observation="conditional-l-new-item"], [data-qc-issue="conditional-l-new-item"]')).toHaveCount(0)
  const basis=page.locator('[data-qc-basis-item]')
  await basis.locator('..').locator('summary').click()
  await expect(basis.locator('option[value="conditional-l-new-item"]')).toHaveCount(1)
  await expect(basis.locator('option[value="conditional-l-new-item"]')).toContainText('雾蓝 / L')
  await basis.selectOption('conditional-l-new-item')
  await page.locator('[data-qc-basis-conflict]').fill('L码袖口资料存在两个口径')
  await page.locator('[data-qc-basis-adopted]').fill('采用本L码项目正式确认资料')
  await page.locator('[data-qc-basis-note]').fill('本次仅对雾蓝L码澄清，不更改其他尺码')
  await page.getByRole('button',{name:'保存本项目澄清记录',exact:true}).click()
  await expect(page.getByText('依据澄清记录已保存。',{exact:true})).toBeVisible()
  const actual=await page.evaluate(async()=>{const p='/src/data/pcs-record-db.ts',db=await import(p);const value=await db.readPcsRecords(['higood-fcs-post-finishing-records']);return value.records.find((row:any)=>row.collection==='flow/qcTasks'&&row.value.inspection?.basisClarifications?.some((entry:any)=>entry.itemId==='conditional-l-new-item'))?.value})
  expect(actual.inspection.basisClarifications).toHaveLength(1)
  expect(actual.inspection.basisClarifications[0]).toMatchObject({itemId:'conditional-l-new-item',adoptedBasis:'采用本L码项目正式确认资料'})
  await page.reload();await expect(page.locator('[data-qc-workbench-task]')).toContainText('本次仅对雾蓝L码澄清')
  await testInfo.attach('conditional-l-basis-clarification-native',{body:JSON.stringify(actual),contentType:'application/json'})
})

for(const mode of ['full','sample'] as const) test(`库存80件精确案例：${mode==='full'?'78合格2瑕疵全检':'抽24得23合格1瑕疵'}经原QC及分类上架守恒`,async({page},testInfo)=>{
  test.setTimeout(120000)
  await page.addInitScript(()=>{(window as any).__name=(value:unknown)=>value;localStorage.setItem('higood-fcs-post-finishing-current-actor-v1','PF-USER-QC-MGR')})
  if(mode==='full'){
    await page.route('**/__inventory-exact-rule',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><body>'}))
    await page.goto('/__inventory-exact-rule')
    await page.evaluate(async()=>{const path='/src/data/fcs/quality-management-records.ts',q=await import(path);await q.prepareQualityConfigurationSchema();await q.ensureQualityManagementRecords();const rule=q.buildQualityConfigurationDraft('RULE','warehouse-stock-rule-v1');rule.defaultPercent=100;await q.saveQualityConfigurationDraft(rule);await q.publishQualityConfiguration(rule.id)})
  }
  await page.setViewportSize({width:1024,height:768});await page.goto('/wls/finished/stock/realtime')
  await page.locator('tr').filter({hasText:'SKU-GC-20001'}).first().getByRole('link',{name:'本仓本款全部送检'}).click()
  await expect(page.locator('[data-fiq-form="apply"] input[name="operator"]')).toHaveCount(0)
  await page.getByRole('button',{name:'确认下架出库 80 件'}).click()
  await expect(page.getByRole('heading',{name:'库存送检流转详情'})).toBeVisible()
  const application=(await snapshot(page)).find(row=>row.collection==='higood-finished-inventory/applications')!.value,applicationUrl=page.url().replace('/wls/finished/inventory-quality','/fcs/craft/post-finishing/inventory-quality')
  await openFinishingInventoryApplication(page)
  const receive=page.locator('[data-fiq-form="receive"]')
  for(const line of application.lines)await receive.locator(`input[name="quantity"][data-sku-id="${line.skuId}"]`).fill(String(line.outboundQty))
  await expect(receive.locator('input[name="operator"]')).toHaveCount(0);await receive.getByRole('button',{name:'确认整批实收并形成库存QC'}).click()
  await page.getByRole('link',{name:'进入后道原质检工作台'}).click();await page.getByRole('button',{name:'领取并固定本次检查要求',exact:true}).click()
  await expect(page.locator('[data-qc-workbench-task]')).toContainText(`尚需检查 ${mode==='full'?80:24}`)
  const inputs=page.locator('[data-qc-result-line]'),remaining=await inputs.evaluateAll(nodes=>nodes.map(node=>Number((node as HTMLElement).dataset.remaining)))
  await allocate(page,mode==='full'?remaining.map((n,i)=>[n-(i===0?2:0),i===0?2:0,0]):[[23,1,0],[0,0,0]])
  await page.getByRole('button',{name:'提交第1轮检查',exact:true}).click()
  await expect(page.getByRole('heading',{name:'处理本轮稽查'})).toHaveCount(0)
  await expect(page.getByRole('heading',{name:'完成本批QC并按去向办理',exact:true})).toBeVisible()
  await acceptClick(page,'确认完成QC并生成对应去向');await expect(page.locator('[data-qc-workbench-task]')).toHaveCount(0)
  let rows=await snapshot(page);const qc=rows.find(row=>row.collection==='flow/qcTasks'&&row.value.inventoryApplicationId===application.id)!.value
  const sum=(key:string)=>qc.results.reduce((n:number,row:any)=>n+(row[key]||0),0)
  expect([sum('passedQty'),sum('defectQty'),sum('uninspectedQty'),sum('releasedQty')]).toEqual(mode==='full'?[78,2,0,78]:[23,1,56,79])
  expect(qc.inspection.papers).toHaveLength(0);expect(qc.inspection.audits).toHaveLength(0)
  const transfers=rows.filter(row=>row.collection==='higood-finished-inventory/transfers'&&row.value.applicationId===application.id&&row.value.category!=='送后道').map(row=>row.value)
  expect(transfers).toHaveLength(2);expect(transfers.map(row=>row.category).sort()).toEqual(['正常返仓','瑕疵入仓'].sort())
  await page.goto(applicationUrl)
  for(const transfer of transfers){const form=page.locator(`[data-fiq-form="ship"][data-transfer-id="${transfer.id}"]`);await expect(form.locator('input[name="operator"]')).toHaveCount(0);await form.getByRole('button',{name:/确认整批交出/}).click();await expect(form).toHaveCount(0)}
  await page.goto('/wls/finished/pre-inbound')
  for(const transfer of transfers){await page.goto(transfer.category === '返工交接' ? `/fcs/production/inventory-rework-receipts?id=${encodeURIComponent(transfer.applicationId)}` : '/wls/finished/pre-inbound');const form=page.locator(`[data-fiq-form="receive-transfer"][data-transfer-id="${transfer.id}"]`);for(const line of transfer.lines)await form.locator(`input[name="quantity"][data-sku-id="${line.skuId}"]`).fill(String(line.quantity));await expect(form.locator('input[name="operator"]')).toHaveCount(0);await form.getByRole('button',{name:/整批实收/}).click();await expect(form).toHaveCount(0)}
  await page.goto('/wls/finished/putaway')
  for(const transfer of transfers){const form=page.locator(`[data-fiq-form="putaway"][data-transfer-id="${transfer.id}"]`);await expect(form).toBeVisible();for(const select of await form.locator('select[name="location"]').all())await select.selectOption({index:1});await expect(form.locator('input[name="operator"]')).toHaveCount(0);await form.getByRole('button',{name:'确认本类实收全部上架'}).click();await expect(form).toHaveCount(0)}
  await page.goto(applicationUrl);await expect(page.getByText('已完成',{exact:true}).first()).toBeVisible();await page.reload();await expect(page.getByText('已完成',{exact:true}).first()).toBeVisible()
  rows=await snapshot(page);const lots=rows.filter(row=>row.collection==='higood-finished-inventory/lots').map(row=>row.value),defectTransfer=transfers.find(row=>row.category==='瑕疵入仓')!
  const normal=lots.filter(row=>row.warehouseId===application.warehouseId&&row.styleId===application.styleId&&row.quality==='正常').reduce((n,row)=>n+row.quantity,0)
  const defects=lots.filter(row=>row.warehouseId===defectTransfer.targetId&&row.styleId===application.styleId&&row.quality==='瑕疵').reduce((n,row)=>n+row.quantity,0)
  expect([normal,defects,normal+defects]).toEqual(mode==='full'?[98,2,100]:[99,1,100]);expect(defectTransfer.targetId).not.toBe(application.warehouseId)
  await testInfo.attach(`inventory-exact-${mode}-persistent-facts`,{body:JSON.stringify({mode,application,qc,transfers,normal,defects,rows},null,2),contentType:'application/json'})
  await testInfo.attach(`inventory-exact-${mode}-completed`,{body:await page.screenshot({fullPage:true}),contentType:'image/png'})
})

test('四条全检条件在原规则编辑页开关及范围维护，保存生效和刷新读回；库存不采用生产四条件',async({page},testInfo)=>{
 test.setTimeout(90000)
 await page.goto('/fcs/quality-management/inspection-rules/production-return-rule-v1')
 const evidence=[]
 for(const enabled of [false,true]){
  await page.getByRole('button',{name:'派生新草稿',exact:true}).click();await expect(page.locator('[data-qm-editor]')).toBeVisible()
  const id=new URL(page.url()).pathname.split('/').at(-2)!
  for(const key of ['basicStyle','highDifficulty','outsideFabricWhitelist','firstFactoryTasks'])await page.locator(`[data-qm-boolean="initialFullInspection.${key}"]`).setChecked(enabled)
  await page.locator('[data-qm-edit="initialFullInspection.firstTaskCount"]').fill('5')
  await page.locator('[data-qm-list="initialFullInspection.fabricSpuWhitelist"]').fill('CNIDML002,CNIDML018')
  await page.getByRole('button',{name:'保存草稿',exact:true}).click();await expect(page.locator('[data-qm-feedback]')).toContainText('草稿已保存')
  await page.getByRole('button',{name:'明确生效',exact:true}).click();await page.getByRole('button',{name:'确认生效',exact:true}).click()
  await expect(page.locator('[data-qm-editor]')).toHaveCount(0);await page.reload()
  const actual=await page.evaluate(async(id)=>{const path='/src/data/pcs-record-db.ts',db=await import(path),r=await db.readPcsRecords(['higood-fcs-quality-management']);return r.records.find((row:any)=>row.value?.id===id)?.value},id)
  expect(actual.status).toBe('EFFECTIVE');expect(actual.applicability.sourceKinds).toEqual(['PRODUCTION_RETURN']);expect(actual.applicability.stages).toEqual(['POST_FINISHING_QC'])
  expect(actual.initialFullInspection).toEqual({basicStyle:enabled,highDifficulty:enabled,outsideFabricWhitelist:enabled,firstFactoryTasks:enabled,firstTaskCount:5,fabricSpuWhitelist:['CNIDML002','CNIDML018']})
  evidence.push(actual)
 }
 await page.goto('/fcs/quality-management/inspection-rules/warehouse-stock-rule-v1');await page.getByRole('button',{name:'派生新草稿',exact:true}).click()
 await expect(page.getByText('库存规则不采用后道生产四条初始全检条件。',{exact:true})).toBeVisible();await expect(page.locator('[data-qm-boolean^="initialFullInspection."]')).toHaveCount(0)
 await testInfo.attach('full-rule-maintenance-effective-native-readback',{body:JSON.stringify(evidence,null,2),contentType:'application/json'})
})

test('审查补缺：有效配置详情显示四条件及附加覆盖的新要求和适用范围',async({page},info)=>{
 page.setDefaultTimeout(15000)
 await page.goto('/fcs/quality-management/basic-standards')
 const ids=await page.evaluate(async()=>{
  const q=await import('/src/data/fcs/quality-management-records.ts');await q.ensureQualityManagementRecords()
  const basic=q.buildQualityConfigurationDraft('BASIC','garment-basic-v1');basic.name='审查成衣基本标准'
  if(basic.kind!=='BASIC')throw Error('fixture kind')
  basic.items[0].unit='cm';basic.items[0].applicability={sourceKinds:['PRODUCTION_RETURN'],attributes:[{key:'size',value:'M'}]}
  await q.saveQualityConfigurationDraft(basic);await q.publishQualityConfiguration(basic.id)
  const additional=q.buildQualityConfigurationDraft('ADDITIONAL');additional.name='审查指定款M码要求'
  if(additional.kind!=='ADDITIONAL')throw Error('fixture kind')
  additional.applicability.styleIds=['SPU-QC-001'];additional.overrides=[{targetItemId:'garment-size-chest',fields:['criterion','unit'],values:{criterion:'审查胸围按正式批准尺寸表',unit:'cm'},applicability:{attributes:[{key:'size',value:'M'}]}}]
  await q.saveQualityConfigurationDraft(additional);await q.publishQualityConfiguration(additional.id)
  const rule=q.buildQualityConfigurationDraft('RULE','production-return-rule-v1')
  if(rule.kind!=='RULE'||!rule.initialFullInspection)throw Error('fixture rule')
  rule.initialFullInspection.basicStyle=false;rule.initialFullInspection.firstTaskCount=7;rule.initialFullInspection.fabricSpuWhitelist=['CNIDML002','CNIDML018']
  await q.saveQualityConfigurationDraft(rule);await q.publishQualityConfiguration(rule.id)
  return{basic:basic.id,additional:additional.id,rule:rule.id}
 })
 await page.goto('/fcs/quality-management/inspection-rules/'+encodeURIComponent(ids.rule))
 await expect(page.locator('main')).toContainText('基础款及冷启动基础款')
 await expect(page.locator('main')).toContainText('未启用')
 await expect(page.locator('main')).toContainText('真正执行的前7个车缝任务')
 await expect(page.locator('main')).toContainText('CNIDML002、CNIDML018')
 await page.goto('/fcs/quality-management/additional-standards/'+encodeURIComponent(ids.additional))
 await expect(page.locator('main')).toContainText('审查胸围按正式批准尺寸表')
 await expect(page.locator('main')).toContainText('尺码：M')
 await expect(page.locator('main')).toContainText('cm')
 await page.goto('/fcs/quality-management/basic-standards/'+encodeURIComponent(ids.basic))
 await expect(page.locator('main')).toContainText('单位：cm')
 await expect(page.locator('main')).toContainText('尺码：M')
 await info.attach('effective-detail-full-fields',{body:await page.screenshot({fullPage:true}),contentType:'image/png'})
})

test('审查补缺：规则切换适用业务后恢复原有全检参数且空生产规则可配置',async({page},info)=>{
 page.setDefaultTimeout(15000)
 await page.goto('/fcs/quality-management/inspection-rules/production-return-rule-v1')
 await page.getByRole('button',{name:'派生新草稿',exact:true}).click()
 const count=page.locator('[data-qm-edit="initialFullInspection.firstTaskCount"]')
 await count.fill('7')
 const stock=page.locator('input[data-qm-array="applicability.sourceKinds"][value="WAREHOUSE_STOCK"]')
 await stock.check();await expect(count).toHaveCount(0)
 await stock.uncheck();await expect(count).toHaveValue('7')
 const warehouseId=await page.evaluate(async()=>{
  const q=await import('/src/data/fcs/quality-management-records.ts');const rule=q.buildQualityConfigurationDraft('RULE','warehouse-stock-rule-v1');await q.saveQualityConfigurationDraft(rule);return rule.id
 })
 page.once('dialog',dialog=>dialog.accept())
 await page.goto('/fcs/quality-management/inspection-rules/'+encodeURIComponent(warehouseId)+'/edit')
 await page.locator('input[data-qm-array="applicability.sourceKinds"][value="WAREHOUSE_STOCK"]').uncheck()
 await page.locator('input[data-qm-array="applicability.sourceKinds"][value="PRODUCTION_RETURN"]').check()
 await page.getByRole('button',{name:'配置生产回货初始全检条件',exact:true}).click()
 await expect(count).toHaveValue('3')
 await info.attach('restored-original-full-inspection-configuration',{body:await page.screenshot({fullPage:true}),contentType:'image/png'})
})

test('审查补缺：配置草稿保存期间锁定输入，成功和中止后均可继续编辑',async({page},info)=>{
 page.setDefaultTimeout(15000)
 await page.goto('/fcs/quality-management/basic-standards')
 await page.getByRole('button',{name:'新增草稿',exact:true}).click()
 const name=page.locator('[data-qm-edit="name"]');await expect(name).toBeVisible();await name.fill('审查保存输入保护')
 await page.evaluate(()=>{
  const result:{disabled:boolean;inputDisabled:boolean}[]=[];(window as any).__qualitySaveLocks=result
  const observer=new MutationObserver(records=>{for(const r of records)if(r.type==='attributes'&&r.attributeName==='disabled'){const fieldset=r.target as HTMLFieldSetElement;result.push({disabled:fieldset.disabled,inputDisabled:!!fieldset.querySelector('input:disabled')})}})
  observer.observe(document.querySelector('[data-quality-management-page]')!,{subtree:true,attributes:true,attributeFilter:['disabled']})
 })
 await page.getByRole('button',{name:'保存草稿',exact:true}).click()
 await expect(page.locator('[data-qm-feedback]')).toContainText('草稿已保存')
 const locks=await page.evaluate(()=>(window as any).__qualitySaveLocks)
 expect(locks.some((r:any)=>r.disabled&&r.inputDisabled)).toBe(true)
 await expect(name).toBeEnabled()
 await name.fill('审查中止后输入保留')
 await page.evaluate(()=>{
  const put=IDBObjectStore.prototype.put;let once=true
  IDBObjectStore.prototype.put=function(...args:Parameters<typeof put>){const req=put.apply(this,args);if(once&&this.transaction.db.name==='higood-pcs-records'&&this.transaction.mode==='readwrite'){once=false;this.transaction.abort();IDBObjectStore.prototype.put=put}return req}
 })
 await page.getByRole('button',{name:'保存草稿',exact:true}).click()
 await expect(page.locator('[data-qm-feedback]')).toContainText('未保存')
 await expect(name).toHaveValue('审查中止后输入保留');await expect(name).toBeEnabled()
 await page.getByRole('button',{name:'保存草稿',exact:true}).click()
 await expect(page.locator('[data-qm-feedback]')).toContainText('草稿已保存')
 await page.reload();await expect(name).toHaveValue('审查中止后输入保留')
 await info.attach('actual-native-save-editor-locks',{body:JSON.stringify(locks),contentType:'application/json'})
})

test('即时成衣库存按SKU定位时统计与明细同范围，重置恢复全量',async({page},info)=>{
 await page.setViewportSize({width:1366,height:768})
 await page.goto('/wls/finished/stock/realtime')
 const root=page.locator('[data-wls-stock-realtime-workspace]'),table=root.locator('table').first()
 await expect(table.locator('tbody tr').first()).toBeVisible()
 const initialText=await root.innerText(),initialTotal=Number(initialText.match(/商品总数\s*(\d+)\s*条/)?.[1])
 expect(initialTotal).toBeGreaterThan(1)
 const headers=await table.locator('thead th').allTextContents(),skuColumn=headers.findIndex(text=>text.trim()==='商品SKU')
 expect(skuColumn).toBeGreaterThanOrEqual(0)
 const sku=(await table.locator('tbody tr').first().locator('td').nth(skuColumn).innerText()).trim()
 expect(sku).not.toBe('')
 await page.goto('/wls/finished/stock/realtime?sku='+encodeURIComponent(sku))
 await expect(root.locator('table tbody tr').first()).toBeVisible()
 const filteredRows=await root.locator('table tbody tr').count(),filteredText=await root.innerText()
 expect(filteredRows).toBeLessThan(initialTotal)
 expect(filteredText).toMatch(new RegExp('商品总数\\s*'+filteredRows+'\\s*条'))
 for(const row of await root.locator('table tbody tr').all())expect((await row.locator('td').nth(skuColumn).innerText()).trim()).toBe(sku)
 await root.locator('[data-wls-stock-realtime-action="reset-filter"]').click()
 await expect(root).toContainText(new RegExp('商品总数\\s*'+initialTotal+'\\s*条'))
 await info.attach('同筛选范围与重置实际结果',{body:JSON.stringify({sku,initialTotal,filteredRows,filteredText,resetText:await root.innerText()}),contentType:'application/json'})
 await page.screenshot({path:info.outputPath('realtime-filter-statistics.png'),fullPage:true})
})

test('main合并兼容：QC紧急参考刷新打印保留真实来源，并继续阻断坏图且可原按钮重试',async({page})=>{
 await page.goto('/fcs/craft/post-finishing/qc-orders')
 await expect(page.locator('main h1')).toHaveText('质检清单')
 await expect(page.locator('[data-post-finishing-priority-rules-action="open"]')).toBeVisible()
 const qc=await page.evaluate(async()=>{
  const f=await import('/src/data/fcs/post-finishing-full-flow.ts')
  const row=f.listPostFinishingFullFlowQcTasks().find(row=>row.status==='待质检'&&row.sourceKind!=='WAREHOUSE_STOCK'&&row.lines.length)
  if(!row)throw Error('必须使用原待质检生产来源')
  return{id:row.qcTaskId,no:row.qcTaskNo}
 })
 await page.goto('/fcs/craft/post-finishing/print?type=QC_ORDER&id='+encodeURIComponent(qc.no))
 const root=page.locator('[data-post-print-ready-root]'),button=root.locator('[data-qc-shipping-print]')
 await expect(button).toBeVisible()
 await expect(root.locator('[data-qc-shipping-priority-slot]')).toHaveAttribute('data-qc-shipping-source-id',qc.id)
 const image=root.locator('img').first(),original=await image.getAttribute('src')
 expect(original).toBeTruthy()
 const failed=new URL(original!,page.url());failed.searchParams.set('release-image-failure','1')
 await page.route(failed.href,route=>route.abort())
 await page.evaluate(()=>{(window as any).__releasePrints=0;window.print=()=>{(window as any).__releasePrints++}})
 await image.evaluate((node,url)=>{(node as HTMLImageElement).src=url},failed.href)
 await button.click()
 await expect(root.locator('[data-print-ready-feedback]')).toContainText('尚未加载')
 expect(await page.evaluate(()=>(window as any).__releasePrints)).toBe(0)
 await expect(button).toBeEnabled()
 await image.evaluate((node,url)=>{(node as HTMLImageElement).src=url},original!)
 await button.click()
 await expect.poll(()=>page.evaluate(()=>(window as any).__releasePrints)).toBe(1)
 await expect(root.locator('[data-print-ready-feedback]')).toHaveText('图片和条码已就绪。')
 await page.screenshot({path:'output/qc-main-publication-20261023/priority-print-merged.png',fullPage:true})
})

test.beforeEach(async ({page,baseURL})=>{await useEmptyInventoryQualityFixture(page,baseURL)})

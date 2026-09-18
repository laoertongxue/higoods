import { expect, test, type Page } from '@playwright/test'
// Functional UI regression. Full cold/refresh/action performance is measured separately.
const root='[data-wool-work-orders-root]', storeKey='higood-fcs-wool-stage-store-v3'
const action=(name:string,id?:string)=>`[data-wool-work-orders-action="${name}"]${id?`[data-wool-order-id="${id}"]`:''}`
async function open(page:Page,stage='knitting'){await page.goto(`/fcs/craft/wool/${stage}-orders`);await expect(page.locator(root)).toBeVisible()}
async function facts(page:Page){return page.evaluate(async()=>{const modulePath='/src/data/fcs/wool-domain/store.ts';const {readWoolStore}=await import(/* @vite-ignore */ modulePath);return readWoolStore()})}
async function report(page:Page,id:string,qty:number){await page.locator(action('open-report',id)).click();await page.locator('[data-wool-dialog-field="qty"]').fill(String(qty));await page.locator(action('save-report')).click()}
async function receive(page:Page,id:string,qty:number,piece=false){await page.goto(`/fcs/craft/wool/pending-receipts?workOrderId=${encodeURIComponent(id)}`);await page.locator('[data-wool-receiving-action="receive"]').first().click();if(piece)await page.locator('[data-wool-receiving-field="pieceQty"]').fill(String(qty));else {await page.locator('[data-wool-receiving-field="pcs"]').fill('1');await page.locator('[data-wool-receiving-field="grossKg"]').fill(String(qty+.062));await page.locator('[data-wool-receiving-field="PAPER"]').fill('1')}await page.locator('[data-wool-receiving-action="review"]').click();await page.locator('[data-wool-receiving-action="save"]').click();await expect(page.locator('[data-wool-receiving-feedback]')).toContainText('已保存')}

test('两阶段保留六状态、八列、分页与路由独立筛选',async({page})=>{for(const stage of ['knitting','linking']){await open(page,stage);await expect(page.locator('[data-wool-work-orders-action^="tab:"]')).toHaveCount(6);for(const title of ['加工投入','加工要求','加工产出','时间','数量'])await expect(page.locator('th').filter({hasText:title}).first()).toBeVisible();await page.locator('[data-wool-work-orders-field="keyword"]').fill('不存在的单据');await page.locator(action('query')).click();await expect(page.locator('[data-wool-work-orders-table-surface]')).toContainText('暂无');await page.locator(action('reset-filters')).click();await expect(page.locator('[data-wool-work-orders-total]')).toContainText('14')}})

test('缺纱线不能填报，统一实收1kg后对应横机可开工',async({page})=>{await open(page);await expect(page.locator(action('open-report','WOOL-STAGE-001:KNITTING'))).toHaveCount(0);await receive(page,'WOOL-STAGE-001:KNITTING',1);await open(page);await expect(page.locator(action('open-report','WOOL-STAGE-001:KNITTING'))).toBeVisible()})

test('无外加工填报一次保存四事实，缝盘没有重复手工填报或横机设备',async({page})=>{await open(page);await report(page,'WOOL-STAGE-002:KNITTING',5);await expect(page.locator('[data-wool-business-dialog]')).toHaveCount(0);const s=await facts(page);expect(s.processReports.filter((r:any)=>r.woolOrderId==='WOOL-STAGE-002:LINKING').reduce((n:number,r:any)=>n+r.reportedQty,0)).toBe(5);expect(s.internalReceipts.find((r:any)=>r.woolOrderId==='WOOL-STAGE-002:LINKING').qty).toBe(5);expect(s.handovers.some((r:any)=>r.woolOrderId==='WOOL-STAGE-002:KNITTING'&&r.automatic&&r.handoverQty===5)).toBe(true);await open(page,'linking');await expect(page.locator(action('open-report','WOOL-STAGE-002:LINKING'))).toHaveCount(0);await expect(page.locator(root)).not.toContainText('关联横机设备')})

test('横机150%超量保存被阻断且无任何事实增量',async({page})=>{await open(page);const before=await facts(page);await report(page,'WOOL-STAGE-002:KNITTING',151);await expect(page.locator('[data-wool-overlay-error]')).toContainText(/超过|上限|最多/);expect(await facts(page)).toEqual(before)})

test('混合片Q1回80与Q2回100时最多缝盘80，不能二次放大',async({page})=>{await open(page,'linking');await report(page,'WOOL-STAGE-010:LINKING',81);await expect(page.locator('[data-wool-overlay-error]')).toContainText(/超过|上限|可用|最多/);await page.locator('[data-wool-dialog-field="qty"]').fill('50');await page.locator(action('save-report')).click();await expect(page.locator('[data-wool-business-dialog]')).toHaveCount(0);const s=await facts(page);expect(s.processReports.filter((r:any)=>r.woolOrderId==='WOOL-STAGE-010:LINKING').reduce((n:number,r:any)=>n+r.reportedQty,0)).toBe(50)})

test('横机仅交出选中外发片，固定首工艺厂并生成待接收来源',async({page})=>{await open(page);await page.locator(action('open-handover','WOOL-STAGE-008:KNITTING')).click();await expect(page.locator('[data-wool-business-dialog]')).toContainText('首工艺');await page.locator('[data-wool-dialog-field="qty"]').fill('5');await page.locator(action('save-handover')).click();await expect(page.locator('[data-wool-business-dialog]')).toHaveCount(0);const h=(await facts(page)).handovers.filter((r:any)=>r.woolOrderId==='WOOL-STAGE-008:KNITTING'&&!r.automatic);expect(h).toHaveLength(1);expect(h[0]).toMatchObject({handoverQty:5,qtyUnit:'片',receiverId:'FAC-APF'});expect(h[0].downstreamReceipt.status).toBe('PENDING')})

test('最终工艺回货按片实收，刷新后仍保留同一记录',async({page})=>{await receive(page,'WOOL-STAGE-010:LINKING',5,true);const before=(await facts(page)).pieceReceipts.filter((r:any)=>r.woolOrderId==='WOOL-STAGE-010:LINKING');await page.reload();await expect(page.locator('[data-wool-receiving-page]')).toBeVisible();expect((await facts(page)).pieceReceipts.filter((r:any)=>r.woolOrderId==='WOOL-STAGE-010:LINKING')).toEqual(before);expect(before.some((r:any)=>r.qty===5)).toBe(true)})

test('实收备料分配到横机，同一receipt保留且余量变化',async({page})=>{await page.goto('/fcs/craft/wool/pending-receipts?view=stock');await page.locator('[data-wool-stock-action="allocate"]').first().click();await page.locator('[data-wool-stock-field="target"]').selectOption('WOOL-STAGE-001:KNITTING');await page.locator('[data-wool-stock-field="qty"]').fill('2');await page.locator('[data-wool-stock-action="review"]').click();await page.locator('[data-wool-stock-action="save"]').click();await expect(page.locator('[data-wool-stock-feedback]')).toContainText(/已|成功/);await expect(page.locator('[data-wool-stock-table]')).toContainText('8 kg');await open(page);await expect(page.locator(action('open-report','WOOL-STAGE-001:KNITTING'))).toBeVisible()})

test('阶段错配详情和打印地址被拒绝',async({page})=>{for(const tail of ['', '/handover-print']){await page.goto('/fcs/craft/wool/linking-orders/WOOL-STAGE-008%3AKNITTING'+tail);await expect(page.getByText(/阶段|不存在|未找到/).first()).toBeVisible();await expect(page.locator('[data-wool-detail-root],[data-wool-handover-print-root]')).toHaveCount(0)}})

test('真实片交出打印必须等款式图及QR就绪；内部自动交出不打印',async({page})=>{await page.goto('/fcs/craft/wool/knitting-orders/WOOL-STAGE-009%3AKNITTING/handover-print');await expect(page.locator('[data-wool-handover-print-page]')).toHaveCount(2);await expect(page.locator('[data-wool-print-button]')).toBeEnabled();expect(await page.locator('[data-real-qr] svg').count()).toBe(2);await page.goto('/fcs/craft/wool/knitting-orders/WOOL-STAGE-004%3AKNITTING/handover-print');await expect(page.locator('[data-wool-handover-print-root]')).toContainText('内部自动衔接不生成外发纸单');await expect(page.locator('[data-wool-print-button]')).toBeDisabled()})

test('1280视口列表无主体横溢，操作与数量输入保持根节点',async({page})=>{await page.setViewportSize({width:1280,height:720});await open(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const initial=await page.locator(root).elementHandle();await page.locator(action('open-report','WOOL-STAGE-002:KNITTING')).click();await page.locator('[data-wool-dialog-field="qty"]').fill('2');expect(await initial!.evaluate(node=>node.isConnected)).toBe(true);await page.locator(action('close-overlay')).first().click();expect(await initial!.evaluate(node=>node.isConnected)).toBe(true)})

test('片工艺真实页面加工交出后下一厂才有待接收，实收前不虚增',async({page})=>{
 await open(page)
 const steps=await page.evaluate(async()=>{const cm='/src/data/fcs/wool-domain/craft-flow.ts',sm='/src/data/fcs/special-craft-operations.ts';const c=await import(/* @vite-ignore */cm),s=await import(/* @vite-ignore */sm);const tasks=c.listWoolCraftTaskOrders().filter((t:any)=>t.woolOrderId==='WOOL-STAGE-009:KNITTING');const first=tasks.find((t:any)=>t.receivedQty>0&&t.completedQty===0);const next=tasks.find((t:any)=>t.woolPieceKey===first.woolPieceKey&&t.taskOrderId!==first.taskOrderId);return [first,next].map((t:any)=>({id:t.taskOrderId,path:s.buildSpecialCraftTaskDetailPath(t,t.taskOrderId)}))})
 await page.goto(steps[0].path);await expect(page.locator('[data-wool-craft-detail]')).toBeVisible()
 for(const code of ['SPECIAL_CRAFT_PROCESS_REPORT','SPECIAL_CRAFT_SUBMIT_HANDOVER']){await page.locator(`[data-action-code="${code}"]`).click();await page.getByRole('spinbutton',{name:'本次数量（片）'}).fill('5');await page.locator('[data-wool-craft-save]').click();await expect(page.locator('#wool-craft-dialog')).toHaveCount(0)}
 await page.goto(steps[1].path);await expect(page.locator('[data-wool-craft-detail]')).toContainText('实际接收0 片')
 await page.locator('[data-action-code="SPECIAL_CRAFT_CONFIRM_RECEIVE"]').click();await page.locator('[data-wool-receiving-action="receive"]').first().click();await page.locator('[data-wool-receiving-field="pieceQty"]').fill('5');await page.locator('[data-wool-receiving-action="review"]').click();await page.locator('[data-wool-receiving-action="save"]').click();await expect(page.locator('[data-wool-receiving-feedback]')).toContainText('已保存')
 await page.goto(steps[1].path);await expect(page.locator('[data-wool-craft-detail]')).toContainText('实际接收5 片')
})

test('整件缝盘最终交出按真实批次在后续成衣工艺接收，未选批次仍待接收',async({page})=>{
 await open(page)
 const scenario=await page.evaluate(async()=>{const f=await import('/scripts/fixtures/wool-final-downstream-review.ts');const scene=f.prepareWoolFinalDownstreamReviewScenario();const {appStore}=await import('/src/state/store.ts');appStore.navigate(scene.route);return scene})
 await page.reload()
 await expect(page.locator('[data-wool-final-craft-content]')).toBeVisible()
 await page.locator('[data-special-craft-web-action][data-action-code="SPECIAL_CRAFT_CONFIRM_RECEIVE"]').click()
 const dialog=page.locator('#wool-final-receipt-dialog')
 await expect(dialog).toContainText('12 件')
 await dialog.locator(`[data-wool-final-select="${scenario.handovers[0].handoverId}"]`).check()
 await dialog.locator('[data-wool-final-action="receive"]').click()
 await expect(dialog).toHaveCount(0)
 await page.reload();await expect(page.locator('[data-wool-final-craft-content]')).toBeVisible()
 const actual=await page.evaluate(async({taskId,woolOrderId})=>{const craft=await import('/src/data/fcs/special-craft-task-orders.ts');const wool=await import('/src/data/fcs/wool-domain/store.ts');const task=craft.getSpecialCraftTaskOrderById(taskId);return{received:task.receivedQty,handovers:wool.readWoolStore().handovers.filter((h:any)=>h.woolOrderId===woolOrderId)}},scenario)
 expect(actual.received).toBe(12)
 expect(actual.handovers.find((h:any)=>h.handoverId===scenario.handovers[0].handoverId).downstreamReceipt.actualReceivedQty).toBe(12)
 expect(actual.handovers.find((h:any)=>h.handoverId===scenario.handovers[1].handoverId).downstreamReceipt.status).toBe('PENDING')
 await page.locator('[data-special-craft-web-action][data-action-code="SPECIAL_CRAFT_CONFIRM_RECEIVE"]').click()
 await expect(dialog.locator('[data-wool-final-select]')).toHaveCount(1)
 await page.keyboard.press('Escape')
 await expect(dialog).toHaveCount(0)
})

test('管理端款式与纱线大图可按钮遮罩及Esc关闭，图片失败明确反馈',async({page})=>{
 test.setTimeout(90000)
 for(const route of ['/fcs/craft/wool/knitting-orders','/fcs/craft/wool/linking-orders','/fcs/craft/wool/knitting-orders/WOOL-STAGE-008%3AKNITTING','/fcs/craft/wool/linking-orders/WOOL-STAGE-010%3ALINKING','/fcs/craft/wool/pending-receipts','/fcs/craft/wool/pending-receipts?view=stock']){
  await page.goto(route)
  const opener=page.locator('[data-pda-image-preview-url]').first()
  await expect(opener).toBeVisible()
  await opener.locator('img').evaluate((img:HTMLImageElement)=>img.decode())
  for(const close of ['button','backdrop','escape']){
   await opener.click()
   const host=page.locator('[data-pda-image-preview-root]')
   await expect(host.getByRole('dialog')).toBeVisible()
   await host.locator('img').evaluate((img:HTMLImageElement)=>img.decode())
   if(close==='escape')await page.keyboard.press('Escape')
   else if(close==='backdrop')await host.locator('[aria-label="关闭大图预览"]').click({position:{x:3,y:3}})
   else await host.getByRole('button',{name:'关闭',exact:true}).click()
   await expect(host).toHaveCount(0)
  }
 }
 await page.route('**/cardigan-sample.jpg',route=>route.abort())
 await page.goto('/fcs/craft/wool/knitting-orders')
 await expect(page.locator('[data-pda-image-preview-url="/cardigan-sample.jpg"]').first()).toContainText('图片加载失败')
})

test('毛织PDA接收与仓储在两种小屏下无横溢且真实图片可读',async({page})=>{
 test.setTimeout(90000)
 await page.addInitScript(()=>localStorage.setItem('fcs_pda_session',JSON.stringify({userId:'OWN_WOOL_FACTORY_operator',loginId:'OWN_WOOL_FACTORY_operator',userName:'周哥毛织厂_操作工',roleId:'ROLE_OPERATOR',factoryId:'OWN_WOOL_FACTORY',factoryName:'周哥毛织厂',loggedAt:'2026-09-18 10:00:00'})))
 for(const viewport of [{width:360,height:800},{width:400,height:806}]){
  await page.setViewportSize(viewport)
  for(const route of ['/fcs/pda/wool/pending-receipts?workOrderId=WOOL-STAGE-001%3AKNITTING','/fcs/pda/wool/pending-receipts?workOrderId=WOOL-STAGE-010%3ALINKING','/fcs/pda/warehouse/inbound-records','/fcs/pda/warehouse/outbound-records']){
   await page.goto(route)
   await expect(page.locator('[data-wool-receiving-page],[data-wool-pda-warehouse-flows]')).toBeVisible()
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
   const image=page.locator('[data-pda-image-preview-url]').first()
   if(await image.count()){await image.click();await page.locator('[data-pda-image-preview-root] img').evaluate((img:HTMLImageElement)=>img.decode());await page.keyboard.press('Escape');await expect(page.locator('[data-pda-image-preview-root]')).toHaveCount(0)}
  }
 }
})

test('导出全部匹配行而非当前页，无操作列且空结果有明确反馈',async({page})=>{
 await open(page)
 await expect(page.locator('[data-wool-work-orders-table-surface] tbody tr')).toHaveCount(10)
 const download=page.waitForEvent('download');await page.locator(action('export')).click()
 const file=await download;const stream=(await file.createReadStream())!;const chunks=[];for await(const chunk of stream)chunks.push(chunk)
 const csv=Buffer.concat(chunks).toString('utf8')
 expect(new Set(csv.match(/HJ260918-\d{3}/g)).size).toBe(14)
 expect(csv.split('\r\n')[0]).not.toContain('操作')
 await page.locator('[data-wool-work-orders-field="keyword"]').fill('无任何匹配')
 await page.locator(action('query')).click();await page.locator(action('export')).click()
 await expect(page.locator(root)).toContainText('没有可导出的加工单')
})

test('列显隐顺序冻结和页大小按阶段保存，页码和排序刷新不保留',async({page})=>{
 await open(page)
 await page.locator(action('next-page')).click()
 await expect(page.locator('[data-wool-work-orders-table-surface] tbody tr')).toHaveCount(4)
 await page.reload();await expect(page.locator('[data-wool-work-orders-table-surface] tbody tr')).toHaveCount(10)
 await page.locator(action('sort-column')+'[data-column-key="order"]').click()
 await expect(page.locator('th[data-column-key="order"]')).toHaveAttribute('aria-sort','ascending')
 await page.reload();expect(await page.locator('th[data-column-key="order"]').getAttribute('aria-sort')).not.toBe('ascending')
 await page.locator(action('open-column-settings')).click()
 await page.locator(action('toggle-column-visibility')+'[data-wool-work-orders-column-key="requirements"]').uncheck()
 await page.locator(action('toggle-column-freeze')+'[data-wool-work-orders-column-key="quantities"]').check()
 await page.locator('[data-drag-source="times"]').dragTo(page.locator('[data-drop-target="inputs"]'))
 await page.locator(action('close-column-settings')).first().click()
 await page.locator('[data-wool-work-orders-field="pageSize"]').selectOption('20')
 await expect(page.locator('[data-wool-work-orders-table-surface] tbody tr')).toHaveCount(14)
 const prefs=await page.evaluate(()=>JSON.parse(localStorage.getItem('/fcs/craft/wool/knitting-orders:list-columns')!))
 expect(prefs.visibleKeys).not.toContain('requirements');expect(prefs.frozenKeys).toContain('quantities');expect(prefs.order.indexOf('times')).toBeLessThan(prefs.order.indexOf('inputs'));expect(prefs.pageSize).toBe(20)
 expect(prefs).not.toHaveProperty('sort');expect(prefs).not.toHaveProperty('currentPage')
 await open(page,'linking');await expect(page.locator('th[data-column-key="requirements"]')).toBeVisible();await expect(page.locator('[data-wool-work-orders-field="pageSize"]')).toHaveValue('10')
 await open(page);await expect(page.locator('th[data-column-key="requirements"]')).toHaveCount(0);await expect(page.locator('[data-wool-work-orders-field="pageSize"]')).toHaveValue('20')
})

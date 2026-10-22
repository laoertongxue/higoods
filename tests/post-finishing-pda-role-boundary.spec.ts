import { expect, test, type Page } from '@playwright/test'

// Resolve the page's loaded Vite instance for diagnostic source assertions.
// This helper exists only in isolated browser contexts, not in product code.
test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    performance.setResourceTimingBufferSize(5000)
    ;(window as any).__postActualModuleUrl=(path:string)=>{
      const matches=performance.getEntriesByType('resource').filter(entry=>new URL(entry.name).pathname===path)
      return matches.find(entry=>new URL(entry.name).searchParams.has('t'))?.name||matches[0]?.name||path
    }
  })
})

const POST_FACTORY_OPERATOR = {
  userId: 'ID-F002_operator',
  loginId: 'ID-F002_operator',
  userName: '后道工厂_操作工',
  roleId: 'ROLE_OPERATOR',
  factoryId: 'ID-F002',
  factoryName: '后道工厂',
  loggedAt: '2026-09-03 10:00:00',
}

async function setSession(page: Page, roleId: 'ROLE_OPERATOR' | 'ROLE_ADMIN'): Promise<void> {
  await page.goto('/fcs/pda/auth/login')
  await page.evaluate(({ session, role }) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify({
      ...session,
      userId: role === 'ROLE_ADMIN' ? 'ID-F002_admin' : session.userId,
      loginId: role === 'ROLE_ADMIN' ? 'ID-F002_admin' : session.loginId,
      userName: role === 'ROLE_ADMIN' ? '后道工厂_管理员' : session.userName,
      roleId: role,
    }))
    window.localStorage.removeItem('higoods-pda-sewing-self-return-mode')
  }, { session: POST_FACTORY_OPERATOR, role: roleId })
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

test('后道工厂执行页保留加工与出货，复检入口退役且不新建PDA质检端', async ({ page }) => {
  await setSession(page, 'ROLE_OPERATOR')
  for (const viewport of [{ width: 390, height: 844 }, { width: 480, height: 800 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/fcs/pda/exec')
    await expect(page.getByRole('heading', { name: '后道现场执行' })).toBeVisible()
    await expect(page.getByRole('button', { name: '后道加工' })).toBeVisible()
    await expect(page.getByRole('button', { name: '后道复检' })).toHaveCount(0)
    await expect(page.locator('a[href*="recheck"], [data-nav*="recheck"]')).toHaveCount(0)
    await expect(page.locator('body')).toContainText('登记加工并核对出货；质检在原质检工作台进行')
    await expect(page.locator('[data-pda-general-task-list]')).toHaveCount(0)
    await expect(page.locator('[data-testid="pda-exec-tabs"]')).toHaveCount(0)
    await expect(page.locator('[data-pda-exec-field="searchKeyword"]')).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText('其他执行任务')
    await expect(page.locator('body')).not.toContainText('TASK-DYE-')
    await expectNoHorizontalOverflow(page)
  }
})

test('回货入口归入交接待接收，仓管主页无旧回货或专用成衣仓收货入口', async ({ page }) => {
  await setSession(page, 'ROLE_OPERATOR')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/fcs/pda/warehouse')
  await expect(page.locator('body')).not.toContainText('后道回货与出货')
  await expect(page.locator('body')).not.toContainText('扫描送货单点数确认')
  await expect(page.locator('body')).not.toContainText('扫描后道出货单收货')

  for (const viewport of [{ width: 390, height: 844 }, { width: 400, height: 786 }, { width: 480, height: 800 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/fcs/pda/handover?tab=pickup')
    await expect(page.getByRole('button', { name: /待接收/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /已交出/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /待交出/ })).toHaveCount(0)
    const entryGrid = page.getByTestId('pda-pickup-entry-grid')
    await expect(entryGrid.locator('[data-pda-pickup-entry]')).toHaveCount(3)
    await expect(page.getByRole('button', { name: /回货接收/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /自助回货/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /辅料接收/ })).toBeVisible()
    const entryBoxes = await entryGrid.locator('[data-pda-pickup-entry]').evaluateAll((nodes) => nodes.map((node) => {
      const box = node.getBoundingClientRect()
      return { top: box.top, height: box.height }
    }))
    expect(new Set(entryBoxes.map((box) => Math.round(box.top))).size).toBe(1)
    expect(entryBoxes.every((box) => box.height <= 70)).toBe(true)
    const firstListCardTop = await page.locator('[data-pda-material-transfer-card]').first().evaluate((node) => node.getBoundingClientRect().top)
    expect(firstListCardTop).toBeLessThan(320)
    await expectNoHorizontalOverflow(page)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/fcs/pda/handover?tab=pickup')
  await page.getByRole('button', { name: /回货接收/ }).click()
  await expect(page).toHaveURL(/\/fcs\/pda\/post-finishing\/return-confirm/)
  await expect(page.getByRole('heading', { name: '扫描后道送货单号' })).toBeVisible()

  await page.goto('/fcs/pda/post-finishing/outbound-receive')
  await expect(page.getByRole('heading', { name: '扫描后道出货单条码' })).toHaveCount(0)
})

test('后道专用回货确认展示当前与已确认批次 SKU 明细', async ({ page }) => {
  await setSession(page, 'ROLE_OPERATOR')
  await page.setViewportSize({ width: 390, height: 844 })
  const deliveryNos = await page.evaluate(async () => {
    const flow = await import((window as any).__postActualModuleUrl('/src/data/fcs/post-finishing-full-flow.ts'))
    const rows = flow.listPostFinishingFactoryReturns()
    return [rows.find((row) => !row.confirmedAt)!, rows.find((row) => row.confirmedAt)!].map((row) => row.deliveryOrderNo)
  })
  for (const no of deliveryNos) {
    await page.goto('/fcs/pda/post-finishing/return-confirm')
    await page.locator('[data-pda-post-field="returnScan"]').fill(no)
    await page.getByRole('button', { name: '查询' }).click()
    await expect(page.locator('[data-return-confirm-line]').first()).toBeVisible()
    await expect(page.locator('[data-return-confirm-line]').first().locator('img')).toHaveCount(1)
    await expectNoHorizontalOverflow(page)
  }
})

test('后道辅料在交接待接收中按完整单号整单入库并同步 Web 待加工仓', async ({ page }) => {
  await setSession(page, 'ROLE_OPERATOR')
  for (const viewport of [{ width: 390, height: 844 }, { width: 480, height: 800 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/fcs/pda/handover?tab=pickup')
    await expect(page.getByRole('heading', { name: '后道辅料待入库' })).toBeVisible()
    await expect(page.locator('[data-pda-material-transfer-card]')).toHaveCount(5)
    await expect(page.locator('[data-pda-material-transfer-card="DB-PF-202608-001"]')).toBeVisible()
    await expect(page.locator('[data-pda-material-transfer-card="DB-PF-202608-005"]')).toBeVisible()
    await expect(page.locator('[data-pda-handover-field="materialTransferNo"]')).not.toBeVisible()
    await page.getByRole('button', { name: /辅料接收/ }).click()
    await expect(page.locator('[data-pda-handover-field="materialTransferNo"]')).toBeVisible()
    await expect(page.locator('body')).toContainText('只接受完整单号，不提供模糊候选')
    await expectNoHorizontalOverflow(page)
  }

  const input = page.locator('[data-pda-handover-field="materialTransferNo"]')
  await input.fill('DB-PF-202608')
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('不提供模糊候选')
    await dialog.accept()
  })
  await page.getByRole('button', { name: '查询', exact: true }).click()
  await input.fill('DB-PF-202608-001')
  await page.getByRole('button', { name: '查询', exact: true }).click()
  await expect(page).toHaveURL(/materialOrderNo=DB-PF-202608-001/)
  await expect(page.getByRole('heading', { name: '确认辅料入库' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '物料明细' }).locator('xpath=../following-sibling::div')).toHaveCount(4)
  await expect(page.locator('[data-pda-image-preview-url]')).toHaveCount(4)
  await expect(page.locator('input[type="number"]')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('授权码')
  await expect(page.locator('body')).not.toContainText('补料')
  await expectNoHorizontalOverflow(page)

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('一次性入库')
    await dialog.accept()
  })
  await page.getByRole('button', { name: '确认全部物料已领回并整单入库' }).click()
  await expect(page.locator('body')).toContainText('整单入库成功')
  await expect(page.locator('body')).toContainText('该调拨单已整单入库')

  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/fcs/craft/post-finishing/wait-process-warehouse?tab=materials')
  await expect(page.getByRole('heading', { name: '后道待加工仓' })).toBeVisible()
  await expect(page.getByText('辅料库存', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: '辅料库存' })).toBeVisible()
  await expect(page.locator('tbody tr')).toHaveCount(4)
  await expect(page.locator('tbody')).toContainText('495 PCS')
  await expect(page.locator('tbody')).toContainText('DB-PF-202608-001')
  await expectNoHorizontalOverflow(page)
})

test('已有 001 入库历史不被覆盖并自动补齐新增待入库测试单', async ({ page }) => {
  await setSession(page, 'ROLE_OPERATOR')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/fcs/pda/handover?tab=pickup')
  await expect(page.getByRole('heading', { name: '后道辅料待入库' })).toBeVisible()
  await expect(page.locator('[data-pda-material-transfer-card]')).toHaveCount(5)
  await page.evaluate(async () => {
    const flow = await import((window as any).__postActualModuleUrl('/src/data/fcs/post-finishing-full-flow.ts'))
    const records = await import((window as any).__postActualModuleUrl('/src/data/fcs/post-finishing-records.ts'))
    await records.ensurePostFinishingRecordState()
    await records.runPostFinishingCommand(() => flow.receivePostFinishingMaterialTransfer({
      transferOrderNo: 'DB-PF-202608-001', actor: { actorId: 'PF-USER-WH', actorName: '孙仓库收货员', roleName: '仓库收货人员' },
      nowMs: Date.UTC(2026, 8, 12, 8, 0, 0),
    }))
  })
  await page.reload()
  await expect(page.locator('[data-pda-material-transfer-card]')).toHaveCount(4)
  await expect(page.locator('[data-pda-material-transfer-card="DB-PF-202608-001"]')).toHaveCount(0)
  await expect(page.locator('[data-pda-material-transfer-card="DB-PF-202608-002"]')).toBeVisible()
  await expect(page.locator('[data-pda-material-transfer-card="DB-PF-202608-005"]')).toBeVisible()
  const migrated = await page.evaluate(async () => {
    const flow = await import((window as any).__postActualModuleUrl('/src/data/fcs/post-finishing-full-flow.ts'))
    const db = await import((window as any).__postActualModuleUrl('/src/data/pcs-record-db.ts'))
    const rows = (await db.readPcsRecords(['higood-fcs-post-finishing-records'])).records
    const saved = rows.filter(row => row.collection === 'flow/materialTransferOrders' && !row.deleted).map(row => row.value as any)
    if (saved.length !== 1 || saved[0].transferOrderNo !== 'DB-PF-202608-001' || saved[0].status !== '已入库') throw new Error('只保存本次修改的001覆盖，不应整批复制静态种子')
    return flow.listPostFinishingMaterialTransferOrders().map(item => ({ no: item.transferOrderNo, status: item.status }))
  })
  expect(migrated).toHaveLength(5)
  expect(migrated).toContainEqual({ no: 'DB-PF-202608-001', status: '已入库' })
  await expectNoHorizontalOverflow(page)
})

test('后道交接已交出直接展示 Web 后道出货单及 SKU 明细', async ({ page }) => {
  await setSession(page, 'ROLE_OPERATOR')
  for (const viewport of [{ width: 390, height: 844 }, { width: 480, height: 800 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/fcs/pda/handover?tab=shipped')
    await expect(page.getByText('已交出记录', { exact: true })).toBeVisible()
    await expect(page.locator('[data-pda-post-outbound-card]').first()).toBeVisible()
    await expect(page.locator('body')).toContainText('后道出货单')
    await expect(page.getByRole('button', { name: /待交出/ })).toHaveCount(0)
    const card = page.locator('[data-pda-post-outbound-card]').first()
    await card.locator('summary').click()
    await expect(card.locator('[data-pda-post-outbound-line]').first()).toBeVisible()
    await expect(card.locator('[data-pda-post-outbound-line]').first()).toContainText(/SPU-QC-/)
    await expect(card.locator('[data-pda-post-outbound-line]').first().locator('[data-pda-image-preview-url]')).toHaveCount(1)
    await expectNoHorizontalOverflow(page)
  }
})

test('后道加工操作页可返回工作台，旧复检地址无当前执行动作',async({page})=>{
  await setSession(page,'ROLE_OPERATOR')
  await page.goto('/fcs/pda/post-finishing/execute')
  const back=page.getByTestId('pda-post-back')
  await expect(back).toBeVisible();await expect(back).toHaveText(/返回/);await back.click()
  await expect(page).toHaveURL(/\/fcs\/pda\/exec$/)
  await page.goto('/fcs/pda/post-finishing/recheck')
  await expect(page.locator('[data-recheck-result-line], [data-recheck-scan], [data-pda-post-action="complete-recheck"], [data-pda-post-field="recheckScan"]')).toHaveCount(0)
  await expect(page.getByRole('heading',{name:'页面未找到',exact:true})).toBeVisible()
})

test('车缝自助回货由管理员开启，锁定与退出状态完整闭环', async ({ page }) => {
  await setSession(page, 'ROLE_OPERATOR')
  await page.goto('/fcs/pda/handover?tab=pickup')
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('请由后道工厂管理员开启')
    await dialog.accept()
  })
  await page.getByRole('button', { name: /自助回货/ }).click()
  await expect(page).toHaveURL(/\/fcs\/pda\/handover\?tab=pickup/)

  await setSession(page, 'ROLE_ADMIN')
  await page.goto('/fcs/pda/handover?tab=pickup')
  await page.getByRole('button', { name: /自助回货/ }).click()
  await expect(page).toHaveURL(/\/fcs\/pda\/handover\/sewing-self-return/)
  await expect(page.getByRole('heading', { name: '成衣回货登记模式' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => Boolean(window.localStorage.getItem('higoods-pda-sewing-self-return-mode')))).toBe(true)

  await page.getByRole('button', { name: '管理员退出' }).click()
  await expect(page).toHaveURL(/\/fcs\/pda\/handover\?tab=pickup/)
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('higoods-pda-sewing-self-return-mode'))).toBeNull()
  await expect(page.getByTestId('pda-pickup-entry-grid')).toBeVisible()
})

async function openOriginalWarehouseReceipt(page:Page) {
  await setSession(page,'ROLE_OPERATOR')
  await page.goto('/fcs/pda/handover?tab=shipped')
  await expect(page.getByText('已交出记录',{exact:true})).toBeVisible()
  const source=await page.evaluate(async()=>{
    const flow=await import((window as any).__postActualModuleUrl('/src/data/fcs/post-finishing-full-flow.ts'))
    const links=await import((window as any).__postActualModuleUrl('/src/data/fcs/pda-handover-events.ts'))
    const outbound=flow.listPostFinishingFullFlowOutboundOrders().find((row:any)=>row.status==='待仓库接收')
    if(!outbound)throw new Error('缺少已实际发出、尚未实收的静态隔离场景')
    const head=links.getPdaPostFinishingHandoutHeads().find((row:any)=>row.sourceDocId===outbound.outboundOrderId)
    if(!head)throw new Error('原后道出货单缺少通用PDA来源映射')
    const runtime=await import((window as any).__postActualModuleUrl('/src/pages/pda-runtime.ts'))
    return {outbound,head,actualOperator:runtime.getPdaRuntimeContext(),beforeReceipts:flow.listPostFinishingWarehouseReceipts().filter((row:any)=>row.outboundOrderId===outbound.outboundOrderId),beforeGeneric:links.getPdaHandoverRecordsByHead(head.handoverId)}
  })
  const card=page.locator(`[data-pda-post-outbound-card="${source.outbound.outboundOrderNo}"]`)
  await card.locator('[data-post-outbound-receipt-entry]').click()
  await expect(page.locator('[data-post-original-outbound]')).toContainText(source.outbound.outboundOrderNo)
  await expect(page.locator('[data-post-receipt-sku]')).toHaveCount(source.outbound.lines.length)
  return source
}

async function readOriginalWarehouseReceipt(page:Page,id:string,headId:string) {
  return page.evaluate(async({id,headId})=>{
    const flow=await import((window as any).__postActualModuleUrl('/src/data/fcs/post-finishing-full-flow.ts'))
    const links=await import((window as any).__postActualModuleUrl('/src/data/fcs/pda-handover-events.ts'))
    const db=await import((window as any).__postActualModuleUrl('/src/data/pcs-record-db.ts'))
    const raw=(await db.readPcsRecords(['higood-fcs-post-finishing-records'])).records.filter((row:any)=>row.collection==='flow/warehouseReceipts'&&row.value.outboundOrderId===id)
    return {raw,outbound:flow.getPostFinishingFullFlowOutboundOrder(id),receipts:flow.listPostFinishingWarehouseReceipts().filter((row:any)=>row.outboundOrderId===id),generic:links.getPdaHandoverRecordsByHead(headId)}
  },{id,headId})
}

test('原通用PDA逐SKU实收与真实登录责任人同库保存，刷新只入仓一次',async({page},testInfo)=>{
  await page.setViewportSize({width:390,height:844})
  const source=await openOriginalWarehouseReceipt(page)
  await expect(page.locator('[data-post-receipt-sku]').first()).toHaveValue('')
  await expect(page.locator('[data-post-receipt-line] img')).toHaveCount(source.outbound.lines.length)
  await expect.poll(()=>page.locator('[data-post-receipt-line] img').evaluateAll(nodes=>nodes.every(node=>(node as HTMLImageElement).complete&&(node as HTMLImageElement).naturalWidth>0))).toBe(true)
  // The source dispatch is a declared static scenario. Only this receipt is executed through UI.
  await page.getByRole('button',{name:'确认本单成衣仓实际接收',exact:true}).click()
  await expect(page.locator('[data-post-receipt-error]')).toContainText('实际接收人')
  await page.locator('[data-post-receipt-responsibility]').check()
  for(const line of source.outbound.lines)await page.locator(`[data-post-receipt-sku="${line.sku.skuId}"]`).fill(String(line.outboundQty))
  await expect(page.locator('[data-post-receipt-authorization-block]')).toBeHidden()
  page.once('dialog',async dialog=>{expect(dialog.message()).toContain('成衣仓接收责任');expect(dialog.message()).toContain(source.outbound.outboundOrderNo);await dialog.accept()})
  await page.getByRole('button',{name:'确认本单成衣仓实际接收',exact:true}).click()
  await expect(page.locator('[data-post-original-outbound] [role="status"]')).toContainText('成衣仓实收已保存')
  const saved=await readOriginalWarehouseReceipt(page,source.outbound.outboundOrderId,source.head.handoverId)
  expect(saved.outbound.status).toBe('已接收入库');expect(saved.receipts).toHaveLength(1);expect(saved.raw).toHaveLength(1)
  expect(saved.outbound.receivedBy.actorId).toBe(source.actualOperator.userId)
  expect(saved.outbound.receivedBy.actorName).toBe(source.actualOperator.userName)
  expect(saved.generic).toEqual(source.beforeGeneric)
  expect(saved.outbound.dispatchedAt).toBe(source.outbound.dispatchedAt)
  for(const line of saved.outbound.lines)expect(line.receivedQty).toBe(line.outboundQty)
  await page.reload();await testInfo.attach('receipt-raw-after-cold-route',{body:JSON.stringify(await readOriginalWarehouseReceipt(page,source.outbound.outboundOrderId,source.head.handoverId),null,2),contentType:'application/json'});await expect(page.locator('[data-post-original-outbound]')).toContainText('成衣仓实收已保存')
  await expect(page.getByRole('button',{name:'确认本单成衣仓实际接收'})).toHaveCount(0)
  expect(await readOriginalWarehouseReceipt(page,source.outbound.outboundOrderId,source.head.handoverId)).toEqual(saved)
  await expectNoHorizontalOverflow(page)
  await testInfo.attach('pda-original-outbound-real-receipt-once',{body:JSON.stringify({fixture:'已发出静态来源，实收通过真实PDA页面',source,saved},null,2),contentType:'application/json'})
})

test('原PDA仓实收逐SKU差异不抵消，保留原动态授权并在保存失败后保留输入重试',async({page},testInfo)=>{
  await page.setViewportSize({width:400,height:806})
  const source=await openOriginalWarehouseReceipt(page)
  await page.locator('[data-post-receipt-responsibility]').check()
  const expected=source.outbound.lines.map((line:any,index:number)=>({skuId:line.sku.skuId,receivedQty:line.outboundQty+(index===0?-1:index===1?1:0)}))
  for(const line of expected)await page.locator(`[data-post-receipt-sku="${line.skuId}"]`).fill(String(line.receivedQty))
  expect(expected.reduce((sum:number,line:any)=>sum+line.receivedQty,0)).toBe(source.outbound.lines.reduce((sum:number,line:any)=>sum+line.outboundQty,0))
  await expect(page.locator('[data-post-receipt-authorization-block]')).toBeVisible()
  await page.getByRole('button',{name:'确认本单成衣仓实际接收',exact:true}).click()
  await expect(page.locator('[data-post-receipt-error]')).toContainText('有效动态授权码')
  await page.locator('[data-post-receipt-reason]').fill('隔离专项首SKU少1件、第二SKU多1件，整单相等仍分别保存差异')
  const code=await page.evaluate(async()=>{const auth=await import((window as any).__postActualModuleUrl('/src/data/fcs/post-finishing-authorization.ts'));return auth.getPostFinishingAuthorizationDisplay('AUTH-WH-001').scanPayload})
  await page.locator('[data-post-receipt-authorization]').fill(code)
  await page.evaluate(()=>{
    const scope=window as any;scope.__originalReceiptPut=IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put=function(value:any,...args:any[]){if(value.collection==='flow/warehouseReceipts')throw new DOMException('隔离仓实收保存空间不足','QuotaExceededError');return scope.__originalReceiptPut.call(this,value,...args)}
  })
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'确认本单成衣仓实际接收'}).click()
  await expect(page.locator('[data-post-receipt-error]')).toContainText('空间不足')
  const failed=await readOriginalWarehouseReceipt(page,source.outbound.outboundOrderId,source.head.handoverId)
  expect(failed.outbound).toEqual(source.outbound);expect(failed.receipts).toEqual(source.beforeReceipts);expect(failed.generic).toEqual(source.beforeGeneric)
  for(const line of expected)await expect(page.locator(`[data-post-receipt-sku="${line.skuId}"]`)).toHaveValue(String(line.receivedQty))
  await expect(page.locator('[data-post-receipt-reason]')).toHaveValue('隔离专项首SKU少1件、第二SKU多1件，整单相等仍分别保存差异')
  await page.evaluate(()=>{IDBObjectStore.prototype.put=(window as any).__originalReceiptPut;delete (window as any).__originalReceiptPut})
  // Fetch a current authorization after fault handling; an expired code is never silently reused.
  const fresh=await page.evaluate(async()=>{const auth=await import((window as any).__postActualModuleUrl('/src/data/fcs/post-finishing-authorization.ts'));return auth.getPostFinishingAuthorizationDisplay('AUTH-WH-001').scanPayload})
  await page.locator('[data-post-receipt-authorization]').fill(fresh)
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'确认本单成衣仓实际接收'}).click()
  await expect(page.locator('[data-post-original-outbound] [role="status"]')).toContainText('成衣仓实收已保存')
  const saved=await readOriginalWarehouseReceipt(page,source.outbound.outboundOrderId,source.head.handoverId)
  expect(saved.receipts).toHaveLength(1);expect(saved.outbound.warehouseAuthorizedBy.authorizerName).toBeTruthy()
  expect(saved.outbound.warehouseDifferenceReason).toContain('少1件')
  for(const line of saved.outbound.lines)expect(line.receivedQty).toBe(expected.find((row:any)=>row.skuId===line.sku.skuId)!.receivedQty)
  await page.reload();await expect(page.locator('[data-post-original-outbound] [role="status"]')).toContainText('成衣仓实收已保存');expect(await readOriginalWarehouseReceipt(page,source.outbound.outboundOrderId,source.head.handoverId)).toEqual(saved)
  await expectNoHorizontalOverflow(page)
  await testInfo.attach('pda-original-receipt-authorized-atomic-retry',{body:JSON.stringify({source,expected,failed,saved},null,2),contentType:'application/json'})
})

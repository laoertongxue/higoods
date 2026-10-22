import { expect, test, type Page, type TestInfo } from '@playwright/test'

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
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

interface BrowserSeed {
  returnScan: string
  pendingDeliveryNo: string
  pendingDeliveryId: string
  qcTaskNo: string
  qcDeliveryId: string
  postTaskNo: string
  postTaskId: string
  preparedOutboundNo: string
  preparedOutboundId: string
  outboundOrderNo: string
  outboundOrderId: string
  outboundSkuId: string
  authorizedOutboundNo: string
  optionalQcTaskNo: string
}

const PDA_SESSION = {
  userId: 'ID-F002_operator',
  loginId: 'ID-F002_operator',
  userName: '后道工厂_操作工',
  roleId: 'ROLE_OPERATOR',
  factoryId: 'ID-F002',
  factoryName: '后道工厂',
  loggedAt: '2026-08-31 10:00:00',
}

async function setSession(page: Page, session = PDA_SESSION): Promise<void> {
  await page.evaluate((value) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(value))
  }, session)
}

async function setCurrentWebActor(page: Page, actorId: string): Promise<void> {
  await page.evaluate((id) => {
    window.localStorage.setItem('higood-fcs-post-finishing-current-actor-v1', id)
  }, actorId)
}

async function seedBrowserFlow(page: Page): Promise<BrowserSeed> {
  await page.goto('/fcs/craft/post-finishing/qc-workbench')
  await expect(page.getByTestId('post-finishing-qc-workbench-page')).toBeVisible()
  return page.evaluate(async () => {
    const flow = await import((window as any).__postActualModuleUrl('/src/data/fcs/post-finishing-full-flow.ts'))
    const records = await import((window as any).__postActualModuleUrl('/src/data/fcs/post-finishing-records.ts'))
    const authorizationModule = await import((window as any).__postActualModuleUrl('/src/data/fcs/post-finishing-authorization.ts'))
    const quality = await import((window as any).__postActualModuleUrl('/src/data/fcs/quality-management-records.ts'))
    await records.ensurePostFinishingRecordState()
    await quality.ensureQualityManagementRecords()
    // Isolated persisted business fixture; these steps are not claimed as UI execution.
    return records.runPostFinishingCommand(() => {
    flow.resetPostFinishingFullFlow()
    const actors = flow.POST_FINISHING_ACCEPTANCE_ACTORS
    const order = flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0]
    let nowMs = Date.UTC(2026, 7, 31, 8, 0, 0)
    const nextTime = () => { nowMs += 1_000; return nowMs }

    const register = (returnIndex: number) => flow.registerPostFinishingFactoryReturn({
      productionOrderNo: order.productionOrderNo,
      returnIndex,
      triggerSource: returnIndex % 2 ? '公共PDA自助回货' : '车缝正常交出',
      idempotencyKey: `BROWSER:${order.productionOrderNo}:${returnIndex}`,
      quantities: order.skus.map((sku) => ({ skuId: sku.skuId, registeredQty: 20 })),
      deliveryPersonName: actors.factoryCourier.actorName,
      deliveryPersonPhone: `081200000${returnIndex}`,
      evidenceImageUrls: ['/shirt-sample.jpg'],
      actor: actors.factoryCourier,
      nowMs: nextTime(),
    })
    const confirmAndSend = (returnIndex: number) => {
      const registered = register(returnIndex)
      const confirmed = flow.confirmPostFinishingFactoryReturn({
        deliveryId: registered.deliveryId,
        firstCounts: registered.lines.map((line) => ({ skuId: line.sku.skuId, actualQty: 20 })),
        actor: actors.returnConfirmer,
        nowMs: nextTime(),
      })
      const qc = flow.sendPostFinishingFactoryReturnToQc({ deliveryId: confirmed.deliveryId, actor: actors.sender, nowMs: nextTime() })
      return { delivery: confirmed, qc }
    }
    const completeQc = (qc: ReturnType<typeof flow.sendPostFinishingFactoryReturnToQc>) => {
      flow.claimPostFinishingQcTask({ qcTaskNo: qc.qcTaskNo, actor: actors.qcA, nowMs: nextTime() })
      flow.submitPostFinishingQcRound({qcTaskId:qc.qcTaskId,actor:actors.qcA,operationId:`BROWSER-ROUND:${qc.qcTaskId}`,
        lines:qc.lines.map(line=>({skuId:line.sku.skuId,passedQty:line.expectedQty,defectQty:0,returnQty:0,issues:[]})),nowMs:nextTime()})
      flow.attachPostFinishingQcSignedPaper({qcTaskId:qc.qcTaskId,actor:actors.qcA,url:order.skus[0].imageUrl,
        name:'隔离夹具纸单素材（不代表现场双签）',nowMs:nextTime()})
      return flow.completePostFinishingQcTask({qcTaskId:qc.qcTaskId,actor:actors.qcA,
        processItems:[...flow.POST_FINISHING_PROCESS_ITEMS],nowMs:nextTime()})
    }
    const completePost = (postTaskNo: string) => {
      const task = flow.getPostFinishingFullFlowPostTask(postTaskNo)!
      for (const processItem of task.processItems) flow.appendPostFinishingProcessCompletion({
        postTaskId: task.postTaskId, processItem,
        quantities: task.lines.map(line => ({ skuId: line.sku.skuId, quantity: line.expectedQty })),
        actor: actors.postOperator, responsible: actors.postOperator, operationId: `SEED:${task.postTaskId}:${processItem}`, nowMs: nextTime(),
      })
      const outbound = flow.submitPostFinishingForOutbound({ postTaskId: task.postTaskId,
        quantities: task.lines.map(line => ({ skuId: line.sku.skuId, quantity: line.expectedQty })),
        actor: actors.postOperator, operationId: `SEED-HANDOVER:${task.postTaskId}`, nowMs: nextTime() })
      return outbound
    }

    const firstRegistered = register(1)
    const firstDelivery = flow.confirmPostFinishingFactoryReturn({
      deliveryId: firstRegistered.deliveryId,
      firstCounts: firstRegistered.lines.map((line) => ({ skuId: line.sku.skuId, actualQty: 20 })),
      actor: actors.returnConfirmer,
      nowMs: nextTime(),
    })
    const first = {
      delivery: firstDelivery,
      qc: flow.sendPostFinishingFactoryReturnToQc({ deliveryId: firstDelivery.deliveryId, actor: actors.sender, nowMs: nextTime() }),
    }

    const second = confirmAndSend(2)
    const secondQc = completeQc(second.qc)
    const post = flow.getPostFinishingFullFlowPostTask(secondQc.postTaskNo!)!

    const third = confirmAndSend(3)
    const thirdQc = completeQc(third.qc)
    const preparedOutbound = completePost(thirdQc.postTaskNo!)

    const fourth = confirmAndSend(4)
    const fourthQc = completeQc(fourth.qc)
    const preparedFourth = completePost(fourthQc.postTaskNo!)
    const outbound = flow.dispatchPostFinishingOutboundOrder({outboundOrderId:preparedFourth.outboundOrderId,actor:actors.postOperator,nowMs:nextTime()})

    const auditOrder = flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[1]
    const auditRegistered = flow.registerPostFinishingFactoryReturn({
      productionOrderNo: auditOrder.productionOrderNo,
      returnIndex: 2,
      triggerSource: '管理端补登记',
      idempotencyKey: `BROWSER:AUDIT:${auditOrder.productionOrderNo}:2`,
      quantities: auditOrder.skus.map((sku) => ({ skuId: sku.skuId, registeredQty: 20 })),
      deliveryPersonName: actors.factoryCourier.actorName,
      deliveryPersonPhone: '0812999999',
      evidenceImageUrls: ['/shirt-sample.jpg'],
      actor: actors.factoryCourier,
      nowMs: nextTime(),
    })
    const auditDelivery = flow.confirmPostFinishingFactoryReturn({
      deliveryId: auditRegistered.deliveryId,
      firstCounts: auditRegistered.lines.map((line) => ({ skuId: line.sku.skuId, actualQty: 20 })),
      actor: actors.returnConfirmer,
      nowMs: nextTime(),
    })
    const auditQc = flow.sendPostFinishingFactoryReturnToQc({ deliveryId: auditDelivery.deliveryId, actor: actors.sender, nowMs: nextTime() })
    const auditQcDone = completeQc(auditQc)
    const auditPrepared = completePost(auditQcDone.postTaskNo!)
    const auditOutbound = flow.dispatchPostFinishingOutboundOrder({outboundOrderId:auditPrepared.outboundOrderId,actor:actors.postOperator,nowMs:nextTime()})
    const authorizationNow = nextTime()
    const authorizationDisplay = authorizationModule.getPostFinishingAuthorizationDisplay('AUTH-WH-001', authorizationNow)
    flow.receivePostFinishingOutboundOrder({
      outboundOrderNo: auditOutbound.outboundOrderNo,
      actor: actors.warehouseReceiver,
      receivedQuantities: auditOutbound.lines.map((line, index) => ({ skuId: line.sku.skuId, receivedQty: line.outboundQty - (index === 0 ? 1 : 0) })),
      authorization: { scanValue: authorizationDisplay.scanPayload, differenceReason: '浏览器审计少 1 件', nowMs: authorizationNow },
      nowMs: authorizationNow,
    })

    const optionalOrder=flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[2]
    const optionalReturn=flow.registerPostFinishingFactoryReturn({productionOrderNo:optionalOrder.productionOrderNo,returnIndex:1,
      triggerSource:'车缝正常交出',idempotencyKey:'BROWSER:OPTIONAL',quantities:optionalOrder.skus.map(sku=>({skuId:sku.skuId,registeredQty:20})),
      deliveryPersonName:actors.factoryCourier.actorName,deliveryPersonPhone:'',evidenceImageUrls:[optionalOrder.skus[0].imageUrl],actor:actors.factoryCourier,nowMs:nextTime()})
    flow.confirmPostFinishingFactoryReturn({deliveryId:optionalReturn.deliveryId,firstCounts:optionalReturn.lines.map(line=>({skuId:line.sku.skuId,actualQty:20})),actor:actors.returnConfirmer,nowMs:nextTime()})
    const optionalQc=flow.sendPostFinishingFactoryReturnToQc({deliveryId:optionalReturn.deliveryId,actor:actors.sender,nowMs:nextTime()})
    const pending = register(5)
    return {
      returnScan: flow.getPostFinishingReturnSourceScanValue(flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[1].productionOrderNo, 1),
      pendingDeliveryNo: pending.deliveryOrderNo,
      pendingDeliveryId: pending.deliveryId,
      qcTaskNo: first.qc.qcTaskNo,
      qcDeliveryId: first.delivery.deliveryId,
      postTaskNo: post.postTaskNo,
      postTaskId: post.postTaskId,
      preparedOutboundNo: preparedOutbound.outboundOrderNo,
      preparedOutboundId: preparedOutbound.outboundOrderId,
      outboundOrderNo: outbound.outboundOrderNo,
      outboundOrderId: outbound.outboundOrderId,
      outboundSkuId: outbound.lines[0].sku.skuId,
      authorizedOutboundNo: auditOutbound.outboundOrderNo,
      optionalQcTaskNo: optionalQc.qcTaskNo,
    }
    })
  })
}

async function expectNoBodyOverflow(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
}

async function expectImagesLoaded(page: Page): Promise<void> {
  const images = page.locator('img')
  expect(await images.count()).toBeGreaterThan(0)
  await expect.poll(() => images.evaluateAll((nodes) => nodes.every((node) => node.complete && node.naturalWidth > 0))).toBe(true)
}

async function verifyPdaAtBothSizes(page: Page): Promise<void> {
  for (const viewport of [{ width: 360, height: 800 }, { width: 400, height: 806 }]) {
    await page.setViewportSize(viewport)
    await expectNoBodyOverflow(page)
  }
}

async function attachPageEvidence(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const screenshot = await page.screenshot({ fullPage: true })
  await testInfo.attach(name, { body: screenshot, contentType: 'image/png' })
  const evidenceDirectory = process.env.POST_FINISHING_SCREENSHOT_DIR
  if (evidenceDirectory) {
    mkdirSync(evidenceDirectory, { recursive: true })
    await page.screenshot({ path: resolve(evidenceDirectory, `${name}.png`), fullPage: true })
  }
}

async function claimQc(page: Page, taskNo: string): Promise<void> {
  await page.locator('[data-post-finishing-field="qc-task-input"]').fill(taskNo)
  await page.getByRole('button',{name:'领取并固定本次检查要求',exact:true}).click()
  await expect(page.locator('[data-qc-workbench-task]')).toBeVisible()
  await expect(page.getByRole('heading',{name:'本次固定检查要求',exact:true})).toBeVisible()
}
async function submitFullQcRoundAndPaper(page: Page): Promise<void> {
  for (const line of await page.locator('[data-qc-result-line]').all()) {
    const input=line.locator('[data-qc-result-field="passedQty"]')
    await input.fill(await input.getAttribute('max') || '0')
  }
  await page.getByRole('button',{name:/提交第\d+轮检查/}).click()
  await expect(page.getByRole('status')).toContainText('本轮结果已保存')
  const image=page.locator('[data-qc-workbench-task] img').first()
  await expect.poll(()=>image.evaluate((node:HTMLImageElement)=>node.complete&&node.naturalWidth>0)).toBe(true)
  // Explicit isolated paper material from the matching garment, not proof of physical dual signatures.
  await page.locator('[data-qc-paper-file]').setInputFiles({name:'isolated-browser-paper-material.png',mimeType:'image/png',buffer:await image.screenshot()})
  await page.getByRole('button',{name:'上传并保存当前纸单'}).click()
  await expect(page.getByRole('status')).toContainText('当前要求版本纸单已保存')
  await expect(page.getByRole('button',{name:'确认完成QC并生成对应去向'})).toBeVisible()
}

test('默认演示数据在 Web 端真实展示 3 个生产单、15 次回货和分阶段库存', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/fcs/craft/post-finishing/tasks')
  await expect(page.getByRole('heading', { name: '后道生产任务', exact: true })).toBeVisible()
  await expect(page.locator('tbody tr').filter({ hasText: /PO-QC-202608-00[123]/ })).toHaveCount(3)
  await page.getByRole('button', { name: '回货记录（5）' }).first().click()
  const returnDialog = page.locator('[data-testid="post-production-task-return-dialog"]')
  await expect(returnDialog).toBeVisible()
  await expect(returnDialog.locator('tbody tr')).toHaveCount(5)
  await expect(returnDialog).toContainText('第 1 次')
  await expect(returnDialog).toContainText('第 5 次')
  await attachPageEvidence(page, testInfo, 'post-production-task-return-dialog')
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await page.getByRole('button', { name: '质检单（4）' }).first().click()
  const qcDialog = page.locator('[data-testid="post-production-task-qc-dialog"]')
  await expect(qcDialog).toBeVisible()
  await expect(qcDialog.locator('tbody tr')).toHaveCount(4)
  for (let sequence = 2; sequence <= 5; sequence += 1) {
    await expect(qcDialog).toContainText(`PO-QC-202608-001-${sequence}-ZJ`)
  }
  await expect(qcDialog).toContainText('不允许人工修改')
  await attachPageEvidence(page, testInfo, 'post-production-task-qc-dialog')
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.getByRole('button', { name: '回货记录（5）' })).toHaveCount(3)
  await expect(page.locator('[data-standard-list-stats]')).toContainText('后道生产任务')
  await attachPageEvidence(page, testInfo, 'default-demo-post-finishing-tasks')

  await page.goto('/fcs/craft/post-finishing/wait-process-warehouse?tab=returns')
  await expect(page.getByRole('heading', { name: '后道待加工仓' })).toBeVisible()
  await expect(page.locator('[data-return-card]')).toHaveCount(15)
  await attachPageEvidence(page, testInfo, 'default-demo-wait-process-pending')

  await page.locator('[data-nav*="tab=inventory"]').click()
  await expect(page.locator('[data-warehouse-sku-row]')).toHaveCount(15)
  await attachPageEvidence(page, testInfo, 'default-demo-wait-process-inventory')

  await page.goto('/fcs/craft/post-finishing/wait-handover-warehouse')
  await expect(page.getByRole('heading', { name: '后道待交出仓' })).toBeVisible()
  const actualStock = await page.evaluate(async () => {
    const flow = await import((window as any).__postActualModuleUrl('/src/data/fcs/post-finishing-full-flow.ts'))
    return flow.listPostFinishingWaitHandoverWarehouseRecords().filter(record => record.lines.some(line => line.availableQty > 0))
      .map(record => ({ sourceType: record.sourceType, productionOrderNo: record.productionOrderNo, outboundOrderNo: record.outboundOrderNo,
        quantities: record.lines.filter(line => line.availableQty > 0).map(line => ({ skuId: line.sku.skuId, quantity: line.availableQty })) }))
  })
  expect(actualStock.map(record => ({ sourceType: record.sourceType, productionOrderNo: record.productionOrderNo }))).toEqual([
    { sourceType: '质检直达', productionOrderNo: 'PO-QC-202608-002' },
    { sourceType: '后道加工后', productionOrderNo: 'PO-QC-202608-003' },
  ])
  const skuIds = actualStock.flatMap(record => record.quantities.map(line => line.skuId)).sort()
  expect(skuIds).toHaveLength(10)
  expect(actualStock.flatMap(record => record.quantities).reduce((sum, line) => sum + line.quantity, 0)).toBe(200)
  await expect(page.locator('[data-warehouse-sku-row]')).toHaveCount(10)
  expect((await page.locator('[data-warehouse-sku-row]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-warehouse-sku-row')))).sort()).toEqual(skuIds)
  await attachPageEvidence(page, testInfo, 'default-demo-wait-handover-inventory')

  await setCurrentWebActor(page, 'PF-USER-QC-MGR')
  await page.goto('/fcs/craft/post-finishing/qc-orders')
  await expect(page.locator('tbody tr')).toHaveCount(12)
  await page.goto('/fcs/craft/post-finishing/audit-records')
  await expect(page.locator('body')).toContainText('业务链（每次回货一条）')
  await expect(page.locator('body')).toContainText('15')
})

test('三类任务责任与新质检分流保持页面骨架，原历史辅料页面仅做回归', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/fcs/craft/post-finishing/tasks')
  await expect(page.locator('tbody tr').filter({ hasText: /PO-QC-202608-00[123]/ })).toHaveCount(3)
  await expect(page.locator('tbody')).toContainText('仅车缝')
  await expect(page.locator('tbody')).toContainText('车缝＋烫包')
  await expect(page.locator('tbody')).toContainText('裁剪＋车缝＋烫包')
  await expect(page.locator('tbody')).toContainText('后道项目由QC确认')
  await expect(page.locator('tbody')).toContainText('后道项目由QC确认')
  const statTops = await page.locator('[data-standard-list-stats] > div').evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().top)))
  expect(new Set(statTops).size).toBe(1)
  await expectNoBodyOverflow(page)
  await attachPageEvidence(page, testInfo, 'web-post-production-task-responsibility')

  await page.goto('/fcs/craft/post-finishing/material-transfers')
  await expect(page.getByRole('heading', { name: '后道辅料调拨单', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '调拨单列表', exact: true })).toBeVisible()
  const acceptanceTransfer = page.locator('tbody tr').filter({ hasText: 'DB-PF-202608-001' })
  await expect(acceptanceTransfer).toHaveCount(1)
  await expect(page.getByRole('dialog', { name: '后道辅料调拨单详情' })).toHaveCount(0)
  await acceptanceTransfer.locator('[data-post-finishing-material-transfers-action="detail"]').click()
  const drawer = page.getByRole('dialog', { name: '后道辅料调拨单详情' })
  await expect(drawer).toBeVisible()
  await expect(page.locator('[data-standard-list-table-section]')).toHaveCount(1)
  await expect(drawer.locator('tbody tr')).toHaveCount(4)
  // This DB-PF row is a retained, non-managed legacy demonstration. Its new
  // detail remains read-only; current managed receipts use the AW entry tested
  // by post-finishing-main-integration.spec.ts.
  await expect(drawer).toContainText('尚未入库')
  await expect(drawer.locator('[data-post-material-qty], [data-post-material-location]')).toHaveCount(0)
  await expect(drawer.locator('[data-post-finishing-material-transfers-action="receive"]')).toHaveCount(0)
  await expect(drawer.locator('input[type="number"]')).toHaveCount(0)
  await expectImagesLoaded(page)
  await attachPageEvidence(page, testInfo, 'web-material-transfer-list-and-detail-drawer')
  await drawer.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(drawer).toHaveCount(0)

  const seed = await seedBrowserFlow(page)
  await setCurrentWebActor(page,'PF-USER-QC-B')
  await page.goto('/fcs/craft/post-finishing/qc-workbench')
  await claimQc(page,seed.qcTaskNo)
  await submitFullQcRoundAndPaper(page)
  const fixedItems = page.locator('[data-qc-process-item]')
  await expect(fixedItems).toHaveCount(4)
  expect(await fixedItems.evaluateAll(nodes=>nodes.every(node=>(node as HTMLInputElement).checked && !(node as HTMLInputElement).disabled))).toBe(true)
  await expect(page.getByRole('button',{name:'确认完成QC并生成对应去向'})).toBeVisible()
  await attachPageEvidence(page,testInfo,'web-qc-only-sewing-editable-four-process-items')
  page.once('dialog',dialog=>dialog.accept())
  await page.getByRole('button',{name:'确认完成QC并生成对应去向'}).click()
  await expect(page.getByRole('status')).toContainText('QC已完成')
  await page.goto('/fcs/craft/post-finishing/qc-workbench')
  await claimQc(page,seed.optionalQcTaskNo)
  await submitFullQcRoundAndPaper(page)
  const optionalItems=page.locator('[data-qc-process-item]')
  await expect(optionalItems).toHaveCount(4)
  expect(await optionalItems.evaluateAll(nodes=>nodes.every(node=>!(node as HTMLInputElement).checked && !(node as HTMLInputElement).disabled))).toBe(true)
  await page.locator('[data-qc-process-item][value="包装"]').check()
  await expectNoBodyOverflow(page)
  await attachPageEvidence(page,testInfo,'web-qc-third-party-optional-process-items')
})

test('Web 质检精准领取、三类实检互斥、项目关联与款式颜色图片',async({page},testInfo)=>{
  const seed=await seedBrowserFlow(page)
  await setCurrentWebActor(page,'PF-USER-QC-A')
  await page.goto('/fcs/craft/post-finishing/qc-workbench');await claimQc(page,seed.qcTaskNo)
  const lines=page.locator('[data-qc-result-line]');await expect(lines).toHaveCount(5)
  await expect(lines.first()).toContainText('SPU-QC-001')
  await expect(lines.locator('img')).toHaveCount(5);await expectImagesLoaded(page)
  const first=lines.first()
  await expect(first.locator('[data-qc-result-field="defectQty"]')).toBeEditable()
  await first.locator('[data-qc-result-field="passedQty"]').fill('12')
  await first.locator('[data-qc-result-field="defectQty"]').fill('1')
  await first.locator('[data-qc-result-field="returnQty"]').fill('1')
  await first.locator('[data-qc-issue]').nth(0).check();await first.locator('[data-qc-issue]').nth(1).check()
  await first.locator('[data-qc-issue-note]').fill('同件多个问题分别关联标准，瑕疵与返工按实际成衣互斥计数')
  await expect(page.locator('[data-qc-live-summary]')).toContainText('合格12，瑕疵1，返工1')
  await expect(page.locator('[data-qc-defect-reason], [data-qc-difference-authorization], [data-qc-rework-factory-block]')).toHaveCount(0)
  await first.locator('[data-post-finishing-action="full-flow-zoom-image"]').click()
  await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(first.locator('[data-qc-result-field="passedQty"]')).toHaveValue('12')
  await attachPageEvidence(page,testInfo,'web-qc-three-exclusive-counts-standard-issues-and-images')
  // A fresh route is an intentional leave; acknowledge the unsaved UI draft.
  page.once('dialog',dialog=>dialog.accept())
  await setCurrentWebActor(page,'PF-USER-QC-B');await page.goto('/fcs/craft/post-finishing/qc-workbench')
  await page.locator('[data-post-finishing-field="qc-task-input"]').fill(seed.qcTaskNo)
  await page.getByRole('button',{name:'领取并固定本次检查要求'}).click()
  await expect(page.getByRole('alert')).toContainText(/已由.*质检/)
  await expect(page.locator('[data-post-finishing-field="qc-task-input"]')).toHaveValue(seed.qcTaskNo)
  await setCurrentWebActor(page,'PF-USER-QC-A');await page.goto('/fcs/craft/post-finishing/qc-workbench')
  await expect(page.locator('[data-qc-workbench-task]')).toBeVisible()
  await expect(page.getByRole('button',{name:'错误领取，退回待质检'})).toHaveCount(0)
})

test('公共 PDA 回货登记允许部分 SKU，阻断负数并展示真实图片', async ({ page }, testInfo) => {
  const seed = await seedBrowserFlow(page)
  await page.setViewportSize({ width: 360, height: 800 })
  await setSession(page,{...PDA_SESSION,userId:'ID-F002_admin',loginId:'ID-F002_admin',userName:'后道工厂_管理员',roleId:'ROLE_ADMIN'})
  await page.goto('/fcs/pda/handover?tab=pickup')
  await page.getByRole('button',{name:/自助回货/}).click()
  await expect(page).toHaveURL(/sewing-self-return/)
  await page.locator('[data-pda-sewing-self-return-field="scanValue"]').fill(seed.returnScan)
  await page.locator('[data-pda-sewing-self-return-field="scanValue"]').press('Enter')
  await expect(page.locator('[data-return-sku-card]')).toHaveCount(5)
  await expect(page.locator('body')).toContainText('来源任务')
  await expect(page.locator('body')).toContainText('暂存')
  await expect(page.locator('body')).toContainText('本来源可登记')
  await expect(page.getByRole('button', { name: '管理员退出' })).toBeVisible()
  await expectImagesLoaded(page)
  const quantities = page.locator('[data-pda-sewing-self-return-field="quantity"]')
  await quantities.first().fill('-1')
  await expect(page.locator('[data-return-quantity-error]')).toContainText('不小于 0')
  await expect(quantities.first()).toHaveAttribute('aria-invalid', 'true')
  for (let index = 0; index < 5; index += 1) await quantities.nth(index).fill('20')
  await quantities.first().fill('0')
  await expect(quantities.first()).toHaveAttribute('aria-invalid', 'false')
  await page.locator('[data-pda-sewing-self-return-field="deliveryPersonName"]').fill('苏车缝送货员')
  await page.locator('[data-pda-sewing-self-return-field="deliveryPersonPhone"]').fill('0812888888')
  await page.getByRole('button', { name: '加载原型验收凭证' }).click()
  await attachPageEvidence(page, testInfo, 'public-pda-return-registration')
  await page.getByRole('button', { name: '提交本次回货登记' }).click()
  await expect(page.getByRole('status')).toContainText('登记成功')
  const latestReturn = page.locator('[data-self-return-recent]').first()
  await expect(latestReturn.getByText('SKU 明细（5）')).toBeVisible()
  await expect(latestReturn.locator('img')).toHaveCount(5)
  await expect(latestReturn.getByRole('button', { name: '查看并确认' })).toBeVisible()
  let promptHandled = false
  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'prompt') {
      promptHandled = true
      await dialog.accept('车缝工厂登记错了回货批次')
      return
    }
    await dialog.accept()
  })
  await latestReturn.getByRole('button', { name: '废弃本次回货' }).click()
  expect(promptHandled).toBe(true)
  await expect(page.getByRole('status')).toContainText('已废弃')
  await expect(page.locator('[data-self-return-recent]').first()).toContainText('车缝工厂登记错了回货批次')
  const publicActors = await page.evaluate(async () => {
    const flow = await import((window as any).__postActualModuleUrl('/src/data/fcs/post-finishing-full-flow.ts'))
    const record = flow.listPostFinishingFactoryReturns().find(item => item.discardReason === '车缝工厂登记错了回货批次')!
    return { registeredBy: record.registeredBy, discardedBy: record.discardedBy }
  })
  expect(publicActors.registeredBy.actorId).toContain('PUBLIC-PDA-COURIER:')
  expect(publicActors.registeredBy.actorName).toBe('苏车缝送货员')
  expect(publicActors.discardedBy?.actorId).toBe('ID-F002_admin')
  expect(publicActors.discardedBy?.roleName).toBe('后道回货确认人员')
  await verifyPdaAtBothSizes(page)
  await page.getByRole('button', { name: '管理员退出' }).click()
  await expect(page).toHaveURL(/\/fcs\/pda\/handover\?tab=pickup/)
})

test('Web 回货详情在最终确认后仍展示逐 SKU 明细，未确认记录可废弃', async ({ page }, testInfo) => {
  const seed = await seedBrowserFlow(page)
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto(`/fcs/craft/post-finishing/wait-process-warehouse?tab=returns&deliveryId=${encodeURIComponent(seed.pendingDeliveryId)}`)
  await expect(page.locator('[data-return-count-line]')).toHaveCount(5)
  await expect(page.locator('body')).toContainText('回货方式')
  await expect(page.getByRole('button', { name: '废弃回货记录' })).toBeVisible()
  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'prompt') {
      await dialog.accept('Web 核对发现回货批次登记错误')
      return
    }
    await dialog.accept()
  })
  await page.getByRole('button', { name: '废弃回货记录' }).click()
  await expect(page.getByRole('status')).toContainText('回货记录已废弃')
  await expect(page.locator('[data-return-readonly-line]')).toHaveCount(5)
  await expect(page.locator('body')).toContainText('Web 核对发现回货批次登记错误')
  await expect(page.locator('body')).toContainText('未形成最终确认')
  await expect(page.getByRole('button', { name: '确认送检出库' })).toHaveCount(0)
  await attachPageEvidence(page, testInfo, 'web-return-discarded-sku-detail')
})

test('车缝自助回货只进入当前专用确认页，不再注入通用交接旧事实', async ({ page }) => {
  const seed = await seedBrowserFlow(page)
  await page.goto('/fcs/pda/warehouse')
  await setSession(page, {
    ...PDA_SESSION,
    userId: 'PF-DEDICATED-001_admin',
    loginId: 'PF-DEDICATED-001_admin',
    userName: 'HiGood 后道工厂_管理员',
    roleId: 'ROLE_ADMIN',
    factoryId: 'PF-DEDICATED-001',
    factoryName: 'HiGood 后道工厂',
  })
  await page.goto('/fcs/pda/handover?tab=pickup')
  await expect(page.locator('body')).not.toContainText(seed.pendingDeliveryNo)

  await page.goto('/fcs/pda/warehouse/wait-process')
  await expect(page.locator('body')).toContainText(seed.pendingDeliveryNo)
  await expect(page.locator('[data-nav="/fcs/pda/post-finishing/return-confirm"]').filter({ hasText: '扫描送货单确认回货' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: '确认入库', exact: true })).toHaveCount(0)
})

test('PDA 回货确认执行超 5%二次点数、授权和真实账号记录', async ({ page }, testInfo) => {
  const seed = await seedBrowserFlow(page)
  await page.setViewportSize({ width: 400, height: 806 })
  await setSession(page)
  await page.goto('/fcs/pda/post-finishing/return-confirm')
  const actualActor=await page.evaluate(async()=>{const runtime=await import((window as any).__postActualModuleUrl('/src/pages/pda-runtime.ts'));return runtime.getPdaRuntimeContext()})
  const scanner = page.locator('[data-pda-post-field="returnScan"]')
  await scanner.fill(seed.pendingDeliveryNo.slice(0, -1))
  await scanner.press('Enter')
  await expect(page.getByRole('status')).toContainText('未找到完整后道送货单号')
  await page.locator('[data-pda-post-field="returnScan"]').fill(seed.pendingDeliveryNo)
  await page.getByRole('button', { name: '查询' }).click()
  await expect(page.locator('[data-return-confirm-line]')).toHaveCount(5)
  await expect(page.locator('body')).toContainText('分母固定为工厂登记数量')
  await expect(page.locator('[data-difference-authorization-block="return"]')).toBeHidden()
  await expectImagesLoaded(page)
  await page.locator('[data-return-first-count]').first().fill('18')
  await expect(page.locator('[data-quantity-summary="return-line"]').first()).toContainText('差异率 10.00%')
  await page.getByRole('button', { name: '提交第一次点数' }).click()
  await expect(page.getByRole('status')).toContainText('请重新点数')
  await expect(page.getByRole('button', { name: '提交第二次点数' })).toBeVisible()
  await page.getByRole('button', { name: '提交第二次点数' }).click()
  await expect(page.getByRole('status')).toContainText('必须扫描动态授权码')
  await expect(page.locator('[data-difference-authorization-block="return"]')).toBeVisible()

  const authorization = await page.evaluate(async () => {
    const auth = await import((window as any).__postActualModuleUrl('/src/data/fcs/post-finishing-authorization.ts'))
    return auth.getPostFinishingAuthorizationDisplay('AUTH-QC-001').scanPayload
  })
  await page.locator('[data-return-difference-reason]').fill('复点后仍少 2 件')
  await page.locator('[data-return-authorization]').fill(authorization)
  await attachPageEvidence(page, testInfo, 'pda-return-confirm-authorization')
  await page.getByRole('button', { name: '授权并确认回货' }).click()
  await expect(page.getByRole('status')).toContainText('回货确认成功')
  await expect(page.locator('body')).toContainText(`回货已由 ${actualActor.userName} 确认`)
  await expect(page.locator('body')).toContainText('质检单')
  await verifyPdaAtBothSizes(page)
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto(`/fcs/craft/post-finishing/wait-process-warehouse?tab=returns&deliveryId=${encodeURIComponent(seed.pendingDeliveryId)}`)
  await expect(page.getByRole('heading', { name: 'SPU 技术参数在质检单统一维护' })).toHaveCount(0)
  await expect(page.locator('[data-return-readonly-line]')).toHaveCount(5)
  await expect(page.locator('[data-qc-reference-file]')).toHaveCount(0)
  await expect(page.getByRole('link', { name: '前往质检单维护' })).toHaveCount(0)
  await page.getByRole('button', { name: '确认送检出库' }).click()
  await expect(page.getByRole('status')).toContainText('送检成功')
  await expect(page.locator('[data-nav*="print?type=SEND_QC"]')).toBeVisible()
})

async function registerPdaItem(page: Page, processItem: string, firstQuantity?: number, skipFirst = false): Promise<void> {
  const card = page.locator(`[data-post-process="${processItem}"]`)
  if ((await card.getAttribute('open')) === null) await card.locator(':scope > summary').click()
  const inputs = card.locator('[data-post-process-qty]')
  for (let index = 0; index < await inputs.count(); index++) {
    const input = inputs.nth(index)
    if (await input.isDisabled()) continue
    const maximum = Number(await input.getAttribute('max') || '0')
    await input.fill(String(index === 0 && skipFirst ? 0 : index === 0 && firstQuantity !== undefined ? firstQuantity : maximum))
  }
  await card.locator('[data-pda-post-action="save-process-completion"]').click()
  await expect(page.locator('[data-pda-post-task] [role="status"]')).toContainText(`${processItem}本次已保存`)
}

async function submitPdaAvailable(page: Page): Promise<void> {
  const form = page.locator('[data-post-outbound-form]')
  if ((await form.getAttribute('open')) === null) await form.locator(':scope > summary').click()
  for (const input of await form.locator('[data-post-outbound-qty]:not([disabled])').all()) await input.fill(await input.getAttribute('max') || '0')
  page.once('dialog', dialog => dialog.accept())
  await page.locator('[data-pda-post-action="submit-for-outbound"]').click()
  await expect(page.locator('[data-pda-post-task] [role="status"]')).toContainText('已准备出货')
}

test('PDA精确扫码后按四项增量登记，部分完成可准备出货且保留正常在制', async ({ page }, testInfo) => {
  const seed = await seedBrowserFlow(page)
  await page.setViewportSize({ width: 360, height: 800 })
  await setSession(page)
  await page.goto('/fcs/pda/post-finishing/execute')
  await page.locator('[data-pda-post-field="postScan"]').fill(seed.postTaskNo)
  await page.locator('[data-pda-post-field="postScan"]').press('Enter')
  await expect(page.locator('[data-post-process]')).toHaveCount(4)
  await expect(page.locator('[data-post-processed-qty]')).toHaveCount(0)
  await expect(page.locator('[data-pda-post-action="toggle-process-item"]')).toHaveCount(0)
  const firstProcess = page.locator('[data-post-process="开扣眼"]')
  if ((await firstProcess.getAttribute('open')) === null) await firstProcess.locator(':scope > summary').click()
  await expectImagesLoaded(page)
  await page.locator('[data-pda-post-action="zoom-image"]').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  for (const item of ['开扣眼', '装扣子', '熨烫', '包装']) await registerPdaItem(page, item, 19)
  await submitPdaAvailable(page)
  const result = await page.evaluate(async id => {
    const flow = await import((window as any).__postActualModuleUrl('/src/data/fcs/post-finishing-full-flow.ts'))
    return { task: flow.getPostFinishingFullFlowPostTask(id), progress: flow.getPostFinishingProcessProgress(id) }
  }, seed.postTaskNo)
  expect(result.task?.status).toBe('后道中')
  expect(result.progress.totalCompletedQty).toBe(99)
  expect(result.progress.totalReservedQty).toBe(99)
  expect(result.progress.records).toHaveLength(4)
  await attachPageEvidence(page, testInfo, 'pda-post-finishing-partial-99-outbound')
  await verifyPdaAtBothSizes(page)
})

test('PDA某SKU未加工可保留待办，不强制填写未处理原因或关闭整张加工单', async ({ page }) => {
  const seed = await seedBrowserFlow(page)
  await page.setViewportSize({ width: 360, height: 800 })
  await setSession(page)
  await page.goto(`/fcs/pda/post-finishing/execute?id=${encodeURIComponent(seed.postTaskNo)}`)
  for (const item of ['开扣眼', '装扣子', '熨烫', '包装']) await registerPdaItem(page, item, undefined, true)
  await submitPdaAvailable(page)
  const result = await page.evaluate(async id => {
    const flow = await import((window as any).__postActualModuleUrl('/src/data/fcs/post-finishing-full-flow.ts'))
    return { task: flow.getPostFinishingFullFlowPostTask(id), progress: flow.getPostFinishingProcessProgress(id) }
  }, seed.postTaskNo)
  expect(result.task?.status).toBe('后道中')
  expect(result.progress.lines[0].completedQty).toBe(0)
  expect(result.progress.totalCompletedQty).toBe(80)
  expect(result.progress.totalReservedQty).toBe(80)
  await page.goto(`/fcs/pda/post-finishing/sku-adjustment?id=${encodeURIComponent(seed.postTaskNo)}`)
  await expect(page.locator('body')).toContainText('旧整单“未处理数量”登记入口已停用')
  await expect(page.locator('[data-post-adjust-field]')).toHaveCount(0)
})

test('Web可接续PDA分项记录，保留原责任且无需整单接管', async ({ page }) => {
  const seed = await seedBrowserFlow(page)
  await setSession(page)
  await page.goto(`/fcs/pda/post-finishing/execute?id=${encodeURIComponent(seed.postTaskNo)}`)
  const card = page.locator('[data-post-process="开扣眼"]')
  if ((await card.getAttribute('open')) === null) await card.locator(':scope > summary').click()
  await card.locator('[data-post-process-qty]').first().fill('5')
  await card.locator('[data-pda-post-action="save-process-completion"]').click()
  await expect(page.locator('[data-pda-post-task] [role="status"]')).toContainText('本次已保存 5 件')
  await setCurrentWebActor(page, 'PF-USER-POST')
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto(`/fcs/craft/post-finishing/work-orders/${encodeURIComponent(seed.postTaskNo)}`)
  await expect(page.locator('[data-web-post-takeover-reason]')).toHaveCount(0)
  for (const item of ['装扣子', '熨烫', '包装']) {
    await page.locator(`[data-post-finishing-work-order-detail-action="open-register"][data-process-item="${item}"]`).click()
    await page.locator('[data-post-entry-quantity]').first().fill('5')
    await page.locator('[data-post-finishing-work-order-detail-action="save-entry"]').click()
    await expect(page.locator('[data-post-entry-form]')).toHaveCount(0)
  }
  await page.locator('[data-post-finishing-work-order-detail-action="open-outbound"]').click()
  await page.locator('[data-post-entry-quantity]').first().fill('5')
  page.once('dialog', dialog => dialog.accept())
  await page.locator('[data-post-finishing-work-order-detail-action="save-entry"]').click()
  await expect(page.locator('[data-post-entry-form]')).toHaveCount(0)
  const result = await page.evaluate(async id => {
    const flow = await import((window as any).__postActualModuleUrl('/src/data/fcs/post-finishing-full-flow.ts'))
    return flow.getPostFinishingProcessProgress(id)
  }, seed.postTaskNo)
  expect(result.totalCompletedQty).toBe(5)
  expect(result.totalReservedQty).toBe(5)
  expect(new Set(result.records.map(row => row.recordedBy.actorId)).size).toBe(2)
})

test('旧复检领取/退领/错码重贴入口退役，原出货单逐SKU核对并唯一实际发出',async({page},testInfo)=>{
  const seed=await seedBrowserFlow(page)
  await page.setViewportSize({width:1366,height:768})
  await page.goto('/fcs/craft/post-finishing/recheck-orders')
  await expect(page.getByRole('heading',{name:'页面未找到',exact:true})).toBeVisible()
  await expect(page.locator('[data-recheck-result-line], [data-recheck-claim-task-no], [data-recheck-result-field]')).toHaveCount(0)
  for(const label of ['领取复检单','退领复检单','已重新贴码','确认数量条码并生成后道出货单']) await expect(page.getByRole('button',{name:label,exact:true})).toHaveCount(0)
  await setCurrentWebActor(page,'PF-USER-POST')
  await page.goto(`/fcs/craft/post-finishing/outbound-orders/${encodeURIComponent(seed.preparedOutboundId)}`)
  await expect(page.locator('main')).toContainText(seed.preparedOutboundNo)
  await expect(page.locator('main')).toContainText('待出货')
  await expect(page.locator('main tbody tr')).toHaveCount(5)
  await expectImagesLoaded(page)
  await expect(page.locator('[data-recheck-result-field]')).toHaveCount(0)
  page.once('dialog',dialog=>dialog.accept())
  await page.getByRole('button',{name:'确认实际发出',exact:true}).click()
  await expect(page.locator('main')).toContainText('待仓库接收')
  await expect(page.getByRole('button',{name:'确认实际发出',exact:true})).toHaveCount(0)
  const result=await page.evaluate(async id=>{
    const flow=await import((window as any).__postActualModuleUrl('/src/data/fcs/post-finishing-full-flow.ts'))
    const current=flow.getPostFinishingFullFlowOutboundOrder(id)
    return {current,all:flow.listPostFinishingFullFlowOutboundOrders().filter(item=>item.postTaskId===current!.postTaskId),rechecks:flow.listPostFinishingFullFlowRecheckOrders()}
  },seed.preparedOutboundId)
  expect(result.current?.status).toBe('待仓库接收');expect(result.all).toHaveLength(1)
  expect(result.rechecks).toHaveLength(0)
  await page.reload();await expect(page.locator('main')).toContainText('待仓库接收')
  await attachPageEvidence(page,testInfo,'web-original-outbound-dispatched-without-recheck')
})

test('后道仓管主页无旧专用成衣仓收货入口，原出货单保留业务条码', async ({ page }) => {
  const seed = await seedBrowserFlow(page)
  await setSession(page)
  await page.goto('/fcs/pda/warehouse')
  await expect(page.locator('body')).not.toContainText('扫描后道出货单收货')
  await page.goto('/fcs/pda/post-finishing/outbound-receive')
  await expect(page.getByRole('heading', { name: '扫描后道出货单条码' })).toHaveCount(0)
  await page.goto(`/fcs/craft/post-finishing/print?type=OUTBOUND&id=${encodeURIComponent(seed.outboundOrderId)}`)
  await expect(page.locator('[data-business-document-barcode]')).toHaveAttribute('data-business-document-barcode', seed.outboundOrderNo)
  await expect(page.locator('[data-scan-target]')).toHaveCount(0)
})

test('Web 管理页、独立动态授权码、主从日志和全套打印均读取同一链路事实', async ({ page }, testInfo) => {
  test.setTimeout(180_000)
  const seed = await seedBrowserFlow(page)
  await page.setViewportSize({ width: 1366, height: 768 })
  for (const path of [
    '/fcs/craft/post-finishing/qc-orders',
    '/fcs/craft/post-finishing/work-orders',
    '/fcs/craft/post-finishing/wait-handover-warehouse',
    '/fcs/craft/post-finishing/outbound-orders',
    '/fcs/craft/post-finishing/audit-records',
  ]) {
    await page.goto(path)
    await expect(page.locator('body')).not.toContainText('次品')
    await expectNoBodyOverflow(page)
  }
  for (const path of [
    '/fcs/craft/post-finishing/work-orders',
    '/fcs/craft/post-finishing/wait-process-warehouse',
    '/fcs/craft/post-finishing/wait-handover-warehouse',
    '/fcs/craft/post-finishing/outbound-orders',
    '/fcs/craft/post-finishing/audit-records',
    '/fcs/craft/post-finishing/authorization-code',
  ]) {
    await page.goto(path)
    await expect(page.getByText('打印质检单', { exact: true })).toHaveCount(0)
    await expect(page.getByText('打印质检单详情', { exact: true })).toHaveCount(0)
  }
  await page.goto('/fcs/craft/post-finishing/qc-orders')
  await expect(page.getByText('打印质检单', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('打印质检详情单', { exact: true }).first()).toBeVisible()
  await expect(page.locator('[data-authorization-code]')).toHaveCount(0)

  await page.goto(`/fcs/craft/post-finishing/print?type=QC_ORDER&id=${encodeURIComponent(seed.qcTaskNo)}`)
  await expect(page.locator('[data-testid="post-finishing-qc-master-print"]')).toBeVisible()
  await expect(page.locator('[data-print-document-no]')).toHaveAttribute('data-print-document-no', seed.qcTaskNo)

  await page.goto(`/fcs/craft/post-finishing/print?type=QC_DETAIL&id=${encodeURIComponent(seed.qcTaskNo)}`)
  await expect(page.locator('[data-testid="post-finishing-qc-detail-print"]')).toBeVisible()
  await expect(page.locator('[data-print-document-no]')).toHaveAttribute('data-print-document-no', seed.qcTaskNo)

  await page.goto('/fcs/craft/post-finishing/authorization-code')
  await expect(page.locator('body')).toContainText('当前账号没有授权权限')
  await expect(page.locator('[data-authorization-code]')).toHaveCount(0)
  await page.evaluate(() => window.localStorage.setItem('higood-fcs-post-finishing-current-authorizer-v1', 'AUTH-QC-001'))
  await page.goto('/fcs/craft/post-finishing/authorization-code')
  await expect(page.getByRole('heading', { name: '我的动态授权码' })).toBeVisible()
  await expect(page.locator('body')).toContainText('30 秒自动刷新')
  await expect(page.locator('[data-authorization-code]')).toBeVisible()
  await expect(page.locator('[data-authorization-scan-payload]')).toHaveText(/^PFAUTH:/)
  await page.evaluate(() => window.localStorage.setItem('higood-fcs-post-finishing-current-authorizer-v1', 'NONE'))
  await page.reload()
  await expect(page.locator('body')).toContainText('当前账号没有授权权限')
  await expect(page.locator('[data-authorization-code]')).toHaveCount(0)

  await page.goto(`/fcs/craft/post-finishing/audit-records?keyword=${encodeURIComponent(seed.authorizedOutboundNo)}`)
  await expect(page.getByRole('heading', { name: '差异与操作日志' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '回货全链路总览' })).toBeVisible()
  await page.getByRole('link', { name: '查看详情' }).click()
  await expect(page.locator('[data-audit-chain-detail]')).toBeVisible()
  await expect(page.locator('form[action="/fcs/craft/post-finishing/audit-records"]')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '回货全链路总览' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: '业务链总览' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '1. 回货与质检' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '逐 SKU 数量差异' })).toHaveCount(0)
  await page.getByRole('link', { name: '差异与质检' }).click()
  await expect(page.getByRole('heading', { name: '逐 SKU 数量差异' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '质检瑕疵记录' })).toBeVisible()
  await page.getByRole('link', { name: '操作时间线' }).click()
  await expect(page.getByRole('heading', { name: '按环节归组的操作记录' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '逐 SKU 数量差异' })).toHaveCount(0)
  await expect(page.locator('[data-audit-chain-detail]')).toContainText('陈仓库主管')
  await page.goto(`/fcs/craft/post-finishing/outbound-orders?keyword=${encodeURIComponent(seed.authorizedOutboundNo)}&receiver=${encodeURIComponent('孙仓库收货员')}&authorizer=${encodeURIComponent('陈仓库主管')}`)
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody')).toContainText(seed.authorizedOutboundNo)
  await page.locator('[data-nav*="/fcs/craft/post-finishing/outbound-orders/"]').click()
  await expect(page.locator('body')).toContainText('追溯链路')
  await expect(page.locator('body')).toContainText('后道加工单')
  await expect(page.locator('body')).not.toContainText('复检单')

  const prints: Array<{ url: string; title: string; documentNo: string; target?: string }> = [
    { url: `/fcs/craft/post-finishing/print?type=SEND_QC&id=${encodeURIComponent(seed.qcDeliveryId)}`, title: '后道送检单', documentNo: seed.qcTaskNo, target: '/fcs/craft/post-finishing/qc-workbench' },
    { url: `/fcs/craft/post-finishing/print?type=POST_ORDER&id=${encodeURIComponent(seed.postTaskId)}`, title: '后道加工单流转卡', documentNo: seed.postTaskNo, target: '/fcs/pda/post-finishing/execute' },
    { url: `/fcs/craft/post-finishing/print?type=OUTBOUND&id=${encodeURIComponent(seed.outboundOrderId)}`, title: '后道出货单', documentNo: seed.outboundOrderNo },
  ]
  for (const item of prints) {
    await page.goto(item.url)
    await expect(page.getByRole('heading', { name: item.title })).toBeVisible()
    await expect(page.locator('[data-print-document-no]')).toHaveAttribute('data-print-document-no', item.documentNo)
    if (item.target) await expect(page.locator('[data-scan-target]')).toHaveAttribute('data-scan-target', new RegExp(item.target))
    else await expect(page.locator('[data-scan-target]')).toHaveCount(0)
    if (item.title === '后道出货单') await expect(page.getByRole('heading', { name: '出货明细' }).locator('xpath=following-sibling::table[1]//tbody/tr')).toHaveCount(5)
    else await expect(page.locator('tbody tr')).toHaveCount(5)
    await expect(page.locator('[data-business-document-barcode]')).toHaveAttribute('data-business-document-barcode', item.documentNo)
    if (item.title === '后道出货单') {
      await expect(page.locator('body')).toContainText('来源动作')
      await expect(page.locator('body')).toContainText('交出位置')
      await expect(page.locator('body')).toContainText('接收仓')
    } else if (item.title === '后道加工单流转卡') {
      for (const label of ['送货单 / 质检单', '生产单 / 第几次回货', '后道工序', '质检交接时间']) await expect(page.locator('dt').filter({ hasText: label })).toBeVisible()
      for (const processItem of ['开扣眼', '装扣子', '熨烫', '包装']) {
        await expect(page.getByText(`${processItem}完成量`, { exact: true }).locator('xpath=following-sibling::dd[1]')).toHaveText('0 / 100 件')
      }
      await expect(page.getByText('全部后道完成 / 可准备出货', { exact: true }).locator('xpath=following-sibling::dd[1]')).toHaveText('0 / 0 件')
      await expect(page.getByText('全部出货单', { exact: true }).locator('xpath=following-sibling::dd[1]')).toHaveText('尚未出货')
    } else await expect(page.locator('dl > div')).toHaveCount(4)
    await expectImagesLoaded(page)
    const sheetSize = await page.locator('[data-print-sheet="a4"]').evaluate((node) => {
      const rect = node.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    })
    expect(sheetSize.width).toBeLessThanOrEqual(795)
    expect(sheetSize.height).toBeLessThan(1123)
    if (item.title === '后道出货单') await attachPageEvidence(page, testInfo, 'a4-outbound-print')
  }

  const outboundLabelCount = await page.evaluate(async (id) => {
    const flow = await import((window as any).__postActualModuleUrl('/src/data/fcs/post-finishing-full-flow.ts'))
    return flow.getPostFinishingFullFlowOutboundOrder(id)?.lines.reduce((sum, line) => sum + line.outboundQty, 0) || 0
  }, seed.outboundOrderId)
  for (const [type, kind] of [['OUTBOUND_BARCODE', 'BARCODE'], ['OUTBOUND_HANGTAG', 'HANGTAG']] as const) {
    await page.goto(`/fcs/craft/post-finishing/print?type=${type}&id=${encodeURIComponent(seed.outboundOrderId)}`)
    await expect(page.locator('[data-testid="post-finishing-outbound-label-print"]')).toHaveAttribute('data-label-kind', kind)
    await expect(page.locator('[data-testid="post-finishing-outbound-label-print"]')).toHaveAttribute('data-label-count', String(outboundLabelCount))
    await expect(page.locator('[data-outbound-unit-label]')).toHaveCount(outboundLabelCount)
    await expect(page.getByRole('button', { name: '打印全部' })).toBeVisible()
  }

  await page.locator('img').first().evaluate((image) => { image.src = '/__missing-post-finishing-image__.jpg' })
  await expect(page.getByText('图片加载失败').first()).toBeVisible()

  await expect(page.locator('[data-recheck-result-line]')).toHaveCount(0)

})

// Current requirements replace automatic localStorage conversion and the SPU editor.
test('新质检分轮保存失败原子回滚，保留当前输入并成功重试',async({page},testInfo)=>{
  const seed=await seedBrowserFlow(page)
  await setCurrentWebActor(page,'PF-USER-QC-A');await page.goto('/fcs/craft/post-finishing/qc-workbench');await claimQc(page,seed.qcTaskNo)
  const input=page.locator('[data-qc-result-line]').first().locator('[data-qc-result-field="passedQty"]')
  const submittedQuantities:number[]=[]
  for(const line of await page.locator('[data-qc-result-line]').all()){
    const field=line.locator('[data-qc-result-field="passedQty"]'), quantity=Number(await field.getAttribute('max'))
    expect(quantity).toBeGreaterThan(0);submittedQuantities.push(quantity);await field.fill(String(quantity))
  }
  expect(submittedQuantities.reduce((sum,quantity)=>sum+quantity,0)).toBe(100)
  const before=await page.evaluate(async()=>{const db=await import((window as any).__postActualModuleUrl('/src/data/pcs-record-db.ts'));return (await db.readPcsRecords(['higood-fcs-post-finishing-records'])).records})
  await page.evaluate(()=>{
    const scope=window as any;scope.__postOriginalPut=IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put=function(value:any,...args:any[]){if(value.collection==='flow/qcTasks')throw new DOMException('隔离质检保存空间不足','QuotaExceededError');return scope.__postOriginalPut.call(this,value,...args)}
  })
  await page.getByRole('button',{name:'提交第1轮检查'}).click()
  await expect(page.locator('[data-qc-save-error]')).toContainText('空间不足')
  await expect(input).toHaveValue(String(submittedQuantities[0]))
  const after=await page.evaluate(async()=>{const db=await import((window as any).__postActualModuleUrl('/src/data/pcs-record-db.ts'));return (await db.readPcsRecords(['higood-fcs-post-finishing-records'])).records})
  expect(after).toEqual(before)
  await page.evaluate(()=>{IDBObjectStore.prototype.put=(window as any).__postOriginalPut;delete (window as any).__postOriginalPut})
  await page.getByRole('button',{name:'提交第1轮检查'}).click();await expect(page.getByRole('status')).toContainText('本轮结果已保存')
  const saved=await page.evaluate(async no=>{const flow=await import((window as any).__postActualModuleUrl('/src/data/fcs/post-finishing-full-flow.ts'));return flow.getPostFinishingFullFlowQcTask(no)},seed.qcTaskNo)
  expect(saved?.inspection?.rounds).toHaveLength(1);expect(saved?.inspection?.rounds[0].lines.map(line=>line.passedQty)).toEqual(submittedQuantities)
  const snapshotId=saved!.inspection!.snapshot.id
  await page.reload();await expect(page.locator('[data-qc-workbench-task]')).toBeVisible()
  const reloaded=await page.evaluate(async no=>{const flow=await import((window as any).__postActualModuleUrl('/src/data/fcs/post-finishing-full-flow.ts'));return flow.getPostFinishingFullFlowQcTask(no)},seed.qcTaskNo)
  expect(reloaded?.inspection?.snapshot.id).toBe(snapshotId);expect(reloaded?.inspection?.rounds).toHaveLength(1)
  await testInfo.attach('post-current-round-atomic-retry',{body:JSON.stringify({fixture:'原库事务隔离准备，真实UI提交及故障注入',before,after,saved,reloaded},null,2),contentType:'application/json'})
})

test('Web 原出货实际发出保存失败时出货状态与流水原子回滚，原单可重试',async({page},testInfo)=>{
  const seed=await seedBrowserFlow(page)
  await setCurrentWebActor(page,'PF-USER-POST')
  await page.goto(`/fcs/craft/post-finishing/outbound-orders/${encodeURIComponent(seed.preparedOutboundId)}`)
  const read=()=>page.evaluate(async()=>{const db=await import((window as any).__postActualModuleUrl('/src/data/pcs-record-db.ts'));return (await db.readPcsRecords(['higood-fcs-post-finishing-records'])).records})
  const before=await read()
  await page.evaluate(()=>{
    const scope=window as any;scope.__postOriginalPut=IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put=function(value:any,...args:any[]){if(value.collection==='flow/outboundOrders')throw new DOMException('隔离出货保存空间不足','QuotaExceededError');return scope.__postOriginalPut.call(this,value,...args)}
  })
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'确认实际发出',exact:true}).click()
  await expect(page.locator('[data-post-finishing-action-error]')).toContainText('空间不足')
  const after=await read();expect(after).toEqual(before)
  await expect(page.getByRole('button',{name:'确认实际发出',exact:true})).toBeVisible()
  await page.evaluate(()=>{IDBObjectStore.prototype.put=(window as any).__postOriginalPut;delete (window as any).__postOriginalPut})
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'确认实际发出',exact:true}).click()
  await expect(page.locator('main')).toContainText('待仓库接收')
  await page.reload();await expect(page.locator('main')).toContainText('待仓库接收')
  await testInfo.attach('post-outbound-dispatch-atomic-retry',{body:JSON.stringify({before,after,success:await read()},null,2),contentType:'application/json'})
})

test('后道按需读取生产分配覆盖，其他生产入口仍恢复分配产物', async ({ page }) => {
  await observeEntryBusinessWrites(page)
  const requests: string[] = []
  page.on('request', request => requests.push(request.url()))
  await page.goto('/fcs/craft/post-finishing/work-orders')
  await expect(page.locator('main h1')).toBeVisible()
  expect(await page.evaluate(()=>(window as any).__postEntryBusinessWrites)).toEqual([])
  requests.length = 0
  await page.goto('/fcs/craft/post-finishing/qc-orders')
  await expect(page.locator('main h1')).toHaveText('质检清单')
  expect(await page.evaluate(()=>(window as any).__postEntryBusinessWrites)).toEqual([])
  await expect(page.locator('main [data-object-type="QC_ORDER"]')).toHaveText('PO-QC-202608-001-4-ZJ')
  await expect(page.locator('main [data-object-type="PRODUCTION_ORDER"]')).toHaveText('PO-QC-202608-001')
  await expect(page.locator('main')).toContainText('后道验收 Mock 来源；生产主线已关联')
  // 写入合法的上游覆盖记录作为验收前置，页面刷新必须恢复它。
  await page.evaluate(async () => {
    const records = await import((window as any).__postActualModuleUrl('/src/data/fcs/cutting/cutting-record-repository.ts'))
    const context = await import((window as any).__postActualModuleUrl('/src/data/fcs/production-context-records.ts'))
    const snapshot = await records.readCuttingRecords()
    const puts = context.decodeProductionContextRecords(context.PRODUCTION_CONTEXT_KEYS.effects,
      JSON.stringify({ version: 1, entries: [['material-sequence:value', 777]] }))
    await records.commitCuttingRecords({ revision: snapshot.revision, change: { puts },
      command: { id: 'POST-SOURCE-READ-TEST', intent: '合法分配覆盖验收', result: true, at: new Date().toISOString() } })
  })
  requests.length = 0
  await page.reload()
  await expect(page.locator('main h1')).toBeVisible()
  expect(await page.evaluate(async () => {
    const material = await import((window as any).__postActualModuleUrl('/src/data/fcs/sewing-material-handover.ts'))
    return material.captureSewingMaterialState().sequence
  })).toBe(777)
  await page.goto('/fcs/production/orders')
  await expect(page.locator('main h1')).toBeVisible()
  expect(await page.evaluate(async () => {
    const material = await import((window as any).__postActualModuleUrl('/src/data/fcs/sewing-material-handover.ts'))
    return material.captureSewingMaterialState().sequence
  })).toBe(777)
})

test('质检清单来源缺失时编号只读并提示关联待补', async ({ page }) => {
  await page.goto('/fcs/craft/post-finishing/qc-orders')
  await expect(page.locator('main h1')).toHaveText('质检清单')
  await page.evaluate(async () => {
    const flow = await import((window as any).__postActualModuleUrl('/src/data/fcs/post-finishing-full-flow.ts'))
    const records = await import((window as any).__postActualModuleUrl('/src/data/pcs-record-db.ts'))
    const task = structuredClone(flow.getPostFinishingActiveQcTask(flow.getCurrentPostFinishingActor().actorId))
    task.productionOrderId = 'MISSING-PRODUCTION-SOURCE'
    task.productionOrderNo = 'MISSING-PRODUCTION-SOURCE'
    await records.commitPcsRecords({ puts: [{ id: `higood-fcs-post-finishing-records/flow/qcTasks/${encodeURIComponent(task.qcTaskId)}`,
      collection: 'flow/qcTasks', value: task, expectedVersion: 0 }], deletes: [],
      operationId: 'POST-MISSING-SOURCE-TEST', intent: '缺失来源边界验收' })
  })
  await page.reload()
  await expect(page.locator('main h1')).toHaveText('质检清单')
  await expect(page.locator('main [data-object-type="QC_ORDER"],main [data-object-type="PRODUCTION_ORDER"]')).toHaveCount(0)
  await expect(page.locator('main')).toContainText('生产主线关联待补')
  await expect(page.locator('main')).toContainText('MISSING-PRODUCTION-SOURCE')
})

async function observeEntryBusinessWrites(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const writes: Array<{ database: string; store: string; method: string }> = []
    ;(window as any).__postEntryBusinessWrites = writes
    for (const method of ['add', 'put', 'delete', 'clear'] as const) {
      const original = IDBObjectStore.prototype[method]
      ;(IDBObjectStore.prototype as any)[method] = function (...args: unknown[]) {
        writes.push({ database: this.transaction.db.name, store: this.name, method })
        return (original as any).apply(this, args)
      }
    }
  })
}

test('后道仓库只读恢复PPIC来源，站内切换后保持部位票来源且不写业务记录', async ({ page }) => {
  await observeEntryBusinessWrites(page)
  const requests: string[] = []
  page.on('request', request => requests.push(request.url()))
  await page.goto('/fcs/craft/post-finishing/wait-handover-warehouse')
  await expect(page.locator('main h1')).toHaveText('后道待交出仓')
  expect(requests.some(url => url.includes('/src/data/fcs/cutting/part-ticket-records.ts'))).toBe(true)
  expect(await page.evaluate(() => (window as any).__postEntryBusinessWrites)).toEqual([])
  // 触发同一页面会话的原站内路由事件，验证一次性来源读取没有漏掉后续入口。
  await page.evaluate(() => {
    history.pushState({}, '', '/fcs/craft/post-finishing/work-orders')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await expect(page.locator('main h1')).toHaveText('后道加工单')
  expect(requests.some(url => url.includes('/src/data/fcs/cutting/part-ticket-records.ts'))).toBe(true)
  await expect(page.locator('main')).toContainText('PO-QC-202608-001-5-ZJ-HD')
  expect(await page.evaluate(() => (window as any).__postEntryBusinessWrites)).toEqual([])
})

test('执行质检只读恢复PPIC来源，打开生产关联入口保持当前任务', async ({ page }) => {
  await observeEntryBusinessWrites(page)
  const requests: string[] = []
  page.on('request', request => requests.push(request.url()))
  await page.goto('/fcs/craft/post-finishing/qc-workbench')
  await expect(page.locator('main h1')).toHaveText('执行质检')
  await expect(page.locator('[data-qc-workbench-task]')).toBeVisible()
  expect(requests.some(url => url.includes('/src/data/fcs/cutting/part-ticket-records.ts'))).toBe(true)
  expect(await page.evaluate(() => (window as any).__postEntryBusinessWrites)).toEqual([])
  const task = await page.locator('[data-qc-workbench-task]').getAttribute('data-qc-workbench-task')
  await page.locator('[data-production-object-action]').first().click()
  await expect.poll(() => requests.some(url => url.includes('/src/data/fcs/cutting/part-ticket-records.ts'))).toBe(true)
  await expect(page.locator('[data-production-object-surface="search"]')).toBeVisible()
  await expect(page.locator('[data-qc-workbench-task]')).toHaveAttribute('data-qc-workbench-task', task!)
  expect(await page.evaluate(() => (window as any).__postEntryBusinessWrites)).toEqual([])
})

test('后道命名页复用现有渲染器，其他生产入口按原方式读取', async ({ page }) => {
  const requests: string[] = []
  page.on('request', request => requests.push(request.url()))
  await page.goto('/fcs/craft/post-finishing/qc-workbench')
  await expect(page.locator('main h1')).toHaveText('执行质检')
  await expect(page.locator('[data-qc-workbench-task] > section').nth(1).locator('img')).toHaveCount(5)
  expect(requests.some(url => url.includes('/src/router/routes-fcs'))).toBe(false)
  await page.goto('/fcs/craft/post-finishing/wait-process-warehouse')
  await expect(page.locator('main h1')).toHaveText('后道待加工仓')
  expect(requests.some(url => url.includes('/src/router/routes-fcs'))).toBe(false)
  await page.goto('/fcs/craft/post-finishing/work-orders/%50F-POST-PF-ACCEPT-PO-1-5')
  await expect(page.locator('main h1')).toHaveText('后道加工单详情')
  await expect(page.locator('main')).toContainText('PO-QC-202608-001-5-ZJ-HD')
  expect(requests.some(url => url.includes('/src/router/routes-fcs'))).toBe(false)
  await page.goto('/fcs/production/orders')
  await expect(page.locator('main h1')).toHaveText('生产单管理')
  expect(requests.some(url => url.includes('/src/pages/production/orders-domain'))).toBe(true)
  for (const suffix of ['constructor', 'toString', '__proto__']) {
    await page.goto(`/fcs/craft/post-finishing/${suffix}`)
    await expect(page.locator('main h1')).toHaveText('页面未找到', { timeout: 5000 })
  }
})

test('质检清单按新编号查询并复位筛选', async ({ page }) => {
  await page.goto('/fcs/craft/post-finishing/qc-orders')
  await expect(page.locator('main h1')).toHaveText('质检清单')
  const filters = page.locator('form[action="/fcs/craft/post-finishing/qc-orders"]')
  await filters.locator('input[name="keyword"]').fill('NO-QC-MATCH-20261010')
  await filters.getByRole('button', { name: '查询', exact: true }).click()
  await expect(page).toHaveURL(/keyword=NO-QC-MATCH-20261010/, { timeout: 5000 })
  await expect(page.locator('main')).toContainText('暂无符合条件的质检单')
  await page.locator('form[action="/fcs/craft/post-finishing/qc-orders"] a[data-nav="/fcs/craft/post-finishing/qc-orders"]').click()
  await expect(page).toHaveURL(/\/qc-orders$/)
  await expect(page.locator('input[name="keyword"]')).toHaveValue('')
  await page.locator('input[name="keyword"]').fill('PO-QC-202608-001-4-ZJ')
  await page.locator('main').getByRole('button', { name: '查询', exact: true }).click()
  await expect(page).toHaveURL(/keyword=PO-QC-202608-001-4-ZJ/)
  await expect(page.locator('main tbody tr')).toHaveCount(1)
  await expect(page.locator('main tbody')).toContainText('PO-QC-202608-001-4-ZJ')
  for (const list of ['work-orders', 'outbound-orders', 'material-transfers']) {
    const path = `/fcs/craft/post-finishing/${list}`
    await page.goto(path)
    await expect(page.locator('main h1')).toBeVisible()
    const form = list === 'material-transfers' ? page.locator('form[data-post-material-query]') : page.locator(`form[action="${path}"]`)
    const beforeReset = await page.locator('main tbody').innerText()
    await form.locator('input[name="keyword"]').fill('NO-POST-MATCH-20261010')
    await form.getByRole('button', { name: '查询', exact: true }).click()
    await expect(page).toHaveURL(/keyword=NO-POST-MATCH-20261010/)
    await expect(page.locator('main tbody')).not.toContainText('PO-QC-')
    if (list === 'material-transfers') await form.getByRole('button', { name: '重置', exact: true }).click()
    else await page.locator(`form[action="${path}"] a[data-nav="${path}"]`).click()
    await expect(page).toHaveURL(new RegExp(`${list}$`))
    await expect(page.locator('input[name="keyword"]')).toHaveValue('')
    await expect.poll(() => page.locator('main tbody').innerText()).toBe(beforeReset)
  }
})

test('仓库弹层跟随关联单据后关闭，返回列表可继续操作', async ({ page }) => {
  const warehouse = '/fcs/craft/post-finishing/wait-process-warehouse'
  await page.goto(warehouse)
  await expect(page.locator('main h1')).toHaveText('后道待加工仓')
  await page.locator('[data-post-finishing-action="full-flow-open-stock"]').first().click()
  const drawer = page.locator('[data-warehouse-inventory-drawer]')
  await expect(drawer).toBeVisible()
  await drawer.locator('a[data-nav*="deliveryId="]').first().click()
  await expect(page.locator('[data-return-confirm-root]')).toBeVisible()
  await page.locator('button[data-nav="/fcs/craft/post-finishing/wait-process-warehouse?tab=returns"]').click()
  await expect(page).toHaveURL(/wait-process-warehouse\?tab=returns$/)
  await expect(page.locator('[data-return-confirm-root]')).toHaveCount(0)
  await expect(page.locator('[data-warehouse-inventory-drawer]')).toHaveCount(0, { timeout: 5000 })
  await page.locator('a[data-nav="/fcs/craft/post-finishing/wait-process-warehouse?tab=movements"]').click()
  await expect(page.getByRole('heading', { name: '流水记录', exact: true })).toBeVisible()
  await page.locator('a[data-nav="/fcs/craft/post-finishing/wait-process-warehouse?tab=materials"]').click()
  await expect(page).toHaveURL(/wait-process-warehouse\?tab=materials$/)
  await page.evaluate(async () => {
    const flow = await import((window as any).__postActualModuleUrl('/src/data/fcs/post-finishing-full-flow.ts'))
    const records = await import((window as any).__postActualModuleUrl('/src/data/fcs/post-finishing-records.ts'))
    await records.runPostFinishingCommand(() => flow.receivePostFinishingMaterialTransfer({
      transferOrderNo: flow.listPostFinishingMaterialTransferOrders()[0].transferOrderNo,
      actor: flow.POST_FINISHING_ACCEPTANCE_ACTORS.warehouseReceiver,
    }))
  })
  await page.reload()
  await page.locator('[data-post-finishing-action="full-flow-open-material-stock"]').first().click()
  await expect(page.locator('[data-material-stock-drawer]')).toBeVisible()
  await page.locator('[data-material-stock-drawer] a[data-nav]').click()
  await expect(page).toHaveURL(/material-transfers\?transferId=/)
  await page.evaluate((path) => { history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')) }, `${warehouse}?tab=materials`)
  await expect(page.locator('main h1')).toHaveText('后道待加工仓')
  await expect(page.locator('[data-material-stock-drawer]')).toHaveCount(0)
  await page.goto('/fcs/craft/post-finishing/wait-handover-warehouse')
  await expect(page.locator('main h1')).toHaveText('后道待交出仓')
  await page.locator('[data-post-finishing-action="full-flow-open-stock"]').first().click()
  await expect(drawer).toBeVisible()
  await drawer.locator('a[data-nav*="outbound-orders"]').first().click()
  await expect(page.locator('main h1')).toHaveText('后道出货单详情')
  await page.evaluate(() => { history.pushState({}, '', '/fcs/craft/post-finishing/wait-handover-warehouse'); window.dispatchEvent(new PopStateEvent('popstate')) })
  await expect(page.locator('main h1')).toHaveText('后道待交出仓')
  await expect(drawer).toHaveCount(0)
})

import { expect, test, type Page, type TestInfo } from '@playwright/test'
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
  recheckOrderNo: string
  recheckOrderId: string
  recheckBarcodes: Array<{ skuId: string; barcode: string }>
  outboundOrderNo: string
  outboundOrderId: string
  outboundRecheckId: string
  outboundSkuId: string
  authorizedOutboundNo: string
}

const PDA_SESSION = {
  userId: 'F090_operator',
  loginId: 'F090_operator',
  userName: '全能力测试工厂_操作工',
  roleId: 'ROLE_OPERATOR',
  factoryId: 'F090',
  factoryName: '全能力测试工厂',
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
  return page.evaluate(async () => {
    const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
    const spuTechnical = await import('/src/data/fcs/post-finishing-spu-technical-parameters.ts')
    flow.resetPostFinishingFullFlow()
    spuTechnical.resetPostFinishingSpuTechnicalParameters()
    flow.setPostFinishingDemoBootstrapEnabled(false)
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
      return flow.completePostFinishingQcTask({
        qcTaskId: qc.qcTaskId,
        actor: actors.qcA,
        results: qc.lines.map((line) => ({ skuId: line.sku.skuId, passedQty: line.expectedQty, defectQty: 0, returnQty: 0 })),
        needPostFinishing: true,
        nowMs: nextTime(),
      })
    }
    const completePost = (postTaskNo: string) => {
      const started = flow.startPostFinishingPostTask({ postTaskNo, actor: actors.postOperator, nowMs: nextTime() })
      return flow.completePostFinishingPostTask({
        postTaskId: started.postTaskId,
        actor: actors.postOperator,
        results: started.lines.map((line) => ({ skuId: line.sku.skuId, passedQty: line.expectedQty, defectQty: 0, returnQty: 0 })),
        nowMs: nextTime(),
      })
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
    const thirdPost = completePost(thirdQc.postTaskNo!)
    const recheck = flow.getPostFinishingFullFlowRecheckOrder(thirdPost.recheckOrderNo!)!

    const fourth = confirmAndSend(4)
    const fourthQc = completeQc(fourth.qc)
    const fourthPost = completePost(fourthQc.postTaskNo!)
    let outboundRecheck = flow.claimPostFinishingRecheckOrder({ recheckOrderNo: fourthPost.recheckOrderNo!, actor: actors.recheckerA, nowMs: nextTime() })
    for (const line of outboundRecheck.lines) {
      outboundRecheck = flow.scanPostFinishingRecheckSkuBarcode({
        recheckOrderId: outboundRecheck.recheckOrderId,
        skuId: line.sku.skuId,
        scannedBarcode: line.sku.barcode,
        actor: actors.recheckerA,
        nowMs: nextTime(),
      })
    }
    outboundRecheck = flow.completePostFinishingRecheckOrderFullFlow({
      recheckOrderId: outboundRecheck.recheckOrderId,
      actor: actors.recheckerA,
      results: outboundRecheck.lines.map((line) => ({ skuId: line.sku.skuId, passedQty: line.expectedQty, defectQty: 0 })),
      nowMs: nextTime(),
    })
    const outbound = flow.getPostFinishingFullFlowOutboundOrder(outboundRecheck.outboundOrderNo!)!

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
    flow.claimPostFinishingQcTask({ qcTaskNo: auditQc.qcTaskNo, actor: actors.qcA, nowMs: nextTime() })
    const auditQcDone = flow.completePostFinishingQcTask({
      qcTaskId: auditQc.qcTaskId,
      actor: actors.qcA,
      results: auditQc.lines.map((line) => ({ skuId: line.sku.skuId, passedQty: line.expectedQty, defectQty: 0, returnQty: 0 })),
      needPostFinishing: true,
      nowMs: nextTime(),
    })
    const auditPostDone = completePost(auditQcDone.postTaskNo!)
    let auditRecheck = flow.claimPostFinishingRecheckOrder({ recheckOrderNo: auditPostDone.recheckOrderNo!, actor: actors.recheckerA, nowMs: nextTime() })
    for (const line of auditRecheck.lines) {
      auditRecheck = flow.scanPostFinishingRecheckSkuBarcode({
        recheckOrderId: auditRecheck.recheckOrderId,
        skuId: line.sku.skuId,
        scannedBarcode: line.sku.barcode,
        actor: actors.recheckerA,
        nowMs: nextTime(),
      })
    }
    auditRecheck = flow.completePostFinishingRecheckOrderFullFlow({
      recheckOrderId: auditRecheck.recheckOrderId,
      actor: actors.recheckerA,
      results: auditRecheck.lines.map((line) => ({ skuId: line.sku.skuId, passedQty: line.expectedQty, defectQty: 0 })),
      nowMs: nextTime(),
    })
    const auditOutbound = flow.getPostFinishingFullFlowOutboundOrder(auditRecheck.outboundOrderNo!)!
    const authorizationModule = await import('/src/data/fcs/post-finishing-authorization.ts')
    const authorizationNow = nextTime()
    const authorizationDisplay = authorizationModule.getPostFinishingAuthorizationDisplay('AUTH-WH-001', authorizationNow)
    flow.receivePostFinishingOutboundOrder({
      outboundOrderNo: auditOutbound.outboundOrderNo,
      actor: actors.warehouseReceiver,
      receivedQuantities: auditOutbound.lines.map((line, index) => ({ skuId: line.sku.skuId, receivedQty: line.outboundQty - (index === 0 ? 1 : 0) })),
      authorization: { scanValue: authorizationDisplay.scanPayload, differenceReason: '浏览器审计少 1 件', nowMs: authorizationNow },
      nowMs: authorizationNow,
    })

    const pending = register(5)
    return {
      returnScan: flow.getPostFinishingReturnSourceScanValue(flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[1].productionOrderNo, 1),
      pendingDeliveryNo: pending.deliveryOrderNo,
      pendingDeliveryId: pending.deliveryId,
      qcTaskNo: first.qc.qcTaskNo,
      qcDeliveryId: first.delivery.deliveryId,
      postTaskNo: post.postTaskNo,
      postTaskId: post.postTaskId,
      recheckOrderNo: recheck.recheckOrderNo,
      recheckOrderId: recheck.recheckOrderId,
      recheckBarcodes: recheck.lines.map((line) => ({ skuId: line.sku.skuId, barcode: line.sku.barcode })),
      outboundOrderNo: outbound.outboundOrderNo,
      outboundOrderId: outbound.outboundOrderId,
      outboundRecheckId: outbound.recheckOrderId,
      outboundSkuId: outbound.lines[0].sku.skuId,
      authorizedOutboundNo: auditOutbound.outboundOrderNo,
    }
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

test('默认演示数据在 Web 端真实展示 3 个生产单、15 次回货和分阶段库存', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/fcs/craft/post-finishing/tasks')
  await expect(page.getByRole('heading', { name: '后道生产任务', exact: true })).toBeVisible()
  await expect(page.locator('tbody tr')).toHaveCount(3)
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
  for (let sequence = 1; sequence <= 4; sequence += 1) {
    await expect(qcDialog).toContainText(`PO-QC-202608-001-${sequence}`)
  }
  await expect(qcDialog).toContainText('不允许人工修改')
  await attachPageEvidence(page, testInfo, 'post-production-task-qc-dialog')
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.getByRole('button', { name: '回货记录（5）' })).toHaveCount(3)
  await expect(page.getByText('3 个', { exact: true })).toBeVisible()
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
  await expect(page.locator('[data-warehouse-sku-row]')).toHaveCount(5)
  await attachPageEvidence(page, testInfo, 'default-demo-wait-handover-inventory')

  await setCurrentWebActor(page, 'PF-USER-QC-MGR')
  await page.goto('/fcs/craft/post-finishing/qc-orders')
  await expect(page.locator('tbody tr')).toHaveCount(12)
  await page.goto('/fcs/craft/post-finishing/audit-records')
  await expect(page.locator('body')).toContainText('业务链（每次回货一条）')
  await expect(page.locator('body')).toContainText('15')
})

test('Web 质检精确领取、原因汇总、返工工厂与 SPU 技术参数闭环', async ({ page }, testInfo) => {
  const seed = await seedBrowserFlow(page)
  await setCurrentWebActor(page, 'PF-USER-QC-A')
  await page.goto('/fcs/craft/post-finishing/qc-orders')
  const createSpuTechnical = page.getByRole('button', { name: '新增 SPU 技术参数' })
  await expect(createSpuTechnical).toBeVisible()
  await createSpuTechnical.click()
  let spuDialog = page.getByRole('dialog', { name: '维护 SPU 技术参数' })
  await expect(spuDialog.locator('[data-spu-tech-field="spuCode"]')).toHaveValue('')
  await spuDialog.locator('[data-spu-tech-field="spuCode"]').fill('SPU-QC-003')
  await expect(spuDialog.locator('[data-spu-tech-form]')).toHaveAttribute('data-spu-code', 'SPU-QC-003')
  await expect(spuDialog).toContainText('后道验收外套')
  await attachPageEvidence(page, testInfo, 'web-qc-spu-technical-search-dialog')
  await spuDialog.getByRole('button', { name: '关闭' }).click()
  await expect(spuDialog).toHaveCount(0)
  await expect(page.locator('[data-spu-code="SPU-QC-001"]').first()).toContainText('已维护')
  const unmaintainedSpu = page.locator('[data-post-finishing-action="open-spu-tech-params"][data-spu-code="SPU-QC-002"]').first()
  await expect(unmaintainedSpu).toContainText('未维护')
  await unmaintainedSpu.click()
  spuDialog = page.getByRole('dialog', { name: '维护 SPU 技术参数' })
  await expect(spuDialog).toBeVisible()
  await expect(spuDialog.locator('[data-spu-tech-field="spuCode"]')).toHaveValue('SPU-QC-002')
  await expect(spuDialog).toContainText('后道验收连衣裙')
  await expect(spuDialog.locator('[data-spu-size-row]')).toHaveCount(5)
  await attachPageEvidence(page, testInfo, 'web-qc-spu-technical-prefilled-dialog')
  await spuDialog.locator('[data-spu-size-row]').first().scrollIntoViewIfNeeded()
  await attachPageEvidence(page, testInfo, 'web-qc-spu-technical-size-rows')
  await spuDialog.locator('[data-spu-tech-file="colorReference"]').setInputFiles('public/materials/fabric-contrast.jpg')
  await spuDialog.getByRole('button', { name: '保存 SPU 技术参数' }).click()
  await expect(spuDialog).toHaveCount(0)
  await expect(page.locator('[data-spu-code="SPU-QC-002"]').first()).toContainText('已维护')
  await attachPageEvidence(page, testInfo, 'web-qc-order-spu-technical-status')

  await page.getByRole('button', { name: '领取质检单' }).click()
  const taskInput = page.locator('[data-qc-task-input]')
  await taskInput.fill(seed.qcTaskNo)
  await page.getByRole('button', { name: '确认领取' }).click()
  await expect(page).toHaveURL(new RegExp(`taskNo=${encodeURIComponent(seed.qcTaskNo)}`))
  await expect(page.locator('[data-qc-result-line]')).toHaveCount(5)
  await expect(page.locator('[data-qc-spu-technical-parameters]')).toBeVisible()
  await expect(page.locator('[data-qc-spu-technical-parameters]')).toContainText('颜色对照图、各尺码尺寸')
  await expect(page.locator('[data-qc-spu-technical-parameters]')).toContainText('SPU-QC-001')
  await expect(page.locator('[data-qc-result-file="defectImage"]')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('瑕疵证据')
  await expect(page.locator('body')).not.toContainText('次品')
  await expectImagesLoaded(page)

  const firstLine = page.locator('[data-qc-result-line]').first()
  const firstPassed = firstLine.locator('[data-qc-result-field="passedQty"]')
  const defectTotal = firstLine.locator('[data-qc-result-field="defectQty"]')
  const colorDifference = firstLine.locator('[data-qc-defect-reason="色差"]')
  await expect(defectTotal).toHaveAttribute('readonly', '')
  const authorizationBlock = page.locator('[data-qc-difference-authorization]')
  await expect(authorizationBlock).toBeHidden()
  await firstPassed.fill('19')
  await expect(page.locator('[data-qc-live-summary]')).toContainText('1 个 SKU 有差异')
  await expect(page.locator('[data-qc-live-summary]')).toContainText('整单差异 -1 件')
  await expect(authorizationBlock).toBeVisible()
  await colorDifference.fill('1')
  await expect(defectTotal).toHaveValue('1')
  await expect(page.locator('[data-qc-live-summary]')).toContainText('0 个 SKU 有差异')
  await expect(authorizationBlock).toBeHidden()
  await colorDifference.fill('2')
  await expect(defectTotal).toHaveValue('2')
  await expect(authorizationBlock).toBeVisible()
  await colorDifference.fill('0')
  await firstPassed.fill('20')
  await expect(defectTotal).toHaveValue('0')
  await expect(authorizationBlock).toBeHidden()

  const reworkQty = firstLine.locator('[data-qc-result-field="returnQty"]')
  const reworkBlock = firstLine.locator('[data-qc-rework-factory-block]')
  const reworkFactory = firstLine.locator('[data-qc-result-field="returnReceiver"]')
  await expect(reworkBlock).toBeHidden()
  await expect(reworkFactory).toBeDisabled()
  await reworkQty.fill('1')
  await expect(reworkBlock).toBeVisible()
  await expect(reworkFactory).toBeEnabled()
  await reworkFactory.fill('CV Micro Sewing Jakarta Pusat')
  await expect(authorizationBlock).toBeVisible()
  await attachPageEvidence(page, testInfo, 'web-qc-two-column-rework-and-spu-parameters')
  await reworkQty.fill('0')
  await expect(reworkBlock).toBeHidden()
  await expect(reworkFactory).toBeDisabled()
  await expect(authorizationBlock).toBeHidden()

  await page.locator('[data-qc-spu-technical-parameters] [data-post-finishing-action="full-flow-zoom-image"]').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await setCurrentWebActor(page, 'PF-USER-QC-B')
  await page.goto('/fcs/craft/post-finishing/qc-orders')
  await page.getByRole('button', { name: '领取质检单' }).click()
  await page.locator('[data-qc-task-input]').fill(seed.qcTaskNo)
  await page.getByRole('button', { name: '确认领取' }).click()
  await expect(page.getByRole('status')).toContainText('已由 李质检员 质检中')

  await setCurrentWebActor(page, 'PF-USER-QC-A')
  await page.goto(`/fcs/craft/post-finishing/qc-workbench?taskNo=${encodeURIComponent(seed.qcTaskNo)}`)
  await page.getByRole('button', { name: '错误领取，退回待质检' }).click()
  await expect(page.locator('[data-qc-release-confirm]')).toBeVisible()
  await page.locator('[data-qc-release-reason]').fill('扫描错了生产批次')
  await attachPageEvidence(page, testInfo, 'web-qc-release-confirmation')
  await page.getByRole('button', { name: '确认退领' }).click()
  await expect(page.getByRole('status')).toContainText('已退回待质检')
  await expect(page.locator('body')).toContainText('待质检')
})

test('公共 PDA 回货登记即时阻断 0，并展示 5 个 SKU 与真实图片', async ({ page }, testInfo) => {
  const seed = await seedBrowserFlow(page)
  await page.setViewportSize({ width: 360, height: 800 })
  await setSession(page)
  await page.goto('/fcs/pda/handover/sewing-self-return')
  await page.locator('[data-pda-sewing-self-return-field="scanValue"]').fill(seed.returnScan)
  await page.locator('[data-pda-sewing-self-return-field="scanValue"]').press('Enter')
  await expect(page.locator('[data-return-sku-card]')).toHaveCount(5)
  await expect(page.locator('body')).toContainText('车缝任务')
  await expect(page.locator('body')).toContainText('暂存')
  await expect(page.locator('body')).toContainText('生产计划')
  await expect(page.getByRole('button', { name: '管理员退出' })).toBeVisible()
  await expectImagesLoaded(page)
  const quantities = page.locator('[data-pda-sewing-self-return-field="quantity"]')
  await quantities.first().fill('0')
  await expect(page.locator('[data-return-quantity-error]')).toContainText('必须大于 0')
  await expect(quantities.first()).toHaveAttribute('aria-invalid', 'true')
  for (let index = 0; index < 5; index += 1) await quantities.nth(index).fill('20')
  await page.locator('[data-pda-sewing-self-return-field="deliveryPersonName"]').fill('苏车缝送货员')
  await page.locator('[data-pda-sewing-self-return-field="deliveryPersonPhone"]').fill('0812888888')
  await page.getByRole('button', { name: '加载原型验收凭证' }).click()
  await attachPageEvidence(page, testInfo, 'public-pda-return-registration')
  await page.getByRole('button', { name: '提交本次回货登记' }).click()
  await expect(page.getByRole('status')).toContainText('登记成功')
  await verifyPdaAtBothSizes(page)
  await page.getByRole('button', { name: '管理员退出' }).click()
  await expect(page).toHaveURL(/\/fcs\/pda\/handover\?tab=pickup/)
})

test('旧车缝自助回货接收入口不可再绕过 5%复点授权规则', async ({ page }) => {
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
  const legacy = await page.evaluate(async () => {
    const domain = await import('/src/data/fcs/post-finishing-domain.ts')
    const handover = await import('/src/data/fcs/pda-handover-events.ts')
    domain.resetPostFinishingSewingSelfReturnDemoRecords()
    const records = domain.ensurePostFinishingSewingSelfReturnMockRecords()
    handover.syncAllPostFinishingSewingSelfReturnHandoverRecords()
    return { recordNo: records[0].recordNo }
  })

  await page.goto('/fcs/pda/handover?tab=pickup')
  await expect(page.locator('body')).not.toContainText(legacy.recordNo)

  await page.goto('/fcs/pda/warehouse/wait-process')
  await expect(page.locator('body')).toContainText(legacy.recordNo)
  await expect(page.locator('[data-nav="/fcs/pda/post-finishing/return-confirm"]').filter({ hasText: '扫描送货单确认回货' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: '确认入库', exact: true })).toHaveCount(0)
})

test('PDA 回货确认执行超 5%二次点数、授权和真实账号记录', async ({ page }, testInfo) => {
  const seed = await seedBrowserFlow(page)
  await page.setViewportSize({ width: 400, height: 806 })
  await setSession(page)
  await page.goto('/fcs/pda/post-finishing/return-confirm')
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
    const auth = await import('/src/data/fcs/post-finishing-authorization.ts')
    return auth.getPostFinishingAuthorizationDisplay('AUTH-QC-001').scanPayload
  })
  await page.locator('[data-return-difference-reason]').fill('复点后仍少 2 件')
  await page.locator('[data-return-authorization]').fill(authorization)
  await attachPageEvidence(page, testInfo, 'pda-return-confirm-authorization')
  await page.getByRole('button', { name: '授权并确认回货' }).click()
  await expect(page.getByRole('status')).toContainText('回货确认成功')
  await expect(page.locator('body')).toContainText('回货已由 全能力测试工厂_操作工 确认')
  await verifyPdaAtBothSizes(page)
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto(`/fcs/craft/post-finishing/wait-process-warehouse?tab=returns&deliveryId=${encodeURIComponent(seed.pendingDeliveryId)}`)
  await expect(page.getByRole('heading', { name: 'SPU 技术参数在质检单统一维护' })).toBeVisible()
  await expect(page.locator('[data-qc-reference-file]')).toHaveCount(0)
  await expect(page.getByRole('link', { name: '前往质检单维护' })).toBeVisible()
  await page.getByRole('button', { name: '确认送检出库' }).click()
  await expect(page.getByRole('status')).toContainText('送检成功')
  await expect(page.locator('[data-nav*="print?type=SEND_QC"]')).toBeVisible()
})

test('PDA 后道扫码先核对，再逐 SKU 填写完成数量并按原因调整瑕疵', async ({ page }, testInfo) => {
  const seed = await seedBrowserFlow(page)
  await page.setViewportSize({ width: 360, height: 800 })
  await setSession(page)
  await page.goto('/fcs/pda/post-finishing/execute')
  await page.locator('[data-pda-post-field="postScan"]').fill(seed.postTaskNo)
  await page.locator('[data-pda-post-field="postScan"]').press('Enter')
  await expect(page.locator('[data-post-completion-line]')).toHaveCount(5)
  await expect(page.getByRole('button', { name: '核对无误，开始后道' })).toBeVisible()
  await expect(page.locator('[data-post-completed-qty]')).toHaveCount(5)
  await expect(page.locator('[data-post-completed-qty]').first()).toBeDisabled()
  await expect(page.locator('[data-pda-post-action="toggle-process-item"]')).toHaveCount(0)
  await expectImagesLoaded(page)
  await page.locator('[data-pda-post-action="zoom-image"]').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '核对无误，开始后道' }).click()
  await expect(page.getByText('0 / 5 个 SKU', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '还有 5 个 SKU 未完成数量归类' })).toBeDisabled()
  await expect(page.getByText('调整瑕疵')).toHaveCount(5)
  await page.locator('[data-post-completion-line]').first().getByText('调整瑕疵').click()
  await expect(page.getByRole('heading', { name: '调整瑕疵数量' })).toBeVisible()
  await expect(page.getByText('完成数量未填写')).toBeVisible()
  await expect(page.getByRole('heading', { name: '调整瑕疵', exact: true })).toBeVisible()
  await expect(page.locator('[data-post-defect-reason-qty]')).not.toHaveCount(0)
  await page.getByText('← 返回后道加工单').click()
  for (let completed = 1; completed <= 5; completed += 1) {
    const pendingLine = page.locator('[data-post-completion-line]').filter({ has: page.locator('[data-post-completed-qty][value=""]') }).first()
    const quantity = pendingLine.locator('[data-post-completed-qty]')
    await quantity.fill(await quantity.getAttribute('max') || '0')
    await pendingLine.getByRole('button', { name: '保存' }).click()
    await expect(page.getByText(`${completed} / 5 个 SKU`, { exact: true })).toBeVisible()
  }
  await expect(page.getByText('调整瑕疵')).toHaveCount(5)

  await page.locator('[data-post-completion-line]').first().getByText('调整瑕疵').click()
  await expect(page.getByRole('heading', { name: '调整瑕疵数量' })).toBeVisible()
  await expect(page.locator('[data-post-adjust-file="defectImage"]')).toHaveCount(0)
  await expect(page.locator('[data-post-adjust-field="responsibleParty"]')).toHaveCount(0)
  await page.getByLabel('减少瑕疵').check()
  await page.locator('[data-post-defect-reason-qty][data-reason="压痕"]').fill('1')
  await page.getByRole('button', { name: '保存并返回后道加工单' }).click()
  await expect(page.getByRole('status')).toContainText('当前只有 0 件，不能减少 1 件')
  await page.getByLabel('增加瑕疵').check()
  await page.locator('[data-post-defect-reason-qty][data-reason="压痕"]').fill('1')
  await page.getByRole('button', { name: '保存并返回后道加工单' }).click()
  await expect(page.locator('[data-post-completion-line]').first()).toContainText('瑕疵 1 件')

  await page.locator('[data-post-completion-line]').first().getByText('调整瑕疵').click()
  await page.getByText('返厂处理（没有可不填）').click()
  await page.locator('[data-post-adjust-field="returnQty"]').fill('1')
  await page.locator('[data-post-adjust-field="returnReason"]').fill('返来源工厂复修')
  await page.getByText('接收对象：请选择').click()
  await page.locator('[data-return-receiver-search]').fill('车缝')
  const receiverOption = page.locator('[data-return-receiver-value]:not(.hidden)').first()
  await expect(receiverOption).toBeVisible()
  await receiverOption.click()
  await expect(page.locator('[data-return-receiver-label]')).not.toHaveText('请选择')
  await page.getByRole('button', { name: '保存并返回后道加工单' }).click()
  await expect(page.locator('[data-post-completion-line]').first()).toContainText('返厂 1 件')
  await expect(page.getByRole('button', { name: '完成后道并生成复检单' })).toBeEnabled()
  await attachPageEvidence(page, testInfo, 'pda-post-finishing-execution')
  await page.getByRole('button', { name: '完成后道并生成复检单' }).click()
  await expect(page.getByRole('status')).toContainText('后道完成，复检单')
  await verifyPdaAtBothSizes(page)
})

test('PDA 后道允许先登记整批瑕疵，完成数量未填时按零合格完成', async ({ page }) => {
  const seed = await seedBrowserFlow(page)
  await page.setViewportSize({ width: 360, height: 800 })
  await setSession(page)
  await page.goto(`/fcs/pda/post-finishing/execute?id=${encodeURIComponent(seed.postTaskNo)}`)
  await page.getByRole('button', { name: '核对无误，开始后道' }).click()

  const firstLine = page.locator('[data-post-completion-line]').first()
  await firstLine.getByText('调整瑕疵').click()
  const fullDefectQuantity = await page.locator('[data-post-defect-reason-qty][data-reason="脏污"]').getAttribute('max') || '0'
  await page.locator('[data-post-defect-reason-qty][data-reason="脏污"]').fill(fullDefectQuantity)
  await page.getByRole('button', { name: '保存并返回后道加工单' }).click()
  await expect(page.locator('[data-post-completion-line]').first()).toContainText(`瑕疵 ${fullDefectQuantity} 件`)
  await expect(page.locator('[data-post-completion-line]').first()).toContainText('整批已归为瑕疵或返厂 · 合格 0 件')
  await expect(page.getByText('1 / 5 个 SKU', { exact: true })).toBeVisible()

  for (let completed = 2; completed <= 5; completed += 1) {
    const pendingLine = page.locator('[data-post-completion-line]').filter({ has: page.locator('[data-post-completed-qty][value=""]') }).nth(1)
    const quantity = pendingLine.locator('[data-post-completed-qty]')
    await quantity.fill(await quantity.getAttribute('max') || '0')
    await pendingLine.getByRole('button', { name: '保存' }).click()
    await expect(page.getByText(`${completed} / 5 个 SKU`, { exact: true })).toBeVisible()
  }

  await expect(page.getByRole('button', { name: '完成后道并生成复检单' })).toBeEnabled()
  await page.getByRole('button', { name: '完成后道并生成复检单' }).click()
  await expect(page.getByRole('status')).toContainText('后道完成，复检单')
  await expect(page.locator('[data-post-completion-line]').first()).toContainText(`完成 ${fullDefectQuantity} 件 · 合格 0 件`)
})

test('Web 后道加工单未填完成数量时也可直接调整瑕疵', async ({ page }) => {
  const seed = await seedBrowserFlow(page)
  await setSession(page)
  await page.goto(`/fcs/pda/post-finishing/execute?id=${encodeURIComponent(seed.postTaskNo)}`)
  await page.getByRole('button', { name: '核对无误，开始后道' }).click()
  await expect(page.getByRole('button', { name: '核对无误，开始后道' })).toHaveCount(0)
  await expect(page.getByText('0 / 5 个 SKU', { exact: true })).toBeVisible()

  await page.setViewportSize({ width: 1366, height: 768 })
  await setCurrentWebActor(page, 'PF-USER-POST')
  await page.goto(`/fcs/craft/post-finishing/work-orders/${encodeURIComponent(seed.postTaskNo)}`)
  await page.locator('[data-web-post-takeover-reason]').fill('PDA故障，转Web继续')
  await page.getByRole('button', { name: '确认接管' }).click()
  await expect(page.getByRole('status')).toContainText('后道加工单接管成功')
  const firstLine = page.locator('[data-web-post-completion-line]').first()
  await firstLine.getByRole('button', { name: '调整瑕疵' }).click()
  await expect(page.getByText('完成数量未填写')).toBeVisible()
  await expect(page.locator('[data-web-post-defect-reason-qty]')).not.toHaveCount(0)
  await page.locator('[data-web-post-defect-reason-qty][data-reason="脏污"]').fill('1')
  await page.getByRole('button', { name: '保存并返回后道加工单' }).click()
  await expect(page.getByRole('status')).toContainText('SKU 瑕疵原因数量与返厂信息已保存')
  await expect(page.locator('[data-web-post-completion-line]').first()).toContainText('瑕疵 1 / 返厂 0')
})

test('Web 复检精确领取、退领清空、错码阻断、重贴复核并唯一生成出货单', async ({ page }, testInfo) => {
  const seed = await seedBrowserFlow(page)
  await page.setViewportSize({ width: 1366, height: 768 })
  await setCurrentWebActor(page, 'PF-USER-RC-A')
  await page.goto('/fcs/craft/post-finishing/recheck-orders')
  await page.getByRole('button', { name: '领取复检单' }).click()
  await page.locator('[data-recheck-claim-task-no]').fill(seed.recheckOrderNo)
  await page.getByRole('button', { name: '确认领取' }).click()
  await expect(page).toHaveURL(new RegExp(`id=${encodeURIComponent(seed.recheckOrderId)}`))
  await expect(page.locator('[data-recheck-result-line]')).toHaveCount(5)
  await expect(page.locator('[data-recheck-authorization]')).toBeHidden()
  await expectImagesLoaded(page)
  const firstPassed = page.locator('[data-recheck-result-line]').first().locator('[data-recheck-result-field="passedQty"]')
  await firstPassed.fill('19')
  await expect(page.locator('[data-recheck-authorization]')).toBeVisible()
  await firstPassed.fill('20')
  await expect(page.locator('[data-recheck-authorization]')).toBeHidden()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '退领复检单' }).click()
  await expect(page.getByRole('status')).toContainText('已退回待复检，复检数据已清空')
  await page.goto('/fcs/craft/post-finishing/recheck-orders')
  await page.getByRole('button', { name: '领取复检单' }).click()
  await page.locator('[data-recheck-claim-task-no]').fill(seed.recheckOrderNo)
  await page.getByRole('button', { name: '确认领取' }).click()

  const firstLine = page.locator('[data-recheck-result-line]').first()
  await firstLine.locator('[data-recheck-result-field="barcodeCorrect"]').selectOption('no')
  for (let index = 1; index < seed.recheckBarcodes.length; index += 1) {
    await page.locator('[data-recheck-result-line]').nth(index).locator('[data-recheck-result-field="barcodeCorrect"]').selectOption('yes')
  }
  await page.getByRole('button', { name: '提交复检并生成后道出货单' }).click()
  await expect(page.getByRole('status')).toContainText('条码错误，已阻断出货')
  await expect(page.getByRole('button', { name: '已重新贴码' })).toBeVisible()
  await page.getByRole('button', { name: '已重新贴码' }).click()
  await expect(page.locator('body')).toContainText('已重贴待复扫')
  await attachPageEvidence(page, testInfo, 'web-recheck-relabel-block')

  for (let index = 0; index < seed.recheckBarcodes.length; index += 1) {
    const line = page.locator('[data-recheck-result-line]').nth(index)
    await line.locator('[data-recheck-result-field="barcodeCorrect"]').selectOption('yes')
  }
  await expect(page.locator('body')).not.toContainText('错误待重贴')
  await page.getByRole('button', { name: '提交复检并生成后道出货单' }).click()
  await expect(page.getByRole('status')).toContainText('复检完成，已自动生成后道出货单 FCK-')
  await expect(page.locator('body')).toContainText('唯一后道出货单')
})

test('后道工厂 PDA 删除成衣仓收货入口，出货单只保留业务条码', async ({ page }) => {
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
    '/fcs/craft/post-finishing/recheck-orders',
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
    '/fcs/craft/post-finishing/recheck-orders',
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
  await expect(page.getByText('打印质检单详情', { exact: true }).first()).toBeVisible()
  await expect(page.locator('[data-authorization-code]')).toHaveCount(0)

  await page.goto('/fcs/craft/post-finishing/statistics')
  await page.getByRole('button', { name: '打印质检单', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '打印质检单' })).toBeVisible()
  await page.locator('[data-qc-print-task-no]').fill(seed.qcTaskNo.slice(0, -1))
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('dialog', { name: '打印质检单' }).getByRole('button', { name: '打印质检单', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '打印质检单' })).toBeVisible()
  await page.locator('[data-qc-print-task-no]').fill(seed.qcTaskNo)
  await page.getByRole('dialog', { name: '打印质检单' }).getByRole('button', { name: '打印质检单', exact: true }).click()
  await expect(page.locator('[data-testid="post-finishing-qc-master-print"]')).toBeVisible()
  await expect(page.locator('[data-print-document-no]')).toHaveAttribute('data-print-document-no', seed.qcTaskNo)

  await page.goto('/fcs/craft/post-finishing/statistics')
  await page.getByRole('button', { name: '打印质检单详情', exact: true }).click()
  await page.locator('[data-qc-print-task-no]').fill(seed.qcTaskNo)
  await page.getByRole('dialog', { name: '打印质检单详情' }).getByRole('button', { name: '打印质检单详情', exact: true }).click()
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
  await page.getByRole('link', { name: '差异与瑕疵' }).click()
  await expect(page.getByRole('heading', { name: '逐 SKU 数量差异' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '瑕疵记录' })).toBeVisible()
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
  await expect(page.locator('body')).toContainText('复检单')

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
      await expect(page.locator('body')).toContainText('出库仓')
      await expect(page.locator('body')).toContainText('接收仓')
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
    const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
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

  await page.goto(`/fcs/craft/post-finishing/print?type=SKU_LABEL&id=${encodeURIComponent(seed.outboundRecheckId)}&skuId=${encodeURIComponent(seed.outboundSkuId)}`)
  await expect(page.locator('[data-testid="post-finishing-sku-label-print"]')).toBeVisible()
  await expect(page.locator('[data-sku-label-barcode]')).toBeVisible()
  await expect(page.getByRole('button', { name: '打印 40×30 SKU 贴标' })).toBeVisible()
  const labelSize = await page.locator('[data-testid="post-finishing-sku-label-print"] > div').first().evaluate((node) => {
    const rect = node.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  })
  expect(labelSize.width).toBeGreaterThan(140)
  expect(labelSize.width).toBeLessThan(165)
  expect(labelSize.height).toBeGreaterThan(105)
  expect(labelSize.height).toBeLessThan(125)
})

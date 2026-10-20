import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { createHash } from 'node:crypto'

async function noOverflow(page: Page, label: string): Promise<void> {
  const result = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
  expect(result.scroll, `${label}: ${JSON.stringify(result)}`).toBeLessThanOrEqual(result.width + 1)
  console.log(`[consumer-layout] ${label} ${JSON.stringify(result)}`)
}
async function evidence(page: Page, info: TestInfo, label: string): Promise<void> {
  const path = info.outputPath(`${label}.png`)
  const image = await page.screenshot({ path, fullPage: true })
  await info.attach(label, { path, contentType: 'image/png' })
  console.log(`[consumer-evidence] ${label} sha256=${createHash('sha256').update(image).digest('hex')} url=${page.url()} path=${path}`)
}
async function session(page: Page, factoryId: string, factoryName: string): Promise<void> {
  await page.goto('/fcs/pda/auth/login')
  await page.evaluate(({ factoryId, factoryName }) => localStorage.setItem('fcs_pda_session', JSON.stringify({ userId: `${factoryId}_operator`, loginId: `${factoryId}_operator`, userName: `${factoryName}_操作工`, roleId: 'ROLE_OPERATOR', factoryId, factoryName, loggedAt: '2026-10-14 15:00:00' })), { factoryId, factoryName })
}
const pageErrors = new WeakMap<Page, string[]>()
test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  pageErrors.set(page, errors)
  page.on('pageerror', error => { errors.push(error.message); console.log('[consumer-pageerror]', error.message) })
  await page.clock.install({ time: new Date('2026-10-14T08:00:00Z') })
})
test.afterEach(async ({ page }) => { expect(pageErrors.get(page)).toEqual([]) })

test('回货跟进在管理分辨率显示两节点，真实图、大图Esc与失败态可辨认', async ({ page }, info) => {
  for (const width of [1366, 1280]) {
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 720 })
    await page.goto('/fcs/sewing-outsourcing/returns')
    await expect(page.getByRole('heading', { name: '回货跟进', exact: true })).toBeVisible()
    await expect(page.locator('thead')).toContainText('35%／100%')
    await expect(page.locator('[data-ppic-return-track-page]')).not.toContainText('70%')
    await page.locator('[data-ppic-return-track-action="switch-tab:POST_FINISHING_PENDING"]').click()
    await noOverflow(page, `returns-${width}`)
  }
  const imageButton = page.locator('[data-ppic-return-track-action="preview-image"]').first(), image = imageButton.locator('img')
  console.log('[consumer-image-diagnostic]', await image.evaluate(node => ({src:(node as HTMLImageElement).src,complete:(node as HTMLImageElement).complete,naturalWidth:(node as HTMLImageElement).naturalWidth})))
  await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  const src = await image.getAttribute('src'), alt = await image.getAttribute('alt')
  const imageResponse = await page.request.get(src!)
  expect(imageResponse.status()).toBe(200)
  console.log(`[consumer-image] returns source=${src} alt=${alt} sha256=${createHash('sha256').update(await imageResponse.body()).digest('hex')}`)
  await imageButton.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog').locator('img')).toHaveAttribute('src', src!)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.locator('[data-ppic-return-track-action="detail"]').first().click()
  const detail = page.getByRole('dialog', { name: '回货履约归责详情' })
  await expect(detail).toContainText('应回依据与每日承诺')
  await detail.getByText('实收分摊与变更追溯', { exact: true }).click()
  await expect(detail).toContainText('正式实收分摊')
  await expect(detail).toContainText('原承诺评估历史')
  await expect(detail).toContainText('操作记录')
  await expect(detail).toContainText('承诺采用的应回依据')
  await expect(detail).toContainText('尚无每日承诺')
  await expect(detail).toContainText('尚未形成实收分摊')
  await expect(detail).toContainText('尚无评估记录')
  await noOverflow(page, 'returns-trace-detail-1280')
  await evidence(page, info, 'returns-trace-detail-1280')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await evidence(page, info, 'returns-1280')
  await page.route(`**${src}`, route => route.abort())
  await page.reload()
  await expect(page.getByRole('heading', { name: '回货跟进', exact: true })).toBeVisible()
  await page.locator('[data-ppic-return-track-action="switch-tab:POST_FINISHING_PENDING"]').click()
  await expect(page.locator('[data-ppic-return-track-action="preview-image"]').first().getByText('图片加载失败')).toBeVisible()
})

test('任务分配预览实时展示35/100，实际生成的合同两页采用同一规则', async ({ page }, info) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/fcs/dispatch/workbench')
  await expect(page.getByRole('heading', { name: '任务分配工作台', exact: true })).toBeVisible()
  const release = await page.evaluate(async () => {
    const m = await import('/src/data/fcs/cut-piece-release.ts')
    return m.saveCutPieceReleaseAvailableQtyAction({ productionOrderId: 'PO-202603-0002', basisMatrixVersion: m.getCutPieceReleaseSummaryForProductionOrder('PO-202603-0002')!.latestMatrixVersion, basisTargetVersion: m.listCutPieceReleaseTargetSnapshots('PO-202603-0002').at(-1)!.matrixVersion, releaseQtyByColorSize: { 'Grey::S': 500, 'Grey::M': 700, 'Grey::L': 800, 'Grey::XL': 500 }, riskReason: '本地消费者验收：确认现有裁片来源，不写外部数据', confirmedBy: '裁床主管 王敏', confirmedAt: '2026-10-14 10:00:00' })
  })
  expect(release.ok, release.message).toBe(true)
  await page.reload()
  await page.locator('[data-unified-field="keyword"]').fill('TASKGEN-202603-0002-002')
  await page.locator('tbody tr').filter({ hasText: 'TASKGEN-202603-0002-002' }).first().locator('[data-unified-action="open-direct"]').click()
  const dialog = () => page.locator('[data-unified-action="close-dispatch"]').first().locator('xpath=following-sibling::section[1]')
  await dialog().locator('[data-unified-field="businessAssignedAt"]').fill('2026-10-14T10:00')
  let preview = dialog().locator('[data-unified-return-rule-preview]').last()
  await expect(preview.locator('[data-return-ratio]')).toHaveCount(2)
  await expect(preview.locator('[data-return-ratio="0.35"]')).toContainText('累计≥ 875件')
  await expect(preview.locator('[data-return-ratio="1"]')).toContainText('累计≥ 2,500件')
  await expect(preview).not.toContainText('70%')
  await dialog().locator('[data-unified-field="distributionMode"][value="FREE"]').check()
  for (const sku of ['SKU-005-M-GRY', 'SKU-005-L-GRY', 'SKU-005-XL-GRY']) await dialog().locator(`[data-unified-sku="${sku}"]`).uncheck()
  preview = dialog().locator('[data-unified-return-rule-preview]').last()
  await expect(preview.locator('[data-return-ratio="0.35"]')).toContainText('累计≥ 175件')
  await expect(preview.locator('[data-return-ratio="1"]')).toContainText('累计≥ 500件')
  await preview.scrollIntoViewIfNeeded()
  await noOverflow(page, 'dispatch-preview-1366')
  await evidence(page, info, 'dispatch-two-node-preview')
  await dialog().locator('[data-unified-field="factoryId"]').selectOption({ index: 1 })
  await dialog().getByRole('button', { name: '下一步：二次确认价格', exact: true }).click()
  await dialog().getByRole('button', { name: '确认提交并冻结价格', exact: true }).click()
  await expect(page.locator('[data-unified-action="close-dispatch"]')).toHaveCount(0)
  const contractId = await page.evaluate(async () => {
    const m = await import('/src/data/fcs/production-contracts.ts')
    return m.listProductionContracts().filter(c => c.status === 'EFFECTIVE').at(-1)?.contractId
  })
  expect(contractId).toBeTruthy()
  await page.goto(`/fcs/contracts/print?contractId=${contractId}`)
  await expect(page.locator('.production-contract-master__page')).toHaveCount(2)
  await expect(page.locator('[data-contract-return-table="two-nodes"] tbody tr')).toHaveCount(2)
  await expect(page.locator('[data-contract-rule-table="two-nodes"] tbody tr')).toHaveCount(3)
  await expect(page.locator('[data-contract-return-table]')).toContainText('35%')
  await expect(page.locator('[data-contract-return-table]')).toContainText('100%')
  for (const overlay of await page.locator('.production-contract-return-table,.production-contract-rule-table,.production-contract-basis-note,.production-contract-calculation').all()) expect(await overlay.evaluate(node => node.scrollHeight <= node.clientHeight + 1)).toBe(true)
  for (let index = 0; index < 2; index++) {
    const path = info.outputPath(`contract-page-${index + 1}.png`)
    const shot = await page.locator('.production-contract-master__page').nth(index).screenshot({ path })
    await info.attach(`contract-page-${index + 1}`, { path, contentType: 'image/png' })
    console.log(`[consumer-evidence] contract-page-${index + 1} sha256=${createHash('sha256').update(shot).digest('hex')} path=${path}`)
  }
})

test('进度看板、生产单跟踪和全流程耗时直接消费者无旧70%节点及主体溢出', async ({ page }, info) => {
  const routes = [
    ['/fcs/progress/board', '任务进度跟踪'],
    ['/fcs/progress/production-orders', '生产单进度跟踪'],
    ['/fcs/sewing-outsourcing/production-order-duration', '生成单全流程耗时'],
    ['/dds/supply-chain/production-fulfillment/teams', '团队与工厂'],
  ] as const
  for (const [route, heading] of routes) {
    for (const width of [1366, 1280]) {
      await page.setViewportSize({ width, height: width === 1366 ? 768 : 720 })
      await page.goto(route)
      await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible()
      await expect(page.locator('body')).not.toContainText('70%回货')
      await expect(page.locator('body')).not.toContainText('70%节点')
      await noOverflow(page, `${route}-${width}`)
    }
    await evidence(page, info, `consumer-${heading}`)
  }
})

test('后道待加工仓在员工分辨率可追溯回货及打开双时间确认', async ({ page }, info) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto('/fcs/craft/post-finishing/wait-process-warehouse?tab=returns')
  await expect(page.getByRole('heading', { name: '后道待加工仓', exact: true })).toBeVisible()
  await noOverflow(page, 'post-warehouse-1024')
  const deliveryId = await page.evaluate(async () => (await import('/src/data/fcs/post-finishing-full-flow.ts')).listPostFinishingFactoryReturns().find(row => !row.confirmedAt)!.deliveryId)
  await page.goto(`/fcs/craft/post-finishing/wait-process-warehouse?tab=returns&deliveryId=${encodeURIComponent(deliveryId)}`)
  await expect(page.getByLabel('实际后道确认时间（雅加达）', { exact: true })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('70% /')
  await noOverflow(page, 'post-return-dialog-1024')
  await evidence(page, info, 'post-return-business-time-1024')
})

test('PDA车缝执行读取回货待核对状态，交接列表与明细在小屏可读', async ({ page }, info) => {
  const taskId = 'PDA-SEW-AWARDED-DEMO-001'
  await page.goto('/fcs/pda/auth/login')
  await page.evaluate(async () => {
    const m = await import('/src/data/fcs/store-domain-pda.ts')
    const user = m.authenticateFactoryPdaUserByLoginId('ID-F021_admin').user!
    m.setPdaSession(m.createPdaSessionFromUser(user))
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/fcs/pda/task-receive?tab=awarded')
  await page.locator(`[data-pda-tr-action="accept-task"][data-task-id="${taskId}"]`).click()
  await expect(page.locator('[data-pda-tr-accept-dialog]')).toBeVisible()
  await page.locator(`[data-pda-tr-action="confirm-accept-task"][data-task-id="${taskId}"]`).click()
  await expect(page.locator('[data-pda-tr-accept-dialog]')).toHaveCount(0)
  await page.goto(`/fcs/pda/exec/${encodeURIComponent(taskId)}`)
  await expect(page.locator('[data-pda-sewing-delivery-progress]')).toBeVisible()
  await expect(page.locator('[data-pda-sewing-delivery-progress]')).not.toContainText('下一节点70%')
  await expect(page.locator('[data-pda-sewing-delivery-progress]')).not.toContainText('70% ·')
  await expect(page.locator('[data-pda-sewing-delivery-progress]')).toContainText('应回数量待核对')
  await expect(page.locator('[data-pda-sewing-delivery-progress]')).not.toContainText('全部节点已完成')
  await page.locator('[data-pda-sewing-delivery-progress]').scrollIntoViewIfNeeded()
  await noOverflow(page, 'pda-sewing-exec-390')
  await evidence(page, info, 'pda-sewing-exec-390')
  await page.goto('/fcs/pda/handover?tab=handout')
  await expect(page.locator('[data-testid="pda-handover-tabs"]')).toContainText('待交出')
  await expect(page.locator('body')).not.toContainText('PIECE')
  await noOverflow(page, 'pda-handover-390')
  await evidence(page, info, 'pda-sewing-handover-390')
  await page.locator('[data-pda-handover-action="open-detail"]').first().click()
  await page.waitForURL('**/fcs/pda/handover/**')
  await expect(page.getByRole('button', { name: '本次交出', exact: true })).toBeVisible()
  await noOverflow(page, 'pda-handover-detail-390')
  await evidence(page, info, 'pda-sewing-handover-detail-390')
  const pendingHead = await page.evaluate(async taskId => {
    const m = await import('/src/data/fcs/pda-handover-events.ts')
    const task = (await import('/src/data/fcs/runtime-process-tasks.ts')).getRuntimeTaskById(taskId)!
    const head = m.listHandoverOrdersByTaskId(taskId, { includeWool: false }).find(head => head.headType === 'HANDOUT')!
    const sku = task.scopeSkuLines?.[0]
    const { saveProductionSourceAction } = await import('/src/data/fcs/production-context-actions.ts')
    const record = await saveProductionSourceAction({
      id: 'QA-PPIC-CONSUMER-HANDOUT-10', intent: '本地消费者验收10件交出', events: true,
      action: () => {
        const created = m.createFactoryHandoverRecord({
          handoverOrderId: head.handoverOrderId || head.handoverId,
          submittedQty: 10, qtyUnit: head.qtyUnit, factorySubmittedAt: '2026-10-14 15:00:00',
          factorySubmittedBy: '本地浏览器验收', factoryRemark: '消费者场景：10件待现场收货；未做后道最终确认',
          skuCode: sku?.skuCode, scanCode: sku?.skuCode, factoryProofFiles: [],
        })
        m.persistPdaHandoverState()
        return created
      },
    })
    return { handoverId: head.handoverId, recordId: record.recordId, factoryId: head.factoryId, factoryName: head.sourceFactoryName }
  }, taskId)
  console.log('[consumer-handover-preview-source]', pendingHead)
  await page.evaluate(async handoverId => {
    const { appStore } = await import('/src/state/store.ts')
    appStore.navigate(`/fcs/pda/handover/${encodeURIComponent(handoverId)}`)
  }, pendingHead.handoverId)
  await page.waitForURL('**/fcs/pda/handover/**')
  await expect(page.locator('body')).not.toContainText('PIECE')
  const records = page.locator('details').filter({ hasText: /交出记录（/ }).first()
  if (await records.count() && await records.getAttribute('open') === null) await records.locator('summary').click()
  await page.locator(`[data-pda-handoverd-action="open-receiver-writeback"][data-record-id="${pendingHead.recordId}"]`).click({ timeout: 10_000 })
  await expect(page.locator('[data-sewing-sla-writeback-preview]')).toContainText('35% / 100%')
  await expect(page.locator('[data-sewing-sla-writeback-preview]')).toContainText('后道最终确认')
  await expect(page.locator('[data-sewing-sla-writeback-preview]')).not.toContainText('70%')
  await expect(page.locator('[data-sewing-sla-writeback-preview]')).not.toContainText('PIECE')
  await page.locator('[data-sewing-sla-writeback-preview]').scrollIntoViewIfNeeded()
  await noOverflow(page, 'pda-handover-receipt-preview-390')
  await evidence(page, info, 'pda-handover-receipt-preview-390')
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto(`/fcs/progress/board/tasks/${encodeURIComponent(taskId)}?tab=progress`)
  await expect(page.locator('[data-sewing-delivery-sla-detail]')).toBeVisible()
  await expect(page.locator('[data-sewing-delivery-sla-detail]')).toContainText('应回数量待核对')
  await expect(page.locator('[data-sewing-delivery-sla-detail]')).not.toContainText('70%')
  await noOverflow(page, 'progress-formal-task-detail-1280')
  await evidence(page, info, 'progress-formal-task-detail-1280')
})

test('PDA后道回货实际确认与录入时间在小屏分开，图片加载和大图Esc正常', async ({ page }, info) => {
  await session(page, 'F090', '全能力测试工厂')
  const deliveryNo = await page.evaluate(async () => {
    const m = await import('/src/data/fcs/post-finishing-full-flow.ts')
    return m.listPostFinishingFactoryReturns().find(row => !row.confirmedAt)!.deliveryOrderNo
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/fcs/pda/post-finishing/return-confirm')
  await page.locator('[data-pda-post-field="returnScan"]').fill(deliveryNo)
  await page.getByRole('button', { name: '查询', exact: true }).click()
  await expect(page.locator('[data-return-confirm-line]').first()).toBeVisible()
  await expect(page.getByLabel('实际后道确认时间（雅加达）', { exact: true })).toBeVisible()
  await noOverflow(page, 'pda-post-return-confirm-390')
  const image = page.locator('[data-return-confirm-line] img').first(), imageButton = image.locator('xpath=..')
  await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  const url = await image.getAttribute('src')
  const originalImageUrl = await imageButton.getAttribute('data-image-url')
  expect(originalImageUrl).toBeTruthy()
  const response = await page.request.get(url!)
  expect(response.status()).toBe(200)
  console.log(`[consumer-image] post-return source=${url} sha256=${createHash('sha256').update(await response.body()).digest('hex')}`)
  await imageButton.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog').locator('img')).toHaveAttribute('src', originalImageUrl!)
  await expect.poll(() => page.getByRole('dialog').locator('img').evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await evidence(page, info, 'pda-post-return-confirm-390')
})

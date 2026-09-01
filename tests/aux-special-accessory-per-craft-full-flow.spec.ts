import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  AUX_SPECIAL_ACCESSORY_CHAINS,
  type AuxSpecialAccessoryChain,
} from '../scripts/aux-special-accessory-test-catalog.ts'
import {
  buildSpecialCraftOperationSlug,
} from '../src/data/fcs/special-craft-operations.ts'
import {
  listSpecialCraftTaskOrders,
  type SpecialCraftTaskOrder,
} from '../src/data/fcs/special-craft-task-orders.ts'
import {
  createPdaSessionFromUser,
  listFactoryPdaUsers,
  type FactoryPdaSession,
} from '../src/data/fcs/store-domain-pda.ts'
import {
  buildBindingProcessOrders,
} from '../src/pages/process-factory/cutting/binding-strip-orders.ts'
import {
  listLaceProductionOrders,
  resetLaceFactoryRuntime,
  syncLaceProductionOrders,
} from '../src/data/fcs/lace-factory-domain.ts'

test.setTimeout(180_000)

const passLabel = (process.env.VERIFICATION_PASS || 'adhoc').replace(/[^a-zA-Z0-9_-]+/g, '-')
const evidenceRoot = resolve('output/verification/aux-special-accessory', passLabel, 'browser')
const perWorkOrderEvidenceRoot = resolve(evidenceRoot, 'work-orders')
mkdirSync(evidenceRoot, { recursive: true })
mkdirSync(perWorkOrderEvidenceRoot, { recursive: true })

type BrowserVerificationResult = {
  chainId: string
  workOrderId: string
  workOrderNo: string
  sourceType: 'SPECIAL_CRAFT' | 'BINDING_PROCESS_ORDER' | 'LACE_PRODUCTION_ORDER'
  pdaApplicable: boolean
  title: string
  status: string
  durationMs: number
  webScreenshot?: string
  pdaScreenshot?: string
  error?: string
}

type BrowserWorkOrderMetadata = Pick<
  BrowserVerificationResult,
  'chainId' | 'workOrderId' | 'workOrderNo' | 'sourceType' | 'pdaApplicable'
>

type BrowserArtifacts = Pick<BrowserVerificationResult, 'webScreenshot' | 'pdaScreenshot'>

const specialChains = AUX_SPECIAL_ACCESSORY_CHAINS.filter(
  (chain): chain is AuxSpecialAccessoryChain & { operationId: string } => chain.kind === 'SPECIAL_CRAFT' && Boolean(chain.operationId),
)
const bindingChain = AUX_SPECIAL_ACCESSORY_CHAINS.find((chain) => chain.id === 'BIND-01')
const laceChain = AUX_SPECIAL_ACCESSORY_CHAINS.find((chain) => chain.id === 'ACC-LACE-01')
const specialOrders = listSpecialCraftTaskOrders()
const bindingOrders = buildBindingProcessOrders()

resetLaceFactoryRuntime()
syncLaceProductionOrders()
const laceOrders = listLaceProductionOrders()
const browserArtifactsByWorkOrderId = new Map<string, BrowserArtifacts>()
const browserMetadataByWorkOrderId = new Map<string, BrowserWorkOrderMetadata>([
  ...specialChains.flatMap((chain) => specialOrders
    .filter((order) => order.operationId === chain.operationId)
    .map((order): [string, BrowserWorkOrderMetadata] => [order.taskOrderId, {
      chainId: chain.id,
      workOrderId: order.taskOrderId,
      workOrderNo: order.taskOrderNo,
      sourceType: 'SPECIAL_CRAFT',
      pdaApplicable: true,
    }])),
  ...bindingOrders.map((order): [string, BrowserWorkOrderMetadata] => [order.bindingOrderId, {
    chainId: bindingChain?.id || 'BIND-01',
    workOrderId: order.bindingOrderId,
    workOrderNo: order.bindingOrderNo,
    sourceType: 'BINDING_PROCESS_ORDER',
    pdaApplicable: true,
  }]),
  ...laceOrders.map((order): [string, BrowserWorkOrderMetadata] => [order.workOrderId, {
    chainId: laceChain?.id || 'ACC-LACE-01',
    workOrderId: order.workOrderId,
    workOrderNo: order.workOrderNo,
    sourceType: 'LACE_PRODUCTION_ORDER',
    pdaApplicable: false,
  }]),
])

function resultChainId(testInfo: TestInfo): string {
  return testInfo.title.match(/^\[([^\]]+)]/)?.[1] || 'UNKNOWN'
}

function resultWorkOrderId(testInfo: TestInfo): string {
  return testInfo.title.match(/^\[[^\]]+]\[([^\]]+)]/)?.[1] || ''
}

test.afterEach(async ({}, testInfo) => {
  const workOrderId = resultWorkOrderId(testInfo)
  const metadata = browserMetadataByWorkOrderId.get(workOrderId)
  if (!metadata) throw new Error(`${testInfo.title} 缺少逐加工单浏览器元数据`)
  const artifacts = browserArtifactsByWorkOrderId.get(workOrderId) || {}
  const result: BrowserVerificationResult = {
    ...metadata,
    chainId: resultChainId(testInfo),
    title: testInfo.title,
    status: testInfo.status,
    durationMs: testInfo.duration,
    ...artifacts,
    error: testInfo.error?.message,
  }
  writeFileSync(
    resolve(perWorkOrderEvidenceRoot, `${result.chainId}-${safeFileSegment(result.workOrderNo)}.json`),
    `${JSON.stringify(result, null, 2)}\n`,
  )
})

function getFactorySession(factoryId: string): FactoryPdaSession {
  const user = listFactoryPdaUsers(factoryId).find((item) =>
    item.status === 'ACTIVE' && ['ROLE_OPERATOR', 'ROLE_ADMIN'].includes(item.roleId),
  )
  if (!user) throw new Error(`${factoryId} 没有可用的 PDA 操作账号`)
  return createPdaSessionFromUser(user)
}

async function installPdaSession(page: Page, factoryId: string): Promise<void> {
  const session = getFactorySession(factoryId)
  await page.addInitScript((value) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(value))
  }, session)
}

async function assertNoExcludedTaskActions(page: Page): Promise<void> {
  const root = page.locator('#app')
  for (const forbidden of [
    '开工凭证',
    '关键节点上报',
    '补报关键节点',
    '查看开工',
    '查看节点',
    '任务完工',
    '完成任务',
  ]) {
    await expect(root).not.toContainText(forbidden)
  }
}

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const size = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }))
  expect(size.documentWidth, `document 横向溢出：${JSON.stringify(size)}`).toBeLessThanOrEqual(size.viewportWidth + 1)
  expect(size.bodyWidth, `body 横向溢出：${JSON.stringify(size)}`).toBeLessThanOrEqual(size.viewportWidth + 1)
}

async function assertPdaImageAndFallback(page: Page, evidenceId: string, verifyFailureRecovery: boolean): Promise<void> {
  const previewButton = page.locator('[data-pda-image-preview-url]').first()
  await expect(previewButton, `${evidenceId} PDA 缺少真实款式／物料图片入口`).toBeVisible()
  const image = previewButton.locator('img')
  await expect.poll(
    () => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0),
    { message: `${evidenceId} PDA 真实图片未成功加载` },
  ).toBe(true)
  const originalSrc = await image.getAttribute('src')
  expect(originalSrc).toBeTruthy()

  if (verifyFailureRecovery) {
    await image.evaluate((node: HTMLImageElement, id) => {
      node.src = `/__missing-aux-special-accessory-${id}.jpg`
    }, evidenceId)
    await expect(previewButton.getByText('图片加载失败')).toBeVisible()

    await image.evaluate((node: HTMLImageElement, src) => {
      node.hidden = false
      const fallback = node.nextElementSibling as HTMLElement | null
      if (fallback) fallback.hidden = true
      node.src = src || ''
    }, originalSrc)
    await expect.poll(
      () => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0),
      { message: `${evidenceId} PDA 图片失败后无法恢复` },
    ).toBe(true)
  }

  await previewButton.click()
  const previewDialog = page.getByRole('dialog')
  await expect(previewDialog).toBeVisible()
  await previewDialog.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(previewDialog).toHaveCount(0)
}

async function assertSpecialObjectSemantics(
  page: Page,
  chain: AuxSpecialAccessoryChain,
  order: SpecialCraftTaskOrder,
): Promise<void> {
  const root = page.locator('#app')
  await expect(root).toContainText(order.targetObject)
  if (chain.expectedTargetObject === '已裁部位') {
    await expect(root).toContainText('裁片')
    await expect(root).toContainText('菲票')
    await expect(root).toContainText('片')
  } else if (chain.expectedTargetObject === '成衣') {
    await expect(root).toContainText('成衣')
    await expect(root).toContainText('SKU')
    await expect(root).toContainText('件')
  } else if (chain.expectedTargetObject === '捆条') {
    await expect(root).toContainText('捆条投入与盘扣产出')
    await expect(root).toContainText('张')
    await expect(root).toContainText('个')
    await expect(root).toContainText('中央辅料仓')
  } else if (chain.expectedTargetObject === '辅料') {
    await expect(root).toContainText('辅料')
    await expect(root).toContainText('投入单位')
    await expect(root).toContainText('产出单位')
    await expect(root).toContainText('条')
  }
}

async function openAndCheckSpecialWebAction(page: Page, order: SpecialCraftTaskOrder): Promise<void> {
  const actions = page.locator('[data-special-craft-web-action="open-web-status-action-dialog"]')
  const actionCount = await actions.count()
  for (let index = 0; index < actionCount; index += 1) {
    await expect(actions.nth(index)).toHaveAttribute('data-source-id', order.taskOrderId)
    await expect(actions.nth(index)).toHaveAttribute('data-qty-unit', /\S+/)
  }
  if (!actionCount) {
    await expect(page.getByTestId('web-status-action-area')).toContainText(order.status)
    await expect(page.getByTestId('web-status-action-area')).toContainText(/暂无可执行动作|不能|已完成|已完结|已取消/)
    return
  }
  const action = actions.first()
  await expect(action).toBeVisible()
  await action.click()

  const customDialog = page.locator(
    '#special-craft-garment-sku-dialog, #special-craft-fei-ticket-dialog, #special-craft-button-loop-dialog',
  )
  const genericDialog = page.getByTestId('process-web-status-action-dialog')
  if (await genericDialog.isVisible().catch(() => false)) {
    await expect(genericDialog).toHaveAttribute('data-source-id', order.taskOrderId)
    await genericDialog.getByTestId('process-web-status-action-cancel').last().click()
  } else {
    await expect(customDialog).toBeVisible()
    await expect(customDialog.locator('[data-work-order-id]').last()).toHaveAttribute('data-work-order-id', order.taskOrderId)
    await customDialog.getByRole('button', { name: '取消' }).click()
  }
}

function safeFileSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, '-').replace(/^-+|-+$/g, '')
}

async function saveScreenshot(
  page: Page,
  metadata: BrowserWorkOrderMetadata,
  surface: 'web' | 'pda',
): Promise<string> {
  const path = resolve(evidenceRoot, `${metadata.chainId}-${safeFileSegment(metadata.workOrderNo)}-${surface}.png`)
  await page.screenshot({ path, fullPage: true })
  const artifacts = browserArtifactsByWorkOrderId.get(metadata.workOrderId) || {}
  artifacts[surface === 'web' ? 'webScreenshot' : 'pdaScreenshot'] = path
  browserArtifactsByWorkOrderId.set(metadata.workOrderId, artifacts)
  return path
}

for (const chain of specialChains) {
  const chainOrders = specialOrders.filter((order) => order.operationId === chain.operationId)
  for (const [orderIndex, order] of chainOrders.entries()) {
    test(`[${chain.id}][${order.taskOrderId}] ${chain.name} ${order.taskOrderNo} Web/PDA 逐单 UI`, async ({ page }) => {
      const metadata = browserMetadataByWorkOrderId.get(order.taskOrderId)!
      const slug = buildSpecialCraftOperationSlug(chain.operationId)
      const webPath = `/fcs/process-factory/special-craft/${slug}/work-orders/${encodeURIComponent(order.taskOrderId)}`

      await page.setViewportSize({ width: 1366, height: 768 })
      await page.goto(webPath)
      await expect(page).toHaveURL(new RegExp(`${slug}/work-orders/${encodeURIComponent(order.taskOrderId)}(?:\\?|$)`))
      await expect(page.getByRole('heading', { name: `${chain.name}加工单详情` })).toBeVisible()
      await expect(page.locator('#app')).toContainText(order.taskOrderNo)
      await expect(page.locator('#app')).toContainText(order.taskOrderId)
      await expect(page.locator('#app')).toContainText(order.sourceTaskId || '—')
      await expect(page.locator('#app')).toContainText(order.status)
      await expect(page.getByRole('button', { name: '加工明细' })).toBeVisible()
      await expect(page.getByRole('button', { name: '操作记录' })).toBeVisible()
      await expect(page.getByTestId('web-status-action-area')).toBeVisible()
      await assertSpecialObjectSemantics(page, chain, order)
      await assertNoExcludedTaskActions(page)
      await assertNoHorizontalOverflow(page)
      await openAndCheckSpecialWebAction(page, order)

      if (chain.id === 'AUX-01') {
        await page.goto(`/fcs/process-factory/special-craft/${slug}/tasks/${encodeURIComponent(order.taskOrderId)}`)
        await expect(page).toHaveURL(new RegExp(`${slug}/work-orders/${encodeURIComponent(order.taskOrderId)}(?:\\?|$)`))
      }
      await saveScreenshot(page, metadata, 'web')

      await page.setViewportSize({ width: 360, height: 640 })
      await installPdaSession(page, order.factoryId)
      const pdaPath = `/fcs/pda/exec/SPECIAL_CRAFT/${encodeURIComponent(order.taskOrderId)}`
      await page.goto(pdaPath)
      await expect(page).toHaveURL(new RegExp(`/fcs/pda/exec/SPECIAL_CRAFT/${encodeURIComponent(order.taskOrderId)}(?:\\?|$)`))
      await expect(page.locator('[data-pda-special-craft-detail]')).toBeVisible()
      await expect(page.locator('#app')).toContainText(order.taskOrderNo)
      await expect(page.locator('#app')).toContainText(order.taskOrderId)
      await expect(page.locator('#app')).toContainText(order.sourceTaskId || '')
      await expect(page.locator('#app')).toContainText(order.sourceTaskNo || order.sourceTaskId || '')
      await expect(page.locator('#app')).toContainText(order.status)
      const pdaActions = page.locator('[data-pda-execd-action][data-work-order-id]')
      const pdaActionCount = await pdaActions.count()
      for (let index = 0; index < pdaActionCount; index += 1) {
        await expect(pdaActions.nth(index)).toHaveAttribute('data-work-order-id', order.taskOrderId)
        await expect(pdaActions.nth(index)).toHaveAttribute('data-source-task-id', order.sourceTaskId || '')
      }
      await assertNoExcludedTaskActions(page)
      await assertNoHorizontalOverflow(page)
      await assertPdaImageAndFallback(page, order.taskOrderNo, orderIndex === 0)
      await saveScreenshot(page, metadata, 'pda')

      await page.goto(`/fcs/pda/exec?keyword=${encodeURIComponent(order.taskOrderNo)}`)
      await page.locator('[data-pda-todo-modal="true"]').evaluateAll((nodes) => nodes.forEach((node) => node.remove()))
      await expect(page.locator('[data-pda-exec-field="specialCraftScanKeyword"]')).toHaveValue(order.taskOrderNo)
      const executionTabs = page.getByTestId('pda-exec-special-craft-tabs')
      await expect(executionTabs.getByRole('button')).toHaveCount(2)
      await expect(executionTabs).not.toContainText('待接收')
      await expect(executionTabs).not.toContainText('待交出')
      const appearsInExecution = order.status === '加工中' || order.status === '已完结'
      await expect(page.locator(`[data-testid="pda-exec-work-order-card"][data-work-order-id="${order.taskOrderId}"]`))
        .toHaveCount(appearsInExecution ? 1 : 0)
    })
  }
}

for (const [orderIndex, order] of bindingOrders.entries()) {
  const chainId = bindingChain?.id || 'BIND-01'
  test(`[${chainId}][${order.bindingOrderId}] 捆条 ${order.bindingOrderNo} Web/PDA 逐单 UI`, async ({ page }) => {
    const metadata = browserMetadataByWorkOrderId.get(order.bindingOrderId)!
    const webPath = `/fcs/craft/cutting/special-processes/${encodeURIComponent(order.bindingOrderId)}`

    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto(webPath)
    await expect(page).toHaveURL(new RegExp(`/fcs/craft/cutting/special-processes/${encodeURIComponent(order.bindingOrderId)}(?:\\?|$)`))
    await expect(page.getByRole('heading', { name: '捆条加工单详情' })).toBeVisible()
    await expect(page.locator('#app')).toContainText(order.bindingOrderNo)
    await expect(page.locator('#app')).toContainText(order.bindingOrderId)
    await expect(page.locator('#app')).toContainText(order.sourceTaskId)
    await expect(page.locator('#app')).toContainText(order.status)
    await expect(page.locator('#app')).toContainText('来源任务 ID')
    await expect(page.locator('#app')).toContainText('所有操作只写入当前捆条加工单')
    const bindingActions = page.locator(`[data-cutting-binding-action][data-row-id="${order.bindingOrderId}"]`)
    for (const actionLabel of ['确认接收', '加工填报', '发起交出', '完成加工单']) {
      await expect(bindingActions.filter({ hasText: actionLabel })).toHaveCount(1)
    }
    const enabledActions = page.locator(
      `[data-cutting-binding-action][data-row-id="${order.bindingOrderId}"]:not([disabled])`,
    )
    const enabledActionCount = await enabledActions.count()
    if (enabledActionCount > 0) {
      const enabledAction = enabledActions.first()
      await expect(enabledAction).toHaveAttribute('data-row-id', order.bindingOrderId)
      await enabledAction.click()
      const bindingDialog = page.locator('#cutting-binding-action-modal')
      await expect(bindingDialog).toBeVisible()
      await expect(bindingDialog).toHaveAttribute('data-binding-order-id', order.bindingOrderId)
      await bindingDialog.getByRole('button', { name: '取消' }).click()
    } else {
      await expect(page.locator('#app')).toContainText(order.status)
    }
    await assertNoExcludedTaskActions(page)
    await assertNoHorizontalOverflow(page)
    await saveScreenshot(page, metadata, 'web')

    await page.setViewportSize({ width: 360, height: 640 })
    await installPdaSession(page, order.factoryId)
    const pdaPath = `/fcs/pda/exec/BINDING_PROCESS_ORDER/${encodeURIComponent(order.bindingOrderId)}`
    await page.goto(pdaPath)
    await expect(page).toHaveURL(new RegExp(`/fcs/pda/exec/BINDING_PROCESS_ORDER/${encodeURIComponent(order.bindingOrderId)}(?:\\?|$)`))
    await expect(page.locator('[data-pda-binding-detail]')).toBeVisible()
    await expect(page.locator('#app')).toContainText(order.bindingOrderNo)
    await expect(page.locator('#app')).toContainText(order.bindingOrderId)
    await expect(page.locator('#app')).toContainText(order.sourceTaskId)
    await expect(page.locator('#app')).toContainText(order.status)
    const pdaActions = page.locator('[data-pda-execd-action][data-work-order-id]')
    const pdaActionCount = await pdaActions.count()
    for (let index = 0; index < pdaActionCount; index += 1) {
      await expect(pdaActions.nth(index)).toHaveAttribute('data-work-order-id', order.bindingOrderId)
    }
    await assertNoExcludedTaskActions(page)
    await assertNoHorizontalOverflow(page)
    await assertPdaImageAndFallback(page, order.bindingOrderNo, orderIndex === 0)
    await saveScreenshot(page, metadata, 'pda')

    await page.goto(`/fcs/pda/exec?keyword=${encodeURIComponent(order.bindingOrderNo)}`)
    await page.locator('[data-pda-todo-modal="true"]').evaluateAll((nodes) => nodes.forEach((node) => node.remove()))
    await expect(page.locator('[data-pda-exec-field="bindingSearchKeyword"]')).toHaveValue(order.bindingOrderNo)
    const executionTabs = page.getByTestId('pda-exec-binding-tabs')
    await expect(executionTabs.getByRole('button')).toHaveCount(2)
    await expect(executionTabs).not.toContainText('待接收')
    await expect(executionTabs).not.toContainText('待交出')
    const appearsInExecution = order.status === '加工中' || order.status === '已完成'
    await expect(page.locator(`[data-testid="pda-exec-binding-work-order-card"][data-work-order-id="${order.bindingOrderId}"]`))
      .toHaveCount(appearsInExecution ? 1 : 0)
  })
}

for (const order of laceOrders) {
  const chainId = laceChain?.id || 'ACC-LACE-01'
  test(`[${chainId}][${order.workOrderId}] 花边 ${order.workOrderNo} Web-only 逐单 UI`, async ({ page }) => {
    const metadata = browserMetadataByWorkOrderId.get(order.workOrderId)!
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/fcs/craft/accessory/lace/work-orders')
    await expect(page.locator(`[data-lace-work-order-actions="${order.workOrderId}"]`)).toHaveCount(1)
    await expect(page.locator('#app')).toContainText('确认接收')
    await expect(page.locator('#app')).toContainText('加工填报')
    await expect(page.locator('#app')).toContainText('完成加工单')
    await expect(page.locator('#app')).toContainText('发起交出')
    await assertNoExcludedTaskActions(page)
    await assertNoHorizontalOverflow(page)

    await page.goto(`/fcs/craft/accessory/lace/work-orders/${encodeURIComponent(order.workOrderId)}`)
    await expect(page).toHaveURL(new RegExp(`/fcs/craft/accessory/lace/work-orders/${encodeURIComponent(order.workOrderId)}(?:\\?|$)`))
    await expect(page.locator('[data-lace-work-order-detail-root]')).toBeVisible()
    await expect(page.getByRole('heading', { name: order.workOrderNo })).toBeVisible()
    await expect(page.locator('#app')).toContainText(order.workOrderId)
    await expect(page.locator('#app')).toContainText(order.status)
    await expect(page.locator('#app')).toContainText(order.demandSource.purchaseOrderNo)
    await expect(page.locator('#app')).toContainText(order.processingOutput.skuCode)
    const imageButtons = page.locator('[data-lace-common-action="open-image"]')
    await expect(imageButtons).not.toHaveCount(0)
    await expect.poll(
      () => imageButtons.locator('img').evaluateAll(
        (images: HTMLImageElement[]) => images.length > 0 && images.every((image) => image.complete && image.naturalWidth > 0),
      ),
      { message: `${order.workOrderNo} 花边真实图片未全部加载` },
    ).toBe(true)
    await imageButtons.first().click()
    const imageDialog = page.getByRole('dialog')
    await expect(imageDialog).toBeVisible()
    await imageDialog.getByRole('button', { name: '关闭', exact: true }).click()
    await expect(imageDialog).toHaveCount(0)
    await assertNoExcludedTaskActions(page)
    await assertNoHorizontalOverflow(page)
    await saveScreenshot(page, metadata, 'web')
  })
}

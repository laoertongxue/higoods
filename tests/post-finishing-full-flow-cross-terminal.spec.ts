import { expect, test, type BrowserContext, type Locator, type Page, type TestInfo } from '@playwright/test'
import { dirname, resolve } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'

type QcScenario = 'normal' | 'balanced-defect' | 'balanced-return' | 'difference'
type PostScenario = 'normal' | 'balanced-defect' | 'web-fallback'
type RecheckScenario = 'normal' | 'balanced-defect' | 'difference'
type ReturnScenario = 'normal' | 'minus-5-boundary' | 'plus-5-boundary' | 'over-5-authorization'

interface CrossTerminalScenario {
  orderIndex: number
  productionOrderNo: string
  returnIndex: number
  label: string
  returnScenario: ReturnScenario
  qcScenario: QcScenario
  needPost: boolean
  postScenario: PostScenario
  recheckScenario: RecheckScenario
  barcodeError: boolean
  warehouseDifference: boolean
  uploadReference: boolean
  qcClaimConflictAndRelease: boolean
  recheckRelease: boolean
  duplicateReceipt: boolean
}

interface StageEvidence {
  stage: string
  url: string
  status?: string
  skuCount: number
  details?: Record<string, string | number | boolean>
}

interface ChainEvidence {
  chainIndex: number
  productionOrderNo: string
  returnIndex: number
  label: string
  deliveryOrderNo?: string
  qcTaskNo?: string
  postTaskNo?: string
  recheckOrderNo?: string
  outboundOrderNo?: string
  stages: StageEvidence[]
  authorizationStages: string[]
  finalScreenshot?: string
}

interface AcceptanceEvidence {
  suite: string
  passLabel: string
  startedAt: string
  finishedAt?: string
  writeBoundary: string
  expected: {
    productionOrders: number
    skuPerProductionOrder: number
    returnsPerProductionOrder: number
    chains: number
  }
  chains: ChainEvidence[]
  surfaceScreenshots: string[]
  finalSnapshot?: unknown
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

const PRODUCTION_ORDERS = [
  'PO-QC-202608-001',
  'PO-QC-202608-002',
  'PO-QC-202608-003',
] as const

const scenarios: CrossTerminalScenario[] = PRODUCTION_ORDERS.flatMap((productionOrderNo, orderIndex) => (
  [1, 2, 3, 4, 5].map((returnIndex): CrossTerminalScenario => {
    const key = `${orderIndex + 1}-${returnIndex}`
    const base: CrossTerminalScenario = {
      orderIndex,
      productionOrderNo,
      returnIndex,
      label: '正常一致',
      returnScenario: 'normal',
      qcScenario: 'normal',
      needPost: returnIndex !== 2,
      postScenario: 'normal',
      recheckScenario: 'normal',
      barcodeError: false,
      warehouseDifference: false,
      uploadReference: returnIndex === 1,
      qcClaimConflictAndRelease: key === '1-1',
      recheckRelease: key === '3-5',
      duplicateReceipt: key === '3-5',
    }
    if (key === '1-2') return { ...base, label: '回货 -5%边界且质检直达复检', returnScenario: 'minus-5-boundary' }
    if (key === '1-3') return { ...base, label: '回货超过5%复点与动态授权', returnScenario: 'over-5-authorization' }
    if (key === '1-4') return { ...base, label: '质检瑕疵守恒后进入后道', qcScenario: 'balanced-defect' }
    if (key === '1-5') return { ...base, label: 'SKU错码重贴与复扫恢复', barcodeError: true }
    if (key === '2-1') return { ...base, label: '回货 +5%边界及买手资料' , returnScenario: 'plus-5-boundary' }
    if (key === '2-2') return { ...base, label: '质检少1件授权后直达复检', qcScenario: 'difference' }
    if (key === '2-3') return { ...base, label: 'PDA中断后由Web应急接管继续', postScenario: 'web-fallback' }
    if (key === '2-4') return { ...base, label: '复检少1件动态授权', recheckScenario: 'difference' }
    if (key === '2-5') return { ...base, label: '仓库少1件动态授权', warehouseDifference: true }
    if (key === '3-1') return { ...base, label: '质检返厂守恒及资料冻结', qcScenario: 'balanced-return' }
    if (key === '3-2') return { ...base, label: '无后道直达复检正常链' }
    if (key === '3-3') return { ...base, label: '后道新增瑕疵守恒', postScenario: 'balanced-defect' }
    if (key === '3-4') return { ...base, label: '第二组SKU错码重贴复扫', barcodeError: true }
    if (key === '3-5') return { ...base, label: '复检退领重领及重复收货幂等', recheckScenario: 'balanced-defect' }
    return base
  })
))

const passLabel = process.env.VERIFICATION_PASS || 'cross-terminal'
const evidenceOutput = process.env.POST_FINISHING_CROSS_TERMINAL_EVIDENCE_OUT
const screenshotDirectory = process.env.POST_FINISHING_CROSS_TERMINAL_SCREENSHOT_DIR
const consumedAuthorizationPayloads = new Set<string>()

const evidence: AcceptanceEvidence = {
  suite: 'QC 后道全流程 3×5×5 全量跨端 UI 验收',
  passLabel,
  startedAt: new Date().toISOString(),
  writeBoundary: '开始时清空浏览器 localStorage、关闭默认演示数据并写入 PDA 测试会话；除此之外全部业务写入由 Web/PDA 页面操作产生；结束时只读业务事实用于核对。',
  expected: {
    productionOrders: 3,
    skuPerProductionOrder: 5,
    returnsPerProductionOrder: 5,
    chains: 15,
  },
  chains: [],
  surfaceScreenshots: [],
}

function persistEvidence(): void {
  if (!evidenceOutput) return
  mkdirSync(dirname(evidenceOutput), { recursive: true })
  writeFileSync(evidenceOutput, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
}

async function setPdaSession(page: Page): Promise<void> {
  await page.evaluate((session) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
  }, PDA_SESSION)
}

async function setCurrentWebActor(page: Page, actorId: string): Promise<void> {
  await page.evaluate((id) => {
    window.localStorage.setItem('higood-fcs-post-finishing-current-actor-v1', id)
  }, actorId)
}

async function statusText(page: Page): Promise<string> {
  const status = page.getByRole('status').last()
  await expect(status).toBeVisible()
  return (await status.textContent())?.trim() || ''
}

async function waitForStableRenderedUi(page: Page): Promise<void> {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await page.waitForLoadState('domcontentloaded')
    try {
      const stable = await page.evaluate(({ quietMs, timeoutMs }) => new Promise<boolean>((resolveStable) => {
        let finished = false
        let quietTimer = window.setTimeout(finishStable, quietMs)
        const timeoutTimer = window.setTimeout(() => finishStable(false), timeoutMs)
        const observer = new MutationObserver(() => {
          window.clearTimeout(quietTimer)
          quietTimer = window.setTimeout(finishStable, quietMs)
        })
        function finishStable(result = true): void {
          if (finished) return
          finished = true
          window.clearTimeout(quietTimer)
          window.clearTimeout(timeoutTimer)
          observer.disconnect()
          resolveStable(result)
        }
        observer.observe(document.documentElement, { attributes: true, childList: true, subtree: true })
      }), { quietMs: 300, timeoutMs: 10_000 })
      expect(stable, '扫码前页面必须完成渲染并稳定至少300毫秒').toBe(true)
      return
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const navigationRace = message.includes('Execution context was destroyed') || message.includes('because of a navigation')
      if (!navigationRace || attempt === 5) throw error
    }
  }
}

async function fillScanAndWaitForRefresh(
  page: Page,
  scanner: Locator,
  value: string,
  expected: { queryKey?: string; queryValue?: string; resultSelector?: string; resultCount?: number } = {},
): Promise<void> {
  await expect(scanner).toBeVisible()
  await waitForStableRenderedUi(page)
  await scanner.fill(value)
  await expect(scanner).toHaveValue(value)
  const previousUrl = page.url()
  await Promise.all([
    page.waitForURL((url) => (
      url.href !== previousUrl
      && url.searchParams.has('refresh')
      && (!expected.queryKey || url.searchParams.get(expected.queryKey) === expected.queryValue)
    )),
    scanner.press('Enter', { noWaitAfter: true }),
  ])
  if (expected.resultSelector) {
    const result = page.locator(expected.resultSelector)
    if (expected.resultCount === undefined) await expect(result).toBeVisible()
    else await expect(result).toHaveCount(expected.resultCount)
  }
}

function extractNumber(text: string, pattern: RegExp, label: string): string {
  const match = text.match(pattern)
  expect(match?.[1], `${label}必须出现在页面反馈中`).toBeTruthy()
  return match![1]!
}

function expectedSkuBarcodes(orderIndex: number): string[] {
  return [1, 2, 3, 4, 5].map((skuIndex) => `SKU-${orderIndex + 1}${String(skuIndex).padStart(2, '0')}-202608`)
}

function addStage(
  chain: ChainEvidence,
  page: Page,
  stage: string,
  status: string | undefined,
  details?: Record<string, string | number | boolean>,
): void {
  chain.stages.push({ stage, url: page.url(), status, skuCount: 5, details })
  persistEvidence()
}

async function saveScreenshot(page: Page, chain: ChainEvidence, suffix: string): Promise<string | undefined> {
  if (!screenshotDirectory) return undefined
  mkdirSync(screenshotDirectory, { recursive: true })
  const base = `${String(chain.chainIndex).padStart(2, '0')}-${chain.productionOrderNo.replaceAll('/', '-')}-R${chain.returnIndex}-${suffix}.png`
  const path = resolve(screenshotDirectory, base)
  await page.screenshot({ path, fullPage: true })
  return path
}

async function saveSurfaceScreenshot(page: Page, name: string): Promise<void> {
  if (!screenshotDirectory) return
  mkdirSync(screenshotDirectory, { recursive: true })
  const path = resolve(screenshotDirectory, `surface-${name}.png`)
  await page.screenshot({ path, fullPage: true })
  evidence.surfaceScreenshots.push(path)
  persistEvidence()
}

async function freshAuthorizationPayload(context: BrowserContext, authorizerId: string): Promise<string> {
  const authorizationPage = await context.newPage()
  await authorizationPage.setViewportSize({ width: 1366, height: 768 })
  authorizationPage.setDefaultTimeout(45_000)
  authorizationPage.setDefaultNavigationTimeout(45_000)
  await authorizationPage.goto('/fcs/craft/post-finishing/authorization-code', { waitUntil: 'domcontentloaded' })
  await authorizationPage.evaluate(() => {
    window.localStorage.removeItem('higood-fcs-post-finishing-current-authorizer-v1')
  })
  await authorizationPage.reload({ waitUntil: 'domcontentloaded' })
  await expect(authorizationPage.locator('body')).toContainText('当前账号没有授权权限')
  await expect(authorizationPage.locator('[data-authorization-code]')).toHaveCount(0)
  await authorizationPage.evaluate((id) => {
    window.localStorage.setItem('higood-fcs-post-finishing-current-authorizer-v1', id)
  }, authorizerId)
  await authorizationPage.reload({ waitUntil: 'domcontentloaded' })
  const payloadNode = authorizationPage.locator('[data-authorization-scan-payload]')
  await expect(payloadNode).toHaveText(/^PFAUTH:/, { timeout: 45_000 })
  const deadline = Date.now() + 65_000
  while (Date.now() < deadline) {
    const payload = (await payloadNode.textContent())?.trim() || ''
    const slot = Number(payload.split(':')[2])
    const hasEnoughValidity = Number.isFinite(slot) && ((slot + 1) * 30_000) - Date.now() >= 5_000
    if (payload && hasEnoughValidity && !consumedAuthorizationPayloads.has(payload)) {
      consumedAuthorizationPayloads.add(payload)
      await authorizationPage.close()
      return payload
    }
    await authorizationPage.waitForTimeout(500)
  }
  await authorizationPage.close()
  throw new Error(`${authorizerId} 的动态授权码在65秒内未刷新为剩余有效期至少5秒的可用码`)
}

async function registerReturnThroughPublicPda(page: Page, scenario: CrossTerminalScenario, chain: ChainEvidence): Promise<string> {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/fcs/pda/handover/sewing-self-return')
  const scanner = page.locator('[data-pda-sewing-self-return-field="scanValue"]')
  await fillScanAndWaitForRefresh(page, scanner, `PFRETURN:${scenario.productionOrderNo}:${scenario.returnIndex}`, {
    resultSelector: '[data-return-sku-card]',
    resultCount: 5,
  })
  const quantities = page.locator('[data-pda-sewing-self-return-field="quantity"]')
  for (let index = 0; index < 5; index += 1) await quantities.nth(index).fill('20')
  await page.locator('[data-pda-sewing-self-return-field="deliveryPersonName"]').fill(`UI验收送货员-${scenario.orderIndex + 1}`)
  await page.locator('[data-pda-sewing-self-return-field="deliveryPersonPhone"]').fill(`0812888${scenario.orderIndex + 1}${scenario.returnIndex}00`)
  await page.getByRole('button', { name: '加载原型验收凭证' }).click()
  await page.getByRole('button', { name: '提交本次回货登记' }).click()
  const status = await statusText(page)
  await expect(page.getByRole('status')).toContainText('登记成功')
  const deliveryOrderNo = extractNumber(status, /登记成功：(DEL-[^，\s]+)/, '送货单号')
  addStage(chain, page, '公共PDA登记回货', status, { deliveryOrderNo, registeredSkuLines: 5 })
  return deliveryOrderNo
}

async function confirmReturnThroughPda(
  page: Page,
  context: BrowserContext,
  scenario: CrossTerminalScenario,
  chain: ChainEvidence,
  deliveryOrderNo: string,
): Promise<void> {
  await page.setViewportSize({ width: 400, height: 806 })
  await page.goto('/fcs/pda/post-finishing/return-confirm')
  const scanner = page.locator('[data-pda-post-field="returnScan"]')
  await fillScanAndWaitForRefresh(page, scanner, deliveryOrderNo, {
    queryKey: 'id',
    queryValue: deliveryOrderNo,
    resultSelector: '[data-return-confirm-line]',
    resultCount: 5,
  })
  const firstCounts = page.locator('[data-return-first-count]')
  const firstQuantity = scenario.returnScenario === 'minus-5-boundary'
    ? 19
    : scenario.returnScenario === 'plus-5-boundary'
      ? 21
      : scenario.returnScenario === 'over-5-authorization'
        ? 18
        : 20
  for (let index = 0; index < 5; index += 1) await firstCounts.nth(index).fill(String(index === 0 ? firstQuantity : 20))
  await page.getByRole('button', { name: '提交第一次点数' }).click()

  if (scenario.returnScenario === 'over-5-authorization') {
    await expect(page.getByRole('status')).toContainText('请重新点数')
    const secondCounts = page.locator('[data-return-second-count]')
    for (let index = 0; index < 5; index += 1) await secondCounts.nth(index).fill(String(index === 0 ? 18 : 20))
    await page.getByRole('button', { name: '提交第二次点数' }).click()
    await expect(page.getByRole('status')).toContainText('必须扫描动态授权码')
    const payload = await freshAuthorizationPayload(context, 'AUTH-QC-001')
    await page.locator('[data-return-difference-reason]').fill('全量跨端UI验收：复点后首个SKU仍少2件')
    await page.locator('[data-return-authorization]').fill(payload)
    chain.authorizationStages.push('回货确认')
    await saveScreenshot(page, chain, 'return-authorization')
    await page.getByRole('button', { name: '授权并确认回货' }).click()
  }

  const status = await statusText(page)
  await expect(page.getByRole('status')).toContainText('回货确认成功')
  addStage(chain, page, 'PDA回货确认', status, {
    returnScenario: scenario.returnScenario,
    firstSkuConfirmedQty: firstQuantity,
  })
}

async function confirmReturnThroughWeb(
  page: Page,
  context: BrowserContext,
  scenario: CrossTerminalScenario,
  chain: ChainEvidence,
  deliveryOrderNo: string,
): Promise<void> {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/fcs/craft/post-finishing/wait-process-warehouse?tab=returns')
  const card = page.locator('[data-return-card]').filter({ hasText: deliveryOrderNo })
  await expect(card).toHaveCount(1)
  await card.locator('[data-nav]').first().click({ noWaitAfter: true })
  await expect(page.locator('[data-return-confirm-root]')).toContainText(deliveryOrderNo)
  const firstQuantity = scenario.returnScenario === 'minus-5-boundary'
    ? 19
    : scenario.returnScenario === 'plus-5-boundary'
      ? 21
      : scenario.returnScenario === 'over-5-authorization'
        ? 18
        : 20
  const firstCounts = page.locator('[data-return-first-count]')
  for (let index = 0; index < 5; index += 1) await firstCounts.nth(index).fill(String(index === 0 ? firstQuantity : 20))
  await page.getByRole('button', { name: '提交第一次点数' }).click()

  if (scenario.returnScenario === 'over-5-authorization') {
    await expect(page.getByRole('status')).toContainText('请重新点数')
    const secondCounts = page.locator('[data-return-second-count]')
    for (let index = 0; index < 5; index += 1) await secondCounts.nth(index).fill(String(index === 0 ? 18 : 20))
    await page.getByRole('button', { name: '提交第二次点数' }).click()
    await expect(page.getByRole('status')).toContainText('必须扫描动态授权码')
    const payload = await freshAuthorizationPayload(context, 'AUTH-QC-001')
    await page.locator('[data-return-difference-reason]').fill('全量跨端UI验收：Web复点后首个SKU仍少2件')
    await page.locator('[data-return-authorization]').fill(payload)
    chain.authorizationStages.push('Web回货确认')
    await saveScreenshot(page, chain, 'web-return-authorization')
    await page.getByRole('button', { name: '授权并确认回货' }).click()
  }

  const status = await statusText(page)
  await expect(page.getByRole('status')).toContainText('数量已进入后道待加工仓')
  await expect(page.locator('body')).toContainText('送检并生成质检任务')
  addStage(chain, page, 'Web回货确认并入待加工仓', status, {
    returnScenario: scenario.returnScenario,
    firstSkuConfirmedQty: firstQuantity,
  })
}

async function sendToQcThroughWeb(page: Page, scenario: CrossTerminalScenario, chain: ChainEvidence, deliveryOrderNo: string): Promise<string> {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/fcs/craft/post-finishing/wait-process-warehouse?tab=returns')
  const row = page.locator('tbody tr').filter({ hasText: deliveryOrderNo })
  await expect(row).toHaveCount(1)
  await row.locator('[data-nav]').filter({ hasText: '查看并送检' }).click({ noWaitAfter: true })
  await expect(page.locator('[data-return-confirm-root]')).toContainText(deliveryOrderNo)

  if (scenario.uploadReference) {
    await page.locator('[data-qc-reference-title]').fill(`${scenario.productionOrderNo} 第${scenario.returnIndex}次色差参考`)
    await page.locator('[data-qc-reference-description]').fill('全量跨端UI验收由买手在送检前上传并冻结。')
    await page.locator('[data-qc-reference-file]').setInputFiles('public/materials/fabric-main.jpg')
    await page.getByRole('button', { name: '上传质检参考资料' }).click()
    await expect(page.getByRole('status')).toContainText('质检参考资料已上传')
  }

  await page.getByRole('button', { name: '送检并生成质检任务' }).click()
  const status = await statusText(page)
  const qcTaskNo = extractNumber(status, /送检成功：([A-Z0-9-]+)/, '质检任务号')
  const printLink = page.locator('[data-nav*="print?type=SEND_QC"]')
  await expect(printLink).toBeVisible()
  await printLink.click({ noWaitAfter: true })
  await expect(page.getByRole('heading', { name: '后道送检单' })).toBeVisible()
  await expect(page.locator('tbody tr')).toHaveCount(5)
  await expect(page.locator('[data-business-document-barcode]')).toHaveAttribute('data-business-document-barcode', qcTaskNo)
  addStage(chain, page, 'Web送检及送检单打印', status, { qcTaskNo, printedSkuLines: 5 })
  return qcTaskNo
}

async function completeQcThroughWeb(
  page: Page,
  context: BrowserContext,
  scenario: CrossTerminalScenario,
  chain: ChainEvidence,
  qcTaskNo: string,
): Promise<{ postTaskNo?: string; recheckOrderNo?: string }> {
  await setCurrentWebActor(page, 'PF-USER-QC-A')
  await page.goto('/fcs/craft/post-finishing/qc-orders')
  const taskInput = page.locator('[data-qc-task-input]')
  await taskInput.fill(qcTaskNo)
  await page.getByRole('button', { name: '领取并开始质检' }).click()
  await expect(page).toHaveURL(new RegExp(`taskNo=${encodeURIComponent(qcTaskNo)}`))
  await expect(page.locator('[data-qc-result-line]')).toHaveCount(5)

  if (scenario.qcClaimConflictAndRelease) {
    const conflictPage = await context.newPage()
    conflictPage.setDefaultTimeout(15_000)
    conflictPage.setDefaultNavigationTimeout(30_000)
    await conflictPage.goto('/fcs/craft/post-finishing/qc-orders')
    await setCurrentWebActor(conflictPage, 'PF-USER-QC-B')
    await conflictPage.goto('/fcs/craft/post-finishing/qc-orders')
    await conflictPage.locator('[data-qc-task-input]').fill(qcTaskNo)
    await conflictPage.getByRole('button', { name: '领取并开始质检' }).click()
    await expect(conflictPage.getByRole('status')).toContainText('已由 李质检员 质检中')
    await setCurrentWebActor(conflictPage, 'PF-USER-QC-A')
    await conflictPage.close()
    await page.getByRole('button', { name: '错误领取，退回待质检' }).click()
    await page.locator('[data-qc-release-reason]').fill('全量跨端UI验收：验证退领后继续完成同一链')
    await page.getByRole('button', { name: '确认退领' }).click()
    await expect(page.getByRole('status')).toContainText('已退回待质检')
    await page.getByRole('button', { name: '领取任务' }).click()
    await expect(page.getByRole('status')).toContainText('领取成功')
  }

  const lines = page.locator('[data-qc-result-line]')
  for (let index = 0; index < 5; index += 1) {
    const line = lines.nth(index)
    await line.locator('[data-qc-result-field="passedQty"]').fill(await line.locator('[data-qc-result-field="passedQty"]').inputValue())
    await line.locator('[data-qc-result-field="defectQty"]').fill('0')
    await line.locator('[data-qc-result-field="returnQty"]').fill('0')
  }

  const firstLine = lines.first()
  const firstPassed = firstLine.locator('[data-qc-result-field="passedQty"]')
  const firstExpected = Number(await firstPassed.inputValue())
  if (scenario.qcScenario === 'balanced-defect') {
    await firstPassed.fill(String(firstExpected - 1))
    await firstLine.locator('[data-qc-result-field="defectQty"]').fill('1')
    await firstLine.locator('[data-qc-result-field="defectReason"]').fill('色差')
    await firstLine.locator('[data-qc-result-field="responsibleParty"]').fill('车缝验收工厂')
    await firstLine.locator('[data-qc-result-file="defectImage"]').setInputFiles('public/materials/fabric-main.jpg')
  }
  if (scenario.qcScenario === 'balanced-return') {
    await firstPassed.fill(String(firstExpected - 1))
    await firstLine.locator('[data-qc-result-field="returnQty"]').fill('1')
    await firstLine.locator('[data-qc-result-field="returnReason"]').fill('尺寸偏差返厂复修')
    await firstLine.locator('[data-qc-result-field="returnReceiver"]').fill('车缝验收工厂 3')
  }
  if (scenario.qcScenario === 'difference') {
    await firstPassed.fill(String(firstExpected - 1))
    await expect(page.locator('[data-qc-difference-authorization]')).toBeVisible()
    const payload = await freshAuthorizationPayload(context, 'AUTH-POST-001')
    await page.locator('[data-qc-difference-reason]').fill('全量跨端UI验收：质检首个SKU少1件')
    await page.locator('[data-qc-authorization]').fill(payload)
    chain.authorizationStages.push('Web质检')
    await saveScreenshot(page, chain, 'qc-authorization')
  }

  await page.locator('[data-qc-need-post]').selectOption(scenario.needPost ? 'yes' : 'no')
  await page.getByRole('button', { name: '完成质检并生成下一环节' }).click()
  const status = await statusText(page)
  await expect(page.locator('body')).toContainText('质检完成')
  const postTaskNo = scenario.needPost
    ? extractNumber(status, /后道任务 ([A-Z0-9-]+)/, '后道任务号')
    : undefined
  const recheckOrderNo = !scenario.needPost
    ? extractNumber(status, /复检单 ([A-Z0-9-]+)/, '复检单号')
    : undefined

  if (!scenario.needPost) {
    await page.locator('[data-nav]').filter({ hasText: '查看下游单据' }).click({ noWaitAfter: true })
    await expect(page.locator('body')).toContainText(recheckOrderNo!)
  }
  addStage(chain, page, 'Web质检完成', status, {
    qcScenario: scenario.qcScenario,
    needPost: scenario.needPost,
    downstreamNo: postTaskNo || recheckOrderNo || '',
  })
  if (scenario.qcScenario !== 'normal' || scenario.qcClaimConflictAndRelease) await saveScreenshot(page, chain, 'web-qc-completed')
  return { postTaskNo, recheckOrderNo }
}

async function completePostThroughPda(
  page: Page,
  context: BrowserContext,
  scenario: CrossTerminalScenario,
  chain: ChainEvidence,
  postTaskNo: string,
): Promise<string> {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto(`/fcs/craft/post-finishing/work-orders?keyword=${encodeURIComponent(postTaskNo)}`)
  const taskRow = page.locator('tbody tr').filter({ hasText: postTaskNo })
  await expect(taskRow).toHaveCount(1)
  await taskRow.locator('[data-nav]').filter({ hasText: '打印' }).click({ noWaitAfter: true })
  await expect(page.getByRole('heading', { name: '后道工序加工单' })).toBeVisible()
  await expect(page.locator('[data-business-document-barcode]')).toHaveAttribute('data-business-document-barcode', postTaskNo)
  await expect(page.locator('tbody tr')).toHaveCount(5)
  addStage(chain, page, 'Web后道加工单打印', undefined, { postTaskNo, printedSkuLines: 5 })

  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/fcs/pda/post-finishing/execute')
  await fillScanAndWaitForRefresh(page, page.locator('[data-pda-post-field="postScan"]'), postTaskNo, {
    queryKey: 'id',
    queryValue: postTaskNo,
    resultSelector: '[data-post-completion-line]',
    resultCount: 5,
  })
  await page.getByRole('button', { name: '核对无误，开始后道' }).click()
  await expect(page.locator('[data-post-completion-line]')).toHaveCount(5)
  await expect(page.getByRole('button', { name: '还有 5 个 SKU 未完成数量归类' })).toBeDisabled()

  if (scenario.postScenario === 'web-fallback') {
    const firstPdaLine = page.locator('[data-post-completion-line]').first()
    const firstPdaQuantity = firstPdaLine.locator('[data-post-completed-qty]')
    await firstPdaQuantity.fill(await firstPdaQuantity.getAttribute('max') || '0')
    await firstPdaLine.getByRole('button', { name: '保存' }).click()
    await expect(page.getByText('1 / 5 个 SKU', { exact: true })).toBeVisible()
    await setCurrentWebActor(page, 'PF-USER-POST')
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto(`/fcs/craft/post-finishing/work-orders/${encodeURIComponent(postTaskNo)}`)
    await expect(page.getByText('任务当前由 全能力测试工厂_操作工 处理')).toBeVisible()
    await page.locator('[data-web-post-takeover-reason]').fill('PDA故障，转Web继续')
    await page.getByRole('button', { name: '确认应急接管' }).click()
    await expect(page.getByRole('status')).toContainText('Web 应急接管成功')
    for (let completed = 2; completed <= 5; completed += 1) {
      const pendingLine = page.locator('[data-web-post-completion-line]').filter({ has: page.locator('[data-web-post-completed-qty][value=""]') }).first()
      const quantity = pendingLine.locator('[data-web-post-completed-qty]')
      await quantity.fill(await quantity.getAttribute('max') || '0')
      await pendingLine.getByRole('button', { name: '保存' }).click()
      await expect(page.getByText(`${completed} / 5 已处理`, { exact: true })).toBeVisible()
    }
    await expect(page.getByRole('button', { name: '完成后道并生成复检单' })).toBeEnabled()
  } else {
    for (let completed = 1; completed <= 5; completed += 1) {
      const pendingLine = page.locator('[data-post-completion-line]').filter({ has: page.locator('[data-post-completed-qty][value=""]') }).first()
      const quantity = pendingLine.locator('[data-post-completed-qty]')
      await quantity.fill(await quantity.getAttribute('max') || '0')
      await pendingLine.getByRole('button', { name: '保存' }).click()
      await expect(page.getByText(`${completed} / 5 个 SKU`, { exact: true })).toBeVisible()
    }
    await expect(page.getByRole('button', { name: '完成后道并生成复检单' })).toBeEnabled()
  }

  if (scenario.postScenario === 'balanced-defect') {
    await page.locator('[data-post-completion-line]').first().getByText('调整瑕疵').click()
    await page.locator('[data-post-defect-reason-qty][data-reason="压痕"]').fill('1')
    await page.getByRole('button', { name: '保存并返回后道单' }).click()
    await expect(page.locator('[data-post-completion-line]').first()).toContainText('瑕疵 1 件')
  }

  await page.getByRole('button', { name: '完成后道并生成复检单' }).click()
  const status = await statusText(page)
  const recheckOrderNo = extractNumber(status, /后道完成，复检单 ([A-Z0-9-]+)/, '复检单号')
  addStage(chain, page, scenario.postScenario === 'web-fallback' ? 'Web应急后道完成' : 'PDA后道完成', status, { postScenario: scenario.postScenario, recheckOrderNo })
  if (scenario.postScenario !== 'normal') await saveScreenshot(page, chain, 'pda-post-completed')
  return recheckOrderNo
}

async function completeRecheckThroughPda(
  page: Page,
  context: BrowserContext,
  scenario: CrossTerminalScenario,
  chain: ChainEvidence,
  recheckOrderNo: string,
): Promise<string> {
  await page.setViewportSize({ width: 400, height: 806 })
  await page.goto('/fcs/pda/post-finishing/recheck')
  await fillScanAndWaitForRefresh(page, page.locator('[data-pda-post-field="recheckScan"]'), recheckOrderNo, {
    queryKey: 'id',
    queryValue: recheckOrderNo,
    resultSelector: '[data-recheck-result-line]',
    resultCount: 5,
  })

  if (scenario.recheckRelease) {
    await page.getByRole('button', { name: '错误领取，释放' }).click()
    await expect(page.getByRole('status')).toContainText('已释放并回到待复检')
    await page.goto('/fcs/pda/post-finishing/recheck')
    await fillScanAndWaitForRefresh(page, page.locator('[data-pda-post-field="recheckScan"]'), recheckOrderNo, {
      queryKey: 'id',
      queryValue: recheckOrderNo,
      resultSelector: '[data-recheck-result-line]',
      resultCount: 5,
    })
  }

  const barcodes = expectedSkuBarcodes(scenario.orderIndex)
  if (scenario.barcodeError) {
    let firstLine = page.locator('[data-recheck-result-line]').first()
    await firstLine.locator('[data-recheck-barcode-input]').fill('WRONG-CROSS-TERMINAL-BARCODE')
    await firstLine.getByRole('button', { name: '比对' }).click()
    await expect(page.getByRole('status')).toContainText('条码错误，已阻断出货')
    firstLine = page.locator('[data-recheck-result-line]').first()
    await firstLine.locator('[data-nav]').filter({ hasText: '打印正确 SKU 贴标' }).click({ noWaitAfter: true })
    await expect(page.locator('[data-testid="post-finishing-sku-label-print"]')).toBeVisible()
    await expect(page.locator('[data-sku-label-barcode]')).toHaveAttribute('data-sku-label-barcode', barcodes[0])
    await page.goBack()
    await expect(page.locator('[data-recheck-result-line]')).toHaveCount(5)
    await page.locator('[data-recheck-result-line]').first().getByRole('button', { name: '已重新贴码' }).click()
    await expect(page.locator('body')).toContainText('已重贴待复扫')
    await saveScreenshot(page, chain, 'barcode-relabel-block')
  }

  for (let index = 0; index < 5; index += 1) {
    const line = page.locator('[data-recheck-result-line]').nth(index)
    await line.locator('[data-recheck-barcode-input]').fill(barcodes[index]!)
    await line.getByRole('button', { name: '比对' }).click()
    await expect(page.getByRole('status')).toContainText('条码正确')
  }

  const lines = page.locator('[data-recheck-result-line]')
  for (let index = 0; index < 5; index += 1) {
    const line = lines.nth(index)
    await line.locator('[data-recheck-result-field="passedQty"]').fill(await line.locator('[data-recheck-result-field="passedQty"]').inputValue())
    await line.locator('[data-recheck-result-field="defectQty"]').fill('0')
  }
  const first = lines.first()
  const firstPassed = first.locator('[data-recheck-result-field="passedQty"]')
  const firstExpected = Number(await firstPassed.inputValue())
  if (scenario.recheckScenario === 'balanced-defect') {
    await firstPassed.fill(String(firstExpected - 1))
    await first.locator('[data-recheck-result-field="defectQty"]').fill('1')
  }
  if (scenario.recheckScenario === 'difference') {
    await firstPassed.fill(String(firstExpected - 1))
    await expect(page.locator('[data-difference-authorization-block="recheck"]')).toBeVisible()
    const payload = await freshAuthorizationPayload(context, 'AUTH-QC-001')
    await page.locator('[data-recheck-difference-reason]').fill('全量跨端UI验收：复检首个SKU少1件')
    await page.locator('[data-recheck-authorization]').fill(payload)
    chain.authorizationStages.push('PDA复检')
    await saveScreenshot(page, chain, 'recheck-authorization')
  }

  await page.getByRole('button', { name: '完成复检' }).click()
  const status = await statusText(page)
  const outboundOrderNo = extractNumber(status, /复检完成，已进入后道待交出仓并生成出货单 (FCK-[A-Z0-9-]+)/, '后道出货单号')
  await expect(page.locator('body')).toContainText(`复检合格品已进入后道待交出仓，并生成唯一出货单：${outboundOrderNo}`)
  addStage(chain, page, 'PDA复检完成', status, {
    recheckScenario: scenario.recheckScenario,
    barcodeErrorRecovered: scenario.barcodeError,
    outboundOrderNo,
  })
  return outboundOrderNo
}

async function receiveOutboundAcrossWebAndPda(
  page: Page,
  context: BrowserContext,
  scenario: CrossTerminalScenario,
  chain: ChainEvidence,
  outboundOrderNo: string,
): Promise<void> {
  await page.setViewportSize({ width: 1366, height: 768 })
  const skuCode = `SPU-QC-${String(scenario.orderIndex + 1).padStart(3, '0')}-01`
  await page.goto('/fcs/craft/post-finishing/wait-handover-warehouse?tab=inventory')
  await expect(page.getByRole('heading', { name: '后道待交出仓' })).toBeVisible()
  await page.locator('[data-post-finishing-field="warehouse-availability"]').selectOption('available')
  await page.locator('[data-post-finishing-field="warehouse-keyword"]').fill(skuCode)
  await page.locator('[data-post-finishing-action="full-flow-query"]').click()
  const readyRow = page.locator('tbody tr').filter({ hasText: skuCode })
  await expect(readyRow).toHaveCount(1)
  await readyRow.getByRole('button', { name: '库存明细' }).click()
  const readyDrawer = page.locator('[data-warehouse-inventory-drawer]')
  await expect(readyDrawer).toContainText(chain.deliveryOrderNo!)
  await expect(readyDrawer).toContainText(outboundOrderNo)
  await expect(readyDrawer).toContainText('待交出')
  const readyScreenshot = await saveScreenshot(page, chain, 'wait-handover-ready')
  addStage(chain, page, 'Web待交出仓入仓核对', '待交出', {
    outboundOrderNo,
    skuCount: 5,
    screenshot: readyScreenshot || '',
  })
  await page.locator('[data-post-finishing-action="full-flow-close-overlay"]').last().click()

  await page.goto(`/fcs/craft/post-finishing/outbound-orders?keyword=${encodeURIComponent(outboundOrderNo)}`)
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await page.locator('[data-nav]').filter({ hasText: '详情与打印' }).click({ noWaitAfter: true })
  await expect(page.locator('body')).toContainText(chain.deliveryOrderNo!)
  await expect(page.locator('body')).toContainText(chain.qcTaskNo!)
  await expect(page.locator('body')).toContainText(chain.recheckOrderNo!)
  if (chain.postTaskNo) await expect(page.locator('body')).toContainText(chain.postTaskNo)
  await expect(page.locator('tbody tr')).toHaveCount(5)
  await page.locator('[data-nav]').filter({ hasText: '打印后道出货单及出货单条码' }).click({ noWaitAfter: true })
  await expect(page.getByRole('heading', { name: '后道出货单' })).toBeVisible()
  await expect(page.locator('[data-business-document-barcode]')).toHaveAttribute('data-business-document-barcode', outboundOrderNo)
  await expect(page.locator('[data-scan-target]')).toHaveAttribute('data-scan-target', /\/fcs\/pda\/post-finishing\/outbound-receive/)
  addStage(chain, page, 'Web出货核对及出货单打印', undefined, { outboundOrderNo, printedSkuLines: 5 })

  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/fcs/pda/post-finishing/outbound-receive')
  await fillScanAndWaitForRefresh(page, page.locator('[data-pda-post-field="outboundScan"]'), outboundOrderNo, {
    queryKey: 'id',
    queryValue: outboundOrderNo,
    resultSelector: '[data-outbound-result-line]',
    resultCount: 5,
  })
  const lines = page.locator('[data-outbound-result-line]')
  for (let index = 0; index < 5; index += 1) {
    const input = lines.nth(index).locator('[data-outbound-result-field="receivedQty"]')
    await input.fill(await input.inputValue())
  }
  if (scenario.warehouseDifference) {
    const first = lines.first().locator('[data-outbound-result-field="receivedQty"]')
    const expected = Number(await first.inputValue())
    await first.fill(String(expected - 1))
    await expect(page.locator('[data-difference-authorization-block="warehouse"]')).toBeVisible()
    const payload = await freshAuthorizationPayload(context, 'AUTH-POST-001')
    await page.locator('[data-warehouse-difference-reason]').fill('全量跨端UI验收：仓库首个SKU少收1件')
    await page.locator('[data-warehouse-authorization]').fill(payload)
    chain.authorizationStages.push('PDA仓库收货')
    await saveScreenshot(page, chain, 'warehouse-authorization')
  }
  await page.getByRole('button', { name: '确认收货入库' }).click()
  const status = await statusText(page)
  await expect(page.getByRole('status')).toContainText('收货入库成功')
  await expect(page.locator('body')).toContainText('接收入库')
  chain.finalScreenshot = await saveScreenshot(page, chain, 'warehouse-received')
  addStage(chain, page, 'PDA仓库收货', status, {
    warehouseDifference: scenario.warehouseDifference,
    receivedSkuLines: 5,
  })

  if (scenario.duplicateReceipt) {
    await page.goto('/fcs/pda/post-finishing/outbound-receive')
    await fillScanAndWaitForRefresh(page, page.locator('[data-pda-post-field="outboundScan"]'), outboundOrderNo, {
      queryKey: 'id',
      queryValue: outboundOrderNo,
    })
    await expect(page.locator('body')).toContainText('重复扫描仅只读展示，不会重复入库')
    addStage(chain, page, 'PDA重复收货幂等复核', '重复扫描只读', { duplicateWriteBlocked: true })
  }

  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/fcs/craft/post-finishing/wait-handover-warehouse?tab=inventory')
  await page.locator('[data-post-finishing-field="warehouse-availability"]').selectOption('all')
  await page.locator('[data-post-finishing-field="warehouse-keyword"]').fill(skuCode)
  await page.locator('[data-post-finishing-action="full-flow-query"]').click()
  const handedRow = page.locator('tbody tr').filter({ hasText: skuCode })
  await expect(handedRow).toHaveCount(1)
  await handedRow.getByRole('button', { name: '库存明细' }).click()
  const handedDrawer = page.locator('[data-warehouse-inventory-drawer]')
  await expect(handedDrawer).toContainText(chain.deliveryOrderNo!)
  await expect(handedDrawer).toContainText('已交出')
  await expect(handedDrawer).toContainText('当前库存0 件')
  addStage(chain, page, 'Web待交出仓交出回查', '已交出', { availableQty: 0 })

  await page.goto(`/fcs/craft/post-finishing/outbound-orders?keyword=${encodeURIComponent(outboundOrderNo)}`)
  await page.locator('[data-nav]').filter({ hasText: '详情与打印' }).click({ noWaitAfter: true })
  await expect(page.locator('body')).toContainText('全能力测试工厂_操作工')
  await expect(page.locator('body')).toContainText('已接收')
  addStage(chain, page, 'Web收货结果回查', undefined, { received: true })
}

async function readFinalSnapshot(page: Page): Promise<unknown> {
  return page.evaluate(async () => {
    const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
    const logs = await import('/src/data/fcs/post-finishing-operation-log.ts')
    const authorization = await import('/src/data/fcs/post-finishing-authorization.ts')
    const deliveries = flow.listPostFinishingFactoryReturns()
    return {
      totals: {
        productionOrders: new Set(deliveries.map((item) => item.productionOrderNo)).size,
        deliveries: deliveries.length,
        skuReturnLines: deliveries.reduce((sum, item) => sum + item.lines.length, 0),
        qcTasks: flow.listPostFinishingFullFlowQcTasks().length,
        postTasks: flow.listPostFinishingFullFlowPostTasks().length,
        recheckOrders: flow.listPostFinishingFullFlowRecheckOrders().length,
        outboundOrders: flow.listPostFinishingFullFlowOutboundOrders().length,
        warehouseReceipts: flow.listPostFinishingWarehouseReceipts().length,
        waitProcessWarehouseRecords: flow.listPostFinishingWaitProcessWarehouseRecords().length,
        waitProcessWarehouseMovements: flow.listPostFinishingWaitProcessWarehouseMovements().length,
        waitHandoverWarehouseRecords: flow.listPostFinishingWaitHandoverWarehouseRecords().length,
        waitHandoverWarehouseMovements: flow.listPostFinishingWaitHandoverWarehouseMovements().length,
        defects: flow.listPostFinishingDefectRecords().length,
        operationLogs: logs.listPostFinishingOperationLogs().length,
        authorizationConsumptions: authorization.listPostFinishingAuthorizationConsumptions().length,
      },
      chains: deliveries.map((delivery) => {
        const trace = flow.tracePostFinishingFullFlow(delivery.deliveryOrderNo)
        return {
          productionOrderNo: delivery.productionOrderNo,
          returnIndex: delivery.returnIndex,
          deliveryOrderNo: delivery.deliveryOrderNo,
          qcTaskNo: trace.qcTask?.qcTaskNo,
          postTaskNo: trace.postTask?.postTaskNo,
          recheckOrderNo: trace.recheckOrder?.recheckOrderNo,
          outboundOrderNo: trace.outboundOrder?.outboundOrderNo,
          waitHandoverWarehouseRecordId: trace.waitHandoverRecord?.warehouseRecordId,
          waitHandoverStatus: trace.waitHandoverRecord?.status,
          warehouseReceiptNo: trace.receipt?.receiptNo,
          warehouseReceived: Boolean(trace.receipt),
        }
      }),
    }
  })
}

test('15条链逐条跨公共PDA、Web质检、PDA后道复检与仓库收货连续走通', async ({ page, context }, testInfo: TestInfo) => {
  test.setTimeout(30 * 60_000)
  page.setDefaultTimeout(15_000)
  page.setDefaultNavigationTimeout(30_000)
  expect(scenarios).toHaveLength(15)
  expect(new Set(scenarios.map((scenario) => scenario.productionOrderNo)).size).toBe(3)
  for (const productionOrderNo of PRODUCTION_ORDERS) {
    expect(scenarios.filter((scenario) => scenario.productionOrderNo === productionOrderNo)).toHaveLength(5)
  }

  await page.goto('/fcs/pda/warehouse')
  await page.evaluate(() => {
    window.localStorage.clear()
    window.localStorage.setItem('higood-fcs-post-finishing-demo-mode-v1', 'empty')
  })
  await page.reload()
  await setPdaSession(page)
  await setCurrentWebActor(page, 'PF-USER-QC-A')
  await page.goto('/fcs/craft/post-finishing/wait-process-warehouse')
  await expect(page.locator('[data-return-card]')).toHaveCount(0)

  for (let index = 0; index < scenarios.length; index += 1) {
    const scenario = scenarios[index]!
    const chain: ChainEvidence = {
      chainIndex: index + 1,
      productionOrderNo: scenario.productionOrderNo,
      returnIndex: scenario.returnIndex,
      label: scenario.label,
      stages: [],
      authorizationStages: [],
    }
    evidence.chains.push(chain)
    persistEvidence()

    chain.deliveryOrderNo = await registerReturnThroughPublicPda(page, scenario, chain)
    if (index % 2 === 0) await confirmReturnThroughWeb(page, context, scenario, chain, chain.deliveryOrderNo)
    else await confirmReturnThroughPda(page, context, scenario, chain, chain.deliveryOrderNo)
    chain.qcTaskNo = await sendToQcThroughWeb(page, scenario, chain, chain.deliveryOrderNo)
    const qcResult = await completeQcThroughWeb(page, context, scenario, chain, chain.qcTaskNo)
    chain.postTaskNo = qcResult.postTaskNo
    chain.recheckOrderNo = qcResult.recheckOrderNo
    if (chain.postTaskNo) {
      chain.recheckOrderNo = await completePostThroughPda(page, context, scenario, chain, chain.postTaskNo)
    }
    chain.outboundOrderNo = await completeRecheckThroughPda(page, context, scenario, chain, chain.recheckOrderNo!)
    await receiveOutboundAcrossWebAndPda(page, context, scenario, chain, chain.outboundOrderNo)
    persistEvidence()
  }

  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/fcs/craft/post-finishing/wait-process-warehouse?tab=movements')
  await expect(page.getByRole('heading', { name: '后道待加工仓' })).toBeVisible()
  await page.locator('[data-post-finishing-field="pageSize"]').selectOption('50')
  await expect(page.locator('[data-wait-process-movement]')).toHaveCount(30)
  await expect(page.getByText('缺少送货单。', { exact: true })).toHaveCount(0)
  await saveSurfaceScreenshot(page, 'wait-process-warehouse')

  await page.goto('/fcs/craft/post-finishing/wait-handover-warehouse?tab=movements')
  await expect(page.getByRole('heading', { name: '后道待交出仓' })).toBeVisible()
  await page.locator('[data-post-finishing-field="pageSize"]').selectOption('50')
  await expect(page.locator('[data-wait-handover-movement]')).toHaveCount(30)
  await expect(page.locator('body')).toContainText('复检完成入仓')
  await expect(page.locator('body')).toContainText('后道出货交出')
  await expect(page.getByText('缺少送货单。', { exact: true })).toHaveCount(0)
  await saveSurfaceScreenshot(page, 'wait-handover-warehouse')

  await setCurrentWebActor(page, 'PF-USER-QC-MGR')
  await page.goto('/fcs/craft/post-finishing/qc-orders')
  await expect(page.getByRole('heading', { name: '质检任务', exact: true })).toBeVisible()
  await expect(page.locator('[data-qc-task-input]')).toBeVisible()
  await expect(page.getByRole('heading', { name: '质检任务管理' })).toBeVisible()
  await saveSurfaceScreenshot(page, 'qc-task')

  await page.goto('/fcs/craft/post-finishing/audit-records')
  await expect(page.getByRole('heading', { name: '差异与操作日志' })).toBeVisible()
  await expect(page.locator('[data-standard-list-table-section] tbody tr')).toHaveCount(10)
  await page.getByRole('link', { name: '查看详情' }).first().click()
  await expect(page.locator('[data-audit-chain-detail]')).toBeVisible()
  await expect(page.getByRole('heading', { name: '1. 回货与质检' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '逐 SKU 数量差异' })).toHaveCount(0)
  await page.getByRole('link', { name: '差异与瑕疵' }).click()
  await expect(page.getByRole('heading', { name: '逐 SKU 数量差异' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '瑕疵记录' })).toBeVisible()
  await page.getByRole('link', { name: '操作时间线' }).click()
  await expect(page.getByRole('heading', { name: '按环节归组的操作记录' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '逐 SKU 数量差异' })).toHaveCount(0)
  await saveSurfaceScreenshot(page, 'audit-chain-detail')

  await page.goto('/fcs/craft/post-finishing/authorization-code')
  await expect(page.getByRole('heading', { name: '我的动态授权码' })).toBeVisible()
  await expect(page.locator('[data-authorization-scan-payload]')).toHaveText(/^PFAUTH:/)
  await saveSurfaceScreenshot(page, 'authorization-code')

  const snapshot = await readFinalSnapshot(page)
  const totals = (snapshot as { totals: Record<string, number> }).totals
  expect(totals.productionOrders).toBe(3)
  expect(totals.deliveries).toBe(15)
  expect(totals.skuReturnLines).toBe(75)
  expect(totals.qcTasks).toBe(15)
  expect(totals.postTasks).toBe(12)
  expect(totals.recheckOrders).toBe(15)
  expect(totals.outboundOrders).toBe(15)
  expect(totals.warehouseReceipts).toBe(15)
  expect(totals.waitProcessWarehouseRecords).toBe(15)
  expect(totals.waitProcessWarehouseMovements).toBe(30)
  expect(totals.waitHandoverWarehouseRecords).toBe(15)
  expect(totals.waitHandoverWarehouseMovements).toBe(30)
  expect(totals.authorizationConsumptions).toBe(4)
  const finalChains = (snapshot as { chains: Array<{ warehouseReceived: boolean; waitHandoverStatus?: string }> }).chains
  expect(finalChains).toHaveLength(15)
  expect(finalChains.every((chain) => chain.warehouseReceived)).toBe(true)
  expect(finalChains.every((chain) => chain.waitHandoverStatus === '已交出')).toBe(true)

  evidence.finalSnapshot = snapshot
  evidence.finishedAt = new Date().toISOString()
  persistEvidence()
  await testInfo.attach('cross-terminal-ui-evidence', {
    body: Buffer.from(JSON.stringify(evidence, null, 2)),
    contentType: 'application/json',
  })
})

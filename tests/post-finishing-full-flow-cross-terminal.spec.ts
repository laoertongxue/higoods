import { expect, test, type BrowserContext, type Locator, type Page, type TestInfo } from '@playwright/test'
import { dirname, resolve } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'

type QcScenario = 'normal' | 'balanced-defect' | 'balanced-return' | 'difference'
type PostScenario = 'normal' | 'partial-then-continue' | 'web-fallback'
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
  barcodeError: boolean
  verifyColorImages: boolean
  qcClaimConflict: boolean
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
      needPost: orderIndex === 0,
      postScenario: 'normal',
      barcodeError: false,
      verifyColorImages: returnIndex === 1,
      qcClaimConflict: key === '1-1',
    }
    if (key === '1-2') return { ...base, label: '回货 -5%边界且后道全链路', returnScenario: 'minus-5-boundary' }
    if (key === '1-3') return { ...base, label: '回货超过5%复点与动态授权', returnScenario: 'over-5-authorization' }
    if (key === '1-4') return { ...base, label: '质检瑕疵守恒、后道部分完成后继续余量', qcScenario: 'balanced-defect', postScenario: 'partial-then-continue' }
    if (key === '1-5') return { ...base, label: '出货SKU与业务条码核对，不设复检门槛', barcodeError: true }
    if (key === '2-1') return { ...base, label: '回货 +5%边界、款式颜色图片及质检直达成衣仓' , returnScenario: 'plus-5-boundary' }
    if (key === '2-2') return { ...base, label: '全检不足1件不得完成，补足后直接出货', qcScenario: 'difference' }
    if (key === '2-3') return { ...base, label: '漏做烫包，PDA登记后由Web继续并做交出差异授权', needPost: true, postScenario: 'web-fallback' }
    if (key === '2-4') return { ...base, label: '空项目仍走准备出货和实际发出' }
    if (key === '2-5') return { ...base, label: '漏做烫包后的出货单与待交出库存核对', needPost: true }
    if (key === '3-1') return { ...base, label: '质检返工守恒及返工工厂选择', qcScenario: 'balanced-return' }
    if (key === '3-2') return { ...base, label: '漏做项目进入后道后正常完成处理后复核', needPost: true }
    if (key === '3-3') return { ...base, label: '漏做项目进入后道部分完成后继续余量', needPost: true, postScenario: 'partial-then-continue' }
    if (key === '3-4') return { ...base, label: '原加工完成直接出货且无复检退领入口', needPost: true, barcodeError: true }
    if (key === '3-5') return { ...base, label: '空项目按出货准备、实际发出后进入成衣仓待接收' }
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
  writeBoundary: '开始时在隔离浏览器按事务重置后道测试记录并写入 PDA 测试会话；除此之外全部业务写入由 Web/PDA 页面操作产生；结束时只读业务事实用于核对。',
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
  if(page.url()==='about:blank')await page.goto('/fcs/craft/post-finishing/qc-orders')
  await page.evaluate((id) => {
    window.localStorage.setItem('higood-fcs-post-finishing-current-actor-v1', id)
  }, actorId)
}
async function setPostFactorySession(page: Page): Promise<void> {
  await page.evaluate(()=>localStorage.setItem('fcs_pda_session',JSON.stringify({userId:'ID-F002_operator',loginId:'ID-F002_operator',userName:'后道工厂_操作工',roleId:'ROLE_OPERATOR',factoryId:'ID-F002',factoryName:'后道工厂',loggedAt:'2026-10-22T01:00:00Z'})))
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
  await expect(page.getByRole('status')).toContainText('登记成功')
  const status = await statusText(page)
  const deliveryOrderNo = extractNumber(status, /登记成功：(PO-[^，\s]+)/, '送货单号')
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

  await expect(page.getByRole('status')).toContainText('回货确认成功')
  const status = await statusText(page)
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

  await expect(page.getByRole('status')).toContainText('数量已进入后道待加工仓')
  const status = await statusText(page)
  await expect(page.getByRole('status')).toContainText('质检单')
  await expect(page.getByRole('status')).toContainText('已自动生成')
  await expect(page.locator('body')).toContainText('确认送检出库')
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

  await page.getByRole('button', { name: '确认送检出库' }).click()
  await expect(page.getByRole('status')).toContainText('送检成功：')
  const status = await statusText(page)
  const qcTaskNo = extractNumber(status, /送检成功：([A-Z0-9-]+)/, '质检任务号')
  const printLink = page.locator('[data-nav*="print?type=SEND_QC"]')
  await expect(printLink).toBeVisible()
  await printLink.click({ noWaitAfter: true })
  await expect(page.getByRole('heading', { name: '后道送检单' })).toBeVisible()
  await expect(page.locator('tbody').first().locator('tr')).toHaveCount(5)
  await expect(page.locator('[data-business-document-barcode]')).toHaveAttribute('data-business-document-barcode', qcTaskNo)
  addStage(chain, page, 'Web送检及送检单打印', status, { qcTaskNo, printedSkuLines: 5 })
  return qcTaskNo
}

async function completeQcThroughWeb(page:Page,context:BrowserContext,scenario:CrossTerminalScenario,chain:ChainEvidence,qcTaskNo:string):Promise<{postTaskNo?:string;outboundOrderNo?:string}> {
  await setCurrentWebActor(page,'PF-USER-QC-A')
  await page.goto('/fcs/craft/post-finishing/qc-workbench')
  await page.locator('[data-post-finishing-field="qc-task-input"]').fill(qcTaskNo)
  await page.getByRole('button',{name:'领取并固定本次检查要求',exact:true}).click()
  await expect(page.locator('[data-qc-result-line]')).toHaveCount(5)
  if(scenario.verifyColorImages) {
    await expect(page.locator('[data-qc-result-line] img')).toHaveCount(5)
    expect(await page.locator('[data-qc-result-line] img').evaluateAll(nodes=>nodes.every(node=>(node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth>0))).toBe(true)
  }
  if(scenario.qcClaimConflict) {
    const other=await context.newPage();await setCurrentWebActor(other,'PF-USER-QC-B');await other.goto('/fcs/craft/post-finishing/qc-workbench')
    await other.locator('[data-post-finishing-field="qc-task-input"]').fill(qcTaskNo)
    await other.getByRole('button',{name:'领取并固定本次检查要求',exact:true}).click()
    await expect(other.getByRole('alert')).toContainText(/已由|其他|质检中/)
    await expect(other.getByRole('button',{name:/退领|释放|接替/})).toHaveCount(0)
    await setCurrentWebActor(other,'PF-USER-QC-A');await other.close()
    // The competing command may retain an audit fact. Respect the original
    // page's namespace CAS and reread before entering this round's new counts.
    await page.reload();await expect(page.locator('[data-qc-result-line]')).toHaveCount(5)
    await expect(page.getByRole('button',{name:/退领|释放|接替/})).toHaveCount(0)
  }
  const lines=page.locator('[data-qc-result-line]')
  for(let i=0;i<5;i++) {
    const row=lines.nth(i),n=Number(await row.getAttribute('data-remaining'))
    const defect=i===0&&scenario.qcScenario==='balanced-defect'?1:0,rework=i===0&&scenario.qcScenario==='balanced-return'?1:0
    await row.locator('[data-qc-result-field="passedQty"]').fill(String(n-defect-rework-(i===0&&scenario.qcScenario==='difference'?1:0)))
    await row.locator('[data-qc-result-field="defectQty"]').fill(String(defect));await row.locator('[data-qc-result-field="returnQty"]').fill(String(rework))
    if(defect+rework) {await row.locator('[data-qc-issue="garment-fabric"]').check();await row.locator('[data-qc-issue-note]').fill('跨端隔离验收：按实际成衣记录面料问题')}
  }
  if(scenario.qcScenario==='difference') {
    await page.getByRole('button',{name:'提交第1轮检查',exact:true}).click()
    await expect(page.getByRole('alert')).toContainText(/尚需|未检查足|应检量/)
    await expect(page.locator('[data-qc-difference-authorization]')).toHaveCount(0)
    await lines.first().locator('[data-qc-result-field="passedQty"]').fill(await lines.first().getAttribute('data-remaining') || '0')
    addStage(chain,page,'全检未足不能用短少授权绕过','补齐实际检查后提交')
  }
  await page.getByRole('button',{name:'提交第1轮检查',exact:true}).click()
  await expect(page.getByRole('button',{name:'确认完成QC并生成对应去向',exact:true})).toBeVisible()
  expect(await page.getByRole('heading',{name:'处理本轮稽查'}).count()).toBe(0)
  await page.locator('[data-qc-paper-file]').setInputFiles({name:'跨端隔离双签纸单示例.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n% explicit synthetic two-signature fixture\n%%EOF')})
  await page.getByRole('button',{name:'上传并保存当前纸单',exact:true}).click()
  await expect(page.getByRole('link',{name:'跨端隔离双签纸单示例.pdf'})).toBeVisible()
  for(const input of await page.locator('[data-qc-process-item]').all())await input.uncheck()
  if(scenario.needPost)for(const item of (scenario.orderIndex===0?['开扣眼','装扣子','熨烫','包装']:['熨烫','包装']))await page.locator(`[data-qc-process-item][value="${item}"]`).check()
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'确认完成QC并生成对应去向',exact:true}).click()
  await expect(page.locator('[data-qc-workbench-task]')).toHaveCount(0)
  const result=await page.evaluate(async no=>{
    const db=await import('/src/data/pcs-record-db.ts'),data=await db.readPcsRecords(['higood-fcs-post-finishing-records'])
    const qc=data.records.find(row=>!row.deleted&&row.collection==='flow/qcTasks'&&(row.value as any).qcTaskNo===no)?.value as any
    if(!qc||qc.status!=='质检完成')throw Error('QC并未持久完成')
    const outbound=data.records.find(row=>!row.deleted&&row.collection==='flow/outboundOrders'&&(row.value as any).qcTaskId===qc.qcTaskId)?.value as any
    return {postTaskNo:qc.postTaskNo,outboundOrderNo:outbound?.outboundOrderNo,full:qc.inspection.percent===100}
  },qcTaskNo)
  expect(result.full).toBe(true)
  addStage(chain,page,'原Web分轮QC完成并保留双签','质检完成',{qcScenario:scenario.qcScenario,needPost:scenario.needPost,downstreamNo:result.postTaskNo||result.outboundOrderNo||''})
  return result
}

async function completePostThroughPda(
  page: Page,
  scenario: CrossTerminalScenario,
  chain: ChainEvidence,
  postTaskNo: string,
): Promise<string> {
  await setPostFactorySession(page)
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto(`/fcs/craft/post-finishing/work-orders?keyword=${encodeURIComponent(postTaskNo)}`)
  const taskRow = page.locator('tbody tr').filter({ hasText: postTaskNo })
  await expect(taskRow).toHaveCount(1)
  await taskRow.locator('[data-nav]').filter({ hasText: /^打印加工单$/ }).click({ noWaitAfter: true })
  await expect(page.getByRole('heading', { name: '后道加工单流转卡' })).toBeVisible()
  await expect(page.locator('[data-business-document-barcode]')).toHaveAttribute('data-business-document-barcode', postTaskNo)
  await expect(page.locator('tbody').first().locator('tr')).toHaveCount(5)
  addStage(chain, page, 'Web后道加工单打印', undefined, { postTaskNo, printedSkuLines: 5 })

  await page.setViewportSize({ width: 400, height: 786 })
  await page.goto('/fcs/pda/post-finishing/execute')
  const selected = scenario.orderIndex === 0 ? ['开扣眼', '装扣子', '熨烫', '包装'] : ['熨烫', '包装']
  await fillScanAndWaitForRefresh(page, page.locator('[data-pda-post-field="postScan"]'), postTaskNo, {
    queryKey: 'id',
    queryValue: postTaskNo,
    resultSelector: '[data-post-process]',
    resultCount: selected.length,
  })
  await expect(page.locator('[data-post-process]')).toHaveCount(selected.length)
  expect(await page.locator('[data-post-process]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-post-process')))).toEqual(selected)
  let webContinuation = false
  for (const processItem of selected) {
    if (scenario.postScenario === 'web-fallback' && processItem !== selected[0]) {
      if (!webContinuation) {
        await setCurrentWebActor(page, 'PF-USER-POST')
        await page.setViewportSize({ width: 1366, height: 768 })
        await page.goto(`/fcs/craft/post-finishing/work-orders/${encodeURIComponent(postTaskNo)}`)
        await expect(page.locator('[data-web-post-takeover-reason]')).toHaveCount(0)
        webContinuation = true
      }
      await page.locator(`[data-post-finishing-work-order-detail-action="open-register"][data-process-item="${processItem}"]`).click()
      await expect(page.locator('[data-post-entry-form]')).toBeVisible()
      await expect(page.locator('[data-post-entry-quantity]')).toHaveCount(5)
      for (const input of await page.locator('[data-post-entry-quantity]').all()) await input.fill(await input.getAttribute('max') || '0')
      await page.locator('[data-post-finishing-work-order-detail-action="save-entry"]').click()
      await expect(page.locator('[data-post-entry-form]')).toHaveCount(0)
    } else {
      const card = page.locator(`[data-post-process="${processItem}"]`)
      if ((await card.getAttribute('open')) === null) await card.locator(':scope > summary').click()
      const inputs = card.locator('[data-post-process-qty]')
      for (let index = 0; index < await inputs.count(); index++) {
        const input = inputs.nth(index)
        if (await input.isDisabled()) continue
        const maximum = Number(await input.getAttribute('max') || '0')
        await input.fill(String(scenario.postScenario === 'partial-then-continue' && processItem === selected[0] && index === 0 ? Math.max(0, maximum - 1) : maximum))
      }
      await card.locator('[data-pda-post-action="save-process-completion"]').click()
      await expect(page.locator('[data-pda-post-task] [role="status"]')).toContainText(`${processItem}本次已保存`)
    }
  }
  if (scenario.postScenario === 'partial-then-continue') {
    const partial = await page.evaluate(async no => {
      const flow = await (window as any).__postRuntime('full-flow')
      return { task: flow.getPostFinishingFullFlowPostTask(no), progress: flow.getPostFinishingProcessProgress(no) }
    }, postTaskNo)
    expect(partial.task?.status).toBe('后道中')
    expect(partial.progress.totalExpectedQty - partial.progress.totalCompletedQty).toBe(1)
    for (const processItem of selected) {
      const card = page.locator(`[data-post-process="${processItem}"]`)
      if ((await card.getAttribute('open')) === null) await card.locator(':scope > summary').click()
      await card.locator('[data-post-process-qty]').first().fill('1')
      await card.locator('[data-pda-post-action="save-process-completion"]').click()
      await expect(page.locator('[data-pda-post-task] [role="status"]')).toContainText(`${processItem}本次已保存`)
    }
  }
  if (webContinuation) {
    await page.locator('[data-post-finishing-work-order-detail-action="open-outbound"]').click()
    await expect(page.locator('[data-post-entry-form]')).toBeVisible()
    await expect(page.locator('[data-post-entry-quantity]')).toHaveCount(5)
    for (const input of await page.locator('[data-post-entry-quantity]').all()) await input.fill(await input.getAttribute('max') || '0')
    page.once('dialog', dialog => dialog.accept())
    await page.locator('[data-post-finishing-work-order-detail-action="save-entry"]').click()
    await expect(page.locator('[data-post-entry-form]')).toHaveCount(0)
  } else {
    const form = page.locator('[data-post-outbound-form]')
    if ((await form.getAttribute('open')) === null) await form.locator(':scope > summary').click()
    for (const input of await form.locator('[data-post-outbound-qty]:not([disabled])').all()) await input.fill(await input.getAttribute('max') || '0')
    page.once('dialog', dialog => dialog.accept())
    await page.locator('[data-pda-post-action="submit-for-outbound"]').click()
    await expect(page.locator('[data-pda-post-task] [role="status"]')).toContainText('已准备出货')
  }
  const child=await page.evaluate(async no=>{
    const f=await (window as any).__postRuntime('full-flow'),task=f.getPostFinishingFullFlowPostTask(no)
    return f.listPostFinishingFullFlowOutboundOrders().find((row:any)=>row.postTaskId===task.postTaskId)
  },postTaskNo)
  expect(child.status).toBe('待出货');expect(child.dispatchedAt).toBeUndefined()
  addStage(chain,page,webContinuation?'Web接续分项后准备出货':'PDA分项完成后准备出货','待出货',{postScenario:scenario.postScenario,outboundOrderNo:child.outboundOrderNo})
  if(scenario.postScenario!=='normal')await saveScreenshot(page,chain,'post-outbound-prepared')
  return child.outboundOrderNo
}

async function verifyOutboundAndFactoryPdaBoundary(page:Page,scenario:CrossTerminalScenario,chain:ChainEvidence,outboundOrderNo:string):Promise<void> {
  await page.setViewportSize({width:1366,height:768});await setCurrentWebActor(page,'PF-USER-POST')
  const outbound=await page.evaluate(async no=>{const f=await (window as any).__postRuntime('full-flow');return f.getPostFinishingFullFlowOutboundOrder(no)},outboundOrderNo)
  expect(outbound.status).toBe('待出货');expect(outbound.dispatchedAt).toBeUndefined()
  await page.goto(`/fcs/craft/post-finishing/outbound-orders/${encodeURIComponent(outbound.outboundOrderId)}`)
  await expect(page.locator('body')).toContainText(chain.deliveryOrderNo!)
  await expect(page.locator('body')).toContainText(chain.qcTaskNo!)
  await expect(page.locator('tbody').first().locator('tr')).toHaveCount(5)
  await expect(page.locator('[data-nav*="recheck-orders"]')).toHaveCount(0)
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'确认实际发出',exact:true}).click()
  await expect(page.locator('body')).toContainText('待仓库接收')
  await expect(page.getByRole('button',{name:'确认实际发出',exact:true})).toHaveCount(0)
  await page.locator('[data-nav]').filter({hasText:/^打印整单$/}).click()
  await expect(page.getByRole('heading',{name:'后道出货单',exact:true})).toBeVisible()
  await expect(page.locator('[data-business-document-barcode]')).toHaveAttribute('data-business-document-barcode',outboundOrderNo)
  await expect(page.locator('[data-scan-target]')).toHaveCount(0)
  addStage(chain,page,'准备单实际发出及出货纸单','待仓库接收',{outboundOrderNo,skuCount:5})
  await page.setViewportSize({width:390,height:844});await page.goto('/fcs/pda/warehouse')
  await expect(page.locator('body')).not.toContainText('扫描后道出货单收货')
  await page.goto('/fcs/pda/post-finishing/recheck');await expect(page.getByRole('heading',{name:'页面未找到'})).toBeVisible()
  addStage(chain,page,'后道工厂PDA无成衣仓收货或复检入口','不可达')
  await page.setViewportSize({width:1366,height:768});await page.goto('/wls/finished-inbound')
  await page.locator('[data-wls-finished-inbound-field="name"]').fill('跨端成衣仓实际接收员')
  await page.locator('[data-wls-finished-inbound-field="keyword"]').fill(outboundOrderNo)
  await page.locator('[data-wls-finished-inbound-action="query"]').click()
  const row=page.locator('tbody tr').filter({hasText:outboundOrderNo});await expect(row).toHaveCount(1)
  await row.getByRole('button',{name:'确认成衣仓实收',exact:true}).click()
  const dialog=page.locator('div.fixed.inset-0.z-50').filter({has:page.getByRole('heading',{name:'确认成衣仓实收',exact:true})})
  await expect(dialog.locator('[data-wls-finished-inbound-field="qty"]')).toHaveCount(5)
  for(const input of await dialog.locator('[data-wls-finished-inbound-field="qty"]').all()) {
    const skuId=await input.getAttribute('data-sku-id'),line=outbound.lines.find((line:any)=>line.sku.skuId===skuId)
    await input.fill(String(line.outboundQty))
  }
  await dialog.getByRole('button',{name:'确认并保存实收',exact:true}).click()
  await expect(dialog).toHaveCount(0);await expect(row).toContainText('已接收入库')
  await page.reload();await page.locator('[data-wls-finished-inbound-field="keyword"]').fill(outboundOrderNo)
  await page.locator('[data-wls-finished-inbound-action="query"]').click()
  await expect(page.locator('tbody tr').filter({hasText:outboundOrderNo})).toContainText('已接收入库')
  addStage(chain,page,'原成衣仓逐SKU实收及刷新回读','已接收入库',{outboundOrderNo,skuCount:5})
  chain.finalScreenshot=await saveScreenshot(page,chain,'warehouse-actual-receipt')
}

async function readFinalSnapshot(page: Page): Promise<unknown> {
  return page.evaluate(async () => {
    const flow = await (window as any).__postRuntime('full-flow')
    const logs = await (window as any).__postRuntime('operation-log')
    const authorization = await (window as any).__postRuntime('authorization')
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

test('15条链按责任逐条跨公共PDA、唯一Web质检、可选后道处理与成衣仓交接', async ({ page, context }, testInfo: TestInfo) => {
  test.setTimeout(30 * 60_000)
  page.setDefaultTimeout(15_000)
  page.setDefaultNavigationTimeout(30_000)
  expect(scenarios).toHaveLength(15)
  expect(new Set(scenarios.map((scenario) => scenario.productionOrderNo)).size).toBe(3)
  for (const productionOrderNo of PRODUCTION_ORDERS) {
    expect(scenarios.filter((scenario) => scenario.productionOrderNo === productionOrderNo)).toHaveLength(5)
  }

  await context.addInitScript(()=>{
    ;(window as any).__name=(value:unknown)=>value
    ;(window as any).__postRuntime=async(name:string)=>{
      const pathname=`/src/data/fcs/post-finishing-${name}.ts`
      const url=performance.getEntriesByType('resource').map(row=>row.name).filter(url=>new URL(url).pathname===pathname).at(-1)
      if(!url)throw Error(`本页未载入实际领域模块：${name}`)
      return import(url)
    }
  })
  await page.goto('/fcs/craft/post-finishing/qc-workbench')
  await expect(page.locator('[data-testid="post-finishing-qc-workbench-page"]')).toBeVisible()
  await page.evaluate(async () => {
    const flow = await (window as any).__postRuntime('full-flow')
    const records = await (window as any).__postRuntime('records')
    await records.ensurePostFinishingRecordState()
    await records.runPostFinishingCommand(() => flow.resetPostFinishingFullFlow())
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
    const autoCreatedQcTask = await page.evaluate(async (deliveryOrderNo) => {
      const flow = await (window as any).__postRuntime('full-flow')
      const delivery = flow.getPostFinishingFactoryReturn(deliveryOrderNo)
      const task = delivery?.qcTaskNo ? flow.getPostFinishingFullFlowQcTask(delivery.qcTaskNo) : undefined
      return task ? {
        qcTaskId: task.qcTaskId,
        qcTaskNo: task.qcTaskNo,
        status: task.status,
        createdAt: task.createdAt,
        sentAt: task.sentAt,
      } : undefined
    }, chain.deliveryOrderNo)
    expect(autoCreatedQcTask, '每次 Web/PDA 回货确认后都必须立即自动生成质检单').toBeTruthy()
    expect(autoCreatedQcTask?.status).toBe('待送检')
    expect(autoCreatedQcTask?.createdAt).toBeTruthy()
    expect(autoCreatedQcTask?.sentAt).toBeUndefined()
    addStage(chain, page, '回货确认自动生成质检单', autoCreatedQcTask?.status, {
      qcTaskNo: autoCreatedQcTask?.qcTaskNo || '',
      generatedAtConfirmation: true,
      sentAtConfirmation: false,
    })
    const sentQcTaskNo = await sendToQcThroughWeb(page, scenario, chain, chain.deliveryOrderNo)
    expect(sentQcTaskNo).toBe(autoCreatedQcTask?.qcTaskNo)
    chain.qcTaskNo = sentQcTaskNo
    const qcResult = await completeQcThroughWeb(page, context, scenario, chain, chain.qcTaskNo)
    chain.postTaskNo = qcResult.postTaskNo
    chain.outboundOrderNo = qcResult.outboundOrderNo
    if (chain.postTaskNo) {
      chain.outboundOrderNo = await completePostThroughPda(page, scenario, chain, chain.postTaskNo)
    }
    expect(chain.outboundOrderNo, 'QC 分支必须生成唯一成衣仓交接/出货单').toBeTruthy()
    await verifyOutboundAndFactoryPdaBoundary(page, scenario, chain, chain.outboundOrderNo!)
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
  await expect(page.locator('body')).toContainText('出货准备入区')
  await expect(page.locator('body')).toContainText('后道出货交出')
  await expect(page.getByText('缺少送货单。', { exact: true })).toHaveCount(0)
  await saveSurfaceScreenshot(page, 'wait-handover-warehouse')

  await setCurrentWebActor(page, 'PF-USER-QC-MGR')
  await page.goto('/fcs/craft/post-finishing/qc-orders')
  await expect(page.getByRole('heading', { name: '质检清单', exact: true })).toBeVisible()
  await expect(page.locator('[data-post-finishing-field="qc-task-input"]')).toHaveCount(0)
  await expect(page.locator('main [data-nav="/fcs/craft/post-finishing/qc-workbench"]').filter({ hasText: '执行质检' })).toBeVisible()
  await expect(page.getByRole('button', { name: '领取质检单', exact: true })).toHaveCount(0)
  await expect(page.getByRole('columnheader', { name: '质检单号' })).toBeVisible()
  await saveSurfaceScreenshot(page, 'qc-task')

  await page.goto('/fcs/craft/post-finishing/audit-records')
  await expect(page.getByRole('heading', { name: '差异与操作日志' })).toBeVisible()
  await expect(page.locator('[data-standard-list-table-section] tbody tr')).toHaveCount(10)
  await page.getByRole('link', { name: '查看详情' }).first().click()
  await expect(page.locator('[data-audit-chain-detail]')).toBeVisible()
  await expect(page.getByRole('heading', { name: '1. 回货与质检' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '逐 SKU 数量差异' })).toHaveCount(0)
  await page.getByRole('link', { name: '差异与质检' }).click()
  await expect(page.getByRole('heading', { name: '逐 SKU 数量差异' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '质检瑕疵记录' })).toBeVisible()
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
  expect(totals.postTasks).toBe(10)
  expect(totals.recheckOrders).toBe(0)
  expect(totals.outboundOrders).toBe(15)
  expect(totals.warehouseReceipts).toBe(15)
  expect(totals.waitProcessWarehouseRecords).toBe(15)
  expect(totals.waitProcessWarehouseMovements).toBe(30)
  expect(totals.waitHandoverWarehouseRecords).toBe(15)
  expect(totals.waitHandoverWarehouseMovements).toBe(30)
  expect(totals.defects).toBe(1)
  expect(totals.authorizationConsumptions).toBe(scenarios.filter(row=>row.returnScenario==='over-5-authorization').length)
  const finalChains = (snapshot as { chains: Array<{ warehouseReceived: boolean; waitHandoverStatus?: string }> }).chains
  expect(finalChains).toHaveLength(15)
  expect(finalChains.every((chain) => chain.warehouseReceived)).toBe(true)
  expect(finalChains.filter((chain) => chain.waitHandoverStatus).every((chain) => chain.waitHandoverStatus === '已交出')).toBe(true)
  expect(finalChains.filter((chain) => chain.waitHandoverStatus).length).toBe(15)

  evidence.finalSnapshot = snapshot
  evidence.finishedAt = new Date().toISOString()
  persistEvidence()
  await testInfo.attach('cross-terminal-ui-evidence', {
    body: Buffer.from(JSON.stringify(evidence, null, 2)),
    contentType: 'application/json',
  })
})

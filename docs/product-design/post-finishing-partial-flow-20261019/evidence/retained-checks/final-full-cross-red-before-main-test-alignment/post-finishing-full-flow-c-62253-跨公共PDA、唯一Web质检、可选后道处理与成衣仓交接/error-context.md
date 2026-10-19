# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: post-finishing-full-flow-cross-terminal.spec.ts >> 15条链按责任逐条跨公共PDA、唯一Web质检、可选后道处理与成衣仓交接
- Location: tests/post-finishing-full-flow-cross-terminal.spec.ts:838:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('[data-post-process]')
Expected: 4
Received: 0
Timeout:  10000ms

Call log:
  - Expect "toHaveCount" with timeout 10000ms
  - waiting for locator('[data-post-process]')
    24 × locator resolved to 0 elements
       - unexpected value "0"

```

# Page snapshot

```yaml
- generic [ref=e4]: 页面内容加载失败，请稍后重试。
```

# Test source

```ts
  116 | ))
  117 | 
  118 | const passLabel = process.env.VERIFICATION_PASS || 'cross-terminal'
  119 | const evidenceOutput = process.env.POST_FINISHING_CROSS_TERMINAL_EVIDENCE_OUT
  120 | const screenshotDirectory = process.env.POST_FINISHING_CROSS_TERMINAL_SCREENSHOT_DIR
  121 | const consumedAuthorizationPayloads = new Set<string>()
  122 | 
  123 | const evidence: AcceptanceEvidence = {
  124 |   suite: 'QC 后道全流程 3×5×5 全量跨端 UI 验收',
  125 |   passLabel,
  126 |   startedAt: new Date().toISOString(),
  127 |   writeBoundary: '开始时在隔离浏览器按事务重置后道测试记录并写入 PDA 测试会话；除此之外全部业务写入由 Web/PDA 页面操作产生；结束时只读业务事实用于核对。',
  128 |   expected: {
  129 |     productionOrders: 3,
  130 |     skuPerProductionOrder: 5,
  131 |     returnsPerProductionOrder: 5,
  132 |     chains: 15,
  133 |   },
  134 |   chains: [],
  135 |   surfaceScreenshots: [],
  136 | }
  137 | 
  138 | function persistEvidence(): void {
  139 |   if (!evidenceOutput) return
  140 |   mkdirSync(dirname(evidenceOutput), { recursive: true })
  141 |   writeFileSync(evidenceOutput, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
  142 | }
  143 | 
  144 | async function setPdaSession(page: Page): Promise<void> {
  145 |   await page.evaluate((session) => {
  146 |     window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
  147 |   }, PDA_SESSION)
  148 | }
  149 | 
  150 | async function setCurrentWebActor(page: Page, actorId: string): Promise<void> {
  151 |   await page.evaluate((id) => {
  152 |     window.localStorage.setItem('higood-fcs-post-finishing-current-actor-v1', id)
  153 |   }, actorId)
  154 | }
  155 | 
  156 | async function statusText(page: Page): Promise<string> {
  157 |   const status = page.getByRole('status').last()
  158 |   await expect(status).toBeVisible()
  159 |   return (await status.textContent())?.trim() || ''
  160 | }
  161 | 
  162 | async function waitForStableRenderedUi(page: Page): Promise<void> {
  163 |   for (let attempt = 1; attempt <= 5; attempt += 1) {
  164 |     await page.waitForLoadState('domcontentloaded')
  165 |     try {
  166 |       const stable = await page.evaluate(({ quietMs, timeoutMs }) => new Promise<boolean>((resolveStable) => {
  167 |         let finished = false
  168 |         let quietTimer = window.setTimeout(finishStable, quietMs)
  169 |         const timeoutTimer = window.setTimeout(() => finishStable(false), timeoutMs)
  170 |         const observer = new MutationObserver(() => {
  171 |           window.clearTimeout(quietTimer)
  172 |           quietTimer = window.setTimeout(finishStable, quietMs)
  173 |         })
  174 |         function finishStable(result = true): void {
  175 |           if (finished) return
  176 |           finished = true
  177 |           window.clearTimeout(quietTimer)
  178 |           window.clearTimeout(timeoutTimer)
  179 |           observer.disconnect()
  180 |           resolveStable(result)
  181 |         }
  182 |         observer.observe(document.documentElement, { attributes: true, childList: true, subtree: true })
  183 |       }), { quietMs: 300, timeoutMs: 10_000 })
  184 |       expect(stable, '扫码前页面必须完成渲染并稳定至少300毫秒').toBe(true)
  185 |       return
  186 |     } catch (error) {
  187 |       const message = error instanceof Error ? error.message : String(error)
  188 |       const navigationRace = message.includes('Execution context was destroyed') || message.includes('because of a navigation')
  189 |       if (!navigationRace || attempt === 5) throw error
  190 |     }
  191 |   }
  192 | }
  193 | 
  194 | async function fillScanAndWaitForRefresh(
  195 |   page: Page,
  196 |   scanner: Locator,
  197 |   value: string,
  198 |   expected: { queryKey?: string; queryValue?: string; resultSelector?: string; resultCount?: number } = {},
  199 | ): Promise<void> {
  200 |   await expect(scanner).toBeVisible()
  201 |   await waitForStableRenderedUi(page)
  202 |   await scanner.fill(value)
  203 |   await expect(scanner).toHaveValue(value)
  204 |   const previousUrl = page.url()
  205 |   await Promise.all([
  206 |     page.waitForURL((url) => (
  207 |       url.href !== previousUrl
  208 |       && url.searchParams.has('refresh')
  209 |       && (!expected.queryKey || url.searchParams.get(expected.queryKey) === expected.queryValue)
  210 |     )),
  211 |     scanner.press('Enter', { noWaitAfter: true }),
  212 |   ])
  213 |   if (expected.resultSelector) {
  214 |     const result = page.locator(expected.resultSelector)
  215 |     if (expected.resultCount === undefined) await expect(result).toBeVisible()
> 216 |     else await expect(result).toHaveCount(expected.resultCount)
      |                               ^ Error: expect(locator).toHaveCount(expected) failed
  217 |   }
  218 | }
  219 | 
  220 | function extractNumber(text: string, pattern: RegExp, label: string): string {
  221 |   const match = text.match(pattern)
  222 |   expect(match?.[1], `${label}必须出现在页面反馈中`).toBeTruthy()
  223 |   return match![1]!
  224 | }
  225 | 
  226 | function expectedSkuBarcodes(orderIndex: number): string[] {
  227 |   return [1, 2, 3, 4, 5].map((skuIndex) => `SKU-${orderIndex + 1}${String(skuIndex).padStart(2, '0')}-202608`)
  228 | }
  229 | 
  230 | function addStage(
  231 |   chain: ChainEvidence,
  232 |   page: Page,
  233 |   stage: string,
  234 |   status: string | undefined,
  235 |   details?: Record<string, string | number | boolean>,
  236 | ): void {
  237 |   chain.stages.push({ stage, url: page.url(), status, skuCount: 5, details })
  238 |   persistEvidence()
  239 | }
  240 | 
  241 | async function saveScreenshot(page: Page, chain: ChainEvidence, suffix: string): Promise<string | undefined> {
  242 |   if (!screenshotDirectory) return undefined
  243 |   mkdirSync(screenshotDirectory, { recursive: true })
  244 |   const base = `${String(chain.chainIndex).padStart(2, '0')}-${chain.productionOrderNo.replaceAll('/', '-')}-R${chain.returnIndex}-${suffix}.png`
  245 |   const path = resolve(screenshotDirectory, base)
  246 |   await page.screenshot({ path, fullPage: true })
  247 |   return path
  248 | }
  249 | 
  250 | async function saveSurfaceScreenshot(page: Page, name: string): Promise<void> {
  251 |   if (!screenshotDirectory) return
  252 |   mkdirSync(screenshotDirectory, { recursive: true })
  253 |   const path = resolve(screenshotDirectory, `surface-${name}.png`)
  254 |   await page.screenshot({ path, fullPage: true })
  255 |   evidence.surfaceScreenshots.push(path)
  256 |   persistEvidence()
  257 | }
  258 | 
  259 | async function freshAuthorizationPayload(context: BrowserContext, authorizerId: string): Promise<string> {
  260 |   const authorizationPage = await context.newPage()
  261 |   await authorizationPage.setViewportSize({ width: 1366, height: 768 })
  262 |   authorizationPage.setDefaultTimeout(45_000)
  263 |   authorizationPage.setDefaultNavigationTimeout(45_000)
  264 |   await authorizationPage.goto('/fcs/craft/post-finishing/authorization-code', { waitUntil: 'domcontentloaded' })
  265 |   await authorizationPage.evaluate(() => {
  266 |     window.localStorage.removeItem('higood-fcs-post-finishing-current-authorizer-v1')
  267 |   })
  268 |   await authorizationPage.reload({ waitUntil: 'domcontentloaded' })
  269 |   await expect(authorizationPage.locator('body')).toContainText('当前账号没有授权权限')
  270 |   await expect(authorizationPage.locator('[data-authorization-code]')).toHaveCount(0)
  271 |   await authorizationPage.evaluate((id) => {
  272 |     window.localStorage.setItem('higood-fcs-post-finishing-current-authorizer-v1', id)
  273 |   }, authorizerId)
  274 |   await authorizationPage.reload({ waitUntil: 'domcontentloaded' })
  275 |   const payloadNode = authorizationPage.locator('[data-authorization-scan-payload]')
  276 |   await expect(payloadNode).toHaveText(/^PFAUTH:/, { timeout: 45_000 })
  277 |   const deadline = Date.now() + 65_000
  278 |   while (Date.now() < deadline) {
  279 |     const payload = (await payloadNode.textContent())?.trim() || ''
  280 |     const slot = Number(payload.split(':')[2])
  281 |     const hasEnoughValidity = Number.isFinite(slot) && ((slot + 1) * 30_000) - Date.now() >= 5_000
  282 |     if (payload && hasEnoughValidity && !consumedAuthorizationPayloads.has(payload)) {
  283 |       consumedAuthorizationPayloads.add(payload)
  284 |       await authorizationPage.close()
  285 |       return payload
  286 |     }
  287 |     await authorizationPage.waitForTimeout(500)
  288 |   }
  289 |   await authorizationPage.close()
  290 |   throw new Error(`${authorizerId} 的动态授权码在65秒内未刷新为剩余有效期至少5秒的可用码`)
  291 | }
  292 | 
  293 | async function registerReturnThroughPublicPda(page: Page, scenario: CrossTerminalScenario, chain: ChainEvidence): Promise<string> {
  294 |   await page.setViewportSize({ width: 360, height: 800 })
  295 |   await page.goto('/fcs/pda/handover/sewing-self-return')
  296 |   const scanner = page.locator('[data-pda-sewing-self-return-field="scanValue"]')
  297 |   await fillScanAndWaitForRefresh(page, scanner, `PFRETURN:${scenario.productionOrderNo}:${scenario.returnIndex}`, {
  298 |     resultSelector: '[data-return-sku-card]',
  299 |     resultCount: 5,
  300 |   })
  301 |   const quantities = page.locator('[data-pda-sewing-self-return-field="quantity"]')
  302 |   for (let index = 0; index < 5; index += 1) await quantities.nth(index).fill('20')
  303 |   await page.locator('[data-pda-sewing-self-return-field="deliveryPersonName"]').fill(`UI验收送货员-${scenario.orderIndex + 1}`)
  304 |   await page.locator('[data-pda-sewing-self-return-field="deliveryPersonPhone"]').fill(`0812888${scenario.orderIndex + 1}${scenario.returnIndex}00`)
  305 |   await page.getByRole('button', { name: '加载原型验收凭证' }).click()
  306 |   await page.getByRole('button', { name: '提交本次回货登记' }).click()
  307 |   await expect(page.getByRole('status')).toContainText('登记成功')
  308 |   const status = await statusText(page)
  309 |   const deliveryOrderNo = extractNumber(status, /登记成功：(PO-[^，\s]+)/, '送货单号')
  310 |   addStage(chain, page, '公共PDA登记回货', status, { deliveryOrderNo, registeredSkuLines: 5 })
  311 |   return deliveryOrderNo
  312 | }
  313 | 
  314 | async function confirmReturnThroughPda(
  315 |   page: Page,
  316 |   context: BrowserContext,
```
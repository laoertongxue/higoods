import { expect, test, type Page, type Route } from '@playwright/test'

const WEB = '/fcs/craft/cutting/warehouse-management/wait-handover'
const PDA = '/fcs/pda/cutting/simple-cut-piece-handover'
const M = 'RW-10CIVDB-0IZLA0Q'
const L = 'RW-0SARC2R-0FXVDJ7'
const MERGED = 'RW-174ADG6-1DA2O8S'
const TRIPLE = 'RW-1H7957Z-1JEWD9O'

async function facts(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('cuttingRuntimeEventLedger') || '{"events":[]}').events
    .filter((event: { eventType: string }) => event.eventType === '简易裁片交出'))
}
async function read(page: Page, code: string, quantity?: number) {
  await page.locator('[data-simple-cut-input]').fill(code)
  await page.locator('[data-simple-cut-input]').press('Enter')
  if (quantity !== undefined) {
    await expect(page.locator('[data-simple-cut-action="confirm"]')).toHaveText(new RegExp(`确认交出（[0-9]+ 张菲票 / ${quantity} 片）`), { timeout: 120_000 })
    await expect(page.locator('[role="status"]')).not.toContainText('正在读取', { timeout: 120_000 })
  }
}
async function openWeb(page: Page) {
  await page.locator('[data-simple-cut-open]').click({ timeout: 120_000 })
  await expect(page.locator('[data-simple-cut-root="WEB"]')).toBeVisible()
}
async function imageCheck(page: Page) {
  const thumbnail = page.locator('[data-simple-cut-root] img').first()
  await expect(thumbnail).toBeVisible()
  await expect.poll(() => thumbnail.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
  await page.locator('[data-simple-cut-root] [data-pda-image-preview-url]').click()
  await expect(page.locator('[data-pda-image-preview-root] img')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-pda-image-preview-root]')).toHaveCount(0)
}
async function withinScreen(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  const rect = await page.locator('[data-simple-cut-action="confirm"]').boundingBox()
  expect(rect).not.toBeNull()
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(page.viewportSize()!.height)
}

test('简易裁片交出：Web/PDA 两批交出、刷新防重与角色边界', async ({ page }, testInfo) => {
  test.setTimeout(900_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    if (localStorage.getItem('fcs_pda_session')) return
    localStorage.setItem('fcs_pda_factory_id', 'OWN-CUTTING-001')
    localStorage.setItem('fcs_pda_session', JSON.stringify({ userId: 'OWN-CUTTING-001_admin', loginId: 'OWN-CUTTING-001_admin', userName: '自营裁床_管理员', roleId: 'ROLE_ADMIN', factoryId: 'OWN-CUTTING-001', factoryName: '自营裁床', loggedAt: '2026-09-16 09:00:00' }))
  })
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto(WEB, { waitUntil: 'domcontentloaded' })
  await openWeb(page)
  await read(page, M, 700)
  await expect(page.locator('[data-simple-cut-root="WEB"]')).toContainText('SKU-SIMPLE-M-GRY')
  await expect(page.locator('[data-simple-cut-root="WEB"] tbody tr')).toHaveCount(5)
  await withinScreen(page)
  await imageCheck(page)
  // A failed real image must remain identifiable and recover through the visible retry.
  const failImage = (route: Route) => route.request().url().includes('simple-image-recovery=1') ? route.abort() : route.continue()
  await page.route('**/*', failImage)
  await page.locator('[data-simple-cut-root] img').first().evaluate((img: HTMLImageElement) => {
    const url = new URL(img.src); url.searchParams.set('simple-image-recovery', '1'); img.src = url.href
  })
  await expect(page.locator('[data-simple-image-retry]')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('web-image-failed-retry.png'), fullPage: true })
  await page.unroute('**/*', failImage)
  await page.locator('[data-simple-cut-action="retry-image"]').click()
  await expect.poll(() => page.locator('[data-simple-cut-root] img').first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
  await expect(page.locator('[data-simple-image-retry]')).toBeHidden()
  await page.screenshot({ path: testInfo.outputPath('web-1024-first-batch.png'), fullPage: true })
  await page.setViewportSize({ width: 1366, height: 768 })
  await withinScreen(page)
  await page.screenshot({ path: testInfo.outputPath('web-1366-first-batch.png'), fullPage: true })
  // Simulate a browser storage failure without adding a handover or changing inventory.
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    ;(window as unknown as { simpleCutRestoreStorage: () => void }).simpleCutRestoreStorage = () => { Storage.prototype.setItem = original }
    Storage.prototype.setItem = function (key, value) {
      if (key === 'cuttingRuntimeEventLedger') throw new Error('演示保存失败')
      return original.call(this, key, value)
    }
  })
  await page.locator('[data-simple-cut-action="confirm"]').click()
  await expect(page.locator('[role="status"]')).toContainText('未完成交出', { timeout: 120_000 })
  await expect(page.locator('[data-simple-cut-input]')).toHaveValue(M)
  await expect(page.locator('[data-simple-cut-root="WEB"] tbody tr')).toHaveCount(5)
  expect(await facts(page)).toHaveLength(0)
  await page.screenshot({ path: testInfo.outputPath('web-save-failed-input-preserved.png'), fullPage: true })
  await page.evaluate(() => (window as unknown as { simpleCutRestoreStorage: () => void }).simpleCutRestoreStorage())
  await page.locator('[data-simple-cut-action="confirm"]').click()
  await expect(page.locator('[data-simple-cut-root="WEB"]')).toContainText('已交出 · 工厂已接收', { timeout: 120_000 })
  expect(await facts(page)).toHaveLength(1)
  expect((await facts(page))[0].payload.totalPieceQty).toBe(700)
  await page.screenshot({ path: testInfo.outputPath('web-first-batch-success.png'), fullPage: true })

  await page.reload({ waitUntil: 'domcontentloaded' })
  await openWeb(page)
  await read(page, M, 0)
  await expect(page.locator('[data-simple-cut-action="confirm"]')).toBeDisabled()
  expect(await facts(page)).toHaveLength(1)
  // This adds only the second actual cutting output, not a receipt or handover fact.
  await page.evaluate(async () => {
    const path = '/src/data/fcs/cutting/simple-cut-piece-handover-fixtures.ts'
    const fixture = await import(/* @vite-ignore */ path)
    fixture.appendSimpleCutPieceDemoCuttingBatch(2)
  })
  await read(page, M, 200)
  await page.locator('[data-simple-cut-action="confirm"]').click()
  await expect(page.locator('[data-simple-cut-root="WEB"]')).toContainText('已交出 · 工厂已接收', { timeout: 120_000 })
  expect(await facts(page)).toHaveLength(2)
  expect((await facts(page)).map((event: {payload:{totalPieceQty:number}}) => event.payload.totalPieceQty).sort((a: number, b: number) => a - b)).toEqual([200, 700])
  await page.screenshot({ path: testInfo.outputPath('web-second-batch-success.png'), fullPage: true })

  await page.setViewportSize({ width: 360, height: 640 })
  await page.goto(`${PDA}?taskSheetNo=${L}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-simple-cut-action="confirm"]')).toContainText('720 片', { timeout: 120_000 })
  // L also includes the newly cut hood pieces: first transfer is the complete 720 pieces.
  expect(await facts(page)).toHaveLength(2)
  const qr = await page.evaluate(async (code) => {
    const path = '/src/data/fcs/dispatch-task-sheet.ts'
    return (await import(/* @vite-ignore */ path)).resolveDispatchTaskSheet(code).qrValue
  }, L)
  await read(page, qr, 720)
  await expect(page.locator('[data-simple-cut-input]')).toHaveValue(L)
  await page.locator('[data-simple-cut-input]').press('Enter')
  await expect(page.locator('[role="status"]')).not.toContainText('正在读取', { timeout: 120_000 })
  expect(await facts(page)).toHaveLength(2)
  await withinScreen(page)
  await imageCheck(page)
  await page.screenshot({ path: testInfo.outputPath('pda-360-scanned-not-confirmed.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await withinScreen(page)
  await page.screenshot({ path: testInfo.outputPath('pda-390-ready.png'), fullPage: true })
  await page.locator('[data-simple-cut-action="confirm"]').click()
  await expect(page.locator('[data-simple-cut-root="PDA"]')).toContainText('已交出 · 工厂已接收', { timeout: 120_000 })
  expect(await facts(page)).toHaveLength(3)
  expect((await facts(page)).filter((event: { eventSource: string }) => event.eventSource === 'PDA')).toHaveLength(1)
  await page.screenshot({ path: testInfo.outputPath('pda-success.png'), fullPage: true })

  await page.locator('[data-simple-cut-action="reset"]').click()
  await read(page, TRIPLE)
  await expect(page.locator('[role="status"]')).toContainText('三合一', { timeout: 120_000 })
  await expect(page.locator('[data-simple-cut-action="confirm"]')).toBeDisabled()
  expect(await facts(page)).toHaveLength(3)
  await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('fcs_pda_session')!)
    localStorage.setItem('fcs_pda_session', JSON.stringify({ ...session, userId: 'OWN-CUTTING-001_operator', loginId: 'OWN-CUTTING-001_operator', userName: '自营裁床_操作工', roleId: 'ROLE_OPERATOR' }))
  })
  await page.goto(`${PDA}?taskSheetNo=${MERGED}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-simple-cut-root="PDA"]')).toContainText('仅裁床待交出仓的仓管', { timeout: 120_000 })
  await expect(page.locator('[data-simple-cut-action="confirm"]')).toContainText('1260 片', { timeout: 120_000 })
  await expect(page.locator('[data-simple-cut-root="PDA"] article')).toHaveCount(8)
  await page.locator('[data-simple-cut-action="next"]').click()
  await expect(page.locator('[data-simple-cut-root="PDA"] article')).toHaveCount(2)
  await expect(page.locator('[data-simple-cut-action="confirm"]')).toContainText('10 张菲票 / 1260 片')
  await expect(page.locator('[data-simple-cut-action="confirm"]')).toBeDisabled()
  await page.screenshot({ path: testInfo.outputPath('pda-wrong-role-blocked.png'), fullPage: true })
  expect(await facts(page)).toHaveLength(3)
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto(WEB, { waitUntil: 'domcontentloaded' })
  await openWeb(page)
  await read(page, MERGED, 1260)
  await expect(page.locator('[data-simple-cut-root="WEB"]')).toContainText('仅裁床待交出仓的仓管')
  await expect(page.locator('[data-simple-cut-action="confirm"]')).toBeDisabled()
  expect(await facts(page)).toHaveLength(3)
  await page.screenshot({ path: testInfo.outputPath('web-wrong-role-blocked.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('同源双标签只允许一个仓管确认同批菲票', async ({ page, context }, testInfo) => {
  test.setTimeout(180_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await context.addInitScript(() => {
    localStorage.setItem('fcs_pda_factory_id', 'OWN-CUTTING-001')
    localStorage.setItem('fcs_pda_session', JSON.stringify({ userId: 'OWN-CUTTING-001_admin', loginId: 'OWN-CUTTING-001_admin', userName: '自营裁床_管理员', roleId: 'ROLE_ADMIN', factoryId: 'OWN-CUTTING-001', factoryName: '自营裁床', loggedAt: '2026-09-16 09:00:00' }))
  })
  const other = await context.newPage()
  other.on('pageerror', error => errors.push(error.message))
  await Promise.all([page.goto(`${PDA}?taskSheetNo=${M}`, { waitUntil: 'domcontentloaded' }), other.goto(`${PDA}?taskSheetNo=${M}`, { waitUntil: 'domcontentloaded' })])
  for (const tab of [page, other]) {
    await expect(tab.locator('[data-simple-cut-action="confirm"]')).toContainText('700 片', { timeout: 120_000 })
  }
  const fingerprints = await Promise.all([page, other].map(tab => tab.evaluate(async (taskSheetNo) => {
    const path = '/src/data/fcs/cutting/simple-cut-piece-handover.ts'
    return (await import(/* @vite-ignore */ path)).resolveSimpleCutPieceHandover(taskSheetNo).candidateFingerprint
  }, M)))
  expect(fingerprints[0]).toBe(fingerprints[1])
  expect(await facts(page)).toHaveLength(0)
  await page.screenshot({ path: testInfo.outputPath('two-tabs-same-candidate.png'), fullPage: true })
  const results = await Promise.allSettled([page, other].map((tab, index) => tab.evaluate(async ({ taskSheetNo, fingerprint, commandId }) => {
    const path = '/src/data/fcs/cutting/simple-cut-piece-handover.ts'
    const result = await (await import(/* @vite-ignore */ path)).confirmSimpleCutPieceHandover({
      taskSheetNo, candidateFingerprint: fingerprint, commandId,
      actor: { factoryId: 'OWN-CUTTING-001', operatorId: 'OWN-CUTTING-001_admin', operatorName: '自营裁床_管理员', operatorRole: 'FACTORY_ADMIN', source: 'WEB' },
    })
    return { appended: result.appended, recordNo: result.event.payload.handoverRecordNo }
  }, { taskSheetNo: M, fingerprint: fingerprints[index], commandId: `MULTI-TAB-${index + 1}-${M}` })))
  const fulfilled = results.filter(result => result.status === 'fulfilled')
  const rejected = results.filter(result => result.status === 'rejected')
  expect(fulfilled).toHaveLength(1)
  expect(rejected).toHaveLength(1)
  expect(String((rejected[0] as PromiseRejectedResult).reason)).toMatch(/变化|没有可交/)
  const records = await facts(page)
  expect(records).toHaveLength(1)
  expect(records[0].payload.totalPieceQty).toBe(700)
  expect(await facts(other)).toHaveLength(1)
  await testInfo.attach('same-origin-two-tab-results', { body: JSON.stringify({ fingerprints, results: results.map(result => result.status === 'fulfilled' ? result : { status: result.status, reason: String(result.reason) }), records: records.map((record: { eventId: string; idempotencyKey: string; payload: { totalPieceQty: number } }) => ({ eventId: record.eventId, commandId: record.idempotencyKey, qty: record.payload.totalPieceQty })) }, null, 2), contentType: 'application/json' })
  expect(errors).toEqual([])
})

test('关联演示：真实袋占用与专用裁床特殊工艺回仓', async ({ page }, testInfo) => {
  test.setTimeout(360_000)
  const errors: string[]=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.addInitScript(()=>{
    localStorage.setItem('fcs_pda_factory_id','OWN-CUTTING-001')
    localStorage.setItem('fcs_pda_session',JSON.stringify({userId:'OWN-CUTTING-001_admin',loginId:'OWN-CUTTING-001_admin',userName:'自营裁床_管理员',roleId:'ROLE_ADMIN',factoryId:'OWN-CUTTING-001',factoryName:'自营裁床',loggedAt:'2026-09-16 09:00:00'}))
  })
  await page.goto(WEB,{waitUntil:'domcontentloaded'})
  await openWeb(page)
  const demo=await page.evaluate(async()=>{
    const path='/src/data/fcs/cutting/simple-cut-piece-handover-fixtures.ts'
    const fixtures=await import(/* @vite-ignore */ path)
    const bag=fixtures.initializeSimpleCutPieceBagDemo()
    const craft=fixtures.initializeSimpleCutPieceSpecialCraftDemo()
    const binding=craft.bindings.find((row:{sizeCode:string})=>row.sizeCode==='M')
    fixtures.moveSimpleCutPieceSpecialCraftDemo(binding.bindingId,'OUTSIDE')
    return {bag,craftNo:craft.taskSheetNo,bindingId:binding.bindingId,feiTicketNo:binding.feiTicketNo}
  })
  await read(page,demo.bag.taskSheetNo,1160)
  await expect(page.locator('[data-simple-cut-root="WEB"]')).toContainText(demo.bag.bagCode)
  await page.screenshot({path:testInfo.outputPath('mock-bag-occupied.png'),fullPage:true})
  await read(page,demo.craftNo,1080)
  await expect(page.locator('[data-simple-cut-root="WEB"]')).toContainText('特殊工艺')
  await page.screenshot({path:testInfo.outputPath('mock-craft-outside.png'),fullPage:true})
  await page.evaluate(async(bindingId)=>{
    const path='/src/data/fcs/cutting/simple-cut-piece-handover-fixtures.ts'
    const fixtures=await import(/* @vite-ignore */ path)
    fixtures.moveSimpleCutPieceSpecialCraftDemo(bindingId,'RETURNED')
  },demo.bindingId)
  await read(page,demo.craftNo,1180)
  await expect(page.locator('[data-simple-cut-root="WEB"] tbody')).toContainText(demo.feiTicketNo)
  await page.screenshot({path:testInfo.outputPath('mock-craft-returned.png'),fullPage:true})
  await page.locator('[data-simple-cut-action="confirm"]').click()
  await expect(page.locator('[data-simple-cut-root="WEB"]')).toContainText('已交出 · 工厂已接收',{timeout:120_000})
  expect((await facts(page)).find((event:{payload:{taskSheetNo:string}})=>event.payload.taskSheetNo===demo.craftNo)?.payload.totalPieceQty).toBe(1180)
  await page.screenshot({path:testInfo.outputPath('mock-craft-handover-success.png'),fullPage:true})
  expect(errors).toEqual([])
})

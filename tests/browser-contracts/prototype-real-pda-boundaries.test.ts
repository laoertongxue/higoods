import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, expect, type Browser, type Page } from '@playwright/test'
import { createServer, type ViteDevServer } from 'vite'

const output = resolve(process.env.REAL_PDA_BOUNDARIES_TEST_OUTPUT || 'output/verification/prototype-full-function-cleanup/real-pda-boundaries')
let base = process.env.REAL_PDA_BOUNDARIES_TEST_URL || ''
let server: ViteDevServer | undefined, browser: Browser
const evidence: Record<string, unknown> = {}
before(async () => {
  await mkdir(output, { recursive: true })
  if (!base) {
    server = await createServer({ server: { host: '127.0.0.1', port: 43277, strictPort: true, hmr: false, watch: { ignored: ['**/*'] } } })
    await server.listen()
    base = 'http://127.0.0.1:43277'
  }
  browser = await chromium.launch({ headless: true })
})
after(async () => {
  await browser?.close(); await server?.close()
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ at: new Date().toISOString(), base, noProductSourceChanges: true, evidence }, null, 2))
})

async function prepare(page: Page) {
  await page.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
  await page.route('**/__real-pda-boundaries', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><link rel="stylesheet" href="/src/styles.css"></head><body></body></html>' }))
  await page.goto(base + '/__real-pda-boundaries')
  return page.evaluate(async () => {
    await (await import('/src/data/pcs-record-runtime.ts')).ensurePcsRecordState()
    await (await import('/src/data/fcs/production-context-records.ts')).hydrateProductionContextRecords()
    await (await import('/src/data/fcs/cutting/part-ticket-records.ts')).hydratePartTicketRecords()
    await (await import('/src/data/fcs/cutting/cutting-event-repository.ts')).hydrateCuttingEventRecords()
    const water = await import('/src/data/fcs/water-soluble-task-domain.ts')
    const pda = await import('/src/data/fcs/store-domain-pda.ts')
    const handover = await import('/src/data/fcs/pda-handover-events.ts')
    const actorPolicy = await import('/src/data/fcs/water-soluble-pda-actor.ts')
    const order = water.listWaterSolubleWorkOrders().find(item => item.status === 'PRODUCTION_PAUSED' && item.factoryId && item.completedQty > 0)
    if (!order?.factoryId) throw new Error('缺少当前真实生成且已派厂的生产暂停水溶场景')
    const users = pda.listFactoryPdaUsers(order.factoryId)
    const admin = users.find(user => user.status === 'ACTIVE' && user.roleId === 'ROLE_ADMIN')
    const operator = users.find(user => user.status === 'ACTIVE' && user.roleId === 'ROLE_OPERATOR')
    let handing = users.find(user => user.status === 'ACTIVE' && user.roleId === 'ROLE_HANDOVER')
    if (!admin || !operator) throw new Error('缺少同厂真实管理员或操作员')
    if (!handing) handing = await pda.createFactoryPdaUser({ factoryId: order.factoryId, name: '权限边界交接员', loginId: `${order.factoryId}_prototype_boundary_handover`, password: 'isolated-test-only', roleId: 'ROLE_HANDOVER', createdBy: '隔离浏览器边界验收' })
    const foreign = pda.listAllFactoryPdaUsers().find(user => user.status === 'ACTIVE' && user.factoryId !== order.factoryId)
    if (!foreign) throw new Error('缺少真实外厂账号')
    const sessions = { admin: pda.createPdaSessionFromUser(admin), operator: pda.createPdaSessionFromUser(operator), handover: pda.createPdaSessionFromUser(handing), foreign: pda.createPdaSessionFromUser(foreign) }
    localStorage.setItem('fcs_pda_session', JSON.stringify(sessions.admin))
    const result = water.executeWaterSolublePdaAction({ action: 'RESOLVE_PAUSE', orderId: order.waterOrderId, taskId: order.taskId, expectedStatus: 'PRODUCTION_PAUSED', expectedNode: 'SUPERVISOR', decision: 'CONTINUE_WITH_ACTUAL_QTY', actor: sessions.admin })
    if (!result.ok || !result.order) throw new Error(result.message)
    const quantity = result.order.completedQty - (result.order.handoverQty ?? 0)
    if (!(quantity > 0) || result.order.status !== 'WAIT_HANDOVER') throw new Error('主管按实际数量确认后没有待交出实物')
    const ensured = handover.ensureHandoverOrderForStartedTask(order.taskId)
    const head = handover.getHandoverOrderById(ensured.handoverOrderId)
    if (!head?.handoverOrderId || head.sourceBusinessType !== 'WATER_SOLUBLE_WORK_ORDER' || head.sourceDocId !== order.waterOrderId) throw new Error('交出单未绑定原水溶单和任务')
    ;(globalThis as any).__realWaterPda = { water, pda, handover, actorPolicy, sessions, orderId: order.waterOrderId, taskId: order.taskId, headId: head.handoverOrderId, materialCode: order.materialCode, unit: order.qtyUnit, quantity }
    return { orderId: order.waterOrderId, headId: head.handoverOrderId, quantity, completedQty: result.order.completedQty, sourceArtifactId: order.sourceArtifactId, factoryId: order.factoryId, materialCode: order.materialCode, unit: order.qtyUnit }
  })
}
async function facts(page: Page) {
  return page.evaluate(() => {
    const { water, handover, orderId, headId } = (globalThis as any).__realWaterPda
    return { order: water.getWaterSolubleWorkOrderById(orderId), head: handover.getHandoverOrderById(headId), records: handover.getPdaHandoverRecordsByHead(headId) }
  })
}

test('真实水溶PDA身份、原单交出和确认令牌边界保留；原型功能开放不会绕过权限或数量差异', { timeout: 120000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Jakarta' })
  const page = await context.newPage(), errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    const seed = await prepare(page)
    evidence.source = seed
    const before = await facts(page)
    const rejected = await page.evaluate(() => {
      const { water, handover, pda, sessions, orderId, headId, quantity, materialCode, unit } = (globalThis as any).__realWaterPda
      const snapshot = () => JSON.stringify({ order: water.getWaterSolubleWorkOrderById(orderId), head: handover.getHandoverOrderById(headId), records: handover.getPdaHandoverRecordsByHead(headId) })
      const original = snapshot()
      const attempt = (label: string, session: any, extra: any) => {
        if (session) localStorage.setItem('fcs_pda_session', JSON.stringify(session)); else pda.clearPdaSession()
        let message = ''
        try { handover.createFactoryHandoverRecord({ handoverOrderId: headId, submittedQty: quantity, qtyUnit: unit, factorySubmittedAt: new Date().toISOString(), factorySubmittedBy: session?.userName || '未登录人员', actor: sessions.handover, scanCode: materialCode, ...extra }) }
        catch (error) { message = error instanceof Error ? error.message : String(error) }
        return { label, message, unchanged: snapshot() === original }
      }
      return [
        attempt('无会话', null, { actor: sessions.handover }),
        attempt('省略actor', sessions.handover, { actor: undefined }),
        attempt('错误角色', sessions.operator, { actor: sessions.operator }),
        attempt('跨厂账号', sessions.foreign, { actor: sessions.foreign }),
        attempt('伪造当前会话actor', sessions.handover, { actor: { ...sessions.handover, userName: '冒名人员' } }),
        attempt('缺少扫码', sessions.handover, { scanCode: '' }),
        attempt('错误扫码', sessions.handover, { scanCode: 'WRONG-SOURCE-SCAN' }),
        attempt('超过剩余实物', sessions.handover, { submittedQty: quantity + 1 }),
        attempt('篡改原BOM单位', sessions.admin, { actor: sessions.admin, qtyUnit: unit === '件' ? 'Yard' : '件' }),
      ]
    })
    assert.equal(rejected.length, 9)
    for (const item of rejected) { assert.ok(item.message, item.label); assert.equal(item.unchanged, true, item.label) }
    assert.match(rejected[0].message, /登录|账号/)
    assert.match(rejected[2].message, /交接员|管理员|交出/)
    assert.match(rejected[3].message, /工厂/)
    assert.match(rejected[7].message, /剩余可交出/)
    assert.match(rejected[8].message, /原 BOM|单位/)
    assert.deepEqual(await facts(page), before)
    evidence.rejectedDomainAttempts = rejected

    await page.evaluate(async () => {
      const fixture = (globalThis as any).__realWaterPda
      const detail = await import('/src/pages/pda-handover-detail.ts')
      fixture.detail = detail
      fixture.render = () => { document.body.innerHTML = detail.renderPdaHandoverDetailPage(fixture.headId) }
      localStorage.setItem('fcs_pda_session', JSON.stringify(fixture.sessions.admin))
      fixture.render()
      for (const type of ['click', 'input', 'change']) document.addEventListener(type, async event => {
        if (!(event.target instanceof HTMLElement)) return
        const target = event.target
        const actionNode = target.closest<HTMLElement>('[data-pda-handoverd-action]')
        const handled = await detail.handlePdaHandoverDetailEvent(target)
        if (handled && type === 'click' && actionNode && actionNode.dataset.skipPageRerender !== 'true') fixture.render()
      })
    })
    const rejectedUi = await page.evaluate(async () => {
      const f = (globalThis as any).__realWaterPda
      const results = []
      for (const [label, session] of [['无会话', null], ['错误角色', f.sessions.operator], ['跨厂账号', f.sessions.foreign]] as const) {
        if (session) localStorage.setItem('fcs_pda_session', JSON.stringify(session)); else f.pda.clearPdaSession()
        f.render()
        const button = document.createElement('button')
        button.dataset.pdaHandoverdAction = 'open-new-handout-record'; button.dataset.handoverId = f.headId
        document.body.appendChild(button)
        await f.detail.handlePdaHandoverDetailEvent(button)
        const message = document.querySelector('#pda-handover-detail-toast-root')?.textContent || ''
        button.remove(); f.render()
        results.push({ label, message, formCount: document.querySelectorAll('[data-testid="handout-new-record-form"]').length })
      }
      localStorage.setItem('fcs_pda_session', JSON.stringify(f.sessions.admin)); f.render()
      return results
    })
    evidence.rejectedUiAccess = rejectedUi
    for (const result of rejectedUi) { assert.match(result.message, /登录|角色|工厂|不能操作/, JSON.stringify(result)); assert.equal(result.formCount, 0, result.label) }
    const open = page.locator('[data-pda-handoverd-action="open-new-handout-record"]').first()
    await expect(open).toBeEnabled(); await open.click()
    const form = page.getByTestId('handout-new-record-form')
    await expect(form).toBeVisible()
    const token = await form.getByRole('button', { name: '确认交出', exact: true }).getAttribute('data-water-handover-confirm-token')
    assert.ok(token)
    await form.locator('[data-pda-handoverd-field="newRecordScanCode"]').fill('WRONG-SOURCE-SCAN')
    await form.locator('[data-pda-handoverd-field="newRecordQty"]').fill(String(seed.quantity))
    await form.getByRole('button', { name: '确认交出', exact: true }).click()
    await expect(page.locator('#pda-handover-detail-toast-root')).toContainText(/当前任务|加工单|物料/)
    assert.deepEqual(await facts(page), before)
    await expect(form.locator('[data-pda-handoverd-field="newRecordScanCode"]')).toHaveValue('WRONG-SOURCE-SCAN')
    await expect(form.getByRole('button', { name: '确认交出', exact: true })).toHaveAttribute('data-water-handover-confirm-token', token!)
    const switchedUser = await page.evaluate(async currentToken => {
      const f = (globalThis as any).__realWaterPda
      localStorage.setItem('fcs_pda_session', JSON.stringify(f.sessions.handover))
      const button = document.createElement('button')
      button.dataset.pdaHandoverdAction = 'submit-new-handout-record'; button.dataset.handoverId = f.headId; button.dataset.waterHandoverConfirmToken = currentToken || ''
      document.body.appendChild(button); await f.detail.handlePdaHandoverDetailEvent(button)
      const message = document.querySelector('#pda-handover-detail-toast-root')?.textContent || ''
      button.remove(); localStorage.setItem('fcs_pda_session', JSON.stringify(f.sessions.admin))
      return message
    }, token)
    assert.match(switchedUser, /确认已失效|重新打开确认/)
    assert.deepEqual(await facts(page), before)
    await form.getByRole('button', { name: '取消', exact: true }).click()
    await expect(form).toHaveCount(0)
    const forged = await page.evaluate(async oldToken => {
      const { detail, headId, pda, sessions } = (globalThis as any).__realWaterPda
      const inject = async (value: string, session: any) => {
        if (session) localStorage.setItem('fcs_pda_session', JSON.stringify(session)); else pda.clearPdaSession()
        const button = document.createElement('button')
        button.dataset.pdaHandoverdAction = 'submit-new-handout-record'; button.dataset.handoverId = headId; button.dataset.waterHandoverConfirmToken = value
        document.body.appendChild(button)
        await detail.handlePdaHandoverDetailEvent(button)
        const message = document.querySelector('#pda-handover-detail-toast-root')?.textContent || ''
        button.remove(); return message
      }
      return { fake: await inject('forged-confirm-token', sessions.admin), canceled: await inject(oldToken || '', sessions.admin), noSession: await inject(oldToken || '', null) }
    }, token)
    for (const message of Object.values(forged)) assert.match(message, /确认已失效|重新打开确认/)
    assert.deepEqual(await facts(page), before)
    evidence.confirmationTokens = { generatedForActualAdmin: true, invalidScanKeepsTokenAndDraft: true, differentRealUserRejected: switchedUser, rejected: forged }
    await page.evaluate(() => { const f = (globalThis as any).__realWaterPda; localStorage.setItem('fcs_pda_session', JSON.stringify(f.sessions.handover)); f.render() })
    await expect(open).toBeEnabled(); await open.click(); await expect(form).toBeVisible()
    const handoverToken = await form.getByRole('button', { name: '确认交出', exact: true }).getAttribute('data-water-handover-confirm-token')
    assert.ok(handoverToken); assert.notEqual(handoverToken, token)
    await form.getByRole('button', { name: '取消', exact: true }).click()
    evidence.realRoles = { adminCanOpenConfirmation: true, handoverCanOpenConfirmation: true, handoverTokenUsesRealUser: true }

    const normal = await page.evaluate(() => {
      const { water, handover, sessions, orderId, headId, quantity, materialCode, unit } = (globalThis as any).__realWaterPda
      localStorage.setItem('fcs_pda_session', JSON.stringify(sessions.handover))
      const record = handover.createFactoryHandoverRecord({ handoverOrderId: headId, submittedQty: quantity, qtyUnit: unit, factorySubmittedAt: new Date().toISOString(), factorySubmittedBy: sessions.handover.userName, actor: sessions.handover, scanCode: materialCode })
      const afterHandover = water.getWaterSolubleWorkOrderById(orderId)
      const blockedBeforeReceipt = water.completeWaterSolubleWorkOrder(orderId)
      const receipt = water.writeBackWaterSolubleReceipt(orderId, quantity - 1)
      const beforeDifferenceConfirm = water.completeWaterSolubleWorkOrder(orderId)
      const differenceBefore = water.getWaterSolubleWorkOrderById(orderId)
      const accepted = water.resolveWaterSolubleReceiptDifference(orderId)
      return { record, afterHandover, blockedBeforeReceipt, receipt, beforeDifferenceConfirm, differenceBefore, accepted }
    })
    assert.equal(normal.record.factorySubmittedBy, (normal.afterHandover.actionLogs.at(-1)?.operatorName || normal.record.factorySubmittedBy))
    assert.equal(normal.afterHandover.handoverQty, seed.quantity)
    assert.equal(normal.afterHandover.status, 'HANDOVER_WAIT_RECEIVE')
    assert.equal(normal.blockedBeforeReceipt.ok, false)
    assert.equal(normal.receipt.ok, true)
    assert.equal(normal.differenceBefore.status, 'RECEIPT_DIFFERENCE')
    assert.equal(normal.beforeDifferenceConfirm.ok, false)
    assert.equal(normal.accepted.ok, true)
    assert.equal(normal.accepted.order.handoverBatches.at(-1).receiptDifferenceAccepted, true)
    evidence.normalAndDifference = { normalHandoutFromOriginalSource: true, qty: normal.record.submittedQty, awaitingReceiptBlocksClosure: true, actualBatchDifferenceBlocksClosure: true, explicitDifferenceDecisionRequired: true, persistenceScope: '仅验证现有domain动作结果与责任边界，不声明整个工艺持久化链完成' }
    assert.deepEqual(errors, [])
    await page.screenshot({ path: resolve(output, 'real-handover-confirmation-390.png'), fullPage: true })
  } catch (error) {
    await writeFile(resolve(output, 'failure.json'), JSON.stringify({ error: String(error), pageErrors: errors }, null, 2))
    await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {})
    throw error
  } finally { await context.close() }
})

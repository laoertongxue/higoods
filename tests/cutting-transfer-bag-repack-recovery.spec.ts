import { expect, test, type Page } from '@playwright/test'

import type { BrowserStorageLike } from '../src/data/browser-storage.ts'
import {
  CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY,
  appendCuttingRuntimeEvent,
  type TransferBagTicketFactSnapshot,
} from '../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'
import { submitWholeBagHandover } from '../src/data/fcs/cutting/transfer-bag-operations.ts'
import { appendWaitHandoverInboundEvent } from '../src/pages/process-factory/cutting/wait-handover-runtime.ts'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

const WAIT_HANDOVER_PATH = '/fcs/craft/cutting/warehouse-management/wait-handover'
const PDA_SESSION = {
  userId: 'F090_operator',
  loginId: 'F090_operator',
  userName: '跨端验收操作工',
  roleId: 'ROLE_OPERATOR',
  factoryId: 'F090',
  factoryName: '跨端验收工厂',
  loggedAt: '2026-08-03 10:00:00',
}

function buildHandedOverLedger(bagCode: string): string {
  const records = new Map<string, string>()
  const storage: BrowserStorageLike = {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
    removeItem: (key) => records.delete(key),
  }
  const ticket: TransferBagTicketFactSnapshot = {
    feiTicketId: `${bagCode}-T1`,
    feiTicketNo: `${bagCode}-菲票-1`,
    productionOrderId: 'PO-CROSS-END-ID',
    productionOrderNo: 'PO-CROSS-END-001',
    cutOrderId: 'CUT-CROSS-END-ID',
    cutOrderNo: 'CUT-CROSS-END-001',
    color: '黑色',
    size: 'M',
    partCode: 'FRONT',
    partName: '前幅',
    pieceQty: 12,
    sewingTaskId: 'SEW-CROSS-END-ID',
    sewingTaskNo: 'SEW-CROSS-END-001',
    receiverFactoryId: 'FACTORY-CROSS-END-ID',
    receiverFactoryName: '跨端验收车缝厂',
  }
  const usageCycleId = `usage:${bagCode}:1`
  appendCuttingRuntimeEvent({
    eventType: '菲票装袋',
    eventSource: 'WEB',
    eventStatus: '已同步',
    occurredAt: '2026-08-01 09:00',
    operatorName: '跨端验收装袋员',
    refs: {
      transferBagCode: bagCode,
      usageCycleId,
      productionOrderId: ticket.productionOrderId,
      productionOrderNo: ticket.productionOrderNo,
      feiTicketIds: [ticket.feiTicketId],
      feiTicketNos: [ticket.feiTicketNo],
    },
    payload: {
      baggingRecordId: `bagging:${bagCode}`,
      bagCode,
      feiTicketItems: [ticket],
      totalPieceQty: ticket.pieceQty,
      mixedFlag: false,
      baggingBy: '跨端验收装袋员',
      baggingAt: '2026-08-01 09:00',
    },
  }, storage)
  appendWaitHandoverInboundEvent({
    source: 'WEB',
    operator: { operatorName: '跨端验收入仓员' },
    bagCode,
    warehouseArea: '裁床待交出仓',
    locationCode: 'CROSS-01',
    occurredAt: '2026-08-01 09:10',
    storage,
  })
  submitWholeBagHandover({
    bagCode,
    usageCycleId,
    handoverOrderId: `HO-${bagCode}`,
    handoverOrderNo: `HO-${bagCode}`,
    handoverRecordId: `HR-${bagCode}`,
    handoverRecordNo: `HR-${bagCode}`,
    assignments: [{
      feiTicketId: ticket.feiTicketId,
      feiTicketNo: ticket.feiTicketNo,
      sewingTaskId: ticket.sewingTaskId,
      sewingTaskNo: ticket.sewingTaskNo,
      receiverFactoryId: ticket.receiverFactoryId,
      receiverFactoryName: ticket.receiverFactoryName,
    }],
    submittedTicketSnapshot: [ticket],
    operator: { operatorName: '跨端验收交出员', operatorRole: '裁片仓交出员' },
    source: 'WEB',
    occurredAt: '2026-08-01 09:20',
  }, storage)
  return records.get(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY) || '{"events":[]}'
}

async function installScenario(page: Page, bagCode: string): Promise<void> {
  await page.addInitScript(({ session, ledger, key }) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
    if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, ledger)
  }, {
    session: PDA_SESSION,
    ledger: buildHandedOverLedger(bagCode),
    key: CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY,
  })
}

test('Web 回收与 PDA 报废在同一事实账中即时互认', async ({ page }) => {
  test.setTimeout(180_000)
  const errors = collectPageErrors(page)
  const bagCode = `CROSS-END-${Date.now()}`
  await installScenario(page, bagCode)

  await page.goto(WAIT_HANDOVER_PATH)
  await expect(page.getByRole('heading', { name: '裁床待交出仓' })).toBeVisible({ timeout: 120_000 })
  await page.locator('[data-wait-handover-action="open-recovery"]').click()
  const recovery = page.locator('[data-wait-handover-modal="recovery"]')
  await recovery.locator('[data-wait-handover-field="bagCode"]').fill(bagCode)
  await expect(recovery.locator('[data-wait-handover-recovery-eligibility]')).toContainText('确认后才能回收')
  await recovery.locator('[data-wait-handover-field="physicalBagReceived"]').check()
  await recovery.locator('[data-wait-handover-field="physicalBagEmpty"]').check()
  await recovery.locator('[data-wait-handover-field="recoveryNode"]').fill('裁床')
  await recovery.locator('[data-wait-handover-field="recoveryLocation"]').fill('跨端验收空袋区')
  await recovery.locator('[data-wait-handover-field="reason"]').fill('后道退回实物空袋')
  await recovery.locator('[data-wait-handover-field="operatorName"]').fill('跨端验收回收员')
  await recovery.locator('[data-wait-handover-field="secondConfirm"]').check()
  await recovery.getByRole('button', { name: '确认回收', exact: true }).click()
  await expect(recovery.locator('[data-wait-handover-feedback]')).toContainText('回收成功')

  await page.goto(`/fcs/pda/transfer-bag-detail?bagNo=${bagCode}`)
  await expect(page.locator('body')).toContainText('主状态：空闲')
  await expect(page.locator('body')).toContainText('中转袋回收')

  await page.goto('/fcs/pda/cutting/transfer-bag/scrap')
  const pdaScrapBag = page.getByPlaceholder('扫描或填写中转袋编号')
  await pdaScrapBag.fill(bagCode)
  await pdaScrapBag.press('Enter')
  await expect(page.locator('body')).toContainText('空闲袋可以直接报废')
  await page.getByPlaceholder('例如：袋体破损，无法继续使用').fill('袋体破损，无法修复')
  await page.getByPlaceholder('填写主管姓名').fill('跨端验收主管')
  await page.getByLabel(/我确认报废后该袋永久不能再次装袋/).check()
  await page.getByRole('button', { name: '确认报废' }).click()
  await expect(page.locator('body')).toContainText('报废成功，中转袋已报废')

  await page.goto(WAIT_HANDOVER_PATH)
  await page.locator('[data-wait-handover-action="open-scrap"]').click()
  const webScrap = page.locator('[data-wait-handover-modal="scrap"]')
  await webScrap.locator('[data-wait-handover-field="bagCode"]').fill(bagCode)
  await expect(webScrap.locator('[data-wait-handover-eligibility]')).toContainText('已报废停用')
  await expect(webScrap.getByRole('button', { name: '确认报废', exact: true })).toBeDisabled()
  await expectNoPageErrors(errors)
})

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
]) {
  test(`中转袋管理在 ${viewport.width}×${viewport.height} 下主体不横向溢出`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/fcs/craft/cutting/transfer-bags')
    await expect(page.getByRole('heading', { name: '中转袋流转', exact: true })).toBeVisible({ timeout: 120_000 })
    const layout = await page.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      tableOverflow: Array.from(document.querySelectorAll<HTMLElement>('[data-standard-list-scroll]'))
        .some((element) => element.scrollWidth > element.clientWidth),
    }))
    expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth + 1)
    expect(layout.tableOverflow).toBe(true)
    await expect(page.getByRole('button', { name: '列设置' })).toBeVisible()
    await page.screenshot({
      path: `output/playwright/transfer-bag-web-${viewport.width}x${viewport.height}.png`,
      fullPage: true,
    })
  })
}

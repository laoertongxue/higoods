import { expect, test } from '@playwright/test'
import {
  CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY,
  appendCuttingRuntimeEvent,
  type TransferBagTicketFactSnapshot,
} from '../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'
import type { BrowserStorageLike } from '../src/data/browser-storage.ts'
import { appendWaitHandoverInboundEvent } from '../src/pages/process-factory/cutting/wait-handover-runtime.ts'

const PDA_SESSION = {
  userId: 'F090_operator',
  loginId: 'F090_operator',
  userName: '全能力测试工厂_操作工',
  roleId: 'ROLE_OPERATOR',
  factoryId: 'F090',
  factoryName: '全能力测试工厂',
  loggedAt: '2026-08-03 10:00:00',
}

function buildRepackLedger(): string {
  const records = new Map<string, string>()
  const storage: BrowserStorageLike = {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
    removeItem: (key) => records.delete(key),
  }
  const addBag = (bagCode: string, ticket: TransferBagTicketFactSnapshot) => {
    appendCuttingRuntimeEvent({
      eventType: '菲票装袋',
      eventSource: 'PDA',
      eventStatus: '已同步',
      occurredAt: '2026-08-03 10:00',
      operatorName: 'E2E 装袋员',
      refs: {
        transferBagCode: bagCode,
        usageCycleId: `usage:${bagCode}:1`,
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
        baggingBy: 'E2E 装袋员',
        baggingAt: '2026-08-03 10:00',
      },
    }, storage)
  }
  const ticket = (id: string, pieces: number): TransferBagTicketFactSnapshot => ({
    feiTicketId: id,
    feiTicketNo: `FT-${id}`,
    productionOrderId: 'PO-ID-PDA-E2E',
    productionOrderNo: 'PO-PDA-E2E',
    cutOrderId: `CUT-${id}`,
    cutOrderNo: `CUT-${id}`,
    color: '黑色',
    size: 'M',
    partCode: id.endsWith('01') ? 'FRONT' : 'BACK',
    partName: id.endsWith('01') ? '前幅' : '后幅',
    pieceQty: pieces,
    sewingTaskId: 'SEW-PDA-E2E',
    sewingTaskNo: 'SEW-PDA-E2E',
    receiverFactoryId: 'FACTORY-PDA-E2E',
    receiverFactoryName: '车缝工厂甲',
  })
  addBag('PDA-E2E-BAG-A', ticket('PDA-E2E-01', 12))
  addBag('PDA-E2E-BAG-B', ticket('PDA-E2E-02', 8))
  return records.get(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY) || '[]'
}

function buildHandoverLedger(bagCode = 'PDA-HANDOVER-BAG'): string {
  const records = new Map<string, string>()
  const storage: BrowserStorageLike = {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
    removeItem: (key) => records.delete(key),
  }
  const ticket = (id: string, taskNo: string, pieces: number): TransferBagTicketFactSnapshot => ({
    feiTicketId: id,
    feiTicketNo: `FT-${id}`,
    productionOrderId: 'PO-ID-PDA-HANDOVER',
    productionOrderNo: 'PO-PDA-HANDOVER',
    cutOrderId: `CUT-${id}`,
    cutOrderNo: `CUT-${id}`,
    color: '藏青',
    size: 'L',
    partCode: id.endsWith('01') ? 'FRONT' : 'BACK',
    partName: id.endsWith('01') ? '前幅' : '后幅',
    pieceQty: pieces,
    sewingTaskId: `ID-${taskNo}`,
    sewingTaskNo: taskNo,
    receiverFactoryId: 'FACTORY-PDA-HANDOVER',
    receiverFactoryName: '车缝工厂甲',
  })
  const tickets = [
    ticket('PDA-HANDOVER-01', 'SEW-PDA-HANDOVER-01', 12),
    ticket('PDA-HANDOVER-02', 'SEW-PDA-HANDOVER-02', 8),
  ]
  appendCuttingRuntimeEvent({
    eventType: '菲票装袋',
    eventSource: 'PDA',
    eventStatus: '已同步',
    occurredAt: '2026-08-03 00:00',
    operatorName: 'E2E 装袋员',
    refs: {
      transferBagCode: bagCode,
      usageCycleId: `usage:${bagCode}:1`,
      productionOrderId: 'PO-ID-PDA-HANDOVER',
      productionOrderNo: 'PO-PDA-HANDOVER',
      feiTicketIds: tickets.map((item) => item.feiTicketId),
      feiTicketNos: tickets.map((item) => item.feiTicketNo),
    },
    payload: {
      baggingRecordId: `bagging:${bagCode}`,
      bagCode,
      feiTicketItems: tickets,
      totalPieceQty: 20,
      mixedFlag: false,
      baggingBy: 'E2E 装袋员',
      baggingAt: '2026-08-03 00:00',
    },
  }, storage)
  appendWaitHandoverInboundEvent({
    source: 'PDA',
    operator: { operatorName: 'E2E 入仓员' },
    bagCode,
    warehouseArea: '裁床待交出仓',
    locationCode: 'CUT-A-01',
    occurredAt: '2026-08-03 00:10',
    storage,
  })
  return records.get(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY) || '[]'
}

test.use({ viewport: { width: 390, height: 844 } })

test('拆袋重装支持多来源、多结果和来源袋复用', async ({ page }) => {
  await page.addInitScript(({ session, ledger, key }) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
    if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, ledger)
  }, {
    session: PDA_SESSION,
    ledger: buildRepackLedger(),
    key: CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY,
  })
  await page.goto('/fcs/pda/cutting/transfer-bag/repack')
  await expect(page.getByRole('heading', { name: '拆袋重装', exact: true })).toBeVisible()

  await page.getByPlaceholder('扫描或填写来源袋编号').fill('PDA-E2E-BAG-A')
  await page.getByPlaceholder('扫描或填写来源袋编号').press('Enter')
  await page.getByPlaceholder('扫描或填写来源袋编号').fill('PDA-E2E-BAG-B')
  await page.getByRole('button', { name: '加入来源袋' }).click()
  await expect(page.locator('body')).toContainText('当前 2 只')
  await page.getByRole('button', { name: '来源袋已全部扫描，继续' }).click()

  await page.getByPlaceholder('扫描或填写菲票编号').fill('FT-PDA-E2E-01')
  await page.getByPlaceholder('扫描或填写菲票编号').press('Enter')
  await page.getByPlaceholder('扫描或填写结果袋编号').fill('PDA-E2E-BAG-A')
  await page.getByPlaceholder('扫描或填写结果袋编号').press('Enter')

  await page.getByPlaceholder('扫描或填写菲票编号').fill('FT-PDA-E2E-02')
  await page.getByRole('button', { name: '读取菲票' }).click()
  await page.getByPlaceholder('扫描或填写结果袋编号').fill('PDA-E2E-BAG-C')
  await page.getByRole('button', { name: '分配到结果袋' }).click()

  await expect(page.locator('body')).toContainText(/来源\s*2 张 \/ 20 片/)
  await expect(page.locator('body')).toContainText(/结果\s*2 张 \/ 20 片/)
  await expect(page.locator('body')).toContainText('PDA-E2E-BAG-A')
  await expect(page.locator('body')).toContainText('PDA-E2E-BAG-C')
  await page.getByRole('button', { name: '确认重装' }).click()
  await expect(page.locator('body')).toContainText('重装成功，请继续交出')
  await expect(page.locator('body')).toContainText('待交出')
})

test('中转袋交出只扫袋并支持同工厂多个车缝任务', async ({ page }) => {
  await page.addInitScript(({ session, ledger, key }) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
    if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, ledger)
  }, {
    session: PDA_SESSION,
    ledger: buildHandoverLedger(),
    key: CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY,
  })
  await page.goto('/fcs/pda/cutting/handover/TASK-CUT-PDA-NO-PICKUP-0301?action=transfer-bag-handover')
  await expect(page.getByRole('heading', { name: '中转袋交出', exact: true })).toBeVisible()
  await expect(page.getByPlaceholder('扫描车缝任务')).toHaveCount(0)

  const bagInput = page.getByPlaceholder('扫描或填写中转袋编号')
  await bagInput.fill('PDA-HANDOVER-BAG')
  await bagInput.press('Enter')
  await expect(page.locator('body')).toContainText('SEW-PDA-HANDOVER-01、SEW-PDA-HANDOVER-02')
  await expect(page.locator('body')).toContainText('2 张 / 20 片')
  await expect(page.locator('body')).toContainText('车缝工厂甲')

  await page.getByRole('button', { name: '确认交出' }).click()
  await expect(page.locator('body')).toContainText('交出成功，等待实物袋回收')
  await expect(page.locator('body')).toContainText('当前阶段：已交出待回收')
  await expect(page.locator('body')).toContainText('PDA-HANDOVER-BAG')
})

async function handoverE2eBag(page: import('@playwright/test').Page, bagCode: string): Promise<void> {
  await page.goto('/fcs/pda/cutting/handover/TASK-CUT-PDA-NO-PICKUP-0301?action=transfer-bag-handover')
  const bagInput = page.getByPlaceholder('扫描或填写中转袋编号')
  await bagInput.fill(bagCode)
  await bagInput.press('Enter')
  await page.getByRole('button', { name: '确认交出' }).click()
  await expect(page.locator('body')).toContainText('交出成功，等待实物袋回收')
}

test('中转袋交出后可独立回收并在扫码详情显示空闲', async ({ page }) => {
  const bagCode = 'PDA-RECOVERY-BAG'
  await page.addInitScript(({ session, ledger, key }) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
    if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, ledger)
  }, { session: PDA_SESSION, ledger: buildHandoverLedger(bagCode), key: CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY })
  await handoverE2eBag(page, bagCode)

  await page.goto('/fcs/pda/cutting/transfer-bag/recovery')
  const recoveryBag = page.getByPlaceholder('扫描或填写中转袋编号')
  await recoveryBag.fill(bagCode)
  await recoveryBag.press('Enter')
  await expect(page.locator('body')).toContainText('使用中 / 已交出待回收')
  await expect(page.locator('body')).toContainText('最近交出')
  await page.getByLabel('我已收到实物中转袋').check()
  await page.getByLabel('我已确认实物袋内没有菲票或裁片').check()
  await page.getByRole('button', { name: '确认回收' }).click()
  await expect(page.locator('body')).toContainText('回收成功，中转袋已空闲')

  await page.goto(`/fcs/pda/transfer-bag-detail?bagNo=${bagCode}`)
  await expect(page.locator('body')).toContainText('主状态：空闲')
  await expect(page.locator('body')).toContainText('中转袋回收')
  await expect(page.locator('body')).not.toContainText('确认收货')
})

test('已交出袋报废依次记录回收和报废且永久阻断', async ({ page }) => {
  const bagCode = 'PDA-SCRAP-BAG'
  await page.addInitScript(({ session, ledger, key }) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
    if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, ledger)
  }, { session: PDA_SESSION, ledger: buildHandoverLedger(bagCode), key: CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY })
  await handoverE2eBag(page, bagCode)

  await page.goto('/fcs/pda/cutting/transfer-bag/scrap')
  const scrapBag = page.getByPlaceholder('扫描或填写中转袋编号')
  await scrapBag.fill(bagCode)
  await scrapBag.press('Enter')
  await expect(page.locator('body')).toContainText('依次记录“回收为空闲”和“报废”')
  await page.getByLabel('我已收到实物中转袋').check()
  await page.getByLabel('我已确认实物袋内没有菲票或裁片').check()
  await page.getByPlaceholder('例如：袋体破损，无法继续使用').fill('袋体破损，无法修复')
  await page.getByPlaceholder('填写主管姓名').fill('裁床主管甲')
  await page.getByLabel(/我确认报废后该袋永久不能再次装袋/).check()
  await page.getByRole('button', { name: '确认报废' }).click()
  await expect(page.locator('body')).toContainText('报废成功，中转袋已报废')
  await expect(page.locator('body')).toContainText('先回收记录')
  await expect(page.locator('body')).toContainText('报废记录')

  await page.goto(`/fcs/pda/transfer-bag-detail?bagNo=${bagCode}`)
  await expect(page.locator('body')).toContainText('主状态：已报废')
  await expect(page.locator('body')).toContainText('中转袋回收')
  await expect(page.locator('body')).toContainText('中转袋报废')

  await page.goto('/fcs/pda/cutting/transfer-bag/recovery')
  const blockedBag = page.getByPlaceholder('扫描或填写中转袋编号')
  await blockedBag.fill(bagCode)
  await blockedBag.press('Enter')
  await expect(page.locator('body')).toContainText('已报废，不能回收')
})

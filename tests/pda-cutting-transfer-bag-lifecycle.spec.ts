import { expect, test } from '@playwright/test'
import {
  CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY,
  appendCuttingRuntimeEvent,
  type TransferBagTicketFactSnapshot,
} from '../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'
import type { BrowserStorageLike } from '../src/data/browser-storage.ts'

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

test.use({ viewport: { width: 390, height: 844 } })

test('拆袋重装支持多来源、多结果和来源袋复用', async ({ page }) => {
  await page.addInitScript(({ session, ledger, key }) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
    window.localStorage.setItem(key, ledger)
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

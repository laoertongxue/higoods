import { expect, test, type Page } from '@playwright/test'
import { collectPageErrors, expectNoPageErrors, seedMergeBatchLedger } from './helpers/seed-cutting-runtime-state'

const sampleTaskId = 'TASK-CUT-000097'
const sampleExecutionOrderNo = 'CPO-20260319-K'
const sampleOriginalCutOrderNo = 'CUT-260314-087-02'

function buildMergeBatchLedgerForReleaseAcceptance() {
  return [
    {
      mergeBatchId: 'merge-batch-release-001',
      mergeBatchNo: 'MB-260328-REL-001',
      status: 'READY',
      compatibilityKey: 'HIG-SPU-001::FAB-SKU-MAIN-001',
      styleCode: 'HG-001',
      spuCode: 'HIG-SPU-001',
      styleName: '女式连帽卫衣',
      materialSkuSummary: 'FAB-SKU-MAIN-001',
      sourceProductionOrderCount: 1,
      sourceOriginalCutOrderCount: 1,
      plannedCuttingGroup: '一号裁床',
      plannedCuttingDate: '2026-03-28',
      note: 'release acceptance',
      createdFrom: 'system-seed',
      createdAt: '2026-03-28 09:00',
      updatedAt: '2026-03-28 09:00',
      items: [
        {
          mergeBatchId: 'merge-batch-release-001',
          originalCutOrderId: 'CUT-260302-001-01',
          originalCutOrderNo: 'CUT-260302-001-01',
          productionOrderId: 'PO-202603-0001',
          productionOrderNo: 'PO-202603-0001',
          styleCode: 'HG-001',
          spuCode: 'HIG-SPU-001',
          styleName: '女式连帽卫衣',
          urgencyLabel: 'AA 紧急',
          plannedShipDate: '2026-03-30',
          plannedShipDateDisplay: '2026-03-30',
          materialSku: 'FAB-SKU-MAIN-001',
          materialCategory: '面布',
          materialLabel: '主面料',
          currentStage: '待裁',
          cuttableStateLabel: '可裁',
          sourceCompatibilityKey: 'HG-001::FAB-SKU-MAIN-001',
        },
      ],
    },
  ]
}

async function openFeiTickets(page: Page): Promise<void> {
  await page.goto('/fcs/craft/cutting/fei-tickets')
  await expect(page.getByRole('heading', { name: '打印菲票', exact: true })).toBeVisible()
}

async function printFirstFeiTicket(page: Page): Promise<string> {
  await openFeiTickets(page)
  await page.locator('table tbody').getByRole('button', { name: '打印菲票', exact: true }).first().click()
  await expect(page.locator('body')).toContainText('当前打印单元基础信息')
  await page.getByRole('button', { name: '确认首次打印', exact: true }).click()
  await expect(page.getByRole('heading', { name: '已打印菲票', exact: true, level: 1 })).toBeVisible()

  const ticketNo = ((await page.locator('table tbody tr td').first().textContent()) || '').trim()
  expect(ticketNo).not.toBe('')
  return ticketNo
}

test('release 验收：上游链与主页面链可跑', async ({ page }) => {
  const errors = collectPageErrors(page)

  await seedMergeBatchLedger(page, buildMergeBatchLedgerForReleaseAcceptance())

  await page.goto('/fcs/production/orders')
  await expect(page.locator('body')).toContainText('生产单管理')
  await page.getByRole('button', { name: '从需求生成' }).click()
  await expect(page.locator('[data-dialog-panel="true"]').last()).toContainText('仅支持已发布技术包且状态为待转单的需求')

  await page.goto('/fcs/craft/cutting/production-progress')
  await expect(page.getByRole('heading', { name: '生产单进度', exact: true })).toBeVisible()
  await page.locator('[data-cutting-progress-action="go-original-orders"]').first().click()
  await expect(page).toHaveURL(/productionOrderId=/)

  await page.goto('/fcs/craft/cutting/cuttable-pool')
  await expect(page.getByRole('heading', { name: '可裁排产', exact: true })).toBeVisible()
  await page.locator('[data-cuttable-pool-action="go-original-order-detail"]').first().click()
  await expect(page).toHaveURL(/originalCutOrderId=/)

  await page.goto('/fcs/craft/cutting/merge-batches')
  await expect(page.getByRole('heading', { name: '合并裁剪批次', exact: true })).toBeVisible()
  await expect(page.locator('[data-merge-batches-action="open-detail"]').first()).toBeVisible()

  await expectNoPageErrors(errors)
})

test('release 验收：执行准备链与平台链可跑', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/material-prep')
  await expect(page.getByRole('heading', { name: '仓库配料领料', exact: true })).toBeVisible()

  await page.goto('/fcs/craft/cutting/marker-spreading')
  await expect(page.getByRole('heading', { name: '唛架铺布', exact: true })).toBeVisible()

  await page.goto('/fcs/craft/cutting/fabric-warehouse')
  await expect(page.getByRole('heading', { name: '裁床仓', exact: true })).toBeVisible()

  await page.goto('/fcs/craft/cutting/cut-piece-warehouse')
  await expect(page.getByRole('heading', { name: '裁片仓', exact: true })).toBeVisible()

  await page.goto('/fcs/craft/cutting/sample-warehouse')
  await expect(page.getByRole('heading', { name: '样衣仓', exact: true })).toBeVisible()

  await page.goto('/fcs/craft/cutting/replenishment')
  await expect(page.getByRole('heading', { name: '补料管理', exact: true })).toBeVisible()

  await page.goto('/fcs/craft/cutting/special-processes')
  await expect(page.getByRole('heading', { name: '特殊工艺', exact: true })).toBeVisible()

  await page.goto('/fcs/craft/cutting/summary')
  await expect(page.getByRole('heading', { name: '裁剪总表', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '查看核查' }).first().click()
  await expect(page.locator('body')).toContainText('核查详情')

  await page.goto('/fcs/progress/cutting-overview')
  await expect(page.getByRole('heading', { name: '裁片任务总览', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '查看详情' }).first().click()
  await expect(page.locator('body')).toContainText('链路进度摘要')

  await expectNoPageErrors(errors)
})

test('release 验收：PDA 写回与追溯链可跑', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto(`/fcs/pda/cutting/inbound/${sampleTaskId}?executionOrderNo=${encodeURIComponent(sampleExecutionOrderNo)}`)
  await expect(page.locator('h1').filter({ hasText: '入仓扫码' })).toBeVisible()
  await page.locator('[data-pda-cut-inbound-action="confirm"]').click()
  await expect(page.locator('body')).toContainText('入仓已确认。')

  await page.goto(`/fcs/craft/cutting/cut-piece-warehouse?originalCutOrderNo=${encodeURIComponent(sampleOriginalCutOrderNo)}`)
  await expect(page.getByRole('heading', { name: '裁片仓', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText(sampleOriginalCutOrderNo)

  const ticketNo = await printFirstFeiTicket(page)

  await page.getByRole('button', { name: '查看打印预览', exact: true }).first().click()
  await expect(page.locator('body')).toContainText('工艺顺序')

  await page.goto(`/fcs/craft/cutting/transfer-bags?ticketNo=${encodeURIComponent(ticketNo)}`)
  await expect(page.getByRole('heading', { name: '周转口袋车缝交接', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('步骤 1：扫周转口袋码')
  await expect(page.locator('body')).toContainText('步骤 2：扫菲票码')

  await page.locator('[data-transfer-bags-action="use-master"]').first().click()
  if (await page.getByText('当前尚未选中使用周期。').count()) {
    const sewingTaskSelect = page.locator('[data-transfer-bags-workbench-field="sewingTaskId"]')
    if ((await sewingTaskSelect.locator('option').count()) > 1) {
      await sewingTaskSelect.selectOption({ index: 1 })
    }
    await page.locator('[data-transfer-bags-action="create-usage"]').click()
  }
  await page.locator('[data-transfer-bags-action="set-ticket-input"]').first().click()
  await page.locator('[data-transfer-bags-action="bind-ticket"]').click()
  await expect(page.locator('body')).toContainText('袋内菲票明细')
  await expect(page.locator('body')).toContainText(ticketNo)

  await expectNoPageErrors(errors)
})

test('release 验收：旧入口 redirect 与 UI 骨架稳定', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/order-progress')
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/production-progress$/)

  await page.goto('/fcs/craft/cutting/cut-piece-orders')
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/original-orders$/)

  await page.goto('/fcs/craft/cutting/warehouse-management')
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/fabric-warehouse$/)

  await page.goto('/fcs/craft/cutting/production-progress')
  await expect(page.getByRole('heading', { name: '生产单进度', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()

  await page.goto('/fcs/craft/cutting/transfer-bags')
  await expect(page.getByRole('heading', { name: '周转口袋车缝交接', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()

  await page.goto(`/fcs/pda/cutting/task/${sampleTaskId}?executionOrderNo=${encodeURIComponent(sampleExecutionOrderNo)}`)
  await expect(page.getByRole('heading', { name: '裁片任务', exact: true })).toBeVisible()
  await expect(page.locator('[data-pda-cutting-order-card-id]').first()).toBeVisible()

  await expectNoPageErrors(errors)
})

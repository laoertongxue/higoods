import { expect, test, type Page } from '@playwright/test'
import {
  collectPageErrors,
  expectNoPageErrors,
  seedMergeBatchLedger,
} from './helpers/seed-cutting-runtime-state'

const sampleTaskId = 'TASK-CUT-000097'
const sampleExecutionOrderNo = 'CPO-20260319-K'
const sampleOriginalCutOrderNo = 'CUT-260314-087-02'

function buildMergeBatchLedgerForAcceptance() {
  return [
    {
      mergeBatchId: 'merge-batch-e2e-full-001',
      mergeBatchNo: 'MB-260327-FULL-001',
      status: 'READY',
      compatibilityKey: 'HIG-SPU-001::FAB-SKU-MAIN-001',
      styleCode: 'HG-001',
      spuCode: 'HIG-SPU-001',
      styleName: '女式连帽卫衣',
      materialSkuSummary: 'FAB-SKU-MAIN-001',
      sourceProductionOrderCount: 1,
      sourceOriginalCutOrderCount: 1,
      plannedCuttingGroup: '一号裁床',
      plannedCuttingDate: '2026-03-27',
      note: 'full chain acceptance',
      createdFrom: 'system-seed',
      createdAt: '2026-03-27 09:00',
      updatedAt: '2026-03-27 09:00',
      items: [
        {
          mergeBatchId: 'merge-batch-e2e-full-001',
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
  await expect(page.locator('table').first()).toBeVisible()
}

async function printFirstFeiUnit(page: Page): Promise<{ ticketNo: string }> {
  await openFeiTickets(page)
  await page.locator('table tbody').getByRole('button', { name: '打印菲票', exact: true }).first().click()
  await expect(page.locator('body')).toContainText('当前打印单元基础信息')
  await page.getByRole('button', { name: '确认首次打印', exact: true }).click()
  await expect(page.getByRole('heading', { name: '已打印菲票', exact: true, level: 1 })).toBeVisible()

  const firstTicketCell = page.locator('table tbody tr td').first()
  await expect(firstTicketCell).toBeVisible()
  const ticketNo = (await firstTicketCell.textContent())?.trim() ?? ''
  expect(ticketNo).not.toBe('')
  return { ticketNo }
}

test('上游链可跑：tech pack 发布门槛、production order 快照与原始裁片单关系成立', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/production/orders')
  await expect(page.locator('body')).toContainText('生产单管理')
  await page.getByRole('button', { name: '从需求生成' }).click()

  const dialog = page.locator('[data-dialog-panel="true"]').last()
  await expect(dialog).toContainText('仅支持已发布技术包且状态为待转单的需求')
  await expect(dialog).toContainText('DEM-202603-0001')
  await expect(dialog).not.toContainText('DEM-202603-0002')

  await page.goto('/fcs/production/orders/PO-202603-081')
  await expect(page.locator('body')).toContainText('PO-202603-081')
  await page.getByRole('button', { name: '需求快照' }).click()
  await expect(page.locator('body')).toContainText('DEM-202603-0081')
  await page.getByRole('button', { name: '技术包', exact: true }).click()
  await expect(page.locator('body')).toContainText('快照信息')

  await page.goto('/fcs/craft/cutting/original-orders?productionOrderId=PO-202603-081')
  await expect(page.getByRole('heading', { name: '原始裁片单', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('PO-202603-081')
  await expect(page.locator('body')).toContainText('CUT-')

  await expectNoPageErrors(errors)
})

test('主页面链可跑：生产单进度到原始裁片单、可裁排产和合并批次对象边界正确', async ({ page }) => {
  const errors = collectPageErrors(page)

  await seedMergeBatchLedger(page, buildMergeBatchLedgerForAcceptance())

  await page.goto('/fcs/craft/cutting/production-progress')
  await expect(page.getByRole('heading', { name: '生产单进度', exact: true })).toBeVisible()
  await page.locator('[data-cutting-progress-action="go-original-orders"]').first().click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/original-orders/)
  await expect(page).toHaveURL(/productionOrderId=/)
  await expect(page).not.toHaveURL(/cutPieceOrderNo=/)

  await page.goto('/fcs/craft/cutting/cuttable-pool')
  await expect(page.getByRole('heading', { name: '可裁排产', exact: true })).toBeVisible()
  await page.locator('[data-cuttable-pool-action="go-original-order-detail"]').first().click()
  await expect(page).toHaveURL(/originalCutOrderId=/)

  await page.goto('/fcs/craft/cutting/merge-batches')
  await expect(page.getByRole('heading', { name: '合并裁剪批次', exact: true })).toBeVisible()
  await page.locator('[data-merge-batches-action="open-detail"]').first().click()
  await expect(page.locator('body')).toContainText('来源生产单摘要')
  await expect(page.locator('body')).toContainText('原始裁片单明细')

  await expectNoPageErrors(errors)
})

test('执行准备链可跑：原始裁片单主码、materialSku、补料与特殊工艺链路都成立', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/material-prep')
  await expect(page.getByRole('heading', { name: '仓库配料领料', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('原始裁片单号')
  await expect(page.locator('body')).toContainText('面料摘要')

  await page.goto('/fcs/craft/cutting/marker-spreading')
  await expect(page.getByRole('heading', { name: '唛架铺布', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('高低层模式')

  await page.goto('/fcs/craft/cutting/fabric-warehouse')
  await expect(page.getByRole('heading', { name: '裁床仓', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('面料 SKU')

  await page.goto('/fcs/craft/cutting/cut-piece-warehouse')
  await expect(page.getByRole('heading', { name: '裁片仓', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('原始裁片单号')

  await page.goto('/fcs/craft/cutting/sample-warehouse')
  await expect(page.getByRole('heading', { name: '样衣仓', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('面料 SKU / 款号')

  await page.goto('/fcs/craft/cutting/replenishment')
  await expect(page.getByRole('heading', { name: '补料管理', exact: true })).toBeVisible()
  await page.locator('[data-cutting-replenish-action="open-detail"]').first().click()
  await expect(page.locator('body')).toContainText('补料依据')
  await expect(page.locator('body')).toContainText('面料 SKU')

  await page.goto('/fcs/craft/cutting/special-processes')
  await expect(page.getByRole('heading', { name: '特殊工艺', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('捆条工艺')
  await expect(page.locator('body')).not.toContainText('SP-20260324-002')

  await expectNoPageErrors(errors)
})

test('PDA 链可跑：执行页提交后通过正式写回桥回流到工艺工厂端', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/pda/task-receive?tab=pending-accept')
  await expect(page.getByRole('heading', { name: '接单与报价', exact: true })).toBeVisible()

  await page.goto(`/fcs/pda/cutting/task/${sampleTaskId}?executionOrderNo=${encodeURIComponent(sampleExecutionOrderNo)}`)
  await expect(page.getByRole('heading', { name: '裁片任务', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('绑定原始裁片单')

  await page.goto(`/fcs/pda/cutting/inbound/${sampleTaskId}?executionOrderNo=${encodeURIComponent(sampleExecutionOrderNo)}`)
  await expect(page.locator('h1').filter({ hasText: '入仓扫码' })).toBeVisible()
  await page.locator('[data-pda-cut-inbound-action="confirm"]').click()
  await expect(page.locator('body')).toContainText('入仓已确认。')

  await page.goto(`/fcs/craft/cutting/cut-piece-warehouse?originalCutOrderNo=${encodeURIComponent(sampleOriginalCutOrderNo)}`)
  await expect(page.getByRole('heading', { name: '裁片仓', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText(sampleOriginalCutOrderNo)
  await expect(page.locator('body')).toContainText(/待交接|已交接|已入仓/)

  await expectNoPageErrors(errors)
})

test('追溯链可跑：菲票打印、父子映射、工艺顺序校验和载具周期都成立', async ({ page }) => {
  const errors = collectPageErrors(page)
  const { ticketNo } = await printFirstFeiUnit(page)

  await expect(page.locator('body')).toContainText('打印记录')
  await page.getByRole('button', { name: '查看打印预览', exact: true }).first().click()
  await expect(page.locator('body')).toContainText('工艺顺序')
  await expect(page.locator('body')).toContainText('顺序校验 / 载具绑定')

  await page.goto(`/fcs/craft/cutting/transfer-bags?ticketNo=${encodeURIComponent(ticketNo)}`)
  await expect(page.getByRole('heading', { name: '周转口袋车缝交接', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('步骤 1：扫周转口袋码')
  await expect(page.locator('body')).toContainText('步骤 2：扫菲票码')

  await page.locator('[data-transfer-bags-action="bind-ticket"]').click()
  await expect(page.locator('body')).toContainText('必须先扫口袋码，再扫菲票子码')

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
  await expect(page.locator('body')).toContainText('打印装袋清单')

  await expectNoPageErrors(errors)
})

test('平台链可跑：summary、overview、detail 全部建立在正式 snapshot / projection 上', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/summary')
  await expect(page.getByRole('heading', { name: '裁剪总表' })).toBeVisible()
  await page.getByRole('button', { name: '查看核查' }).first().click()
  await expect(page.getByText('核查详情')).toBeVisible()

  await page.goto('/fcs/progress/cutting-overview')
  await expect(page.getByRole('heading', { name: '裁片任务总览' })).toBeVisible()
  await page.getByRole('button', { name: '查看详情' }).first().click()
  await expect(page.getByText('链路进度摘要')).toBeVisible()
  await expect(page.getByText('平台关注提示')).toBeVisible()
  await expect(page.getByText('问题清单')).toBeVisible()

  await expectNoPageErrors(errors)
})

test('旧入口只会落到 canonical 入口，不会回到旧业务实现', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/order-progress')
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/production-progress$/)

  await page.goto('/fcs/craft/cutting/cut-piece-orders')
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/original-orders$/)

  await page.goto('/fcs/craft/cutting/warehouse-management')
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/fabric-warehouse$/)

  await expectNoPageErrors(errors)
})

test('全链收口后 UI 骨架保持稳定，没有被顺手大改', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/production-progress')
  await expect(page.getByRole('heading', { name: '生产单进度', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()
  await expect(page.locator('[data-cutting-progress-action="go-original-orders"]').first()).toBeVisible()

  await page.goto('/fcs/craft/cutting/material-prep')
  await expect(page.getByRole('heading', { name: '仓库配料领料', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()
  await expect(page.locator('[data-cutting-prep-action="go-marker-spreading-index"]')).toBeVisible()

  await page.goto('/fcs/craft/cutting/fei-tickets')
  await expect(page.getByRole('heading', { name: '打印菲票', exact: true })).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()
  await expect(page.locator('table tbody').getByRole('button', { name: '打印菲票', exact: true }).first()).toBeVisible()

  await page.goto('/fcs/pda/task-receive?tab=pending-accept')
  await expect(page.getByRole('heading', { name: '接单与报价', exact: true })).toBeVisible()
  await expect(page.locator('[data-pda-cutting-task-card-id]').first()).toBeVisible()

  await expectNoPageErrors(errors)
})

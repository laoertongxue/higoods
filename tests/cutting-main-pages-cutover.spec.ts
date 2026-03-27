import { expect, test } from '@playwright/test'
import { seedMergeBatchLedger } from './helpers/seed-cutting-runtime-state'

function buildMergeBatchLedgerForPageTest() {
  return [
    {
      mergeBatchId: 'merge-batch-e2e-001',
      mergeBatchNo: 'MB-260327-E2E-001',
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
      note: 'Playwright cutover test',
      createdFrom: 'system-seed',
      createdAt: '2026-03-27 09:00',
      updatedAt: '2026-03-27 09:00',
      items: [
        {
          mergeBatchId: 'merge-batch-e2e-001',
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

test('生产单进度页切主源后仍正常打开', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/production-progress')

  await expect(page.getByRole('heading', { name: '生产单进度', exact: true })).toBeVisible()
  await expect(page.getByText('紧急程度').first()).toBeVisible()
  await expect(page.getByText('配料').first()).toBeVisible()
  await expect(page.locator('[data-cutting-progress-action="go-original-orders"]').first()).toBeVisible()
})

test('生产单进度到原始裁片单的 drill-down 使用正式生产单参数', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/production-progress')

  await page.locator('[data-cutting-progress-action="go-original-orders"]').first().click()

  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/original-orders/)
  await expect(page).toHaveURL(/productionOrderId=/)
  await expect(page).not.toHaveURL(/cutPieceOrderNo=/)
  await expect(page.getByRole('heading', { name: '原始裁片单', exact: true })).toBeVisible()
  await expect(page.getByText('原始裁片单主表')).toBeVisible()
})

test('可裁排产页以原始裁片单为对象并能进入原始裁片单详情', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/cuttable-pool')

  await expect(page.getByRole('heading', { name: '可裁排产' })).toBeVisible()
  await expect(page.getByText('可裁原始裁片单数')).toBeVisible()

  const detailTrigger = page.locator('[data-cuttable-pool-action="go-original-order-detail"]').first()
  await expect(detailTrigger).toBeVisible()
  await detailTrigger.click()

  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/original-orders/)
  await expect(page).toHaveURL(/originalCutOrderId=/)
  await expect(page).not.toHaveURL(/cutPieceOrderNo=/)
  await expect(page.getByRole('heading', { name: '原始裁片单', exact: true })).toBeVisible()
})

test('原始裁片单页正常打开且面料主识别字段以 materialSku 为主', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/original-orders')

  await expect(page.getByRole('heading', { name: '原始裁片单', exact: true })).toBeVisible()
  await expect(page.getByText('原始裁片单主表')).toBeVisible()
  await expect(page.getByText('面料 SKU').first()).toBeVisible()

  await page.getByRole('button', { name: '查看详情' }).first().click()
  await expect(page.locator('body')).toContainText('面料 SKU')
})

test('合并裁剪批次页只表达执行层上下文，不把批次当新生产单', async ({ page }) => {
  await seedMergeBatchLedger(page, buildMergeBatchLedgerForPageTest())

  await page.goto('/fcs/craft/cutting/merge-batches')

  await expect(page.getByRole('heading', { name: '合并裁剪批次', exact: true })).toBeVisible()
  await expect(page.getByText('批次台账列表')).toBeVisible()
  await expect(page.locator('[data-merge-batches-action="open-detail"]').first()).toBeVisible()

  await page.locator('[data-merge-batches-action="open-detail"]').first().click()
  await expect(page.getByText('来源生产单摘要')).toBeVisible()
  await expect(page.getByText('原始裁片单明细')).toBeVisible()
  await expect(page.getByText('批次仅作为执行层上下文，不改变生产单与原始裁片单归属。')).toBeVisible()
})

test('主页面 UI 骨架保持稳定，没有被顺手大改', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/production-progress')
  await expect(page.getByRole('heading', { name: '生产单进度', exact: true })).toBeVisible()
  await expect(page.getByText('关键词').first()).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()
  await expect(page.locator('[data-cutting-progress-action="go-cuttable-pool-index"]')).toBeVisible()

  await page.goto('/fcs/craft/cutting/original-orders')
  await expect(page.getByRole('heading', { name: '原始裁片单', exact: true })).toBeVisible()
  await expect(page.getByText('原始裁片单主表')).toBeVisible()
  await expect(page.locator('table').first()).toBeVisible()

  await page.goto('/fcs/craft/cutting/cuttable-pool')
  await expect(page.getByRole('heading', { name: '可裁排产', exact: true })).toBeVisible()
  await expect(page.locator('[data-cuttable-pool-action="go-merge-batches"]').first()).toBeVisible()

  await page.goto('/fcs/craft/cutting/merge-batches')
  await expect(page.getByRole('heading', { name: '合并裁剪批次', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '待建批次输入区', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('批次')
})

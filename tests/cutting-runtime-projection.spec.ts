import { expect, test } from '@playwright/test'
import { seedMarkerSpreadingLedger } from './helpers/seed-cutting-runtime-state'

const markerSpreadingStorageKey = 'cuttingMarkerSpreadingLedger'

function buildMarkerStoreForProjectionTest() {
  return {
    markers: [],
    sessions: [
      {
        spreadingSessionId: 'rt-projection-session-001',
        contextType: 'original-order',
        originalCutOrderIds: ['CUT-260302-001-01'],
        mergeBatchId: '',
        mergeBatchNo: '',
        spreadingMode: 'normal',
        status: 'DONE',
        importedFromMarker: false,
        plannedLayers: 1,
        actualLayers: 1,
        totalActualLength: 123,
        totalHeadLength: 0,
        totalTailLength: 0,
        totalCalculatedUsableLength: 123,
        totalRemainingLength: 0,
        operatorCount: 1,
        rollCount: 0,
        configuredLengthTotal: 123,
        claimedLengthTotal: 123,
        varianceLength: 0,
        varianceNote: '',
        note: 'runtime projection test',
        createdAt: '2099-01-01 09:00',
        updatedAt: '2099-01-01 09:10',
        sourceChannel: 'MANUAL',
        sourceWritebackId: '',
        updatedFromPdaAt: '',
        rolls: [],
        operators: [
          {
            operatorId: 'rt-op-001',
            operatorName: '投影验收操作员',
            sortOrder: 1,
            rollRecordId: '',
            actionType: '开始铺布',
            pricingMode: '按件计价',
          },
        ],
      },
    ],
  }
}

test('裁剪总表仍可通过 projection 正常渲染并打开详情', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/summary')

  await expect(page.getByRole('heading', { name: '裁剪总表' })).toBeVisible()
  await expect(page.getByRole('button', { name: '查看核查' }).first()).toBeVisible()

  await page.getByRole('button', { name: '查看核查' }).first().click()
  await expect(page.getByText('核查详情')).toBeVisible()
  await expect(page.getByText('SKU 情况')).toBeVisible()
})

test('平台裁片总览和详情仍可通过 snapshot/projection 正常渲染', async ({ page }) => {
  await page.goto('/fcs/progress/cutting-overview')

  await expect(page.getByRole('heading', { name: '裁片任务总览' })).toBeVisible()
  await expect(page.getByRole('button', { name: '查看详情' }).first()).toBeVisible()

  await page.getByRole('button', { name: '查看详情' }).first().click()
  await expect(page.getByText('链路进度摘要')).toBeVisible()
  await expect(page.getByText('问题清单')).toBeVisible()
  await expect(page.getByText('平台关注提示')).toBeVisible()
})

test('storage 参与的状态仍会进入页面展示，但页面不再依赖 domain 直读 storage', async ({ page }) => {
  await seedMarkerSpreadingLedger(page, buildMarkerStoreForProjectionTest())

  await page.goto('/fcs/progress/cutting-overview')

  await expect(page.locator('body')).toContainText('投影验收操作员')
  await expect(page.locator('body')).toContainText('铺布录入')

  await page.locator('button').filter({ hasText: 'PO-202603-0001' }).first().click()
  await expect(page.getByText('链路进度摘要')).toBeVisible()
  await expect(page.locator('body')).toContainText('投影验收操作员')
})

test('关键裁片页面在 projection 改造后仍可正常打开', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/fei-tickets')
  await expect(page.getByRole('heading', { name: '打印菲票' })).toBeVisible()

  await page.goto('/fcs/craft/cutting/replenishment')
  await expect(page.getByRole('heading', { name: '补料管理' })).toBeVisible()
})

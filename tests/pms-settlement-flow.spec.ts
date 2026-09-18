import { expect, test, type Page } from '@playwright/test'
import { writeFileSync } from 'node:fs'

const SUBJECT_OPERATIONS = '/pms/subject-operations'
const MATERIAL_RECONS = '/pms/material-reconciliations'
const LOGISTICS_RECONS = '/pms/logistics-reconciliations'
const MATERIAL_PAYMENTS = '/pms/material-payment-requests'
const LOGISTICS_PAYMENTS = '/pms/logistics-payment-requests'
const PERF_THRESHOLD = 200

async function measureAction(page: Page, clickSelector: string, readySelector: string): Promise<number> {
  return page.evaluate(
    async ({ clickSelector, readySelector }) => {
      const node = document.querySelector<HTMLElement>(clickSelector)
      if (!node) return -1
      const start = performance.now()
      node.click()
      await new Promise<void>((resolve, reject) => {
        const deadline = performance.now() + 5000
        const check = () => {
          if (document.querySelector(readySelector)) requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          else if (performance.now() > deadline) reject(new Error(`等待 ${readySelector} 超时（点击 ${clickSelector}）`))
          else window.setTimeout(check, 4)
        }
        check()
      })
      return performance.now() - start
    },
    { clickSelector, readySelector },
  )
}

async function measureRouteSwitch(page: Page, toHref: string, toReadySelector: string): Promise<number> {
  return page.evaluate(
    async ({ toHref, toReadySelector }) => {
      const start = performance.now()
      document.querySelector<HTMLElement>(`[data-tab-href="${toHref}"]`)?.click()
      await new Promise<void>((resolve, reject) => {
        const deadline = performance.now() + 5000
        const check = () => {
          if (document.querySelector(toReadySelector)) requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          else if (performance.now() > deadline) reject(new Error(`等待 ${toReadySelector} 超时`))
          else window.setTimeout(check, 4)
        }
        check()
      })
      return performance.now() - start
    },
    { toHref, toReadySelector },
  )
}

test.describe('PMS 采购链路 P3b 对账与请款页面', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
  })

  test('五个对账请款路由可访问', async ({ page }) => {
    for (const [route, rootSelector, title] of [
      [SUBJECT_OPERATIONS, '[data-pms-so-root]', '主体经营明细'],
      [MATERIAL_RECONS, '[data-pms-mrec-root]', '面辅料采购对账'],
      [LOGISTICS_RECONS, '[data-pms-lrec-root]', '物流费用对账'],
      [MATERIAL_PAYMENTS, '[data-pms-pay-root]', '面辅料采购请款'],
      [LOGISTICS_PAYMENTS, '[data-pms-pay-root]', '物流费用请款'],
    ] as const) {
      await page.goto(route)
      await expect(page.locator(rootSelector)).toBeVisible()
      await expect(page.locator('[data-page-content-root]')).not.toContainText('待迁移完整 UI')
    }
  })

  test('面辅料对账差异确认后生成请款并完成请款与付款', async ({ page }) => {
    await page.goto(MATERIAL_RECONS)
    await page.locator('[data-pms-mrec-action="open-detail"][data-recon-id="MR-2026-0004"]').click()
    await expect(page.locator('[data-pms-mrec-detail-root]')).toBeVisible()
    await expect(page.locator('[data-pms-mrec-detail-root]')).toContainText('差异')
    await expect(page.locator('[data-pms-mrec-detail-root]')).toContainText('部分确认')
    await page.locator('[data-pms-mrec-action="confirm-all-fees"]').click()
    await expect(page.locator('[data-pms-mrec-armed-hint]')).toBeVisible()
    await expect(page.locator('[data-pms-mrec-action="confirm-all-fees"]')).toContainText('再次点击确认')
    await page.locator('[data-pms-mrec-action="confirm-all-fees"]').click()
    await expect(page.locator('[data-pms-mrec-root]')).toContainText('已确认全部费用项')
    await page.locator('[data-pms-mrec-action="confirm-difference"]').click()
    await page.locator('[data-pms-mrec-action="confirm-difference"]').click()
    await expect(page.locator('[data-pms-mrec-root]')).toContainText('差异已确认')
    await page.locator('[data-pms-mrec-action="confirm-recon"]').click()
    await page.locator('[data-pms-mrec-action="confirm-recon"]').click()
    await expect(page.locator('[data-pms-mrec-root]')).toContainText('对账已确认')
    await page.keyboard.press('Escape')

    const row = page.locator('[data-pms-mrec-table-surface] tbody tr').filter({ hasText: 'MR-2026-0004' })
    await row.locator('input[data-pms-mrec-field="select-row"]').check()
    await page.locator('[data-pms-mrec-action="generate-payment"]').click()
    await expect(page).toHaveURL(/\/pms\/material-payment-requests/)
    await expect(page.locator('[data-pms-pay-draft-root]')).toBeVisible()
    await page.locator('[data-pms-pay-draft-field="payeeBankName"]').fill('中国银行 E2E 支行')
    await page.locator('[data-pms-pay-action="create-request"]').click()
    await expect(page.locator('[data-pms-pay-root]')).toContainText(/已创建请款单 PAY-M-2026-\d+（/)

    const requestRowNo = await page.locator('[data-pms-pay-table-surface] tbody tr').first().locator('td').first().innerText()
    await page.locator('[data-pms-pay-action="open-detail"]').first().click()
    await expect(page.locator('[data-pms-pay-detail-root]')).toBeVisible()
    await expect(page.locator('[data-pms-pay-detail-root] [data-pms-pay-info-field="payeeBankName"]')).toHaveValue('中国银行 E2E 支行')
    await page.locator('[data-pms-pay-detail-root] [data-pms-common-action="open-image"]').first().click()
    await expect(page.locator('[data-pms-pay-overlays] [data-pms-common-action="close-image"]').first()).toBeVisible()
    await page.locator('[data-pms-pay-overlays] [data-pms-common-action="close-image"]').last().click()
    await expect(page.locator('[data-pms-pay-detail-root]')).toBeVisible()
    await page.locator('[data-pms-pay-action="open-attachment"]').click()
    await page.locator('[data-pms-pay-attachment-name]').fill('E2E 回单.pdf')
    await page.locator('[data-pms-pay-action="submit-attachment"]').click()
    await expect(page.locator('[data-pms-pay-detail-root]')).toContainText('E2E 回单.pdf')
    const removeAttachment = page.locator('[data-pms-pay-detail-root] [data-pms-pay-action="remove-attachment"]').first()
    await removeAttachment.click()
    await expect(page.locator('[data-pms-pay-detail-root]')).toContainText('确认删除附件')
    await removeAttachment.click()
    await expect(page.locator('[data-pms-pay-detail-root]')).toContainText('暂无附件')
    await page.locator('[data-pms-pay-action="open-request"]').click()
    await page.locator('[data-pms-pay-request-note]').fill('端到端请款备注')
    await page.locator('[data-pms-pay-action="submit-request"]').click()
    await expect(page.locator('[data-pms-pay-root]')).toContainText('已提交请款')
    await page.locator('[data-pms-pay-action="open-pay"]').click()
    await page.locator('[data-pms-pay-pay-voucher]').fill('BK-E2E-0001')
    await page.locator('[data-pms-pay-action="submit-pay"]').click()
    await expect(page.locator('[data-pms-pay-root]')).toContainText('付款登记成功')
    await expect(page.locator('[data-pms-pay-detail-root]')).toContainText('端到端请款备注')
    await expect(page.locator('[data-pms-pay-detail-root]')).toContainText('BK-E2E-0001')
    expect(requestRowNo.length).toBeGreaterThan(0)
  })

  test('物流实际费用可导入且导入不自动确认，确认后生成物流请款', async ({ page }) => {
    await page.goto(LOGISTICS_RECONS)
    await expect(page.locator('[data-pms-lrec-table-surface] tbody tr').filter({ hasText: 'LR-2026-0003' })).toContainText('未导入')
    const csvPath = test.info().outputPath('pms-logistics-fees.csv')
    writeFileSync(csvPath, ['头程单号,物流商,运单号,货件号,头程运费,头程物流费,关税,增值税,清关费,附加费,报关费,备注', 'FL-2026-0003,义乌市陆港供应链管理有限公司,DB6600123987,HB-E2E-01,800,0,50,10,20,0,0,端到端导入'].join('\n'))
    await page.locator('[data-pms-lrec-action="open-import"]').click()
    await expect(page.locator('[data-pms-lrec-import-root]')).toBeVisible()
    await page.locator('[data-pms-lrec-field="import-file"]').setInputFiles(csvPath)
    await expect(page.locator('[data-pms-lrec-import-root]')).toContainText('校验通过')
    await page.locator('[data-pms-lrec-action="submit-import"]').click()
    await expect(page.locator('[data-pms-lrec-root]')).toContainText('已导入 1 条物流实际费用')

    await page.locator('[data-pms-lrec-action="open-detail"][data-recon-id="LR-2026-0003"]').click()
    await expect(page.locator('[data-pms-lrec-detail-root]')).toContainText('费用明细（7 项）')
    await page.locator('[data-pms-lrec-action="confirm-all-fees"]').click()
    await expect(page.locator('[data-pms-lrec-armed-hint]')).toBeVisible()
    await page.locator('[data-pms-lrec-action="confirm-all-fees"]').click()
    await expect(page.locator('[data-pms-lrec-root]')).toContainText('7 项费用已全部确认')
    await page.locator('[data-pms-lrec-action="confirm-difference"]').click()
    await page.locator('[data-pms-lrec-action="confirm-difference"]').click()
    await page.locator('[data-pms-lrec-action="confirm-recon"]').click()
    await page.locator('[data-pms-lrec-action="confirm-recon"]').click()
    await expect(page.locator('[data-pms-lrec-root]')).toContainText('对账已确认')
    await page.keyboard.press('Escape')

    const row = page.locator('[data-pms-lrec-table-surface] tbody tr').filter({ hasText: 'LR-2026-0003' })
    await row.locator('input[data-pms-lrec-field="select-row"]').check()
    await page.locator('[data-pms-lrec-action="generate-payment"]').click()
    await expect(page).toHaveURL(/\/pms\/logistics-payment-requests/)
    await expect(page.locator('[data-pms-pay-draft-root]')).toBeVisible()
    await page.locator('[data-pms-pay-draft-field="payeeBankName"]').fill('中国银行 E2E 支行')
    await page.locator('[data-pms-pay-action="create-request"]').click()
    await expect(page.locator('[data-pms-pay-root]')).toContainText(/已创建请款单 PAY-L-2026-\d+（/)
  })

  test('面辅料对账可导入供应商账单且不自动确认', async ({ page }) => {
    await page.goto(MATERIAL_RECONS)
    const csvPath = test.info().outputPath('pms-supplier-bills.csv')
    writeFileSync(csvPath, ['采购单号,物料编码,实际单价,实际采购货款,实际国内物流费,供应商账单,调整金额,备注,对账记录', 'CGF-2026-0006,ACC-2026-0003,0.23,1150,268,6400,0,端到端导入,MR-2026-0006'].join('\n'))
    await page.locator('[data-pms-mrec-action="open-import"]').click()
    await expect(page.locator('[data-pms-mrec-import-root]')).toBeVisible()
    await page.locator('[data-pms-mrec-field="import-file"]').setInputFiles(csvPath)
    await expect(page.locator('[data-pms-mrec-import-root]')).toContainText('校验通过')
    await page.locator('[data-pms-mrec-action="submit-import"]').click()
    await expect(page.locator('[data-pms-mrec-root]')).toContainText('已导入 1 条供应商账单')
    await expect(page.locator('[data-pms-mrec-table-surface]')).toContainText('待确认')
  })

  test('主体经营明细可调整成本明细并保存', async ({ page }) => {
    await page.goto(SUBJECT_OPERATIONS)
    await page.locator('[data-pms-so-action="open-edit"]').first().click()
    await expect(page.locator('[data-pms-so-edit-root]')).toBeVisible()
    await page.locator('[data-pms-so-edit-field="allocatedCost"]').fill('90000')
    await page.locator('[data-pms-so-edit-field="domesticFreight"]').fill('1200')
    await page.locator('[data-pms-so-edit-field="customsDuty"]').fill('800')
    await page.locator('[data-pms-so-action="submit-edit"]').click()
    await expect(page.locator('[data-pms-so-root]')).toContainText(/经营明细已更新：总成本 [\d,.]+，毛利率 [\d.]+%/)
    await expect(page.locator('[data-pms-so-root]')).toContainText('国内段运费')
  })

  test('未付款请款单可作废并释放来源对账', async ({ page }) => {
    await page.goto(MATERIAL_PAYMENTS)
    const row = page.locator('[data-pms-pay-table-surface] tbody tr').filter({ hasText: 'PAY-M-2026-0004' })
    await row.locator('[data-pms-pay-action="open-detail"]').click()
    await expect(page.locator('[data-pms-pay-detail-root]')).toBeVisible()
    await page.locator('[data-pms-pay-action="open-void"]').click()
    await page.locator('[data-pms-pay-void-reason]').fill('端到端作废验证')
    await page.locator('[data-pms-pay-action="submit-void"]').click()
    await expect(page.locator('[data-pms-pay-root]')).toContainText('已作废，来源对账已释放')
  })

  test('面辅料对账支持批量部分确认与部分确认状态展示', async ({ page }) => {
    await page.goto(MATERIAL_RECONS)
    await page.locator('[data-pms-mrec-root] [data-pms-common-action="open-image"]').first().click()
    await expect(page.locator('[data-pms-mrec-overlays] [data-pms-common-action="close-image"]').first()).toBeVisible()
    await page.keyboard.press('Escape')
    const row = page.locator('[data-pms-mrec-table-surface] tbody tr').filter({ hasText: 'MR-2026-0008' })
    await row.locator('input[data-pms-mrec-field="select-row"]').check()
    await page.locator('[data-pms-mrec-action="batch-confirm-partial"]').click()
    await expect(page.locator('[data-pms-mrec-action="batch-confirm-partial"]')).toContainText('再次点击')
    await expect(page.locator('[data-pms-mrec-root]')).toContainText('请再次点击确认批量操作')
    await page.locator('[data-pms-mrec-action="batch-confirm-partial"]').click()
    await expect(page.locator('[data-pms-mrec-root]')).toContainText(/已批量部分确认（采购货款与国内物流费） 1 条对账记录/)
    await expect(page.locator('[data-pms-mrec-table-surface] tbody tr').filter({ hasText: 'MR-2026-0008' })).toContainText('部分确认')
  })

  test('物流对账可按运输方式与物流商筛选', async ({ page }) => {
    await page.goto(LOGISTICS_RECONS)
    await page.locator('[data-pms-lrec-root] [data-process-filter-toggle]').click()
    await page.locator('[data-pms-lrec-field="transportFilter"]').selectOption('海派')
    await page.locator('[data-pms-lrec-action="query"]').click()
    await expect(page.locator('[data-pms-lrec-table-surface] tbody tr')).toHaveCount(1)
    await expect(page.locator('[data-pms-lrec-table-surface]')).toContainText('FL-2026-0001')

    await page.locator('[data-pms-lrec-action="reset"]').click()
    await expect(page.locator('[data-pms-lrec-table-surface] tbody tr')).toHaveCount(3)
  })

  test('P3b 页面站内切换与关键交互均低于 200ms', async ({ page }) => {
    await page.goto(SUBJECT_OPERATIONS)
    await expect(page.locator('[data-pms-so-root]')).toBeVisible()

    const routes: Array<[string, string]> = [
      [MATERIAL_RECONS, '[data-pms-mrec-root]'],
      [LOGISTICS_RECONS, '[data-pms-lrec-root]'],
      [MATERIAL_PAYMENTS, '[data-pms-pay-root]'],
      [LOGISTICS_PAYMENTS, '[data-pms-pay-root]'],
      [SUBJECT_OPERATIONS, '[data-pms-so-root]'],
    ]
    const switchSamples: number[] = []
    for (let index = 0; index < 5; index += 1) {
      for (const [href, selector] of routes) {
        switchSamples.push(await measureRouteSwitch(page, href, selector))
        await expect(page.locator(selector)).toBeVisible()
      }
    }
    for (const sample of switchSamples) {
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThan(PERF_THRESHOLD)
    }

    await measureRouteSwitch(page, SUBJECT_OPERATIONS, '[data-pms-so-root]')
    const subjectInteractions: number[] = []
    for (let index = 0; index < 5; index += 1) {
      subjectInteractions.push(await measureAction(page, '[data-pms-so-action="open-detail"]', '[data-pms-so-root] [role="dialog"]'))
      await page.keyboard.press('Escape')
      subjectInteractions.push(await measureAction(page, '[data-pms-so-action="open-edit"]', '[data-pms-so-edit-root]'))
      await page.keyboard.press('Escape')
    }
    for (const sample of subjectInteractions) {
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThan(PERF_THRESHOLD)
    }

    await measureRouteSwitch(page, MATERIAL_RECONS, '[data-pms-mrec-root]')
    const materialReconInteractions: number[] = []
    for (let index = 0; index < 5; index += 1) {
      materialReconInteractions.push(await measureAction(page, '[data-pms-mrec-action="open-detail"]', '[data-pms-mrec-detail-root]'))
      await page.keyboard.press('Escape')
    }
    for (const sample of materialReconInteractions) {
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThan(PERF_THRESHOLD)
    }

    await measureRouteSwitch(page, LOGISTICS_RECONS, '[data-pms-lrec-root]')
    const logisticsReconInteractions: number[] = []
    for (let index = 0; index < 5; index += 1) {
      logisticsReconInteractions.push(await measureAction(page, '[data-pms-lrec-action="open-detail"]', '[data-pms-lrec-detail-root]'))
      await page.keyboard.press('Escape')
      logisticsReconInteractions.push(await measureAction(page, '[data-pms-lrec-action="open-import"]', '[data-pms-lrec-import-root]'))
      await page.keyboard.press('Escape')
    }
    for (const sample of logisticsReconInteractions) {
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThan(PERF_THRESHOLD)
    }

    await measureRouteSwitch(page, MATERIAL_PAYMENTS, '[data-pms-pay-root]')
    const paymentInteractions: number[] = []
    for (let index = 0; index < 5; index += 1) {
      paymentInteractions.push(await measureAction(page, '[data-pms-pay-action="open-detail"]', '[data-pms-pay-detail-root]'))
      await page.keyboard.press('Escape')
    }
    for (const sample of paymentInteractions) {
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThan(PERF_THRESHOLD)
    }

    console.log(
      JSON.stringify({
        pmsSettlementPerf: {
          routeSwitch: switchSamples.map((value) => Math.round(value)),
          subjects: subjectInteractions.map((value) => Math.round(value)),
          materialRecons: materialReconInteractions.map((value) => Math.round(value)),
          logisticsRecons: logisticsReconInteractions.map((value) => Math.round(value)),
          payments: paymentInteractions.map((value) => Math.round(value)),
        },
      }),
    )
  })
})

import { expect, test, type Page } from '@playwright/test'

const TRADE_SUBJECTS = '/pms/trade-subjects'
const SUPPLIERS = '/pms/suppliers'
const SUPPLY_ARCHIVES = '/pms/supplier-supply-archives'
const MATERIAL_ARCHIVES = '/pms/material-archives'
const GARMENT_SKUS = '/pms/garment-skus'
const SAMPLE_SKUS = '/pms/sample-skus'
const WAREHOUSES = '/pms/warehouses'
const UNITS = '/pms/units'
const BOM_LIST = '/pms/bom-templates'
const BOM_DETAIL = '/pms/bom-templates/HG-TS-2601'
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

test.describe('PMS 采购链路 P3a 主数据页面', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
  })

  test('九个主数据路由与 BOM 详情可访问', async ({ page }) => {
    for (const [route, rootSelector, title] of [
      [TRADE_SUBJECTS, '[data-pms-ts-root]', '贸易主体管理'],
      [SUPPLIERS, '[data-pms-sup-root]', '商品供应商管理'],
      [SUPPLY_ARCHIVES, '[data-pms-arc-root]', '供应商供货档案'],
      [MATERIAL_ARCHIVES, '[data-pms-mat-root]', '面辅料列表'],
      [GARMENT_SKUS, '[data-pms-sku-root]', '成衣列表'],
      [SAMPLE_SKUS, '[data-pms-sku-root]', '样衣列表'],
      [WAREHOUSES, '[data-pms-wh-root]', '仓库管理'],
      [UNITS, '[data-pms-unit-root]', '单位管理'],
      [BOM_LIST, '[data-pms-bom-root]', 'BOM/样板管理'],
      [BOM_DETAIL, '[data-pms-bomd-root]', 'SPU 物料组成'],
    ] as const) {
      await page.goto(route)
      await expect(page.locator(rootSelector)).toBeVisible()
      await expect(page.locator('[data-page-content-root]')).not.toContainText('待迁移完整 UI')
    }
  })

  test('供应商可新增、提交审核并启用', async ({ page }) => {
    await page.goto(SUPPLIERS)
    await page.locator('[data-pms-sup-action="open-create"]').click()
    await expect(page.locator('[data-pms-sup-form-root]')).toBeVisible()
    const name = `端到端供应商${Date.now()}`
    await page.locator('[data-pms-sup-form-field="supplierName"]').fill(name)
    await page.locator('[data-pms-sup-form-field="shortName"]').fill('端到端简称')
    await page.locator('[data-pms-sup-form-field="wechat"]').fill('e2e_wx')
    await page.locator('[data-pms-sup-form-field="defaultDeliveryMethod"]').selectOption('发至中国中转仓')
    await page.locator('[data-pms-sup-form-field="contactName"]').fill('端到端联系人')
    await page.locator('[data-pms-sup-form-field="contactPhone"]').fill('13800000009')
    await page.locator('[data-pms-sup-action="submit-form"]').click()
    await expect(page.locator('[data-pms-sup-root]')).toContainText(/已创建供应商 SUP-2026-\d+（草稿）/)
    await page.locator('[data-pms-sup-table-surface] tbody tr').filter({ hasText: name }).locator('[data-pms-sup-action="open-detail"]').click()
    await expect(page.locator('[data-pms-sup-root] [role="dialog"]').last()).toContainText('e2e_wx')
    await expect(page.locator('[data-pms-sup-root] [role="dialog"]').last()).toContainText('发至中国中转仓')
    await page.keyboard.press('Escape')

    await page.locator('[data-pms-sup-table-surface] tbody tr').filter({ hasText: name }).locator('[data-pms-sup-action="advance"]').click()
    await expect(page.locator('[data-pms-sup-root]')).toContainText('已变为待审核')
    await page.locator('[data-pms-sup-table-surface] tbody tr').filter({ hasText: name }).locator('[data-pms-sup-action="advance"]').click()
    await expect(page.locator('[data-pms-sup-toggle-root]')).toBeVisible()
    await page.locator('[data-pms-sup-action="confirm-toggle"]').click()
    await expect(page.locator('[data-pms-sup-root]')).toContainText('已变为已启用')
  })

  test('单位新增校验唯一性并支持启停', async ({ page }) => {
    await page.goto(UNITS)
    await page.locator('[data-pms-unit-action="open-create"]').click()
    await expect(page.locator('[data-pms-unit-form-root] [data-pms-unit-form-field="category"]')).toContainText('包装')
    await page.keyboard.press('Escape')
    await page.locator('[data-pms-unit-action="open-create"]').click()
    const name = `端到端单位${Date.now()}`
    await page.locator('[data-pms-unit-form-field="unitName"]').fill(name)
    await page.locator('[data-pms-unit-form-field="symbol"]').fill(`E2E${Date.now() % 100000}`)
    await page.locator('[data-pms-unit-action="submit-form"]').click()
    await expect(page.locator('[data-pms-unit-root]')).toContainText(/已创建单位 U-\d+/)

    await page.locator('[data-pms-unit-action="open-create"]').click()
    await page.locator('[data-pms-unit-form-field="unitName"]').fill(name)
    await page.locator('[data-pms-unit-form-field="symbol"]').fill('E2EDUP')
    await page.locator('[data-pms-unit-action="submit-form"]').click()
    await expect(page.locator('[data-pms-unit-form-root]')).toContainText('单位名称已存在')
  })

  test('物料档案可校验图片格式并保存采购补充信息', async ({ page }) => {
    await page.goto(MATERIAL_ARCHIVES)
    await page.locator('[data-pms-mat-action="open-edit"]').first().click()
    await expect(page.locator('[data-pms-mat-edit-root]')).toBeVisible()

    await page.locator('[data-pms-mat-edit-file="image"]').setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') })
    await expect(page.locator('[data-pms-mat-edit-root]')).toContainText('仅支持 png / jpg 格式')
    await page.locator('[data-pms-mat-edit-file="image"]').setInputFiles({ name: 'good.png', mimeType: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]) })
    await expect(page.locator('[data-pms-mat-edit-root]')).toContainText('已选择图片：good.png')

    await page.locator('[data-pms-mat-edit-field="referencePurchasePrice"]').fill('27.7')
    await page.locator('[data-pms-mat-edit-field="declWeaving"]').fill('knitted')
    await page.locator('[data-pms-mat-edit-field="custSource"]').fill('广东佛山')
    await page.locator('[data-pms-mat-action="submit-edit"]').click()
    await expect(page.locator('[data-pms-mat-root]')).toContainText('申报与报关补充信息已保存')
    await expect(page.locator('[data-pms-mat-detail-root]')).toContainText('knitted')
  })

  test('供货档案换算与快照版本更新', async ({ page }) => {
    await page.goto(SUPPLY_ARCHIVES)
    await page.locator('[data-pms-arc-action="open-detail"]').first().click()
    await expect(page.locator('[data-pms-arc-detail-root]')).toBeVisible()
    await page.locator('[data-pms-arc-conv-field="qty"]').fill('250')
    await page.locator('[data-pms-arc-action="convert"]').click()
    await expect(page.locator('[data-pms-arc-conversion-result]')).toContainText('3 卷')
    await page.keyboard.press('Escape')

    await page.locator('[data-pms-arc-action="open-edit"]').first().click()
    await page.locator('[data-pms-arc-edit-field="price"]').fill('28.8')
    await page.locator('[data-pms-arc-action="submit-edit"]').click()
    await expect(page.locator('[data-pms-arc-root]')).toContainText(/已更新到 V\d+ 并生成包装快照/)
  })

  test('BOM 详情可改用量并提交发布', async ({ page }) => {
    await page.goto(BOM_DETAIL)
    await page.locator('[data-pms-bomd-usage="FAB-2026-0001"]').fill('0.38')
    await page.locator('[data-pms-bomd-action="save-usage"]').click()
    await expect(page.locator('[data-pms-bomd-root]')).toContainText('已保存')

    await page.locator('[data-pms-bomd-field="quotePrice"]').fill('33.8')
    await page.locator('[data-pms-bomd-field="factoryLeadTimeDays"]').fill('24')
    await page.locator('[data-pms-bomd-action="save-detail"]').click()
    await expect(page.locator('[data-pms-bomd-root]')).toContainText('工厂与报价已保存')

    await page.locator('[data-pms-bomd-action="submit-bom"]').click()
    await page.locator('[data-pms-bomd-action="submit-bom"]').click()
    await expect(page.locator('[data-pms-bomd-root]')).toContainText('BOM 已提交并发布')
  })

  test('物料档案可保存申报扩展、特殊属性与报关字段', async ({ page }) => {
    await page.goto(MATERIAL_ARCHIVES)
    await page.locator('[data-pms-mat-action="open-edit"]').first().click()
    await expect(page.locator('[data-pms-mat-edit-root]')).toBeVisible()
    await page.locator('[data-pms-mat-edit-field="declBrandName"]').fill('海谷自有品牌')
    await page.locator('[data-pms-mat-edit-field="declModel"]').fill('HG-E2E-MODEL')
    await page.locator('[data-pms-mat-edit-field="declOther"]').fill('端到端申报要素')
    await page.locator('[data-pms-mat-edit-field="custSecondUnit"]').fill('千克')
    await page.locator('[data-pms-mat-edit-field="custSecondUnitValue"]').fill('1.2')
    await page.locator('[data-pms-mat-edit-attr="纺织品"]').check()
    await page.locator('[data-pms-mat-action="submit-edit"]').click()
    await expect(page.locator('[data-pms-mat-root]')).toContainText('申报与报关补充信息已保存')
    await expect(page.locator('[data-pms-mat-detail-root]')).toContainText('海谷自有品牌')
    await expect(page.locator('[data-pms-mat-detail-root]')).toContainText('纺织品')
  })

  test('BOM 详情可保存业务选项与成本字段', async ({ page }) => {
    await page.goto(BOM_DETAIL)
    await page.locator('[data-pms-bomd-option="2"]').check()
    await page.locator('[data-pms-bomd-field="suggestedPrice"]').fill('129')
    await page.locator('[data-pms-bomd-field="targetGrossMargin"]').fill('38.5')
    await page.locator('[data-pms-bomd-field="mainFabric"]').fill('E2E 主布料')
    await page.locator('[data-pms-bomd-action="save-detail"]').click()
    await expect(page.locator('[data-pms-bomd-root]')).toContainText('样板详情、工厂与报价已保存')
    await expect(page.locator('[data-pms-bomd-field="suggestedPrice"]')).toHaveValue('129')
    await expect(page.locator('[data-pms-bomd-option="2"]')).toBeChecked()
  })

  test('P3a 页面站内切换与关键交互均低于 200ms', async ({ page }) => {
    await page.goto(TRADE_SUBJECTS)
    await expect(page.locator('[data-pms-ts-root]')).toBeVisible()

    const routes: Array<[string, string]> = [
      [SUPPLIERS, '[data-pms-sup-root]'],
      [SUPPLY_ARCHIVES, '[data-pms-arc-root]'],
      [MATERIAL_ARCHIVES, '[data-pms-mat-root]'],
      [GARMENT_SKUS, '[data-pms-sku-root]'],
      [SAMPLE_SKUS, '[data-pms-sku-root]'],
      [WAREHOUSES, '[data-pms-wh-root]'],
      [UNITS, '[data-pms-unit-root]'],
      [BOM_LIST, '[data-pms-bom-root]'],
      [TRADE_SUBJECTS, '[data-pms-ts-root]'],
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

    await measureRouteSwitch(page, SUPPLIERS, '[data-pms-sup-root]')
    const supplierInteractions: number[] = []
    for (let index = 0; index < 5; index += 1) {
      supplierInteractions.push(await measureAction(page, '[data-pms-sup-action="open-create"]', '[data-pms-sup-form-root]'))
      await page.keyboard.press('Escape')
      supplierInteractions.push(await measureAction(page, '[data-pms-sup-action="open-detail"]', '[data-pms-sup-root] [role="dialog"]'))
      await page.keyboard.press('Escape')
    }
    for (const sample of supplierInteractions) {
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThan(PERF_THRESHOLD)
    }

    await measureRouteSwitch(page, MATERIAL_ARCHIVES, '[data-pms-mat-root]')
    const materialInteractions: number[] = []
    for (let index = 0; index < 5; index += 1) {
      materialInteractions.push(await measureAction(page, '[data-pms-mat-action="open-detail"]', '[data-pms-mat-root] [role="dialog"]'))
      await page.keyboard.press('Escape')
      materialInteractions.push(await measureAction(page, '[data-pms-mat-action="open-edit"]', '[data-pms-mat-edit-root]'))
      await page.keyboard.press('Escape')
    }
    for (const sample of materialInteractions) {
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThan(PERF_THRESHOLD)
    }

    await measureRouteSwitch(page, SUPPLY_ARCHIVES, '[data-pms-arc-root]')
    const archiveInteractions: number[] = []
    for (let index = 0; index < 5; index += 1) {
      archiveInteractions.push(await measureAction(page, '[data-pms-arc-action="open-detail"]', '[data-pms-arc-detail-root]'))
      await page.keyboard.press('Escape')
      archiveInteractions.push(await measureAction(page, '[data-pms-arc-action="open-edit"]', '[data-pms-arc-edit-root]'))
      await page.keyboard.press('Escape')
    }
    for (const sample of archiveInteractions) {
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThan(PERF_THRESHOLD)
    }

    await measureRouteSwitch(page, UNITS, '[data-pms-unit-root]')
    const unitInteractions: number[] = []
    for (let index = 0; index < 5; index += 1) {
      unitInteractions.push(await measureAction(page, '[data-pms-unit-action="open-create"]', '[data-pms-unit-form-root]'))
      await page.keyboard.press('Escape')
      unitInteractions.push(await measureAction(page, '[data-pms-unit-action="toggle"]', '[data-pms-unit-toggle-root]'))
      await page.keyboard.press('Escape')
    }
    for (const sample of unitInteractions) {
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThan(PERF_THRESHOLD)
    }

    await measureRouteSwitch(page, GARMENT_SKUS, '[data-pms-sku-root]')
    const skuInteractions: number[] = []
    for (let index = 0; index < 5; index += 1) {
      skuInteractions.push(await measureAction(page, '[data-pms-sku-action="open-detail"]', '[data-pms-sku-root] [role="dialog"]'))
      await page.keyboard.press('Escape')
    }
    for (const sample of skuInteractions) {
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThan(PERF_THRESHOLD)
    }

    const bomDetailSamples: number[] = []
    for (let index = 0; index < 5; index += 1) {
      await page.goto(BOM_LIST)
      await expect(page.locator('[data-nav="/pms/bom-templates/HG-TS-2601"]')).toBeVisible()
      bomDetailSamples.push(
        await page.evaluate(async () => {
          const start = performance.now()
          document.querySelector<HTMLElement>('[data-nav="/pms/bom-templates/HG-TS-2601"]')?.click()
          await new Promise<void>((resolve, reject) => {
            const deadline = performance.now() + 5000
            const check = () => {
              if (document.querySelector('[data-pms-bomd-root]')) requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
              else if (performance.now() > deadline) reject(new Error('BOM 详情导航超时'))
              else window.setTimeout(check, 4)
            }
            check()
          })
          return performance.now() - start
        }),
      )
    }
    for (const sample of bomDetailSamples) {
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThan(PERF_THRESHOLD)
    }

    console.log(
      JSON.stringify({
        pmsMasterDataPerf: {
          routeSwitch: switchSamples.map((value) => Math.round(value)),
          suppliers: supplierInteractions.map((value) => Math.round(value)),
          materials: materialInteractions.map((value) => Math.round(value)),
          archives: archiveInteractions.map((value) => Math.round(value)),
          units: unitInteractions.map((value) => Math.round(value)),
          skus: skuInteractions.map((value) => Math.round(value)),
          bomDetail: bomDetailSamples.map((value) => Math.round(value)),
        },
      }),
    )
  })
})

  test('仓库详情展示属性、同步状态与可用开关', async ({ page }) => {
    await page.goto(WAREHOUSES)
    await page.locator('[data-pms-wh-action="open-detail"]').first().click()
    const dialog = page.locator('[data-pms-wh-root] [role="dialog"]').last()
    await expect(dialog).toContainText('仓库属性 / 主体')
    await expect(dialog).toContainText('同步状态')
    await expect(dialog).toContainText('可采购申请 / 下单 / 发货')
    await page.keyboard.press('Escape')
  })

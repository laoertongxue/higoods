import { expect, test, type Locator, type Page } from '@playwright/test'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { listGeneratedCutOrderSourceRecords } from '../src/data/fcs/cutting/generated-cut-orders.ts'
import { resolveProductionMaterialImageUrl } from '../src/data/fcs/production-material-image-assets.ts'
import { buildBindingProcessOrders } from '../src/pages/process-factory/cutting/binding-strip-orders.ts'

const routes = {
  PART: '/fcs/craft/cutting/fei-tickets',
  BINDING: '/fcs/craft/cutting/binding-fei-tickets',
} as const

const roots = {
  PART: '[data-cutting-fei-list-root="PART"]',
  BINDING: '[data-cutting-fei-list-root="BINDING"]',
} as const

const eventPrefixes = {
  PART: 'cutting-part-fei-list',
  BINDING: 'cutting-binding-fei-list',
} as const

const preferenceKeys = {
  PART: 'standard-list:/fcs/craft/cutting/fei-tickets',
  BINDING: 'standard-list:/fcs/craft/cutting/binding-fei-tickets',
} as const

type ListMode = keyof typeof routes

function collectRuntimeErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('favicon')) errors.push(message.text())
  })
  return errors
}

async function resetPreferences(page: Page): Promise<void> {
  await page.addInitScript(({ keys, guardKey }) => {
    if (sessionStorage.getItem(guardKey)) return
    keys.forEach((key) => localStorage.removeItem(key))
    sessionStorage.setItem(guardKey, '1')
  }, { keys: Object.values(preferenceKeys), guardKey: 'cutting-fei-standard-list-test-reset' })
}

async function openList(page: Page, mode: ListMode): Promise<Locator> {
  await page.goto(routes[mode], { waitUntil: 'domcontentloaded' })
  const root = page.locator(roots[mode])
  await expect(root).toBeVisible({ timeout: 60_000 })
  await expect(root.locator('[data-standard-list-page]')).toHaveCount(1)
  await expect(root.locator('[data-standard-list-table]')).toHaveCount(1)
  await expect(root.locator('[data-standard-list-scroll]')).toHaveCount(1)
  return root
}

function pageSizeSelect(root: Locator, mode: ListMode): Locator {
  return root.locator(`[data-${eventPrefixes[mode]}-field="pageSize"]`)
}

function listAction(root: Locator, mode: ListMode, action: string): Locator {
  return root.locator(`[data-${eventPrefixes[mode]}-action="${action}"]`)
}

async function readPaginationTotal(root: Locator): Promise<number> {
  const text = await root.locator('[data-cutting-fei-list-pagination-surface]').innerText()
  const match = text.match(/共\s*([\d,]+)\s*条/)
  expect(match, `分页未展示总数：${text}`).toBeTruthy()
  return Number(match![1].replaceAll(',', ''))
}

async function measureDomAction(
  page: Page,
  config: { type: 'click' | 'input'; trigger: string; observe: string; value?: string },
): Promise<number> {
  const elapsed = await page.evaluate((options) => new Promise<number>((resolveElapsed, reject) => {
    const trigger = document.querySelector<HTMLElement>(options.trigger)
    const observed = document.querySelector<HTMLElement>(options.observe)
    if (!trigger || !observed) {
      reject(new Error(`交互测量节点不存在：${options.trigger} / ${options.observe}`))
      return
    }
    const startedAt = performance.now()
    let timer = 0
    const observer = new MutationObserver(() => {
      observer.disconnect()
      window.clearTimeout(timer)
      resolveElapsed(performance.now() - startedAt)
    })
    observer.observe(observed, { childList: true, subtree: true, attributes: true })
    if (options.type === 'input' && trigger instanceof HTMLInputElement) {
      trigger.value = options.value || ''
      trigger.dispatchEvent(new Event('input', { bubbles: true }))
    } else {
      trigger.click()
    }
    timer = window.setTimeout(() => {
      observer.disconnect()
      reject(new Error(`轻交互 1 秒内没有 DOM 变化：${options.trigger}`))
    }, 1_000)
  }), config)
  expect(elapsed).toBeLessThan(200)
  return elapsed
}

test.beforeEach(async ({ page }) => {
  await resetPreferences(page)
})

test('捆条菲票物料全部使用对象对应正式图片资源而非生成色板', () => {
  const targetBom = productionOrders
    .find((order) => order.demandSnapshot.spuCode === 'SPU-2024-017')
    ?.techPackSnapshot?.bomItems
    .find((item) => item.id === 'tdv_demand_SPU_2024_017-bom-main')
  expect(targetBom, '未找到点名的 SPU-2024-017 主面料 BOM').toBeTruthy()
  expect(targetBom!.materialImageUrl).toBe('/materials/fei-ticket/navy-main-fabric.png')
  expect(targetBom!.materialImageUrl).not.toContain('data:image/svg+xml')

  const orders = buildBindingProcessOrders()
  const materialImages = orders.map((order) => ({
    identity: `${order.materialIdentity.materialSku} / ${order.materialIdentity.materialColor}`,
    url: order.materialIdentity.materialImageUrl,
  }))

  expect(materialImages.length).toBeGreaterThan(0)
  for (const material of materialImages) {
    expect(material.url, `${material.identity} 缺少正式物料图`).toMatch(/^\/materials\/fei-ticket\/[a-z0-9-]+\.png$/)
    expect(material.url, `${material.identity} 仍在使用生成色板`).not.toContain('data:image/svg+xml')
    const assetPath = resolve(process.cwd(), 'public', material.url.replace(/^\//, ''))
    expect(existsSync(assetPath), `${material.identity} 图片文件不存在：${assetPath}`).toBe(true)
    expect(statSync(assetPath).size, `${material.identity} 图片文件异常小`).toBeGreaterThan(100_000)
  }

  const imageByIdentity = new Map(materialImages.map((material) => [material.identity, material.url]))
  const findImage = (skuFragment: string, color: string): string | undefined =>
    materialImages.find((material) => material.identity.includes(skuFragment) && material.identity.endsWith(` / ${color}`))?.url
  expect(findImage('SPU_2024_010', 'Black')).not.toBe(findImage('MAT-SUPPLEMENT-SECONDARY-010', 'Black'))
  expect(findImage('SPU_2024_010', 'Black')).not.toBe(findImage('SPU_2024_010', 'Charcoal'))
  expect(findImage('MAT-SUPPLEMENT-SECONDARY-010', 'Black')).not.toBe(findImage('MAT-SUPPLEMENT-SECONDARY-010', 'Charcoal'))
  expect(new Set(imageByIdentity.values()).size).toBeGreaterThanOrEqual(10)

  const expectedSecondaryImages = new Map([
    ['Black', '/materials/fei-ticket/black-splice-fabric.png'],
    ['Charcoal', '/materials/fei-ticket/charcoal-splice-fabric.png'],
    ['Navy', '/materials/fei-ticket/navy-splice-fabric.png'],
    ['Khaki', '/materials/fei-ticket/khaki-splice-fabric.png'],
  ])
  const sourceRecords = listGeneratedCutOrderSourceRecords()
  for (const [color, expectedUrl] of expectedSecondaryImages) {
    const sourceRecord = sourceRecords.find((record) =>
      record.materialIdentity.materialSku === 'MAT-SUPPLEMENT-SECONDARY-010'
      && record.materialIdentity.materialColor === color,
    )
    expect(sourceRecord, `缺少 ${color} 拼接物料来源记录`).toBeTruthy()
    expect(sourceRecord!.materialIdentity.materialImageUrl).toBe(expectedUrl)
    expect(resolveProductionMaterialImageUrl({
      materialSku: 'MAT-SUPPLEMENT-SECONDARY-010',
      materialName: '拼接面料',
      materialColor: color,
    })).toBe(expectedUrl)
    const assetPath = resolve(process.cwd(), 'public', expectedUrl.replace(/^\//, ''))
    expect(existsSync(assetPath), `${color} 拼接物料正式图片不存在`).toBe(true)
    expect(statSync(assetPath).size, `${color} 拼接物料正式图片异常小`).toBeGreaterThan(100_000)
  }
  expect(resolveProductionMaterialImageUrl({
    materialSku: 'MAT-SUPPLEMENT-SECONDARY-010',
    materialName: '拼接面料',
    materialColor: '未维护颜色',
  })).toBe('')
})

test('页面源码声明标准列表契约并退出历史基线', async () => {
  const source = readFileSync(resolve(process.cwd(), 'src/pages/process-factory/cutting/fei-tickets.ts'), 'utf8')
  const baseline = readFileSync(resolve(process.cwd(), 'scripts/standard-list-page-baseline.json'), 'utf8')
  expect(source).toMatch(/^\/\/ @page-pattern: list$/m)
  expect(source).toContain('renderStandardListPage')
  expect(source).toContain('createProcessOrderListController')
  expect(source).toContain('renderStandardListTable')
  expect(source).toContain('renderTablePagination')
  expect(baseline).not.toContain('src/pages/process-factory/cutting/fei-tickets.ts')
})

for (const config of [
  {
    mode: 'PART' as const,
    title: '部位菲票打印',
    headers: ['铺布单 / 手动批次', '来源', '菲票明细', '特殊工艺', '打印信息', '状态', '操作'],
    requiredText: ['生产单：', '裁片单：', 'SPU：', '颜色：', '是否有特殊工艺：', '全部打印', '菲票明细'],
  },
  {
    mode: 'BINDING' as const,
    title: '捆条菲票打印',
    headers: ['捆条加工单', '来源', '物料 / 纸样', '捆条明细', '盘扣 / 打印用纸', '打印信息', '状态', '操作'],
    requiredText: ['纸样：', '普通白票', '盘扣黄票', '同单含普通白票与盘扣黄票', '菲票明细'],
  },
]) {
  test(`${config.title}使用统一骨架、标准表格和标准分页且保留原列内容`, async ({ page }) => {
    const errors = collectRuntimeErrors(page)
    await page.setViewportSize({ width: 1366, height: 768 })
    const root = await openList(page, config.mode)
    await expect(root.getByRole('heading', { name: config.title, exact: true })).toBeVisible()
    await expect(root.locator('thead th[data-column-key]')).toHaveText(config.headers)
    await expect(pageSizeSelect(root, config.mode)).toHaveValue('10')
    await expect(pageSizeSelect(root, config.mode).locator('option')).toHaveText(['10 条/页', '20 条/页', '50 条/页'])
    const total = await readPaginationTotal(root)
    const renderedRows = await root.locator('tbody tr').count()
    expect(renderedRows).toBe(Math.min(total, 10))
    expect(total).toBeGreaterThan(0)
    for (const text of config.requiredText) await expect(root.locator('tbody').getByText(text, { exact: false }).first()).toBeVisible()
    const actionHeader = root.locator('th[data-column-key="actions"]')
    await expect(actionHeader).toHaveClass(/sticky/)
    await expect(actionHeader).toHaveClass(/right-0/)
    expect(errors).toEqual([])
  })
}

test('部位菲票分页、筛选、排序和列设置局部更新并保留手动建票与原跳转', async ({ page }) => {
  const errors = collectRuntimeErrors(page)
  const root = await openList(page, 'PART')
  await root.evaluate((element) => {
    ;(window as typeof window & { __feiStable?: { main: Element | null; root: Element; section: Element | null } }).__feiStable = {
      main: document.querySelector('main'),
      root: element,
      section: element.querySelector('[data-standard-list-table-section]'),
    }
  })

  const firstPrintHref = await root.getByRole('button', { name: '全部打印', exact: true }).first().getAttribute('data-nav')
  const firstDetailHref = await root.getByRole('button', { name: '菲票明细', exact: true }).first().getAttribute('data-nav')
  expect(firstPrintHref).toBeTruthy()
  expect(firstDetailHref).toMatch(/^\/fcs\/craft\/cutting\/fei-tickets\//)
  await expect(root.getByRole('button', { name: '手动增加打印菲票', exact: true })).toBeVisible()

  const sortButton = root.locator('th[data-column-key="spreading"] button')
  await sortButton.click()
  await expect(sortButton.locator('[data-standard-list-sort-icon="asc"]')).toBeVisible()
  await sortButton.click()
  await expect(sortButton.locator('[data-standard-list-sort-icon="desc"]')).toBeVisible()
  await sortButton.click()
  await expect(sortButton.locator('[data-standard-list-sort-icon="none"]')).toBeVisible()

  await root.getByRole('button', { name: '列设置', exact: true }).click()
  await expect(page.getByRole('heading', { name: '部位菲票打印列设置', exact: true })).toBeVisible()
  const specialCraftSetting = page.locator('[data-standard-list-column-key="specialCraft"]')
  await expect(specialCraftSetting.getByRole('checkbox', { name: '显示' })).toBeDisabled()
  const sourceSetting = page.locator('[data-standard-list-column-key="source"]')
  await sourceSetting.getByRole('checkbox', { name: '冻结' }).check()
  await expect(root.locator('th[data-column-key="source"]')).toHaveClass(/sticky/)
  const printInfoSetting = page.locator('[data-standard-list-column-key="printInfo"]')
  const detailSetting = page.locator('[data-standard-list-column-key="details"]')
  await printInfoSetting.dragTo(detailSetting)
  await expect(root.locator('thead th[data-column-key]').nth(2)).toHaveAttribute('data-column-key', 'printInfo')
  await printInfoSetting.getByRole('checkbox', { name: '显示' }).uncheck()
  await expect(root.locator('th[data-column-key="printInfo"]')).toHaveCount(0)
  await page.getByRole('button', { name: '关闭', exact: true }).last().click()

  const keyword = root.locator('[data-cutting-fei-field="keyword"]')
  const sampleObject = (await root.locator('tbody tr').first().innerText()).match(/(?:PB|MB|SPREADING|MANUAL)[\w-]+/)?.[0] || 'PB'
  await measureDomAction(page, {
    type: 'input',
    trigger: `${roots.PART} [data-cutting-fei-field="keyword"]`,
    observe: `${roots.PART} [data-cutting-fei-list-table-surface]`,
    value: sampleObject,
  })
  await expect(keyword).toHaveValue(sampleObject)
  await expect(root.locator('tbody tr').first()).toContainText(sampleObject)
  await root.getByRole('button', { name: '清空筛选', exact: true }).click()
  await expect(keyword).toHaveValue('')

  const stability = await root.evaluate((element) => {
    const before = (window as typeof window & { __feiStable?: { main: Element | null; root: Element; section: Element | null } }).__feiStable
    return {
      mainSame: Boolean(before && before.main === document.querySelector('main')),
      rootSame: Boolean(before && before.root === element),
      sectionSame: Boolean(before && before.section === element.querySelector('[data-standard-list-table-section]')),
    }
  })
  expect(stability).toEqual({ mainSame: true, rootSame: true, sectionSame: true })
  expect(errors).toEqual([])
})

test('两个路由偏好相互隔离，持久偏好保留而页码和排序在重入时重置', async ({ page }) => {
  let root = await openList(page, 'PART')
  await pageSizeSelect(root, 'PART').selectOption('20')
  await root.locator('th[data-column-key="spreading"] button').click()
  const partTotal = await readPaginationTotal(root)
  if (partTotal > 20) await listAction(root, 'PART', 'next-page').click()

  root = await openList(page, 'BINDING')
  await expect(pageSizeSelect(root, 'BINDING')).toHaveValue('10')
  await pageSizeSelect(root, 'BINDING').selectOption('50')
  const stored = await page.evaluate((keys) => ({
    part: JSON.parse(localStorage.getItem(keys.PART) || '{}'),
    binding: JSON.parse(localStorage.getItem(keys.BINDING) || '{}'),
  }), preferenceKeys)
  expect(stored.part.pageSize).toBe(20)
  expect(stored.binding.pageSize).toBe(50)

  root = await openList(page, 'PART')
  await expect(pageSizeSelect(root, 'PART')).toHaveValue('20')
  await expect(root.locator('[data-standard-list-sort-icon="asc"], [data-standard-list-sort-icon="desc"]')).toHaveCount(0)
  await expect(root.locator('[data-cutting-fei-list-pagination-surface]')).toContainText('1 /')
})

test('捆条物料图保持同列身份展示并可查看大图和失败态', async ({ page }) => {
  const root = await openList(page, 'BINDING')
  await pageSizeSelect(root, 'BINDING').selectOption('50')
  const renderedRows = root.locator('tbody tr')
  const renderedRowCount = await renderedRows.count()
  expect(renderedRowCount).toBeGreaterThan(0)
  await expect(root.getByText('缺少真实图片', { exact: true })).toHaveCount(0)
  await expect(root.locator('tbody [data-cutting-fei-action="open-binding-material-preview"]')).toHaveCount(renderedRowCount)
  const materialCell = root.locator('tbody tr').first().locator('td').nth(2)
  await expect(materialCell.locator('img')).toHaveCount(1)
  await expect(materialCell.locator('[data-material-identity-name="true"]')).toBeVisible()
  const previewButton = materialCell.locator('[data-cutting-fei-action="open-binding-material-preview"]')
  await expect(previewButton).toBeVisible()
  await previewButton.click()
  const dialog = page.locator('[data-cutting-fei-binding-material-preview]')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('img')).toHaveAttribute('alt', /高清大图$/)
  await expect(dialog.getByText('图片加载失败，请核对素材。')).toBeAttached()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test('捆条列表与详情沿用部位菲票结构并稳定展示同单双纸色 Mock', async ({ page }) => {
  const errors = collectRuntimeErrors(page)
  const mixedOrder = buildBindingProcessOrders().find((order) => {
    const whiteCount = order.bindingDetails.filter((detail) => !detail.requiresButtonLoop).length
    const yellowCount = order.bindingDetails.filter((detail) => detail.requiresButtonLoop).length
    return whiteCount > 0 && yellowCount > 0
  })
  expect(mixedOrder, '缺少同一捆条加工单同时包含普通捆条和盘扣捆条的 Mock').toBeTruthy()

  const root = await openList(page, 'BINDING')
  await expect(root.getByText('白票 / 盘扣黄票', { exact: true })).toBeVisible()
  await expect(root.getByText('同单双纸色', { exact: true })).toBeVisible()
  const mixedBadge = root.locator('[data-binding-mixed-paper-order]').first()
  await expect(mixedBadge).toBeVisible()
  const mixedRow = mixedBadge.locator('xpath=ancestor::tr')
  await expect(mixedRow.locator('[data-binding-paper-routing="MIXED"]')).toContainText('普通白票：1 张')
  await expect(mixedRow.locator('[data-binding-paper-routing="MIXED"]')).toContainText('盘扣黄票：1 张')
  await expect(mixedRow.getByRole('button', { name: '普通白票（1）', exact: true })).toBeVisible()
  await expect(mixedRow.getByRole('button', { name: '盘扣黄票（1）', exact: true })).toBeVisible()

  await mixedRow.getByRole('button', { name: '菲票明细', exact: true }).click()
  await expect(page.getByRole('heading', { name: '捆条菲票明细', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '捆条加工单菲票概况', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '来源与工艺概况', exact: true })).toBeVisible()
  await expect(page.locator('[data-binding-detail-mixed-paper]')).toContainText('同单同时有普通白票')
  await expect(page.getByRole('button', { name: '普通捆条 · 白色热敏纸（1）', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '盘扣捆条 · 黄色热敏纸（1）', exact: true })).toBeVisible()
  await expect(page.locator('[data-binding-fei-detail-table]')).toContainText('不需要盘扣')
  await expect(page.locator('[data-binding-fei-detail-table]')).toContainText('白色热敏纸 · 衣服捆条')

  await page.getByRole('button', { name: '盘扣捆条 · 黄色热敏纸（1）', exact: true }).click()
  await expect(page.locator('[data-binding-fei-detail-table]')).toContainText('需要盘扣')
  await expect(page.locator('[data-binding-fei-detail-table]')).toContainText('APF - 辅助工艺 · 中央辅料仓')
  await expect(page.getByText('当前仅展示需要做盘扣的捆条菲票', { exact: false })).toBeVisible()
  const yellowBatchPrint = page.getByRole('button', { name: '打印当前盘扣黄票（1）', exact: true })
  await expect(yellowBatchPrint).toHaveAttribute('data-nav', /paperColor=YELLOW/)
  expect(errors).toEqual([])
})

test('PDA 裁床待交出仓提供菲票打编号入口并直达既有编号页', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/fcs/pda/auth/login', { waitUntil: 'domcontentloaded' })
  await page.locator('[data-pda-login-field="loginId"]').fill('ID-F001_operator')
  await page.locator('[data-pda-login-field="password"]').fill('123456')
  await page.locator('[data-pda-login-action="submit"]').click()
  await expect(page).toHaveURL(/\/fcs\/pda\/exec$/)
  await page.goto('/fcs/pda/warehouse/wait-handover?scope=cutting', { waitUntil: 'domcontentloaded' })
  const entry = page.locator('[data-pda-cutting-wait-handover-entry="fei-ticket-numbering"]')
  await expect(entry).toBeVisible()
  await expect(entry).toContainText('菲票打编号')
  await expect(entry).toHaveAttribute('data-nav', '/fcs/pda/cutting/fei-ticket-numbering')
  await entry.click()
  await expect(page).toHaveURL(/\/fcs\/pda\/cutting\/fei-ticket-numbering$/)
  await expect(page.locator('body')).toContainText('菲票打编号')
})

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
]) {
  test(`${viewport.width}×${viewport.height} 下两个宽表只在表格内部滚动且页面主体不横向溢出`, async ({ page }) => {
    await page.setViewportSize(viewport)
    for (const mode of ['PART', 'BINDING'] as const) {
      const root = await openList(page, mode)
      const layout = await root.evaluate((element) => {
        const scroller = element.querySelector<HTMLElement>('[data-standard-list-scroll]')
        const actionHeader = element.querySelector<HTMLElement>('th[data-column-key="actions"]')
        return {
          pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          internalScroll: Boolean(scroller && scroller.scrollWidth > scroller.clientWidth),
          actionPosition: actionHeader ? getComputedStyle(actionHeader).position : '',
          actionRight: actionHeader ? getComputedStyle(actionHeader).right : '',
        }
      })
      expect(layout.pageOverflow).toBe(0)
      expect(layout.internalScroll).toBe(true)
      expect(layout.actionPosition).toBe('sticky')
      expect(layout.actionRight).toBe('0px')
    }
  })
}

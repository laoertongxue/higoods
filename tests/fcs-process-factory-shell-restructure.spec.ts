import { expect, test, type Locator, type Page } from '@playwright/test'

async function resetShellState(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.clear()
    window.localStorage.setItem('sidebar-collapsed', 'false')
  })
}

function getDesktopSidebar(page: Page): Locator {
  return page.locator('aside').first()
}

async function expectPfosActive(page: Page): Promise<void> {
  await expect(page.locator('[data-action="switch-system"][data-system-id="pfos"]')).toHaveClass(/text-blue-600/)
}

async function expectPfosSidebarGroups(page: Page): Promise<void> {
  const sidebar = getDesktopSidebar(page)
  for (const label of ['工作台', '裁床厂管理', '印花厂管理', '染厂管理']) {
    await expect(sidebar.locator(`[data-menu-group-header="${label}"]`)).toBeVisible()
  }
}

async function openSidebarChild(page: Page, parentKey: string, childKey: string): Promise<void> {
  const sidebar = getDesktopSidebar(page)
  const child = sidebar.locator(`[data-tab-key="${childKey}"]`)
  if (!(await child.isVisible().catch(() => false))) {
    await sidebar.locator(`[data-item-key="${parentKey}"]`).click()
  }
  await expect(child).toBeVisible()
  await child.click()
}

async function expectSidebarChildActive(page: Page, childKey: string): Promise<void> {
  const sidebar = getDesktopSidebar(page)
  await expect(sidebar.locator(`[data-tab-key="${childKey}"]`)).toHaveClass(/bg-blue-50/)
}

function expectNoPlaceholder(page: Page): Promise<void> {
  return expect(page.locator('body')).not.toContainText(/页面已接入路由与菜单联动|待迁移完整 UI 与交互|功能建设中/)
}

test.beforeEach(async ({ page }) => {
  await resetShellState(page)
  await page.setViewportSize({ width: 1440, height: 960 })
})

test('顶部系统新增 PFOS，点击后进入工艺工作台', async ({ page }) => {
  await page.goto('/fcs/workbench/overview')

  await expect(page.locator('[data-action="switch-system"][data-system-id="pfos"]')).toBeVisible()
  await page.locator('[data-action="switch-system"][data-system-id="pfos"]').click()

  await expect(page).toHaveURL(/\/fcs\/craft\/workbench\/overview$/)
  await expectPfosActive(page)
  await expectPfosSidebarGroups(page)
})

test('FCS 左侧不再保留工艺工厂运营系统整组', async ({ page }) => {
  await page.goto('/fcs/workbench/overview')

  const sidebar = getDesktopSidebar(page)
  await expect(page.locator('[data-action="switch-system"][data-system-id="fcs"]')).toHaveClass(/text-blue-600/)
  await expect(sidebar).not.toContainText('工艺工厂运营系统')
  await expect(sidebar.locator('[data-menu-group-header="平台运营系统"]')).toBeVisible()
  await expect(sidebar.locator('[data-menu-group-header="工厂端移动应用"]')).toBeVisible()
})

test('PFOS 关键菜单点击有效且高亮归属正确', async ({ page }) => {
  await page.goto('/fcs/craft/workbench/overview')
  await expectPfosActive(page)
  await expectPfosSidebarGroups(page)

  const cases = [
    {
      parentKey: 'pfos-cutting-overview',
      childKey: 'pfos-cutting-production-progress',
      href: /\/fcs\/craft\/cutting\/production-progress$/,
      heading: '生产单进度',
    },
    {
      parentKey: 'pfos-cutting-prep',
      childKey: 'pfos-cutting-original-orders',
      href: /\/fcs\/craft\/cutting\/original-orders$/,
      heading: '原始裁片单',
    },
    {
      parentKey: 'pfos-cutting-prep',
      childKey: 'pfos-cutting-marker-list',
      href: /\/fcs\/craft\/cutting\/marker-list$/,
      heading: '唛架列表',
    },
    {
      parentKey: 'pfos-cutting-execution',
      childKey: 'pfos-cutting-spreading-list',
      href: /\/fcs\/craft\/cutting\/spreading-list$/,
      heading: '铺布列表',
    },
    {
      parentKey: 'pfos-cutting-post',
      childKey: 'pfos-cutting-fei-tickets',
      href: /\/fcs\/craft\/cutting\/fei-tickets$/,
      heading: '打印菲票',
    },
    {
      parentKey: 'pfos-cutting-handover',
      childKey: 'pfos-cutting-fabric-warehouse',
      href: /\/fcs\/craft\/cutting\/fabric-warehouse$/,
      heading: '裁床仓',
    },
    {
      parentKey: 'pfos-printing',
      childKey: 'pfos-printing-work-orders',
      href: /\/fcs\/craft\/printing\/work-orders$/,
      heading: '印花加工单',
    },
    {
      parentKey: 'pfos-printing',
      childKey: 'pfos-printing-pending-review',
      href: /\/fcs\/craft\/printing\/pending-review$/,
      heading: '印花审核',
    },
    {
      parentKey: 'pfos-dyeing',
      childKey: 'pfos-dyeing-work-orders',
      href: /\/fcs\/craft\/dyeing\/work-orders$/,
      heading: '染色加工单',
    },
    {
      parentKey: 'pfos-dyeing',
      childKey: 'pfos-dyeing-dye-orders',
      href: /\/fcs\/craft\/dyeing\/dye-orders$/,
      heading: '染料单',
    },
  ] as const

  for (const item of cases) {
    await openSidebarChild(page, item.parentKey, item.childKey)
    await expect(page).toHaveURL(item.href)
    await expect(page.getByRole('heading', { level: 1, name: item.heading })).toBeVisible()
    await expectPfosActive(page)
    await expectSidebarChildActive(page, item.childKey)
    await expectNoPlaceholder(page)
  }
})

test('直接打开 craft 深链时仍归属 PFOS', async ({ page }) => {
  await page.goto('/fcs/craft/printing/work-orders')

  await expect(page).toHaveURL(/\/fcs\/craft\/printing\/work-orders$/)
  await expect(page.getByRole('heading', { level: 1, name: '印花加工单' })).toBeVisible()
  await expectPfosActive(page)
  await expectPfosSidebarGroups(page)
  await expectSidebarChildActive(page, 'pfos-printing-work-orders')
  await expectNoPlaceholder(page)
})

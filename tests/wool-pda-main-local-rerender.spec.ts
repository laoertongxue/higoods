import { expect, test } from '@playwright/test'

const WOOL_SESSION = {
  userId: 'OWN_WOOL_FACTORY_operator',
  loginId: 'OWN_WOOL_FACTORY_operator',
  userName: '周哥毛织厂_操作工',
  roleId: 'ROLE_OPERATOR',
  factoryId: 'OWN_WOOL_FACTORY',
  factoryName: '周哥毛织厂',
  loggedAt: '2026-07-31 10:00:00',
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((session) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
  }, WOOL_SESSION)
})

test('毛织输入和弹窗动作经过真实 main.ts 分发链且不替换整页根节点', async ({ page }) => {
  await page.goto('/fcs/pda/exec/TASK-WOOL-MOCK-01')
  const woolRoot = page.locator('[data-pda-wool-root]')
  await expect(woolRoot).toBeVisible()
  const originalRoot = await woolRoot.elementHandle()
  expect(originalRoot).not.toBeNull()

  await woolRoot.locator('[data-pda-wool-action="open-fact"]').first().click()
  await expect(page.locator('[data-pda-wool-overlay-root] section')).toBeVisible()
  expect(await originalRoot!.evaluate((node) => node.isConnected)).toBe(true)

  const draftInput = page.locator('[data-pda-wool-draft="sync-draft"]:visible').first()
  if (await draftInput.getAttribute('type') === 'checkbox') {
    await draftInput.check()
  } else {
    await draftInput.fill('1')
  }
  expect(await originalRoot!.evaluate((node) => node.isConnected)).toBe(true)

  await page.locator('[data-pda-wool-action="close-overlay"]').first().click()
  expect(await originalRoot!.evaluate((node) => node.isConnected)).toBe(true)
})

test('执行任务卡使用移动端渐进加载，搜索后重置首批并局部刷新', async ({ page }) => {
  await page.goto('/fcs/pda/exec?tab=NOT_STARTED')
  const listRoot = page.locator('[data-testid="pda-exec-card-list"]')
  await expect(listRoot.locator('[data-pda-exec-pagination]')).toHaveCount(0)
  await expect(listRoot).not.toContainText('上一页')
  await expect(listRoot).not.toContainText('下一页')
  expect(await listRoot.locator('[data-testid="pda-exec-task-card"]').count()).toBeLessThanOrEqual(10)
  const originalList = await listRoot.elementHandle()
  const loadMoreButton = listRoot.locator('[data-pda-exec-action="load-more"][data-list-key="general"]')
  if (await loadMoreButton.count()) {
    const initialCount = await listRoot.locator('[data-testid="pda-exec-task-card"]').count()
    await loadMoreButton.click()
    expect(await listRoot.locator('[data-testid="pda-exec-task-card"]').count()).toBeGreaterThan(initialCount)
    expect(await originalList!.evaluate((node) => node.isConnected)).toBe(true)
    await page.locator('[data-pda-exec-field="searchKeyword"]').fill('TASK-WOOL')
    await expect(listRoot.locator('[data-pda-exec-pagination]')).toHaveCount(0)
    expect(await listRoot.locator('[data-testid="pda-exec-task-card"]').count()).toBeLessThanOrEqual(10)
    expect(await originalList!.evaluate((node) => node.isConnected)).toBe(true)
  }
})

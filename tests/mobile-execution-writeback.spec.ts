import { expect, test, type Page } from '@playwright/test'

async function acceptDialogs(page: Page, values: string[]): Promise<void> {
  const queue = [...values]
  page.removeAllListeners('dialog')
  page.on('dialog', async (dialog) => {
    const value = queue.shift() ?? ''
    await dialog.accept(value)
  })
}

async function seedPdaSession(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'fcs_pda_session',
      JSON.stringify({
        userId: 'ID-F002_operator',
        loginId: 'ID-F002_operator',
        userName: '印花染色后道操作员',
        roleId: 'ROLE_OPERATOR',
        factoryId: 'ID-F002',
        factoryName: 'PT Prima Printing Center',
        loggedAt: '2026-04-24 09:00:00',
      }),
    )
  })
}

async function spaGoto(page: Page, path: string): Promise<void> {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, '', nextPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}

async function closeTodoModalIfPresent(page: Page): Promise<void> {
  const modal = page.locator('[data-pda-todo-modal="true"]')
  const visible = await modal
    .waitFor({ state: 'visible', timeout: 1000 })
    .then(() => true)
    .catch(() => false)
  if (visible) {
    const closeButton = modal.getByRole('button', { name: '关闭', exact: true }).last()
    if (await closeButton.isVisible()) {
      await closeButton.click()
    } else {
      await page.locator('[data-pda-shell-action="close-todo-modal"]').first().click({ force: true })
    }
  }
  await page.evaluate(() => {
    document.querySelectorAll('[data-pda-todo-modal="true"]').forEach((node) => node.remove())
  })
  await expect(modal).toHaveCount(0)
}

test('印花移动端执行和交出写回 Web 详情', async ({ page }) => {
  await seedPdaSession(page)
  await acceptDialogs(page, ['320', '0'])
  await page.goto('/fcs/pda/exec/TASK-PRINT-000717')
  await closeTodoModalIfPresent(page)
  await page.getByRole('button', { name: '完成打印' }).click()

  await spaGoto(page, '/fcs/craft/printing/work-orders/PWO-PRINT-004?tab=execution')
  await expect(page.getByRole('heading', { name: '打印转印' })).toBeVisible()
  await expect(page.getByText('打印完成时间：').first()).toBeVisible()
  await spaGoto(page, '/fcs/craft/printing/work-orders/PWO-PRINT-004?tab=progress')
  await expect(page.getByRole('heading', { name: '执行进度' })).toBeVisible()
  await expect(page.getByText('320').first()).toBeVisible()

  await acceptDialogs(page, ['360'])
  await spaGoto(page, '/fcs/pda/exec/TASK-PRINT-000718')
  await closeTodoModalIfPresent(page)
  await page.getByRole('button', { name: '发起交出' }).first().click()
  await spaGoto(page, '/fcs/craft/printing/work-orders/PWO-PRINT-005?tab=handover')
  await expect(page.getByRole('heading', { name: '送货交出' })).toBeVisible()
  await expect(page.getByText('360').first()).toBeVisible()
  await spaGoto(page, '/fcs/craft/printing/work-orders/PWO-PRINT-005?tab=review')
  await expect(page.getByRole('heading', { name: '审核记录' })).toBeVisible()
})

test('染色移动端执行和交出写回 Web 详情', async ({ page }) => {
  await seedPdaSession(page)
  await acceptDialogs(page, ['520', '500'])
  await page.goto('/fcs/pda/exec/TASK-DYE-000726')
  await closeTodoModalIfPresent(page)
  await page.getByRole('button', { name: '完成染色' }).click()

  await spaGoto(page, '/fcs/craft/dyeing/work-orders/DWO-006?tab=execution')
  await expect(page.getByRole('heading', { name: '染缸执行' })).toBeVisible()
  await expect(page.getByText('500').first()).toBeVisible()
  await spaGoto(page, '/fcs/craft/dyeing/work-orders/DWO-006?tab=statistics')
  await expect(page.getByRole('heading', { name: '染色统计' })).toBeVisible()
  await expect(page.getByText('染色报表')).toHaveCount(0)

  await acceptDialogs(page, ['480'])
  await spaGoto(page, '/fcs/pda/exec/TASK-DYE-000727')
  await closeTodoModalIfPresent(page)
  await page.getByRole('button', { name: '发起交出' }).first().click()
  await spaGoto(page, '/fcs/craft/dyeing/work-orders/DWO-007?tab=handover')
  await expect(page.getByRole('heading', { name: '送货交出' })).toBeVisible()
  await expect(page.getByText('480').first()).toBeVisible()
})

test('后道移动端专门后道工厂复检完成生成交出仓', async ({ page }) => {
  await seedPdaSession(page)
  await acceptDialogs(page, ['278'])
  await page.goto('/fcs/pda/exec/POST-WO-022')
  await closeTodoModalIfPresent(page)
  await expect(page.getByRole('heading', { name: '后道任务执行' })).toBeVisible()
  await page.getByRole('button', { name: '完成复检' }).click()

  await spaGoto(page, '/fcs/craft/post-finishing/wait-handover-warehouse')
  await expect(page.getByRole('heading', { name: '后道交出仓' })).toBeVisible()
  await expect(page.getByText('HD-2026-022').first()).toBeVisible()
})

test('后道移动端非专门工厂只能执行后道交接动作', async ({ page }) => {
  await seedPdaSession(page)
  await page.goto('/fcs/pda/exec/POST-WO-201')
  await closeTodoModalIfPresent(page)
  await expect(page.getByRole('heading', { name: '后道任务执行' })).toBeVisible()
  await expect(page.getByRole('button', { name: '交给后道工厂' })).toBeVisible()
  await expect(page.getByRole('button', { name: /质检/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /复检/ })).toHaveCount(0)
})

test('特殊工艺移动端使用对象化数量字段并接入统一回写动作', async ({ page }) => {
  await seedPdaSession(page)
  await page.goto('/fcs/pda/exec/TASKGEN-202603-0002-003')
  await closeTodoModalIfPresent(page)
  await expect(page.getByRole('heading', { name: '任务详情' })).toBeVisible()
  const startButton = page.getByRole('button', { name: '开工', exact: true }).first()
  if ((await startButton.isVisible()) && (await startButton.isEnabled())) {
    await startButton.click()
    await page.reload()
  }
  await expect(page.getByRole('heading', { name: '特殊工艺菲票' })).toBeVisible()
  await expect(page.getByText('暂无绑定菲票')).toBeVisible()
})

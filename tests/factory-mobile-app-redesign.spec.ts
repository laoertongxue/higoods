import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function loginFactoryMobileApp(page: import('@playwright/test').Page, loginId = 'ID-F001_operator', password = '123456') {
  await page.goto('/fcs/pda/login')
  await page.locator('[data-pda-login-field="loginId"]').fill(loginId)
  await page.locator('[data-pda-login-field="password"]').fill(password)
  await page.locator('[data-pda-login-action="submit"]').click()
  await expect(page).toHaveURL(/\/fcs\/pda\/task-receive$/)
}

function pageTitle(page: import('@playwright/test').Page, title: string) {
  return page.locator('div.text-lg.font-semibold.text-foreground').filter({ hasText: title }).first()
}

async function closeTodoModalIfPresent(page: import('@playwright/test').Page): Promise<void> {
  const todoModal = page.locator('[data-pda-todo-modal="true"]')
  const appeared = await todoModal
    .waitFor({ state: 'visible', timeout: 1500 })
    .then(() => true)
    .catch(() => false)
  if (appeared) {
    await todoModal.getByRole('button', { name: '关闭', exact: true }).last().click()
    await expect(todoModal).toHaveCount(0)
  }
}

async function switchToWarehouseFactorySession(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    window.localStorage.setItem(
      'fcs_pda_session',
      JSON.stringify({
        userId: 'ID-F002_operator',
        loginId: 'ID-F002_operator',
        userName: 'PT_Prima_操作工',
        roleId: 'ROLE_OPERATOR',
        factoryId: 'ID-F002',
        factoryName: 'PT Prima Printing Center',
        loggedAt: '2026-04-22 09:00:00',
      }),
    )
  })
  await page.goto('/fcs/pda/warehouse')
  await expect(page).toHaveURL(/\/fcs\/pda\/warehouse$/)
}

test('登录后默认弹出当前待办，并可进入待办汇总与待办详情', async ({ page }) => {
  const errors = collectPageErrors(page)

  await loginFactoryMobileApp(page)

  const todoModal = page.locator('[data-pda-todo-modal="true"]')
  await expect(todoModal).toBeVisible()
  await expect(todoModal.getByText('当前待办')).toBeVisible()
  await expect(todoModal.getByRole('button', { name: '查看全部', exact: true })).toBeVisible()

  await todoModal.getByRole('button', { name: '查看全部', exact: true }).click()
  await expect(page).toHaveURL(/\/fcs\/pda\/notify$/)
  await expect(pageTitle(page, '待办汇总')).toBeVisible()
  await expect(page.locator('[data-pda-todo-card-id]').first()).toBeVisible()

  await page.locator('[data-pda-todo-card-id]').first().getByRole('button', { name: '查看详情', exact: true }).click()
  await expect(page).toHaveURL(/\/fcs\/pda\/notify\/todo-/)
  await expect(pageTitle(page, '待办详情')).toBeVisible()
  await expect(page.getByRole('button', { name: '去处理', exact: true })).toBeVisible()

  await expectNoPageErrors(errors)
})

test('底部 Tab 固定为接单/执行/交接/仓管/结算，仓管页可进入各子页面', async ({ page }) => {
  const errors = collectPageErrors(page)

  await loginFactoryMobileApp(page)
  await switchToWarehouseFactorySession(page)
  await closeTodoModalIfPresent(page)

  const bottomNav = page.locator('[data-pda-bottom-nav="true"]')
  await expect(bottomNav).toContainText('接单')
  await expect(bottomNav).toContainText('执行')
  await expect(bottomNav).toContainText('交接')
  await expect(bottomNav).toContainText('仓管')
  await expect(bottomNav).toContainText('结算')
  await expect(bottomNav).not.toContainText('待办')

  await expect(pageTitle(page, '仓管')).toBeVisible()
  await expect(page.locator('[data-pda-warehouse-card="wait-process"]')).toBeVisible()
  await expect(page.locator('[data-pda-warehouse-card="wait-handover"]')).toBeVisible()
  await expect(page.locator('[data-pda-warehouse-card="inbound-records"]')).toBeVisible()
  await expect(page.locator('[data-pda-warehouse-card="outbound-records"]')).toBeVisible()
  await expect(page.locator('[data-pda-warehouse-card="stocktake"]')).toBeVisible()
  await expect(page.locator('[data-pda-warehouse-card="difference"]')).toBeVisible()

  await page.goto('/fcs/pda/warehouse/wait-process')
  await closeTodoModalIfPresent(page)
  await expect(page).toHaveURL(/\/fcs\/pda\/warehouse\/wait-process$/)
  await expect(pageTitle(page, '待加工仓')).toBeVisible()
  await page.getByRole('button', { name: '查看', exact: true }).first().click()
  await expect(page.getByText('待加工仓详情')).toBeVisible()
  await expect(page.getByText('来源单号', { exact: true })).toBeVisible()
  await expect(page.getByText('应收数量', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '关闭', exact: true }).first().click()

  await page.goto('/fcs/pda/warehouse/wait-handover')
  await closeTodoModalIfPresent(page)
  await expect(pageTitle(page, '待交出仓')).toBeVisible()
  await page.getByRole('button', { name: '查看', exact: true }).first().click()
  await expect(page.getByText('待交出仓详情')).toBeVisible()
  await expect(page.getByText('交出单', { exact: true })).toBeVisible()
  await expect(page.getByText('回写数量', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '关闭', exact: true }).first().click()

  await page.goto('/fcs/pda/warehouse/inbound-records')
  await closeTodoModalIfPresent(page)
  await expect(pageTitle(page, '入库记录')).toBeVisible()
  await page.getByRole('button', { name: '查看', exact: true }).first().click()
  await expect(page.getByText('入库单号', { exact: true })).toBeVisible()
  await expect(page.getByText('操作时间', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '关闭', exact: true }).first().click()

  await page.goto('/fcs/pda/warehouse/outbound-records')
  await closeTodoModalIfPresent(page)
  await expect(pageTitle(page, '出库记录')).toBeVisible()
  await page.getByRole('button', { name: '查看', exact: true }).first().click()
  await expect(page.getByText('出库单号', { exact: true })).toBeVisible()
  await expect(page.getByText('出库时间', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '关闭', exact: true }).first().click()

  await page.goto('/fcs/pda/warehouse/stocktake')
  await closeTodoModalIfPresent(page)
  await expect(pageTitle(page, '盘点')).toBeVisible()
  await expect(page.getByRole('button', { name: '创建全盘', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '待加工仓', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '待交出仓', exact: true })).toBeVisible()

  await expectNoPageErrors(errors)
})

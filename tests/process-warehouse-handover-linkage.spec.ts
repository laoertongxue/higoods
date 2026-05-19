import { expect, test, type Page } from '@playwright/test'

async function navigateInApp(page: Page, path: string) {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, '', nextPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}

async function confirmActionDialog(page: Page, actionName: string) {
  await expect(page.getByRole('heading', { name: actionName })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: '确认执行' }).click()
}

test('印花 Web 完成转印后进入待交出仓', async ({ page }) => {
  await page.goto('/fcs/craft/printing/work-orders/PWO-PRINT-004')
  await expect(page.getByRole('heading', { name: '印花加工单详情' })).toBeVisible()
  await expect(page.getByRole('button', { name: '完成打印' })).toBeVisible()

  await page.getByRole('button', { name: '完成打印' }).click()
  await confirmActionDialog(page, '完成打印')
  await expect(page.locator('body')).toContainText('待转印')

  await expect(page.getByRole('button', { name: '开始转印' })).toBeVisible()
  await page.getByRole('button', { name: '开始转印' }).click()
  await confirmActionDialog(page, '开始转印')
  await expect(page.locator('body')).toContainText('转印中')

  await expect(page.getByRole('button', { name: '完成转印' })).toBeVisible()
  await page.getByRole('button', { name: '完成转印' }).click()
  await expect(page.getByRole('heading', { name: '完成转印' })).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('body')).toContainText('确认执行“完成转印”')
  await page.getByRole('button', { name: '确认执行' }).click()
  await expect(page.locator('body')).toContainText('待交出')
  await expect(page.locator('body')).toContainText('操作记录')
  await expect(page.locator('body')).toContainText('完成转印')

  await navigateInApp(page, '/fcs/craft/printing/wait-handover-warehouse')
  await expect(page.getByRole('heading', { name: '印花待交出仓' })).toBeVisible()
  await expect(page.locator('body')).toContainText('TASK-PRINT-000717')
  await expect(page.locator('body')).toContainText('加工完成数量')
  await expect(page.locator('body')).toContainText('3,000 片')
})

test('染色 Web 完成包装后进入待交出仓', async ({ page }) => {
  await page.goto('/fcs/craft/dyeing/work-orders/DWO-005')
  await expect(page.getByRole('heading', { name: '染色加工单详情' })).toBeVisible()

  for (const actionName of ['完成烘干', '完成定型', '完成打卷']) {
    await expect(page.getByRole('button', { name: actionName })).toBeVisible()
    await page.getByRole('button', { name: actionName }).click()
    await confirmActionDialog(page, actionName)
  }

  await expect(page.getByRole('button', { name: '完成包装' })).toBeVisible()

  await page.getByRole('button', { name: '完成包装' }).click()
  await expect(page.getByTestId('process-web-status-action-dialog')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('heading', { name: '完成包装' })).toBeVisible()
  await page.getByRole('button', { name: '确认执行' }).click()
  await expect(page.locator('body')).toContainText('待交出')
  await expect(page.locator('body')).toContainText('完成包装')

  await navigateInApp(page, '/fcs/craft/dyeing/wait-handover-warehouse')
  await expect(page.getByRole('heading', { name: '染色待交出仓' })).toBeVisible()
  await expect(page.locator('body')).toContainText('TASK-DYE-000725')
  await expect(page.locator('body')).toContainText('加工完成数量')
  await expect(page.locator('body')).toContainText('米')
  await expect(page.locator('body')).toContainText('卷')
})

test('特殊工艺确认接收和完成加工分别进入待加工仓与待交出仓', async ({ page }) => {
  const workOrderPath = '/fcs/process-factory/special-craft/sc-op-8192/work-orders/SC-TASK-PO2026030001-8192-124e7c-01-WO-001-'
  await page.goto(workOrderPath)
  await expect(page.locator('body')).toContainText('可执行动作')
  await expect(page.getByRole('button', { name: '确认接收成衣' })).toBeVisible()

  await page.getByRole('button', { name: '确认接收成衣' }).click()
  await confirmActionDialog(page, '确认接收成衣')
  await expect(page.locator('body')).toContainText('已入待加工仓')

  await navigateInApp(page, '/fcs/process-factory/special-craft/sc-op-8192/wait-process-warehouse')
  await expect(page.getByRole('heading', { name: '烫画待加工仓' })).toBeVisible()
  await expect(page.locator('body')).toContainText('SC-202603-0001-8192-01-部位01')
  await expect(page.locator('body')).toContainText('当前库存')
  await expect(page.locator('body')).toContainText('5,000 件')

  await navigateInApp(page, workOrderPath)
  await expect(page.getByRole('button', { name: '开始加工' })).toBeVisible()
  await page.getByRole('button', { name: '开始加工' }).click()
  await confirmActionDialog(page, '开始加工')
  await expect(page.locator('body')).toContainText('加工中')
  await expect(page.getByRole('button', { name: '完成加工' })).toBeVisible()
  await page.getByRole('button', { name: '完成加工' }).click()
  await confirmActionDialog(page, '完成加工')
  await expect(page.locator('body')).toContainText('待交出')

  await navigateInApp(page, '/fcs/process-factory/special-craft/sc-op-8192/wait-handover-warehouse')
  await expect(page.getByRole('heading', { name: '烫画待交出仓' })).toBeVisible()
  await expect(page.locator('body')).toContainText('SC-202603-0001-8192-01-部位01')
  await expect(page.locator('body')).toContainText('当前库存')
  await expect(page.locator('body')).toContainText('件')
})

test('特殊工艺差异记录保留目标对象数量口径', async ({ page }) => {
  const workOrderPath = '/fcs/process-factory/special-craft/sc-op-8192/work-orders/SC-TASK-PO2026030001-8192-124e7c-01-WO-001-'
  await page.goto(workOrderPath)
  await expect(page.locator('body')).toContainText('可执行动作')
  await expect(page.getByRole('button', { name: '确认接收成衣' })).toBeVisible()
  await page.getByRole('button', { name: '确认接收成衣' }).click()
  await confirmActionDialog(page, '确认接收成衣')
  await expect(page.locator('body')).toContainText('已入待加工仓')
  await expect(page.getByRole('button', { name: '上报差异' })).toBeVisible()

  await page.getByRole('button', { name: '上报差异' }).click()
  await confirmActionDialog(page, '上报差异')
  await expect(page.locator('body')).toContainText('差异')
  await navigateInApp(page, `${workOrderPath}?tab=difference`)
  await expect(page.locator('body')).toContainText('差异记录')
  await expect(page.locator('body')).toContainText('差异成衣数量')
  await expect(page.locator('body')).toContainText('件')
  await expect(page.locator('body')).not.toContainText('开扣眼')
  await expect(page.locator('body')).not.toContainText('装扣子')
  await expect(page.locator('body')).not.toContainText('熨烫')
})

test('特殊工艺 PDA 按目标对象显示成衣执行口径', async ({ page }) => {
  const workOrderPath = '/fcs/process-factory/special-craft/sc-op-8192/work-orders/SC-TASK-PO2026030001-8192-124e7c-01-WO-001-'
  await page.addInitScript(() => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify({
      userId: 'F090_operator',
      loginId: 'F090_operator',
      userName: '全能力测试工厂_操作工',
      roleId: 'ROLE_OPERATOR',
      factoryId: 'F090',
      factoryName: '全能力测试工厂',
      loggedAt: '2026-05-16 00:00:00',
    }))
  })
  await page.goto(workOrderPath)
  await expect(page.getByRole('button', { name: '打开移动端执行页' }).first()).toBeVisible()
  await page.getByRole('button', { name: '打开移动端执行页' }).first().click()
  await expect(page).toHaveURL(/\/fcs\/pda\/exec\//)
  if (await page.getByTestId('pda-auth-login-page').isVisible({ timeout: 1000 }).catch(() => false)) {
    await page.locator('[data-pda-login-field="loginId"]').fill('F090_operator')
    await page.locator('[data-pda-login-field="password"]').fill('123456')
    await page.locator('[data-pda-login-action="submit"]').click()
    await expect(page.getByTestId('pda-auth-login-page')).not.toBeVisible()
  }
  await expect(page.locator('body')).toContainText('特殊工艺执行')
  await expect(page.locator('body')).toContainText('确认接收成衣')
  await expect(page.locator('body')).toContainText('当前成衣数量')
  await expect(page.locator('body')).toContainText('无需绑定菲票')
  await expect(page.locator('body')).not.toContainText('确认接收裁片')
  await expect(page.locator('body')).not.toContainText('暂无绑定菲票')
})

test('平台侧仍通过聚合状态展示联动后的风险', async ({ page }) => {
  await page.goto('/fcs/process/print-orders')
  await expect(page.getByRole('heading', { name: '印花加工单' })).toBeVisible()
  await expect(page.locator('body')).toContainText('平台状态')
  await expect(page.locator('body')).toContainText(/待交出|交出待收货|收货确认中|异常|加工中/)
  await expect(page.locator('body')).not.toContainText('转印中：')

  await page.goto('/fcs/process/dye-orders')
  await expect(page.getByRole('heading', { name: '染色加工单' })).toBeVisible()
  await expect(page.locator('body')).toContainText('平台状态')
  await expect(page.locator('body')).toContainText(/待交出|交出待收货|收货确认中|异常|加工中/)
})

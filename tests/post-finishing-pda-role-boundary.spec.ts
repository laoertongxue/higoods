import { expect, test, type Page } from '@playwright/test'

const POST_FACTORY_OPERATOR = {
  userId: 'ID-F002_operator',
  loginId: 'ID-F002_operator',
  userName: '后道工厂_操作工',
  roleId: 'ROLE_OPERATOR',
  factoryId: 'ID-F002',
  factoryName: '后道工厂',
  loggedAt: '2026-09-03 10:00:00',
}

async function setSession(page: Page, roleId: 'ROLE_OPERATOR' | 'ROLE_ADMIN'): Promise<void> {
  await page.goto('/fcs/pda/auth/login')
  await page.evaluate(({ session, role }) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify({
      ...session,
      userId: role === 'ROLE_ADMIN' ? 'ID-F002_admin' : session.userId,
      loginId: role === 'ROLE_ADMIN' ? 'ID-F002_admin' : session.loginId,
      userName: role === 'ROLE_ADMIN' ? '后道工厂_管理员' : session.userName,
      roleId: role,
    }))
    window.localStorage.removeItem('higoods-pda-sewing-self-return-mode')
  }, { session: POST_FACTORY_OPERATOR, role: roleId })
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

test('后道工厂执行页只保留后道加工和后道复检', async ({ page }) => {
  await setSession(page, 'ROLE_OPERATOR')
  for (const viewport of [{ width: 390, height: 844 }, { width: 480, height: 800 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/fcs/pda/exec')
    await expect(page.getByRole('heading', { name: '后道现场执行' })).toBeVisible()
    await expect(page.getByRole('button', { name: '后道加工' })).toBeVisible()
    await expect(page.getByRole('button', { name: '后道复检' })).toBeVisible()
    await expect(page.locator('[data-pda-general-task-list]')).toHaveCount(0)
    await expect(page.locator('[data-testid="pda-exec-tabs"]')).toHaveCount(0)
    await expect(page.locator('[data-pda-exec-field="searchKeyword"]')).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText('其他执行任务')
    await expect(page.locator('body')).not.toContainText('TASK-DYE-')
    await expectNoHorizontalOverflow(page)
  }
})

test('后道回货入口归入交接待接收，仓管不再承担回货或成衣仓收货', async ({ page }) => {
  await setSession(page, 'ROLE_OPERATOR')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/fcs/pda/warehouse')
  await expect(page.locator('body')).not.toContainText('后道回货与出货')
  await expect(page.locator('body')).not.toContainText('扫描送货单点数确认')
  await expect(page.locator('body')).not.toContainText('扫描后道出货单收货')

  await page.goto('/fcs/pda/handover?tab=pickup')
  await expect(page.getByRole('button', { name: /待接收/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /已交出/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /待交出/ })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '后道回货接收' })).toBeVisible()
  await expect(page.getByRole('button', { name: /扫描送货单点数确认/ })).toBeVisible()
  await expect(page.getByText('开启车缝自助回货', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /扫描送货单点数确认/ }).click()
  await expect(page).toHaveURL(/\/fcs\/pda\/post-finishing\/return-confirm/)
  await expect(page.getByRole('heading', { name: '扫描后道送货单号' })).toBeVisible()

  await page.goto('/fcs/pda/post-finishing/outbound-receive')
  await expect(page.getByRole('heading', { name: '扫描后道出货单条码' })).toHaveCount(0)
})

test('后道接收当前批次与历史记录都展示 SKU 明细', async ({ page }) => {
  await setSession(page, 'ROLE_OPERATOR')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/fcs/pda/handover?tab=pickup')
  await page.getByTestId('pickup-head-card').first().click()

  const currentSku = page.getByTestId('pickup-current-sku-detail')
  await expect(currentSku).toBeVisible()
  await expect(currentSku).toContainText('SPU')
  await expect(currentSku).toContainText('SKU')
  await expect(currentSku).toContainText('本次')
  await expect(currentSku.locator('[data-pda-image-preview-url]')).toHaveCount(1)

  const history = page.getByTestId('pickup-record-history')
  await expect(history.locator('summary')).toContainText('SKU')
  await history.locator('summary').click()
  const historySku = history.getByTestId('pickup-history-sku-detail')
  await expect(historySku.first()).toBeVisible()
  await expect(historySku.first()).toContainText('SKU')
  await expectNoHorizontalOverflow(page)
})

test('后道辅料在交接待接收中按完整单号整单入库并同步 Web 待加工仓', async ({ page }) => {
  await setSession(page, 'ROLE_OPERATOR')
  for (const viewport of [{ width: 390, height: 844 }, { width: 480, height: 800 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/fcs/pda/handover?tab=pickup')
    await expect(page.getByRole('heading', { name: '后道辅料待入库' })).toBeVisible()
    await expect(page.locator('[data-pda-material-transfer-card="DB-PF-202608-001"]')).toBeVisible()
    await expect(page.locator('[data-pda-handover-field="materialTransferNo"]')).toBeVisible()
    await expect(page.locator('body')).toContainText('只接受完整单号，不提供模糊候选')
    await expectNoHorizontalOverflow(page)
  }

  const input = page.locator('[data-pda-handover-field="materialTransferNo"]')
  await input.fill('DB-PF-202608')
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('不提供模糊候选')
    await dialog.accept()
  })
  await page.getByRole('button', { name: '查询', exact: true }).click()
  await input.fill('DB-PF-202608-001')
  await page.getByRole('button', { name: '查询', exact: true }).click()
  await expect(page).toHaveURL(/materialOrderNo=DB-PF-202608-001/)
  await expect(page.getByRole('heading', { name: '确认辅料入库' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '物料明细' }).locator('xpath=../following-sibling::div')).toHaveCount(4)
  await expect(page.locator('[data-pda-image-preview-url]')).toHaveCount(4)
  await expect(page.locator('input[type="number"]')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('授权码')
  await expect(page.locator('body')).not.toContainText('补料')
  await expectNoHorizontalOverflow(page)

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('一次性入库')
    await dialog.accept()
  })
  await page.getByRole('button', { name: '确认全部物料已领回并整单入库' }).click()
  await expect(page.locator('body')).toContainText('整单入库成功')
  await expect(page.locator('body')).toContainText('该调拨单已整单入库')

  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/fcs/craft/post-finishing/wait-process-warehouse?tab=materials')
  await expect(page.getByRole('heading', { name: '后道待加工仓' })).toBeVisible()
  await expect(page.getByText('辅料库存', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: '辅料库存' })).toBeVisible()
  await expect(page.locator('tbody tr')).toHaveCount(4)
  await expect(page.locator('tbody')).toContainText('495 PCS')
  await expect(page.locator('tbody')).toContainText('DB-PF-202608-001')
  await expectNoHorizontalOverflow(page)
})

test('后道交接已交出直接展示 Web 后道出货单及 SKU 明细', async ({ page }) => {
  await setSession(page, 'ROLE_OPERATOR')
  for (const viewport of [{ width: 390, height: 844 }, { width: 480, height: 800 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/fcs/pda/handover?tab=shipped')
    await expect(page.getByText('已交出记录', { exact: true })).toBeVisible()
    await expect(page.locator('[data-pda-post-outbound-card]').first()).toBeVisible()
    await expect(page.locator('body')).toContainText('后道出货单')
    await expect(page.getByRole('button', { name: /待交出/ })).toHaveCount(0)
    const card = page.locator('[data-pda-post-outbound-card]').first()
    await card.locator('summary').click()
    await expect(card.locator('[data-pda-post-outbound-line]').first()).toBeVisible()
    await expect(card.locator('[data-pda-post-outbound-line]').first()).toContainText('SKU')
    await expect(card.locator('[data-pda-post-outbound-line]').first().locator('[data-pda-image-preview-url]')).toHaveCount(1)
    await expectNoHorizontalOverflow(page)
  }
})

test('后道加工和后道复检操作页均可返回执行工作台', async ({ page }) => {
  await setSession(page, 'ROLE_OPERATOR')
  for (const route of ['/fcs/pda/post-finishing/execute', '/fcs/pda/post-finishing/recheck']) {
    await page.goto(route)
    const back = page.getByTestId('pda-post-back')
    await expect(back).toBeVisible()
    await expect(back).toHaveText(/返回/)
    await back.click()
    await expect(page).toHaveURL(/\/fcs\/pda\/exec$/)
  }
})

test('车缝自助回货由管理员开启，锁定与退出状态完整闭环', async ({ page }) => {
  await setSession(page, 'ROLE_OPERATOR')
  await page.goto('/fcs/pda/handover?tab=pickup')
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('请由后道工厂管理员开启')
    await dialog.accept()
  })
  await page.getByRole('button', { name: '开启', exact: true }).click()
  await expect(page).toHaveURL(/\/fcs\/pda\/handover\?tab=pickup/)

  await setSession(page, 'ROLE_ADMIN')
  await page.goto('/fcs/pda/handover?tab=pickup')
  await page.getByRole('button', { name: '开启', exact: true }).click()
  await expect(page).toHaveURL(/\/fcs\/pda\/handover\/sewing-self-return/)
  await expect(page.getByRole('heading', { name: '车缝现场交货登记模式' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => Boolean(window.localStorage.getItem('higoods-pda-sewing-self-return-mode')))).toBe(true)

  await page.getByRole('button', { name: '管理员退出' }).click()
  await expect(page).toHaveURL(/\/fcs\/pda\/handover\?tab=pickup/)
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('higoods-pda-sewing-self-return-mode'))).toBeNull()
  await expect(page.getByRole('heading', { name: '后道回货接收' })).toBeVisible()
})

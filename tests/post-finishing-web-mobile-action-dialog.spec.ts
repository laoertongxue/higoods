import { expect, test, type Page } from '@playwright/test'

const PDA_SESSION = {
  userId: 'F090_operator',
  loginId: 'F090_operator',
  userName: '全能力测试工厂_操作工',
  roleId: 'ROLE_OPERATOR',
  factoryId: 'F090',
  factoryName: '全能力测试工厂',
  loggedAt: '2026-08-31 10:00:00',
}

async function setPdaSession(page: Page): Promise<void> {
  await page.goto('/fcs/pda/warehouse')
  await page.evaluate((session) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
  }, PDA_SESSION)
}

test('后道质检将输入领取与主管管理合并在质检单菜单，不允许手工建单', async ({ page }) => {
  await page.goto('/fcs/craft/post-finishing/qc-orders')
  await expect(page.getByRole('heading', { name: '质检单', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '领取质检单' })).toHaveCount(0)
  await page.getByRole('button', { name: '领取质检单' }).click()
  await expect(page.getByRole('dialog', { name: '领取质检单' })).toBeVisible()
  await expect(page.locator('[data-qc-task-input]')).toBeVisible()
  await expect(page.locator('[data-qc-task-input]')).toHaveAttribute('placeholder', /完整质检单号/)
  await expect(page.locator('body')).not.toContainText('Web 质检工作台')
  await expect(page.locator('body')).not.toContainText('创建质检单')
  await expect(page.locator('body')).not.toContainText('不关联来源任务')
  await expect(page.getByRole('columnheader', { name: '质检单号' })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('POST_QC_FINISH')
})

test('PDA 保留回货确认、后道执行、复检和 FCK 出货收货四个专用扫码入口', async ({ page }) => {
  await setPdaSession(page)
  const expectations: Array<[string, string, string]> = [
    ['/fcs/pda/post-finishing/return-confirm', '扫描后道送货单号', '初始不展示待确认任务池'],
    ['/fcs/pda/post-finishing/execute', '扫描后道加工单号', '只按完整后道加工单号查询'],
    ['/fcs/pda/post-finishing/recheck', '扫描复检单号', '扫描成功即由当前账号领取'],
    ['/fcs/pda/post-finishing/outbound-receive', '扫描后道出货单条码', '只接受完整 FCK 后道出货单号'],
  ]
  for (const [path, heading, rule] of expectations) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    await expect(page.locator('body')).toContainText(rule)
    await expect(page.locator('body')).not.toContainText('创建质检单')
    await expect(page.locator('body')).not.toContainText('完成质检')
  }
})

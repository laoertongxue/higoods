import { expect, test, type Page } from '@playwright/test'

const PDA_SESSION = {
  userId: 'ID-F002-POST-OP-001',
  loginId: 'ID-F002-POST-OP-001',
  userName: '阿迪后道操作员',
  roleId: 'ROLE_OPERATOR',
  factoryId: 'ID-F002',
  factoryName: '雅加达后道中心',
  loggedAt: '2026-08-31 10:00:00',
}

async function setPdaSession(page: Page): Promise<void> {
  await page.addInitScript((session) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
  }, PDA_SESSION)
}

test('后道质检只保留 Web 扫码工作台，不展示任务池或手工建单', async ({ page }) => {
  await page.goto('/fcs/craft/post-finishing/qc-workbench')
  await expect(page.getByText('扫描完整质检任务号')).toBeVisible()
  await expect(page.locator('body')).toContainText('初始不展示待质检池')
  await expect(page.locator('[data-post-finishing-field="qc-task-scan"]')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('创建质检单')
  await expect(page.locator('body')).not.toContainText('不关联来源任务')

  await page.goto('/fcs/craft/post-finishing/qc-orders')
  await expect(page.getByRole('heading', { name: '质检任务管理' })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('POST_QC_FINISH')
})

test('PDA 保留回货确认、后道执行、复检和 FCK 出货收货四个专用扫码入口', async ({ page }) => {
  await setPdaSession(page)
  const expectations: Array<[string, string, string]> = [
    ['/fcs/pda/post-finishing/return-confirm', '扫描后道送货单号', '初始不展示待确认任务池'],
    ['/fcs/pda/post-finishing/execute', '扫描后道任务号', '先核对产品、数量和工序，再确认开始'],
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

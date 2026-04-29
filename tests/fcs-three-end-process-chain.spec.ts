import { expect, test, type Page } from '@playwright/test'

const DEMO_FACTORY_LABEL = '全能力测试工厂（F090）'
const PDA_SESSION = {
  userId: 'F090_operator',
  loginId: 'F090_operator',
  userName: '全能力测试工厂_操作工',
  roleId: 'ROLE_OPERATOR',
  factoryId: 'F090',
  factoryName: '全能力测试工厂',
  loggedAt: '2026-04-28 10:00:00',
}

async function setPdaSession(page: Page) {
  await page.addInitScript((session) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
  }, PDA_SESSION)
}

async function navigateInApp(page: Page, path: string) {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, '', nextPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}

async function clearTodoModal(page: Page) {
  const modal = page.locator('[data-pda-todo-modal="true"]')
  if (await modal.count()) {
    await modal.evaluateAll((nodes) => nodes.forEach((node) => node.remove()))
  }
}

test('印花三端完整链路：绑定、搜索、状态、待交出仓和平台结果一致', async ({ page }) => {
  await setPdaSession(page)
  await page.goto('/fcs/craft/printing/work-orders')
  await expect(page.locator('body')).toContainText('PH-20260328-001')
  await expect(page.locator('body')).toContainText(DEMO_FACTORY_LABEL)

  await page.goto('/fcs/craft/printing/work-orders/PWO-PRINT-009')
  await expect(page.getByRole('heading', { name: '印花加工单详情' })).toBeVisible()
  await expect(page.locator('body')).toContainText('绑定状态')
  await expect(page.locator('body')).toContainText('移动端执行任务号')
  await expect(page.getByRole('button', { name: '完成转印' })).toBeVisible()

  await page.getByRole('button', { name: '完成转印' }).click()
  await expect(page.getByRole('heading', { name: '完成转印' })).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('body')).toContainText('确认执行“完成转印”')
  await page.getByRole('button', { name: '确认执行' }).click()
  await expect(page.locator('body')).toContainText('待送货')
  await expect(page.locator('body')).toContainText('完成转印')

  await navigateInApp(page, '/fcs/pda/exec/TASK-PRINT-000716')
  await expect(page.locator('body')).toContainText('TASK-PRINT-000716')
  await expect(page.locator('body')).toContainText(/待送货|转印完成|待开工|进行中/)

  await navigateInApp(page, '/fcs/pda/exec?tab=IN_PROGRESS&keyword=TASK-PRINT-000716')
  await clearTodoModal(page)
  await expect(page.locator('body')).toContainText('TASK-PRINT-000716')
  await expect(page.locator('body')).toContainText(DEMO_FACTORY_LABEL)

  await navigateInApp(page, '/fcs/craft/printing/wait-handover-warehouse')
  await expect(page.getByRole('heading', { name: '印花待交出仓' })).toBeVisible()
  await expect(page.locator('body')).toContainText('TASK-PRINT-000716')
  await expect(page.locator('body')).toContainText(/待交出裁片数量|待交出面料米数/)

  await navigateInApp(page, '/fcs/process/print-orders')
  await expect(page.locator('body')).toContainText('平台状态')
  await expect(page.locator('body')).toContainText('风险提示')
  await expect(page.locator('body')).toContainText('下一步动作')
  await expect(page.locator('body')).toContainText(/待送货|待回写|异常|加工中/)
  await expect(page.locator('body')).not.toContainText('平台状态：转印中')
})

test('印花差异链路：交出差异在工艺详情和平台侧可见', async ({ page }) => {
  await page.goto('/fcs/craft/printing/work-orders/PWO-PRINT-007?tab=exception')
  await expect(page.locator('body')).toContainText(/异常与结算|差异/)
  await expect(page.locator('body')).toContainText(/差异裁片数量|差异面料米数|数量差异/)

  await page.goto('/fcs/process/print-orders')
  await expect(page.locator('body')).toContainText('异常')
  await expect(page.locator('body')).toContainText('差异记录')
  await expect(page.locator('body')).toContainText(/处理差异|要求重新交出/)
})

test('染色三端完整链路：完成包装后 Web、移动端、待交出仓和平台一致', async ({ page }) => {
  await setPdaSession(page)
  await page.goto('/fcs/craft/dyeing/work-orders')
  await expect(page.locator('body')).toContainText(DEMO_FACTORY_LABEL)

  await page.goto('/fcs/craft/dyeing/work-orders/DWO-013')
  await expect(page.getByRole('heading', { name: '染色加工单详情' })).toBeVisible()
  await expect(page.locator('body')).toContainText('绑定状态')
  await expect(page.getByRole('button', { name: '完成包装' })).toBeVisible()
  await page.getByRole('button', { name: '完成包装' }).click()
  await expect(page.locator('body')).toContainText('待送货')
  await expect(page.locator('body')).toContainText('完成包装')

  await navigateInApp(page, '/fcs/pda/exec?keyword=TASK-DYE-000733')
  await clearTodoModal(page)
  await expect(page.locator('body')).toContainText('TASK-DYE-000733')
  await expect(page.locator('body')).toContainText(DEMO_FACTORY_LABEL)

  await navigateInApp(page, '/fcs/craft/dyeing/wait-handover-warehouse')
  await expect(page.getByRole('heading', { name: '染色待交出仓' })).toBeVisible()
  await expect(page.locator('body')).toContainText('TASK-DYE-000733')
  await expect(page.locator('body')).toContainText('待交出面料米数')
  await expect(page.locator('body')).toContainText('卷')

  await navigateInApp(page, '/fcs/process/dye-orders')
  await expect(page.locator('body')).toContainText('平台状态')
  await expect(page.locator('body')).toContainText('待交出面料米数')
  await expect(page.locator('body')).toContainText('卷数')
  await expect(page.locator('body')).not.toContainText('平台状态：包装中')
  await expect(page.locator('body')).not.toContainText('染色报表')
})

test('染色差异链路：差异面料米数和平台异常可见', async ({ page }) => {
  await page.goto('/fcs/craft/dyeing/work-orders/DWO-010?tab=exception')
  await expect(page.locator('body')).toContainText(/异常|差异|审核记录/)
  await expect(page.locator('body')).toContainText(/差异面料米数|数量差异/)

  await page.goto('/fcs/process/dye-orders')
  await expect(page.locator('body')).toContainText('异常')
  await expect(page.locator('body')).toContainText('差异记录')
  await expect(page.locator('body')).toContainText('差异面料米数')
})

test('裁片三端完整链路：执行状态、菲票归属、待交出和平台看板一致', async ({ page }) => {
  await setPdaSession(page)
  await page.goto('/fcs/craft/cutting/original-orders?originalCutOrderNo=CUT-260314-087-02')
  await expect(page.locator('body')).toContainText(/全能力测试工厂（F090）|F090/)
  await expect(page.locator('body')).toContainText('绑定状态')
  await expect(page.getByRole('button', { name: '开始铺布' })).toBeVisible()
  await page.getByRole('button', { name: '开始铺布' }).click()
  await expect(page.locator('body')).toContainText('铺布中')
  await expect(page.locator('body')).toContainText('菲票归属原始裁片单')

  await navigateInApp(page, '/fcs/pda/exec?keyword=CUT-260314-087-02')
  await clearTodoModal(page)
  await expect(page.locator('body')).toContainText('TASK-CUT-000097')
  await expect(page.locator('body')).toContainText(DEMO_FACTORY_LABEL)

  await navigateInApp(page, '/fcs/progress/board')
  await expect(page.locator('body')).toContainText('任务进度看板', { timeout: 60_000 })
  await expect(page.locator('body')).toContainText('平台状态', { timeout: 60_000 })
  await expect(page.locator('body')).toContainText(/裁片数量|关联菲票数量|绑定菲票数量/)
  await expect(page.locator('body')).not.toContainText('合并裁剪批次作为菲票归属主体')
})

test('裁片差异链路：差异可追溯菲票并进入平台异常', async ({ page }) => {
  await page.goto('/fcs/progress/board')
  await expect(page.locator('body')).toContainText('任务进度看板', { timeout: 60_000 })
  await expect(page.locator('body')).toContainText(/差异裁片数量|差异记录/, { timeout: 60_000 })
  await expect(page.locator('body')).toContainText(/菲票|关联菲票数量|绑定菲票数量/)
  await expect(page.locator('body')).toContainText(/异常|待审核/)
})

test('特殊工艺三端完整链路：待加工仓、待交出仓、交出和平台结果一致', async ({ page }) => {
  await setPdaSession(page)
  await page.goto('/fcs/process-factory/special-craft/sc-op-008/work-orders/SC-TASK-SC-OP-008-01-WO-001-')
  await expect(page.locator('body')).toContainText(DEMO_FACTORY_LABEL)
  await expect(page.locator('body')).toContainText('可执行动作')
  await expect(page.getByRole('button', { name: '确认接收裁片' })).toBeVisible()
  await page.getByRole('button', { name: '确认接收裁片' }).click()
  await expect(page.locator('body')).toContainText('已入待加工仓')

  await navigateInApp(page, '/fcs/process-factory/special-craft/sc-op-008/wait-process-warehouse')
  await expect(page.getByRole('heading', { name: '打揽待加工仓' })).toBeVisible()
  await expect(page.locator('body')).toContainText('关联菲票数量')

  await navigateInApp(page, '/fcs/process-factory/special-craft/sc-op-064/work-orders/SC-TASK-SC-OP-064-01-WO-001-')
  await expect(page.getByRole('button', { name: '完成加工' })).toBeVisible()
  await page.getByRole('button', { name: '完成加工' }).click()
  await expect(page.locator('body')).toContainText('待交出')

  await navigateInApp(page, '/fcs/process-factory/special-craft/sc-op-064/wait-handover-warehouse')
  await expect(page.getByRole('heading', { name: '激光切待交出仓' })).toBeVisible()
  await expect(page.locator('body')).toContainText('待交出裁片数量')

  await navigateInApp(page, '/fcs/pda/exec?keyword=TASK-SC-OP-008-0101')
  await clearTodoModal(page)
  await expect(page.locator('body')).toContainText('TASK-SC-OP-008-0101')

  await navigateInApp(page, '/fcs/progress/board')
  await expect(page.locator('body')).toContainText(/特殊工艺|打揽|激光切/, { timeout: 60_000 })
  await expect(page.locator('body')).toContainText(/裁片数量|菲票数量|绑定菲票数量/)
  await expect(page.locator('body')).not.toContainText('开扣眼')
  await expect(page.locator('body')).not.toContainText('装扣子')
  await expect(page.locator('body')).not.toContainText('熨烫')
})

test('特殊工艺差异链路：差异联动菲票数量并进入平台异常', async ({ page }) => {
  await page.goto('/fcs/process-factory/special-craft/sc-op-008/work-orders/SC-TASK-SC-OP-008-02-WO-001-')
  const reportDifferenceButton = page.locator('button').filter({ hasText: '上报差异' }).first()
  await expect(reportDifferenceButton).toBeVisible({ timeout: 60_000 })
  await reportDifferenceButton.click()
  await expect(page.locator('body')).toContainText(/差异|上报差异/)
  await expect(page.locator('body')).toContainText('绑定菲票')
  await expect(page.locator('body')).toContainText(/累计报废裁片数量|累计货损裁片数量|当前裁片数量/)

  await navigateInApp(page, '/fcs/progress/board')
  await expect(page.locator('body')).toContainText('异常', { timeout: 60_000 })
  await expect(page.locator('body')).toContainText(/处理差异|要求重新交出|平台核对菲票/, { timeout: 60_000 })
})

test('不可执行任务不能绕过：执行列表不可见，直达详情只显示不可执行原因', async ({ page }) => {
  await setPdaSession(page)
  await page.goto('/fcs/pda/exec?tab=NOT_STARTED&keyword=TASK-PRINT-000714')
  await clearTodoModal(page)
  await expect(page.locator('[data-testid="pda-exec-task-card"]')).toHaveCount(0)

  await page.goto('/fcs/pda/exec/TASK-PRINT-000714')
  await expect(page.locator('body')).toContainText('当前任务仍在报价或定标阶段，不能执行')
  await expect(page.locator('body')).toContainText('当前任务只允许查看，不显示开始、完工、交出等执行按钮')
  await expect(page.getByRole('button', { name: '开工' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '完工' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '发起交出' })).toHaveCount(0)
})

test('统计联动：印花、染色、特殊工艺统计读取统一事实源', async ({ page }) => {
  await page.goto('/fcs/craft/printing/statistics')
  await expect(page.getByRole('heading', { name: '印花统计' })).toBeVisible()
  await expect(page.getByText('计划印花面料米数').first()).toBeVisible()
  await expect(page.getByText('印花有差异交出记录数').first()).toBeVisible()

  await page.goto('/fcs/craft/dyeing/reports')
  await expect(page.getByRole('heading', { name: '染色统计' })).toBeVisible()
  await expect(page.getByText('染色报表')).toHaveCount(0)
  await expect(page.getByText('计划染色面料米数').first()).toBeVisible()
  await expect(page.getByText('差异面料米数').first()).toBeVisible()

  await page.goto('/fcs/process-factory/special-craft/sc-op-008/statistics')
  await expect(page.locator('body')).toContainText('打揽统计', { timeout: 60_000 })
  await expect(page.getByText('当前裁片数量').first()).toBeVisible()
  await expect(page.getByText('关联菲票数量').first()).toBeVisible()
  await expect(page.getByText('差异裁片数量').first()).toBeVisible()
})

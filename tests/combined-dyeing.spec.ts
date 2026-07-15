import { expect, test, type Locator, type Page } from '@playwright/test'

const COMBINED_PATH = '/fcs/craft/dyeing/combined-dyeing'
const FIRST_ORDER_ID = 'DYE-COMBINED-DEMO-001'
const SECOND_ORDER_ID = 'DYE-COMBINED-DEMO-002'
const FIRST_ORDER_NO = 'RSJG-202607-901'
const SECOND_ORDER_NO = 'RSJG-202607-902'

async function combinedRoot(page: Page): Promise<Locator> {
  const root = page.locator('[data-testid="combined-dyeing-root"]')
  await expect(root).toBeVisible()
  return root
}

async function clickAction(page: Page, action: string, taskId?: string): Promise<void> {
  const selector = taskId
    ? `[data-combined-dyeing-id="${taskId}"] [data-combined-dyeing-action="${action}"]`
    : `[data-combined-dyeing-action="${action}"]`
  const actions = page.locator(selector)
  await (action === 'close-overlay' || (taskId && ['open-complete', 'open-correct', 'open-delete'].includes(action))
    ? actions.last()
    : actions.first()).click()
}

async function findWorkOrderRow(page: Page, workOrderNo: string): Promise<Locator> {
  const row = page.locator('tbody tr').filter({ hasText: workOrderNo })
  if (await row.count() === 0) {
    const nextPage = page.getByRole('button', { name: '下一页' }).last()
    if (await nextPage.isEnabled()) await nextPage.click()
  }
  await expect(row).toBeVisible()
  return row
}

test.describe.configure({ mode: 'serial' })

test('合并染色一次性全链路与加工单同一身份', async ({ page }) => {
  test.setTimeout(120_000)
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto('/fcs/craft/dyeing/work-orders')
  const menu = page.getByRole('button', { name: '合并染色', exact: true }).first()
  await expect(menu).toBeVisible()
  await menu.click()
  await expect(page).toHaveURL(new RegExp(`${COMBINED_PATH}$`))
  const root = await combinedRoot(page)
  await expect(root.getByRole('heading', { name: '合并染色', exact: true })).toBeVisible()
  await expect(root.getByText(/共 0 条/)).toBeVisible()
  await expect(root.locator('[data-combined-dyeing-field="pageSize"]').first()).toHaveValue('10')
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))

  // Vite 首次点击会冷编译异步页面 handler；先用可观察的筛选重置完成预热，
  // 后续计时只衡量已经可交互页面的局部 DOM 更新。
  const keyword = root.locator('[data-combined-dyeing-field="keyword"]')
  await keyword.fill('预热')
  await clickAction(page, 'reset-filter')
  await expect(keyword).toHaveValue('', { timeout: 30_000 })

  const beforeOpenScroll = await page.evaluate(() => window.scrollY)
  const openStartedAt = await page.evaluate(() => performance.now())
  await clickAction(page, 'open-create')
  const openElapsed = await page.evaluate((startedAt) => performance.now() - startedAt, openStartedAt)
  expect(openElapsed).toBeLessThan(200)
  expect(await page.evaluate(() => window.scrollY)).toBe(beforeOpenScroll)

  const overlay = page.locator('[data-combined-dyeing-overlay]')
  await expect(overlay).toContainText('由染厂主管手工选择生产单来源染色加工单')
  await expect(overlay).toContainText('平台加工单号')
  await expect(overlay).toContainText('只读，不可改号')
  await expect(page.getByText('备货', { exact: true })).toHaveCount(0)
  await expect(page.locator('input[name*="workOrder" i], input[name*="orderNo" i]')).toHaveCount(0)

  await page.locator('[data-combined-dyeing-page-scope="candidates"] [data-combined-dyeing-field="pageSize"]').selectOption('20')

  const first = page.locator(`[data-combined-dyeing-action="toggle-member"][data-combined-dyeing-id="${FIRST_ORDER_ID}"]`)
  const second = page.locator(`[data-combined-dyeing-action="toggle-member"][data-combined-dyeing-id="${SECOND_ORDER_ID}"]`)
  await expect(first).toBeEnabled()
  await first.check()
  await expect(overlay).toContainText('首张加工单确定染厂、面料、目标颜色和染色工艺')
  await expect(page.getByText('面料不同').first()).toBeVisible()
  expect(await page.locator('[data-combined-dyeing-action="toggle-member"]:disabled').count()).toBeGreaterThan(0)
  await expect(second).toBeEnabled()
  await second.check()
  await expect(page.getByText('需求合计：').locator('..')).toContainText('1,000 Yard')

  await clickAction(page, 'submit-create')
  await expect(page.getByRole('heading', { name: /合并染色详情 · HBRW-/ })).toBeVisible()
  const detailHeading = page.getByRole('heading', { name: /合并染色详情 · HBRW-/ })
  const taskNo = (await detailHeading.textContent())!.split('·').pop()!.trim()
  const taskContainer = page.locator('[data-combined-dyeing-overlay] [data-combined-dyeing-id]').first()
  const taskId = await taskContainer.getAttribute('data-combined-dyeing-id')
  expect(taskId).toBeTruthy()
  await expect(page.getByText(FIRST_ORDER_NO, { exact: true })).toBeVisible()
  await expect(page.getByText(SECOND_ORDER_NO, { exact: true })).toBeVisible()
  await expect(page.getByText('成员已锁定')).toHaveCount(2)
  await expect(page.getByText(/增加成员|移除成员|调整顺序/)).toHaveCount(0)

  await clickAction(page, 'open-complete', taskId!)
  await expect(page.getByRole('heading', { name: '完成染色' })).toBeVisible()
  await expect(page.getByText(/短产部分直接记为未满足并终止/)).toBeVisible()
  await page.locator('input[name="actualInputQty"]').fill('1000')
  await page.locator('input[name="actualOutputQty"]').fill('800')
  await expect(page.locator('input[name="actualInputQty"]')).toHaveValue('1000')
  await expect(page.locator('input[name="actualOutputQty"]')).toHaveValue('800')
  expect(await overlay.locator('input[name], textarea[name]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('name')))).toEqual([
    'actualInputQty',
    'actualOutputQty',
    'remark',
  ])
  await clickAction(page, 'submit-complete', taskId!)
  await expect(page.getByText('已完成', { exact: true }).first()).toBeVisible()

  const memberRows = page.locator('[data-combined-dyeing-page-scope="members"] tbody tr')
  await expect(memberRows.nth(0)).toContainText(FIRST_ORDER_NO)
  await expect(memberRows.nth(0)).toContainText('600 Yard')
  await expect(memberRows.nth(0)).toContainText('已满足')
  await expect(memberRows.nth(1)).toContainText(SECOND_ORDER_NO)
  await expect(memberRows.nth(1)).toContainText('200 Yard')
  await expect(memberRows.nth(1)).toContainText('部分满足')
  await expect(memberRows.nth(1)).toContainText('200 Yard')
  await expect(page.getByText(/继续染|补染|再次投缸|多次投缸/)).toHaveCount(0)

  await clickAction(page, 'open-correct', taskId!)
  await expect(page.getByRole('heading', { name: '更正染色结果' })).toBeVisible()
  await expect(page.locator('input[name="actualInputQty"]')).toHaveValue('1000')
  await expect(page.locator('input[name="actualOutputQty"]')).toHaveValue('800')
  await expect(page.locator('textarea[name="reason"]')).toBeVisible()
  await expect(page.locator('textarea[name="remark"]')).toHaveCount(0)
  expect(await overlay.locator('input[name], textarea[name]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('name')))).toEqual([
    'actualInputQty',
    'actualOutputQty',
    'reason',
  ])
  await page.locator('input[name="actualInputQty"]').fill('1000')
  await page.locator('input[name="actualOutputQty"]').fill('900')
  await page.locator('textarea[name="reason"]').fill('复核后更正产出')
  await clickAction(page, 'submit-correct', taskId!)
  await expect(page.locator('[data-combined-dyeing-page-scope="members"] tbody tr').nth(1)).toContainText('300 Yard')
  const versions = page.locator('[data-combined-dyeing-page-scope="versions"] tbody tr')
  await expect(versions).toHaveCount(2)
  await expect(versions.nth(0)).toContainText('第 1 版')
  await expect(versions.nth(0)).toContainText('800 Yard')
  await expect(versions.nth(1)).toContainText('第 2 版（当前）')
  await expect(versions.nth(1)).toContainText('900 Yard')
  await expect(versions.nth(0)).toContainText('0 Yard')
  await expect(versions.nth(1)).toContainText('0 Yard')

  await clickAction(page, 'close-overlay')
  const listHeaders = await page.locator('[data-combined-dyeing-workspace] thead th').allTextContents()
  const excessColumnIndex = listHeaders.findIndex((text) => text.includes('超出数量'))
  expect(excessColumnIndex).toBeGreaterThanOrEqual(0)
  const completedTaskRow = page.locator('[data-combined-dyeing-workspace] tbody tr').filter({ hasText: taskNo })
  await expect(completedTaskRow.locator('td').nth(excessColumnIndex)).toHaveText('0 Yard')
  await page.getByRole('button', { name: '染色加工单', exact: true }).first().click()
  await expect(page).toHaveURL(/\/fcs\/craft\/dyeing\/work-orders$/)
  const secondOrderRow = await findWorkOrderRow(page, SECOND_ORDER_NO)
  await expect(secondOrderRow.getByText('已加入合并染色')).toBeVisible()
  await expect(secondOrderRow.getByText(taskNo, { exact: true })).toBeVisible()
  await secondOrderRow.getByText(taskNo, { exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`combined-dyeing\\?taskId=${taskId}`))
  await expect(page.getByRole('heading', { name: `合并染色详情 · ${taskNo}` })).toBeVisible()
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))

  await clickAction(page, 'open-delete', taskId!)
  await expect(page).toHaveURL(new RegExp(`${COMBINED_PATH}$`))
  await expect(page.getByRole('heading', { name: '删除任务' })).toBeVisible()
  await page.locator('textarea[name="deleteReason"]').fill('本批次业务终止')
  await clickAction(page, 'submit-delete', taskId!)
  await expect(page.getByRole('heading', { name: '删除任务' })).toHaveCount(0)
  await page.locator('[data-combined-dyeing-field="includeDeleted"]').check()
  const deletedRow = page.locator('tbody tr').filter({ hasText: taskNo })
  await expect(deletedRow).toContainText('已删除')
  await expect(deletedRow.locator('td').nth(excessColumnIndex)).toHaveText('0 Yard')
  await deletedRow.getByText(taskNo, { exact: true }).click()
  await expect(page.getByText('本批次业务终止')).toBeVisible()
  await expect(page.locator('[data-combined-dyeing-page-scope="versions"] tbody tr')).toHaveCount(2)
  await clickAction(page, 'close-overlay')

  await clickAction(page, 'open-create')
  await page.locator('[data-combined-dyeing-page-scope="candidates"] [data-combined-dyeing-field="pageSize"]').selectOption('20')
  await expect(page.locator(`[data-combined-dyeing-action="toggle-member"][data-combined-dyeing-id="${SECOND_ORDER_ID}"]`)).toBeEnabled()
  await clickAction(page, 'close-overlay')

  await page.getByRole('button', { name: '染色加工单', exact: true }).first().click()
  const historyRow = await findWorkOrderRow(page, SECOND_ORDER_NO)
  await expect(historyRow.getByText('已加入合并染色')).toHaveCount(0)
  await expect(historyRow).toContainText('当前无活动任务，保留历史分配')
  await expect(historyRow).toContainText('有效 300 Yard')
  await historyRow.getByRole('button', { name: '查看详情' }).click()
  await expect(page).toHaveURL(new RegExp(`/fcs/craft/dyeing/work-orders/${SECOND_ORDER_ID}`))
  await expect(page.getByText(FIRST_ORDER_NO, { exact: true })).toHaveCount(0)
  await expect(page.getByText(SECOND_ORDER_NO, { exact: true }).first()).toBeVisible()
  await expect(page.getByText(`${SECOND_ORDER_NO} / ${SECOND_ORDER_ID}`, { exact: true })).toBeVisible()
  await expect(page.getByText(taskNo, { exact: true }).first()).toBeVisible()
  await expect(page.getByText('本批次业务终止')).toBeVisible()
  await expect(page.getByText('第 1 版')).toBeVisible()
  await expect(page.getByText('第 2 版（当前）')).toBeVisible()

  const mobileExecution = page.getByRole('button', { name: '打开移动端执行页' })
  await expect(mobileExecution).toBeEnabled()
  await mobileExecution.click()
  await expect(page.locator('body')).toContainText(SECOND_ORDER_NO)
  await expect(page.locator('body')).toContainText(SECOND_ORDER_ID)

  await page.goto('/fcs/process/dye-orders')
  const platformKeyword = page.getByPlaceholder('加工单号 / 生产单号 / 备货物料 / 工厂')
  await platformKeyword.fill('预热')
  await expect.poll(() => page.evaluate(() => document.body.innerText.includes('暂无加工单')), { timeout: 30_000 }).toBe(true)
  await platformKeyword.fill(SECOND_ORDER_NO)
  await expect.poll(() => page.evaluate((orderNo) => document.body.innerText.includes(orderNo), SECOND_ORDER_NO)).toBe(true)
  await page.evaluate((orderNo) => {
    const row = Array.from(document.querySelectorAll('tbody tr')).find((node) => node.textContent?.includes(orderNo))
    ;(row?.querySelector('[data-dye-order-action="open-detail"]') as HTMLButtonElement | null)?.click()
  }, SECOND_ORDER_NO)
  await expect(page.getByText('平台加工单号：').locator('..')).toContainText(SECOND_ORDER_NO)
  await expect(page.locator('body')).not.toContainText('工厂加工单号')

  await expect(page.locator('body')).not.toContainText('染色需求单')
  await expect(page.locator('body')).not.toContainText('印花需求单')
  expect(consoleErrors).toEqual([])
})

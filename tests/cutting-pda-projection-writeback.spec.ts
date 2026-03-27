import { expect, test, type Page } from '@playwright/test'

const sampleTaskId = 'TASK-CUT-000097'
const sampleExecutionOrderNo = 'CPO-20260319-K'

function attachPageErrorCollector(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })
  return errors
}

async function expectNoRuntimeErrors(errors: string[]): Promise<void> {
  expect(errors).toEqual([])
}

test('PDA 裁片任务列表正常打开并可进入详情', async ({ page }) => {
  const errors = attachPageErrorCollector(page)

  await page.goto('/fcs/pda/task-receive?tab=pending-accept')
  await expect(page.getByRole('heading', { name: '接单与报价', exact: true })).toBeVisible()

  const cuttingCard = page.locator('[data-pda-cutting-task-card-id]').first()
  await expect(cuttingCard).toBeVisible()
  await expect(cuttingCard).toContainText('TASK-CUT')

  await cuttingCard.locator('[data-nav]').first().click()
  await expect(page).toHaveURL(/\/fcs\/pda\/task-receive\//)
  await expect(page.locator('body')).toContainText('任务详情')

  await expectNoRuntimeErrors(errors)
})

test('PDA 裁片任务详情正常打开并显示正式执行对象引用', async ({ page }) => {
  const errors = attachPageErrorCollector(page)

  await page.goto(`/fcs/pda/cutting/task/${sampleTaskId}?executionOrderNo=${encodeURIComponent(sampleExecutionOrderNo)}`)
  await expect(page.locator('body')).toContainText(sampleTaskId)
  await expect(page.locator('body')).toContainText('关联执行单')
  await expect(page.locator('body')).toContainText('执行单号')
  await expect(page.locator('body')).toContainText('绑定原始裁片单')

  await expectNoRuntimeErrors(errors)
})

test('PDA 领料页正常提交并走统一写回桥', async ({ page }) => {
  const errors = attachPageErrorCollector(page)

  await page.goto(`/fcs/pda/cutting/pickup/${sampleTaskId}?executionOrderNo=${encodeURIComponent(sampleExecutionOrderNo)}`)
  await expect(page.getByRole('heading', { name: '扫码领料', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('当前领料状态')
  await page.locator('[data-pda-cut-pickup-action="submit"]').click()
  await expect(page.locator('body')).toContainText('领料结果已按一致数量回写。')

  await expectNoRuntimeErrors(errors)
})

test('PDA 铺布页正常提交且三种铺布模式仍可见', async ({ page }) => {
  const errors = attachPageErrorCollector(page)

  await page.goto(`/fcs/pda/cutting/spreading/${sampleTaskId}?executionOrderNo=${encodeURIComponent(sampleExecutionOrderNo)}`)
  await expect(page.locator('h1').filter({ hasText: '铺布录入' })).toBeVisible()
  await expect(page.locator('body')).toContainText('正常模式')
  await expect(page.locator('body')).toContainText('高低层模式')
  await expect(page.locator('body')).toContainText('对折模式')
  await page.locator('[data-pda-cut-spreading-action="submit"]').click()
  await expect(page.locator('body')).toContainText('铺布记录已保存。')

  await expectNoRuntimeErrors(errors)
})

test('PDA 入仓页正常提交并正式回流', async ({ page }) => {
  const errors = attachPageErrorCollector(page)

  await page.goto(`/fcs/pda/cutting/inbound/${sampleTaskId}?executionOrderNo=${encodeURIComponent(sampleExecutionOrderNo)}`)
  await expect(page.locator('h1').filter({ hasText: '入仓扫码' })).toBeVisible()
  await expect(page.locator('body')).toContainText('当前入仓状态')
  await page.locator('[data-pda-cut-inbound-action="confirm"]').click()
  await expect(page.locator('body')).toContainText('入仓已确认。')

  await expectNoRuntimeErrors(errors)
})

test('PDA 页面 UI 骨架保持稳定，没有被顺手大改', async ({ page }) => {
  const errors = attachPageErrorCollector(page)

  await page.goto(`/fcs/pda/cutting/task/${sampleTaskId}?executionOrderNo=${encodeURIComponent(sampleExecutionOrderNo)}`)
  await expect(page.getByRole('heading', { name: '裁片任务', exact: true })).toBeVisible()
  await expect(page.locator('[data-pda-cutting-order-card-id]').first()).toBeVisible()

  await page.goto(`/fcs/pda/cutting/pickup/${sampleTaskId}?executionOrderNo=${encodeURIComponent(sampleExecutionOrderNo)}`)
  await expect(page.getByRole('heading', { name: '扫码领料', exact: true })).toBeVisible()
  await expect(page.locator('[data-pda-cut-pickup-action="submit"]')).toBeVisible()

  await page.goto(`/fcs/pda/cutting/spreading/${sampleTaskId}?executionOrderNo=${encodeURIComponent(sampleExecutionOrderNo)}`)
  await expect(page.locator('h1').filter({ hasText: '铺布录入' })).toBeVisible()
  await expect(page.locator('[data-pda-cut-spreading-action="submit"]')).toBeVisible()

  await expectNoRuntimeErrors(errors)
})

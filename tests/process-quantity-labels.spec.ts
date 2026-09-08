import { expect, test } from '@playwright/test'

import { buildSpecialCraftOperationSlug } from '../src/data/fcs/special-craft-operations.ts'
import { listSpecialCraftTaskOrders } from '../src/data/fcs/special-craft-task-orders.ts'

const PDA_SESSION = {
  userId: 'F090_operator',
  loginId: 'F090_operator',
  userName: '全能力测试工厂_操作工',
  roleId: 'ROLE_OPERATOR',
  factoryId: 'F090',
  factoryName: '全能力测试工厂',
  loggedAt: '2026-04-28 10:00:00',
}

async function setPdaSession(page: import('@playwright/test').Page) {
  await page.addInitScript((session) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
  }, PDA_SESSION)
}

test('印花只展示 BOM 原物料对象与对应单位', async ({ page }) => {
  await page.goto('/fcs/craft/printing/work-orders')
  await expect(page.getByRole('heading', { name: '印花加工单', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('[面料]')
  await expect(page.locator('body')).toContainText('计划投入')
  await expect(page.locator('body')).not.toContainText('计划印花裁片数量')

  await page.getByRole('link', { name: '详情', exact: true }).first().click()
  await expect(page.locator('body')).toContainText('加工投入')
  await expect(page.locator('body')).toContainText('[面料]')
  await expect(page.locator('body')).not.toContainText('裁片印花')
})

test('平台侧印花与染色详情展示原物料对象数量', async ({ page }) => {
  await page.goto('/fcs/process/print-orders')
  await expect(page.getByRole('heading', { level: 1, name: '印花加工单', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '查看', exact: true }).first().click()
  await expect(page.locator('[data-process-print-orders-detail]')).toContainText(/计划印花(?:面料米数|BOM原物料)/)
  await expect(page.locator('[data-process-print-orders-detail]')).not.toContainText('计划印花裁片数量')
  await expect(page.locator('[data-process-print-orders-detail]')).not.toContainText('计划投料数量')

  await page.goto('/fcs/process/dye-orders')
  await expect(page.getByRole('heading', { level: 1, name: '染色加工单', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '查看', exact: true }).first().click()
  await expect(page.locator('[data-process-dye-orders-detail]')).toContainText('计划染色面料米数')
  await expect(page.locator('[data-process-dye-orders-detail]')).not.toContainText('染色裁片数量')
})

test('移动端任务详情展示对象和单位', async ({ page }) => {
  await setPdaSession(page)
  await page.goto('/fcs/pda/exec/TASK-PRINT-000716')
  await expect(page.locator('body')).toContainText('计划印花面料米数')
  await expect(page.locator('body')).not.toContainText('印花裁片数量')

  await page.goto('/fcs/pda/exec/TASK-PRINT-000717')
  await expect(page.locator('body')).toContainText(/计划印花(?:面料米数|BOM原物料)/)
  await expect(page.locator('body')).not.toContainText('印花裁片数量')

  await page.goto('/fcs/pda/exec/TASK-DYE-000726')
  await expect(page.locator('body')).toContainText('计划染色面料米数')
})

test('裁片对象特殊工艺展示裁片数量与菲票数量', async ({ page }) => {
  const order = listSpecialCraftTaskOrders().find((item) => item.targetObject === '已裁部位')
  if (!order) throw new Error('缺少裁片对象特殊工艺加工单')
  const slug = buildSpecialCraftOperationSlug(order.operationId)
  await page.goto(`/fcs/process-factory/special-craft/${slug}/work-orders/${encodeURIComponent(order.taskOrderId)}`)
  await expect(page.locator('body')).toContainText('计划裁片数量')
  await expect(page.locator('body')).toContainText('菲票号')
  await page.getByRole('button', { name: '仓库流转' }).click()
  await expect(page.locator('body')).toContainText('关联菲票数')
  await expect(page.locator('body')).toContainText('菲票流转明细')
})

import { expect, test } from '@playwright/test'

const SUPPLIERS = '/pms/suppliers'
const SUPPLY_ARCHIVES = '/pms/supplier-supply-archives'
test.describe('PMS 保留基础资料页面', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
  })

  test('供应商可新增、提交审核并启用', async ({ page }) => {
    await page.goto(SUPPLIERS)
    await page.locator('[data-pms-sup-action="open-create"]').click()
    await expect(page.locator('[data-pms-sup-form-root]')).toBeVisible()
    const name = `端到端供应商${Date.now()}`
    await page.locator('[data-pms-sup-form-field="supplierName"]').fill(name)
    await page.locator('[data-pms-sup-form-field="shortName"]').fill('端到端简称')
    await page.locator('[data-pms-sup-form-field="wechat"]').fill('e2e_wx')
    await page.locator('[data-pms-sup-form-field="defaultDeliveryMethod"]').selectOption('发至中国中转仓')
    await page.locator('[data-pms-sup-form-field="contactName"]').fill('端到端联系人')
    await page.locator('[data-pms-sup-form-field="contactPhone"]').fill('13800000009')
    await page.locator('[data-pms-sup-form-field="city"]').fill('广东广州')
    await page.locator('[data-pms-sup-action="submit-form"]').click()
    await expect(page.locator('[data-pms-sup-root]')).toContainText(/已创建供应商 SUP-[A-Z0-9-]+（草稿）/)
    await page.locator('[data-pms-sup-field="keyword"]').fill(name)
    await page.getByRole('button', { name: '查询', exact: true }).click()
    await page.locator('[data-pms-sup-table-surface] tbody tr').filter({ hasText: name }).locator('[data-pms-sup-action="open-detail"]').click()
    await expect(page.locator('[data-pms-sup-root] [role="dialog"]').last()).toContainText('e2e_wx')
    await expect(page.locator('[data-pms-sup-root] [role="dialog"]').last()).toContainText('发至中国中转仓')
    await page.keyboard.press('Escape')

    await page.locator('[data-pms-sup-table-surface] tbody tr').filter({ hasText: name }).locator('[data-pms-sup-action="advance"][data-next-status="待审核"]').click()
    await expect(page.locator('[data-pms-sup-root]')).toContainText('已变为待审核')
    await page.locator('[data-pms-sup-table-surface] tbody tr').filter({ hasText: name }).locator('[data-pms-sup-action="advance"][data-next-status="已启用"]').click()
    await expect(page.locator('[data-pms-sup-toggle-root]')).toBeVisible()
    await page.locator('[data-pms-sup-action="confirm-toggle"]').click()
    await expect(page.locator('[data-pms-sup-root]')).toContainText('已变为已启用')
    await page.reload()
    await page.locator('[data-pms-sup-field="keyword"]').fill(name)
    await page.getByRole('button', { name: '查询', exact: true }).click()
    await expect(page.locator('[data-pms-sup-table-surface] tbody tr').filter({ hasText: name })).toContainText('已启用')
  })

  test('供货档案换算与快照版本更新', async ({ page }) => {
    await page.goto(SUPPLY_ARCHIVES)
    await page.locator('[data-pms-arc-action="open-detail"]').first().click()
    await expect(page.locator('[data-pms-arc-detail-root]')).toBeVisible()
    await page.locator('[data-pms-arc-conv-field="qty"]').fill('250')
    await page.locator('[data-pms-arc-action="convert"]').click()
    await expect(page.locator('[data-pms-arc-conversion-result]')).toContainText('3 卷')
    await page.keyboard.press('Escape')

    await page.locator('[data-pms-arc-action="open-edit"]').first().click()
    await page.locator('[data-pms-arc-edit-field="price"]').fill('28.8')
    await page.locator('[data-pms-arc-action="submit-edit"]').click()
    await expect(page.locator('[data-pms-arc-root]')).toContainText(/已保存，包装快照 V\d+/)
  })
})

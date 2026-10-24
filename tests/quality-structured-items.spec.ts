import { expect, test } from '@playwright/test'

test.describe('质检标准结构化与后道QC按项记录', () => {
  test('STORE-04 旧演示质检配置切换为结构化种子', async ({ page }) => {
    await page.goto('/fcs/workbench/overview')
    await page.evaluate(async () => {
      const db = await import('/src/data/pcs-record-db.ts')
      await db.commitPcsRecords({ puts: [{ id: 'higood-fcs-quality-management/config/legacy-old', collection: 'quality/config', value: { id: 'legacy-old', kind: 'BASIC', status: 'EFFECTIVE', name: '旧版文本标准' }, expectedVersion: 0 }], deletes: [], operationId: 'seed-legacy-quality-config', intent: 'STORE-04 reset test' })
    })
    await page.goto('/fcs/quality-management/basic-standards')
    await expect(page.getByText('成衣基本质检标准').first()).toBeVisible()
    await expect(page.getByText('旧版文本标准')).toHaveCount(0)
    const state = await page.evaluate(async () => {
      const db = await import('/src/data/pcs-record-db.ts')
      const result = await db.readPcsRecords(['higood-fcs-quality-management'])
      return { ids: result.records.filter(row => !row.deleted).map(row => row.id), schema: result.records.find(row => row.id === 'higood-fcs-quality-management/scope/schema')?.value }
    })
    expect(state.ids).not.toContain('higood-fcs-quality-management/config/legacy-old')
    expect(state.schema?.version).toBe(2)
  })

  test('基本标准、规则和后道QC工作台展示结构化项目', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })

    await page.goto('/fcs/quality-management/basic-standards/garment-basic-v1')
    await expect(page.locator('h1').first()).toContainText('成衣基本质检标准')
    await expect(page.getByText('测量定义与技术包标准值').first()).toBeVisible()
    await expect(page.getByText('缺陷代码').first()).toBeVisible()

    await page.goto('/fcs/quality-management/inspection-rules/production-return-rule-v1')
    await expect(page.locator('h1').first()).toContainText('后道生产回货检查规则')
    await expect(page.getByText('各轮稽查门槛')).toBeVisible()
    await expect(page.getByText('生产回货初始全检条件')).toBeVisible()

    await page.goto('/fcs/quality-management/basic-standards/garment-basic-v1')
    await page.getByRole('button', { name: '派生新草稿' }).click()
    await expect(page).toHaveURL(/\/edit/)
    await page.getByText('执行结构化字段').first().click()
    await expect(page.getByText('缺陷代码', { exact: true }).first()).toBeVisible()

    await page.goto('/fcs/craft/post-finishing/qc-workbench?view=followup&taskNo=PO-QC-202608-001-4-ZJ')
    await expect(page.locator('[data-qc-workbench-task] h2').first()).toContainText('PO-QC-202608-001-4-ZJ')
    const firstSku = page.locator('[data-qc-result-line]').first()
    await firstSku.scrollIntoViewIfNeeded()
    await expect(firstSku.locator('[data-qc-observation]').first()).toBeVisible()
    await expect(firstSku.locator('[data-qc-observation-value]').first()).toBeVisible()
    await firstSku.getByRole('button', { name: '本SKU项目全部合格' }).click()
    await expect(firstSku.locator('[data-qc-observation-result]').first()).toHaveValue('PASS')

    const skuRows = page.locator('[data-qc-result-line]')
    const skuCount = await skuRows.count()
    for (let index = 0; index < skuCount; index += 1) {
      const row = skuRows.nth(index)
      const remaining = Number(await row.getAttribute('data-remaining'))
      await row.locator('[data-qc-result-field="passedQty"]').fill(String(remaining))
      await row.getByRole('button', { name: '本SKU项目全部合格' }).click()
      const measurements = row.locator('[data-qc-observation-value]')
      for (let measurement = 0; measurement < await measurements.count(); measurement += 1) await measurements.nth(measurement).fill('50')
    }
    await page.getByRole('button', { name: /提交第1轮检查/ }).click()
    await expect(page.getByText(/本轮结果已保存/)).toBeVisible({ timeout: 15000 })

    await page.goto('/fcs/quality-management/records?sourceKind=PRODUCTION_RETURN&keyword=PO-QC-202608-001-4-ZJ')
    await expect(page.getByRole('link', { name: 'PO-QC-202608-001-4-ZJ' }).first()).toBeVisible()
    await page.getByRole('link', { name: 'PO-QC-202608-001-4-ZJ' }).first().click()
    await page.getByText('各轮实际检查').scrollIntoViewIfNeeded()
    await expect(page.getByText('各轮实际检查')).toBeVisible()
    await expect(page.getByText('领围').first()).toBeVisible()
    await expect(page.getByText('50 cm', { exact: true }).first()).toBeVisible()

    await page.goto('/fcs/craft/post-finishing/print?type=QC_DETAIL&id=PO-QC-202608-001-4-ZJ')
    await expect(page.getByText('实际检查记录')).toBeVisible()
    await expect(page.getByText(/50 cm/).first()).toBeVisible()
  })
})

import { expect, test } from '@playwright/test'

test('印花和染色选择立即联动将生成的工作预览', async ({ page }) => {
  await page.goto('/pcs/production-preparation/design-revision/ES-ID-DR-001')

  const firstMaterialRow = page.locator('[data-independent-bom-line]').first()
  const dyeRequirement = firstMaterialRow.locator('[data-pcs-independent-sampling-field="bomDyeRequirement"]')
  const printRequirement = firstMaterialRow.locator('[data-pcs-independent-sampling-field="bomPrintRequirement"]')
  const workPreview = page.locator('[data-design-revision-work-preview]')

  await dyeRequirement.selectOption('否')
  await printRequirement.selectOption('否')
  await expect(workPreview).not.toContainText('花型任务')
  await expect(workPreview).not.toContainText('调色任务')

  await printRequirement.selectOption('是')
  await expect(workPreview).toContainText('花型任务')
  await expect(workPreview).not.toContainText('调色任务')

  await dyeRequirement.selectOption('是')
  await expect(workPreview).toContainText('花型任务')
  await expect(workPreview).toContainText('调色任务（面料）')
})

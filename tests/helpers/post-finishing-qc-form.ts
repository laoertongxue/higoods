import { expect, type Locator } from '@playwright/test'
/** Fill actual QC controls for a declared per-SKU fixture, including its applicable item evidence. */
export async function fillPostQcRow(row: Locator, passed: number, defect = 0, rework = 0): Promise<void> {
  await row.locator('[data-qc-result-field="passedQty"]').fill(String(passed))
  await row.locator('[data-qc-result-field="defectQty"]').fill(String(defect))
  await row.locator('[data-qc-result-field="returnQty"]').fill(String(rework))
  if (passed + defect + rework === 0) return
  if (await row.locator('[data-qc-all-pass]').count()) {
    await row.getByRole('button', { name: '本SKU项目全部合格' }).click()
    for (const input of await row.locator('[data-qc-observation-value]').all()) {
      const placeholder = await input.getAttribute('placeholder') || ''
      await input.fill(placeholder.match(/标准\s*(-?[\d.]+)/)?.[1] || '50')
    }
    if (defect || rework) {
      const issue = row.locator('[data-qc-observation="garment-clean"]')
      await expect(issue).toBeVisible()
      await issue.locator('[data-qc-observation-result]').selectOption('FAIL')
      const codes = issue.locator('[data-qc-observation-defect]')
      if (await codes.count()) await codes.selectOption({ index: 1 })
      await issue.locator('[data-qc-observation-note]').fill('隔离验收：实际逐件检查发现污渍，同件多问题只计一件')
    }
  } else if (defect || rework) {
    await row.locator('[data-qc-issue="garment-clean"]').check()
    await row.locator('[data-qc-issue-note]').fill('隔离验收：污渍；同一件多问题仍计一件')
  }
}

import { expect, test } from '@playwright/test'

test('产前版样衣提交失败保留抽屉输入并就地显示错误，成功后才刷新任务', async ({ page }) => {
  await page.goto('/')
  const masterOrderId = await page.evaluate(async () => {
    const styleRepository = await import('/src/data/pcs-style-archive-repository.ts')
    const engineeringRepository = await import('/src/data/pcs-engineering-master-repository.ts')
    styleRepository.resetStyleArchiveRepository()
    engineeringRepository.resetEngineeringMasterRepository()
    const style = styleRepository.listStyleArchives()[0]
    if (!style) throw new Error('缺少款式档案演示数据')
    const master = engineeringRepository.createEngineeringMasterOrder({
      styleId: style.styleId,
      styleCode: style.styleCode,
      merchandiserName: '跟单A',
    })
    engineeringRepository.publishEngineeringMasterOrder(master.masterOrderId)
    engineeringRepository.submitEngineeringTaskResult(
      master.masterOrderId,
      `${master.masterOrderId}-BASE_PATTERN_WOVEN`,
    )
    engineeringRepository.submitEngineeringTaskResult(
      master.masterOrderId,
      `${master.masterOrderId}-BASE_PATTERN_KNIT`,
    )
    return master.masterOrderId
  })

  await page.goto(`/pcs/engineering/masters/${masterOrderId}`)
  const sampleCard = page.locator(`[data-engineering-task-card][data-task-id="${masterOrderId}-PRE_PRODUCTION_SAMPLE"]`)
  await sampleCard.click()

  const drawer = page.locator('[data-engineering-master-region="drawer"]')
  await drawer.evaluate((node) => node.setAttribute('data-drawer-stability-token', 'keep'))
  await sampleCard.evaluate((node) => node.setAttribute('data-card-stability-token', 'keep'))

  await drawer.locator('[data-pcs-engineering-master-field="sample-result-images"]').fill('front.jpg, back.jpg')
  await drawer.locator('[data-pcs-engineering-master-field="sample-result-quantity"]').fill('2')
  await drawer.getByRole('button', { name: '提交样衣成果' }).click()

  await expect(drawer).toHaveAttribute('data-drawer-stability-token', 'keep')
  await expect(sampleCard).toHaveAttribute('data-card-stability-token', 'keep')
  await expect(drawer.locator('[data-pcs-engineering-master-field="sample-result-images"]')).toHaveValue('front.jpg, back.jpg')
  await expect(drawer.locator('[data-pcs-engineering-master-field="sample-result-quantity"]')).toHaveValue('2')
  await expect(drawer.getByRole('alert')).toContainText('请填写产前版样衣成果提交人')

  await drawer.locator('[data-pcs-engineering-master-field="sample-result-submitted-by"]').fill('样衣制作组-阿兰')
  await drawer.getByRole('button', { name: '提交样衣成果' }).click()

  await expect(sampleCard).not.toHaveAttribute('data-card-stability-token', 'keep')
  await expect(sampleCard).toContainText('已完成')
  await expect(drawer.getByRole('button', { name: '提交样衣成果' })).toHaveCount(0)
})

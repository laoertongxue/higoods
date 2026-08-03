import { expect, test, type Page } from '@playwright/test'

async function seedReviewTasks(page: Page): Promise<{
  masterOrderId: string
  patternTaskId: string
  colorTaskId: string
}> {
  return page.evaluate(async () => {
    const styleRepository = await import('/src/data/pcs-style-archive-repository.ts')
    const engineeringRepository = await import('/src/data/pcs-engineering-master-repository.ts')
    const patternRepository = await import('/src/data/pcs-pattern-library.ts')
    styleRepository.resetStyleArchiveRepository()
    engineeringRepository.resetEngineeringMasterRepository()
    patternRepository.resetPatternLibraryStore()
    const style = styleRepository.listStyleArchives()[0]
    if (!style) throw new Error('缺少款式档案演示数据')
    const draft = engineeringRepository.createEngineeringMasterOrder({
      styleId: style.styleId,
      styleCode: style.styleCode,
      merchandiserName: '跟单A',
    })
    const master = engineeringRepository.publishEngineeringMasterOrder(draft.masterOrderId)
    const patternTaskId = `${master.masterOrderId}-PATTERN_ARTWORK`
    const colorTaskId = `${master.masterOrderId}-COLOR_FABRIC`
    engineeringRepository.updateEngineeringTaskRecord(master.masterOrderId, patternTaskId, (task) => {
      task.status = '进行中'
      task.ownerTeamName = '花型组'
      task.materialLines = [
        {
          materialLineId: 'PATTERN-LINE-1', materialSkuId: 'FAB-RED', materialName: '红色印花面料', materialType: '面料',
          requirementType: '印花', productColor: '红色', printProcess: '数码印花', status: '正常', resultFileIds: [], effectImageIds: [],
          resultSubmittedBy: '', resultSubmittedAt: '', reviewStatus: '待提交', reviewReason: '', reviewedBy: '', reviewedAt: '',
        },
        {
          materialLineId: 'PATTERN-LINE-2', materialSkuId: 'FAB-BLUE', materialName: '蓝色印花面料', materialType: '面料',
          requirementType: '印花', productColor: '蓝色', printProcess: '数码印花', status: '正常', resultFileIds: [], effectImageIds: [],
          resultSubmittedBy: '', resultSubmittedAt: '', reviewStatus: '待提交', reviewReason: '', reviewedBy: '', reviewedAt: '',
        },
      ]
    })
    engineeringRepository.updateEngineeringTaskRecord(master.masterOrderId, colorTaskId, (task) => {
      task.status = '进行中'
      task.ownerTeamName = '染厂协作组'
      task.materialLines = [
        {
          materialLineId: 'COLOR-LINE-1', materialSkuId: 'FAB-DYE-RED', materialName: '待染红色面料', materialType: '面料',
          requirementType: '染色', productColor: '红色', status: '正常', resultFileIds: [], effectImageIds: [],
          resultSubmittedBy: '', resultSubmittedAt: '', reviewStatus: '待提交', reviewReason: '', reviewedBy: '', reviewedAt: '',
        },
        {
          materialLineId: 'COLOR-LINE-2', materialSkuId: 'FAB-DYE-BLUE', materialName: '待染蓝色面料', materialType: '面料',
          requirementType: '染色', productColor: '蓝色', status: '正常', resultFileIds: [], effectImageIds: [],
          resultSubmittedBy: '', resultSubmittedAt: '', reviewStatus: '待提交', reviewReason: '', reviewedBy: '', reviewedAt: '',
        },
      ]
    })
    return { masterOrderId: master.masterOrderId, patternTaskId, colorTaskId }
  })
}

test('调色任务必须按 BOM、跟单确认、染厂成果三个阶段推进', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const seeded = await seedReviewTasks(page)
  await page.waitForTimeout(500)
  await page.goto(`/pcs/engineering/color/${seeded.colorTaskId}`)

  await expect(page.getByRole('heading', { name: '1 BOM 染色物料' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '2 跟单确认' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '3 染厂成果与买手审核' })).toBeVisible()
  await expect(page.getByRole('button', { name: '整单提交调色成果' })).toHaveCount(0)

  await page.getByLabel('确认人').fill('跟单A')
  await page.getByRole('button', { name: '整单确认染色要求' }).click()
  await expect(page.getByRole('alert')).toContainText('缺少潘通色卡色号')

  for (const lineId of ['COLOR-LINE-1', 'COLOR-LINE-2']) {
    const row = page.locator(`[data-color-requirement-row="${lineId}"]`)
    await row.getByLabel('潘通色号').fill(lineId.endsWith('1') ? '18-1664' : '19-4052')
    await row.getByLabel('颜色名称').fill(lineId.endsWith('1') ? '正红' : '宝蓝')
    await row.getByLabel('染色色号').fill(lineId.endsWith('1') ? 'DYE-R01' : 'DYE-B01')
  }
  await page.getByRole('button', { name: '整单确认染色要求' }).click()

  await expect(page.getByText('跟单A 已确认')).toBeVisible()
  await expect(page.getByRole('button', { name: '整单提交调色成果' })).toBeVisible()
})

test('花型任务混合审核要求失败原因并锁定通过行，返工只提交失败行', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const seeded = await seedReviewTasks(page)
  await page.waitForTimeout(500)
  await page.goto(`/pcs/patterns/artwork/${seeded.patternTaskId}`)

  for (const lineId of ['PATTERN-LINE-1', 'PATTERN-LINE-2']) {
    const row = page.locator(`[data-pattern-result-row="${lineId}"]`)
    await row.getByLabel('成果文件').fill(`${lineId}.ai`)
    await row.getByLabel('效果图').fill(`${lineId}.jpg`)
  }
  await page.getByLabel('成果提交人').fill('花型师A')
  await page.getByRole('button', { name: '整单提交花型成果' }).click()

  await page.getByLabel('买手审核人').fill('买手A')
  await page.locator('[data-review-row="PATTERN-LINE-1"]').getByLabel('审核结论').selectOption('通过')
  await page.locator('[data-review-row="PATTERN-LINE-2"]').getByLabel('审核结论').selectOption('未通过')
  await page.getByRole('button', { name: '确认整单审核' }).click()
  await expect(page.getByRole('alert')).toContainText('必须填写未通过原因')

  await page.locator('[data-review-row="PATTERN-LINE-2"]').getByLabel('未通过原因').fill('花型边缘需要调整')
  await page.getByRole('button', { name: '确认整单审核' }).click()

  await expect(page.locator('[data-pattern-result-row="PATTERN-LINE-1"]')).toContainText('已通过，已锁定')
  await expect(page.locator('[data-pattern-result-row="PATTERN-LINE-1"] input')).toHaveCount(0)
  await expect(page.locator('[data-pattern-result-row="PATTERN-LINE-2"] input')).toHaveCount(2)
  await expect(page.locator('[data-pattern-result-row="PATTERN-LINE-2"]')).toContainText('花型边缘需要调整')

  const failedRow = page.locator('[data-pattern-result-row="PATTERN-LINE-2"]')
  await failedRow.getByLabel('成果文件').fill('PATTERN-LINE-2-v2.ai')
  await failedRow.getByLabel('效果图').fill('PATTERN-LINE-2-v2.jpg')
  await page.getByLabel('成果提交人').fill('花型师A')
  await page.getByRole('button', { name: '整单提交花型成果' }).click()
  await expect(page.locator('[data-review-row="PATTERN-LINE-1"]')).toHaveCount(0)
  await expect(page.locator('[data-review-row="PATTERN-LINE-2"]')).toBeVisible()
})

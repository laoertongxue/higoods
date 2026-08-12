import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

const FIRST_PREVIEW = path.resolve('public/dress-sample-1.jpg')
const SECOND_PREVIEW = path.resolve('public/pants-sample.jpg')

async function seedReviewTasks(page: Page): Promise<{
  plateTaskId: string
  patternTaskId: string
  colorTaskId: string
}> {
  return page.evaluate(async () => {
    const styleRepository = await import('/src/data/pcs-style-archive-repository.ts')
    const engineeringRepository = await import('/src/data/pcs-engineering-master-repository.ts')
    const patternRepository = await import('/src/data/pcs-pattern-library.ts')
    const uploadRepository = await import('/src/data/pcs-engineering-task-upload-repository.ts')
    styleRepository.resetStyleArchiveRepository()
    engineeringRepository.resetEngineeringMasterRepository()
    patternRepository.resetPatternLibraryStore()
    uploadRepository.resetEngineeringTaskUploadRepository()
    const style = styleRepository.listStyleArchives().find((item) => item.mainImageUrl)
    if (!style) throw new Error('缺少带真实图片的款式档案演示数据')
    const draft = engineeringRepository.createEngineeringMasterOrder({
      styleId: style.styleId,
      styleCode: style.styleCode,
      merchandiserId: 'USER-MERCHANDISER',
      merchandiserName: '跟单-林晓',
      createdById: 'USER-MERCHANDISER',
      createdBy: '跟单-林晓',
      createdByRole: '跟单',
      preparationType: 'PURE_WOVEN',
      qualificationFact: {
        styleCode: style.styleCode,
        formalSaleStatus: 'NO_FORMAL_SALE',
        formalProductionStatus: 'NO_FORMAL_PRODUCTION',
        formalSaleSource: '正式销售订单事实',
        formalProductionSource: '正式生产单事实',
        checkedAt: '2026-08-12 09:00:00',
      },
      bulkProductionQualification: {
        basisType: 'TEST_APPROVED',
        triggerBusinessObjectType: '测款结果',
        triggerBusinessObjectId: `REVIEW-${style.styleCode}`,
        thresholdQuantity: 300,
        reachedQuantity: 320,
        reachedAt: '2026-08-12 09:00:00',
        reason: '已满足做大货要求',
        uniqueTriggerKey: `REVIEW-PLAYWRIGHT-${style.styleCode}`,
      },
      creationReason: '验证花型与调色任务审核',
    })
    const master = engineeringRepository.publishEngineeringMasterOrder(draft.masterOrderId)
    const plateTaskId = `${master.masterOrderId}-BASE_PATTERN_WOVEN`
    const patternTaskId = `${master.masterOrderId}-PATTERN_ARTWORK`
    const colorTaskId = `${master.masterOrderId}-COLOR_FABRIC`
    engineeringRepository.updateEngineeringTaskRecord(master.masterOrderId, plateTaskId, (task) => {
      task.status = '进行中'
      task.startedAt = '2026-08-12 09:10:00'
      task.events.startedAt = task.startedAt
      task.ownerTeamName = '版师'
    })
    engineeringRepository.updateEngineeringTaskRecord(master.masterOrderId, patternTaskId, (task) => {
      task.status = '进行中'
      task.startedAt = '2026-08-12 09:10:00'
      task.events.startedAt = task.startedAt
      task.ownerTeamName = '花型团队'
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
      task.startedAt = '2026-08-12 09:10:00'
      task.events.startedAt = task.startedAt
      task.ownerTeamName = '跟单'
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
    return { plateTaskId, patternTaskId, colorTaskId }
  })
}

test('制版任务必须真实上传 PRJ 和预览图后才能提交成果', async ({ page }) => {
  await page.goto('/')
  const seeded = await seedReviewTasks(page)
  await page.goto(`/pcs/patterns/plate-making/${seeded.plateTaskId}`)

  const form = page.locator(`[data-plate-form="${seeded.plateTaskId}"]`)
  await expect(form).toBeVisible()

  const sourceChooserPromise = page.waitForEvent('filechooser')
  await form.locator('label').filter({ hasText: '选择本地文件' }).nth(0).click()
  await (await sourceChooserPromise).setFiles({
    name: 'STYLE-PRJ-202604-013-base-pattern.prj',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('HiGood real PRJ browser upload evidence'),
  })
  await expect(form.getByText('STYLE-PRJ-202604-013-base-pattern.prj')).toBeVisible()

  const previewChooserPromise = page.waitForEvent('filechooser')
  await form.locator('label').filter({ hasText: '选择本地文件' }).nth(1).click()
  await (await previewChooserPromise).setFiles(FIRST_PREVIEW)
  await expect(form.getByText('dress-sample-1.jpg')).toBeVisible()

  await form.locator('[data-plate-field="sizes"]').fill('S, M, L')
  await form.locator('[data-plate-field="note"]').fill('梭织基码纸样首版成果')
  await form.getByRole('button', { name: '提交并完成任务' }).click()

  await expect(page.locator('[data-engineering-task-workbench]')).toContainText('已完成')
  await expect(page.getByRole('heading', { name: /v1\.0 · 基码纸样/ })).toBeVisible()
  await expect(page.getByRole('article').getByText('STYLE-PRJ-202604-013-base-pattern.prj')).toBeVisible()
  const storedResult = await page.evaluate((taskId) => {
    const values = JSON.parse(localStorage.getItem('higood:pcs:engineering-pattern-results:v1') || '[]')
    return values.find((item: { taskId?: string }) => item.taskId === taskId)
  }, seeded.plateTaskId)
  expect(storedResult?.sourceFiles?.[0]?.fileName).toBe('STYLE-PRJ-202604-013-base-pattern.prj')
  expect(storedResult?.sourceFiles?.[0]?.dataUrl).toMatch(/^data:application\/octet-stream;base64,/)
  expect(storedResult?.previewFiles?.[0]?.dataUrl).toMatch(/^data:image\//)
  const resultPreview = page.getByRole('button', { name: '查看 v1.0 纸样图 1 大图' })
  await resultPreview.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('调色任务按 BOM、跟单确认、染厂真实成果、买手审核四段衔接', async ({ page }) => {
  await page.goto('/')
  const seeded = await seedReviewTasks(page)
  await page.goto(`/pcs/engineering/color/${seeded.colorTaskId}`)

  await expect(page.getByRole('heading', { name: '1 BOM 染色物料' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '2 跟单确认' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '3 染厂成果与买手审核' })).toBeVisible()
  await expect(page.getByRole('button', { name: '提交本轮调色成果' })).toHaveCount(0)

  await page.getByRole('button', { name: '确认染色要求' }).click()
  await expect(page.getByRole('alert')).toContainText('缺少潘通色卡色号')

  for (const lineId of ['COLOR-LINE-1', 'COLOR-LINE-2']) {
    const row = page.locator(`[data-color-requirement-row="${lineId}"]`)
    await row.getByLabel('潘通色号').fill(lineId.endsWith('1') ? '18-1664' : '19-4052')
    await row.getByLabel('颜色名称').fill(lineId.endsWith('1') ? '正红' : '宝蓝')
    await row.getByLabel('染色色号').fill(lineId.endsWith('1') ? 'DYE-R01' : 'DYE-B01')
  }
  await page.getByRole('button', { name: '确认染色要求' }).click()

  await expect(page.getByText('已确认', { exact: false }).first()).toBeVisible()
  await expect(page.locator('[data-engineering-task-workbench]')).toContainText('染厂')

  for (const [index, lineId] of ['COLOR-LINE-1', 'COLOR-LINE-2'].entries()) {
    const row = page.locator(`[data-color-result-row="${lineId}"]`)
    await row.getByLabel('染厂').fill('合作染厂A')
    await row.locator('[data-color-upload-input]').setInputFiles(index === 0 ? FIRST_PREVIEW : SECOND_PREVIEW)
    await expect(row.getByText('已保存 1 个')).toBeVisible()
  }
  await page.getByRole('button', { name: '提交本轮调色成果' }).click()
  await expect(page.locator('[data-engineering-task-workbench]')).toContainText('待审核')
  await page.getByRole('button', { name: '全部通过' }).click()
  await expect(page.locator('[data-engineering-task-workbench]')).toContainText('已完成')
})

test('花型任务真实上传、逐项审核、失败原因和返工锁定均有效', async ({ page }) => {
  await page.goto('/')
  const seeded = await seedReviewTasks(page)
  await page.goto(`/pcs/patterns/artwork/${seeded.patternTaskId}`)

  for (const [index, lineId] of ['PATTERN-LINE-1', 'PATTERN-LINE-2'].entries()) {
    const row = page.locator(`[data-pattern-result-row="${lineId}"]`)
    const sourceFile = index === 0 ? FIRST_PREVIEW : SECOND_PREVIEW
    const previewFile = index === 0 ? SECOND_PREVIEW : FIRST_PREVIEW
    const sourceChooserPromise = page.waitForEvent('filechooser')
    await row.locator('label').filter({ hasText: '选择本地文件' }).nth(0).click()
    await (await sourceChooserPromise).setFiles(sourceFile)
    await expect(row.getByText(index === 0 ? 'dress-sample-1.jpg' : 'pants-sample.jpg')).toBeVisible()
    const previewChooserPromise = page.waitForEvent('filechooser')
    await row.locator('label').filter({ hasText: '选择本地文件' }).nth(1).click()
    await (await previewChooserPromise).setFiles(previewFile)
    await expect(row.getByText(index === 0 ? 'pants-sample.jpg' : 'dress-sample-1.jpg')).toBeVisible()
  }
  await page.getByRole('button', { name: '整单提交花型成果' }).click()

  await page.locator('[data-review-row="PATTERN-LINE-1"]').getByLabel('审核结论').selectOption('通过')
  await page.locator('[data-review-row="PATTERN-LINE-2"]').getByLabel('审核结论').selectOption('未通过')
  await page.getByRole('button', { name: '确认整单审核' }).click()
  await expect(page.getByRole('alert')).toContainText('必须填写未通过原因')

  await page.locator('[data-review-row="PATTERN-LINE-2"]').getByLabel('未通过原因').fill('花型边缘需要调整')
  await page.getByRole('button', { name: '确认整单审核' }).click()

  await expect(page.locator('[data-pattern-result-row="PATTERN-LINE-1"]')).toContainText('已通过，已锁定')
  await expect(page.locator('[data-pattern-result-row="PATTERN-LINE-1"] input')).toHaveCount(0)
  await expect(page.locator('[data-pattern-result-row="PATTERN-LINE-2"] input[type="file"]')).toHaveCount(2)
  await expect(page.locator('[data-pattern-result-row="PATTERN-LINE-2"]')).toContainText('花型边缘需要调整')

  const failedRow = page.locator('[data-pattern-result-row="PATTERN-LINE-2"]')
  const reworkSourceChooserPromise = page.waitForEvent('filechooser')
  await failedRow.locator('label').filter({ hasText: '选择本地文件' }).nth(0).click()
  await (await reworkSourceChooserPromise).setFiles(FIRST_PREVIEW)
  const reworkPreviewChooserPromise = page.waitForEvent('filechooser')
  await failedRow.locator('label').filter({ hasText: '选择本地文件' }).nth(1).click()
  await (await reworkPreviewChooserPromise).setFiles(FIRST_PREVIEW)
  await page.getByRole('button', { name: '整单提交花型成果' }).click()
  await expect(page.locator('[data-review-row="PATTERN-LINE-1"]')).toHaveCount(0)
  await expect(page.locator('[data-review-row="PATTERN-LINE-2"]')).toBeVisible()
})

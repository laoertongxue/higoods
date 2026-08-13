import path from 'node:path'

import { expect, test } from '@playwright/test'

const SAMPLE_IMAGE = path.resolve('public/dress-sample-1.jpg')

test('产前版样衣必须在专业任务详情开始、真实上传并提交完成', async ({ page }) => {
  await page.goto('/')
  const scenario = await page.evaluate(async () => {
    const styleRepository = await import('/src/data/pcs-style-archive-repository.ts')
    const engineeringRepository = await import('/src/data/pcs-engineering-master-repository.ts')
    const patternRepository = await import('/src/data/pcs-engineering-pattern-result.ts')
    const uploadRepository = await import('/src/data/pcs-engineering-task-upload-repository.ts')
    styleRepository.resetStyleArchiveRepository()
    engineeringRepository.resetEngineeringMasterRepository()
    uploadRepository.resetEngineeringTaskUploadRepository()
    const style = styleRepository.listStyleArchives().find((item) => item.mainImageUrl)
    if (!style) throw new Error('缺少带真实图片的款式档案演示数据')
    const master = engineeringRepository.createEngineeringMasterOrder({
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
        triggerBusinessObjectId: `SAMPLE-${style.styleCode}`,
        thresholdQuantity: 300,
        reachedQuantity: 320,
        reachedAt: '2026-08-12 09:00:00',
        reason: '已满足做大货要求',
        uniqueTriggerKey: `SAMPLE-PLAYWRIGHT-${style.styleCode}`,
      },
      creationReason: '验证产前版样衣真实成果提交',
    })
    const published = engineeringRepository.publishEngineeringMasterOrder(master.masterOrderId)
    const sample = published.tasks.find((task) => task.taskType === 'PRE_PRODUCTION_SAMPLE')
    if (!sample) throw new Error('工程主单未生成产前版样衣任务')
    for (const dependencyId of sample.dependsOnTaskIds) {
      const dependency = published.tasks.find((item) => item.taskId === dependencyId)
      if (!dependency) continue
      engineeringRepository.startEngineeringTask({ masterOrderId: master.masterOrderId, taskId: dependencyId, operatorId: 'PATTERN-01', operatorName: '版师-验收' })
      patternRepository.submitEngineeringPatternResult({
        masterOrderId: master.masterOrderId,
        taskId: dependencyId,
        applicableSizes: ['M'],
        sourceFiles: [{ fileId: `${dependencyId}-PRJ`, purpose: 'PATTERN_SOURCE', fileName: '验收纸样.prj', extension: 'prj', mimeType: 'application/octet-stream', sizeBytes: 8, dataUrl: 'data:application/octet-stream;base64,SElHT09E', status: '已保存', uploadedById: 'PATTERN-01', uploadedByName: '版师-验收', uploadedByTeam: '版师', uploadedAt: '2026-08-12 09:20:00', roundNo: 1, errorMessage: '' }],
        previewFiles: [{ fileId: `${dependencyId}-IMAGE`, purpose: 'PATTERN_PREVIEW', fileName: '验收纸样.jpg', extension: 'jpg', mimeType: 'image/jpeg', sizeBytes: 4, dataUrl: 'data:image/jpeg;base64,/9j/2Q==', status: '已保存', uploadedById: 'PATTERN-01', uploadedByName: '版师-验收', uploadedByTeam: '版师', uploadedAt: '2026-08-12 09:20:00', roundNo: 1, errorMessage: '' }],
        note: '产前版样衣验收前置纸样',
        submittedBy: '版师-验收',
      })
    }
    return {
      taskId: sample.taskId,
      requirementCount: sample.sampleRequirements?.length || 0,
      expectedTotal: (sample.sampleRequirements || []).reduce((sum, line) => sum + line.requiredQuantity, 0),
    }
  })

  await page.goto(`/pcs/samples/first-sample/${scenario.taskId}`)
  await expect(page.getByRole('button', { name: '开始任务' })).toBeVisible()
  await page.getByRole('button', { name: '开始任务' }).click()

  const resultForm = page.locator(`[data-first-sample-form="${scenario.taskId}"]`)
  await expect(resultForm).toBeVisible()
  await expect(resultForm.locator('[data-first-sample-result-row]')).toHaveCount(scenario.requirementCount)
  for (let index = 0; index < scenario.requirementCount; index += 1) {
    await resultForm.locator('[data-first-sample-upload-input]').nth(index).setInputFiles(SAMPLE_IMAGE)
  }
  await expect(resultForm.getByText('已保存 1 个')).toHaveCount(scenario.requirementCount)
  await resultForm.locator('[data-first-sample-field="sourcePatternVersion"]').all().then(async (inputs) => {
    for (const input of inputs) await input.selectOption({ index: 1 })
  })
  await resultForm.locator('[data-first-sample-field="productionNote"]').all().then(async (inputs) => {
    for (const input of inputs) await input.fill('按跟单要求制作')
  })

  await resultForm.locator('[data-first-sample-field="actualQuantity"]').first().fill('0')
  await resultForm.getByRole('button', { name: '提交成果并完成任务' }).click()
  await expect(page.getByRole('alert')).toContainText('实际数量必须为大于 0 的整数')
  await expect(resultForm.getByText('dress-sample-1.jpg')).toHaveCount(scenario.requirementCount)

  await resultForm.locator('[data-first-sample-field="actualQuantity"]').first().fill('1')
  await resultForm.getByRole('button', { name: '提交成果并完成任务' }).click()

  await expect(page.locator('[data-engineering-task-workbench]')).toContainText('已完成')
  await expect(page.getByText(`要求 ${scenario.expectedTotal} 件`, { exact: false })).toBeVisible()
  await expect(page.getByText('提交成果并完成任务')).toHaveCount(0)
  const uploadedImage = page.getByRole('button', { name: '产前版样衣成果图 1' })
  await uploadedImage.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

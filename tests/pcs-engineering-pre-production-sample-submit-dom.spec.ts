import path from 'node:path'

import { expect, test } from '@playwright/test'

const SAMPLE_IMAGE = path.resolve('public/dress-sample-1.jpg')

test('产前版样衣必须在专业任务详情开始、真实上传并提交完成', async ({ page }) => {
  await page.goto('/')
  const sampleTaskId = await page.evaluate(async () => {
    const styleRepository = await import('/src/data/pcs-style-archive-repository.ts')
    const engineeringRepository = await import('/src/data/pcs-engineering-master-repository.ts')
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
    engineeringRepository.updateEngineeringTaskRecord(master.masterOrderId, sample.taskId, (task, storedMaster) => {
      task.dependsOnTaskIds.forEach((dependencyId) => {
        const dependency = storedMaster.tasks.find((item) => item.taskId === dependencyId)
        if (!dependency) return
        dependency.status = '已完成'
        dependency.startedAt = dependency.startedAt || '2026-08-12 09:10:00'
        dependency.events.startedAt = dependency.events.startedAt || dependency.startedAt
        dependency.firstCompletedAt = dependency.firstCompletedAt || '2026-08-12 09:20:00'
        dependency.effectiveCompletedAt = dependency.effectiveCompletedAt || dependency.firstCompletedAt
        dependency.events.firstCompletedAt = dependency.events.firstCompletedAt || dependency.firstCompletedAt
        dependency.events.effectiveCompletedAt = dependency.events.effectiveCompletedAt || dependency.effectiveCompletedAt
      })
      task.status = '待开始'
    })
    return sample.taskId
  })

  await page.goto(`/pcs/samples/first-sample/${sampleTaskId}`)
  await expect(page.getByRole('button', { name: '开始任务' })).toBeVisible()
  await page.getByRole('button', { name: '开始任务' }).click()

  const resultForm = page.locator(`[data-first-sample-form="${sampleTaskId}"]`)
  await expect(resultForm).toBeVisible()
  await resultForm.locator('[data-first-sample-upload-input]').setInputFiles(SAMPLE_IMAGE)
  await expect(resultForm.getByText('已保存 1 个')).toBeVisible()

  await resultForm.locator('[data-first-sample-field="quantity"]').fill('0')
  await resultForm.getByRole('button', { name: '提交成果并完成任务' }).click()
  await expect(page.getByRole('alert')).toContainText('制作数量必须大于 0')
  await expect(resultForm.getByText('dress-sample-1.jpg')).toBeVisible()

  await resultForm.locator('[data-first-sample-field="quantity"]').fill('2')
  await resultForm.locator('[data-first-sample-field="note"]').fill('两件产前版样衣已完成')
  await resultForm.getByRole('button', { name: '提交成果并完成任务' }).click()

  await expect(page.locator('[data-engineering-task-workbench]')).toContainText('已完成')
  await expect(page.getByText('2 件')).toBeVisible()
  await expect(page.getByText('提交成果并完成任务')).toHaveCount(0)
  const uploadedImage = page.getByRole('button', { name: '产前版样衣成果图 1' })
  await uploadedImage.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

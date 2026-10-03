import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'

// Run against a freshly started current-worktree Vite service. This contract uses real
// IndexedDB and File/Blob APIs; localStorage quota mocks no longer model this workflow.
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  await page.addInitScript('globalThis.__name = (value) => value')
  await page.goto(`${process.env.PCS_CHECK_URL || 'http://127.0.0.1:5173'}/pcs/testing/orders`)
  await page.getByText('共 5 条，当前 1-5', { exact: true }).waitFor()
  const result = await page.evaluate(async () => {
    // @ts-ignore Browser module URLs are served by Vite.
    const rt = await import('/src/data/pcs-record-runtime.ts')
    // @ts-ignore Browser module URL.
    const db = await import('/src/data/pcs-record-db.ts')
    // @ts-ignore Browser module URL.
    const sampling = await import('/src/data/pcs-engineering-master-sampling.ts')
    // @ts-ignore Browser module URL.
    const uploads = await import('/src/data/pcs-engineering-task-upload-repository.ts')
    await rt.ensurePcsRecordState()
    const check = (value: unknown, message: string) => { if (!value) throw new Error(message) }
    const initial = sampling.captureEngineeringIndependentSamplingRepositoryState()
    const record = initial.records.find((item: any) => item.professionalTasks.some((task: any) => task.taskType === 'BASE_PATTERN'))
    const task = record.professionalTasks.find((item: any) => item.taskType === 'BASE_PATTERN')
    const actor = { userId: 'U-PATTERN-STORAGE', userName: '版师-测试', teamName: '版师' }
    const files = await uploads.uploadEngineeringTaskFiles({
      taskId: task.taskId, purpose: 'PATTERN_SOURCE', actor,
      files: [new File(['pattern-source'], 'pattern-base.prj', { type: 'application/octet-stream' })],
    })
    task.results[0].files = files
    task.results[0].imageUrl = files[0].dataUrl
    await rt.runPcsRecordCommand(() => sampling.restoreEngineeringIndependentSamplingRepositoryState(initial))
    const saved = await db.readPcsRecords()
    check(saved.files.length === 1 && await saved.files[0].blob.text() === 'pattern-source', 'original Blob missing')
    check(!JSON.stringify(saved.records).includes('data:') && !JSON.stringify(saved.records).includes('blob:'), 'file bytes/session URL persisted in business JSON')
    check(rt.PCS_LEGACY_KEYS.every((key: string) => localStorage.getItem(key) === null), 'business data still in localStorage')
    const before = JSON.stringify(sampling.getEngineeringIndependentSamplingRecord(record.samplingTaskId))
    const beforeUploads = JSON.stringify(uploads.listEngineeringTaskUploadedFiles(task.taskId, 'TASK', 'PATTERN_SOURCE'))
    const originalPut = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function () { throw new DOMException('quota exceeded', 'QuotaExceededError') }
    let uploadFailed = false
    try {
      await uploads.uploadEngineeringTaskFiles({ taskId: task.taskId, purpose: 'PATTERN_SOURCE', actor,
        files: [new File(['not-saved'], 'quota.prj', { type: 'application/octet-stream' })] })
    } catch { uploadFailed = true } finally { IDBObjectStore.prototype.put = originalPut }
    check(uploadFailed && JSON.stringify(uploads.listEngineeringTaskUploadedFiles(task.taskId, 'TASK', 'PATTERN_SOURCE')) === beforeUploads, 'upload failure polluted cache')
    const modified = sampling.captureEngineeringIndependentSamplingRepositoryState()
    modified.records.find((item: any) => item.samplingTaskId === record.samplingTaskId).creationReason = 'must roll back'
    IDBObjectStore.prototype.put = function () { throw new DOMException('quota exceeded', 'QuotaExceededError') }
    let failed = false
    try { await rt.runPcsRecordCommand(() => sampling.restoreEngineeringIndependentSamplingRepositoryState(modified)) }
    catch { failed = true } finally { IDBObjectStore.prototype.put = originalPut }
    check(failed && JSON.stringify(sampling.getEngineeringIndependentSamplingRecord(record.samplingTaskId)) === before, 'record failure polluted cache')
    // @ts-ignore Browser module URL.
    await import('/src/data/fcs/design-revision-process-work-order-adapter.ts')
    // @ts-ignore Browser module URL.
    const bom = await import('/src/data/pcs-engineering-bom-repository.ts')
    // @ts-ignore Browser module URL.
    const relations = await import('/src/data/pcs-project-relation-repository.ts')
    const reference = sampling.listEngineeringIndependentSamplingRecords().find((item) => item.targetStyleCode === 'STYLE-PRJ-202603-011' && item.status === 'COMPLETED')!
    const target = sampling.listEngineeringIndependentSamplingRecords().find((item) => item.targetStyleCode === 'STYLE-PRJ-202603-012')!
    const pattern = reference.professionalTasks.find((item) => item.taskType === 'BASE_PATTERN')!.results[0].files.find((file) => file.extension === 'prj')!
    const sampleImage = reference.professionalTasks.find((item) => item.taskType === 'DISPLAY_SAMPLE')!.results[0].files.find((file) => ['jpg', 'png'].includes(file.extension))!
    const buyer = { role: '买手', userId: target.buyerId, userName: target.buyerName }
    const draft = await rt.runPcsRecordCommand(() => sampling.createEngineeringIndependentSampling({
      sourceStyleId: reference.targetStyleId, targetStyleId: target.targetStyleId,
      creationReason: '验证样衣提交关联保存失败恢复', designFiles: target.designFiles,
      patternHandling: 'REUSE', reusedPatternFiles: [pattern], buyer,
      creationSampleRequirements: [{ targetColor: '整款', targetSize: 'M', requiredQuantity: 1, requirementNote: '' }],
    }))
    await rt.runPcsRecordCommand(() => bom.saveEngineeringBomPricingPlan({ ownerStage: 'INDEPENDENT_SAMPLING', ownerId: draft.samplingTaskId,
      ...buyer, customCostDecision: 'NO_CUSTOM_COST', customCosts: [] }))
    // Align the fixture with the material SKU's current explicit process attributes.
    // @ts-ignore Browser module URL.
    const material = await import('/src/data/pcs-design-revision-material-sku.ts')
    await rt.runPcsRecordCommand(() => {
      for (const versionId of draft.bomVersionIds) {
        const version = bom.getEngineeringBomVersionById(versionId)
        bom.saveEngineeringBomVersion({ versionId, ...buyer, materialLines: version.materialLines.map((line: any) => {
          const sku = material.resolveDesignRevisionMaterialSku(line.materialSkuId)
          return { ...line, dyeRequirement: sku.requiresDye ? '是' : '否', printRequirement: sku.requiresPrint ? '是' : '否', lossRate: 0 }
        }) })
      }
    })
    const active = await rt.runPcsRecordCommand(() => sampling.confirmEngineeringIndependentSamplingScheme({
      samplingTaskId: draft.samplingTaskId, actor: buyer,
      displaySampleAssignment: sampling.DESIGN_REVISION_DISPLAY_SAMPLE_ASSIGNMENTS[0],
      selectedTaskTypes: ['DISPLAY_SAMPLE'],
      sampleRequirements: [{ targetColor: '整款', targetSize: 'M', requiredQuantity: 1, requirementNote: '' }],
    }))
    const sample = active.professionalTasks[0]
    const submit = () => sampling.submitEngineeringIndependentProfessionalTask({
      taskId: sample.taskId, actor: { role: '管理员', userId: 'U-ADMIN', userName: '中央工厂' },
      results: [{ title: '演示样衣', requirementLineId: sample.sampleRequirements[0].requirementLineId,
        sampleQuantity: 1, sampleColor: '整款', sampleSize: 'M',
        sourcePatternVersion: sampling.listEngineeringIndependentAvailablePatternVersions(active)[0].value,
        description: '概念效果图，仅供 Mock 演示', files: [sampleImage] }],
    })

    const beforeSubmission = JSON.stringify(sampling.getEngineeringIndependentSamplingRecord(active.samplingTaskId))
    const beforeRelations = JSON.stringify(relations.getProjectRelationStoreSnapshot())
    let relationFailure = false
    IDBObjectStore.prototype.put = function (value: any, ...args: any[]) {
      if (this.name === 'records' && value.id?.startsWith('higood-pcs-project-relation-store-v2/')) {
        relationFailure = true
        throw new DOMException('relation write failed', 'QuotaExceededError')
      }
      return originalPut.call(this, value, ...args)
    }
    let rejected = false
    try { await rt.runPcsRecordCommand(submit) } catch { rejected = true } finally { IDBObjectStore.prototype.put = originalPut }
    check(relationFailure && rejected, 'must inject the actual linked record write failure')
    check(JSON.stringify(sampling.getEngineeringIndependentSamplingRecord(active.samplingTaskId)) === beforeSubmission, 'parent/result changed after linked failure')
    check(JSON.stringify(relations.getProjectRelationStoreSnapshot()) === beforeRelations, 'linked state changed after failure')
    const submitted = await rt.runPcsRecordCommand(submit)
    check(submitted.status === 'COMPLETED', 'retry did not finish sample result')
    check(sampling.getEngineeringIndependentSamplingRecord(active.samplingTaskId).professionalTasks[0].results.length === 1, 'retry duplicated results')
    return { taskId: task.taskId, fileId: files[0].fileId, samplingTaskId: record.samplingTaskId,
      bomIds: bom.captureEngineeringBomRepositoryState().records.map((item: any) => item.bomDraftVersionId).sort() }
  })
  await page.reload()
  await page.getByText('共 5 条，当前 1-5', { exact: true }).waitFor()
  const content = await page.evaluate(async ({ taskId, fileId }) => {
    // @ts-ignore Browser module URL.
    const uploads = await import('/src/data/pcs-engineering-task-upload-repository.ts')
    const file = uploads.listEngineeringTaskUploadedFiles(taskId, 'TASK', 'PATTERN_SOURCE').find((item: any) => item.fileId === fileId)
    return file ? (await fetch(file.dataUrl)).text() : null
  }, result)
  assert.equal(content, 'pattern-source', 'after reload original file must still be downloadable')
  const bomIds = await page.evaluate(async () => {
    // @ts-ignore Browser module URL.
    const bom = await import('/src/data/pcs-engineering-bom-repository.ts')
    return bom.captureEngineeringBomRepositoryState().records.map((item: any) => item.bomDraftVersionId).sort()
  })
  assert.deepEqual(bomIds, result.bomIds, 'refresh must keep static and modified BOM identities without duplicates')
  console.log('PCS 设计改款原文件、IndexedDB 写入失败回滚和刷新读取：通过')
} finally { await browser.close() }

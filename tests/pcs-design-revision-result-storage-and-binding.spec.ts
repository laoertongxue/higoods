import assert from 'node:assert/strict'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  failKey = ''
  failWhen: ((key: string, value: string) => boolean) | null = null
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) {
    if (key === this.failKey || this.failWhen?.(key, value)) throw new DOMException('quota exceeded', 'QuotaExceededError')
    this.values.set(key, value)
  }
}

const storage = new MemoryStorage()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })

const sampling = await import('../src/data/pcs-engineering-master-sampling.ts')
const uploads = await import('../src/data/pcs-engineering-task-upload-repository.ts')

sampling.resetEngineeringIndependentSamplingRepository(true)
uploads.resetEngineeringTaskUploadRepository()
const initial = sampling.captureEngineeringIndependentSamplingRepositoryState()
const record = initial.records.find((item) => item.professionalTasks.some((task) => task.taskType === 'BASE_PATTERN'))
assert.ok(record, '演示数据应含基码纸样任务')
const task = record.professionalTasks.find((item) => item.taskType === 'BASE_PATTERN')!
const actor = { userId: 'U-PATTERN-STORAGE', userName: '版师-测试', teamName: '版师' }
const previews = await uploads.uploadEngineeringTaskFiles({
  taskId: task.taskId,
  purpose: 'PATTERN_PREVIEW',
  actor,
  files: [new File(['pattern-preview'], 'pattern-front.png', { type: 'image/png' })],
})
const sources = await uploads.uploadEngineeringTaskFiles({
  taskId: task.taskId, purpose: 'PATTERN_SOURCE', actor,
  files: [new File(['pattern-source'], 'pattern-base.prj', { type: 'application/octet-stream' })],
})
const files = [...previews, ...sources]
task.results[0].files = files
task.results[0].imageUrl = files[0].dataUrl
sampling.restoreEngineeringIndependentSamplingRepositoryState(initial)

assert.match(storage.getItem('higood-pcs-engineering-task-uploads-v1') || '', /data:image\/png;base64,/,
  '实际文件正文只存在上传仓库')
assert.doesNotMatch(storage.getItem('higood-pcs-design-revision-v1') || '', /data:image\/png;base64,/,
  '设计改款任务只保存成果文件引用')
const reloaded = sampling.getEngineeringIndependentSamplingRecord(record.samplingTaskId)!
const reloadedFiles = reloaded.professionalTasks.find((item) => item.taskId === task.taskId)!.results[0].files
assert.equal(reloadedFiles.length, 2)
assert.ok(reloadedFiles.every((file) => file.dataUrl.startsWith('data:')),
  '重新读取后纸样文件可查看和下载')

const uploadsBeforeFailure = uploads.listEngineeringTaskUploadedFiles(task.taskId, 'TASK', 'PATTERN_SOURCE')
storage.failKey = 'higood-pcs-engineering-task-uploads-v1'
await assert.rejects(
  () => uploads.uploadEngineeringTaskFiles({
    taskId: task.taskId, purpose: 'PATTERN_SOURCE', actor,
    files: [new File(['must-not-stick'], 'quota-failure.prj', { type: 'application/octet-stream' })],
  }),
  /浏览器存储空间不足/,
)
storage.failKey = ''
assert.deepEqual(uploads.listEngineeringTaskUploadedFiles(task.taskId, 'TASK', 'PATTERN_SOURCE'), uploadsBeforeFailure,
  '上传失败不能污染仓库内存状态')

const before = sampling.getEngineeringIndependentSamplingRecord(record.samplingTaskId)!
const failed = sampling.captureEngineeringIndependentSamplingRepositoryState()
failed.records.find((item) => item.samplingTaskId === record.samplingTaskId)!.creationReason = '不应进入内存的失败写入'
storage.failKey = 'higood-pcs-design-revision-v1'
assert.throws(() => sampling.restoreEngineeringIndependentSamplingRepositoryState(failed), /浏览器存储空间不足.*未保存/)
storage.failKey = ''
assert.equal(sampling.getEngineeringIndependentSamplingRecord(record.samplingTaskId)!.creationReason, before.creationReason,
  '任务持久化失败不能污染当前页面内存状态')

await import('../src/data/fcs/design-revision-process-work-order-adapter.ts')
const bom = await import('../src/data/pcs-engineering-bom-repository.ts')
const relations = await import('../src/data/pcs-project-relation-repository.ts')
const reference = sampling.listEngineeringIndependentSamplingRecords().find((item) => item.targetStyleCode === 'STYLE-PRJ-202603-011' && item.status === 'COMPLETED')!
const target = sampling.listEngineeringIndependentSamplingRecords().find((item) => item.targetStyleCode === 'STYLE-PRJ-202603-012')!
const pattern = reference.professionalTasks.find((item) => item.taskType === 'BASE_PATTERN')!.results[0].files.find((file) => file.extension === 'prj')!
const sampleImage = reference.professionalTasks.find((item) => item.taskType === 'DISPLAY_SAMPLE')!.results[0].files.find((file) => ['jpg', 'png'].includes(file.extension))!
const buyer = { role: '买手', userId: target.buyerId, userName: target.buyerName }
const draft = sampling.createEngineeringIndependentSampling({
  sourceStyleId: reference.targetStyleId, targetStyleId: target.targetStyleId,
  creationReason: '验证样衣提交关联保存失败恢复', designFiles: target.designFiles,
  patternHandling: 'REUSE', reusedPatternFiles: [pattern], buyer,
  creationSampleRequirements: [{ targetColor: '整款', targetSize: 'M', requiredQuantity: 1, requirementNote: '' }],
})
bom.saveEngineeringBomPricingPlan({ ownerStage: 'INDEPENDENT_SAMPLING', ownerId: draft.samplingTaskId,
  ...buyer, customCostDecision: 'NO_CUSTOM_COST', customCosts: [] })
const active = sampling.confirmEngineeringIndependentSamplingScheme({
  samplingTaskId: draft.samplingTaskId, actor: buyer,
  displaySampleAssignment: sampling.DESIGN_REVISION_DISPLAY_SAMPLE_ASSIGNMENTS[0],
  selectedTaskTypes: ['DISPLAY_SAMPLE'],
  sampleRequirements: [{ targetColor: '整款', targetSize: 'M', requiredQuantity: 1, requirementNote: '' }],
})
const sample = active.professionalTasks[0]
const submit = () => sampling.submitEngineeringIndependentProfessionalTask({
  taskId: sample.taskId, actor: { role: '管理员', userId: 'U-ADMIN', userName: '中央工厂' },
  results: [{ title: '演示样衣', requirementLineId: sample.sampleRequirements[0].requirementLineId,
    sampleQuantity: 1, sampleColor: '整款', sampleSize: 'M',
    sourcePatternVersion: sampling.listEngineeringIndependentAvailablePatternVersions(active)[0].value,
    description: '概念效果图，仅供 Mock 演示', files: [sampleImage] }],
})
const beforeSubmission = sampling.getEngineeringIndependentSamplingRecord(active.samplingTaskId)!
const beforeRelations = relations.getProjectRelationStoreSnapshot()
const persistedBefore = storage.getItem('higood-pcs-design-revision-v1')
let relationStorageBroken = false
storage.failWhen = (key, value) => {
  if (key !== 'higood-pcs-project-relation-store-v2') return false
  if (JSON.parse(value).relations.some((item: { sourceObjectId: string; sourceStatus: string }) =>
    item.sourceObjectId === active.samplingTaskId && item.sourceStatus === 'COMPLETED')) relationStorageBroken = true
  return relationStorageBroken
}
assert.throws(submit, /quota exceeded|未提交/)
assert.equal(relationStorageBroken, true, '必须真正触发完成后的关联存储失败')
assert.equal(storage.getItem('higood-pcs-design-revision-v1'), persistedBefore, '关联存储持续失败时，也必须回滚父任务和样衣成果')
storage.failWhen = null
assert.deepEqual(sampling.getEngineeringIndependentSamplingRecord(active.samplingTaskId), beforeSubmission)
assert.deepEqual(relations.getProjectRelationStoreSnapshot(), beforeRelations)
assert.equal(submit().status, 'COMPLETED', '存储恢复后允许重新提交')
const afterRetry = sampling.getEngineeringIndependentSamplingRecord(active.samplingTaskId)!
assert.equal(afterRetry.professionalTasks[0].results.length, 1, '重试不能重复生成成果')

console.log('PCS 设计改款纸样成果文件与存储原子性专项契约：通过')

import assert from 'node:assert/strict'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  failKey = ''
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) {
    if (key === this.failKey) throw new DOMException('quota exceeded', 'QuotaExceededError')
    this.values.set(key, value)
  }
}

const storage = new MemoryStorage()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })

await import('../src/data/fcs/design-revision-process-work-order-adapter.ts')
const sampling = await import('../src/data/pcs-engineering-master-sampling.ts')
const uploads = await import('../src/data/pcs-engineering-task-upload-repository.ts')
const processPort = await import('../src/data/pcs-design-revision-process-work-order-port.ts')

const actor = { userId: 'U-ART-STORAGE', userName: '花型员-测试', teamName: '花型团队' }

sampling.resetEngineeringIndependentSamplingRepository(true)
uploads.resetEngineeringTaskUploadRepository()
const state = sampling.captureEngineeringIndependentSamplingRepositoryState()
const record = state.records.find((item) => item.professionalTasks.some((task) => task.taskType === 'PATTERN_ARTWORK'))!
const task = record.professionalTasks.find((item) => item.taskType === 'PATTERN_ARTWORK')!
const files = await uploads.uploadEngineeringTaskFiles({
  taskId: task.taskId,
  purpose: 'PATTERN_ARTWORK',
  actor,
  files: [
    new File(['preview-image'], 'flower-front.png', { type: 'image/png' }),
    new File(['source-file'], 'flower-source.ai', { type: 'application/postscript' }),
    new File(['back-preview'], 'flower-back.png', { type: 'image/png' }),
  ],
})
task.results = [{
  resultId: `${task.taskId}-RESULT-STORAGE`, title: '花型成果', version: '1.0', description: '正反面与源文件', applicablePartOrSize: '',
  sampleQuantity: 0, sampleColor: '', sampleSize: '', sourcePatternVersion: '', imageUrl: files[0].dataUrl,
  files, status: 'WAIT_REVIEW', rejectReason: '',
}]
task.status = 'WAIT_REVIEW'
sampling.restoreEngineeringIndependentSamplingRepositoryState(state)

const taskUploadRaw = storage.getItem('higood-pcs-engineering-task-uploads-v1') || ''
const designRevisionRaw = storage.getItem('higood-pcs-design-revision-v1') || ''
assert.match(taskUploadRaw, /data:image\/png;base64,/, '真实文件正文必须只保存在上传仓库')
assert.doesNotMatch(designRevisionRaw, /data:image\/png;base64,/, '设计改款记录不得重复保存专业成果文件正文')
const reloaded = sampling.getEngineeringIndependentSamplingRecord(record.samplingTaskId)!
const reloadedFiles = reloaded.professionalTasks.find((item) => item.taskId === task.taskId)!.results[0].files
assert.equal(reloadedFiles.length, 3, '重新读取后仍应恢复全部花型成果文件')
assert.ok(reloadedFiles.every((file) => file.dataUrl.startsWith('data:')), '重新读取后文件引用必须恢复为可查看、可下载的真实内容')

const uploadsBeforeQuotaFailure = uploads.listEngineeringTaskUploadedFiles(task.taskId, 'TASK', 'PATTERN_ARTWORK')
storage.failKey = 'higood-pcs-engineering-task-uploads-v1'
await assert.rejects(
  () => uploads.uploadEngineeringTaskFiles({
    taskId: task.taskId,
    purpose: 'PATTERN_ARTWORK',
    actor,
    files: [new File(['must-not-stick'], 'quota-failure.png', { type: 'image/png' })],
  }),
  /浏览器存储空间不足/,
  '文件仓库写满时必须返回明确错误',
)
storage.failKey = ''
assert.deepEqual(
  uploads.listEngineeringTaskUploadedFiles(task.taskId, 'TASK', 'PATTERN_ARTWORK'),
  uploadsBeforeQuotaFailure,
  '文件持久化失败时不得提前污染上传仓库内存状态',
)

const before = sampling.getEngineeringIndependentSamplingRecord(record.samplingTaskId)!
const failedState = sampling.captureEngineeringIndependentSamplingRepositoryState()
failedState.records.find((item) => item.samplingTaskId === record.samplingTaskId)!.creationReason = '不应进入内存的失败写入'
storage.failKey = 'higood-pcs-design-revision-v1'
assert.throws(
  () => sampling.restoreEngineeringIndependentSamplingRepositoryState(failedState),
  /浏览器存储空间不足.*未保存/,
  '存储空间不足时必须返回可执行的中文提示',
)
storage.failKey = ''
assert.equal(
  sampling.getEngineeringIndependentSamplingRecord(record.samplingTaskId)!.creationReason,
  before.creationReason,
  '持久化失败时不得提前污染当前页面内存状态',
)

const transaction = processPort.prepareDesignRevisionProcessWorkOrders({
  designRevisionTaskId: 'ES-DR-BINDING-DETAIL', designRevisionTaskNo: 'ES-DR-BINDING-DETAIL', targetSpuCode: 'TEMP-BINDING', targetSpuName: '绑定诊断款',
  createdAt: '2026-09-16 10:00:00', createdBy: '买手-测试', receivingTeamId: 'TEAM-SAMPLE', receivingTeamName: '制作团队',
  receivingFactoryId: 'ID-F014', receivingFactoryName: 'CV Satellite Tangerang Barat', receivingLocationId: 'LOC-SAMPLE', receivingLocationName: '样衣区',
  lines: [{
    processType: 'PRINTING', professionalTaskId: 'TASK-ART-BINDING', professionalTaskNo: '花型任务-绑定诊断', targetSpuImageUrl: files[0].dataUrl,
    targetColorId: 'COLOR-01', targetColor: '整款', bomVersionId: 'BOM-01', bomVersionLabel: 'BOM V1', bomItemId: 'LINE-01',
    materialId: 'MAT-01', materialSkuId: 'SKU-01', materialSkuCode: 'SKU-01', materialName: '测试面料', materialType: 'fabric',
    materialReceivingKind: 'FABRIC', materialImageUrl: '/products/fabric-cotton-blue.jpg', materialComposition: '100% 棉', materialSpecification: '150cm', plannedQty: 1, qtyUnit: '米',
  }],
})
const ref = transaction.commit()[0]
const staleRef = { ...ref, sourceKey: 'LEGACY-SOURCE-KEY' }
processPort.bindDesignRevisionApprovedProfessionalResult({
  designRevisionTaskId: 'ES-DR-BINDING-DETAIL', professionalTaskId: 'TASK-ART-BINDING', professionalResultId: 'ART-RESULT-01', professionalResultVersion: '1.0',
  approvedAt: '2026-09-16 10:10:00', approvedBy: '买手-测试', attachments: files, processWorkOrderRefs: [staleRef],
})
assert.equal(staleRef.sourceKey, ref.sourceKey, '旧来源键在任务归属一致时应自动校正为加工单当前来源键')
assert.doesNotMatch(
  storage.getItem('higoods.formal-print-execution.v1') || '',
  /data:application\/postscript;base64,c291cmNlLWZpbGU=/,
  '印花加工单持久化不得再次复制花型源文件正文',
)
const persistedPrint = storage.getItem('higoods.formal-print-execution.v1') || ''
assert.doesNotMatch(
  persistedPrint,
  /data:image\/png;base64,cHJldmlldy1pbWFnZQ==/,
  '印花加工单的成果附件和业务视图不得重复保存花型预览图正文',
)

assert.throws(() => processPort.bindDesignRevisionApprovedProfessionalResult({
  designRevisionTaskId: 'ES-DR-OTHER', professionalTaskId: 'TASK-ART-BINDING', professionalResultId: 'ART-RESULT-02', professionalResultVersion: '1.1',
  approvedAt: '2026-09-16 10:11:00', approvedBy: '买手-测试', attachments: files, processWorkOrderRefs: [ref],
}), /印花加工单.*所属设计改款任务.*ES-DR-BINDING-DETAIL/, '来源不一致必须指出具体单据和冲突字段')

assert.throws(() => processPort.bindDesignRevisionApprovedProfessionalResult({
  designRevisionTaskId: 'ES-DR-BINDING-DETAIL', professionalTaskId: 'TASK-ART-BINDING', professionalResultId: 'ART-RESULT-03', professionalResultVersion: '1.2',
  approvedAt: '2026-09-16 10:12:00', approvedBy: '买手-测试', attachments: files,
  processWorkOrderRefs: [{ processType: 'PRINTING', processOrderId: 'PRINT-NOT-FOUND', sourceKey: 'MISSING' }],
}), /未找到印花加工单.*重新生成加工单关联/, '加工单缺失必须给出明确恢复动作')

const repairState = sampling.captureEngineeringIndependentSamplingRepositoryState()
const repairRecord = repairState.records.find((item) => item.samplingTaskId === record.samplingTaskId)!
const repairTask = repairRecord.professionalTasks.find((item) => item.taskId === task.taskId)!
repairTask.processWorkOrderRefs = [{
  processType: 'PRINTING', processOrderId: 'PRINT-MISSING-REPAIR', processOrderCode: '', sourceKey: 'MISSING',
  targetColor: '整款', bomVersionId: repairRecord.bomVersionIds[0] || '', bomItemId: 'MISSING', materialSkuId: 'MISSING', prerequisiteProcessOrderId: '',
}]
sampling.restoreEngineeringIndependentSamplingRepositoryState(repairState)
assert.throws(
  () => sampling.reviewEngineeringIndependentProfessionalTask({
    taskId: repairTask.taskId,
    actor: { role: '管理员', userId: 'ADMIN-REVIEW', userName: '管理员（代操作）' },
    decisions: repairTask.results.map((result) => ({ resultId: result.resultId, approved: true })),
    reviewedAt: '2026-09-16 10:15:00',
  }),
  /未找到印花加工单.*重新生成加工单关联/,
  '审核时发现失效加工单必须阻断，并提供恢复动作',
)
assert.equal(
  sampling.getEngineeringIndependentSamplingRecord(repairRecord.samplingTaskId)!.professionalTasks.find((item) => item.taskId === repairTask.taskId)!.status,
  'WAIT_REVIEW',
  '加工单绑定失败时不得把专业成果误标为已通过',
)
repairRecord.professionalTasks.push({
  ...structuredClone(repairTask),
  taskId: `${repairRecord.samplingTaskId}-DISPLAY-SAMPLE-REPAIR`,
  taskType: 'DISPLAY_SAMPLE',
  taskName: '销售展示样衣任务',
  processWorkOrderRefs: [],
  results: [],
  sampleRequirements: [{
    requirementLineId: `${repairRecord.samplingTaskId}-DISPLAY-REQ-REPAIR`,
    targetColor: '整款',
    targetSize: 'M',
    requiredQuantity: 1,
    requirementNote: '加工单恢复验收',
  }],
})
sampling.restoreEngineeringIndependentSamplingRepositoryState(repairState)
const repaired = sampling.repairEngineeringIndependentProfessionalTaskProcessOrders({
  taskId: repairTask.taskId,
  actor: { role: '管理员', userId: 'ADMIN-REPAIR', userName: '管理员（代操作）' },
  repairedAt: '2026-09-16 10:20:00',
})
const repairedRefs = repaired.professionalTasks.find((item) => item.taskId === repairTask.taskId)!.processWorkOrderRefs
assert.ok(repairedRefs.every((item) => item.processOrderId !== 'PRINT-MISSING-REPAIR'), '恢复后不得残留失效加工单引用')
assert.match(repaired.operationLogs[0].action, /修复加工单关联/, '恢复动作必须留下可追溯操作记录')

console.log('PCS 设计改款成果多文件、存储原子性与加工单绑定诊断专项契约：通过')

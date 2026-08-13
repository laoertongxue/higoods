import assert from 'node:assert/strict'

import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  createEngineeringMasterOrder,
  getEngineeringMasterOrderById,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
} from '../src/data/pcs-engineering-master-repository.ts'
import { submitEngineeringPatternResult } from '../src/data/pcs-engineering-pattern-result.ts'
import {
  renderPcsFirstSampleTaskDetailPage,
  submitEngineeringFirstSampleResult,
} from '../src/pages/pcs-engineering-tasks/first-sample-task.ts'
import { startEngineeringTaskFromDetail } from '../src/pages/pcs-engineering-tasks/master-task-common.ts'

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, String(value)) },
    removeItem: (key: string) => { storage.delete(key) },
    clear: () => { storage.clear() },
  },
})

resetStyleArchiveRepository()
resetEngineeringMasterRepository()

const style = listStyleArchives()[0]
assert.ok(style)
const master = publishEngineeringMasterOrder(createEngineeringMasterOrder({
  styleId: style.styleId,
  styleCode: style.styleCode,
  merchandiserId: 'USER-MERCHANDISER',
  merchandiserName: '跟单A',
  createdById: 'USER-MERCHANDISER',
  createdBy: '跟单A',
  createdByRole: '跟单',
  preparationType: 'PURE_WOVEN',
  qualificationFact: {
    styleCode: style.styleCode,
    formalSaleStatus: 'NO_FORMAL_SALE',
    formalProductionStatus: 'NO_FORMAL_PRODUCTION',
    formalSaleSource: '正式销售订单事实',
    formalProductionSource: '正式生产单事实',
    checkedAt: '2026-08-13 09:00:00',
  },
  bulkProductionQualification: {
    basisType: 'TEST_APPROVED',
    triggerBusinessObjectType: '测款结果',
    triggerBusinessObjectId: `FIRST-SAMPLE-${style.styleCode}`,
    thresholdQuantity: 300,
    reachedQuantity: 320,
    reachedAt: '2026-08-13 09:00:00',
    reason: '已满足做大货要求',
    uniqueTriggerKey: `FIRST-SAMPLE-${style.styleCode}`,
  },
  creationReason: '验证产前版样衣逐行实际交付',
}).masterOrderId)

const basePatternTaskId = `${master.masterOrderId}-BASE_PATTERN_WOVEN`
startEngineeringTaskFromDetail(basePatternTaskId)
const patternVersion = submitEngineeringPatternResult({
  masterOrderId: master.masterOrderId,
  taskId: basePatternTaskId,
  applicableSizes: ['M'],
  sourceFiles: [{ fileId: `${basePatternTaskId}-PRJ`, purpose: 'PATTERN_SOURCE', fileName: '样衣基码纸样.prj', extension: 'prj', mimeType: 'application/octet-stream', sizeBytes: 8, dataUrl: 'data:application/octet-stream;base64,SElHT09E', status: '已保存', uploadedById: 'PATTERN-01', uploadedByName: '版师负责人', uploadedByTeam: '版师', uploadedAt: '2026-08-13 10:00:00', roundNo: 1, errorMessage: '' }],
  previewFiles: [{ fileId: `${basePatternTaskId}-IMAGE`, purpose: 'PATTERN_PREVIEW', fileName: '样衣基码纸样.jpg', extension: 'jpg', mimeType: 'image/jpeg', sizeBytes: 4, dataUrl: 'data:image/jpeg;base64,/9j/2Q==', status: '已保存', uploadedById: 'PATTERN-01', uploadedByName: '版师负责人', uploadedByTeam: '版师', uploadedAt: '2026-08-13 10:00:00', roundNo: 1, errorMessage: '' }],
  note: '产前版样衣逐行交付验证',
  submittedBy: '版师负责人',
})
const sourcePatternVersion = `${patternVersion.materialKind}${patternVersion.patternKind} ${patternVersion.versionLabel}`

const taskId = `${master.masterOrderId}-PRE_PRODUCTION_SAMPLE`
startEngineeringTaskFromDetail(taskId)
const sampleTask = master.tasks.find((task) => task.taskId === taskId)
assert.ok(sampleTask)
const requirements = sampleTask.sampleRequirements || []
assert.ok(requirements.length > 0)
const imageUrl = style.mainImageUrl
const makeActuals = () => requirements.map((requirement, index) => ({
  actualLineId: `${taskId}-TEST-ACTUAL-${index + 1}`,
  requirementLineId: requirement.requirementLineId,
  actualColor: requirement.targetColor,
  actualSize: requirement.targetSize,
  actualQuantity: requirement.requiredQuantity,
  sourcePatternVersion,
  productionNote: '按跟单要求制作',
  differenceNote: '',
  imageFileIds: [imageUrl],
  submittedBy: '制作团队A',
}))
assert.throws(
  () => submitEngineeringFirstSampleResult(taskId, {
    sampleActuals: makeActuals().map((line, index) => index === 0 ? { ...line, imageFileIds: [] } : line),
  }),
  /必须上传真实样衣图片/,
)
assert.throws(
  () => submitEngineeringFirstSampleResult(taskId, {
    sampleActuals: makeActuals().map((line, index) => index === 0 ? { ...line, actualQuantity: 0 } : line),
  }),
  /实际数量必须为大于 0 的整数/,
)
assert.throws(
  () => submitEngineeringFirstSampleResult(taskId, {
    sampleActuals: makeActuals().map((line, index) => index === 0 ? { ...line, submittedBy: '   ' } : line),
  }),
  /请填写产前版样衣成果提交人/,
)
const submitted = submitEngineeringFirstSampleResult(taskId, {
  sampleActuals: makeActuals(),
})

assert.equal(submitted.status, '已完成')
assert.equal(submitted.sampleActuals?.length, requirements.length)
assert.equal(submitted.resultImageIds.length, requirements.length)
assert.equal(submitted.resultQuantity, requirements.reduce((sum, line) => sum + line.requiredQuantity, 0))
assert.equal(submitted.resultSubmittedBy, '制作团队A')
assert.ok(submitted.submittedAt)
assert.ok(submitted.startedAt)

const stored = getEngineeringMasterOrderById(master.masterOrderId)?.tasks.find((task) => task.taskId === taskId)
assert.deepEqual(stored, submitted)

const html = renderPcsFirstSampleTaskDetailPage(taskId)
assert.match(html, /已完成/)
assert.match(html, new RegExp(`要求 ${requirements.reduce((sum, line) => sum + line.requiredQuantity, 0)} 件`))
assert.match(html, /样衣实际交付/)
assert.doesNotMatch(html, /验收|待确认|确认人|首单复用|需改版/)

console.log('pcs-first-sample-engineering-result.spec.ts PASS')

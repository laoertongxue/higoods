import assert from 'node:assert/strict'

import { getStyleArchiveById, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  createEngineeringMasterOrder,
  confirmEngineeringMasterTaskPlan,
  getEngineeringMasterOrderById,
  listEngineeringMasterPriorResultCandidates,
  resetEngineeringMasterRepository,
} from '../src/data/pcs-engineering-master-repository.ts'
import {
  listEngineeringIndependentSamplingRecords,
  resetEngineeringIndependentSamplingRepository,
} from '../src/data/pcs-engineering-master-sampling.ts'
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
resetEngineeringIndependentSamplingRepository(true)
resetEngineeringMasterRepository()

const designRevision = listEngineeringIndependentSamplingRecords().find((record) =>
  record.status === 'COMPLETED' && record.targetMode === 'ARCHIVED_STYLE'
  && (record.patternHandling === 'REUSE' || record.professionalTasks.some((task) => task.taskType === 'BASE_PATTERN' && task.status === 'COMPLETED')),
)
assert.ok(designRevision, '应存在已完成且含真实基码纸样的设计改款')
const style = getStyleArchiveById(designRevision.targetStyleId)
assert.ok(style?.mainImageUrl, '设计改款目标款应有真实图片')

const master = createEngineeringMasterOrder({
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
    checkedAt: '2026-08-04 09:00:00',
  },
  bulkProductionQualification: {
    basisType: 'TEST_APPROVED',
    triggerBusinessObjectType: '测款结果',
    triggerBusinessObjectId: designRevision.samplingTaskId,
    thresholdQuantity: 300,
    reachedQuantity: 320,
    reachedAt: '2026-08-04 09:00:00',
    reason: '已满足做大货要求',
    uniqueTriggerKey: `TEST-SAMPLE-${style.styleCode}`,
  },
  creationReason: '验证首单样衣专业任务',
})
const baseCandidate = listEngineeringMasterPriorResultCandidates(style.styleCode, 'PURE_WOVEN', designRevision.samplingTaskId)
  .find((candidate) => candidate.engineeringTaskType === 'BASE_PATTERN_WOVEN')
assert.ok(baseCandidate, '生产准备必须承接同一张设计改款的基码纸样')
const published = confirmEngineeringMasterTaskPlan(master.masterOrderId, {
  confirmedBy: '跟单-林晓',
  confirmedById: 'USER-MERCHANDISER',
  confirmedByRole: '跟单',
  selectedConditionalTaskTypes: [],
  priorResultDecisions: [{
    engineeringTaskType: 'BASE_PATTERN_WOVEN',
    sourceSamplingTaskId: baseCandidate.source.samplingTaskId,
    sourceProfessionalTaskId: baseCandidate.source.professionalTaskId,
    sourceResultVersion: baseCandidate.source.resultVersion,
    decision: '复用',
  }],
  preProductionSampleRequirements: [
    { targetColor: 'Black', targetSize: 'M', requiredQuantity: 2, requirementNote: '产前确认主色，制作 2 件' },
    { targetColor: 'White', targetSize: 'L', requiredQuantity: 1, requirementNote: '产前确认辅助色，制作 1 件' },
  ],
})
const sampleTask = published.tasks.find((task) => task.taskType === 'PRE_PRODUCTION_SAMPLE')
assert.ok(sampleTask)
assert.equal(published.tasks.some((task) => task.taskType === 'BASE_PATTERN_WOVEN' && task.status !== '未启用'), false)
const sourcePatternVersion = `梭织基码纸样 ${baseCandidate.source.resultVersion}`

let html = renderPcsFirstSampleTaskDetailPage(sampleTask.taskId)
assert.match(html, /开始任务/, '前置完成后必须从专业任务详情开始执行')
assert.doesNotMatch(html, /open-task-drawer|submit-pre-production-sample-result/, '不得恢复生产准备单旧抽屉提交入口')

startEngineeringTaskFromDetail(sampleTask.taskId)
html = renderPcsFirstSampleTaskDetailPage(sampleTask.taskId)
assert.match(html, /跟单下达的制作要求/)
assert.match(html, /提交本次实际交付/)
assert.match(html, /提交成果并完成任务/)
assert.doesNotMatch(html, /提交人.*<input/, '提交人应从任务负责人自动记录，不允许页面手填')

const requirements = sampleTask.sampleRequirements || []
assert.ok(requirements.length > 1, '演示主单应按多个颜色尺码下达制作要求')
const makeActuals = () => requirements.map((requirement, index) => ({
  requirementLineId: requirement.requirementLineId,
  actualColor: requirement.targetColor,
  actualSize: requirement.targetSize,
  actualQuantity: requirement.requiredQuantity,
  sourcePatternVersion,
  productionNote: requirement.requirementNote || '按制作要求完成',
  differenceNote: '',
  imageFileIds: [style.mainImageUrl],
  submittedBy: sampleTask.assigneeName || '制作团队负责人',
  actualLineId: `${sampleTask.taskId}-TEST-ACTUAL-${index + 1}`,
}))

assert.throws(
  () => submitEngineeringFirstSampleResult(sampleTask.taskId, {
    sampleActuals: makeActuals().map((line, index) => index === 0 ? { ...line, sourcePatternVersion: '不存在的纸样 v9.9' } : line),
  }),
  /只能选择已完成的基码纸样版本/,
)
assert.throws(
  () => submitEngineeringFirstSampleResult(sampleTask.taskId, {
    sampleActuals: makeActuals().map((line, index) => index === 0 ? { ...line, imageFileIds: [] } : line),
  }),
  /每行首单样衣实际交付必须上传真实样衣图片/,
)
assert.throws(
  () => submitEngineeringFirstSampleResult(sampleTask.taskId, {
    sampleActuals: makeActuals().map((line, index) => index === 0 ? { ...line, actualQuantity: 0 } : line),
  }),
  /实际数量必须为大于 0 的整数/,
)
assert.throws(
  () => submitEngineeringFirstSampleResult(sampleTask.taskId, {
    sampleActuals: makeActuals().map((line, index) => index === 0 ? { ...line, actualColor: '实际改色' } : line),
  }),
  /实际交付与制作要求不一致，请填写差异说明/,
  '首单样衣与跟单要求不一致时必须填写差异说明',
)

submitEngineeringFirstSampleResult(sampleTask.taskId, {
  sampleActuals: [
    { ...makeActuals()[0], actualLineId: `${sampleTask.taskId}-TEST-ACTUAL-1A`, actualQuantity: 1 },
    { ...makeActuals()[0], actualLineId: `${sampleTask.taskId}-TEST-ACTUAL-1B`, actualQuantity: 1 },
    makeActuals()[1],
  ],
})
const completed = getEngineeringMasterOrderById(master.masterOrderId)?.tasks.find((task) => task.taskId === sampleTask.taskId)
assert.equal(completed?.status, '已完成')
assert.equal(completed?.sampleActuals?.length, 3, '同一制作要求应允许制作团队分多行提交实际样衣')
assert.equal(completed?.resultImageIds.length, 3)
assert.equal(completed?.resultQuantity, requirements.reduce((sum, line) => sum + line.requiredQuantity, 0))
assert.ok(completed?.submittedAt)

console.log('pcs-engineering-pre-production-sample-submit.spec.ts PASS')

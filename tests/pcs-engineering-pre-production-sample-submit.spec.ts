import assert from 'node:assert/strict'

import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  createEngineeringMasterOrder,
  getEngineeringMasterOrderById,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
  submitEngineeringTaskResult,
} from '../src/data/pcs-engineering-master-repository.ts'
import {
  renderPcsFirstSampleTaskDetailPage,
  submitEngineeringFirstSampleResult,
} from '../src/pages/pcs-engineering-tasks/first-sample-task.ts'
import { startEngineeringTaskFromDetail } from '../src/pages/pcs-engineering-tasks/master-task-common.ts'

resetStyleArchiveRepository()
resetEngineeringMasterRepository()

const style = listStyleArchives().find((item) => item.mainImageUrl)
assert.ok(style, '应存在带真实图片的正式款式档案')

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
    triggerBusinessObjectId: `TEST-SAMPLE-${style.styleCode}`,
    thresholdQuantity: 300,
    reachedQuantity: 320,
    reachedAt: '2026-08-04 09:00:00',
    reason: '已满足做大货要求',
    uniqueTriggerKey: `TEST-SAMPLE-${style.styleCode}`,
  },
  creationReason: '验证产前版样衣专业任务',
})
const published = publishEngineeringMasterOrder(master.masterOrderId)
const basePattern = published.tasks.find((task) => task.taskType === 'BASE_PATTERN_WOVEN')
const sampleTask = published.tasks.find((task) => task.taskType === 'PRE_PRODUCTION_SAMPLE')
assert.ok(basePattern)
assert.ok(sampleTask)

startEngineeringTaskFromDetail(basePattern.taskId)
submitEngineeringTaskResult(master.masterOrderId, basePattern.taskId, {
  submittedBy: basePattern.assigneeName || '版师负责人',
  resultSummary: '基码纸样成果已提交',
})

let html = renderPcsFirstSampleTaskDetailPage(sampleTask.taskId)
assert.match(html, /开始任务/, '前置完成后必须从专业任务详情开始执行')
assert.doesNotMatch(html, /open-task-drawer|submit-pre-production-sample-result/, '不得恢复工程主单旧抽屉提交入口')

startEngineeringTaskFromDetail(sampleTask.taskId)
html = renderPcsFirstSampleTaskDetailPage(sampleTask.taskId)
assert.match(html, /样衣成果/)
assert.match(html, /提交成果并完成任务/)
assert.doesNotMatch(html, /提交人.*<input/, '提交人应从任务负责人自动记录，不允许页面手填')

assert.throws(
  () => submitEngineeringFirstSampleResult(sampleTask.taskId, {
    resultImageIds: [],
    resultQuantity: 2,
    submittedBy: sampleTask.assigneeName || '制作团队负责人',
  }),
  /至少上传一张结果图片/,
)
assert.throws(
  () => submitEngineeringFirstSampleResult(sampleTask.taskId, {
    resultImageIds: [style.mainImageUrl],
    resultQuantity: 0,
    submittedBy: sampleTask.assigneeName || '制作团队负责人',
  }),
  /制作数量必须大于 0/,
)

submitEngineeringFirstSampleResult(sampleTask.taskId, {
  resultImageIds: [style.mainImageUrl],
  resultQuantity: 2,
  submittedBy: sampleTask.assigneeName || '制作团队负责人',
})
const completed = getEngineeringMasterOrderById(master.masterOrderId)?.tasks.find((task) => task.taskId === sampleTask.taskId)
assert.equal(completed?.status, '已完成')
assert.deepEqual(completed?.resultImageIds, [style.mainImageUrl])
assert.equal(completed?.resultQuantity, 2)
assert.ok(completed?.submittedAt)

console.log('pcs-engineering-pre-production-sample-submit.spec.ts PASS')

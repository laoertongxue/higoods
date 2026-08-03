import assert from 'node:assert/strict'

import { listPatternAssets, resetPatternLibraryStore } from '../src/data/pcs-pattern-library.ts'
import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  createEngineeringMasterOrder,
  getEngineeringMasterOrderById,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
  updateEngineeringTaskRecord,
} from '../src/data/pcs-engineering-master-repository.ts'
import type { EngineeringTaskMaterialLine } from '../src/data/pcs-engineering-master-types.ts'
import {
  reviewEngineeringMaterialResults,
  submitEngineeringMaterialResults,
} from '../src/data/pcs-engineering-task-review.ts'

function materialLine(materialLineId: string, materialName: string): EngineeringTaskMaterialLine {
  return {
    materialLineId,
    materialSkuId: `SKU-${materialLineId}`,
    materialName,
    materialType: '面料',
    requirementType: '印花',
    productColor: materialName.includes('蓝色') ? '蓝色' : '红色',
    printProcess: '数码印花',
    status: '正常',
    resultFileIds: [`file://${materialLineId}.ai`],
    effectImageIds: [`img://${materialLineId}`],
    resultSubmittedBy: '花型团队A',
    resultSubmittedAt: '2026-08-01 09:00:00',
    reviewStatus: '待审核',
    reviewReason: '',
    reviewedBy: '',
    reviewedAt: '',
  }
}

resetStyleArchiveRepository()
resetEngineeringMasterRepository()
resetPatternLibraryStore()

const style = listStyleArchives()[0]
assert.ok(style, '应存在款式档案演示数据')
const master = publishEngineeringMasterOrder(createEngineeringMasterOrder({
  styleId: style.styleId,
  styleCode: style.styleCode,
  merchandiserName: '跟单A',
}).masterOrderId)
const patternTaskId = `${master.masterOrderId}-PATTERN_ARTWORK`

updateEngineeringTaskRecord(master.masterOrderId, patternTaskId, (task) => {
  task.status = '待审核'
  task.startedAt = '2026-08-01 08:00:00'
  task.submittedAt = '2026-08-01 09:00:00'
  const endedLine = materialLine('PAT-OLD', '已移除印花面料')
  endedLine.status = '因需求变更结束'
  task.materialLines = [materialLine('PAT-1', '红色印花面料'), materialLine('PAT-2', '蓝色印花面料'), endedLine]
})

const beforeUnauthorizedPatternReview = getEngineeringMasterOrderById(master.masterOrderId)
const assetsBeforeUnauthorizedPatternReview = listPatternAssets()
assert.throws(
  () => reviewEngineeringMaterialResults({
    masterOrderId: master.masterOrderId,
    taskId: patternTaskId,
    reviewerName: '跟单A',
    reviewerRole: '跟单',
    decisions: [
      { materialLineId: 'PAT-1', decision: '通过', reason: '' },
      { materialLineId: 'PAT-2', decision: '通过', reason: '' },
    ],
  }),
  /花型与调色成果只能由买手审核/,
  '花型任务不得绕过页面由非买手直接审核',
)
assert.deepEqual(
  getEngineeringMasterOrderById(master.masterOrderId),
  beforeUnauthorizedPatternReview,
  '非买手审核失败后不得修改工程主单、任务或物料行',
)
assert.deepEqual(
  listPatternAssets(),
  assetsBeforeUnauthorizedPatternReview,
  '非买手审核失败后不得生成花型资产',
)

const beforeInvalidReview = getEngineeringMasterOrderById(master.masterOrderId)
assert.throws(
  () => reviewEngineeringMaterialResults({
    masterOrderId: master.masterOrderId,
    taskId: patternTaskId,
    reviewerName: '买手A',
    reviewerRole: '买手',
    decisions: [{ materialLineId: 'PAT-1', decision: '通过', reason: '' }],
  }),
  /不得遗漏.*PAT-2/,
  '整单审核不得遗漏当前待审核物料行',
)
assert.deepEqual(
  getEngineeringMasterOrderById(master.masterOrderId),
  beforeInvalidReview,
  '失败校验不得部分写入审核状态或审核轮次',
)

assert.throws(
  () => reviewEngineeringMaterialResults({
    masterOrderId: master.masterOrderId,
    taskId: patternTaskId,
    reviewerName: '买手A',
    reviewerRole: '买手',
    decisions: [
      { materialLineId: 'PAT-1', decision: '通过', reason: '' },
      { materialLineId: 'PAT-1', decision: '未通过', reason: '重复行' },
      { materialLineId: 'PAT-2', decision: '通过', reason: '' },
    ],
  }),
  /重复审核.*PAT-1/,
)
assert.throws(
  () => reviewEngineeringMaterialResults({
    masterOrderId: master.masterOrderId,
    taskId: patternTaskId,
    reviewerName: '买手A',
    reviewerRole: '买手',
    decisions: [
      { materialLineId: 'PAT-1', decision: '通过', reason: '' },
      { materialLineId: 'PAT-2', decision: '通过', reason: '' },
      { materialLineId: 'PAT-OLD', decision: '通过', reason: '' },
    ],
  }),
  /非当前有效.*PAT-OLD/,
  '因需求变更结束的物料行不得进入当前审核',
)
assert.throws(
  () => reviewEngineeringMaterialResults({
    masterOrderId: master.masterOrderId,
    taskId: patternTaskId,
    reviewerName: '买手A',
    reviewerRole: '买手',
    decisions: [
      { materialLineId: 'PAT-1', decision: '通过', reason: '' },
      { materialLineId: 'PAT-2', decision: '未通过', reason: '' },
    ],
  }),
  /未通过原因/,
)

const mixed = reviewEngineeringMaterialResults({
  masterOrderId: master.masterOrderId,
  taskId: patternTaskId,
  reviewerName: '买手A',
  reviewerRole: '买手',
  decisions: [
    { materialLineId: 'PAT-1', decision: '通过', reason: '' },
    { materialLineId: 'PAT-2', decision: '未通过', reason: '颜色偏暗' },
  ],
})
assert.equal(mixed.taskStatus, '返工中')
assert.deepEqual(mixed.lockedPassedLineIds, ['PAT-1'])
assert.deepEqual(mixed.reworkLineIds, ['PAT-2'])
assert.equal(mixed.reviewRoundNo, 1)
assert.equal(mixed.firstCompletedAt, '')
assert.equal(mixed.effectiveCompletedAt, '')

const afterMixed = getEngineeringMasterOrderById(master.masterOrderId)
const mixedTask = afterMixed?.tasks.find((task) => task.taskId === patternTaskId)
assert.equal(mixedTask?.materialReviewRounds.length, 1, '每轮审核必须完整留痕')
assert.equal(mixedTask?.reworkRounds.length, 1, '出现未通过行必须增加返工轮次')
assert.equal(mixedTask?.materialLines.find((line) => line.materialLineId === 'PAT-1')?.reviewStatus, '通过')
assert.equal(mixedTask?.materialLines.find((line) => line.materialLineId === 'PAT-2')?.reviewStatus, '未通过')

assert.throws(
  () => submitEngineeringMaterialResults({
    masterOrderId: master.masterOrderId,
    taskId: patternTaskId,
    submittedBy: '花型团队A',
    results: [{ materialLineId: 'PAT-1', resultFileIds: ['file://changed.ai'], effectImageIds: ['img://changed'] }],
  }),
  /已通过.*锁定/,
  '已经审核通过的成果行必须锁定',
)

submitEngineeringMaterialResults({
  masterOrderId: master.masterOrderId,
  taskId: patternTaskId,
  submittedBy: '花型团队A',
  results: [{ materialLineId: 'PAT-2', resultFileIds: ['file://pattern-blue-v2.ai'], effectImageIds: ['img://pattern-blue-v2'] }],
})

assert.throws(
  () => reviewEngineeringMaterialResults({
    masterOrderId: master.masterOrderId,
    taskId: patternTaskId,
    reviewerName: '买手A',
    reviewerRole: '买手',
    decisions: [
      { materialLineId: 'PAT-1', decision: '通过', reason: '' },
      { materialLineId: 'PAT-2', decision: '通过', reason: '' },
    ],
  }),
  /非本轮待审核.*PAT-1/,
  '下一轮只允许审核上一轮未通过且已重提的物料行',
)

const completed = reviewEngineeringMaterialResults({
  masterOrderId: master.masterOrderId,
  taskId: patternTaskId,
  reviewerName: '买手A',
  reviewerRole: '买手',
  decisions: [{ materialLineId: 'PAT-2', decision: '通过', reason: '' }],
})
assert.equal(completed.taskStatus, '已完成')
assert.deepEqual(completed.lockedPassedLineIds, ['PAT-1', 'PAT-2'])
assert.deepEqual(completed.reworkLineIds, [])
assert.equal(completed.reviewRoundNo, 2)
assert.ok(completed.firstCompletedAt, '首次全部有效行通过时应记录首次完成时间')
assert.ok(completed.effectiveCompletedAt, '全部有效行通过时应记录当前有效完成时间')

const stored = getEngineeringMasterOrderById(master.masterOrderId)
const completedTask = stored?.tasks.find((task) => task.taskId === patternTaskId)
assert.equal(completedTask?.materialReviewRounds.length, 2)
assert.ok(completedTask?.reworkRounds[0]?.submittedAt, '失败行重提时应记录本轮返工提交时间')
assert.ok(completedTask?.reworkRounds[0]?.passedAt, '失败行通过后应记录本轮返工通过时间')

const unsupportedTaskId = `${master.masterOrderId}-PRE_PRODUCTION_SAMPLE`
assert.throws(
  () => reviewEngineeringMaterialResults({
    masterOrderId: master.masterOrderId,
    taskId: unsupportedTaskId,
    reviewerName: '买手A',
    reviewerRole: '买手',
    decisions: [],
  }),
  /仅花型与调色任务支持逐项审核/,
)

console.log('pcs-engineering-material-review.spec.ts PASS')

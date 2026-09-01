import assert from 'node:assert/strict'

import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  createEngineeringMasterOrder,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
  setEngineeringMasterStatus,
  submitEngineeringTaskResult,
} from '../src/data/pcs-engineering-master-repository.ts'
import { resolveEngineeringTaskSubmitStatus } from '../src/data/pcs-engineering-dependency-policy.ts'
import { startEngineeringTaskFromDetail } from '../src/pages/pcs-engineering-tasks/master-task-common.ts'

resetStyleArchiveRepository()
resetEngineeringMasterRepository()

const freshStyle = listStyleArchives()[0]
assert.ok(freshStyle, '应存在正式款式档案演示数据')

const master = createEngineeringMasterOrder({
  styleId: freshStyle.styleId,
  styleCode: freshStyle.styleCode,
  merchandiserId: 'USER-MERCHANDISER',
  merchandiserName: '跟单C',
  createdById: 'USER-MERCHANDISER',
  createdBy: '跟单C',
  createdByRole: '跟单',
  preparationType: 'PURE_WOVEN',
  qualificationFact: {
    styleCode: freshStyle.styleCode,
    formalSaleStatus: 'NO_FORMAL_SALE',
    formalProductionStatus: 'NO_FORMAL_PRODUCTION',
    formalSaleSource: '正式销售订单事实',
    formalProductionSource: '正式生产单事实',
    checkedAt: '2026-08-04 09:00:00',
  },
  bulkProductionQualification: {
    basisType: 'TEST_APPROVED',
    triggerBusinessObjectType: '测款结果',
    triggerBusinessObjectId: `TASK-SUBMIT-${freshStyle.styleCode}`,
    thresholdQuantity: 300,
    reachedQuantity: 320,
    reachedAt: '2026-08-04 09:00:00',
    reason: '已满足做大货要求',
    uniqueTriggerKey: `TASK-SUBMIT-${freshStyle.styleCode}`,
  },
  creationReason: '验证专业任务成果提交规则',
})
const published = publishEngineeringMasterOrder(master.masterOrderId)

// 提交目标状态分派：制版与首单样衣提交即完成；只有花型和调色进入待审核。
assert.equal(resolveEngineeringTaskSubmitStatus('BASE_PATTERN_WOVEN'), '已完成')
assert.equal(resolveEngineeringTaskSubmitStatus('BASE_PATTERN_KNIT'), '已完成')
assert.equal(resolveEngineeringTaskSubmitStatus('PRE_PRODUCTION_SAMPLE'), '已完成')
assert.equal(resolveEngineeringTaskSubmitStatus('SIZE_PATTERN_WOVEN'), '已完成')
assert.equal(resolveEngineeringTaskSubmitStatus('SIZE_PATTERN_KNIT'), '已完成')
assert.equal(resolveEngineeringTaskSubmitStatus('PATTERN_ARTWORK'), '待审核')
assert.equal(resolveEngineeringTaskSubmitStatus('COLOR_YARN'), '待审核')
assert.equal(resolveEngineeringTaskSubmitStatus('COLOR_FABRIC'), '待审核')
assert.equal(resolveEngineeringTaskSubmitStatus('ACCESSORY_PURCHASE'), '已完成')
assert.equal(resolveEngineeringTaskSubmitStatus('TECH_PACK_CONFIRMATION'), '已完成')

const taskId = (taskType: string) => `${master.masterOrderId}-${taskType}`

// 待开始任务提交成果：制版直接完成，写入提交与完成时间
startEngineeringTaskFromDetail(taskId('BASE_PATTERN_WOVEN'))
const wovenResult = submitEngineeringTaskResult(
  master.masterOrderId,
  taskId('BASE_PATTERN_WOVEN'),
)
assert.equal(wovenResult.task.status, '已完成')
assert.ok(wovenResult.task.submittedAt, '提交后应记录提交时间')
assert.ok(wovenResult.task.firstCompletedAt, '提交即完成应记录首次完成时间')
assert.equal(wovenResult.task.effectiveCompletedAt, wovenResult.task.firstCompletedAt)
assert.ok(wovenResult.task.startedAt, '任务开始时应记录开始时间')

// 只有已发布/进行中的主单可以接收专业任务成果；收口阶段必须拒绝继续改写任务事实。
for (const [index, status] of (['技术包审核中', '待关闭'] as const).entries()) {
  const blockedStyle = listStyleArchives()[index + 1]
  assert.ok(blockedStyle, `缺少用于${status}门禁测试的款式档案`)
  const blockedMaster = createEngineeringMasterOrder({
    styleId: blockedStyle.styleId,
    styleCode: blockedStyle.styleCode,
    merchandiserId: 'USER-MERCHANDISER',
    merchandiserName: '跟单C',
    createdById: 'USER-MERCHANDISER',
    createdBy: '跟单C',
    createdByRole: '跟单',
    preparationType: 'PURE_WOVEN',
    qualificationFact: {
      styleCode: blockedStyle.styleCode,
      formalSaleStatus: 'NO_FORMAL_SALE',
      formalProductionStatus: 'NO_FORMAL_PRODUCTION',
      formalSaleSource: '正式销售订单事实',
      formalProductionSource: '正式生产单事实',
      checkedAt: '2026-08-04 09:00:00',
    },
    bulkProductionQualification: {
      basisType: 'MANUAL_CONFIRMED',
      triggerBusinessObjectType: '人工确认',
      triggerBusinessObjectId: `TASK-SUBMIT-BLOCK-${index}`,
      reachedAt: '2026-08-04 09:00:00',
      reason: '跟单确认满足做大货要求',
      uniqueTriggerKey: `TASK-SUBMIT-BLOCK-${index}`,
    },
    creationReason: `验证${status}状态提交门禁`,
  })
  const blockedPublished = publishEngineeringMasterOrder(blockedMaster.masterOrderId)
  setEngineeringMasterStatus(blockedPublished.masterOrderId, status)
  assert.throws(
    () => submitEngineeringTaskResult(blockedPublished.masterOrderId, `${blockedPublished.masterOrderId}-BASE_PATTERN_WOVEN`),
    /仅进行中的工程主单/,
    `${status}主单不得继续提交任务成果`,
  )
  setEngineeringMasterStatus(blockedPublished.masterOrderId, '已终止')
}

// 前置完成后待前置任务可提交：首单样衣提交即完成
startEngineeringTaskFromDetail(taskId('PRE_PRODUCTION_SAMPLE'))
const sampleTask = published.tasks.find((task) => task.taskType === 'PRE_PRODUCTION_SAMPLE')!
const sampleActuals = (sampleTask.sampleRequirements || []).map((requirement, index) => ({
  actualLineId: `${sampleTask.taskId}-TEST-ACTUAL-${index + 1}`,
  requirementLineId: requirement.requirementLineId,
  actualColor: requirement.targetColor,
  actualSize: requirement.targetSize,
  actualQuantity: requirement.requiredQuantity,
  sourcePatternVersion: '基码纸样 v1.0',
  productionNote: '按跟单要求完成',
  differenceNote: '',
  imageFileIds: [freshStyle.mainImageUrl],
  submittedBy: '制作团队A',
}))
const sampleResult = submitEngineeringTaskResult(
  master.masterOrderId,
  taskId('PRE_PRODUCTION_SAMPLE'),
  {
    sampleActuals,
  },
)
assert.equal(sampleResult.task.status, '已完成')
assert.ok(sampleResult.task.submittedAt, '样衣提交应记录提交时间')

// 条件任务未启用：禁止提交
assert.throws(
  () => submitEngineeringTaskResult(master.masterOrderId, taskId('PATTERN_ARTWORK')),
  /未启用/,
  '花型任务未启用时不得提交',
)

// 已完成任务重复提交：禁止
assert.throws(
  () => submitEngineeringTaskResult(master.masterOrderId, taskId('BASE_PATTERN_WOVEN')),
  /已完成/,
  '已完成任务不得重复提交',
)

console.log('pcs-engineering-task-submit.spec.ts PASS')

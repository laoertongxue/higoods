import assert from 'node:assert/strict'

import {
  confirmEngineeringIndependentSamplingPlan,
  confirmEngineeringIndependentSamplingResult,
  createEngineeringIndependentSampling,
  listReusableEngineeringIndependentProfessionalResults,
  resetEngineeringIndependentSamplingRepository,
  reviewEngineeringIndependentProfessionalTask,
  startEngineeringIndependentProfessionalTask,
  submitEngineeringIndependentProfessionalTask,
} from '../src/data/pcs-engineering-master-sampling.ts'
import {
  confirmEngineeringMasterTaskPlan,
  createEngineeringMasterOrder,
  getEngineeringMasterOrderById,
  listEngineeringMasterPriorResultCandidates,
  resetEngineeringMasterRepository,
  type EngineeringMasterPriorResultDecisionInput,
} from '../src/data/pcs-engineering-master-repository.ts'
import type {
  EngineeringIndependentProfessionalTaskType,
  EngineeringIndependentSamplingRecord,
} from '../src/data/pcs-engineering-master-types.ts'
import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import { renderPcsEngineeringMasterDetailPage } from '../src/pages/pcs-engineering-master-detail.ts'

const merchandiser = { role: '跟单', userId: 'MERCH-A6', userName: '跟单-A6' }
const buyer = { role: '买手', userId: 'BUYER-A6', userName: '买手-A6' }

resetStyleArchiveRepository()
resetEngineeringIndependentSamplingRepository(false)
resetEngineeringMasterRepository()
const [sourceStyle, targetStyle] = listStyleArchives().filter((style) => style.mainImageUrl)
assert.ok(sourceStyle && targetStyle)

function createSampling(
  marker: string,
  taskTypes: EngineeringIndependentProfessionalTaskType[],
  confirmedAt?: string,
): EngineeringIndependentSamplingRecord {
  const created = createEngineeringIndependentSampling({
    samplingType: 'REVISION',
    sourceStyleId: sourceStyle.styleId,
    targetStyleId: targetStyle.styleId,
    merchandiser,
    selectedTaskTypes: taskTypes,
    bomDraftVersionId: `BOM-${marker}`,
    createdAt: `2026-07-${marker === 'OLD' ? '01' : marker === 'NEW' ? '10' : '20'} 09:00:00`,
  })
  let current = confirmEngineeringIndependentSamplingPlan({
    samplingTaskId: created.samplingTaskId,
    actor: merchandiser,
    selectedTaskTypes: taskTypes,
    confirmedAt: created.createdAt,
  })
  for (const taskType of ['BASE_PATTERN', 'DISPLAY_SAMPLE', 'PATTERN_ARTWORK'] as const) {
    const task = current.professionalTasks.find((item) => item.taskType === taskType)
    if (!task) continue
    const executor = {
      role: taskType === 'BASE_PATTERN' ? '版师' : taskType === 'DISPLAY_SAMPLE' ? '制作团队' : '花型团队',
      userId: `EXEC-${taskType}`,
      userName: `${task.taskName}负责人`,
    }
    current = startEngineeringIndependentProfessionalTask({ taskId: task.taskId, actor: executor, startedAt: created.createdAt })
    current = submitEngineeringIndependentProfessionalTask({
      taskId: task.taskId,
      actor: executor,
      resultTitles: [`${task.taskName}-${marker}`],
      resultImageUrls: [targetStyle.mainImageUrl],
      submittedAt: created.createdAt,
    })
    const submitted = current.professionalTasks.find((item) => item.taskId === task.taskId)!
    if (submitted.status === 'WAIT_REVIEW') {
      current = reviewEngineeringIndependentProfessionalTask({
        taskId: task.taskId,
        actor: buyer,
        decisions: submitted.results.map((result) => ({ resultId: result.resultId, approved: true })),
        reviewedAt: created.createdAt,
      })
    }
  }
  if (!confirmedAt) return current
  return confirmEngineeringIndependentSamplingResult({
    samplingTaskId: created.samplingTaskId,
    actor: merchandiser,
    resultVersion: `v-${marker}`,
    resultSummary: `${marker} 整单成果`,
    confirmedAt,
  })
}

const oldResult = createSampling('OLD', ['DISPLAY_SAMPLE', 'PATTERN_ARTWORK'], '2026-07-01 18:00:00')
const newResult = createSampling('NEW', ['DISPLAY_SAMPLE', 'PATTERN_ARTWORK'], '2026-07-10 18:00:00')
const unconfirmed = createSampling('PENDING', ['BASE_PATTERN'])

const reusable = listReusableEngineeringIndependentProfessionalResults(targetStyle.styleCode)
assert.ok(reusable.length >= 6, '两份已确认成果的专业任务必须可供工程主单逐项选择')
assert.ok(reusable.every((item) => item.samplingTaskId !== unconfirmed.samplingTaskId), '未整单确认成果不得进入候选')
assert.ok(reusable.every((item) => item.completedAt), '专业任务自身未完成不得进入候选')

const candidates = listEngineeringMasterPriorResultCandidates(targetStyle.styleCode, 'PURE_WOVEN')
const baseCandidates = candidates.filter((item) => item.engineeringTaskType === 'BASE_PATTERN_WOVEN')
assert.equal(baseCandidates[0]?.source.samplingTaskId, newResult.samplingTaskId, '默认必须推荐最近确认版本')
assert.equal(baseCandidates[0]?.recommended, true)
assert.ok(baseCandidates.some((item) => item.source.samplingTaskId === oldResult.samplingTaskId), '跟单必须可以改选历史有效版本')

function createDraft(unique: string) {
  resetEngineeringMasterRepository()
  return createEngineeringMasterOrder({
    styleId: targetStyle.styleId,
    styleCode: targetStyle.styleCode,
    merchandiserId: merchandiser.userId,
    merchandiserName: merchandiser.userName,
    createdById: merchandiser.userId,
    createdBy: merchandiser.userName,
    createdByRole: merchandiser.role,
    preparationType: 'PURE_WOVEN',
    qualificationFact: {
      styleCode: targetStyle.styleCode,
      formalSaleStatus: 'NO_FORMAL_SALE',
      formalProductionStatus: 'NO_FORMAL_PRODUCTION',
      formalSaleSource: '销售事实',
      formalProductionSource: '生产事实',
      checkedAt: '2026-08-04 09:00:00',
    },
    bulkProductionQualification: {
      basisType: 'OTHER_CONFIRMED',
      triggerBusinessObjectType: '业务确认',
      triggerBusinessObjectId: unique,
      thresholdQuantity: null,
      reachedQuantity: null,
      reachedAt: '2026-08-04 09:00:00',
      reason: '满足大货要求',
      uniqueTriggerKey: unique,
    },
    creationReason: 'A6 专项验证',
  })
}

function decision(
  engineeringTaskType: EngineeringMasterPriorResultDecisionInput['engineeringTaskType'],
  sampling: EngineeringIndependentSamplingRecord,
  professionalTaskType: EngineeringIndependentProfessionalTaskType,
  choice: EngineeringMasterPriorResultDecisionInput['decision'],
): EngineeringMasterPriorResultDecisionInput {
  const sourceTask = sampling.professionalTasks.find((task) => task.taskType === professionalTaskType)!
  return {
    engineeringTaskType,
    sourceSamplingTaskId: sampling.samplingTaskId,
    sourceProfessionalTaskId: sourceTask.taskId,
    sourceResultVersion: sampling.resultVersion,
    decision: choice,
  }
}

const draft = createDraft('A6-NORMAL')
const confirmed = confirmEngineeringMasterTaskPlan(draft.masterOrderId, {
  confirmedBy: merchandiser.userName,
  confirmedById: merchandiser.userId,
  confirmedByRole: merchandiser.role,
  selectedConditionalTaskTypes: [],
  priorResultDecisions: [
    decision('BASE_PATTERN_WOVEN', oldResult, 'BASE_PATTERN', '复用'),
    decision('PRE_PRODUCTION_SAMPLE', newResult, 'DISPLAY_SAMPLE', '重新执行'),
    decision('PATTERN_ARTWORK', newResult, 'PATTERN_ARTWORK', '不采用'),
  ],
})
assert.equal(confirmed.priorResultReuseLines.length, 3)
const reusedLine = confirmed.priorResultReuseLines.find((line) => line.resultType === 'BASE_PATTERN_WOVEN')!
assert.equal(reusedLine.sourceSamplingTaskId, oldResult.samplingTaskId, '必须保留跟单改选的历史来源')
assert.equal(reusedLine.sourceResultVersion, oldResult.resultVersion)
assert.equal(reusedLine.confirmedById, merchandiser.userId)
assert.ok(reusedLine.confirmedAt)
const reusedBase = confirmed.tasks.find((task) => task.taskType === 'BASE_PATTERN_WOVEN')!
assert.equal(reusedBase.status, '已完成')
assert.equal(reusedBase.currentRoundNo, 0, '复用不得生成重复执行轮次')
assert.equal(reusedBase.startedAt, '', '复用不得伪造本次执行开始时间')
assert.equal(reusedBase.effectiveCompletedAt, '', '复用不得计入本次执行完成时间')
const redoneSample = confirmed.tasks.find((task) => task.taskType === 'PRE_PRODUCTION_SAMPLE')!
assert.equal(redoneSample.status, '待开始', '前置复用后，重做任务必须解锁为工程主单来源的新任务')
assert.equal(redoneSample.sourceType, 'ENGINEERING_MASTER')
assert.deepEqual(redoneSample.dependencySatisfaction, [{
  dependencyTaskType: 'BASE_PATTERN_WOVEN',
  satisfactionType: 'PRIOR_RESULT_REUSED',
  sourceId: reusedLine.sourceTaskId,
}])
assert.equal(confirmed.tasks.find((task) => task.taskType === 'PATTERN_ARTWORK')?.status, '未启用', '不采用不得启用任务或满足依赖')

const detailHtml = renderPcsEngineeringMasterDetailPage(createDraft('A6-UI').masterOrderId)
assert.match(detailHtml, /前期成果/)
assert.match(detailHtml, /推荐/)
assert.match(detailHtml, /重新执行/)
assert.match(detailHtml, /不采用/)

const blockedDraft = createDraft('A6-UNCONFIRMED')
assert.throws(() => confirmEngineeringMasterTaskPlan(blockedDraft.masterOrderId, {
  confirmedBy: merchandiser.userName,
  confirmedById: merchandiser.userId,
  confirmedByRole: merchandiser.role,
  selectedConditionalTaskTypes: [],
  priorResultDecisions: [
    decision('BASE_PATTERN_WOVEN', unconfirmed, 'BASE_PATTERN', '复用'),
    decision('PRE_PRODUCTION_SAMPLE', newResult, 'DISPLAY_SAMPLE', '重新执行'),
    decision('PATTERN_ARTWORK', newResult, 'PATTERN_ARTWORK', '不采用'),
  ],
}), /未完成整单确认|不能采用/, '未确认成果必须由领域层阻断')
assert.equal(getEngineeringMasterOrderById(blockedDraft.masterOrderId)?.status, '草稿')

const dependencyDraft = createDraft('A6-DEPENDENCY')
assert.throws(() => confirmEngineeringMasterTaskPlan(dependencyDraft.masterOrderId, {
  confirmedBy: merchandiser.userName,
  confirmedById: merchandiser.userId,
  confirmedByRole: merchandiser.role,
  selectedConditionalTaskTypes: [],
  priorResultDecisions: [
    decision('BASE_PATTERN_WOVEN', newResult, 'BASE_PATTERN', '不采用'),
    decision('PRE_PRODUCTION_SAMPLE', newResult, 'DISPLAY_SAMPLE', '复用'),
    decision('PATTERN_ARTWORK', newResult, 'PATTERN_ARTWORK', '不采用'),
  ],
}), /不能选择不采用/, '不采用不能满足必做任务或下游依赖')

console.log('pcs-engineering-prior-result-reuse.spec PASS')

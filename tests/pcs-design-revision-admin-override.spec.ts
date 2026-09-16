import assert from 'node:assert/strict'

import '../src/data/fcs/design-revision-process-work-order-adapter.ts'
import {
  DESIGN_REVISION_DISPLAY_SAMPLE_ASSIGNMENTS,
  confirmEngineeringIndependentSamplingScheme,
  getEngineeringIndependentSamplingRecord,
  resetEngineeringIndependentSamplingRepository,
  startEngineeringIndependentProfessionalTask,
  suggestEngineeringIndependentTaskTypes,
} from '../src/data/pcs-engineering-master-sampling.ts'
import {
  getEngineeringBomPricingPlan,
  getEngineeringBomVersionById,
  saveEngineeringBomPricingPlan,
  saveEngineeringBomVersion,
} from '../src/data/pcs-engineering-bom-repository.ts'

const admin = { role: '管理员', userId: 'U-ADMIN-TEST', userName: '管理员（代操作）' }

resetEngineeringIndependentSamplingRepository(true)
const initial = getEngineeringIndependentSamplingRecord('ES-ID-DR-001')
assert.ok(initial, '必须存在跨买手验收用的设计改款种子任务')
assert.notEqual(initial.buyerId, admin.userId, '管理员不能伪装成任务原买手')

const version = getEngineeringBomVersionById(initial.bomVersionIds[0])
assert.ok(version, '设计改款任务必须有关联物料方案')
saveEngineeringBomVersion({
  versionId: version.bomDraftVersionId,
  role: admin.role,
  userId: admin.userId,
  userName: admin.userName,
  materialLines: version.materialLines,
  updatedAt: '2026-09-15 10:00:00',
})
const pricing = getEngineeringBomPricingPlan('INDEPENDENT_SAMPLING', initial.samplingTaskId)
assert.ok(pricing, '设计改款任务必须有关联整款费用方案')
saveEngineeringBomPricingPlan({
  ownerStage: pricing.ownerStage,
  ownerId: pricing.ownerId,
  role: admin.role,
  userId: admin.userId,
  userName: admin.userName,
  customCostDecision: pricing.customCostDecision,
  customCosts: pricing.customCosts,
  updatedAt: '2026-09-15 10:00:00',
})

assert.throws(
  () => confirmEngineeringIndependentSamplingScheme({
    samplingTaskId: initial.samplingTaskId,
    actor: { role: '买手', userId: 'U-OTHER-BUYER', userName: '其他买手' },
    selectedTaskTypes: suggestEngineeringIndependentTaskTypes(initial),
    displaySampleAssignment: { ...DESIGN_REVISION_DISPLAY_SAMPLE_ASSIGNMENTS[0] },
    sampleRequirements: [{ targetColor: '整款', targetSize: 'M', requiredQuantity: 1, requirementNote: '验收样衣' }],
    confirmedAt: '2026-09-15 10:01:00',
  }),
  /任务买手本人或管理员/,
  '普通买手仍不能越权操作其他买手的任务',
)

const confirmed = confirmEngineeringIndependentSamplingScheme({
  samplingTaskId: initial.samplingTaskId,
  actor: admin,
  selectedTaskTypes: suggestEngineeringIndependentTaskTypes(initial),
  displaySampleAssignment: { ...DESIGN_REVISION_DISPLAY_SAMPLE_ASSIGNMENTS[0] },
  sampleRequirements: [{ targetColor: '整款', targetSize: 'M', requiredQuantity: 1, requirementNote: '验收样衣' }],
  confirmedAt: '2026-09-15 10:02:00',
})
assert.equal(confirmed.status, 'IN_PROGRESS')
assert.equal(confirmed.buyerId, initial.buyerId, '管理员代操作不得改写任务原买手')
assert.equal(confirmed.taskPlanConfirmedBy, admin.userName)
assert.equal(confirmed.operationLogs[0]?.operatorName, admin.userName, '管理员代操作必须留痕')

const readyTask = confirmed.professionalTasks.find((task) => task.status === 'WAIT_START')
assert.ok(readyTask, '确认方案后至少应有一个可开始的专业任务')
const started = startEngineeringIndependentProfessionalTask({
  taskId: readyTask.taskId,
  actor: admin,
  startedAt: '2026-09-15 10:03:00',
})
assert.equal(started.professionalTasks.find((task) => task.taskId === readyTask.taskId)?.status, 'IN_PROGRESS')
assert.equal(started.operationLogs[0]?.operatorName, admin.userName, '管理员执行专业任务必须留痕')

console.log('PCS 设计改款管理员代操作专项契约：通过')

import assert from 'node:assert/strict'

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
  confirmEngineeringColorRequirements,
  listEngineeringColorBomLines,
  listEngineeringColorPreparationProjectionTimes,
  submitEngineeringColorResults,
} from '../src/data/pcs-engineering-color-task-service.ts'
import { reviewEngineeringMaterialResults } from '../src/data/pcs-engineering-task-review.ts'

function line(
  materialLineId: string,
  requirementType: EngineeringTaskMaterialLine['requirementType'],
  status: EngineeringTaskMaterialLine['status'] = '正常',
): EngineeringTaskMaterialLine {
  return {
    materialLineId,
    materialSkuId: `SKU-${materialLineId}`,
    materialName: `物料-${materialLineId}`,
    materialType: '面料',
    requirementType,
    status,
    resultFileIds: [],
    effectImageIds: [],
    resultSubmittedBy: '',
    resultSubmittedAt: '',
    reviewStatus: '待提交',
    reviewReason: '',
    reviewedBy: '',
    reviewedAt: '',
  }
}

resetStyleArchiveRepository()
resetEngineeringMasterRepository()

const style = listStyleArchives()[0]
assert.ok(style)
const master = publishEngineeringMasterOrder(createEngineeringMasterOrder({
  styleId: style.styleId,
  styleCode: style.styleCode,
  merchandiserName: '跟单A',
}).masterOrderId)
const taskId = `${master.masterOrderId}-COLOR_FABRIC`
const otherTaskId = `${master.masterOrderId}-COLOR_YARN`

updateEngineeringTaskRecord(master.masterOrderId, taskId, (task) => {
  task.status = '进行中'
  task.materialLines = [
    line('DYE-RED', '染色'),
    line('DYE-BLUE', '染色'),
    line('DYE-ENDED', '染色', '因需求变更结束'),
    line('PRINT-1', '印花'),
  ]
})
updateEngineeringTaskRecord(master.masterOrderId, otherTaskId, (task) => {
  task.status = '进行中'
  task.materialLines = [line('YARN-1', '染色')]
})

updateEngineeringTaskRecord(master.masterOrderId, otherTaskId, (task) => {
  task.status = '未启用'
  task.materialLines = []
})
const disabledSnapshot = getEngineeringMasterOrderById(master.masterOrderId)
assert.throws(
  () => confirmEngineeringColorRequirements({
    masterOrderId: master.masterOrderId,
    taskId: otherTaskId,
    confirmedBy: '跟单A',
    requirements: [],
  }),
  /未启用.*不能确认染色要求/,
  '未启用任务不能用空物料绕过阶段二门禁',
)
assert.deepEqual(
  getEngineeringMasterOrderById(master.masterOrderId),
  disabledSnapshot,
  '未启用任务确认失败后必须保持主单快照完全不变',
)

updateEngineeringTaskRecord(master.masterOrderId, otherTaskId, (task) => {
  task.status = '进行中'
  task.materialLines = [
    line('PRINT-ONLY', '印花'),
    line('DYE-INACTIVE', '染色', '因需求变更结束'),
  ]
})
const emptyApplicableSnapshot = getEngineeringMasterOrderById(master.masterOrderId)
assert.throws(
  () => confirmEngineeringColorRequirements({
    masterOrderId: master.masterOrderId,
    taskId: otherTaskId,
    confirmedBy: '跟单A',
    requirements: [],
  }),
  /暂无有效染色物料.*不能确认染色要求/,
  '已启用任务也必须至少有一条当前有效染色物料',
)
assert.deepEqual(
  getEngineeringMasterOrderById(master.masterOrderId),
  emptyApplicableSnapshot,
  '空有效染色物料确认失败后必须保持主单快照完全不变',
)

updateEngineeringTaskRecord(master.masterOrderId, otherTaskId, (task) => {
  task.status = '待审核'
  task.materialLines = [line('DYE-WRONG-STATUS', '染色')]
})
const wrongStatusSnapshot = getEngineeringMasterOrderById(master.masterOrderId)
assert.throws(
  () => confirmEngineeringColorRequirements({
    masterOrderId: master.masterOrderId,
    taskId: otherTaskId,
    confirmedBy: '跟单A',
    requirements: [
      { materialLineId: 'DYE-WRONG-STATUS', pantoneColorCode: '19-4052 TCX', colorName: '经典蓝', dyeColorCode: 'B-01' },
    ],
  }),
  /处于待审核.*不能确认染色要求/,
  '非待开始或进行中的任务不能确认染色要求',
)
assert.deepEqual(
  getEngineeringMasterOrderById(master.masterOrderId),
  wrongStatusSnapshot,
  '非可确认状态失败后必须保持主单快照完全不变',
)

assert.deepEqual(
  listEngineeringColorBomLines(master.masterOrderId, taskId).map((item) => item.materialLineId),
  ['DYE-RED', 'DYE-BLUE'],
  '阶段一只能读取本任务中当前有效的染色 BOM 行',
)

const beforeInvalidConfirmation = getEngineeringMasterOrderById(master.masterOrderId)
assert.throws(
  () => confirmEngineeringColorRequirements({
    masterOrderId: master.masterOrderId,
    taskId,
    confirmedBy: '买手A',
    requirements: [],
  }),
  /仅主单跟单.*确认/,
)
assert.throws(
  () => confirmEngineeringColorRequirements({
    masterOrderId: master.masterOrderId,
    taskId,
    confirmedBy: '跟单A',
    requirements: [
      { materialLineId: 'DYE-RED', pantoneColorCode: '18-1664 TCX', colorName: '番茄红', dyeColorCode: 'R-01' },
    ],
  }),
  /不得遗漏.*DYE-BLUE/,
)
assert.throws(
  () => confirmEngineeringColorRequirements({
    masterOrderId: master.masterOrderId,
    taskId,
    confirmedBy: '跟单A',
    requirements: [
      { materialLineId: 'DYE-RED', pantoneColorCode: '18-1664 TCX', colorName: '番茄红', dyeColorCode: 'R-01' },
      { materialLineId: 'DYE-RED', pantoneColorCode: '18-1664 TCX', colorName: '番茄红', dyeColorCode: 'R-01' },
      { materialLineId: 'DYE-BLUE', pantoneColorCode: '19-4052 TCX', colorName: '经典蓝', dyeColorCode: 'B-01' },
    ],
  }),
  /重复.*DYE-RED/,
)
assert.throws(
  () => confirmEngineeringColorRequirements({
    masterOrderId: master.masterOrderId,
    taskId,
    confirmedBy: '跟单A',
    requirements: [
      { materialLineId: 'DYE-RED', pantoneColorCode: '', colorName: '番茄红', dyeColorCode: 'R-01' },
      { materialLineId: 'DYE-BLUE', pantoneColorCode: '19-4052 TCX', colorName: '经典蓝', dyeColorCode: 'B-01' },
    ],
  }),
  /潘通色卡色号/,
)
assert.throws(
  () => confirmEngineeringColorRequirements({
    masterOrderId: master.masterOrderId,
    taskId,
    confirmedBy: '跟单A',
    requirements: [
      { materialLineId: 'DYE-RED', pantoneColorCode: '18-1664 TCX', colorName: '番茄红', dyeColorCode: 'R-01' },
      { materialLineId: 'DYE-BLUE', pantoneColorCode: '19-4052 TCX', colorName: '经典蓝', dyeColorCode: 'B-01' },
      { materialLineId: 'PRINT-1', pantoneColorCode: 'X', colorName: '非染色', dyeColorCode: 'X' },
    ],
  }),
  /非当前有效染色物料行.*PRINT-1/,
)
assert.throws(
  () => confirmEngineeringColorRequirements({
    masterOrderId: master.masterOrderId,
    taskId,
    confirmedBy: '跟单A',
    requirements: [
      { materialLineId: 'YARN-1', pantoneColorCode: 'X', colorName: '错任务', dyeColorCode: 'X' },
    ],
  }),
  /非当前有效染色物料行.*YARN-1/,
)
assert.deepEqual(
  getEngineeringMasterOrderById(master.masterOrderId),
  beforeInvalidConfirmation,
  '阶段二任一校验失败必须整批不写入',
)

assert.throws(
  () => submitEngineeringColorResults({
    masterOrderId: master.masterOrderId,
    taskId,
    submittedBy: '染厂A',
    results: [
      { materialLineId: 'DYE-RED', resultFileIds: ['file://red.jpg'], effectImageIds: [], dyeFactoryName: '染厂A' },
      { materialLineId: 'DYE-BLUE', resultFileIds: ['file://blue.jpg'], effectImageIds: [], dyeFactoryName: '染厂A' },
    ],
  }),
  /先由跟单确认染色要求/,
  '阶段三必须等待阶段二完成',
)

const confirmed = confirmEngineeringColorRequirements({
  masterOrderId: master.masterOrderId,
  taskId,
  confirmedBy: '跟单A',
  requirements: [
    { materialLineId: 'DYE-RED', pantoneColorCode: '18-1664 TCX', colorName: '番茄红', dyeColorCode: 'R-01' },
    { materialLineId: 'DYE-BLUE', pantoneColorCode: '19-4052 TCX', colorName: '经典蓝', dyeColorCode: 'B-01' },
  ],
})
assert.equal(confirmed.colorRequirementConfirmedBy, '跟单A')
assert.ok(confirmed.colorRequirementConfirmedAt)
assert.equal(confirmed.materialLines.find((item) => item.materialLineId === 'DYE-RED')?.pantoneColorCode, '18-1664 TCX')

submitEngineeringColorResults({
  masterOrderId: master.masterOrderId,
  taskId,
  submittedBy: '染厂A',
  results: [
    { materialLineId: 'DYE-RED', resultFileIds: ['file://red.jpg'], effectImageIds: [], dyeFactoryName: '染厂A' },
    { materialLineId: 'DYE-BLUE', resultFileIds: [], effectImageIds: ['img://blue.jpg'], dyeFactoryName: '染厂A' },
  ],
})

assert.throws(
  () => reviewEngineeringMaterialResults({
    masterOrderId: master.masterOrderId,
    taskId,
    reviewerName: '跟单A',
    reviewerRole: '跟单',
    decisions: [
      { materialLineId: 'DYE-RED', decision: '通过', reason: '' },
      { materialLineId: 'DYE-BLUE', decision: '通过', reason: '' },
    ],
  }),
  /只能由买手审核/,
)

const mixed = reviewEngineeringMaterialResults({
  masterOrderId: master.masterOrderId,
  taskId,
  reviewerName: '买手A',
  reviewerRole: '买手',
  decisions: [
    { materialLineId: 'DYE-RED', decision: '通过', reason: '' },
    { materialLineId: 'DYE-BLUE', decision: '未通过', reason: '颜色偏暗' },
  ],
})
assert.equal(mixed.taskStatus, '返工中')
assert.deepEqual(mixed.lockedPassedLineIds, ['DYE-RED'])
assert.deepEqual(mixed.reworkLineIds, ['DYE-BLUE'])

assert.throws(
  () => submitEngineeringColorResults({
    masterOrderId: master.masterOrderId,
    taskId,
    submittedBy: '染厂A',
    results: [{ materialLineId: 'DYE-RED', resultFileIds: ['file://red-v2.jpg'], effectImageIds: [], dyeFactoryName: '染厂A' }],
  }),
  /已通过.*锁定/,
)
submitEngineeringColorResults({
  masterOrderId: master.masterOrderId,
  taskId,
  submittedBy: '染厂A',
  results: [{ materialLineId: 'DYE-BLUE', resultFileIds: ['file://blue-v2.jpg'], effectImageIds: [], dyeFactoryName: '染厂A' }],
})
const completed = reviewEngineeringMaterialResults({
  masterOrderId: master.masterOrderId,
  taskId,
  reviewerName: '买手A',
  reviewerRole: '买手',
  decisions: [{ materialLineId: 'DYE-BLUE', decision: '通过', reason: '' }],
})
assert.equal(completed.taskStatus, '已完成')

const projection = listEngineeringColorPreparationProjectionTimes(master.masterOrderId, taskId)
assert.deepEqual(projection.map((item) => item.itemType), ['确认染色要求（面料）', '染色调色（面料）'])
assert.ok(projection[0]?.completedAt, '阶段二确认时间必须可供生产准备投影读取')
assert.ok(projection[1]?.completedAt, '买手最终通过时间必须可供生产准备投影读取')

console.log('pcs-engineering-color-stages.spec.ts PASS')

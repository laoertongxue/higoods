import assert from 'node:assert/strict'

import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  createEngineeringMasterOrder,
  getEngineeringMasterOrderById,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
  applyBomRequirementsToEngineeringTasks,
  updateEngineeringTaskRecord,
} from '../src/data/pcs-engineering-master-repository.ts'
import type { EngineeringBomTaskLinkageRow } from '../src/data/pcs-engineering-bom-types.ts'

function createPublishedMaster() {
  resetStyleArchiveRepository()
  resetEngineeringMasterRepository()
  const style = listStyleArchives()[0]
  assert.ok(style, '应存在款式档案演示数据')
  return publishEngineeringMasterOrder(createEngineeringMasterOrder({
    styleId: style.styleId,
    styleCode: style.styleCode,
    merchandiserName: '跟单A',
  }).masterOrderId)
}

function row(
  bomItemId: string,
  requirements: Partial<EngineeringBomTaskLinkageRow> = {},
): EngineeringBomTaskLinkageRow {
  return {
    bomItemId,
    materialSkuId: `SKU-${bomItemId}`,
    materialName: `物料-${bomItemId}`,
    materialType: '面料',
    printRequirement: '否',
    dyeRequirement: '否',
    shrinkRequirement: '否',
    washRequirement: '否',
    waterSolubleRequirement: '否',
    ...requirements,
  }
}

const master = createPublishedMaster()
const first = applyBomRequirementsToEngineeringTasks(master.masterOrderId, [
  row('BOM-PRINT-RED', { printRequirement: '是', printProcess: '数码印花', productColor: '红色' }),
  row('BOM-PRINT-BLUE', { printRequirement: '是', printProcess: '数码印花', productColor: '蓝色' }),
  row('BOM-DYE', { dyeRequirement: '是', productColor: '米白色' }),
  row('BOM-ONLY', { shrinkRequirement: '是', washRequirement: '是', waterSolubleRequirement: '是' }),
])

assert.equal(first.createdTaskCount, 0, 'BOM 联动只启用发布时已有骨架，不得新建任务')
assert.equal(first.tasks.filter((task) => task.taskType === 'PATTERN_ARTWORK').length, 1)
assert.equal(first.tasks.filter((task) => task.taskType === 'COLOR_FABRIC').length, 1)
assert.deepEqual(first.techPackOnlyProcesses.sort(), ['水溶', '洗水', '缩水'], '三类要求只进入技术包工艺')
const pattern = first.masterOrder.tasks.find((task) => task.taskType === 'PATTERN_ARTWORK')
const color = first.masterOrder.tasks.find((task) => task.taskType === 'COLOR_FABRIC')
assert.ok(pattern && color)
assert.equal(pattern.status, '待开始')
assert.equal(color.status, '待开始')
assert.deepEqual(pattern.materialLines.map((line) => line.bomItemId), ['BOM-PRINT-RED', 'BOM-PRINT-BLUE'])
assert.deepEqual(color.materialLines.map((line) => line.bomItemId), ['BOM-DYE'])
assert.equal(pattern.materialLines[0]?.materialLineId === pattern.materialLines[1]?.materialLineId, false, '同类物料必须逐行关联')
assert.equal(first.masterOrder.tasks.some((task) => task.taskName.includes('缩水') || task.taskName.includes('洗水') || task.taskName.includes('水溶')), false)

const idempotent = applyBomRequirementsToEngineeringTasks(master.masterOrderId, [
  row('BOM-PRINT-RED', { printRequirement: '是', printProcess: '数码印花', productColor: '红色' }),
  row('BOM-PRINT-BLUE', { printRequirement: '是', printProcess: '数码印花', productColor: '蓝色' }),
  row('BOM-DYE', { dyeRequirement: '是', productColor: '米白色' }),
])
assert.equal(idempotent.masterOrder.tasks.find((task) => task.taskType === 'PATTERN_ARTWORK')?.materialLines.length, 2)
assert.equal(idempotent.masterOrder.tasks.find((task) => task.taskType === 'PATTERN_ARTWORK')?.reworkRounds.length, 0)

const patternTaskId = `${master.masterOrderId}-PATTERN_ARTWORK`
updateEngineeringTaskRecord(master.masterOrderId, patternTaskId, (task) => {
  task.status = '已完成'
  task.startedAt = '2026-08-02 09:00:00'
  task.submittedAt = '2026-08-02 10:00:00'
  task.firstCompletedAt = '2026-08-02 11:00:00'
  task.effectiveCompletedAt = '2026-08-02 11:00:00'
  task.resultImageIds = ['result://whole-task']
  task.materialReviewRounds = [{
    roundNo: 1,
    submittedAt: '2026-08-02 10:00:00',
    submittedBy: '花型团队',
    reviewedAt: '2026-08-02 11:00:00',
    reviewedBy: '买手A',
    decisions: [],
  }]
})

const reworked = applyBomRequirementsToEngineeringTasks(master.masterOrderId, [
  row('BOM-PRINT-RED', { printRequirement: '是' }),
  row('BOM-PRINT-BLUE', { printRequirement: '是' }),
  row('BOM-PRINT-GREEN', { printRequirement: '是', productColor: '绿色' }),
  row('BOM-DYE', { dyeRequirement: '是' }),
])
const reworkedPattern = reworked.masterOrder.tasks.find((task) => task.taskType === 'PATTERN_ARTWORK')
assert.ok(reworkedPattern)
assert.equal(reworkedPattern.status, '返工中', '已完成任务新增物料需求必须进入返工')
assert.equal(reworkedPattern.reworkRounds.length, 1)
assert.equal(reworkedPattern.reworkRounds[0]?.roundNo, 1)
assert.deepEqual(reworkedPattern.resultImageIds, ['result://whole-task'], '历史成果不得丢失')
assert.equal(reworkedPattern.materialReviewRounds.length, 1, '历史审核轮次不得丢失')

const repeatedReworkSync = applyBomRequirementsToEngineeringTasks(master.masterOrderId, [
  row('BOM-PRINT-RED', { printRequirement: '是' }),
  row('BOM-PRINT-BLUE', { printRequirement: '是' }),
  row('BOM-PRINT-GREEN', { printRequirement: '是', productColor: '绿色' }),
  row('BOM-DYE', { dyeRequirement: '是' }),
])
assert.equal(
  repeatedReworkSync.masterOrder.tasks.find((task) => task.taskType === 'PATTERN_ARTWORK')?.reworkRounds.length,
  1,
  '重复同步同一批 BOM 要求不得重复创建返工轮次',
)

const oneRemoved = applyBomRequirementsToEngineeringTasks(master.masterOrderId, [
  row('BOM-PRINT-RED', { printRequirement: '是' }),
  row('BOM-PRINT-BLUE', { printRequirement: '否' }),
  row('BOM-PRINT-GREEN', { printRequirement: '是' }),
  row('BOM-DYE', { dyeRequirement: '是' }),
])
const afterRemoval = oneRemoved.masterOrder.tasks.find((task) => task.taskType === 'PATTERN_ARTWORK')
assert.ok(afterRemoval)
assert.equal(afterRemoval.status, '返工中', '移除一条物料需求不得结束整张任务')
assert.equal(afterRemoval.materialLines.find((line) => line.bomItemId === 'BOM-PRINT-BLUE')?.status, '因需求变更结束')
assert.equal(afterRemoval.materialLines.find((line) => line.bomItemId === 'BOM-PRINT-RED')?.status, '正常')

const missingMaster = createPublishedMaster()
const missingPatternTaskId = `${missingMaster.masterOrderId}-PATTERN_ARTWORK`
updateEngineeringTaskRecord(missingMaster.masterOrderId, missingPatternTaskId, (_task, current) => {
  current.tasks = current.tasks.filter((item) => item.taskType !== 'PATTERN_ARTWORK')
})
const beforeBlocked = getEngineeringMasterOrderById(missingMaster.masterOrderId)
assert.throws(
  () => applyBomRequirementsToEngineeringTasks(missingMaster.masterOrderId, [row('BOM-MISSING', { printRequirement: '是' })]),
  /缺少.*花型任务.*骨架/,
)
assert.deepEqual(getEngineeringMasterOrderById(missingMaster.masterOrderId), beforeBlocked, '缺少骨架时不得部分写入')

const minimalMaster = createPublishedMaster()
const minimal = applyBomRequirementsToEngineeringTasks(minimalMaster.masterOrderId, [{
  bomItemId: 'BOM-MINIMAL',
  printRequirement: '是',
}])
const minimalLine = minimal.masterOrder.tasks
  .find((task) => task.taskType === 'PATTERN_ARTWORK')
  ?.materialLines.find((line) => line.bomItemId === 'BOM-MINIMAL')
assert.equal(minimalLine?.materialSkuId, 'BOM-MINIMAL', '最小 BOM 联动输入应使用行 ID 作为缺省物料标识')
assert.equal(minimalLine?.materialName, 'BOM-MINIMAL', '最小 BOM 联动输入应保留可识别的缺省物料名称')

console.log('pcs-engineering-bom-task-linkage.spec.ts PASS')

import assert from 'node:assert/strict'

import {
  confirmEngineeringIndependentColorRequirement,
  getEngineeringIndependentProfessionalTaskCurrentTeam,
  listEngineeringIndependentSamplingRecords,
  resetEngineeringIndependentSamplingRepository,
  startEngineeringIndependentProfessionalTask,
} from '../src/data/pcs-engineering-master-sampling.ts'

resetEngineeringIndependentSamplingRepository(true)
const record = listEngineeringIndependentSamplingRecords().find((item) =>
  item.professionalTasks.some((task) =>
    (task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC') && task.status === 'WAIT_START',
  ),
)
assert.ok(record, '演示数据必须包含一条待开始的设计改款调色任务')
const colorTask = record.professionalTasks.find((task) =>
  (task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC') && task.status === 'WAIT_START',
)!
const buyer = { role: '买手', userId: record.buyerId, userName: record.buyerName }

assert.equal(colorTask.ownerTeamName, '染厂')
assert.equal(getEngineeringIndependentProfessionalTaskCurrentTeam(colorTask), '买手')
confirmEngineeringIndependentColorRequirement({
  taskId: colorTask.taskId,
  actor: buyer,
  pantoneColorCode: '19-4052 TCX',
  colorName: '经典蓝',
})
assert.throws(() => startEngineeringIndependentProfessionalTask({
  taskId: colorTask.taskId,
  actor: buyer,
}), /当前应由染厂处理/)
const started = startEngineeringIndependentProfessionalTask({
  taskId: colorTask.taskId,
  actor: { role: '染厂', userId: 'DYE-1', userName: '染厂-1' },
})
assert.equal(started.professionalTasks.find((task) => task.taskId === colorTask.taskId)?.status, 'IN_PROGRESS')

console.log('pcs-design-revision-color-team.spec PASS')

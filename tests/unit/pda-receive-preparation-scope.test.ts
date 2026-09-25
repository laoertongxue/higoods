import assert from 'node:assert/strict'
import test from 'node:test'
import { listPdaMobileExecutionTasks } from '../../src/data/fcs/process-mobile-task-binding.ts'
import { filterReceivePendingAcceptTasks, filterReceiveAwardedTaskFacts } from '../../src/data/fcs/pda-receive-scope.ts'

test('接单工厂范围保留全量投影中本厂每个任务的身份、数量、状态及接单/中标结果', () => {
  const cutting = listPdaMobileExecutionTasks('OWN-CUTTING-001', true)
  const full = listPdaMobileExecutionTasks()
  const factories = new Set(['OWN-CUTTING-001', ...full.map(task => task.assignedFactoryId).filter((id): id is string => Boolean(id))])
  let compared = 0
  for (const factoryId of factories) {
    const before = listPdaMobileExecutionTasks(factoryId)
    const after = factoryId === 'OWN-CUTTING-001' ? cutting : listPdaMobileExecutionTasks(factoryId, true)
    const own = (tasks: typeof full) => tasks.filter(task => task.assignedFactoryId === factoryId).sort((a, b) => a.taskId.localeCompare(b.taskId))
    assert.deepEqual(own(after), own(before), factoryId)
    assert.deepEqual(filterReceivePendingAcceptTasks(after, factoryId), filterReceivePendingAcceptTasks(before, factoryId), `${factoryId} 待接单`)
    assert.deepEqual(filterReceiveAwardedTaskFacts(after, factoryId), filterReceiveAwardedTaskFacts(before, factoryId), `${factoryId} 已中标`)
    compared += own(before).length
  }
  assert(compared > 30, '必须覆盖有真实演示任务的工厂，不能只对比空列表')
})

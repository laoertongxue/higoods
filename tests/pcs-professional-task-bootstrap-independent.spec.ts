import assert from 'node:assert/strict'

import { listProjects } from '../src/data/pcs-project-repository.ts'
import { createTaskBootstrapSnapshot } from '../src/data/pcs-task-bootstrap.ts'

const snapshot = createTaskBootstrapSnapshot()
const projectIds = new Set(listProjects().map((project) => project.projectId))
const professionalTasks = [
  ...snapshot.revisionTasks,
  ...snapshot.plateTasks,
  ...snapshot.patternTasks,
  ...snapshot.firstSampleTasks,
  ...snapshot.firstOrderSampleTasks,
]

assert.ok(snapshot.plateTasks.length >= 8, '制版模块应保留足够的真实业务种子')
assert.ok(snapshot.patternTasks.length >= 4, '花型模块应保留足够的真实业务种子')
assert.ok(snapshot.firstSampleTasks.length >= 8, '首版样衣模块应保留足够的真实业务种子')
assert.ok(snapshot.firstOrderSampleTasks.length >= 4, '首单样衣模块应保留足够的真实业务种子')
assert.ok(snapshot.plateTasks.every((task) => task.projectId && !task.projectNodeId), '制版种子只能关联来源项目，不能依赖项目节点')
assert.ok(snapshot.patternTasks.every((task) => task.projectId && !task.projectNodeId), '花型种子只能关联来源项目，不能依赖项目节点')
assert.ok(snapshot.firstSampleTasks.every((task) => task.projectId && !task.projectNodeId), '首版样衣种子只能关联来源项目，不能依赖项目节点')
assert.ok(snapshot.firstOrderSampleTasks.every((task) => task.projectId && !task.projectNodeId), '首单样衣种子只能关联来源项目，不能依赖项目节点')
assert.ok(
  professionalTasks.every((task) => !task.projectId || projectIds.has(task.projectId)),
  '五类专业任务的 projectId 必须指向真实项目',
)
assert.ok(
  professionalTasks.every((task) => !task.projectId || !task.projectNodeId),
  '五类专业任务均为独立任务，不能回写已移除的固定步骤节点',
)
assert.ok(snapshot.plateTasks.every((task) => task.upstreamObjectId && task.upstreamObjectCode), '制版种子必须保留真实来源对象')
assert.ok(snapshot.firstOrderSampleTasks.every((task) => task.upstreamObjectId && task.upstreamObjectCode), '首单样衣种子必须保留真实来源任务')
snapshot.plateTasks.forEach((task) => {
  if (task.sourceType === '改版任务') {
    const upstream = snapshot.revisionTasks.find((item) => item.revisionTaskId === task.upstreamObjectId)
    assert.ok(upstream, `制版任务 ${task.plateTaskCode} 的改版来源必须存在`)
    assert.equal(upstream.projectId, task.projectId, `制版任务 ${task.plateTaskCode} 与改版来源必须属于同一项目`)
    return
  }
  assert.equal(task.sourceType, '人工创建')
  assert.equal(task.upstreamModule, '商品项目')
  assert.equal(task.upstreamObjectType, '商品项目')
  assert.equal(task.upstreamObjectId, task.projectId)
  assert.equal(task.upstreamObjectCode, task.projectCode)
})
snapshot.firstOrderSampleTasks.forEach((task) => {
  assert.equal(task.sourceType, '首版样衣打样')
  const upstream = snapshot.firstSampleTasks.find((item) => item.firstSampleTaskId === task.upstreamObjectId)
  assert.ok(upstream, `首单样衣任务 ${task.firstOrderSampleTaskCode} 的首版样衣来源必须存在`)
  assert.equal(upstream.projectId, task.projectId, `首单样衣任务 ${task.firstOrderSampleTaskCode} 与来源必须属于同一项目`)
})
assert.ok(snapshot.plateTasks.some((task) => task.status === '进行中'))
assert.ok(snapshot.plateTasks.some((task) => task.status === '已完成'))
assert.ok(snapshot.patternTasks.some((task) => task.status === '进行中'))
assert.ok(snapshot.patternTasks.some((task) => task.status === '已完成' || task.status === '已确认'))
assert.ok(snapshot.firstSampleTasks.some((task) => task.status === '打样中'))
assert.ok(snapshot.firstSampleTasks.some((task) => task.status === '已通过'))
assert.ok(snapshot.firstOrderSampleTasks.some((task) => task.status === '打样中'))
assert.ok(snapshot.firstOrderSampleTasks.some((task) => task.status === '已通过'))

console.log('pcs-professional-task-bootstrap-independent.spec.ts PASS')

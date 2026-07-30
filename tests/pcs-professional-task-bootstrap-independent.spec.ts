import assert from 'node:assert/strict'

import { createTaskBootstrapSnapshot } from '../src/data/pcs-task-bootstrap.ts'

const snapshot = createTaskBootstrapSnapshot()

assert.ok(snapshot.patternTasks.length >= 4, '花型模块应保留足够的真实业务种子')
assert.ok(snapshot.firstSampleTasks.length >= 8, '首版样衣模块应保留足够的真实业务种子')
assert.ok(snapshot.patternTasks.every((task) => task.projectId && !task.projectNodeId), '花型种子只能关联来源项目，不能依赖项目节点')
assert.ok(snapshot.firstSampleTasks.every((task) => task.projectId && !task.projectNodeId), '首版样衣种子只能关联来源项目，不能依赖项目节点')
assert.ok(snapshot.patternTasks.some((task) => task.status === '进行中'))
assert.ok(snapshot.patternTasks.some((task) => task.status === '已完成' || task.status === '已确认'))
assert.ok(snapshot.firstSampleTasks.some((task) => task.status === '打样中'))
assert.ok(snapshot.firstSampleTasks.some((task) => task.status === '已通过'))

console.log('pcs-professional-task-bootstrap-independent.spec.ts PASS')

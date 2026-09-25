import test from 'node:test'
import assert from 'node:assert/strict'
import { getFactoryMobileTodoCount, getFactoryMobileTodos } from '../../src/data/fcs/factory-mobile-todos.ts'
import { listPdaTaskFlowTasks } from '../../src/data/fcs/pda-cutting-execution-source.ts'
import { FULL_CAPABILITY_FACTORY_ID } from '../../src/data/fcs/post-finishing-current-read-model.ts'
import { TEST_FACTORY_ID, KOL_GOTO_FACTORY_ID } from '../../src/data/fcs/factory-mock-data.ts'

test('PDA顶栏计数与实际完整待办相同，覆盖各任务工厂及管理员/员工角色', () => {
  const factoryIds = new Set([
    TEST_FACTORY_ID, FULL_CAPABILITY_FACTORY_ID, KOL_GOTO_FACTORY_ID, 'unknown-factory',
    ...listPdaTaskFlowTasks().map(task => task.assignedFactoryId).filter(Boolean),
  ])
  assert.ok(factoryIds.size > 4)
  let nonzero = 0
  for (const factoryId of factoryIds) for (const role of ['ROLE_ADMIN', 'ROLE_OPERATOR']) {
    const count = getFactoryMobileTodoCount(factoryId, role)
    const todos = getFactoryMobileTodos(factoryId, role)
    assert.equal(count, todos.filter(todo => ['待处理', '处理中'].includes(todo.status)).length, `${factoryId}/${role}`)
    if (count) nonzero++
    assert.equal(getFactoryMobileTodoCount(factoryId, role), count, `${factoryId}/${role} 完整列表读取后计数仍一致`)
  }
  assert.ok(nonzero > 4)
})

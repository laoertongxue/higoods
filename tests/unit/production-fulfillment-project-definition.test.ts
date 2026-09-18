import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getProjectStepDefinition, getProjectStepDefinitionById, listProjectStepDefinitions } from '../../src/data/pcs-project-domain-contract.ts'

test('生产准备初始化按编号读取定义与完整目录逐值一致，保留不存在时的契约', () => {
  const definitions = listProjectStepDefinitions()
  for (const definition of definitions) {
    assert.deepEqual(getProjectStepDefinition(definition.stepCode), definition)
    assert.deepEqual(getProjectStepDefinitionById(definition.stepId), definition)
  }
  assert.equal(getProjectStepDefinitionById('not-a-step'), null)
  assert.throws(() => getProjectStepDefinition('not-a-step' as never), /未找到商品项目定义/)
})

test('单定义读取的可编辑数组保持隔离，不污染其他任务读取', () => {
  for (const original of listProjectStepDefinitions()) {
    const copy = getProjectStepDefinition(original.stepCode)
    copy.roleNames.push('不可写回目录')
    copy.businessRules.push('不可写回目录')
    if (copy.fieldDefinitions[0]) copy.fieldDefinitions[0].options?.push('不可写回目录')
    if (copy.operationDefinitions[0]) copy.operationDefinitions[0].preconditions.push('不可写回目录')
    if (copy.statusDefinitions[0]) copy.statusDefinitions[0].entryConditions.push('不可写回目录')
    assert.deepEqual(getProjectStepDefinition(original.stepCode), original)
  }
})

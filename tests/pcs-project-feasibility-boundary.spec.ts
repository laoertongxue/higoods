import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

import { getProjectStepDefinition } from '../src/data/pcs-project-domain-contract.ts'
import { listProjectNodes, listProjects, resetProjectRepository } from '../src/data/pcs-project-repository.ts'

const feasibilityOptions =
  getProjectStepDefinition('FEASIBILITY_REVIEW').fieldDefinitions
    .find((field) => field.fieldKey === 'reviewConclusion')
    ?.options?.map((option) => option.value) ?? []

assert.deepEqual(
  feasibilityOptions,
  ['进入测款', '样衣退回'],
  '商品测款项目内的可行性判断不得包含“重新改版出样衣”',
)

const decisionFlowSource = readFileSync(
  new URL('../src/data/pcs-project-decision-flow-service.ts', import.meta.url),
  'utf8',
)
assert.doesNotMatch(
  decisionFlowSource,
  /routeProjectToRevisionTask|重新改版出样衣|stepCode === 'REVISION_TASK'/,
  '商品测款决策流不得创建或查找改版任务',
)

assert.ok(
  !existsSync(new URL('../src/pages/pcs-projects.ts', import.meta.url)),
  '商品项目详情页应已删除，不得按改版任务改写可行性选项',
)

resetProjectRepository()
const feasibilityProject = listProjects().find((project) => {
  const nodes = listProjectNodes(project.projectId)
  return nodes.some((node) => node.stepCode === 'FEASIBILITY_REVIEW')
})
assert.ok(feasibilityProject, '测试数据应包含可行性判断节点')
const feasibilityNode = listProjectNodes(feasibilityProject!.projectId).find(
  (node) => node.stepCode === 'FEASIBILITY_REVIEW',
)
assert.ok(feasibilityNode)

console.log('pcs-project-feasibility-boundary.spec.ts PASS')

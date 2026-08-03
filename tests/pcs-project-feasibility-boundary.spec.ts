import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { getProjectStepDefinition } from '../src/data/pcs-project-domain-contract.ts'
import { listProjectNodes, listProjects, resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import { renderPcsProjectStepDetailPage } from '../src/pages/pcs-projects.ts'

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
const projectPageSource = readFileSync(new URL('../src/pages/pcs-projects.ts', import.meta.url), 'utf8')
assert.doesNotMatch(
  decisionFlowSource,
  /routeProjectToRevisionTask|重新改版出样衣|stepCode === 'REVISION_TASK'/,
  '商品测款决策流不得创建或查找改版任务',
)
assert.doesNotMatch(projectPageSource, /function projectHasRevisionTask/, '商品测款页面不得按改版任务改写可行性选项')

const fieldPolicySource = projectPageSource.slice(
  projectPageSource.indexOf('function applyProjectFixedFlowFieldPolicy'),
  projectPageSource.indexOf('function getFixedFlowLockedFieldValue'),
)
assert.doesNotMatch(
  fieldPolicySource,
  /REVISION_TASK|重新改版出样衣/,
  '固定流程字段策略不得重新加入改版打样选项',
)

const decisionOptionsSource = projectPageSource.slice(
  projectPageSource.indexOf('function getDecisionOptions'),
  projectPageSource.indexOf('function isDecisionNode'),
)
assert.doesNotMatch(
  decisionOptionsSource,
  /REVISION_TASK|重新改版出样衣/,
  '页面决策选项必须直接使用领域契约，不得按改版任务二次过滤',
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
const feasibilityHtml = await renderPcsProjectStepDetailPage(
  feasibilityProject!.projectId,
  feasibilityNode!.projectNodeId,
)
assert.match(feasibilityHtml, /进入测款/)
assert.match(feasibilityHtml, /样衣退回/)
assert.doesNotMatch(feasibilityHtml, /重新改版出样衣/)

console.log('pcs-project-feasibility-boundary.spec.ts PASS')

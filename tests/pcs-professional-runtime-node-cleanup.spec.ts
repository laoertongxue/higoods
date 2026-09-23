import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

import { buildProjectNodes } from '../src/data/pcs-project-node-factory.ts'
import {
  getProjectNodeRecordByStepCode,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')

const professionalStepCodes = [
  'REVISION_TASK',
  'PATTERN_TASK',
  'PATTERN_ARTWORK_TASK',
  'FIRST_SAMPLE',
  'FIRST_ORDER_SAMPLE',
]

const flowSource = readSource('src/data/pcs-project-flow-service.ts')
assert.doesNotMatch(
  flowSource,
  /node\.stepCode\s*===\s*'(?:FIRST_SAMPLE|FIRST_ORDER_SAMPLE)'/,
  '项目固定步骤完成逻辑不得包含首版或首单专业任务分支',
)
assert.doesNotMatch(
  flowSource,
  /商品项目节点同步完成/,
  '专业任务完成不得再写入“商品项目节点同步完成”旧语义',
)

assert.ok(
  !existsSync(new URL('../src/pages/pcs-projects.ts', import.meta.url)),
  '商品项目详情页文件应已删除，不得恢复首版或首单项目节点渲染',
)

const builtNodes = buildProjectNodes({
  projectId: 'prj_professional_runtime_cleanup',
  ownerId: 'owner-test',
  ownerName: '测试负责人',
  createdAt: '2026-07-31 08:00',
})
assert.deepEqual(
  builtNodes.filter((node) => professionalStepCodes.includes(node.stepCode)),
  [],
  '商品项目步骤只能承载固定五步下的测款办理节点，专业任务必须独立存在',
)

resetProjectRepository()
const project = listProjects()[0]
assert.ok(project, '缺少商品项目演示数据')
for (const stepCode of professionalStepCodes) {
  assert.equal(
    getProjectNodeRecordByStepCode(project!.projectId, stepCode),
    null,
    `${stepCode} 不得作为商品项目步骤节点存在`,
  )
}

console.log('pcs-professional-runtime-node-cleanup.spec.ts PASS')

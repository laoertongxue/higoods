import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { buildProjectNodes } from '../src/data/pcs-project-node-factory.ts'
import {
  getProjectNodeRecordByStepCode,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { renderPcsProjectDetailPage } from '../src/pages/pcs-projects.ts'

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

const projectPageSource = readSource('src/pages/pcs-projects.ts')
assert.doesNotMatch(
  projectPageSource,
  /node\.node\.stepCode\s*===\s*'(?:FIRST_SAMPLE|FIRST_ORDER_SAMPLE)'/,
  '商品项目详情不得把首版或首单任务渲染成项目步骤节点',
)
assert.doesNotMatch(
  projectPageSource,
  /renderFirst(?:Sample|OrderSample)ProjectNodeWorkspace/,
  '商品项目详情不得保留首版或首单项目节点工作区',
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

const html = await renderPcsProjectDetailPage(project!.projectId)
assert.doesNotMatch(html, /请先填写首版样衣必要信息并创建任务/)
assert.doesNotMatch(html, /请先填写首单样衣必要信息并创建任务/)
assert.match(html, /关联工程任务/, '商品项目仍应保留项目级专业任务入口或摘要')

console.log('pcs-professional-runtime-node-cleanup.spec.ts PASS')

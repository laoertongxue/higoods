import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')

const professionalTypeFiles = [
  'src/data/pcs-revision-task-types.ts',
  'src/data/pcs-pattern-task-types.ts',
  'src/data/pcs-plate-making-types.ts',
  'src/data/pcs-first-sample-types.ts',
  'src/data/pcs-first-order-sample-types.ts',
]

const professionalRepositoryFiles = [
  'src/data/pcs-revision-task-repository.ts',
  'src/data/pcs-pattern-task-repository.ts',
  'src/data/pcs-plate-making-repository.ts',
  'src/data/pcs-first-sample-repository.ts',
  'src/data/pcs-first-order-sample-repository.ts',
]

for (const relativePath of [...professionalTypeFiles, ...professionalRepositoryFiles]) {
  const source = readSource(relativePath)
  assert.doesNotMatch(source, /\bprojectNodeId\b/, `${relativePath} 不得保留专业项目节点字段`)
  assert.doesNotMatch(source, /\bstepCode\b|\bstepName\b/, `${relativePath} 不得把专业任务保存成商品项目步骤`)
  assert.doesNotMatch(
    source,
    /\blegacyProjectRef\b|\blegacyUpstreamRef\b/,
    `${relativePath} 不得保留老任务兼容引用`,
  )
}

const writebackSource = readSource('src/data/pcs-task-project-relation-writeback.ts')
assert.doesNotMatch(
  writebackSource,
  /\btask\.(?:projectNodeId|stepCode|stepName|legacyProjectRef|legacyUpstreamRef)\b/,
  '专业任务写回不得读取节点、步骤或老任务兼容字段',
)
assert.doesNotMatch(
  writebackSource,
  /\bstepCode\s*:\s*'(?:REVISION_TASK|PATTERN_TASK|PATTERN_ARTWORK_TASK|FIRST_SAMPLE|FIRST_ORDER_SAMPLE)'/,
  '专业任务创建结果不得写入已删除的专业步骤编码',
)
assert.doesNotMatch(
  writebackSource,
  /\blegacyProjectRef\s*:|\blegacyUpstreamRef\s*:/,
  '专业任务创建结果不得写入老任务兼容字段',
)
assert.doesNotMatch(
  writebackSource,
  /projectNodeId:\s*input\.projectNodeId|stepCode:\s*input\.stepCode|stepName:\s*input\.stepName/,
  '专业任务项目关系不得从任务输入写入节点或步骤',
)

const relationRepositorySource = readSource('src/data/pcs-project-relation-repository.ts')
assert.doesNotMatch(
  relationRepositorySource,
  /listProjectRelationsByProjectNode/,
  '项目关系仓储不得保留按已删除专业节点查询的兼容 API',
)

const projectPageSource = readSource('src/pages/pcs-projects.ts')
assert.doesNotMatch(
  projectPageSource,
  /listProjectRelationsByProjectNodeSafe|findLatestNodeRelation/,
  '商品项目详情必须按商品项目级关系展示专业任务',
)

const sourceNormalizerSource = readSource('src/data/pcs-task-source-normalizer.ts')
assert.doesNotMatch(
  sourceNormalizerSource,
  /migrateLegacyProjectSourceType|项目模板阶段/,
  '专业任务来源不得保留项目模板阶段迁移逻辑',
)

for (const relativePath of [
  'src/pages/pcs-live-testing.ts',
  'src/pages/pcs-video-testing.ts',
]) {
  const source = readSource(relativePath)
  assert.doesNotMatch(source, />\s*(?:SELL|TEST|REVIEW)(?:\s|<)/, `${relativePath} 页面不得展示英文内部码`)
  assert.doesNotMatch(source, /TEST (?:行|条目)/, `${relativePath} 页面不得展示英文测试行语义`)
}

console.log('pcs-professional-task-model-semantic-closure.spec.ts PASS')

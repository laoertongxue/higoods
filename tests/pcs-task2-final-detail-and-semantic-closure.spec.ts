import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { renderPcsSampleInventoryPage } from '../src/pages/pcs-sample-management.ts'
import { renderPcsPatternTaskPage } from '../src/pages/pcs-engineering-tasks/pattern-task.ts'

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')

const samplePageSource = readSource('src/pages/pcs-sample-management.ts')
const sampleDataSource = readSource('src/data/pcs-sample-management.ts')
assert.doesNotMatch(samplePageSource, /关联项目|工作项/, '样衣管理页面必须使用商品项目和来源步骤口径')
assert.doesNotMatch(
  `${samplePageSource}\n${sampleDataSource}`,
  /relatedStepName|stepDefinitionName/,
  '样衣管理模型必须使用来源步骤字段，不得保留工作项定义字段',
)
const sampleHtml = renderPcsSampleInventoryPage()
assert.match(sampleHtml, /商品项目/, '样衣库存必须展示商品项目归属')
assert.match(sampleHtml, /来源步骤/, '样衣库存必须展示来源步骤')

const patternPageSource = readSource('src/pages/pcs-engineering-tasks/shared.ts')
assert.match(
  patternPageSource,
  /pattern:\s*\[[^\]]*\{ key: 'project', required: true, freezeable: true \}/,
  '花型列规则必须声明不可隐藏的商品项目列',
)
const patternHtml = renderPcsPatternTaskPage()
assert.doesNotMatch(
  patternHtml,
  /data-nav="\/pcs\/projects\//,
  '商品项目模块删除后，花型列表不得再提供已删除的项目详情入口',
)
assert.doesNotMatch(
  patternHtml,
  /data-nav="\/pcs\/testing\//,
  '旧测款模块删除后，花型列表不得再提供已删除的测款详情入口',
)

for (const relativePath of [
  'src/data/pcs-pattern-task-repository.ts',
  'src/data/pcs-first-sample-repository.ts',
  'src/data/pcs-plate-making-repository.ts',
  'src/data/pcs-first-order-sample-repository.ts',
]) {
  assert.doesNotMatch(
    readSource(relativePath),
    /\w+ByProjectNode/,
    `${relativePath} 不得保留零调用的项目节点查询兼容 API`,
  )
  assert.doesNotMatch(
    readSource(relativePath),
    /从项目节点生成|项目节点生成档案/,
    `${relativePath} 不得表述为从项目节点生成商品档案`,
  )
}

for (const relativePath of [
  'src/pages/pcs-product-archives.ts',
  'src/data/pcs-project-inline-node-record-bootstrap.ts',
  'src/data/pcs-channel-product-project-repository.ts',
  'src/data/pcs-project-closure-view-model.ts',
]) {
  assert.doesNotMatch(
    readSource(relativePath),
    /完善商品档案节点|完善商品档案/,
    `${relativePath} 必须统一为已有档案口径，不得保留完善商品档案旧节点文案`,
  )
}

const taskBootstrapSource = readSource('src/data/pcs-task-bootstrap.ts')
assert.doesNotMatch(
  taskBootstrapSource,
  /WI-LEGACY|(?:RT|AT|FS|PP)-LEGACY|历史(?:改版|既有商品改款|花型|首版样衣打样|首单样衣打样)任务|任务已迁移|任务迁移/,
  '专业任务 bootstrap 只提供当前项目级演示数据，不得包含老任务迁移 Mock、工作项引用或迁移文案',
)

console.log('pcs-task2-final-detail-and-semantic-closure.spec.ts PASS')

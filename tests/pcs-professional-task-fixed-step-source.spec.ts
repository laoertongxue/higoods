import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createTaskBootstrapSnapshot } from '../src/data/pcs-task-bootstrap.ts'
import {
  PATTERN_TASK_SOURCE_TYPE_LIST,
  PLATE_TASK_SOURCE_TYPE_LIST,
  normalizePatternTaskSourceType,
  normalizePlateTaskSourceType,
} from '../src/data/pcs-task-source-normalizer.ts'

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const fixedStepSourceType = '商品项目'

assert.ok(PLATE_TASK_SOURCE_TYPE_LIST.includes(fixedStepSourceType), '制版来源类型必须公开“商品项目”')
assert.ok(PATTERN_TASK_SOURCE_TYPE_LIST.includes(fixedStepSourceType), '花型来源类型必须公开“商品项目”')
assert.equal(PLATE_TASK_SOURCE_TYPE_LIST.includes('项目模板阶段' as never), false)
assert.equal(PATTERN_TASK_SOURCE_TYPE_LIST.includes('项目模板阶段' as never), false)
assert.equal(normalizePlateTaskSourceType('项目模板阶段'), fixedStepSourceType, '读取旧制版来源时必须迁移为新语义')
assert.equal(normalizePatternTaskSourceType('项目模板阶段'), fixedStepSourceType, '读取旧花型来源时必须迁移为新语义')

const snapshot = createTaskBootstrapSnapshot()
const fixedStepTasks = [...snapshot.plateTasks, ...snapshot.patternTasks].filter(
  (task) => task.sourceType === fixedStepSourceType,
)
assert.ok(fixedStepTasks.length > 0, '专业任务演示数据必须包含商品项目来源')
fixedStepTasks.forEach((task) => {
  assert.equal(task.upstreamModule, '商品项目')
  assert.equal(task.upstreamObjectType, '商品项目')
  assert.ok(task.projectId, '商品项目来源必须关联商品项目')
  assert.equal(task.projectNodeId, '', '专业任务不重新绑定已删除的旧节点')
})

const productionFiles = [
  'src/data/pcs-task-bootstrap.ts',
  'src/data/pcs-task-project-relation-writeback.ts',
  'src/pages/pcs-engineering-tasks.ts',
]
productionFiles.forEach((relativePath) => {
  const source = readFileSync(resolve(repositoryRoot, relativePath), 'utf8')
  assert.doesNotMatch(
    source,
    /项目模板阶段|项目模板节点|项目模板|模板阶段|项目工作项|工作项节点|工作项状态/,
    `${relativePath} 不得展示或保存旧项目模板／旧节点来源语义`,
  )
})

const engineeringPageSource = readFileSync(resolve(repositoryRoot, 'src/pages/pcs-engineering-tasks.ts'), 'utf8')
assert.doesNotMatch(engineeringPageSource, /project\?\.templateId|project\?\.templateVersion/, '项目任务来源不得读取已删除的模板字段')
assert.match(engineeringPageSource, /sourceType: projectMode \? '商品项目' : '人工创建'/, '提交时必须按创建方式锁定来源类型')
assert.match(engineeringPageSource, /bindingMode === 'project' \? '商品项目' : '人工创建'/, '交互时必须按创建方式锁定来源类型')
assert.doesNotMatch(
  engineeringPageSource,
  /upstreamObjectType: projectMode \? '项目步骤' : '款式档案'/,
  '页面关联商品项目时不得伪造成某个具体项目步骤',
)
assert.doesNotMatch(
  engineeringPageSource,
  /\{ label: '项目步骤'|\{ label: '关联项目节点'/,
  '专业任务详情不得展示不存在的项目步骤关系',
)

const independentRevisionTasks = snapshot.revisionTasks.filter((task) => !task.projectId)
assert.ok(independentRevisionTasks.length > 0, '必须保留独立改款／设计任务')
independentRevisionTasks.forEach((task) => {
  assert.ok(task.sourceType === '既有商品改款' || task.sourceType === '人工改版需求')
  assert.equal(task.projectNodeId, '')
})

console.log('pcs-professional-task-fixed-step-source.spec.ts PASS')

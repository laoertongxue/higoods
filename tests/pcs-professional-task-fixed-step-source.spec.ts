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
assert.equal(normalizePlateTaskSourceType('商品项目'), fixedStepSourceType)
assert.equal(normalizePatternTaskSourceType('商品项目'), fixedStepSourceType)

const snapshot = createTaskBootstrapSnapshot()
const fixedStepTasks = [...snapshot.plateTasks, ...snapshot.patternTasks].filter(
  (task) => task.sourceType === fixedStepSourceType,
)
assert.ok(fixedStepTasks.length > 0, '专业任务演示数据必须包含商品项目来源')
fixedStepTasks.forEach((task) => {
  assert.equal(task.upstreamModule, '商品项目')
  assert.equal(task.upstreamObjectType, '商品项目')
  assert.ok(task.projectId, '商品项目来源必须关联商品项目')
  assert.equal('projectNodeId' in task, false, '专业任务不保存商品项目节点字段')
})

const productionFiles = [
  'src/data/pcs-task-bootstrap.ts',
  'src/data/pcs-task-project-relation-writeback.ts',
  'src/pages/pcs-engineering-tasks/plate-making-task.ts',
  'src/pages/pcs-engineering-tasks/pattern-task.ts',
]
productionFiles.forEach((relativePath) => {
  const source = readFileSync(resolve(repositoryRoot, relativePath), 'utf8')
  assert.doesNotMatch(
    source,
    /项目模板阶段|项目模板节点|项目模板|模板阶段|项目工作项|工作项节点|工作项状态/,
    `${relativePath} 不得展示或保存旧项目模板／旧节点来源语义`,
  )
})

const professionalTasks = [...snapshot.plateTasks, ...snapshot.patternTasks]
const designRevisionTasks = professionalTasks.filter((task) => task.sourceType === '设计改款任务')
assert.ok(designRevisionTasks.length > 0, '专业任务演示数据必须包含设计改款任务来源')
designRevisionTasks.forEach((task) => {
  assert.equal(task.upstreamModule, '设计改款任务')
  assert.equal(task.upstreamObjectType, '设计改款任务')
  assert.match(task.upstreamObjectCode, /^ES-DR-/)
  assert.equal('projectNodeId' in task, false)
})

const bootstrapSource = readFileSync(resolve(repositoryRoot, 'src/data/pcs-task-bootstrap.ts'), 'utf8')
assert.doesNotMatch(bootstrapSource, /设计师款|改版任务|设计打样任务|改款打样任务/, '专业任务来源不得保留已取消的设计／改款分类文案')
assert.equal('revisionTasks' in snapshot, false, '任务事实源不得保留旧改版任务集合')

console.log('pcs-professional-task-fixed-step-source.spec.ts PASS')

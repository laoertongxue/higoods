import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { listFirstOrderSourceFirstSampleOptions } from '../src/data/pcs-first-order-sample-project-writeback.ts'
import { listFirstSampleTasks } from '../src/data/pcs-first-sample-repository.ts'
import { listPatternAssets } from '../src/data/pcs-pattern-library.ts'
import { listPatternTasks } from '../src/data/pcs-pattern-task-repository.ts'
import { createTaskBootstrapSnapshot } from '../src/data/pcs-task-bootstrap.ts'

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')

const engineeringPageSource = readSource('src/pages/pcs-engineering-tasks.ts')
assert.doesNotMatch(
  engineeringPageSource,
  /\btask\.stepCode\b/,
  '专业任务页面不得读取已删除的专业步骤编码',
)
assert.match(
  engineeringPageSource,
  /listFirstOrderSourceFirstSampleOptions\(projectId\)/,
  '首单来源标签必须按项目查询真实首版样衣结果',
)

const reusableFirstSample = listFirstSampleTasks().find(
  (task) => task.projectId && task.status === '已通过' && task.sampleCode,
)
assert.ok(reusableFirstSample, '缺少已通过且有结果编号的首版样衣任务')
const sourceOptions = listFirstOrderSourceFirstSampleOptions(reusableFirstSample!.projectId)
assert.ok(
  sourceOptions.some(
    (option) =>
      option.taskId === reusableFirstSample!.firstSampleTaskId &&
      option.sampleCode === reusableFirstSample!.sampleCode,
  ),
  '首单创建必须能读取同项目已通过的真实首版样衣结果',
)

const allowedFirstSampleSourceTypes = new Set(['制版任务', '花型任务', '改版任务', '人工创建'])
const firstSampleSeeds = createTaskBootstrapSnapshot().firstSampleTasks
assert.ok(firstSampleSeeds.length > 0, '缺少首版样衣演示任务')
for (const task of firstSampleSeeds) {
  assert.ok(
    allowedFirstSampleSourceTypes.has(task.sourceType),
    `首版任务 ${task.firstSampleTaskCode} 来源类型不合法：${task.sourceType}`,
  )
  if (task.upstreamModule === '制版任务' || task.upstreamModule === '花型任务' || task.upstreamModule === '改版任务') {
    assert.equal(task.sourceType, task.upstreamModule, '首版来源类型必须与真实上游任务一致')
  }
}

assert.doesNotMatch(
  engineeringPageSource,
  /sourceTaskType:\s*task\.stepCode/,
  '花型资产不得从已删除步骤字段写入来源任务类型',
)
const techPackSource = readSource('src/data/pcs-tech-pack-task-generation.ts')
assert.doesNotMatch(
  techPackSource,
  /source_task_type:\s*task\.stepCode/,
  '技术包回写花型资产不得从已删除步骤字段写入来源任务类型',
)

for (const task of listPatternTasks()) {
  const asset = listPatternAssets().find((item) => item.source_task_id === task.patternTaskId)
  if (!asset) continue
  assert.equal(
    asset.source_task_type,
    'PATTERN_ARTWORK_TASK',
    '花型资产必须保存明确的花型专业任务类型',
  )
}

console.log('pcs-professional-runtime-source-resolution.spec.ts PASS')

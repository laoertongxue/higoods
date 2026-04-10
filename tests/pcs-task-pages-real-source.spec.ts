import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  listRevisionTaskPendingItems,
  resetRevisionTaskRepository,
} from '../src/data/pcs-revision-task-repository.ts'
import { resetPlateMakingTaskRepository } from '../src/data/pcs-plate-making-repository.ts'
import { resetPatternTaskRepository } from '../src/data/pcs-pattern-task-repository.ts'
import { resetFirstSampleTaskRepository } from '../src/data/pcs-first-sample-repository.ts'
import { resetPreProductionSampleTaskRepository } from '../src/data/pcs-pre-production-sample-repository.ts'

function read(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const revisionPageSource = read('src/pages/pcs-revision-task.ts')
assert.ok(revisionPageSource.includes('listRevisionTasks'), '改版任务页应读取正式改版任务仓储')
assert.ok(revisionPageSource.includes('createRevisionTaskWithProjectRelation'), '改版任务页应走正式创建服务')
assert.ok(revisionPageSource.includes('createDownstreamTasksFromRevision'), '改版任务页应走正式下游批量创建服务')
assert.ok(!revisionPageSource.includes('mockTasks'), '改版任务页不应再以内置 mockTasks 作为主来源')
assert.ok(!revisionPageSource.includes('mockTaskDetail'), '改版任务页不应再以内置 mockTaskDetail 作为主来源')
assert.ok(!revisionPageSource.includes("console.log('创建下游任务"), '改版任务页不应再只输出下游勾选结果')

const platePageSource = read('src/pages/pcs-plate-making.ts')
assert.ok(platePageSource.includes('listPlateMakingTasks'), '制版任务页应读取正式制版任务仓储')
assert.ok(platePageSource.includes('createPlateMakingTaskWithProjectRelation'), '制版任务页应走正式创建服务')
assert.ok(!platePageSource.includes('mockTasks'), '制版任务页不应再以内置 mockTasks 作为主来源')
assert.ok(!platePageSource.includes('console.log('), '制版任务页不应再只输出 console.log')

const patternPageSource = read('src/pages/pcs-pattern-task.ts')
assert.ok(patternPageSource.includes('listPatternTasks'), '花型任务页应读取正式花型任务仓储')
assert.ok(patternPageSource.includes('createPatternTaskWithProjectRelation'), '花型任务页应走正式创建服务')
assert.ok(!patternPageSource.includes('mockTasks'), '花型任务页不应再以内置 mockTasks 作为主来源')

const firstSamplePageSource = read('src/pages/pcs-first-order-sample.ts')
assert.ok(firstSamplePageSource.includes('listFirstSampleTasks'), '首版样衣打样页应读取正式首版样衣打样仓储')
assert.ok(firstSamplePageSource.includes('createFirstSampleTaskWithProjectRelation'), '首版样衣打样页应走正式创建服务')
assert.ok(!firstSamplePageSource.includes('首单样衣打样'), '首版样衣打样页面不应再出现首单文案')

const preProductionPageSource = read('src/pages/pcs-pre-production-sample.ts')
assert.ok(preProductionPageSource.includes('listPreProductionSampleTasks'), '产前版样衣页应读取正式产前版样衣仓储')
assert.ok(preProductionPageSource.includes('createPreProductionSampleTaskWithProjectRelation'), '产前版样衣页应走正式创建服务')
assert.ok(!preProductionPageSource.includes('首单样衣打样'), '产前版样衣页面不应再出现首单文案')

const detailPageSource = read('src/pages/pcs-project-detail.ts')
assert.ok(detailPageSource.includes('taskRelationDetail'), '项目详情页应能展示正式任务关系详情')

const nodeDetailPageSource = read('src/pages/pcs-project-work-item-detail.ts')
assert.ok(nodeDetailPageSource.includes('taskRelationDetail'), '项目节点详情页应能展示正式任务关系详情')

resetRevisionTaskRepository()
resetPlateMakingTaskRepository()
resetPatternTaskRepository()
resetFirstSampleTaskRepository()
resetPreProductionSampleTaskRepository()

const revisionPendingItems = listRevisionTaskPendingItems()
assert.ok(
  revisionPendingItems.some((item) => item.rawProjectField === 'PRJ-404-NOT-FOUND'),
  '旧任务迁移时，项目不存在的记录应进入待补齐清单',
)

console.log('pcs-task-pages-real-source.spec.ts PASS')

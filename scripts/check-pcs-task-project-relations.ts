import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const taskWritebackSource = read('src/data/pcs-task-project-relation-writeback.ts')
assert.ok(taskWritebackSource.includes('upsertProjectRelation'), '正式任务创建必须写项目关系仓储')
assert.ok(taskWritebackSource.includes('updateProjectNodeRecord'), '正式任务创建必须回写项目节点')

const revisionPageSource = read('src/pages/pcs-revision-task.ts')
assert.ok(revisionPageSource.includes('listRevisionTasks'), '改版任务页必须读取正式改版任务仓储')
assert.ok(revisionPageSource.includes('createRevisionTaskWithProjectRelation'), '改版任务页必须调用正式改版任务创建服务')
assert.ok(revisionPageSource.includes('createDownstreamTasksFromRevision'), '改版任务页的确认创建下游必须调用正式批量创建服务')
assert.ok(!revisionPageSource.includes('mockTasks'), '改版任务页不允许继续以内置 mockTasks 作为主渲染来源')
assert.ok(!revisionPageSource.includes('mockTaskDetail'), '改版任务页不允许继续以内置 mockTaskDetail 作为主渲染来源')
assert.ok(!revisionPageSource.includes("console.log('创建下游任务"), '改版任务页的确认创建下游不允许继续只输出勾选结果')

const platePageSource = read('src/pages/pcs-plate-making.ts')
assert.ok(platePageSource.includes('listPlateMakingTasks'), '制版任务页必须读取正式制版任务仓储')
assert.ok(platePageSource.includes('createPlateMakingTaskWithProjectRelation'), '制版任务页必须调用正式制版任务创建服务')
assert.ok(!platePageSource.includes('mockTasks'), '制版任务页不允许继续以内置 mockTasks 作为主渲染来源')
assert.ok(!platePageSource.includes('console.log('), '制版任务页不允许继续只输出 console.log')

const patternPageSource = read('src/pages/pcs-pattern-task.ts')
assert.ok(patternPageSource.includes('listPatternTasks'), '花型任务页必须读取正式花型任务仓储')
assert.ok(patternPageSource.includes('createPatternTaskWithProjectRelation'), '花型任务页必须调用正式花型任务创建服务')
assert.ok(!patternPageSource.includes('mockTasks'), '花型任务页不允许继续以内置 mockTasks 作为主渲染来源')

const firstSamplePageSource = read('src/pages/pcs-first-order-sample.ts')
assert.ok(firstSamplePageSource.includes('listFirstSampleTasks'), '首版样衣打样页必须读取正式任务仓储')
assert.ok(firstSamplePageSource.includes('createFirstSampleTaskWithProjectRelation'), '首版样衣打样页必须调用正式创建服务')
assert.ok(!firstSamplePageSource.includes('首单样衣打样'), '首版样衣打样页面可见文案不允许出现首单')

const preProductionPageSource = read('src/pages/pcs-pre-production-sample.ts')
assert.ok(preProductionPageSource.includes('listPreProductionSampleTasks'), '产前版样衣页必须读取正式任务仓储')
assert.ok(preProductionPageSource.includes('createPreProductionSampleTaskWithProjectRelation'), '产前版样衣页必须调用正式创建服务')
assert.ok(!preProductionPageSource.includes('首单样衣打样'), '产前版样衣页面可见文案不允许出现首单')

const relationRepositorySource = read('src/data/pcs-project-relation-repository.ts')
assert.ok(relationRepositorySource.includes('listProjectRelationsByTaskSource'), '项目关系仓储必须支持按正式任务来源查询')

const detailPageSource = read('src/pages/pcs-project-detail.ts')
assert.ok(detailPageSource.includes('taskRelationDetail'), '项目详情页任务关系读取必须来自正式项目关系视图数据')
assert.ok(!detailPageSource.includes('mockTaskDetail'), '项目详情页不允许继续读取页面演示型任务详情')

const nodeDetailPageSource = read('src/pages/pcs-project-work-item-detail.ts')
assert.ok(nodeDetailPageSource.includes('taskRelationDetail'), '项目节点详情页任务关系读取必须来自正式项目关系视图数据')
assert.ok(!nodeDetailPageSource.includes('mockTaskDetail'), '项目节点详情页不允许继续读取页面演示型任务详情')

console.log('check-pcs-task-project-relations.ts PASS')

import assert from 'node:assert/strict'

import {
  getProjectNodeRecordByWorkItemTypeCode,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetPlateMakingTaskRepository } from '../src/data/pcs-plate-making-repository.ts'
import { listFirstSampleTasksByProjectNode, resetFirstSampleTaskRepository } from '../src/data/pcs-first-sample-repository.ts'
import { syncFirstSampleTaskToProjectNode } from '../src/data/pcs-first-sample-project-writeback.ts'
import { renderPcsProjectWorkItemDetailPage } from '../src/pages/pcs-projects.ts'

resetProjectRepository()
resetPlateMakingTaskRepository()
resetFirstSampleTaskRepository()
resetProjectRelationRepository()

const project = listProjects().find((item) => item.projectCode === 'PRJ-20251216-027')
assert.ok(project, '缺少首版样衣完成展示 mock 项目')
const node = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'FIRST_SAMPLE')
assert.ok(node, '缺少 FIRST_SAMPLE 项目节点')
const task = listFirstSampleTasksByProjectNode(project.projectId, node.projectNodeId)[0]
assert.ok(task, '缺少完成态首版样衣任务')

const syncResult = syncFirstSampleTaskToProjectNode({
  firstSampleTaskId: task.firstSampleTaskId,
  operatorName: '测试用户',
})
assert.equal(syncResult.ok, true)
assert.equal(syncResult.projectNode?.currentStatus, '已完成')

const html = await renderPcsProjectWorkItemDetailPage(project.projectId, node.projectNodeId)
for (const text of [
  'PT-20260425-008',
  'TDV-20260425-008',
  '深圳工厂02',
  '正确布',
  '首单复用候选',
  'FS-RESULT-25001',
  'mock://sample-result/fs-25001-1',
  '版型确认通过，肩线与胸围合适。',
  '花型位置与颜色确认通过。',
  '可作为首单复用候选。',
  '首版样衣确认通过，可直接复用。',
  '2026-04-25 10:30',
]) {
  assert.ok(html.includes(text), `完成节点页面缺少字段：${text}`)
}

assert.ok(!html.includes('首版样衣打样缺少正式来源对象'), '完成节点不应提示缺少正式来源对象')

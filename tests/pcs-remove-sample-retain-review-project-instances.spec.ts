import assert from 'node:assert/strict'

import { listProjectInlineNodeRecords, resetProjectInlineNodeRecordRepository } from '../src/data/pcs-project-inline-node-record-repository.ts'
import { listProjectRelations, resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { listProjectNodes, listProjects, resetProjectRepository } from '../src/data/pcs-project-repository.ts'

resetProjectRepository()
resetProjectRelationRepository()
resetProjectInlineNodeRecordRepository()

const projects = listProjects()

assert.ok(projects.length > 0, '应存在演示商品项目')

for (const project of projects) {
  const nodes = listProjectNodes(project.projectId)
  assert.ok(
    !nodes.some((node) => node.stepCode === 'SAMPLE_RETAIN_REVIEW' || node.stepName === '样衣留存评估'),
    `${project.projectCode} 不应再存在样衣留存评估节点`,
  )
  assert.ok(
    nodes.some((node) => node.stepCode === 'SAMPLE_RETURN_HANDLE' && node.phaseCode === 'PHASE_05'),
    `${project.projectCode} 应存在项目收尾阶段的样衣退回处理节点`,
  )
}

assert.ok(
  !listProjectInlineNodeRecords().some((record) => record.stepCode === 'SAMPLE_RETAIN_REVIEW'),
  '项目内正式记录中不应再存在 SAMPLE_RETAIN_REVIEW',
)
assert.ok(
  !listProjectRelations().some((relation) => relation.stepCode === 'SAMPLE_RETAIN_REVIEW'),
  '项目关系中不应再存在 SAMPLE_RETAIN_REVIEW',
)

console.log('pcs-remove-sample-retain-review-project-instances.spec.ts PASS')

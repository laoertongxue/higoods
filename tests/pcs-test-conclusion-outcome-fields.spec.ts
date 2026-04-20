import assert from 'node:assert/strict'

import { submitProjectTestingConclusion, resetProjectChannelProductRepository } from '../src/data/pcs-channel-product-project-repository.ts'
import { getProjectWorkItemContract } from '../src/data/pcs-project-domain-contract.ts'
import {
  getLatestProjectInlineNodeRecord,
  resetProjectInlineNodeRecordRepository,
} from '../src/data/pcs-project-inline-node-record-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import {
  getProjectById,
  getProjectNodeRecordByWorkItemTypeCode,
  listProjectNodes,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { renderPcsProjectWorkItemDetailPage } from '../src/pages/pcs-projects.ts'

function resetAllRepositories(): void {
  resetProjectRepository()
  resetProjectRelationRepository()
  resetProjectInlineNodeRecordRepository()
  resetProjectChannelProductRepository()
}

function getProjectByCode(projectCode: string) {
  const project = listProjects().find((item) => item.projectCode === projectCode)
  assert.ok(project, `应存在演示项目 ${projectCode}`)
  return project!
}

function submitConclusionForProject(projectCode: string, conclusion: '通过' | '淘汰') {
  resetAllRepositories()

  const project = getProjectByCode(projectCode)
  const conclusionNode = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'TEST_CONCLUSION')
  assert.ok(conclusionNode, `${projectCode} 应存在测款结论节点`)

  const result = submitProjectTestingConclusion(
    project.projectId,
    {
      conclusion,
      note: `测款结论为${conclusion}，验证正式后果字段回写。`,
    },
    '测试用户',
  )
  assert.equal(result.ok, true, `${projectCode} 应允许提交 ${conclusion} 结论`)

  const latestNode = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'TEST_CONCLUSION')
  assert.ok(latestNode)
  const latestRecord = getLatestProjectInlineNodeRecord(latestNode!.projectNodeId)
  assert.ok(latestRecord)

  return {
    project: getProjectById(project.projectId)!,
    node: latestNode!,
    sampleReturnNode: getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'SAMPLE_RETURN_HANDLE')!,
    payload: (latestRecord!.payload || {}) as Record<string, unknown>,
    htmlPromise: renderPcsProjectWorkItemDetailPage(project.projectId, latestNode!.projectNodeId),
    allNodes: listProjectNodes(project.projectId),
  }
}

const contract = getProjectWorkItemContract('TEST_CONCLUSION')
const fieldKeys = contract.fieldDefinitions.map((field) => field.fieldKey)

assert.ok(fieldKeys.includes('linkedStyleId'))
assert.ok(fieldKeys.includes('linkedStyleCode'))
assert.ok(fieldKeys.includes('invalidatedChannelProductId'))
assert.ok(fieldKeys.includes('nextActionType'))
assert.ok(!fieldKeys.includes('revisionTaskId'))
assert.ok(!fieldKeys.includes('revisionTaskCode'))
assert.ok(!fieldKeys.includes('projectTerminated'))
assert.ok(!fieldKeys.includes('projectTerminatedAt'))

const throughCase = submitConclusionForProject('PRJ-20251216-013', '通过')
const throughHtml = await throughCase.htmlPromise
assert.ok(throughCase.payload.linkedStyleId)
assert.ok(throughCase.payload.linkedStyleCode)
assert.equal(throughCase.payload.nextActionType, '生成款式档案')
assert.equal(throughCase.project.projectStatus, '进行中')
assert.equal(throughCase.sampleReturnNode.currentStatus, '未开始')
assert.match(throughHtml, /关联款式档案编码/)
assert.match(throughHtml, /生成款式档案/)

const eliminatedCase = submitConclusionForProject('PRJ-20251216-020', '淘汰')
const eliminatedHtml = await eliminatedCase.htmlPromise
assert.ok(eliminatedCase.payload.invalidatedChannelProductId)
assert.equal(eliminatedCase.payload.nextActionType, '样衣退回处理')
assert.equal(eliminatedCase.project.projectStatus, '进行中')
assert.equal(eliminatedCase.sampleReturnNode.currentStatus, '进行中')
assert.equal(
  eliminatedCase.allNodes.find((node) => node.currentStatus === '进行中')?.workItemTypeCode,
  'SAMPLE_RETURN_HANDLE',
)
assert.ok(
  eliminatedCase.allNodes
    .filter((node) => node.workItemTypeCode !== 'TEST_CONCLUSION' && node.workItemTypeCode !== 'SAMPLE_RETURN_HANDLE')
    .some((node) => node.currentStatus === '已取消'),
  '淘汰后应取消中间未完成节点',
)
assert.match(eliminatedHtml, /样衣退回处理/)
assert.doesNotMatch(eliminatedHtml, /项目终止时间/)

console.log('pcs-test-conclusion-outcome-fields.spec.ts PASS')

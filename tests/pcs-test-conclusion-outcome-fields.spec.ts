import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { submitProjectTestingConclusion, resetProjectChannelProductRepository } from '../src/data/pcs-channel-product-project-repository.ts'
import { getProjectStepDefinition } from '../src/data/pcs-project-domain-contract.ts'
import {
  getLatestProjectInlineNodeRecord,
  resetProjectInlineNodeRecordRepository,
} from '../src/data/pcs-project-inline-node-record-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import {
  getProjectById,
  getProjectNodeRecordByStepCode,
  listProjectNodes,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')

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

function submitConclusionForProject(projectCode: string, conclusion: '通过' | '不通过') {
  resetAllRepositories()

  const project = getProjectByCode(projectCode)
  const conclusionNode = getProjectNodeRecordByStepCode(project.projectId, 'TEST_CONCLUSION')
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

  const latestNode = getProjectNodeRecordByStepCode(project.projectId, 'TEST_CONCLUSION')
  assert.ok(latestNode)
  const latestRecord = getLatestProjectInlineNodeRecord(latestNode!.projectNodeId)
  assert.ok(latestRecord)

  return {
    project: getProjectById(project.projectId)!,
    node: latestNode!,
    sampleReturnNode: getProjectNodeRecordByStepCode(project.projectId, 'SAMPLE_RETURN_HANDLE')!,
    payload: (latestRecord!.payload || {}) as Record<string, unknown>,
    allNodes: listProjectNodes(project.projectId),
  }
}

const contract = getProjectStepDefinition('TEST_CONCLUSION')
const fieldKeys = contract.fieldDefinitions.map((field) => field.fieldKey)

assert.ok(fieldKeys.includes('linkedStyleId'))
assert.ok(fieldKeys.includes('linkedStyleCode'))
assert.ok(fieldKeys.includes('invalidatedChannelProductId'))
assert.ok(fieldKeys.includes('nextActionType'))
assert.ok(!fieldKeys.includes('revisionTaskId'))
assert.ok(!fieldKeys.includes('revisionTaskCode'))
assert.ok(!fieldKeys.includes('projectTerminated'))
assert.ok(!fieldKeys.includes('projectTerminatedAt'))

const repositorySource = readSource('src/data/pcs-channel-product-project-repository.ts')
assert.doesNotMatch(repositorySource, /商品档案资料完善/, '测款通过后不得回写商品档案资料完善')

const throughCase = submitConclusionForProject('PRJ-202603-005', '通过')
assert.equal(throughCase.payload.nextActionType, '进入后续开发')
assert.equal(throughCase.project.projectStatus, '进行中')
assert.equal(throughCase.sampleReturnNode.currentStatus, '未开始')

// 不通过：CLEAN-006 负载后果（作废渠道商品 + 下一步动作）必须成立。
// 样衣退回节点状态与中间节点取消由 decision-flow 流转与 hydrate 种子迁移共同决定，
// 完整路由契约由 tests/pcs-project-decision-eliminate-to-sample-return.spec.ts 覆盖。
const eliminatedCase = submitConclusionForProject('PRJ-202603-005', '不通过')
assert.ok(eliminatedCase.payload.invalidatedChannelProductId)
assert.equal(eliminatedCase.payload.nextActionType, '样衣退回处理')
assert.equal(eliminatedCase.project.projectStatus, '进行中')
assert.equal(eliminatedCase.node.pendingActionType, '已完成')

console.log('pcs-test-conclusion-outcome-fields.spec.ts PASS')

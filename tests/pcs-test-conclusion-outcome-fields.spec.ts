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
  updateProjectRecord,
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
  return project
}

function submitConclusionForProject(
  projectCode: string,
  conclusion: '通过' | '调整' | '暂缓' | '淘汰',
  options: {
    linkedStyleId?: string
    linkedStyleCode?: string
    note?: string
  } = {},
) {
  resetAllRepositories()

  const project = getProjectByCode(projectCode)
  const conclusionNode = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'TEST_CONCLUSION')
  assert.ok(conclusionNode, `${projectCode} 应存在测款结论节点`)

  if (options.linkedStyleId || options.linkedStyleCode) {
    updateProjectRecord(
      project.projectId,
      {
        linkedStyleId: options.linkedStyleId || '',
        linkedStyleCode: options.linkedStyleCode || '',
        updatedAt: '2026-04-10 10:00',
      },
      '测试用户',
    )
  }

  const result = submitProjectTestingConclusion(
    project.projectId,
    {
      conclusion,
      note: options.note || `测款结论为${conclusion}，验证正式后果字段回写。`,
    },
    '测试用户',
  )
  assert.equal(result.ok, true, `${projectCode} 应允许提交 ${conclusion} 结论`)

  const latestNode = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'TEST_CONCLUSION')
  assert.ok(latestNode, `${projectCode} 提交后应仍能读取测款结论节点`)

  const latestRecord = getLatestProjectInlineNodeRecord(latestNode.projectNodeId)
  assert.ok(latestRecord, `${projectCode} 提交后应生成最新测款结论记录`)

  const html = renderPcsProjectWorkItemDetailPage(project.projectId, latestNode.projectNodeId)

  return {
    project,
    node: latestNode,
    record: latestRecord,
    payload: (latestRecord!.payload || {}) as Record<string, unknown>,
    detailSnapshot: (latestRecord!.detailSnapshot || {}) as Record<string, unknown>,
    html,
  }
}

const contract = getProjectWorkItemContract('TEST_CONCLUSION')
const fieldKeys = contract.fieldDefinitions.map((field) => field.fieldKey)

for (const key of [
  'revisionTaskId',
  'revisionTaskCode',
  'linkedStyleId',
  'linkedStyleCode',
  'invalidatedChannelProductId',
  'projectTerminated',
  'projectTerminatedAt',
  'nextActionType',
]) {
  assert.ok(fieldKeys.includes(key), `TEST_CONCLUSION 应定义正式字段 ${key}`)
}

const throughCase = submitConclusionForProject('PRJ-20251216-013', '通过')

assert.ok(throughCase.payload.linkedStyleId, '通过分支应正式回写关联款式档案 ID')
assert.ok(throughCase.payload.linkedStyleCode, '通过分支应正式回写关联款式档案编码')
assert.equal(throughCase.payload.nextActionType, '生成款式档案', '通过分支应正式回写后续动作类型')
assert.equal(throughCase.payload.projectTerminated, false, '通过分支不应终止项目')
assert.match(throughCase.html, /关联款式档案编码/, '通过分支详情应展示关联款式档案编码字段')
assert.match(throughCase.html, new RegExp(String(throughCase.payload.linkedStyleCode)), '通过分支详情应展示关联款式档案编码值')
assert.match(throughCase.html, /生成款式档案/, '通过分支详情应展示后续动作类型')

const adjustCase = submitConclusionForProject('PRJ-20251216-014', '调整')

assert.ok(adjustCase.payload.revisionTaskId, '调整分支应正式回写改版任务 ID')
assert.ok(adjustCase.payload.revisionTaskCode, '调整分支应正式回写改版任务编码')
assert.ok(adjustCase.payload.invalidatedChannelProductId, '调整分支应正式回写作废渠道商品 ID')
assert.equal(adjustCase.payload.nextActionType, '等待改版完成', '调整分支应正式回写后续动作类型')
assert.equal(adjustCase.payload.projectTerminated, false, '调整分支不应终止项目')
assert.match(adjustCase.html, /改版任务ID/, '调整分支详情应展示改版任务 ID 字段')
assert.match(adjustCase.html, new RegExp(String(adjustCase.payload.revisionTaskCode)), '调整分支详情应展示改版任务编码值')
assert.match(adjustCase.html, /等待改版完成/, '调整分支详情应展示后续动作类型')
assert.ok(
  ['PATTERN_TASK', 'PATTERN_ARTWORK_TASK', 'FIRST_SAMPLE']
    .map((workItemTypeCode) => getProjectNodeRecordByWorkItemTypeCode(adjustCase.project.projectId, workItemTypeCode))
    .some((node) => node?.currentStatus === '进行中'),
  '调整分支应由正式仓储直接解锁改版/打样分支节点',
)

const pausedCase = submitConclusionForProject('PRJ-20251216-015', '暂缓')

assert.ok(pausedCase.payload.invalidatedChannelProductId, '暂缓分支应正式回写作废渠道商品 ID')
assert.equal(pausedCase.payload.nextActionType, '等待重新评估', '暂缓分支应正式回写后续动作类型')
assert.equal(pausedCase.payload.projectTerminated, false, '暂缓分支不应终止项目')
assert.match(pausedCase.html, /等待重新评估/, '暂缓分支详情应展示后续动作类型')
assert.match(pausedCase.html, /是否终止项目/, '暂缓分支详情应展示项目终止字段')
const pausedProject = getProjectById(pausedCase.project.projectId)
assert.equal(pausedProject?.blockedFlag, true, '暂缓分支应按节点真相派生项目阻塞状态')
assert.ok(pausedProject?.blockedReason, '暂缓分支应按节点真相派生阻塞原因')

const eliminatedCase = submitConclusionForProject('PRJ-20251216-013', '淘汰')

assert.ok(eliminatedCase.payload.invalidatedChannelProductId, '淘汰分支应正式回写作废渠道商品 ID')
assert.equal(eliminatedCase.payload.projectTerminated, true, '淘汰分支应正式回写项目终止标记')
assert.ok(eliminatedCase.payload.projectTerminatedAt, '淘汰分支应正式回写项目终止时间')
assert.equal(eliminatedCase.payload.nextActionType, '项目关闭', '淘汰分支应正式回写后续动作类型')
assert.match(eliminatedCase.html, /项目终止时间/, '淘汰分支详情应展示项目终止时间字段')
assert.match(eliminatedCase.html, /项目关闭/, '淘汰分支详情应展示后续动作类型')
assert.match(eliminatedCase.html, /是/, '淘汰分支详情应以中文展示项目终止状态')
const eliminatedProject = getProjectById(eliminatedCase.project.projectId)
assert.equal(eliminatedProject?.projectStatus, '已终止', '淘汰分支应由正式仓储直接终止项目')
assert.ok(
  listProjectNodes(eliminatedCase.project.projectId).every(
    (node) => node.currentStatus === '已完成' || node.currentStatus === '已取消',
  ),
  '淘汰分支应由正式仓储直接关闭剩余项目节点',
)

console.log('pcs-test-conclusion-outcome-fields.spec.ts PASS')

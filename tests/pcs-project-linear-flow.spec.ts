import assert from 'node:assert/strict'

import { getProjectNodeRecordByWorkItemTypeCode, listProjects, resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import { saveProjectNodeFormalRecord } from '../src/data/pcs-project-flow-service.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetProjectInlineNodeRecordRepository } from '../src/data/pcs-project-inline-node-record-repository.ts'
import { resetProjectChannelProductRepository } from '../src/data/pcs-channel-product-project-repository.ts'
import { renderPcsProjectWorkItemDetailPage } from '../src/pages/pcs-projects.ts'

resetProjectRepository()
resetProjectRelationRepository()
resetProjectInlineNodeRecordRepository()
resetProjectChannelProductRepository()

const sampleConfirmProject = listProjects().find((item) => item.projectCode === 'PRJ-20251216-003')
assert.ok(sampleConfirmProject)
const sampleConfirmNode = getProjectNodeRecordByWorkItemTypeCode(sampleConfirmProject!.projectId, 'SAMPLE_CONFIRM')
const nextExecutionNodeBefore = getProjectNodeRecordByWorkItemTypeCode(sampleConfirmProject!.projectId, 'SAMPLE_COST_REVIEW')
const conclusionNodeBefore = getProjectNodeRecordByWorkItemTypeCode(sampleConfirmProject!.projectId, 'TEST_CONCLUSION')
assert.ok(sampleConfirmNode)
assert.ok(nextExecutionNodeBefore)
assert.ok(conclusionNodeBefore)
assert.equal(sampleConfirmNode?.currentStatus, '待确认')
assert.equal(nextExecutionNodeBefore?.currentStatus, '未开始')
assert.equal(conclusionNodeBefore?.currentStatus, '未开始')

const result = saveProjectNodeFormalRecord({
  projectId: sampleConfirmProject!.projectId,
  projectNodeId: sampleConfirmNode!.projectNodeId,
  payload: {
    businessDate: '2026-04-20 11:20',
    values: {
      confirmResult: '通过',
      confirmNote: '判定通过',
    },
  },
  completeAfterSave: true,
  operatorName: '测试用户',
})
assert.ok(result.ok)
assert.equal(getProjectNodeRecordByWorkItemTypeCode(sampleConfirmProject!.projectId, 'SAMPLE_CONFIRM')?.currentStatus, '已完成')
assert.equal(getProjectNodeRecordByWorkItemTypeCode(sampleConfirmProject!.projectId, 'SAMPLE_COST_REVIEW')?.currentStatus, '进行中')
assert.equal(getProjectNodeRecordByWorkItemTypeCode(sampleConfirmProject!.projectId, 'TEST_CONCLUSION')?.currentStatus, '未开始')

const html = await renderPcsProjectWorkItemDetailPage(sampleConfirmProject!.projectId, sampleConfirmNode!.projectNodeId)
assert.match(html, /判定结果|确认结果/)
assert.match(html, /通过/)
assert.match(html, /判定通过/)

console.log('pcs-project-linear-flow.spec.ts PASS')

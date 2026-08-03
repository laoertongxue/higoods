import assert from 'node:assert/strict'

import { getProjectNodeRecordByStepCode, listProjects, resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import { saveProjectNodeFormalRecord } from '../src/data/pcs-project-flow-service.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetProjectInlineNodeRecordRepository } from '../src/data/pcs-project-inline-node-record-repository.ts'
import { resetProjectChannelProductRepository } from '../src/data/pcs-channel-product-project-repository.ts'
import { renderPcsProjectStepDetailPage } from '../src/pages/pcs-projects.ts'

resetProjectRepository()
resetProjectRelationRepository()
resetProjectInlineNodeRecordRepository()
resetProjectChannelProductRepository()

const sampleConfirmProject = listProjects().find((item) => item.projectCode === 'PRJ-202603-002')
assert.ok(sampleConfirmProject)
const sampleConfirmNode = getProjectNodeRecordByStepCode(sampleConfirmProject!.projectId, 'FEASIBILITY_REVIEW')
const nextExecutionNodeBefore = getProjectNodeRecordByStepCode(sampleConfirmProject!.projectId, 'SAMPLE_SHOOT_FIT')
const conclusionNodeBefore = getProjectNodeRecordByStepCode(sampleConfirmProject!.projectId, 'TEST_CONCLUSION')
assert.ok(sampleConfirmNode)
assert.ok(nextExecutionNodeBefore)
assert.ok(conclusionNodeBefore)
assert.equal(sampleConfirmNode?.currentStatus, '进行中')
assert.equal(nextExecutionNodeBefore?.currentStatus, '未开始')
assert.equal(conclusionNodeBefore?.currentStatus, '未开始')

const result = saveProjectNodeFormalRecord({
  projectId: sampleConfirmProject!.projectId,
  projectNodeId: sampleConfirmNode!.projectNodeId,
  payload: {
    businessDate: '2026-04-20 11:20',
    values: {
      reviewConclusion: '进入测款',
      reviewRisk: '初步判断通过，进入测款前准备。',
    },
  },
  completeAfterSave: true,
  operatorName: '测试用户',
})
assert.ok(result.ok)
assert.equal(getProjectNodeRecordByStepCode(sampleConfirmProject!.projectId, 'FEASIBILITY_REVIEW')?.currentStatus, '已完成')
assert.equal(getProjectNodeRecordByStepCode(sampleConfirmProject!.projectId, 'SAMPLE_SHOOT_FIT')?.currentStatus, '进行中')
assert.equal(getProjectNodeRecordByStepCode(sampleConfirmProject!.projectId, 'TEST_CONCLUSION')?.currentStatus, '未开始')

const html = await renderPcsProjectStepDetailPage(sampleConfirmProject!.projectId, sampleConfirmNode!.projectNodeId)
assert.match(html, /初步可行性|判断结论/)
assert.match(html, /进入测款/)
assert.match(html, /初步判断通过/)

console.log('pcs-project-linear-flow.spec.ts PASS')

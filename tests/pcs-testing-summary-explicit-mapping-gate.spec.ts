import assert from 'node:assert/strict'

import {
  listProjectChannelProductsByProjectId,
  resetProjectChannelProductRepository,
  submitProjectTestingConclusion,
  submitProjectTestingSummary,
} from '../src/data/pcs-channel-product-project-repository.ts'
import {
  getProjectNodeRecordByStepCode,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import {
  resetProjectRelationRepository,
  upsertProjectRelation,
} from '../src/data/pcs-project-relation-repository.ts'

resetProjectRepository()
resetProjectRelationRepository()
resetProjectChannelProductRepository()

const project = listProjects().find((item) =>
  listProjectChannelProductsByProjectId(item.projectId).some(
    (record) =>
      record.channelProductStatus === '已生效' ||
      record.channelProductStatus === '已上架待测款',
  ),
)
assert.ok(project, '必须存在可进入测款汇总的商品项目')
const videoNode = getProjectNodeRecordByStepCode(project!.projectId, 'VIDEO_TEST')
assert.ok(videoNode, '必须存在短视频测款步骤')

upsertProjectRelation({
  projectRelationId: `unmapped-video-${project!.projectId}`,
  projectId: project!.projectId,
  projectCode: project!.projectCode,
  projectNodeId: videoNode!.projectNodeId,
  stepCode: 'VIDEO_TEST',
  stepName: '短视频测款',
  relationRole: '执行记录',
  sourceModule: '短视频',
  sourceObjectType: '短视频记录',
  sourceObjectId: 'video-not-explicitly-mapped',
  sourceObjectCode: 'VIDEO-UNMAPPED',
  sourceLineId: null,
  sourceLineCode: null,
  sourceTitle: '未显式映射的短视频',
  sourceStatus: '已完成',
  businessDate: '2026-07-31',
  ownerName: '测试用户',
  createdAt: '2026-07-31 10:00',
  createdBy: '测试用户',
  updatedAt: '2026-07-31 10:00',
  updatedBy: '测试用户',
  note: '',
})

const summary = submitProjectTestingSummary(project!.projectId, {}, '测试用户')
assert.equal(summary.ok, false, '全部正式关系均未显式映射时必须禁止提交测款汇总')
assert.equal(summary.relationCount, 0, '门禁返回值必须是成功映射并纳入汇总的正式事实数')

const conclusion = submitProjectTestingConclusion(
  project!.projectId,
  { conclusion: '暂保留', note: '等待补充正式映射。' },
  '测试用户',
)
assert.equal(conclusion.ok, false, '全部正式关系均未显式映射时必须禁止提交测款结论')
assert.equal(conclusion.relationCount, 0)

console.log('pcs-testing-summary-explicit-mapping-gate.spec.ts PASS')

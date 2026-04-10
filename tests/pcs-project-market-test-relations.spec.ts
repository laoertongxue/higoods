import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildProjectDetailViewModel, buildProjectNodeDetailViewModel } from '../src/data/pcs-project-view-model.ts'
import {
  clearProjectRelationStore,
  replaceLiveProductLineProjectRelations,
  replaceVideoRecordProjectRelations,
} from '../src/data/pcs-project-relation-repository.ts'
import {
  listProjectLiveTestingRelationItems,
  listProjectNodeLiveTestingRelationItems,
  listProjectNodeVideoTestingRelationItems,
  listProjectVideoTestingRelationItems,
} from '../src/data/pcs-project-relation-view-model.ts'
import { listLiveProductLinesBySession, resetLiveTestingRepository } from '../src/data/pcs-live-testing-repository.ts'
import { getVideoTestRecordById, resetVideoTestingRepository } from '../src/data/pcs-video-testing-repository.ts'
import { findProjectNodeByWorkItemTypeCode, listProjects, resetProjectRepository } from '../src/data/pcs-project-repository.ts'

resetProjectRepository()
resetLiveTestingRepository()
resetVideoTestingRepository()
clearProjectRelationStore()

const detailPageSource = readFileSync(new URL('../src/pages/pcs-project-detail.ts', import.meta.url), 'utf8')
assert.ok(detailPageSource.includes('场次编号'), '项目详情页应展示直播商品明细的场次编号')
assert.ok(detailPageSource.includes('记录编号'), '项目详情页应展示短视频记录编号')

const nodeDetailPageSource = readFileSync(new URL('../src/pages/pcs-project-work-item-detail.ts', import.meta.url), 'utf8')
assert.ok(nodeDetailPageSource.includes('暂无直播商品明细关联'), '节点详情页应提供直播商品明细空状态')
assert.ok(nodeDetailPageSource.includes('暂无短视频记录关联'), '节点详情页应提供短视频记录空状态')

const project = listProjects().find(
  (item) =>
    findProjectNodeByWorkItemTypeCode(item.projectId, 'LIVE_TEST') &&
    findProjectNodeByWorkItemTypeCode(item.projectId, 'VIDEO_TEST'),
)
assert.ok(project, '应存在同时具备直播测款和短视频测款节点的商品项目')

const liveLine = listLiveProductLinesBySession('LS-20260122-001')[0]
const videoRecord = getVideoTestRecordById('SV-20260122-008')
assert.ok(liveLine && videoRecord, '应存在可用于验证的测款正式对象')

replaceLiveProductLineProjectRelations(liveLine!.liveLineId, [project!.projectId])
replaceVideoRecordProjectRelations(videoRecord!.videoRecordId, [project!.projectId])

const detail = buildProjectDetailViewModel(project!.projectId)
assert.ok(detail, '应能读取真实项目详情')

const liveItems = listProjectLiveTestingRelationItems(project!.projectId)
assert.ok(liveItems.length > 0, '项目详情页应能读取直播商品明细关系')
assert.ok(liveItems.every((item) => item.sourceObjectType === '直播商品明细' && item.liveTestingDetail), 'LIVE_TEST 只应展示直播商品明细')

const videoItems = listProjectVideoTestingRelationItems(project!.projectId)
assert.ok(videoItems.length > 0, '项目详情页应能读取短视频记录关系')
assert.ok(videoItems.every((item) => item.sourceObjectType === '短视频记录' && item.videoTestingDetail), 'VIDEO_TEST 只应展示短视频记录')

const liveNode = findProjectNodeByWorkItemTypeCode(project!.projectId, 'LIVE_TEST')!
const videoNode = findProjectNodeByWorkItemTypeCode(project!.projectId, 'VIDEO_TEST')!

const liveNodeDetail = buildProjectNodeDetailViewModel(project!.projectId, liveNode.projectNodeId)
const videoNodeDetail = buildProjectNodeDetailViewModel(project!.projectId, videoNode.projectNodeId)
assert.ok(liveNodeDetail && videoNodeDetail, '应能打开直播测款和短视频测款节点详情')

assert.ok(
  listProjectNodeLiveTestingRelationItems(project!.projectId, liveNode.projectNodeId).every((item) => item.sourceObjectType === '直播商品明细'),
  'LIVE_TEST 节点详情页只应展示直播商品明细关系',
)
assert.ok(
  listProjectNodeVideoTestingRelationItems(project!.projectId, videoNode.projectNodeId).every((item) => item.sourceObjectType === '短视频记录'),
  'VIDEO_TEST 节点详情页只应展示短视频记录关系',
)
assert.ok(
  liveNodeDetail!.relationSection.items.every((item) => item.sourceObjectType === '直播商品明细'),
  '直播测款节点详情页不得混入短视频关系',
)
assert.ok(
  videoNodeDetail!.relationSection.items.every((item) => item.sourceObjectType === '短视频记录'),
  '短视频测款节点详情页不得混入直播场次头或旧项目字段',
)

console.log('pcs-project-market-test-relations.spec.ts PASS')

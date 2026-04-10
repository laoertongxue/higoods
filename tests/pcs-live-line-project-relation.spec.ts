import assert from 'node:assert/strict'
import {
  getLiveProductLineById,
  listLiveProductLinesBySession,
  resetLiveTestingRepository,
} from '../src/data/pcs-live-testing-repository.ts'
import {
  getProjectRelationStoreSnapshot,
  listProjectRelationPendingItems,
  listProjectRelations,
  listProjectRelationsByLiveProductLine,
  replaceLiveProductLineProjectRelations,
  resetProjectRelationRepository,
  unlinkLiveProductLineProjectRelation,
  clearProjectRelationStore,
} from '../src/data/pcs-project-relation-repository.ts'
import {
  buildLiveProductLineProjectRelation,
  normalizeLegacyLiveSessionHeaderRelation,
} from '../src/data/pcs-testing-relation-normalizer.ts'
import {
  findProjectNodeByWorkItemTypeCode,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'

resetProjectRepository()
resetLiveTestingRepository()
resetProjectRelationRepository()

const seededSnapshot = getProjectRelationStoreSnapshot()
assert.ok(
  !seededSnapshot.relations.some((item) => item.sourceModule === '直播' && item.sourceObjectType !== '直播商品明细'),
  '直播场次头不得直接生成正式项目关系记录',
)
assert.ok(
  listProjectRelationPendingItems().some((item) => item.sourceObjectCode === 'LS-20260122-001'),
  '历史直播场次头项目字段在多明细场次下应进入待补齐清单',
)

clearProjectRelationStore()

const liveProjects = listProjects().filter((project) => findProjectNodeByWorkItemTypeCode(project.projectId, 'LIVE_TEST'))
assert.ok(liveProjects.length >= 2, '应存在可用于直播测款关联的商品项目')

const line = listLiveProductLinesBySession('LS-20260122-001')[0]
assert.ok(line, '应存在可用于验证的直播商品明细')

const replaceResult = replaceLiveProductLineProjectRelations(line!.liveLineId, [
  liveProjects[0]!.projectId,
  liveProjects[1]!.projectId,
])
assert.equal(replaceResult.errors.length, 0, '直播商品明细关联有效项目时不应报错')
assert.equal(replaceResult.relations.length, 2, '一条直播商品明细应允许关联多个商品项目')
assert.ok(
  replaceResult.relations.every(
    (item) =>
      item.workItemTypeCode === 'LIVE_TEST' &&
      item.sourceObjectType === '直播商品明细' &&
      item.sourceLineId === line!.liveLineId,
  ),
  '直播商品明细写入正式关系时，目标节点必须固定为 LIVE_TEST',
)

const duplicated = replaceLiveProductLineProjectRelations(line!.liveLineId, [liveProjects[0]!.projectId, liveProjects[0]!.projectId])
assert.equal(duplicated.relations.length, 1, '同一条直播商品明细重复关联同一个项目时，只保留一条正式关系记录')

unlinkLiveProductLineProjectRelation(line!.liveLineId, liveProjects[0]!.projectId)
assert.equal(listProjectRelationsByLiveProductLine(line!.liveLineId).length, 0, '解除直播商品明细与项目关系后，正式关系应同步消失')

const singleLine = getLiveProductLineById(line!.liveLineId)!
const singleHeaderMigration = normalizeLegacyLiveSessionHeaderRelation({
  session: {
    liveSessionId: singleLine.liveSessionId,
    liveSessionCode: singleLine.liveSessionCode,
    sessionTitle: '单明细场次',
    channelName: 'TikTok',
    hostName: '主播甲',
    sessionStatus: '已关账',
    businessDate: singleLine.businessDate,
    startedAt: `${singleLine.businessDate} 10:00`,
    endedAt: `${singleLine.businessDate} 12:00`,
    ownerName: singleLine.ownerName,
    createdAt: `${singleLine.businessDate} 09:00`,
    updatedAt: `${singleLine.businessDate} 12:30`,
    purposes: ['测款'],
    itemCount: 1,
    testItemCount: 1,
    testAccountingStatus: '待入账',
    gmvAmount: singleLine.gmvAmount,
    legacyProjectRef: liveProjects[0]!.projectCode,
    legacyProjectId: liveProjects[0]!.projectCode,
  },
  productLines: [singleLine],
  rawProjectCode: liveProjects[0]!.projectCode,
})
assert.equal(singleHeaderMigration.relations.length, 1, '单场次仅 1 条明细时，历史场次头项目字段应可下移到唯一明细')
assert.equal(singleHeaderMigration.relations[0]!.sourceLineId, singleLine.liveLineId, '下移后的正式关系必须写入直播商品明细行编号')

const multiHeaderMigration = normalizeLegacyLiveSessionHeaderRelation({
  session: {
    liveSessionId: 'LS-MULTI-001',
    liveSessionCode: 'LS-MULTI-001',
    sessionTitle: '多明细场次',
    channelName: 'TikTok',
    hostName: '主播乙',
    sessionStatus: '已关账',
    businessDate: '2026-01-22',
    startedAt: '2026-01-22 10:00',
    endedAt: '2026-01-22 12:00',
    ownerName: '张三',
    createdAt: '2026-01-22 09:00',
    updatedAt: '2026-01-22 12:30',
    purposes: ['测款'],
    itemCount: 2,
    testItemCount: 2,
    testAccountingStatus: '待入账',
    gmvAmount: 0,
    legacyProjectRef: liveProjects[0]!.projectCode,
    legacyProjectId: liveProjects[0]!.projectCode,
  },
  productLines: [singleLine, { ...singleLine, liveLineId: `${singleLine.liveLineId}-2`, liveLineCode: `${singleLine.liveLineCode}-2` }],
  rawProjectCode: liveProjects[0]!.projectCode,
})
assert.equal(multiHeaderMigration.relations.length, 0, '单场次多条直播商品明细时，不得自动猜测映射到哪一条明细')
assert.equal(multiHeaderMigration.pendingItems.length, 1, '多明细场次头旧项目字段必须进入待补齐清单')

const missingProjectResult = buildLiveProductLineProjectRelation(singleLine, 'PRJ-NOT-FOUND', {
  legacyRefType: 'liveLine.projectRef',
  legacyRefValue: 'PRJ-NOT-FOUND',
})
assert.equal(missingProjectResult.relation, null, '不存在项目时不得写入正式直播关系')
assert.ok(missingProjectResult.pendingItem, '不存在项目的旧直播关系必须进入待补齐清单')

console.log('pcs-live-line-project-relation.spec.ts PASS')

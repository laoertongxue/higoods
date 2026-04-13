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
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import {
  createAndLaunchChannelProductForProject,
  createProjectForBusinessChain,
  prepareProjectWithLaunchedChannelProduct,
  resetProjectBusinessChainRepositories,
} from './pcs-project-formal-chain-helper.ts'

resetProjectRepository()
resetLiveTestingRepository()
resetProjectRelationRepository()

const seededSnapshot = getProjectRelationStoreSnapshot()
assert.ok(
  !seededSnapshot.relations.some((item) => item.sourceModule === '直播' && item.sourceObjectType !== '直播商品明细'),
  '直播场次头不得直接生成正式项目关系记录',
)
assert.ok(
  Array.isArray(listProjectRelationPendingItems()),
  '直播测款待处理清单应保持可读',
)

clearProjectRelationStore()

const launchedProjectA = prepareProjectWithLaunchedChannelProduct('直播测款正式关联项目甲')
const liveProjectB = createProjectForBusinessChain('直播测款正式关联项目乙')
assert.ok(findProjectNodeByWorkItemTypeCode(liveProjectB.projectId, 'LIVE_TEST'), '测试项目乙应存在直播测款节点')
createAndLaunchChannelProductForProject(liveProjectB.projectId)

const line = listLiveProductLinesBySession('LS-20260122-001')[0]
assert.ok(line, '应存在可用于验证的直播商品明细')

const replaceResult = replaceLiveProductLineProjectRelations(line!.liveLineId, [
  launchedProjectA.projectId,
  liveProjectB.projectId,
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

const duplicated = replaceLiveProductLineProjectRelations(line!.liveLineId, [launchedProjectA.projectId, launchedProjectA.projectId])
assert.equal(duplicated.relations.length, 1, '同一条直播商品明细重复关联同一个项目时，只保留一条正式关系记录')

unlinkLiveProductLineProjectRelation(line!.liveLineId, launchedProjectA.projectId)
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
    legacyProjectRef: launchedProjectA.projectCode,
    legacyProjectId: launchedProjectA.projectCode,
  },
  productLines: [singleLine],
  rawProjectCode: launchedProjectA.projectCode,
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
    legacyProjectRef: launchedProjectA.projectCode,
    legacyProjectId: launchedProjectA.projectCode,
  },
  productLines: [singleLine, { ...singleLine, liveLineId: `${singleLine.liveLineId}-2`, liveLineCode: `${singleLine.liveLineCode}-2` }],
  rawProjectCode: launchedProjectA.projectCode,
})
assert.equal(multiHeaderMigration.relations.length, 0, '单场次多条直播商品明细时，不得自动猜测映射到哪一条明细')
assert.equal(multiHeaderMigration.pendingItems.length, 1, '多明细场次头旧项目字段必须进入待补齐清单')

const missingProjectResult = buildLiveProductLineProjectRelation(singleLine, 'PRJ-NOT-FOUND', {
  legacyRefType: 'liveLine.projectRef',
  legacyRefValue: 'PRJ-NOT-FOUND',
})
assert.equal(missingProjectResult.relation, null, '不存在项目时不得写入正式直播关系')
assert.ok(missingProjectResult.pendingItem, '不存在项目的旧直播关系必须进入待补齐清单')

resetProjectBusinessChainRepositories()
const blockedProject = createProjectForBusinessChain('未完成商品上架门禁项目')
const blockedResult = replaceLiveProductLineProjectRelations(singleLine.liveLineId, [blockedProject.projectId])
assert.equal(blockedResult.relations.length, 0, '未完成商品上架的项目不得建立正式直播测款关系')
assert.ok(
  blockedResult.errors.includes('当前项目未完成商品上架，不能建立正式直播测款关系。'),
  '仓储层应返回明确的中文门禁原因',
)
assert.equal(blockedResult.pendingItems.length, 1, '被门禁拦住的直播测款关系应写入待处理清单')

console.log('pcs-live-line-project-relation.spec.ts PASS')

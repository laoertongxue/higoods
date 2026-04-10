import assert from 'node:assert/strict'
import { buildProjectDetailViewModel, buildProjectNodeDetailViewModel } from '../src/data/pcs-project-view-model.ts'
import {
  clearProjectRelationStore,
  listProjectRelationsByProject,
  listProjectRelationsByProjectNode,
} from '../src/data/pcs-project-relation-repository.ts'
import {
  findProjectNodeByWorkItemTypeCode,
  listProjectNodes,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { getSampleAssetByCode, resetSampleAssetRepository } from '../src/data/pcs-sample-asset-repository.ts'
import {
  listSampleLedgerEvents,
  listSampleWritebackPendingItems,
  resetSampleLedgerRepository,
} from '../src/data/pcs-sample-ledger-repository.ts'
import { recordSampleLedgerEvent } from '../src/data/pcs-sample-project-writeback.ts'

resetProjectRepository()
clearProjectRelationStore()
resetSampleAssetRepository()
resetSampleLedgerRepository()

const project = listProjects().find(
  (item) =>
    item.projectCode === 'PRJ-20251216-010' &&
    findProjectNodeByWorkItemTypeCode(item.projectId, 'SAMPLE_ACQUIRE') &&
    findProjectNodeByWorkItemTypeCode(item.projectId, 'SAMPLE_INBOUND_CHECK'),
) || listProjects().find(
  (item) =>
    findProjectNodeByWorkItemTypeCode(item.projectId, 'SAMPLE_ACQUIRE') &&
    findProjectNodeByWorkItemTypeCode(item.projectId, 'SAMPLE_INBOUND_CHECK'),
)
assert.ok(project, '应存在同时具备样衣获取与到样核对节点的商品项目')

const sampleAcquireNode = findProjectNodeByWorkItemTypeCode(project!.projectId, 'SAMPLE_ACQUIRE')!
const sampleInboundNode = findProjectNodeByWorkItemTypeCode(project!.projectId, 'SAMPLE_INBOUND_CHECK')!
const getProjectNode = (projectId: string, projectNodeId: string) =>
  listProjectNodes(projectId).find((item) => item.projectNodeId === projectNodeId) || null

recordSampleLedgerEvent({
  ledgerEventId: 'sample_writeback_receive_001',
  ledgerEventCode: 'LE-TST-001',
  eventType: 'RECEIVE_ARRIVAL',
  sampleCode: 'SY-TST-0001',
  sampleName: '测试样衣一号',
  sampleType: '样衣',
  responsibleSite: '深圳',
  sourcePage: '样衣台账',
  sourceModule: '样衣台账',
  sourceDocType: '样衣获取单',
  sourceDocId: 'acq_test_001',
  sourceDocCode: 'ACQ-TST-001',
  projectId: project!.projectId,
  projectCode: project!.projectCode,
  projectName: project!.projectName,
  businessDate: '2026-02-01 10:00:00',
  operatorName: '测试用户',
  locationAfter: '深圳收货区',
  locationType: '仓库',
  locationCode: 'SZ-RECV',
  locationDisplay: '深圳收货区',
  custodianType: '仓管',
  custodianName: '深圳仓管',
})

const receivedAsset = getSampleAssetByCode('SY-TST-0001')
assert.ok(receivedAsset, '到样签收后应创建正式样衣资产')
assert.equal(receivedAsset!.inventoryStatus, '在库待核对', '到样签收后应更新为在库待核对')

const receivedAcquireNode = getProjectNode(project!.projectId, sampleAcquireNode.projectNodeId)
assert.equal(receivedAcquireNode?.currentStatus, '进行中', '到样签收后应回写样衣获取节点状态')
assert.equal(receivedAcquireNode?.latestResultType, '已到样', '到样签收后应回写样衣获取节点最近结果')
assert.equal(receivedAcquireNode?.pendingActionType, '核对入库', '到样签收后应回写待处理事项')

recordSampleLedgerEvent({
  ledgerEventId: 'sample_writeback_checkin_001',
  ledgerEventCode: 'LE-TST-002',
  eventType: 'CHECKIN_VERIFY',
  sampleCode: 'SY-TST-0001',
  sampleName: '测试样衣一号',
  sampleType: '样衣',
  responsibleSite: '深圳',
  sourcePage: '样衣台账',
  sourceModule: '样衣台账',
  sourceDocType: '样衣获取单',
  sourceDocId: 'acq_test_001',
  sourceDocCode: 'ACQ-TST-001',
  projectId: project!.projectId,
  projectCode: project!.projectCode,
  projectName: project!.projectName,
  businessDate: '2026-02-01 12:00:00',
  operatorName: '测试用户',
  locationAfter: '深圳主仓-A-01',
  locationType: '仓库',
  locationCode: 'SZ-WH-A-01',
  locationDisplay: '深圳主仓-A-01',
  custodianType: '仓管',
  custodianName: '深圳仓管',
})

const checkedInAsset = getSampleAssetByCode('SY-TST-0001')
assert.equal(checkedInAsset?.inventoryStatus, '在库可用', '核对入库后应更新样衣资产库存状态')
assert.equal(checkedInAsset?.availabilityStatus, '可用', '核对入库后应更新样衣资产可用状态')

const inboundNodeAfterCheckin = getProjectNode(project!.projectId, sampleInboundNode.projectNodeId)
assert.equal(inboundNodeAfterCheckin?.currentStatus, '已完成', '核对入库后应完成到样核对节点')
assert.equal(inboundNodeAfterCheckin?.latestResultType, '已核对入库', '核对入库后应回写最近结果类型')
assert.equal(inboundNodeAfterCheckin?.latestResultText, '样衣已完成核对入库', '核对入库后应回写最近结果说明')

const inboundRelations = listProjectRelationsByProjectNode(project!.projectId, sampleInboundNode.projectNodeId)
assert.ok(
  inboundRelations.some((item) => item.sourceModule === '样衣台账' && item.sourceObjectType === '样衣台账事件'),
  '核对入库后应存在样衣台账事件关系记录',
)
assert.ok(
  inboundRelations.some((item) => item.sourceModule === '样衣资产' && item.sourceObjectType === '样衣资产'),
  '核对入库后应存在样衣资产关系记录',
)

const duplicateRelationCount = inboundRelations.length
recordSampleLedgerEvent({
  ledgerEventId: 'sample_writeback_checkin_001',
  ledgerEventCode: 'LE-TST-002',
  eventType: 'CHECKIN_VERIFY',
  sampleCode: 'SY-TST-0001',
  sampleName: '测试样衣一号',
  sampleType: '样衣',
  responsibleSite: '深圳',
  sourcePage: '样衣台账',
  sourceModule: '样衣台账',
  sourceDocType: '样衣获取单',
  sourceDocId: 'acq_test_001',
  sourceDocCode: 'ACQ-TST-001',
  projectId: project!.projectId,
  projectCode: project!.projectCode,
  projectName: project!.projectName,
  businessDate: '2026-02-01 12:00:00',
  operatorName: '测试用户',
})
assert.equal(
  listProjectRelationsByProjectNode(project!.projectId, sampleInboundNode.projectNodeId).length,
  duplicateRelationCount,
  '同一条样衣事件重复写入时，不会重复写项目关系记录',
)

const latestInboundNode = getProjectNode(project!.projectId, sampleInboundNode.projectNodeId)
const latestInboundEventId = latestInboundNode?.lastEventId
recordSampleLedgerEvent({
  ledgerEventId: 'sample_writeback_checkin_old_001',
  ledgerEventCode: 'LE-TST-003',
  eventType: 'CHECKIN_VERIFY',
  sampleCode: 'SY-TST-0001',
  sampleName: '测试样衣一号',
  sampleType: '样衣',
  responsibleSite: '深圳',
  sourcePage: '样衣台账',
  sourceModule: '样衣台账',
  sourceDocType: '样衣获取单',
  sourceDocId: 'acq_test_001',
  sourceDocCode: 'ACQ-TST-001',
  projectId: project!.projectId,
  projectCode: project!.projectCode,
  projectName: project!.projectName,
  businessDate: '2026-01-31 08:00:00',
  operatorName: '测试用户',
})
assert.equal(
  getProjectNode(project!.projectId, sampleInboundNode.projectNodeId)?.lastEventId,
  latestInboundEventId,
  '同一条样衣事件业务时间较旧时，不会覆盖项目节点中较新的样衣结果',
)

const relationCountBeforeStocktake = listProjectRelationsByProject(project!.projectId).length
const nodeLastEventBeforeStocktake = getProjectNode(project!.projectId, sampleInboundNode.projectNodeId)?.lastEventId
recordSampleLedgerEvent({
  ledgerEventId: 'sample_writeback_stocktake_001',
  ledgerEventCode: 'LE-TST-004',
  eventType: 'STOCKTAKE',
  sampleCode: 'SY-TST-0001',
  sampleName: '测试样衣一号',
  sampleType: '样衣',
  responsibleSite: '深圳',
  sourcePage: '样衣台账',
  sourceModule: '样衣台账',
  sourceDocType: '盘点单',
  sourceDocId: 'stocktake_test_001',
  sourceDocCode: 'STK-TST-001',
  projectId: project!.projectId,
  projectCode: project!.projectCode,
  projectName: project!.projectName,
  businessDate: '2026-02-01 18:00:00',
  operatorName: '测试用户',
  locationAfter: '深圳主仓-A-01',
  locationType: '仓库',
  locationCode: 'SZ-WH-A-01',
  locationDisplay: '深圳主仓-A-01',
  custodianType: '仓管',
  custodianName: '深圳仓管',
})
assert.equal(
  getProjectNode(project!.projectId, sampleInboundNode.projectNodeId)?.lastEventId,
  nodeLastEventBeforeStocktake,
  '盘点事件只更新样衣资产与样衣台账，不会默认改写项目节点',
)
assert.ok(
  listProjectRelationsByProject(project!.projectId).length >= relationCountBeforeStocktake,
  '盘点事件在识别到项目归属后应保留正式项目关系痕迹',
)

recordSampleLedgerEvent({
  ledgerEventId: 'sample_writeback_missing_project_001',
  ledgerEventCode: 'LE-TST-005',
  eventType: 'RECEIVE_ARRIVAL',
  sampleCode: 'SY-TST-0002',
  sampleName: '测试样衣二号',
  sampleType: '样衣',
  responsibleSite: '深圳',
  sourcePage: '样衣台账',
  sourceModule: '样衣台账',
  sourceDocType: '样衣获取单',
  sourceDocId: 'acq_missing_project',
  sourceDocCode: 'ACQ-TST-404',
  projectCode: 'PRJ-NOT-FOUND',
  businessDate: '2026-02-02 09:00:00',
  operatorName: '测试用户',
})

recordSampleLedgerEvent({
  ledgerEventId: 'sample_writeback_missing_node_001',
  ledgerEventCode: 'LE-TST-006',
  eventType: 'RESERVE_LOCK',
  sampleCode: 'SY-TST-0003',
  sampleName: '测试样衣三号',
  sampleType: '样衣',
  responsibleSite: '深圳',
  sourcePage: '样衣使用申请',
  sourceModule: '样衣使用申请',
  sourceDocType: '样衣使用申请',
  sourceDocId: 'app_missing_node',
  sourceDocCode: 'APP-TST-404',
  projectId: project!.projectId,
  projectCode: project!.projectCode,
  projectName: project!.projectName,
  projectNodeId: 'node-not-found',
  workItemTypeCode: 'LIVE_TEST',
  workItemTypeName: '直播测款',
  businessDate: '2026-02-02 10:00:00',
  operatorName: '测试用户',
})

const pendingItems = listSampleWritebackPendingItems()
assert.ok(
  pendingItems.some((item) => item.sourceDocCode === 'ACQ-TST-404'),
  '项目不存在时，样衣事件必须进入待补齐清单',
)
assert.ok(
  pendingItems.some((item) => item.sourceDocCode === 'APP-TST-404'),
  '项目存在但节点不存在时，样衣事件必须进入待补齐清单',
)

const detail = buildProjectDetailViewModel(project!.projectId)
assert.ok(detail, '样衣事件写入后应能构建商品项目详情视图')
assert.ok(
  detail!.relationSection.groups.some((group) => group.items.some((item) => item.sampleLedgerDetail)),
  '项目详情页应能读取正式样衣台账事件关系',
)
assert.ok(
  detail!.relationSection.groups.some((group) => group.items.some((item) => item.sampleAssetDetail)),
  '项目详情页应能读取正式样衣资产关系',
)

const inboundNodeDetail = buildProjectNodeDetailViewModel(project!.projectId, sampleInboundNode.projectNodeId)
assert.ok(inboundNodeDetail, '样衣事件写入后应能构建项目节点详情视图')
assert.equal(inboundNodeDetail!.node.latestResultType, '已核对入库', '项目节点详情页应能读取样衣事件回写后的结果类型')
assert.equal(inboundNodeDetail!.node.latestResultText, '样衣已完成核对入库', '项目节点详情页应能读取样衣事件回写后的结果说明')
assert.equal(inboundNodeDetail!.node.lastEventTime, '2026-02-01 12:00:00', '项目节点详情页应能读取最近一次样衣事件时间')

assert.ok(
  listSampleLedgerEvents().some((item) => item.ledgerEventId === 'sample_writeback_stocktake_001'),
  '盘点事件应正式写入样衣台账事件仓储',
)

console.log('pcs-sample-ledger-writeback.spec.ts PASS')

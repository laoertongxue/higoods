import assert from 'node:assert/strict'
import { clearProjectRelationStore } from '../src/data/pcs-project-relation-repository.ts'
import {
  findProjectNodeByWorkItemTypeCode,
  listProjectNodes,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { listSampleLedgerEvents, resetSampleLedgerRepository } from '../src/data/pcs-sample-ledger-repository.ts'
import { resetSampleAssetRepository } from '../src/data/pcs-sample-asset-repository.ts'
import { recordSampleLedgerEvent } from '../src/data/pcs-sample-project-writeback.ts'

resetProjectRepository()
clearProjectRelationStore()
resetSampleAssetRepository()
resetSampleLedgerRepository()

const project = listProjects().find((item) => findProjectNodeByWorkItemTypeCode(item.projectId, 'PRE_PRODUCTION_SAMPLE'))
assert.ok(project, '应存在可用于产前版样衣验证的商品项目')

const preProductionNode = findProjectNodeByWorkItemTypeCode(project!.projectId, 'PRE_PRODUCTION_SAMPLE')!

recordSampleLedgerEvent({
  ledgerEventId: 'pre_production_ship_001',
  ledgerEventCode: 'LE-PP-001',
  eventType: 'SHIP_OUT',
  sampleCode: 'SY-PP-0001',
  sampleName: '产前版样衣测试样',
  sampleType: '产前版样衣',
  responsibleSite: '雅加达',
  sourcePage: '产前版样衣',
  sourceModule: '产前版样衣',
  sourceDocType: '产前版样衣任务',
  sourceDocId: 'PP-TASK-001',
  sourceDocCode: 'PP-TASK-001',
  projectId: project!.projectId,
  projectCode: project!.projectCode,
  projectName: project!.projectName,
  businessDate: '2026-02-04 09:00:00',
  operatorName: '测试用户',
})

const shipEvent = listSampleLedgerEvents().find((item) => item.ledgerEventId === 'pre_production_ship_001')
assert.ok(shipEvent, '产前版样衣发样应生成寄出事件')

recordSampleLedgerEvent({
  ledgerEventId: 'pre_production_receive_001',
  ledgerEventCode: 'LE-PP-002',
  eventType: 'RECEIVE_ARRIVAL',
  sampleCode: 'SY-PP-0001',
  sampleName: '产前版样衣测试样',
  sampleType: '产前版样衣',
  responsibleSite: '雅加达',
  sourcePage: '产前版样衣',
  sourceModule: '产前版样衣',
  sourceDocType: '产前版样衣任务',
  sourceDocId: 'PP-TASK-001',
  sourceDocCode: 'PP-TASK-001',
  projectId: project!.projectId,
  projectCode: project!.projectCode,
  projectName: project!.projectName,
  businessDate: '2026-02-04 15:00:00',
  operatorName: '测试用户',
})

const receiveEvent = listSampleLedgerEvents().find((item) => item.ledgerEventId === 'pre_production_receive_001')
assert.ok(receiveEvent, '产前版样衣到样应生成到样签收事件')

const updatedNode = listProjectNodes(project!.projectId).find((item) => item.projectNodeId === preProductionNode.projectNodeId)
assert.ok(updatedNode, '产前版样衣事件应能回写到 PRE_PRODUCTION_SAMPLE 节点')
assert.equal(updatedNode!.latestResultType, '产前版样衣已到样', '产前版样衣到样后应回写最近结果类型')
assert.equal(updatedNode!.pendingActionType, '待验收', '产前版样衣到样后应回写待处理事项')

console.log('pcs-pre-production-sample-ledger-writeback.spec.ts PASS')

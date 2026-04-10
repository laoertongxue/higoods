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

const project = listProjects().find((item) => findProjectNodeByWorkItemTypeCode(item.projectId, 'FIRST_SAMPLE'))
assert.ok(project, '应存在可用于首版样衣打样验证的商品项目')

const firstSampleNode = findProjectNodeByWorkItemTypeCode(project!.projectId, 'FIRST_SAMPLE')!

recordSampleLedgerEvent({
  ledgerEventId: 'first_sample_ship_001',
  ledgerEventCode: 'LE-FS-001',
  eventType: 'SHIP_OUT',
  sampleCode: 'SY-FS-0001',
  sampleName: '首版样衣测试样',
  sampleType: '首版样衣',
  responsibleSite: '深圳',
  sourcePage: '首版样衣打样',
  sourceModule: '首版样衣打样',
  sourceDocType: '首版样衣打样任务',
  sourceDocId: 'FS-TASK-001',
  sourceDocCode: 'FS-TASK-001',
  projectId: project!.projectId,
  projectCode: project!.projectCode,
  projectName: project!.projectName,
  businessDate: '2026-02-03 09:00:00',
  operatorName: '测试用户',
})

const shipEvent = listSampleLedgerEvents().find((item) => item.ledgerEventId === 'first_sample_ship_001')
assert.ok(shipEvent, '首版样衣打样发样应生成寄出事件')

recordSampleLedgerEvent({
  ledgerEventId: 'first_sample_receive_001',
  ledgerEventCode: 'LE-FS-002',
  eventType: 'RECEIVE_ARRIVAL',
  sampleCode: 'SY-FS-0001',
  sampleName: '首版样衣测试样',
  sampleType: '首版样衣',
  responsibleSite: '深圳',
  sourcePage: '首版样衣打样',
  sourceModule: '首版样衣打样',
  sourceDocType: '首版样衣打样任务',
  sourceDocId: 'FS-TASK-001',
  sourceDocCode: 'FS-TASK-001',
  projectId: project!.projectId,
  projectCode: project!.projectCode,
  projectName: project!.projectName,
  businessDate: '2026-02-03 15:00:00',
  operatorName: '测试用户',
})

const receiveEvent = listSampleLedgerEvents().find((item) => item.ledgerEventId === 'first_sample_receive_001')
assert.ok(receiveEvent, '首版样衣打样到样应生成到样签收事件')

const updatedNode = listProjectNodes(project!.projectId).find((item) => item.projectNodeId === firstSampleNode.projectNodeId)
assert.ok(updatedNode, '首版样衣打样事件应能回写到 FIRST_SAMPLE 节点')
assert.equal(updatedNode!.latestResultType, '首版样衣已到样', '首版样衣到样后应回写最近结果类型')
assert.equal(updatedNode!.pendingActionType, '待验收', '首版样衣到样后应回写待处理事项')

console.log('pcs-first-sample-ledger-writeback.spec.ts PASS')

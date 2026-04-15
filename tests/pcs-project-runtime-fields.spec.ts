import assert from 'node:assert/strict'

import {
  getProjectById,
  getProjectNodeRecordByWorkItemTypeCode,
  getProjectStoreSnapshot,
  listProjectNodes,
  listProjects,
  resetProjectRepository,
  updateProjectNodeRecord,
} from '../src/data/pcs-project-repository.ts'

resetProjectRepository()

const pausedRawProject = getProjectStoreSnapshot().projects.find((item) => item.projectCode === 'PRJ-20251216-019')
assert.ok(pausedRawProject, 'bootstrap 中应存在暂缓项目原始记录')
assert.equal(
  Object.prototype.hasOwnProperty.call(pausedRawProject, 'blockedFlag'),
  false,
  '项目主记录原始快照不应再保存阻塞派生字段',
)
assert.equal(
  Object.prototype.hasOwnProperty.call(pausedRawProject, 'riskStatus'),
  false,
  '项目主记录原始快照不应再保存风险派生字段',
)

const pausedProject = listProjects().find((item) => item.projectCode === 'PRJ-20251216-019')
assert.ok(pausedProject, '读取项目列表时应存在暂缓项目')
assert.equal(pausedProject?.blockedFlag, true, '读取项目时应按节点真相派生阻塞状态')
assert.ok(pausedProject?.blockedReason.includes('项目阻塞'), '读取项目时应按节点真相派生阻塞原因')

resetProjectRepository()

const liveProject = listProjects().find((item) => item.projectCode === 'PRJ-20251216-013')
assert.ok(liveProject, '应存在进行中的演示项目')
const currentNode = listProjectNodes(liveProject!.projectId).find((node) => node.currentStatus === '进行中')
assert.ok(currentNode, '进行中的演示项目应存在当前执行节点')

updateProjectNodeRecord(
  liveProject!.projectId,
  currentNode!.projectNodeId,
  {
    currentStatus: '待确认',
    currentIssueType: '项目阻塞',
    currentIssueText: '节点真相阻塞，等待复盘。',
    updatedAt: '2024-04-12 10:00',
    lastEventType: '节点阻塞',
    lastEventTime: '2024-04-12 10:00',
  },
  '测试用户',
)

const derivedProject = getProjectById(liveProject!.projectId)
assert.equal(derivedProject?.pendingDecisionFlag, true, '节点改为待确认后应立即派生待确认标记')
assert.equal(derivedProject?.blockedFlag, true, '节点写入阻塞问题后应立即派生项目阻塞状态')
assert.equal(derivedProject?.blockedReason, '节点真相阻塞，等待复盘。', '阻塞原因应直接来自节点真相')
assert.equal(derivedProject?.nextWorkItemName, currentNode?.workItemTypeName, '下一工作项应来自当前未关闭节点')
assert.equal(derivedProject?.nextWorkItemStatus, '待确认', '下一工作项状态应来自当前节点真相')
assert.equal(derivedProject?.riskStatus, '延期', '阻塞节点停留超过阈值时应立即派生延期风险')

const updatedRawProject = getProjectStoreSnapshot().projects.find((item) => item.projectId === liveProject!.projectId)
assert.ok(updatedRawProject, '应仍可读取项目原始记录')
assert.equal(
  Object.prototype.hasOwnProperty.call(updatedRawProject, 'nextWorkItemName'),
  false,
  '节点变更后也不应把下一工作项写回项目主记录',
)

const conclusionNode = getProjectNodeRecordByWorkItemTypeCode(liveProject!.projectId, 'TEST_CONCLUSION')
assert.ok(conclusionNode, '项目应存在测款结论节点用于对照')

console.log('pcs-project-runtime-fields.spec.ts PASS')

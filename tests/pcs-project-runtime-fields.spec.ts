import assert from 'node:assert/strict'

import {
  getProjectById,
  getProjectNodeRecordByStepCode,
  getProjectStoreSnapshot,
  listProjectNodes,
  listProjects,
  resetProjectRepository,
  updateProjectNodeRecord,
} from '../src/data/pcs-project-repository.ts'

resetProjectRepository()

const rawProject = getProjectStoreSnapshot().projects.find((item) => item.projectCode === 'PRJ-202603-013')
assert.ok(rawProject, 'bootstrap 中应存在可验证运行时派生字段的项目原始记录')
assert.equal(
  Object.prototype.hasOwnProperty.call(rawProject, 'blockedFlag'),
  false,
  '项目主记录原始快照不应再保存阻塞派生字段',
)
assert.equal(
  Object.prototype.hasOwnProperty.call(rawProject, 'riskStatus'),
  false,
  '项目主记录原始快照不应再保存风险派生字段',
)

const liveProject = listProjects().find((item) => item.projectCode === 'PRJ-202603-013')
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
assert.equal(derivedProject?.pendingDecisionFlag, false, '固定步骤序列修复后不应保留失效的待确认标记')
assert.equal(derivedProject?.blockedFlag, true, '节点写入阻塞问题后应立即派生项目阻塞状态')
assert.equal(derivedProject?.blockedReason, '节点真相阻塞，等待复盘。', '阻塞原因应直接来自节点真相')
assert.equal(derivedProject?.nextStepName, currentNode?.stepName, '下一步骤应来自当前未关闭节点')
assert.equal(derivedProject?.nextStepStatus, '进行中', '下一步骤状态应来自序列修复后的当前节点真相')
assert.equal(derivedProject?.riskStatus, '延期', '阻塞节点停留超过阈值时应立即派生延期风险')

const updatedRawProject = getProjectStoreSnapshot().projects.find((item) => item.projectId === liveProject!.projectId)
assert.ok(updatedRawProject, '应仍可读取项目原始记录')
assert.equal(
  Object.prototype.hasOwnProperty.call(updatedRawProject, 'nextStepName'),
  false,
  '节点变更后也不应把下一步骤写回项目主记录',
)

const conclusionNode = getProjectNodeRecordByStepCode(liveProject!.projectId, 'TEST_CONCLUSION')
assert.ok(conclusionNode, '项目应存在测款结论节点用于对照')

console.log('pcs-project-runtime-fields.spec.ts PASS')

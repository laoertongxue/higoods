import assert from 'node:assert/strict'

import { migrateProjectDecisionInlineRecords, migrateProjectDecisionSnapshot } from '../src/data/pcs-project-decision-migration.ts'

const migratedRecords = migrateProjectDecisionInlineRecords([
  {
    recordId: 'record-1',
    recordCode: 'REC-1',
    projectId: 'project-1',
    projectCode: 'PRJ-1',
    projectName: '测试项目',
    projectNodeId: 'node-1',
    workItemTypeCode: 'TEST_CONCLUSION',
    workItemTypeName: '测款结论判定',
    businessDate: '2026-04-20 10:00',
    recordStatus: '已完成',
    ownerId: 'owner-1',
    ownerName: '测试用户',
    payload: {
      conclusion: '调整',
      revisionTaskId: 'RT-001',
      revisionTaskCode: 'RT-001',
      projectTerminated: true,
      projectTerminatedAt: '2026-04-20 10:00',
    },
    detailSnapshot: {},
    sourceModule: '商品项目',
    sourceDocType: '测款结论记录',
    sourceDocId: 'doc-1',
    sourceDocCode: 'doc-1',
    upstreamRefs: [],
    downstreamRefs: [],
    createdAt: '2026-04-20 10:00',
    createdBy: '测试用户',
    updatedAt: '2026-04-20 10:00',
    updatedBy: '测试用户',
    legacyProjectRef: null,
    legacyWorkItemInstanceId: null,
  },
])

assert.equal(migratedRecords[0].recordStatus, '待确认')
assert.equal((migratedRecords[0].payload as Record<string, unknown>).conclusion, '')
assert.equal((migratedRecords[0].payload as Record<string, unknown>).conclusionLegacyValue, '调整')
assert.ok(!(migratedRecords[0].payload as Record<string, unknown>).revisionTaskId)
assert.ok(!(migratedRecords[0].payload as Record<string, unknown>).projectTerminated)

const migratedSnapshot = migrateProjectDecisionSnapshot({
  version: 1,
  projects: [
    {
      projectId: 'project-1',
      projectCode: 'PRJ-1',
      projectName: '测试项目',
      projectStatus: '已终止',
      currentPhaseCode: 'PHASE_03',
      currentPhaseName: '市场测款',
      currentWorkItemCode: 'TEST_CONCLUSION',
      currentWorkItemName: '测款结论判定',
      blockedFlag: false,
      blockedReason: '',
      currentNodeId: 'node-1',
      linkedStyleId: '',
      linkedStyleCode: '',
      linkedStyleName: '',
      linkedStyleGeneratedAt: '',
      linkedTechPackVersionId: '',
      linkedTechPackVersionCode: '',
      linkedTechPackVersionLabel: '',
      linkedTechPackVersionStatus: '',
      linkedTechPackVersionPublishedAt: '',
      projectArchiveId: '',
      projectArchiveNo: '',
      projectArchiveStatus: '',
      projectArchiveDocumentCount: 0,
      projectArchiveFileCount: 0,
      projectArchiveMissingItemCount: 0,
      projectArchiveUpdatedAt: '',
      projectArchiveFinalizedAt: '',
      createdAt: '2026-04-20 10:00',
      createdBy: '测试用户',
      updatedAt: '2026-04-20 10:00',
      updatedBy: '测试用户',
    } as never,
  ],
  phases: [],
  nodes: [
    {
      projectId: 'project-1',
      projectNodeId: 'node-1',
      phaseCode: 'PHASE_03',
      workItemTypeCode: 'TEST_CONCLUSION',
      workItemTypeName: '测款结论判定',
      sequenceNo: 1,
      currentStatus: '已完成',
      latestResultType: '继续开发',
      latestResultText: '旧结果',
      pendingActionType: '',
      pendingActionText: '',
      currentIssueType: '',
      currentIssueText: '',
      updatedAt: '2026-04-20 10:00',
      lastEventId: '',
      lastEventType: '',
      lastEventTime: '',
    } as never,
  ],
})

assert.equal(migratedSnapshot.projects[0].projectStatus, '进行中')
assert.equal(migratedSnapshot.nodes[0].currentStatus, '待确认')
assert.equal(migratedSnapshot.nodes[0].latestResultType, '')
assert.match(migratedSnapshot.nodes[0].currentIssueText, /旧决策结果/)

console.log('pcs-project-decision-migration.spec.ts PASS')

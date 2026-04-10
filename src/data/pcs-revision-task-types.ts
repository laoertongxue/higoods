import type { PcsTaskPendingItem } from './pcs-project-types.ts'
import type { CommonTaskStatus, RevisionTaskSourceType } from './pcs-task-source-normalizer.ts'

export type RevisionTaskStatus = CommonTaskStatus

export interface RevisionTaskRecord {
  revisionTaskId: string
  revisionTaskCode: string
  title: string
  projectId: string
  projectCode: string
  projectName: string
  projectNodeId: string
  workItemTypeCode: 'TEST_CONCLUSION'
  workItemTypeName: '测款结论判定'
  sourceType: RevisionTaskSourceType
  upstreamModule: string
  upstreamObjectType: string
  upstreamObjectId: string
  upstreamObjectCode: string
  productStyleCode: string
  spuCode: string
  status: RevisionTaskStatus
  ownerId: string
  ownerName: string
  participantNames: string[]
  priorityLevel: '高' | '中' | '低'
  dueAt: string
  revisionScopeCodes: string[]
  revisionScopeNames: string[]
  revisionVersion: string
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  note: string
  legacyProjectRef: string
  legacyUpstreamRef: string
}

export interface RevisionTaskStoreSnapshot {
  version: number
  tasks: RevisionTaskRecord[]
  pendingItems: PcsTaskPendingItem[]
}

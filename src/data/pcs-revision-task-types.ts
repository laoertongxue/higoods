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
  workItemTypeCode: 'REVISION_TASK'
  workItemTypeName: '改版任务'
  sourceType: RevisionTaskSourceType
  upstreamModule: string
  upstreamObjectType: string
  upstreamObjectId: string
  upstreamObjectCode: string
  styleId: string
  styleCode: string
  styleName: string
  referenceObjectType: string
  referenceObjectId: string
  referenceObjectCode: string
  referenceObjectName: string
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
  issueSummary: string
  evidenceSummary: string
  evidenceImageUrls: string[]
  linkedTechPackVersionId: string
  linkedTechPackVersionCode: string
  linkedTechPackVersionLabel: string
  linkedTechPackVersionStatus: string
  linkedTechPackUpdatedAt: string
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

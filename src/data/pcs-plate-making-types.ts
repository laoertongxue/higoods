import type { PcsTaskPendingItem } from './pcs-project-types.ts'
import type { CommonTaskStatus, PlateMakingTaskSourceType } from './pcs-task-source-normalizer.ts'

export type PlateMakingTaskStatus = CommonTaskStatus

export interface PlateMakingTaskRecord {
  plateTaskId: string
  plateTaskCode: string
  title: string
  projectId: string
  projectCode: string
  projectName: string
  projectNodeId: string
  workItemTypeCode: 'PATTERN_TASK'
  workItemTypeName: '制版任务'
  sourceType: PlateMakingTaskSourceType
  upstreamModule: string
  upstreamObjectType: string
  upstreamObjectId: string
  upstreamObjectCode: string
  productStyleCode: string
  spuCode: string
  patternType: string
  sizeRange: string
  patternVersion: string
  status: PlateMakingTaskStatus
  ownerId: string
  ownerName: string
  participantNames: string[]
  priorityLevel: '高' | '中' | '低'
  dueAt: string
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  note: string
  legacyProjectRef: string
  legacyUpstreamRef: string
}

export interface PlateMakingTaskStoreSnapshot {
  version: number
  tasks: PlateMakingTaskRecord[]
  pendingItems: PcsTaskPendingItem[]
}

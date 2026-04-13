import type { PcsTaskPendingItem } from './pcs-project-types.ts'
import type { CommonTaskStatus, PatternTaskSourceType } from './pcs-task-source-normalizer.ts'

export type PatternTaskStatus = CommonTaskStatus

export interface PatternTaskRecord {
  patternTaskId: string
  patternTaskCode: string
  title: string
  projectId: string
  projectCode: string
  projectName: string
  projectNodeId: string
  workItemTypeCode: 'PATTERN_ARTWORK_TASK'
  workItemTypeName: '花型任务'
  sourceType: PatternTaskSourceType
  upstreamModule: string
  upstreamObjectType: string
  upstreamObjectId: string
  upstreamObjectCode: string
  productStyleCode: string
  spuCode: string
  artworkType: string
  patternMode: string
  artworkName: string
  artworkVersion: string
  linkedTechPackVersionId: string
  linkedTechPackVersionCode: string
  linkedTechPackVersionLabel: string
  linkedTechPackVersionStatus: string
  linkedTechPackUpdatedAt: string
  status: PatternTaskStatus
  ownerId: string
  ownerName: string
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

export interface PatternTaskStoreSnapshot {
  version: number
  tasks: PatternTaskRecord[]
  pendingItems: PcsTaskPendingItem[]
}

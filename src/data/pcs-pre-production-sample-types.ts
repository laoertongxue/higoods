import type { PcsTaskPendingItem } from './pcs-project-types.ts'
import type { PreProductionSampleTaskSourceType } from './pcs-task-source-normalizer.ts'

export const PRE_PRODUCTION_SAMPLE_TASK_STATUS_LIST = ['草稿', '待发样', '在途', '已到样待入库', '验收中', '已完成', '已取消'] as const
export type PreProductionSampleTaskStatus = (typeof PRE_PRODUCTION_SAMPLE_TASK_STATUS_LIST)[number]

export interface PreProductionSampleTaskRecord {
  preProductionSampleTaskId: string
  preProductionSampleTaskCode: string
  title: string
  projectId: string
  projectCode: string
  projectName: string
  projectNodeId: string
  workItemTypeCode: 'PRE_PRODUCTION_SAMPLE'
  workItemTypeName: '产前版样衣'
  sourceType: PreProductionSampleTaskSourceType
  upstreamModule: string
  upstreamObjectType: string
  upstreamObjectId: string
  upstreamObjectCode: string
  factoryId: string
  factoryName: string
  targetSite: string
  patternVersion: string
  artworkVersion: string
  expectedArrival: string
  trackingNo: string
  sampleAssetId: string
  sampleCode: string
  acceptedAt: string
  confirmedAt: string
  status: PreProductionSampleTaskStatus
  ownerId: string
  ownerName: string
  priorityLevel: '高' | '中' | '低'
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  note: string
  legacyProjectRef: string
  legacyUpstreamRef: string
}

export interface PreProductionSampleTaskStoreSnapshot {
  version: number
  tasks: PreProductionSampleTaskRecord[]
  pendingItems: PcsTaskPendingItem[]
}

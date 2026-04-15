import type { PcsTaskPendingItem } from './pcs-project-types.ts'
import type { FirstSampleTaskSourceType } from './pcs-task-source-normalizer.ts'

export const FIRST_SAMPLE_TASK_STATUS_LIST = ['草稿', '待发样', '在途', '已到样待入库', '验收中', '已完成', '已取消'] as const
export type FirstSampleTaskStatus = (typeof FIRST_SAMPLE_TASK_STATUS_LIST)[number]

export interface FirstSampleTaskRecord {
  firstSampleTaskId: string
  firstSampleTaskCode: string
  title: string
  projectId: string
  projectCode: string
  projectName: string
  projectNodeId: string
  workItemTypeCode: 'FIRST_SAMPLE'
  workItemTypeName: '首版样衣打样'
  sourceType: FirstSampleTaskSourceType
  upstreamModule: string
  upstreamObjectType: string
  upstreamObjectId: string
  upstreamObjectCode: string
  factoryId: string
  factoryName: string
  targetSite: string
  expectedArrival: string
  trackingNo: string
  sampleAssetId: string
  sampleCode: string
  acceptedAt: string
  confirmedAt: string
  status: FirstSampleTaskStatus
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

export interface FirstSampleTaskStoreSnapshot {
  version: number
  tasks: FirstSampleTaskRecord[]
  pendingItems: PcsTaskPendingItem[]
}

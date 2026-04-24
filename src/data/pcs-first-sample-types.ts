import type { PcsTaskPendingItem } from './pcs-project-types.ts'
import type { FirstSamplePurpose, SampleMaterialMode } from './pcs-sample-chain-types.ts'
import type { FirstSampleTaskSourceType } from './pcs-task-source-normalizer.ts'

export const FIRST_SAMPLE_TASK_STATUS_LIST = ['草稿', '待处理', '打样中', '待确认', '已通过', '需改版', '需补样', '已取消'] as const
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
  sourceTechPackVersionId: string
  sourceTechPackVersionCode: string
  sourceTechPackVersionLabel: string
  sourceTaskType: string
  sourceTaskId: string
  sourceTaskCode: string
  factoryId: string
  factoryName: string
  targetSite: string
  sampleMaterialMode: SampleMaterialMode
  samplePurpose: FirstSamplePurpose
  sampleCode: string
  sampleImageIds: string[]
  reuseAsFirstOrderBasisFlag: boolean
  reuseAsFirstOrderBasisConfirmedAt: string
  reuseAsFirstOrderBasisConfirmedBy: string
  reuseAsFirstOrderBasisNote: string
  fitConfirmationSummary: string
  artworkConfirmationSummary: string
  productionReadinessNote: string
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

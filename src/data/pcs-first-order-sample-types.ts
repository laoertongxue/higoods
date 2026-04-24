import type { PcsTaskPendingItem } from './pcs-project-types.ts'
import type { SampleChainMode, SamplePlanLine, SampleSpecialSceneReasonCode } from './pcs-sample-chain-types.ts'
import type { FirstOrderSampleTaskSourceType } from './pcs-task-source-normalizer.ts'

export const FIRST_ORDER_SAMPLE_TASK_STATUS_LIST = ['草稿', '待处理', '打样中', '待确认', '已通过', '需改版', '需补首单', '已取消'] as const
export type FirstOrderSampleTaskStatus = (typeof FIRST_ORDER_SAMPLE_TASK_STATUS_LIST)[number]

export interface FirstOrderSampleTaskRecord {
  firstOrderSampleTaskId: string
  firstOrderSampleTaskCode: string
  title: string
  projectId: string
  projectCode: string
  projectName: string
  projectNodeId: string
  workItemTypeCode: 'FIRST_ORDER_SAMPLE'
  workItemTypeName: '首单样衣打样'
  sourceType: FirstOrderSampleTaskSourceType
  upstreamModule: string
  upstreamObjectType: string
  upstreamObjectId: string
  upstreamObjectCode: string
  sourceTechPackVersionId: string
  sourceTechPackVersionCode: string
  sourceTechPackVersionLabel: string
  sourceFirstSampleTaskId: string
  sourceFirstSampleTaskCode: string
  sourceFirstSampleCode: string
  factoryId: string
  factoryName: string
  targetSite: string
  patternVersion: string
  artworkVersion: string
  sampleChainMode: SampleChainMode
  specialSceneReasonCodes: SampleSpecialSceneReasonCode[]
  specialSceneReasonText: string
  productionReferenceRequiredFlag: boolean
  chinaReviewRequiredFlag: boolean
  correctFabricRequiredFlag: boolean
  samplePlanLines: SamplePlanLine[]
  finalReferenceNote: string
  sampleCode: string
  confirmedAt: string
  status: FirstOrderSampleTaskStatus
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

export interface FirstOrderSampleTaskStoreSnapshot {
  version: number
  tasks: FirstOrderSampleTaskRecord[]
  pendingItems: PcsTaskPendingItem[]
}

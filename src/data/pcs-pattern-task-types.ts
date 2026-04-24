import type { PcsTaskPendingItem } from './pcs-project-types.ts'
import type { CommonTaskStatus, PatternTaskSourceType } from './pcs-task-source-normalizer.ts'

export type PatternTaskStatus = CommonTaskStatus

export type PatternTaskDemandSourceType = '预售测款通过' | '改版任务' | '设计师款'
export type PatternTaskProcessType = '数码印' | '烫画' | '直喷'
export type PatternTaskColorDepthOption = '浅色' | '深色' | '中间值'
export type PatternTaskDifficultyGrade = 'A++' | 'A+' | 'A' | 'B' | 'C' | 'D'
export type PatternTaskBuyerReviewStatus = '待买手确认' | '买手已通过' | '买手已驳回'
export type PatternTaskTeamCode = 'CN_TEAM' | 'BDG_TEAM' | 'JKT_TEAM'

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
  styleId: string
  styleCode: string
  styleName: string
  productStyleCode: string
  spuCode: string
  demandSourceType: PatternTaskDemandSourceType
  demandSourceRefId: string
  demandSourceRefCode: string
  demandSourceRefName: string
  processType: PatternTaskProcessType
  requestQty: number
  fabricSku: string
  fabricName: string
  demandImageIds: string[]
  patternSpuCode: string
  colorDepthOption: PatternTaskColorDepthOption
  difficultyGrade: PatternTaskDifficultyGrade
  assignedTeamCode: PatternTaskTeamCode | ''
  assignedTeamName: string
  assignedMemberId: string
  assignedMemberName: string
  assignedAt: string
  liveReferenceImageIds: string[]
  imageReferenceIds: string[]
  physicalReferenceNote: string
  completionImageIds: string[]
  buyerReviewStatus: PatternTaskBuyerReviewStatus
  buyerReviewAt: string
  buyerReviewerName: string
  buyerReviewNote: string
  transferFromTeamCode: PatternTaskTeamCode | ''
  transferFromTeamName: string
  transferToTeamCode: PatternTaskTeamCode | ''
  transferToTeamName: string
  transferReason: string
  transferredAt: string
  transferOperatorName: string
  patternAssetId: string
  patternAssetCode: string
  patternCategoryCode: string
  patternStyleTags: string[]
  hotSellerFlag: boolean
  colorConfirmNote: string
  artworkType: string
  patternMode: string
  artworkName: string
  artworkVersion: string
  linkedTechPackVersionId: string
  linkedTechPackVersionCode: string
  linkedTechPackVersionLabel: string
  linkedTechPackVersionStatus: string
  linkedTechPackUpdatedAt: string
  acceptedAt: string
  confirmedAt: string
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

import type { PcsTaskPendingItem } from './pcs-project-types.ts'
import type { PlateMakingMaterialLine } from './pcs-plate-making-material-types.ts'
import type {
  PlateMakingPartTemplateLink,
  PlateMakingPatternArea,
  PlateMakingPatternImageLine,
  PlateMakingProductHistoryType,
} from './pcs-plate-making-pattern-file-types.ts'
import type { CommonTaskStatus, PlateMakingTaskSourceType } from './pcs-task-source-normalizer.ts'

export type PlateMakingTaskStatus = CommonTaskStatus
export type PlateMakingSampleReviewStatus = '未提交' | '待样板确认' | '样板已通过' | '样板已驳回'

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
  styleId: string
  styleCode: string
  styleName: string
  productStyleCode: string
  spuCode: string
  productHistoryType?: PlateMakingProductHistoryType
  patternMakerId?: string
  patternMakerName?: string
  sampleConfirmedAt?: string
  urgentFlag?: boolean
  patternArea?: PlateMakingPatternArea
  patternType: string
  sizeRange: string
  patternVersion: string
  colorRequirementText?: string
  newPatternSpuCode?: string
  flowerImageIds?: string[]
  materialRequirementLines?: PlateMakingMaterialLine[]
  patternImageLineItems?: PlateMakingPatternImageLine[]
  patternPdfFileIds?: string[]
  patternDxfFileIds?: string[]
  patternRulFileIds?: string[]
  supportImageIds?: string[]
  supportVideoIds?: string[]
  partTemplateLinks?: PlateMakingPartTemplateLink[]
  linkedTechPackVersionId: string
  linkedTechPackVersionCode: string
  linkedTechPackVersionLabel: string
  linkedTechPackVersionStatus: string
  linkedTechPackUpdatedAt: string
  primaryTechPackGeneratedFlag?: boolean
  primaryTechPackGeneratedAt?: string
  sampleReviewStatus: PlateMakingSampleReviewStatus
  sampleReviewSubmittedAt: string
  sampleReviewSubmittedBy: string
  sampleReviewerName: string
  sampleReviewAt: string
  sampleReviewNote: string
  reworkReason: string
  patternOutputSubmittedAt: string
  patternOutputSubmittedBy: string
  acceptedAt: string
  confirmedAt: string
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

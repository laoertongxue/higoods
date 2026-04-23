import type { PcsTaskPendingItem } from './pcs-project-types.ts'
import type { RevisionTaskLiveRetestStatus, RevisionTaskPatternArea } from './pcs-revision-task-file-types.ts'
import type { RevisionTaskMaterialLine } from './pcs-revision-task-material-types.ts'
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
  baseStyleId: string
  baseStyleCode: string
  baseStyleName: string
  baseStyleImageIds: string[]
  targetStyleCodeCandidate: string
  targetStyleNameCandidate: string
  targetStyleImageIds: string[]
  sampleQty: number
  stylePreference: string
  patternMakerId: string
  patternMakerName: string
  revisionSuggestionRichText: string
  paperPrintAt: string
  deliveryAddress: string
  patternArea: RevisionTaskPatternArea
  materialAdjustmentLines: RevisionTaskMaterialLine[]
  newPatternImageIds: string[]
  newPatternSpuCode: string
  patternChangeNote: string
  patternPieceImageIds: string[]
  patternFileIds: string[]
  mainImageIds: string[]
  designDraftImageIds: string[]
  liveRetestRequired: boolean
  liveRetestStatus: RevisionTaskLiveRetestStatus
  liveRetestRelationIds: string[]
  liveRetestSummary: string
  linkedTechPackVersionId: string
  linkedTechPackVersionCode: string
  linkedTechPackVersionLabel: string
  linkedTechPackVersionStatus: string
  linkedTechPackUpdatedAt: string
  generatedNewTechPackVersionFlag: boolean
  generatedNewTechPackVersionAt: string
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

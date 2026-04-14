import type { TemplateStyleType } from './pcs-templates.ts'

export type ProjectStatus = '待审核' | '已立项' | '进行中' | '已终止' | '已归档'
export type ProjectPhaseStatus = '未开始' | '进行中' | '已完成' | '已终止'
export type ProjectNodeStatus = '未开始' | '进行中' | '待确认' | '已完成' | '已取消'
export type LegacyProjectNodeStatus = ProjectNodeStatus | '待决策' | '未解锁'
export type ProjectPriorityLevel = '高' | '中' | '低'
export type ProjectType = '商品开发' | '快反上新' | '改版开发' | '设计研发'
export type ProjectSourceType = '企划提案' | '渠道反馈' | '测款沉淀' | '历史复用' | '外部灵感'
export type SampleSourceType = '外采' | '自打样' | '委托打样'
export type ProjectRiskStatus = '正常' | '延期'
export type ProjectMarketTestWorkItemTypeCode = 'LIVE_TEST' | 'VIDEO_TEST'

export interface PcsProjectRecord {
  projectId: string
  projectCode: string
  projectName: string
  projectType: ProjectType
  projectSourceType: ProjectSourceType
  templateId: string
  templateName: string
  templateVersion: string
  projectStatus: ProjectStatus
  currentPhaseCode: string
  currentPhaseName: string
  categoryId: string
  categoryName: string
  subCategoryId: string
  subCategoryName: string
  brandId: string
  brandName: string
  styleNumber: string
  styleCodeId: string
  styleCodeName: string
  styleType: TemplateStyleType
  yearTag: string
  seasonTags: string[]
  styleTags: string[]
  styleTagIds: string[]
  styleTagNames: string[]
  crowdPositioningIds: string[]
  crowdPositioningNames: string[]
  ageIds: string[]
  ageNames: string[]
  crowdIds: string[]
  crowdNames: string[]
  productPositioningIds: string[]
  productPositioningNames: string[]
  targetAudienceTags: string[]
  priceRangeLabel: string
  targetChannelCodes: string[]
  projectAlbumUrls: string[]
  sampleSourceType: SampleSourceType | ''
  sampleSupplierId: string
  sampleSupplierName: string
  sampleLink: string
  sampleUnitPrice: number | null
  ownerId: string
  ownerName: string
  teamId: string
  teamName: string
  collaboratorIds: string[]
  collaboratorNames: string[]
  priorityLevel: ProjectPriorityLevel
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  remark: string
  linkedStyleId?: string
  linkedStyleCode?: string
  linkedStyleName?: string
  linkedStyleGeneratedAt?: string
  linkedTechPackVersionId?: string
  linkedTechPackVersionCode?: string
  linkedTechPackVersionLabel?: string
  linkedTechPackVersionStatus?: string
  linkedTechPackVersionPublishedAt?: string
  projectArchiveId?: string
  projectArchiveNo?: string
  projectArchiveStatus?: string
  projectArchiveDocumentCount?: number
  projectArchiveFileCount?: number
  projectArchiveMissingItemCount?: number
  projectArchiveUpdatedAt?: string
  projectArchiveFinalizedAt?: string
  progressDone?: number
  progressTotal?: number
  nextWorkItemName?: string
  nextWorkItemStatus?: ProjectNodeStatus | '-'
  pendingDecisionFlag?: boolean
  blockedFlag?: boolean
  blockedReason?: string
  riskStatus?: ProjectRiskStatus
  riskReason?: string
  riskWorkItem?: string
  riskDurationDays?: number
}

export interface PcsProjectPhaseRecord {
  projectPhaseId: string
  projectId: string
  phaseCode: string
  phaseName: string
  phaseOrder: number
  phaseStatus: ProjectPhaseStatus
  startedAt: string
  finishedAt: string
  ownerId: string
  ownerName: string
}

export interface PcsProjectNodeRecord {
  projectNodeId: string
  projectId: string
  phaseCode: string
  phaseName: string
  workItemId: string
  workItemTypeCode: string
  workItemTypeName: string
  sequenceNo: number
  requiredFlag: boolean
  multiInstanceFlag: boolean
  currentStatus: ProjectNodeStatus
  currentOwnerId: string
  currentOwnerName: string
  validInstanceCount: number
  latestInstanceId: string
  latestInstanceCode: string
  latestResultType: string
  latestResultText: string
  currentIssueType: string
  currentIssueText: string
  pendingActionType: string
  pendingActionText: string
  sourceTemplateNodeId: string
  sourceTemplateVersion: string
  updatedAt?: string
  lastEventId?: string
  lastEventType?: string
  lastEventTime?: string
}

export interface ProjectIdentityRef {
  projectId: string
  projectCode: string
  projectName: string
}

export interface ProjectNodeIdentityRef {
  projectNodeId: string
  projectId: string
  phaseCode: string
  phaseName: string
  workItemId: string
  workItemTypeCode: string
  workItemTypeName: string
}

export interface PcsProjectStoreSnapshot {
  version: number
  projects: PcsProjectRecord[]
  phases: PcsProjectPhaseRecord[]
  nodes: PcsProjectNodeRecord[]
}

export interface PcsProjectCreateDraft {
  projectName: string
  projectType: ProjectType | ''
  projectSourceType: ProjectSourceType | ''
  templateId: string
  categoryId: string
  categoryName: string
  subCategoryId: string
  subCategoryName: string
  brandId: string
  brandName: string
  styleNumber: string
  styleCodeId: string
  styleCodeName: string
  styleType: TemplateStyleType | ''
  yearTag: string
  seasonTags: string[]
  styleTags: string[]
  styleTagIds: string[]
  styleTagNames: string[]
  crowdPositioningIds: string[]
  crowdPositioningNames: string[]
  ageIds: string[]
  ageNames: string[]
  crowdIds: string[]
  crowdNames: string[]
  productPositioningIds: string[]
  productPositioningNames: string[]
  targetAudienceTags: string[]
  priceRangeLabel: string
  targetChannelCodes: string[]
  projectAlbumUrls: string[]
  sampleSourceType: SampleSourceType | ''
  sampleSupplierId: string
  sampleSupplierName: string
  sampleLink: string
  sampleUnitPrice: string
  ownerId: string
  ownerName: string
  teamId: string
  teamName: string
  collaboratorIds: string[]
  collaboratorNames: string[]
  priorityLevel: ProjectPriorityLevel
  remark: string
}

export interface ProjectCategoryOption {
  id: string
  name: string
  children: Array<{
    id: string
    name: string
  }>
}

export interface ProjectSimpleOption {
  id: string
  name: string
}

export interface ProjectCreateCatalog {
  projectTypes: ProjectType[]
  projectSourceTypes: ProjectSourceType[]
  styleTypes: TemplateStyleType[]
  categories: ProjectCategoryOption[]
  brands: ProjectSimpleOption[]
  styles: ProjectSimpleOption[]
  styleCodes: ProjectSimpleOption[]
  crowdPositioning: ProjectSimpleOption[]
  ages: ProjectSimpleOption[]
  crowds: ProjectSimpleOption[]
  productPositioning: ProjectSimpleOption[]
  sampleSuppliers: ProjectSimpleOption[]
  owners: ProjectSimpleOption[]
  teams: ProjectSimpleOption[]
  collaborators: ProjectSimpleOption[]
  seasonTags: string[]
  styleTags: string[]
  targetAudienceTags: string[]
  priceRanges: string[]
  channelOptions: Array<{ code: string; name: string }>
  sampleSourceTypes: SampleSourceType[]
  priorityLevels: ProjectPriorityLevel[]
}

export interface ProjectCreateResult {
  project: PcsProjectRecord
  phases: PcsProjectPhaseRecord[]
  nodes: PcsProjectNodeRecord[]
}

export interface PcsTaskPendingItem {
  pendingId: string
  taskType: string
  rawTaskCode: string
  rawProjectField: string
  rawSourceField: string
  reason: string
  discoveredAt: string
}

export const PROJECT_RELATION_ROLES = ['来源对象', '执行记录', '产出对象', '参考资料'] as const
export type ProjectRelationRole = (typeof PROJECT_RELATION_ROLES)[number]

export const PROJECT_RELATION_SOURCE_MODULES = [
  '渠道店铺商品',
  '渠道商品',
  '上游渠道商品同步',
  '改版任务',
  '制版任务',
  '花型任务',
  '首版样衣打样',
  '产前版样衣',
  '款式档案',
  '技术包',
  '项目资料归档',
  '样衣资产',
  '样衣台账',
  '直播',
  '短视频',
] as const
export type ProjectRelationSourceModule = (typeof PROJECT_RELATION_SOURCE_MODULES)[number]

export const PROJECT_RELATION_SOURCE_OBJECT_TYPES = [
  '渠道店铺商品',
  '渠道商品',
  '上游渠道商品同步',
  '改版任务',
  '制版任务',
  '花型任务',
  '首版样衣打样任务',
  '产前版样衣任务',
  '款式档案',
  '技术包版本',
  '项目资料归档',
  '样衣资产',
  '样衣台账事件',
  '直播商品明细',
  '短视频记录',
] as const
export type ProjectRelationSourceObjectType = (typeof PROJECT_RELATION_SOURCE_OBJECT_TYPES)[number]
export type ProjectRelationTestingSourceObjectType = Extract<ProjectRelationSourceObjectType, '直播商品明细' | '短视频记录'>
export type ProjectRelationStyleArchiveSourceObjectType = Extract<ProjectRelationSourceObjectType, '款式档案'>
export type ProjectRelationTechnicalVersionSourceObjectType = Extract<ProjectRelationSourceObjectType, '技术包版本'>
export type ProjectRelationArchiveSourceObjectType = Extract<ProjectRelationSourceObjectType, '项目资料归档'>
export type ProjectRelationTaskSourceModule = Extract<
  ProjectRelationSourceModule,
  '改版任务' | '制版任务' | '花型任务' | '首版样衣打样' | '产前版样衣'
>
export type ProjectRelationTaskSourceObjectType = Extract<
  ProjectRelationSourceObjectType,
  '改版任务' | '制版任务' | '花型任务' | '首版样衣打样任务' | '产前版样衣任务'
>

export interface ProjectRelationRecord {
  projectRelationId: string
  projectId: string
  projectCode: string
  projectNodeId: string | null
  workItemTypeCode: string
  workItemTypeName: string
  relationRole: ProjectRelationRole
  sourceModule: ProjectRelationSourceModule
  sourceObjectType: ProjectRelationSourceObjectType
  sourceObjectId: string
  sourceObjectCode: string
  sourceLineId: string | null
  sourceLineCode: string | null
  sourceTitle: string
  sourceStatus: string
  businessDate: string
  ownerName: string
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  note: string
  legacyRefType: string
  legacyRefValue: string
}

export interface ProjectRelationPendingItem {
  pendingRelationId: string
  sourceModule: string
  sourceObjectCode: string
  rawProjectCode: string
  reason: string
  discoveredAt: string
  sourceTitle: string
  legacyRefType: string
  legacyRefValue: string
}

export interface ProjectRelationStoreSnapshot {
  version: number
  relations: ProjectRelationRecord[]
  pendingItems: ProjectRelationPendingItem[]
}

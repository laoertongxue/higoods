import {
  getChannelNamesByCodes,
  getProjectById,
  listProjectNodes,
} from './pcs-project-repository.ts'
import {
  listProjectReferenceImageViewModels,
  listProjectSampleShootImageViewModels,
} from './pcs-project-image-view-model.ts'
import type { PcsProjectNodeRecord, PcsProjectViewRecord } from './pcs-project-types.ts'
import {
  getLatestProjectInlineNodeRecord,
  listProjectInlineNodeRecordsByProject,
} from './pcs-project-inline-node-record-repository.ts'
import type { PcsProjectInlineNodeRecord } from './pcs-project-inline-node-record-types.ts'
import { listProjectRelationsByProject } from './pcs-project-relation-repository.ts'
import type { ProjectRelationRecord } from './pcs-project-relation-types.ts'
import {
  getPcsWorkItemRuntimeCarrierDefinition,
  type PcsWorkItemRuntimeCarrierMode,
} from './pcs-work-item-runtime-carrier.ts'
import { getProjectWorkItemContract, type PcsProjectWorkItemCode } from './pcs-project-domain-contract.ts'
import { getProjectChannelProductById } from './pcs-channel-product-project-repository.ts'
import { getRevisionTaskById } from './pcs-revision-task-repository.ts'
import { getPlateMakingTaskById } from './pcs-plate-making-repository.ts'
import { getPatternTaskById } from './pcs-pattern-task-repository.ts'
import { getFirstSampleTaskById } from './pcs-first-sample-repository.ts'
import { getFirstOrderSampleTaskById } from './pcs-first-order-sample-repository.ts'
import { getLiveProductLineById, getLiveSessionRecordById } from './pcs-live-testing-repository.ts'
import { getVideoTestRecordById } from './pcs-video-testing-repository.ts'
import { getStyleArchiveById } from './pcs-style-archive-repository.ts'
import { getSkuArchiveById, findSkuArchiveByCode } from './pcs-sku-archive-repository.ts'
import { getTechnicalDataVersionById } from './pcs-technical-data-version-repository.ts'
import { getProjectArchiveById } from './pcs-project-archive-repository.ts'
import { getLiveSessionById, getLiveSessionItems, getVideoItems, getVideoRecordById } from './pcs-testing.ts'

export type PcsProjectInstanceSourceKind = 'PROJECT_RECORD' | 'INLINE_RECORD' | 'RELATION_OBJECT'
export type PcsProjectInstanceSourceLayer = '项目主记录' | '项目内正式记录' | '正式业务对象'

export interface PcsProjectInstanceField {
  fieldKey?: string
  label: string
  value: string
}

export interface PcsProjectInstanceItem {
  instanceKey: string
  projectId: string
  projectCode: string
  projectNodeId: string | null
  workItemTypeCode: string
  workItemTypeName: string
  sourceKind: PcsProjectInstanceSourceKind
  sourceLayer: PcsProjectInstanceSourceLayer
  carrierMode: PcsWorkItemRuntimeCarrierMode
  carrierLabel: string
  moduleName: string
  objectType: string
  relationRole: string
  sourceObjectId: string
  sourceObjectCode: string
  sourceLineId: string
  sourceLineCode: string
  instanceId: string
  instanceCode: string
  title: string
  status: string
  ownerName: string
  businessDate: string
  updatedAt: string
  summaryText: string
  targetRoute: string | null
  fields: PcsProjectInstanceField[]
}

export interface PcsProjectNodeInstanceModel {
  projectId: string
  projectCode: string
  projectNodeId: string
  workItemTypeCode: string
  workItemTypeName: string
  carrierMode: PcsWorkItemRuntimeCarrierMode
  carrierLabel: string
  moduleName: string
  projectRecordCount: number
  inlineRecordCount: number
  formalRecordCount: number
  relatedObjectCount: number
  totalCount: number
  latestInstance: PcsProjectInstanceItem | null
  instances: PcsProjectInstanceItem[]
}

export interface PcsProjectInstanceModel {
  projectId: string
  projectCode: string
  projectRecordCount: number
  inlineRecordCount: number
  formalRecordCount: number
  relatedObjectCount: number
  totalCount: number
  latestInstance: PcsProjectInstanceItem | null
  moduleCounts: Array<{ moduleName: string; count: number }>
  nodes: PcsProjectNodeInstanceModel[]
  instances: PcsProjectInstanceItem[]
}

interface ResolvedRelationObjectSnapshot {
  instanceId: string
  instanceCode: string
  title: string
  status: string
  ownerName: string
  businessDate: string
  updatedAt: string
  summaryText: string
  targetRoute: string | null
  fields: PcsProjectInstanceField[]
}

function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || value === ''
}

function formatInstanceValue(value: unknown): string {
  if (isEmptyValue(value)) return ''
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (Array.isArray(value)) {
    return value
      .map((item) => formatInstanceValue(item))
      .filter(Boolean)
      .join('、')
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? `${value}` : ''
  }
  if (typeof value === 'string') return value.trim()
  return ''
}

function addField(fields: PcsProjectInstanceField[], label: string, value: unknown, fieldKey?: string): void {
  const text = formatInstanceValue(value)
  if (!text) return
  fields.push({ fieldKey, label, value: text })
}

function buildSummaryFromFields(fields: PcsProjectInstanceField[], fallback: string): string {
  const summary = fields
    .slice(0, 3)
    .map((field) => `${field.label}：${field.value}`)
    .join('；')
  return summary || fallback
}

function compareInstances(left: PcsProjectInstanceItem, right: PcsProjectInstanceItem): number {
  const leftDate = left.updatedAt || left.businessDate || ''
  const rightDate = right.updatedAt || right.businessDate || ''
  if (leftDate !== rightDate) return rightDate.localeCompare(leftDate)
  if (left.businessDate !== right.businessDate) return right.businessDate.localeCompare(left.businessDate)
  return right.instanceCode.localeCompare(left.instanceCode)
}

function buildFieldLabelMap(workItemTypeCode: string): Map<string, string> {
  const contract = getProjectWorkItemContract(workItemTypeCode as PcsProjectWorkItemCode)
  return new Map(contract.fieldDefinitions.map((field) => [field.fieldKey, field.label]))
}

function parseRelationMeta(note: string | null | undefined): Record<string, unknown> {
  if (!note) return {}
  const trimmed = note.trim()
  if (!trimmed.startsWith('{')) return {}
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return {}
  }
  return {}
}

function buildProjectRecordInstance(project: PcsProjectViewRecord, node: PcsProjectNodeRecord): PcsProjectInstanceItem {
  const carrier = getPcsWorkItemRuntimeCarrierDefinition(node.workItemTypeCode as PcsProjectWorkItemCode)
  const labelMap = buildFieldLabelMap('PROJECT_INIT')
  const fields: PcsProjectInstanceField[] = []

  addField(fields, labelMap.get('projectName') || '项目名称', project.projectName, 'projectName')
  addField(fields, labelMap.get('projectType') || '项目类型', project.projectType, 'projectType')
  addField(fields, labelMap.get('projectSourceType') || '项目来源类型', project.projectSourceType, 'projectSourceType')
  addField(fields, labelMap.get('templateId') || '项目模板', `${project.templateName} / ${project.templateVersion}`, 'templateId')
  addField(fields, labelMap.get('styleType') || '款式类型', project.styleType, 'styleType')
  addField(fields, labelMap.get('categoryId') || '品类', project.categoryName, 'categoryId')
  addField(fields, labelMap.get('categoryName') || '品类名称快照', project.categoryName, 'categoryName')
  addField(fields, labelMap.get('subCategoryId') || '二级品类', project.subCategoryName || project.subCategoryId, 'subCategoryId')
  addField(fields, labelMap.get('subCategoryName') || '二级品类名称快照', project.subCategoryName, 'subCategoryName')
  addField(fields, labelMap.get('brandId') || '品牌', project.brandName, 'brandId')
  addField(fields, labelMap.get('brandName') || '品牌名称快照', project.brandName, 'brandName')
  addField(fields, labelMap.get('styleCodeId') || '风格编号', project.styleCodeName, 'styleCodeId')
  addField(fields, labelMap.get('styleCodeName') || '风格编号名称快照', project.styleCodeName, 'styleCodeName')
  addField(fields, labelMap.get('yearTag') || '年份', project.yearTag, 'yearTag')
  addField(fields, labelMap.get('seasonTags') || '季节标签', project.seasonTags, 'seasonTags')
  addField(fields, labelMap.get('styleTags') || '风格标签快照', project.styleTags, 'styleTags')
  addField(fields, labelMap.get('styleTagIds') || '风格标签', project.styleTagNames, 'styleTagIds')
  addField(fields, labelMap.get('styleTagNames') || '风格标签名称', project.styleTagNames, 'styleTagNames')
  addField(fields, labelMap.get('crowdPositioningIds') || '人群定位', project.crowdPositioningNames, 'crowdPositioningIds')
  addField(fields, labelMap.get('crowdPositioningNames') || '人群定位名称', project.crowdPositioningNames, 'crowdPositioningNames')
  addField(fields, labelMap.get('ageIds') || '年龄带', project.ageNames, 'ageIds')
  addField(fields, labelMap.get('ageNames') || '年龄带名称', project.ageNames, 'ageNames')
  addField(fields, labelMap.get('crowdIds') || '人群', project.crowdNames, 'crowdIds')
  addField(fields, labelMap.get('crowdNames') || '人群名称', project.crowdNames, 'crowdNames')
  addField(fields, labelMap.get('productPositioningIds') || '商品定位', project.productPositioningNames, 'productPositioningIds')
  addField(fields, labelMap.get('productPositioningNames') || '商品定位名称', project.productPositioningNames, 'productPositioningNames')
  addField(fields, labelMap.get('targetAudienceTags') || '目标客群标签', project.targetAudienceTags, 'targetAudienceTags')
  addField(fields, labelMap.get('priceRangeLabel') || '价格带', project.priceRangeLabel, 'priceRangeLabel')
  addField(fields, labelMap.get('targetChannelCodes') || '目标测款渠道', getChannelNamesByCodes(project.targetChannelCodes), 'targetChannelCodes')
  addField(
    fields,
    labelMap.get('projectAlbumUrls') || '参考图片',
    listProjectReferenceImageViewModels(project.projectId).map((item) => item.imageName),
    'projectAlbumUrls',
  )
  addField(fields, labelMap.get('ownerId') || '负责人', project.ownerName, 'ownerId')
  addField(fields, labelMap.get('ownerName') || '负责人名称', project.ownerName, 'ownerName')
  addField(fields, labelMap.get('teamId') || '执行团队', project.teamName, 'teamId')
  addField(fields, labelMap.get('teamName') || '执行团队名称', project.teamName, 'teamName')
  addField(fields, labelMap.get('collaboratorIds') || '协同人', project.collaboratorNames, 'collaboratorIds')
  addField(fields, labelMap.get('collaboratorNames') || '协同人名称', project.collaboratorNames, 'collaboratorNames')
  addField(fields, labelMap.get('priorityLevel') || '优先级', project.priorityLevel, 'priorityLevel')
  addField(fields, labelMap.get('remark') || '备注', project.remark, 'remark')

  return {
    instanceKey: `project-record:${project.projectId}:${node.projectNodeId}`,
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectNodeId: node.projectNodeId,
    workItemTypeCode: node.workItemTypeCode,
    workItemTypeName: node.workItemTypeName,
    sourceKind: 'PROJECT_RECORD',
    sourceLayer: '项目主记录',
    carrierMode: carrier.runtimeCarrierMode,
    carrierLabel: carrier.runtimeCarrierLabel,
    moduleName: carrier.moduleName,
    objectType: '商品项目',
    relationRole: '项目主记录',
    sourceObjectId: project.projectId,
    sourceObjectCode: project.projectCode,
    sourceLineId: '',
    sourceLineCode: '',
    instanceId: project.projectId,
    instanceCode: project.projectCode,
    title: project.projectName,
    status: project.projectStatus,
    ownerName: project.ownerName,
    businessDate: project.createdAt.slice(0, 10),
    updatedAt: project.updatedAt,
    summaryText: buildSummaryFromFields(fields, `品牌 ${project.brandName}，当前状态 ${project.projectStatus}`),
    targetRoute: `/pcs/projects/${encodeURIComponent(project.projectId)}`,
    fields,
  }
}

function buildInlineRecordFields(record: PcsProjectInlineNodeRecord): PcsProjectInstanceField[] {
  const labelMap = buildFieldLabelMap(record.workItemTypeCode)
  const merged = {
    ...(record.payload && typeof record.payload === 'object' ? (record.payload as Record<string, unknown>) : {}),
    ...(record.detailSnapshot && typeof record.detailSnapshot === 'object'
      ? (record.detailSnapshot as Record<string, unknown>)
      : {}),
  }

  const fields: PcsProjectInstanceField[] = []
  const sampleShootImageMap =
    record.workItemTypeCode === 'SAMPLE_SHOOT_FIT'
      ? new Map(listProjectSampleShootImageViewModels(record.projectId).map((item) => [item.imageId, item.imageName]))
      : null
  getProjectWorkItemContract(record.workItemTypeCode as PcsProjectWorkItemCode).fieldDefinitions.forEach((field) => {
    let value = merged[field.fieldKey]
    if (
      sampleShootImageMap &&
      Array.isArray(value) &&
      (
        field.fieldKey === 'sampleFlatImageIds' ||
        field.fieldKey === 'sampleTryOnImageIds' ||
        field.fieldKey === 'sampleDetailImageIds' ||
        field.fieldKey === 'listingCandidateImageIds' ||
        field.fieldKey === 'styleArchiveCandidateImageIds'
      )
    ) {
      value = value.map((item) => sampleShootImageMap.get(String(item)) || String(item)).filter(Boolean)
    }
    if (isEmptyValue(value)) return
    addField(fields, labelMap.get(field.fieldKey) || field.label, value, field.fieldKey)
  })
  return fields.slice(0, 6)
}

function buildInlineRecordInstance(record: PcsProjectInlineNodeRecord): PcsProjectInstanceItem {
  const carrier = getPcsWorkItemRuntimeCarrierDefinition(record.workItemTypeCode as PcsProjectWorkItemCode)
  const fields = buildInlineRecordFields(record)
  return {
    instanceKey: `inline-record:${record.recordId}`,
    projectId: record.projectId,
    projectCode: record.projectCode,
    projectNodeId: record.projectNodeId,
    workItemTypeCode: record.workItemTypeCode,
    workItemTypeName: record.workItemTypeName,
    sourceKind: 'INLINE_RECORD',
    sourceLayer: '项目内正式记录',
    carrierMode: carrier.runtimeCarrierMode,
    carrierLabel: carrier.runtimeCarrierLabel,
    moduleName: carrier.moduleName,
    objectType: '项目内正式记录',
    relationRole: '执行记录',
    sourceObjectId: record.recordId,
    sourceObjectCode: record.recordCode,
    sourceLineId: '',
    sourceLineCode: '',
    instanceId: record.recordId,
    instanceCode: record.recordCode,
    title: record.workItemTypeName,
    status: record.recordStatus,
    ownerName: record.ownerName,
    businessDate: record.businessDate,
    updatedAt: record.updatedAt,
    summaryText: buildSummaryFromFields(fields, record.sourceDocCode || record.sourceModule || '项目内正式记录'),
    targetRoute: `/pcs/projects/${encodeURIComponent(record.projectId)}`,
    fields,
  }
}

function buildFallbackRelationFields(relation: ProjectRelationRecord, meta: Record<string, unknown>): PcsProjectInstanceField[] {
  const fields: PcsProjectInstanceField[] = []
  addField(fields, '关联角色', relation.relationRole, 'relationRole')
  addField(fields, '来源模块', relation.sourceModule, 'sourceModule')
  addField(fields, '对象编码', relation.sourceLineCode || relation.sourceObjectCode, 'sourceObjectCode')
  addField(fields, '上游编码', meta.upstreamChannelProductCode, 'upstreamChannelProductCode')
  addField(fields, '备注', relation.note && !relation.note.trim().startsWith('{') ? relation.note : '', 'note')
  return fields
}

function resolveChannelProductRelationObject(relation: ProjectRelationRecord, meta: Record<string, unknown>): ResolvedRelationObjectSnapshot {
  const record = getProjectChannelProductById(relation.sourceObjectId)
  const sku =
    (record?.skuId ? getSkuArchiveById(record.skuId) : null) ||
    (record?.skuCode ? findSkuArchiveByCode(record.skuCode) : null)
  const fields: PcsProjectInstanceField[] = []
  addField(fields, '渠道', record?.channelCode, 'targetChannelCode')
  addField(fields, '店铺', record?.storeId, 'targetStoreId')
  addField(fields, '规格档案ID', record?.skuId || sku?.skuId, 'skuId')
  addField(fields, '规格档案编码', record?.skuCode || sku?.skuCode, 'skuCode')
  addField(fields, '规格档案名称', record?.skuName || sku?.skuName, 'skuName')
  addField(fields, '渠道店铺商品编码', record?.channelProductCode, 'channelProductCode')
  addField(fields, '渠道编码', record?.channelCode, 'channelCode')
  addField(fields, '渠道名称', record?.channelName, 'channelName')
  addField(fields, '店铺 ID', record?.storeId, 'storeId')
  addField(fields, '店铺名称', record?.storeName, 'storeName')
  addField(fields, '币种', record?.currency, 'currency')
  addField(fields, '商品标题', record?.listingTitle, 'listingTitle')
  addField(fields, '标价', record?.listingPrice, 'listingPrice')
  addField(fields, '作废原因', record?.invalidatedReason, 'invalidatedReason')
  addField(fields, '渠道 / 店铺', record ? `${record.channelName} / ${record.storeName}` : '', 'channelStoreDisplay')
  addField(fields, '渠道店铺商品状态', record?.channelProductStatus || relation.sourceStatus, 'channelProductStatus')
  addField(fields, '上游更新状态', record?.upstreamSyncStatus, 'upstreamSyncStatus')
  addField(fields, '关联上游编码', record?.upstreamChannelProductCode || meta.upstreamChannelProductCode, 'upstreamChannelProductCode')
  addField(fields, '关联款式档案', record?.styleCode || meta.styleCode || meta.linkedStyleCode, 'linkedStyleCode')
  addField(fields, '关联规格档案', record?.skuCode || sku?.skuCode, 'skuCode')
  addField(fields, '规格名称', record?.skuName || sku?.skuName, 'skuName')
  addField(fields, '定价', record ? `${record.currency} ${record.listingPrice}` : '', 'listingPriceDisplay')
  return {
    instanceId: record?.channelProductId || relation.sourceObjectId,
    instanceCode: record?.channelProductCode || relation.sourceObjectCode,
    title: record?.listingTitle || relation.sourceTitle,
    status: record?.channelProductStatus || relation.sourceStatus,
    ownerName: relation.ownerName,
    businessDate: relation.businessDate,
    updatedAt: record?.updatedAt || relation.updatedAt,
    summaryText: buildSummaryFromFields(fields, relation.sourceTitle),
    targetRoute: record ? `/pcs/products/channel-products/${encodeURIComponent(record.channelProductId)}` : '/pcs/products/channel-products',
    fields,
  }
}

function resolveRevisionTaskRelationObject(relation: ProjectRelationRecord): ResolvedRelationObjectSnapshot {
  const task = getRevisionTaskById(relation.sourceObjectId)
  const fields: PcsProjectInstanceField[] = []
  addField(fields, '改版范围', task?.revisionScopeNames, 'revisionScopeNames')
  addField(fields, '优先级', task?.priorityLevel, 'priorityLevel')
  addField(fields, '关联技术包', task?.linkedTechPackVersionCode, 'linkedTechPackVersionCode')
  addField(fields, '截止时间', task?.dueAt, 'dueAt')
  return {
    instanceId: task?.revisionTaskId || relation.sourceObjectId,
    instanceCode: task?.revisionTaskCode || relation.sourceObjectCode,
    title: task?.title || relation.sourceTitle,
    status: task?.status || relation.sourceStatus,
    ownerName: task?.ownerName || relation.ownerName,
    businessDate: relation.businessDate,
    updatedAt: task?.updatedAt || relation.updatedAt,
    summaryText: buildSummaryFromFields(fields, relation.sourceTitle),
    targetRoute: task ? `/pcs/patterns/revision/${encodeURIComponent(task.revisionTaskId)}` : '/pcs/patterns/revision',
    fields,
  }
}

function resolvePlateTaskRelationObject(relation: ProjectRelationRecord): ResolvedRelationObjectSnapshot {
  const task = getPlateMakingTaskById(relation.sourceObjectId)
  const fields: PcsProjectInstanceField[] = []
  addField(fields, '版型类型', task?.patternType, 'patternType')
  addField(fields, '尺码段', task?.sizeRange, 'sizeRange')
  addField(fields, '版型版本', task?.patternVersion, 'patternVersion')
  addField(fields, '关联技术包', task?.linkedTechPackVersionCode, 'linkedTechPackVersionCode')
  return {
    instanceId: task?.plateTaskId || relation.sourceObjectId,
    instanceCode: task?.plateTaskCode || relation.sourceObjectCode,
    title: task?.title || relation.sourceTitle,
    status: task?.status || relation.sourceStatus,
    ownerName: task?.ownerName || relation.ownerName,
    businessDate: relation.businessDate,
    updatedAt: task?.updatedAt || relation.updatedAt,
    summaryText: buildSummaryFromFields(fields, relation.sourceTitle),
    targetRoute: task ? `/pcs/patterns/plate-making/${encodeURIComponent(task.plateTaskId)}` : '/pcs/patterns/plate-making',
    fields,
  }
}

function resolvePatternTaskRelationObject(relation: ProjectRelationRecord): ResolvedRelationObjectSnapshot {
  const task = getPatternTaskById(relation.sourceObjectId)
  const fields: PcsProjectInstanceField[] = []
  addField(fields, '花型类型', task?.artworkType, 'artworkType')
  addField(fields, '图案方式', task?.patternMode, 'patternMode')
  addField(fields, '花型版本', task?.artworkVersion, 'artworkVersion')
  addField(fields, '关联技术包', task?.linkedTechPackVersionCode, 'linkedTechPackVersionCode')
  return {
    instanceId: task?.patternTaskId || relation.sourceObjectId,
    instanceCode: task?.patternTaskCode || relation.sourceObjectCode,
    title: task?.title || relation.sourceTitle,
    status: task?.status || relation.sourceStatus,
    ownerName: task?.ownerName || relation.ownerName,
    businessDate: relation.businessDate,
    updatedAt: task?.updatedAt || relation.updatedAt,
    summaryText: buildSummaryFromFields(fields, relation.sourceTitle),
    targetRoute: task ? `/pcs/patterns/colors/${encodeURIComponent(task.patternTaskId)}` : '/pcs/patterns/colors',
    fields,
  }
}

function resolveFirstSampleRelationObject(relation: ProjectRelationRecord): ResolvedRelationObjectSnapshot {
  const task = getFirstSampleTaskById(relation.sourceObjectId)
  const meta = parseRelationMeta(relation.note)
  const pick = (key: string): unknown => {
    if (task && key in task) return (task as unknown as Record<string, unknown>)[key]
    return meta[key]
  }
  const fields: PcsProjectInstanceField[] = []
  addField(fields, '来源任务类型', pick('sourceTaskType'), 'sourceTaskType')
  addField(fields, '来源任务ID', pick('sourceTaskId'), 'sourceTaskId')
  addField(fields, '来源任务编码', pick('sourceTaskCode'), 'sourceTaskCode')
  addField(fields, '来源技术包版本ID', pick('sourceTechPackVersionId'), 'sourceTechPackVersionId')
  addField(fields, '来源技术包版本编码', pick('sourceTechPackVersionCode'), 'sourceTechPackVersionCode')
  addField(fields, '来源技术包版本标签', pick('sourceTechPackVersionLabel'), 'sourceTechPackVersionLabel')
  addField(fields, '工厂', pick('factoryName') || pick('factoryId'), 'factoryName')
  addField(fields, '打样区域', pick('targetSite'), 'targetSite')
  addField(fields, '样衣材质模式', pick('sampleMaterialMode'), 'sampleMaterialMode')
  addField(fields, '样衣用途', pick('samplePurpose'), 'samplePurpose')
  addField(fields, '结果编号', pick('sampleCode'), 'sampleCode')
  addField(fields, '样衣图片', pick('sampleImageIds'), 'sampleImageIds')
  addField(fields, '版型确认说明', pick('fitConfirmationSummary'), 'fitConfirmationSummary')
  addField(fields, '花型确认说明', pick('artworkConfirmationSummary'), 'artworkConfirmationSummary')
  addField(fields, '生产准备说明', pick('productionReadinessNote'), 'productionReadinessNote')
  addField(fields, '是否可复用为首单', pick('reuseAsFirstOrderBasisFlag'), 'reuseAsFirstOrderBasisFlag')
  addField(fields, '复用确认时间', pick('reuseAsFirstOrderBasisConfirmedAt'), 'reuseAsFirstOrderBasisConfirmedAt')
  addField(fields, '复用确认人', pick('reuseAsFirstOrderBasisConfirmedBy'), 'reuseAsFirstOrderBasisConfirmedBy')
  addField(fields, '复用说明', pick('reuseAsFirstOrderBasisNote'), 'reuseAsFirstOrderBasisNote')
  addField(fields, '任务来源类型', pick('sourceType'), 'sourceType')
  addField(fields, '上游模块', pick('upstreamModule'), 'upstreamModule')
  addField(fields, '上游对象类型', pick('upstreamObjectType'), 'upstreamObjectType')
  addField(fields, '上游对象ID', pick('upstreamObjectId'), 'upstreamObjectId')
  addField(fields, '上游对象编码', pick('upstreamObjectCode'), 'upstreamObjectCode')
  addField(fields, '任务状态', pick('status') || relation.sourceStatus, 'taskStatus')
  addField(fields, '确认时间', pick('confirmedAt'), 'confirmedAt')
  return {
    instanceId: task?.firstSampleTaskId || relation.sourceObjectId,
    instanceCode: task?.firstSampleTaskCode || relation.sourceObjectCode,
    title: task?.title || relation.sourceTitle,
    status: task?.status || relation.sourceStatus,
    ownerName: task?.ownerName || relation.ownerName,
    businessDate: relation.businessDate,
    updatedAt: task?.updatedAt || relation.updatedAt,
    summaryText: buildSummaryFromFields(fields, relation.sourceTitle),
    targetRoute: task ? `/pcs/samples/first-sample/${encodeURIComponent(task.firstSampleTaskId)}` : '/pcs/samples/first-sample',
    fields,
  }
}

function resolveFirstOrderSampleRelationObject(relation: ProjectRelationRecord): ResolvedRelationObjectSnapshot {
  const task = getFirstOrderSampleTaskById(relation.sourceObjectId)
  const meta = parseRelationMeta(relation.note)
  const pick = (key: string): unknown => {
    if (task && key in task) return (task as unknown as Record<string, unknown>)[key]
    return meta[key]
  }
  const samplePlanLines = pick('samplePlanLines')
  const samplePlanSummary = Array.isArray(samplePlanLines)
    ? samplePlanLines
        .map((line) => {
          if (!line || typeof line !== 'object') return ''
          const record = line as Record<string, unknown>
          return [
            record.sampleRole,
            record.materialMode,
            record.quantity ? `${record.quantity}件` : '',
            record.linkedSampleCode,
            record.status,
          ]
            .map((item) => String(item || '').trim())
            .filter(Boolean)
            .join(' / ')
        })
        .filter(Boolean)
        .join('；')
    : samplePlanLines
  const fields: PcsProjectInstanceField[] = []
  addField(fields, '来源首版样衣任务', pick('sourceFirstSampleTaskCode') || pick('sourceFirstSampleTaskId'), 'sourceFirstSampleTaskCode')
  addField(fields, '来源首版结果编号', pick('sourceFirstSampleCode'), 'sourceFirstSampleCode')
  addField(fields, '来源技术包版本ID', pick('sourceTechPackVersionId'), 'sourceTechPackVersionId')
  addField(fields, '来源技术包版本标签', pick('sourceTechPackVersionLabel'), 'sourceTechPackVersionLabel')
  addField(fields, '工厂', pick('factoryName') || pick('factoryId'), 'factoryName')
  addField(fields, '打样区域', pick('targetSite'), 'targetSite')
  addField(fields, '首单确认方式', pick('sampleChainMode'), 'sampleChainMode')
  addField(fields, '特殊场景原因', pick('specialSceneReasonText') || pick('specialSceneReasonCodes'), 'specialSceneReasonCodes')
  addField(fields, '是否需要生产参照', pick('productionReferenceRequiredFlag'), 'productionReferenceRequiredFlag')
  addField(fields, '是否需要中国确认', pick('chinaReviewRequiredFlag'), 'chinaReviewRequiredFlag')
  addField(fields, '是否需要正确布确认', pick('correctFabricRequiredFlag'), 'correctFabricRequiredFlag')
  addField(fields, '样衣计划行', samplePlanSummary, 'samplePlanLines')
  addField(fields, '最终参照说明', pick('finalReferenceNote'), 'finalReferenceNote')
  addField(fields, '纸样版本', pick('patternVersion'), 'patternVersion')
  addField(fields, '花型版本', pick('artworkVersion'), 'artworkVersion')
  addField(fields, '结果编号', pick('sampleCode'), 'sampleCode')
  addField(fields, '首单确认结果', pick('conclusionResult'), 'conclusionResult')
  addField(fields, '首单确认说明', pick('conclusionNote'), 'conclusionNote')
  addField(fields, '首单确认时间', pick('confirmedAt'), 'confirmedAt')
  addField(fields, '首单确认人', pick('confirmedBy'), 'confirmedBy')
  addField(fields, '任务来源类型', pick('sourceType'), 'sourceType')
  addField(fields, '上游模块', pick('upstreamModule'), 'upstreamModule')
  addField(fields, '上游对象类型', pick('upstreamObjectType'), 'upstreamObjectType')
  addField(fields, '上游对象ID', pick('upstreamObjectId'), 'upstreamObjectId')
  addField(fields, '上游对象编码', pick('upstreamObjectCode'), 'upstreamObjectCode')
  addField(fields, '任务状态', pick('status') || relation.sourceStatus, 'taskStatus')
  return {
    instanceId: task?.firstOrderSampleTaskId || relation.sourceObjectId,
    instanceCode: task?.firstOrderSampleTaskCode || relation.sourceObjectCode,
    title: task?.title || relation.sourceTitle,
    status: task?.status || relation.sourceStatus,
    ownerName: task?.ownerName || relation.ownerName,
    businessDate: relation.businessDate,
    updatedAt: task?.updatedAt || relation.updatedAt,
    summaryText: buildSummaryFromFields(fields, relation.sourceTitle),
    targetRoute: task
      ? `/pcs/samples/first-order/${encodeURIComponent(task.firstOrderSampleTaskId)}`
      : '/pcs/samples/first-order',
    fields,
  }
}

function resolveLiveRelationObject(relation: ProjectRelationRecord): ResolvedRelationObjectSnapshot {
  const line = getLiveProductLineById(relation.sourceLineId || relation.sourceObjectId)
  const sessionId = line?.liveSessionId || relation.sourceObjectId
  const sessionRecord = sessionId ? getLiveSessionRecordById(sessionId) : null
  const session = sessionId ? getLiveSessionById(sessionId) : null
  const itemId = line?.liveLineId.includes('__') ? line.liveLineId.split('__')[1] || '' : ''
  const liveItem =
    session?.id && itemId
      ? getLiveSessionItems(session.id).find((item) => item.id === itemId) || null
      : null
  const cartValue = liveItem?.cart ?? Math.max(line?.orderQty ?? 0, Math.round((line?.clickQty ?? 0) * 0.18))
  const clickRateValue =
    (line?.exposureQty ?? 0) > 0 ? `${(((line?.clickQty ?? 0) / (line?.exposureQty ?? 1)) * 100).toFixed(1)}%` : ''
  const fields: PcsProjectInstanceField[] = []
  addField(fields, '商品项目编号', line?.legacyProjectRef || liveItem?.projectRef || relation.projectCode, 'projectRef')
  addField(fields, '测款标题', session?.title || sessionRecord?.sessionTitle, 'title')
  addField(fields, '直播账号', session?.liveAccount || sessionRecord?.channelName, 'liveAccount')
  addField(fields, '主播', session?.anchor || sessionRecord?.hostName, 'anchor')
  addField(fields, '开播时间', session?.startAt || sessionRecord?.startedAt, 'startAt')
  addField(fields, '下播时间', session?.endAt || sessionRecord?.endedAt, 'endAt')
  addField(fields, '曝光', line?.exposureQty, 'exposure')
  addField(fields, '点击', line?.clickQty, 'click')
  addField(fields, '点击率', clickRateValue, 'clickRate')
  addField(fields, '加购', cartValue, 'cart')
  addField(fields, '订单', line?.orderQty, 'order')
  addField(fields, 'GMV', line?.gmvAmount, 'gmv')
  addField(
    fields,
    '备注',
    session?.note || relation.note || `${line?.productTitle || relation.sourceTitle}直播测款已完成。`,
    'note',
  )
  addField(fields, '直播测款', line?.liveSessionCode || relation.sourceObjectCode, 'liveSessionCode')
  addField(fields, '曝光量', line?.exposureQty, 'exposureQty')
  addField(fields, '点击量', line?.clickQty, 'clickQty')
  addField(fields, '下单量', line?.orderQty, 'orderQty')
  addField(fields, 'GMV', line?.gmvAmount, 'gmvAmount')
  return {
    instanceId: line?.liveLineId || relation.sourceLineId || relation.sourceObjectId,
    instanceCode: line?.liveLineCode || relation.sourceLineCode || relation.sourceObjectCode,
    title: line?.productTitle || relation.sourceTitle,
    status: line?.sessionStatus || relation.sourceStatus,
    ownerName: line?.ownerName || relation.ownerName,
    businessDate: line?.businessDate || relation.businessDate,
    updatedAt: relation.updatedAt,
    summaryText: buildSummaryFromFields(fields, relation.sourceTitle),
    targetRoute: line ? `/pcs/testing/live/${encodeURIComponent(line.liveSessionId)}` : '/pcs/testing/live',
    fields,
  }
}

function resolveVideoRelationObject(relation: ProjectRelationRecord): ResolvedRelationObjectSnapshot {
  const record = getVideoTestRecordById(relation.sourceObjectId)
  const baseRecord = getVideoRecordById(record?.videoRecordId || relation.sourceObjectId)
  const [channelPlatform, channelAccount] = (record?.channelName || '').split('/').map((item) => item.trim())
  const primaryItem =
    baseRecord?.id
      ? getVideoItems(baseRecord.id).find((item) => item.projectRef === relation.projectCode) ||
        getVideoItems(baseRecord.id)[0] ||
        null
      : null
  const clicksValue = primaryItem?.click ?? record?.clickQty ?? 0
  const viewsValue = primaryItem?.exposure ?? record?.exposureQty ?? baseRecord?.views ?? 0
  const likesValue = baseRecord?.likes ?? Math.max(clicksValue, Math.round(viewsValue * 0.06))
  const ordersValue = primaryItem?.order ?? record?.orderQty ?? 0
  const gmvValue = primaryItem?.gmv ?? record?.gmvAmount ?? baseRecord?.gmv ?? 0
  const clickRateValue = viewsValue > 0 ? `${((clicksValue / viewsValue) * 100).toFixed(1)}%` : ''
  const fields: PcsProjectInstanceField[] = []
  addField(fields, '商品项目编号', primaryItem?.projectRef || record?.legacyProjectRef || relation.projectCode, 'projectRef')
  addField(fields, '测款标题', baseRecord?.title || record?.videoTitle, 'title')
  addField(fields, '平台', baseRecord?.platform || channelPlatform || record?.channelName, 'platform')
  addField(fields, '发布账号', baseRecord?.account || channelAccount || record?.ownerName, 'account')
  addField(fields, '达人 / 运营', baseRecord?.creator || record?.ownerName, 'creator')
  addField(fields, '发布时间', baseRecord?.publishedAt || record?.publishedAt, 'publishedAt')
  addField(
    fields,
    '视频链接',
    baseRecord?.videoUrl || (record ? `https://example.com/videos/${record.videoRecordCode}` : ''),
    'videoUrl',
  )
  addField(fields, '播放', viewsValue, 'views')
  addField(fields, '点击', clicksValue, 'clicks')
  addField(fields, '点击率', clickRateValue, 'clickRate')
  addField(fields, '点赞', likesValue, 'likes')
  addField(fields, '订单', ordersValue, 'orders')
  addField(fields, 'GMV', gmvValue, 'gmv')
  addField(
    fields,
    '备注',
    baseRecord?.note || relation.note || `${record?.videoTitle || relation.sourceTitle}短视频测款已完成。`,
    'note',
  )
  addField(fields, '发布渠道', record?.channelName, 'channelName')
  addField(fields, '曝光量', record?.exposureQty, 'exposureQty')
  addField(fields, '点击量', record?.clickQty, 'clickQty')
  addField(fields, '下单量', record?.orderQty, 'orderQty')
  addField(fields, 'GMV', record?.gmvAmount, 'gmvAmount')
  return {
    instanceId: record?.videoRecordId || relation.sourceObjectId,
    instanceCode: record?.videoRecordCode || relation.sourceObjectCode,
    title: record?.videoTitle || relation.sourceTitle,
    status: record?.recordStatus || relation.sourceStatus,
    ownerName: record?.ownerName || relation.ownerName,
    businessDate: record?.businessDate || relation.businessDate,
    updatedAt: relation.updatedAt,
    summaryText: buildSummaryFromFields(fields, relation.sourceTitle),
    targetRoute: record ? `/pcs/testing/video/${encodeURIComponent(record.videoRecordId)}` : '/pcs/testing/video',
    fields,
  }
}

function resolveStyleArchiveRelationObject(relation: ProjectRelationRecord, meta: Record<string, unknown>): ResolvedRelationObjectSnapshot {
  const style = getStyleArchiveById(relation.sourceObjectId)
  const fields: PcsProjectInstanceField[] = []
  addField(fields, '款式名称', style?.styleName || meta.styleName, 'styleName')
  addField(fields, '商品类目', style ? `${style.categoryName} / ${style.subCategoryName}` : '', 'categoryPath')
  addField(fields, '品牌', style?.brandName, 'brandName')
  addField(fields, '当前技术包', style?.currentTechPackVersionCode, 'currentTechPackVersionCode')
  addField(fields, '档案状态', style?.archiveStatus || relation.sourceStatus, 'archiveStatus')
  return {
    instanceId: style?.styleId || relation.sourceObjectId,
    instanceCode: style?.styleCode || relation.sourceObjectCode,
    title: style?.styleName || relation.sourceTitle,
    status: style?.archiveStatus || relation.sourceStatus,
    ownerName: relation.ownerName,
    businessDate: relation.businessDate,
    updatedAt: style?.updatedAt || relation.updatedAt,
    summaryText: buildSummaryFromFields(fields, relation.sourceTitle),
    targetRoute: style ? `/pcs/products/styles/${encodeURIComponent(style.styleId)}` : '/pcs/products/styles',
    fields,
  }
}

function resolveTechnicalVersionRelationObject(
  relation: ProjectRelationRecord,
  meta: Record<string, unknown>,
): ResolvedRelationObjectSnapshot {
  const record = getTechnicalDataVersionById(relation.sourceObjectId)
  const fields: PcsProjectInstanceField[] = []
  addField(fields, '版本标签', record?.versionLabel || meta.technicalVersionLabel, 'versionLabel')
  addField(fields, '来源任务', record?.createdFromTaskCode, 'createdFromTaskCode')
  addField(fields, '完整度', record ? `${record.completenessScore}%` : '', 'completenessScore')
  addField(fields, '缺失项数量', record?.missingItemNames.length, 'missingItemCount')
  return {
    instanceId: record?.technicalVersionId || relation.sourceObjectId,
    instanceCode: record?.technicalVersionCode || relation.sourceObjectCode,
    title: record?.styleName || relation.sourceTitle,
    status: record?.versionStatus || relation.sourceStatus,
    ownerName: relation.ownerName,
    businessDate: relation.businessDate,
    updatedAt: record?.updatedAt || relation.updatedAt,
    summaryText: buildSummaryFromFields(fields, relation.sourceTitle),
    targetRoute: record
      ? `/pcs/products/styles/${encodeURIComponent(record.styleId)}/technical-data/${encodeURIComponent(record.technicalVersionId)}`
      : '/pcs/products/styles',
    fields,
  }
}

function resolveProjectArchiveRelationObject(relation: ProjectRelationRecord): ResolvedRelationObjectSnapshot {
  const archive = getProjectArchiveById(relation.sourceObjectId)
  const fields: PcsProjectInstanceField[] = []
  addField(fields, '归档单号', archive?.archiveNo, 'archiveNo')
  addField(fields, '文档数', archive?.documentCount, 'documentCount')
  addField(fields, '文件数', archive?.fileCount, 'fileCount')
  addField(fields, '缺失项数量', archive?.missingItemCount, 'missingItemCount')
  addField(fields, '归档状态', archive?.archiveStatus || relation.sourceStatus, 'archiveStatus')
  return {
    instanceId: archive?.projectArchiveId || relation.sourceObjectId,
    instanceCode: archive?.archiveNo || relation.sourceObjectCode,
    title: archive?.projectName || relation.sourceTitle,
    status: archive?.archiveStatus || relation.sourceStatus,
    ownerName: relation.ownerName,
    businessDate: relation.businessDate,
    updatedAt: archive?.updatedAt || relation.updatedAt,
    summaryText: buildSummaryFromFields(fields, relation.sourceTitle),
    targetRoute: archive?.styleId ? `/pcs/products/styles/${encodeURIComponent(archive.styleId)}` : '/pcs/products/styles',
    fields,
  }
}

function resolveRelationObjectSnapshot(relation: ProjectRelationRecord): ResolvedRelationObjectSnapshot {
  const meta = parseRelationMeta(relation.note)
  if (relation.sourceObjectType === '渠道店铺商品' || relation.sourceObjectType === '渠道商品') {
    return resolveChannelProductRelationObject(relation, meta)
  }
  if (relation.sourceObjectType === '改版任务') return resolveRevisionTaskRelationObject(relation)
  if (relation.sourceObjectType === '制版任务') return resolvePlateTaskRelationObject(relation)
  if (relation.sourceObjectType === '花型任务') return resolvePatternTaskRelationObject(relation)
  if (relation.sourceObjectType === '首版样衣打样任务') return resolveFirstSampleRelationObject(relation)
  if (relation.sourceObjectType === '首单样衣打样任务') return resolveFirstOrderSampleRelationObject(relation)
  if (relation.sourceObjectType === '直播商品明细') return resolveLiveRelationObject(relation)
  if (relation.sourceObjectType === '短视频记录') return resolveVideoRelationObject(relation)
  if (relation.sourceObjectType === '款式档案') return resolveStyleArchiveRelationObject(relation, meta)
  if (relation.sourceObjectType === '技术包版本') return resolveTechnicalVersionRelationObject(relation, meta)
  if (relation.sourceObjectType === '项目资料归档') return resolveProjectArchiveRelationObject(relation)

  const fields = buildFallbackRelationFields(relation, meta)
  return {
    instanceId: relation.sourceObjectId,
    instanceCode: relation.sourceLineCode || relation.sourceObjectCode,
    title: relation.sourceTitle,
    status: relation.sourceStatus,
    ownerName: relation.ownerName,
    businessDate: relation.businessDate,
    updatedAt: relation.updatedAt,
    summaryText: buildSummaryFromFields(fields, relation.sourceTitle),
    targetRoute: null,
    fields,
  }
}

function buildRelationObjectInstance(relation: ProjectRelationRecord): PcsProjectInstanceItem {
  const carrier = getPcsWorkItemRuntimeCarrierDefinition(relation.workItemTypeCode as PcsProjectWorkItemCode)
  const resolved = resolveRelationObjectSnapshot(relation)
  return {
    instanceKey: `relation-object:${relation.projectRelationId}`,
    projectId: relation.projectId,
    projectCode: relation.projectCode,
    projectNodeId: relation.projectNodeId,
    workItemTypeCode: relation.workItemTypeCode,
    workItemTypeName: relation.workItemTypeName,
    sourceKind: 'RELATION_OBJECT',
    sourceLayer: '正式业务对象',
    carrierMode: carrier.runtimeCarrierMode,
    carrierLabel: carrier.runtimeCarrierLabel,
    moduleName: relation.sourceModule,
    objectType: relation.sourceObjectType,
    relationRole: relation.relationRole,
    sourceObjectId: relation.sourceObjectId,
    sourceObjectCode: relation.sourceObjectCode,
    sourceLineId: relation.sourceLineId || '',
    sourceLineCode: relation.sourceLineCode || '',
    instanceId: resolved.instanceId,
    instanceCode: resolved.instanceCode,
    title: resolved.title,
    status: resolved.status,
    ownerName: resolved.ownerName,
    businessDate: resolved.businessDate,
    updatedAt: resolved.updatedAt,
    summaryText: resolved.summaryText,
    targetRoute: resolved.targetRoute,
    fields: resolved.fields,
  }
}

function createEmptyNodeInstanceModel(project: PcsProjectViewRecord, node: PcsProjectNodeRecord): PcsProjectNodeInstanceModel {
  const carrier = getPcsWorkItemRuntimeCarrierDefinition(node.workItemTypeCode as PcsProjectWorkItemCode)
  return {
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectNodeId: node.projectNodeId,
    workItemTypeCode: node.workItemTypeCode,
    workItemTypeName: node.workItemTypeName,
    carrierMode: carrier.runtimeCarrierMode,
    carrierLabel: carrier.runtimeCarrierLabel,
    moduleName: carrier.moduleName,
    projectRecordCount: 0,
    inlineRecordCount: 0,
    formalRecordCount: 0,
    relatedObjectCount: 0,
    totalCount: 0,
    latestInstance: null,
    instances: [],
  }
}

export function getProjectInstanceModel(projectId: string): PcsProjectInstanceModel | null {
  const project = getProjectById(projectId)
  if (!project) return null

  const nodes = listProjectNodes(projectId)
  const records = listProjectInlineNodeRecordsByProject(projectId)
  const relations = listProjectRelationsByProject(projectId)
  const instances: PcsProjectInstanceItem[] = []

  const initNode = nodes.find((node) => node.workItemTypeCode === 'PROJECT_INIT')
  if (initNode) {
    instances.push(buildProjectRecordInstance(project, initNode))
  }

  records.forEach((record) => {
    instances.push(buildInlineRecordInstance(record))
  })

  relations.forEach((relation) => {
    instances.push(buildRelationObjectInstance(relation))
  })

  instances.sort(compareInstances)

  const groupedByNode = new Map<string, PcsProjectInstanceItem[]>()
  nodes.forEach((node) => groupedByNode.set(node.projectNodeId, []))
  instances.forEach((item) => {
    if (!item.projectNodeId) return
    const bucket = groupedByNode.get(item.projectNodeId)
    if (bucket) bucket.push(item)
  })

  const nodeModels = nodes.map((node) => {
    const nodeInstances = [...(groupedByNode.get(node.projectNodeId) || [])].sort(compareInstances)
    const projectRecordCount = nodeInstances.filter((item) => item.sourceKind === 'PROJECT_RECORD').length
    const inlineRecordCount = nodeInstances.filter((item) => item.sourceKind === 'INLINE_RECORD').length
    const relatedObjectCount = nodeInstances.filter((item) => item.sourceKind === 'RELATION_OBJECT').length
    return {
      ...createEmptyNodeInstanceModel(project, node),
      projectRecordCount,
      inlineRecordCount,
      formalRecordCount: projectRecordCount + inlineRecordCount,
      relatedObjectCount,
      totalCount: nodeInstances.length,
      latestInstance: nodeInstances[0] || null,
      instances: nodeInstances,
    }
  })

  const moduleCountMap = new Map<string, number>()
  instances.forEach((item) => {
    moduleCountMap.set(item.moduleName, (moduleCountMap.get(item.moduleName) || 0) + 1)
  })

  const projectRecordCount = instances.filter((item) => item.sourceKind === 'PROJECT_RECORD').length
  const inlineRecordCount = instances.filter((item) => item.sourceKind === 'INLINE_RECORD').length
  const relatedObjectCount = instances.filter((item) => item.sourceKind === 'RELATION_OBJECT').length

  return {
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectRecordCount,
    inlineRecordCount,
    formalRecordCount: projectRecordCount + inlineRecordCount,
    relatedObjectCount,
    totalCount: instances.length,
    latestInstance: instances[0] || null,
    moduleCounts: Array.from(moduleCountMap.entries())
      .map(([moduleName, count]) => ({ moduleName, count }))
      .sort((left, right) => right.count - left.count || left.moduleName.localeCompare(right.moduleName)),
    nodes: nodeModels,
    instances,
  }
}

export function getProjectNodeInstanceModel(projectId: string, projectNodeId: string): PcsProjectNodeInstanceModel | null {
  const project = getProjectById(projectId)
  const node = listProjectNodes(projectId).find((item) => item.projectNodeId === projectNodeId)
  if (!project || !node) return null
  const model = getProjectInstanceModel(projectId)
  return model?.nodes.find((item) => item.projectNodeId === projectNodeId) || createEmptyNodeInstanceModel(project, node)
}

export function getProjectInstanceFieldValue(
  instance: PcsProjectInstanceItem | null | undefined,
  fieldKey: string,
): string {
  if (!instance) return ''
  return instance.fields.find((field) => field.fieldKey === fieldKey)?.value || ''
}

export function findLatestProjectInstance(
  projectId: string,
  matcher: (instance: PcsProjectInstanceItem) => boolean,
): PcsProjectInstanceItem | null {
  const model = getProjectInstanceModel(projectId)
  if (!model) return null
  return model.instances.find(matcher) || null
}

export function findLatestNodeInstance(
  projectId: string,
  projectNodeId: string,
  matcher: (instance: PcsProjectInstanceItem) => boolean,
): PcsProjectInstanceItem | null {
  const model = getProjectNodeInstanceModel(projectId, projectNodeId)
  if (!model) return null
  return model.instances.find(matcher) || null
}

export function getProjectNodeLatestInstanceRecord(projectId: string, projectNodeId: string): PcsProjectInlineNodeRecord | null {
  return getLatestProjectInlineNodeRecord(projectNodeId) || null
}

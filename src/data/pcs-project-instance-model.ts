import {
  getChannelNamesByCodes,
  getProjectById,
  listProjectNodes,
} from './pcs-project-repository.ts'
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
import { getPreProductionSampleTaskById } from './pcs-pre-production-sample-repository.ts'
import { getLiveProductLineById } from './pcs-live-testing-repository.ts'
import { getVideoTestRecordById } from './pcs-video-testing-repository.ts'
import { getStyleArchiveById } from './pcs-style-archive-repository.ts'
import { getTechnicalDataVersionById } from './pcs-technical-data-version-repository.ts'
import { getProjectArchiveById } from './pcs-project-archive-repository.ts'
import { getSampleAssetById } from './pcs-sample-asset-repository.ts'
import { getSampleLedgerEventById } from './pcs-sample-ledger-repository.ts'

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

  addField(fields, labelMap.get('projectName') || '项目名称', project.projectName)
  addField(fields, labelMap.get('projectType') || '项目类型', project.projectType)
  addField(fields, labelMap.get('projectSourceType') || '项目来源', project.projectSourceType)
  addField(fields, labelMap.get('categoryId') || '商品类目', project.categoryName)
  addField(fields, labelMap.get('subCategoryId') || '二级类目', project.subCategoryName)
  addField(fields, labelMap.get('brandId') || '品牌', project.brandName)
  addField(fields, labelMap.get('styleCodeId') || '风格编号', project.styleCodeName)
  addField(fields, labelMap.get('targetChannelCodes') || '目标渠道', getChannelNamesByCodes(project.targetChannelCodes))
  addField(fields, labelMap.get('ownerId') || '负责人', project.ownerName)
  addField(fields, labelMap.get('teamId') || '负责团队', project.teamName)

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
  getProjectWorkItemContract(record.workItemTypeCode as PcsProjectWorkItemCode).fieldDefinitions.forEach((field) => {
    const value = merged[field.fieldKey]
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
    targetRoute: `/pcs/projects/${encodeURIComponent(record.projectId)}/work-items/${encodeURIComponent(record.projectNodeId)}?tab=records`,
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
  const fields: PcsProjectInstanceField[] = []
  addField(fields, '渠道编码', record?.channelCode, 'channelCode')
  addField(fields, '渠道名称', record?.channelName, 'channelName')
  addField(fields, '店铺 ID', record?.storeId, 'storeId')
  addField(fields, '店铺名称', record?.storeName, 'storeName')
  addField(fields, '币种', record?.currency, 'currency')
  addField(fields, '商品标题', record?.listingTitle, 'listingTitle')
  addField(fields, '标价', record?.listingPrice, 'listingPrice')
  addField(fields, '作废原因', record?.invalidatedReason, 'invalidatedReason')
  addField(fields, '渠道 / 店铺', record ? `${record.channelName} / ${record.storeName}` : '', 'channelStoreDisplay')
  addField(fields, '渠道商品状态', record?.channelProductStatus || relation.sourceStatus, 'channelProductStatus')
  addField(fields, '上游更新状态', record?.upstreamSyncStatus, 'upstreamSyncStatus')
  addField(fields, '关联上游编码', record?.upstreamChannelProductCode || meta.upstreamChannelProductCode, 'upstreamChannelProductCode')
  addField(fields, '关联款式档案', record?.styleCode || meta.styleCode || meta.linkedStyleCode, 'linkedStyleCode')
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
  const fields: PcsProjectInstanceField[] = []
  addField(fields, '工厂', task?.factoryName, 'factoryName')
  addField(fields, '发往地', task?.targetSite, 'targetSite')
  addField(fields, '预计到样', task?.expectedArrival, 'expectedArrival')
  addField(fields, '样衣编号', task?.sampleCode, 'sampleCode')
  addField(fields, '物流单号', task?.trackingNo, 'trackingNo')
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

function resolvePreProductionSampleRelationObject(relation: ProjectRelationRecord): ResolvedRelationObjectSnapshot {
  const task = getPreProductionSampleTaskById(relation.sourceObjectId)
  const fields: PcsProjectInstanceField[] = []
  addField(fields, '工厂', task?.factoryName, 'factoryName')
  addField(fields, '版型版本', task?.patternVersion, 'patternVersion')
  addField(fields, '花型版本', task?.artworkVersion, 'artworkVersion')
  addField(fields, '样衣编号', task?.sampleCode, 'sampleCode')
  addField(fields, '物流单号', task?.trackingNo, 'trackingNo')
  return {
    instanceId: task?.preProductionSampleTaskId || relation.sourceObjectId,
    instanceCode: task?.preProductionSampleTaskCode || relation.sourceObjectCode,
    title: task?.title || relation.sourceTitle,
    status: task?.status || relation.sourceStatus,
    ownerName: task?.ownerName || relation.ownerName,
    businessDate: relation.businessDate,
    updatedAt: task?.updatedAt || relation.updatedAt,
    summaryText: buildSummaryFromFields(fields, relation.sourceTitle),
    targetRoute: task
      ? `/pcs/samples/pre-production/${encodeURIComponent(task.preProductionSampleTaskId)}`
      : '/pcs/samples/pre-production',
    fields,
  }
}

function resolveLiveRelationObject(relation: ProjectRelationRecord): ResolvedRelationObjectSnapshot {
  const line = getLiveProductLineById(relation.sourceLineId || relation.sourceObjectId)
  const fields: PcsProjectInstanceField[] = []
  addField(fields, '直播场次', line?.liveSessionCode || relation.sourceObjectCode, 'liveSessionCode')
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
  const fields: PcsProjectInstanceField[] = []
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

function resolveSampleAssetRelationObject(relation: ProjectRelationRecord): ResolvedRelationObjectSnapshot {
  const asset = getSampleAssetById(relation.sourceObjectId)
  const fields: PcsProjectInstanceField[] = []
  addField(fields, '样衣编号', asset?.sampleCode, 'sampleCode')
  addField(fields, '库存状态', asset?.inventoryStatus, 'inventoryStatus')
  addField(fields, '保管位置', asset?.locationDisplay, 'locationDisplay')
  addField(fields, '最近事件', asset?.lastEventType, 'lastEventType')
  return {
    instanceId: asset?.sampleAssetId || relation.sourceObjectId,
    instanceCode: asset?.sampleCode || relation.sourceObjectCode,
    title: asset?.sampleName || relation.sourceTitle,
    status: asset?.inventoryStatus || relation.sourceStatus,
    ownerName: asset?.custodianName || relation.ownerName,
    businessDate: relation.businessDate,
    updatedAt: asset?.updatedAt || relation.updatedAt,
    summaryText: buildSummaryFromFields(fields, relation.sourceTitle),
    targetRoute: '/pcs/samples/inventory',
    fields,
  }
}

function resolveSampleLedgerRelationObject(relation: ProjectRelationRecord): ResolvedRelationObjectSnapshot {
  const event = getSampleLedgerEventById(relation.sourceObjectId)
  const fields: PcsProjectInstanceField[] = []
  addField(fields, '事件类型', event?.eventName, 'eventName')
  addField(fields, '样衣编号', event?.sampleCode, 'sampleCode')
  addField(fields, '经办人', event?.operatorName, 'operatorName')
  addField(fields, '状态变化', event ? `${event.inventoryStatusBefore} -> ${event.inventoryStatusAfter}` : '', 'inventoryStatusDiff')
  return {
    instanceId: event?.ledgerEventId || relation.sourceObjectId,
    instanceCode: event?.ledgerEventCode || relation.sourceObjectCode,
    title: event?.sampleName || relation.sourceTitle,
    status: event?.eventName || relation.sourceStatus,
    ownerName: event?.operatorName || relation.ownerName,
    businessDate: event?.businessDate || relation.businessDate,
    updatedAt: event?.createdAt || relation.updatedAt,
    summaryText: buildSummaryFromFields(fields, relation.sourceTitle),
    targetRoute: '/pcs/samples/ledger',
    fields,
  }
}

function resolveRelationObjectSnapshot(relation: ProjectRelationRecord): ResolvedRelationObjectSnapshot {
  const meta = parseRelationMeta(relation.note)
  if (relation.sourceObjectType === '渠道商品') return resolveChannelProductRelationObject(relation, meta)
  if (relation.sourceObjectType === '改版任务') return resolveRevisionTaskRelationObject(relation)
  if (relation.sourceObjectType === '制版任务') return resolvePlateTaskRelationObject(relation)
  if (relation.sourceObjectType === '花型任务') return resolvePatternTaskRelationObject(relation)
  if (relation.sourceObjectType === '首版样衣打样任务') return resolveFirstSampleRelationObject(relation)
  if (relation.sourceObjectType === '产前版样衣任务') return resolvePreProductionSampleRelationObject(relation)
  if (relation.sourceObjectType === '直播商品明细') return resolveLiveRelationObject(relation)
  if (relation.sourceObjectType === '短视频记录') return resolveVideoRelationObject(relation)
  if (relation.sourceObjectType === '款式档案') return resolveStyleArchiveRelationObject(relation, meta)
  if (relation.sourceObjectType === '技术包版本') return resolveTechnicalVersionRelationObject(relation, meta)
  if (relation.sourceObjectType === '项目资料归档') return resolveProjectArchiveRelationObject(relation)
  if (relation.sourceObjectType === '样衣资产') return resolveSampleAssetRelationObject(relation)
  if (relation.sourceObjectType === '样衣台账事件') return resolveSampleLedgerRelationObject(relation)

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

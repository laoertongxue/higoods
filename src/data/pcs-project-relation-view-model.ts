import { getStandardProjectWorkItemIdentityByCode } from './pcs-work-item-configs/mappings.ts'
import { getLiveProductLineById } from './pcs-live-testing-repository.ts'
import { getProjectStoreSnapshot } from './pcs-project-repository.ts'
import { getFirstSampleTaskById } from './pcs-first-sample-repository.ts'
import { getPatternTaskById } from './pcs-pattern-task-repository.ts'
import { getPlateMakingTaskById } from './pcs-plate-making-repository.ts'
import { getPreProductionSampleTaskById } from './pcs-pre-production-sample-repository.ts'
import { getRevisionTaskById } from './pcs-revision-task-repository.ts'
import { getSampleAssetById } from './pcs-sample-asset-repository.ts'
import { getSampleLedgerEventById } from './pcs-sample-ledger-repository.ts'
import { ensureSampleBootstrapInitialized } from './pcs-sample-project-writeback.ts'
import { getProjectArchiveById } from './pcs-project-archive-repository.ts'
import { getProjectArchiveStatusLabel } from './pcs-project-archive-view-model.ts'
import { getStyleArchiveById } from './pcs-style-archive-repository.ts'
import { getStyleArchiveStatusLabel } from './pcs-style-archive-view-model.ts'
import { getTechnicalDataVersionById } from './pcs-technical-data-version-repository.ts'
import { getTechnicalVersionStatusLabel } from './pcs-technical-data-version-view-model.ts'
import {
  findProjectChannelProductByLiveLine,
  findProjectChannelProductByVideoRecord,
  getProjectChannelProductById,
  listProjectChannelProductsByProjectId,
} from './pcs-channel-product-project-repository.ts'
import { getVideoTestRecordById } from './pcs-video-testing-repository.ts'
import {
  listProjectRelationPendingItems,
  listProjectRelationsByProject,
  listProjectRelationsByProjectNode,
} from './pcs-project-relation-repository.ts'
import type { ProjectRelationRecord } from './pcs-project-relation-types.ts'

export interface ProjectRelationItemViewModel {
  projectRelationId: string
  sourceModule: string
  sourceObjectType: string
  sourceObjectId: string
  sourceObjectCode: string
  sourceLineId: string | null
  sourceLineCode: string | null
  sourceTitle: string
  sourceStatus: string
  businessDate: string
  relationRole: string
  workItemTypeCode: string
  workItemTypeName: string
  projectNodeId: string | null
  ownerName: string
  note: string
  taskRelationDetail: null | {
    taskCode: string
    taskTitle: string
    taskStatus: string
    createdAt: string
    upstreamModule: string
    upstreamObjectCode: string
  }
  liveTestingDetail: null | {
    liveSessionCode: string
    liveLineCode: string
    productTitle: string
    channelProductCode: string
    upstreamChannelProductCode: string
    colorCode: string
    sizeCode: string
    exposureQty: number
    clickQty: number
    orderQty: number
    gmvAmount: number
    businessDate: string
  }
  videoTestingDetail: null | {
    videoRecordCode: string
    videoTitle: string
    publishedAt: string
    channelName: string
    channelProductCode: string
    upstreamChannelProductCode: string
    exposureQty: number
    clickQty: number
    orderQty: number
    gmvAmount: number
    businessDate: string
  }
  channelProductDetail: null | {
    channelProductCode: string
    upstreamChannelProductCode: string
    listingTitle: string
    channelProductStatus: string
    upstreamSyncStatus: string
    styleCode: string
    invalidatedReason: string
    effectiveAt: string
    linkedRevisionTaskCode: string
    upstreamSyncTime: string
  }
  upstreamSyncDetail: null | {
    channelProductCode: string
    upstreamChannelProductCode: string
    upstreamSyncStatus: string
    upstreamSyncTime: string
    upstreamSyncLog: string
    styleCode: string
  }
  sampleLedgerDetail: null | {
    ledgerEventCode: string
    eventName: string
    sampleCode: string
    sampleName: string
    sourceDocType: string
    sourceDocCode: string
    inventoryStatusAfter: string
    businessDate: string
  }
  sampleAssetDetail: null | {
    sampleCode: string
    sampleName: string
    inventoryStatus: string
    availabilityStatus: string
    locationDisplay: string
    lastEventType: string
    lastEventTime: string
  }
  styleArchiveDetail: null | {
    styleCode: string
    styleName: string
    archiveStatus: string
    generatedAt: string
    specificationStatus: string
    techPackStatus: string
    costPricingStatus: string
  }
  technicalVersionDetail: null | {
    technicalVersionCode: string
    versionLabel: string
    versionStatus: string
    completenessScore: number
    missingItemNames: string[]
    isCurrentTechPackVersion: boolean
    styleName: string
    createdAt: string
    publishedAt: string
  }
  projectArchiveDetail: null | {
    archiveNo: string
    archiveStatus: string
    documentCount: number
    fileCount: number
    missingItemCount: number
    readyForFinalize: boolean
    updatedAt: string
    finalizedAt: string
  }
}

export interface ProjectRelationModuleGroupViewModel {
  sourceModule: string
  items: ProjectRelationItemViewModel[]
}

export interface ProjectDetailRelationSectionViewModel {
  groups: ProjectRelationModuleGroupViewModel[]
  totalCount: number
  unboundRelationCount: number
  pendingCount: number
}

export interface ProjectNodeRelationSectionViewModel {
  items: ProjectRelationItemViewModel[]
  totalCount: number
}

function filterLiveTestingItems(items: ProjectRelationItemViewModel[]): ProjectRelationItemViewModel[] {
  return items.filter((item) => item.sourceObjectType === '直播商品明细')
}

function filterVideoTestingItems(items: ProjectRelationItemViewModel[]): ProjectRelationItemViewModel[] {
  return items.filter((item) => item.sourceObjectType === '短视频记录')
}

function buildNodeNameMap(projectId: string): Map<string, string> {
  const snapshot = getProjectStoreSnapshot()
  return new Map(
    snapshot.nodes
      .filter((node) => node.projectId === projectId)
      .map((node) => [node.projectNodeId, node.workItemTypeName]),
  )
}

function resolveWorkItemName(record: ProjectRelationRecord, nodeNameMap: Map<string, string>): string {
  if (record.projectNodeId && nodeNameMap.has(record.projectNodeId)) {
    return nodeNameMap.get(record.projectNodeId) ?? ''
  }
  if (record.workItemTypeName) return record.workItemTypeName
  return getStandardProjectWorkItemIdentityByCode(record.workItemTypeCode)?.workItemTypeName ?? ''
}

function getRelationStatusText(record: ProjectRelationRecord): string {
  if (record.sourceObjectType !== '技术包版本') return record.sourceStatus
  if (record.sourceStatus === '已发布' || record.sourceStatus === '已归档' || record.sourceStatus === '草稿中') {
    return record.sourceStatus
  }
  if (record.sourceStatus === 'PUBLISHED' || record.sourceStatus === 'ARCHIVED' || record.sourceStatus === 'DRAFT') {
    return getTechnicalVersionStatusLabel(record.sourceStatus)
  }
  return record.sourceStatus
}

function buildRelationItemViewModel(
  record: ProjectRelationRecord,
  nodeNameMap: Map<string, string>,
): ProjectRelationItemViewModel {
  ensureSampleBootstrapInitialized()
  const liveLine = record.sourceObjectType === '直播商品明细' && record.sourceLineId
    ? getLiveProductLineById(record.sourceLineId)
    : null
  const liveChannelProduct = liveLine ? findProjectChannelProductByLiveLine(record.projectId, liveLine.liveLineId) : null
  const videoRecord = record.sourceObjectType === '短视频记录'
    ? getVideoTestRecordById(record.sourceObjectId)
    : null
  const videoChannelProduct = videoRecord ? findProjectChannelProductByVideoRecord(record.projectId, videoRecord.videoRecordId) : null
  const sampleLedgerEvent = record.sourceObjectType === '样衣台账事件'
    ? getSampleLedgerEventById(record.sourceObjectId)
    : null
  const sampleAsset = record.sourceObjectType === '样衣资产'
    ? getSampleAssetById(record.sourceObjectId)
    : null
  const styleArchive = record.sourceObjectType === '款式档案'
    ? getStyleArchiveById(record.sourceObjectId)
    : null
  const technicalVersion = record.sourceObjectType === '技术包版本'
    ? getTechnicalDataVersionById(record.sourceObjectId)
    : null
  const technicalVersionStyle = technicalVersion ? getStyleArchiveById(technicalVersion.styleId) : null
  const projectArchive = record.sourceObjectType === '项目资料归档'
    ? getProjectArchiveById(record.sourceObjectId)
    : null
  const channelProduct = record.sourceObjectType === '渠道商品'
    ? getProjectChannelProductById(record.sourceObjectId)
    : null
  const upstreamSyncRecord = record.sourceObjectType === '上游渠道商品同步'
    ? listProjectChannelProductsByProjectId(record.projectId).find((item) => item.upstreamChannelProductCode === record.sourceObjectCode) || null
    : null
  const taskRelationDetail = (() => {
    if (record.sourceObjectType === '改版任务') {
      const task = getRevisionTaskById(record.sourceObjectId)
      if (!task || task.projectId !== record.projectId) return null
      return {
        taskCode: task.revisionTaskCode,
        taskTitle: task.title,
        taskStatus: task.status,
        createdAt: task.createdAt,
        upstreamModule: task.upstreamModule,
        upstreamObjectCode: task.upstreamObjectCode,
      }
    }
    if (record.sourceObjectType === '制版任务') {
      const task = getPlateMakingTaskById(record.sourceObjectId)
      if (!task || task.projectId !== record.projectId) return null
      return {
        taskCode: task.plateTaskCode,
        taskTitle: task.title,
        taskStatus: task.status,
        createdAt: task.createdAt,
        upstreamModule: task.upstreamModule,
        upstreamObjectCode: task.upstreamObjectCode,
      }
    }
    if (record.sourceObjectType === '花型任务') {
      const task = getPatternTaskById(record.sourceObjectId)
      if (!task || task.projectId !== record.projectId) return null
      return {
        taskCode: task.patternTaskCode,
        taskTitle: task.title,
        taskStatus: task.status,
        createdAt: task.createdAt,
        upstreamModule: task.upstreamModule,
        upstreamObjectCode: task.upstreamObjectCode,
      }
    }
    if (record.sourceObjectType === '首版样衣打样任务') {
      const task = getFirstSampleTaskById(record.sourceObjectId)
      if (!task || task.projectId !== record.projectId) return null
      return {
        taskCode: task.firstSampleTaskCode,
        taskTitle: task.title,
        taskStatus: task.status,
        createdAt: task.createdAt,
        upstreamModule: task.upstreamModule,
        upstreamObjectCode: task.upstreamObjectCode,
      }
    }
    if (record.sourceObjectType === '产前版样衣任务') {
      const task = getPreProductionSampleTaskById(record.sourceObjectId)
      if (!task || task.projectId !== record.projectId) return null
      return {
        taskCode: task.preProductionSampleTaskCode,
        taskTitle: task.title,
        taskStatus: task.status,
        createdAt: task.createdAt,
        upstreamModule: task.upstreamModule,
        upstreamObjectCode: task.upstreamObjectCode,
      }
    }
    return null
  })()
  return {
    projectRelationId: record.projectRelationId,
    sourceModule: record.sourceModule,
    sourceObjectType: record.sourceObjectType,
    sourceObjectId: record.sourceObjectId,
    sourceObjectCode: record.sourceObjectCode,
    sourceLineId: record.sourceLineId,
    sourceLineCode: record.sourceLineCode,
    sourceTitle: record.sourceTitle,
    sourceStatus: getRelationStatusText(record),
    businessDate: record.businessDate,
    relationRole: record.relationRole,
    workItemTypeCode: record.workItemTypeCode,
    workItemTypeName: resolveWorkItemName(record, nodeNameMap),
    projectNodeId: record.projectNodeId,
    ownerName: record.ownerName,
    note: record.note,
    taskRelationDetail,
    liveTestingDetail: liveLine
      ? {
          liveSessionCode: liveLine.liveSessionCode,
          liveLineCode: liveLine.liveLineCode,
          productTitle: liveLine.productTitle,
          channelProductCode: liveChannelProduct?.channelProductCode || '',
          upstreamChannelProductCode: liveChannelProduct?.upstreamChannelProductCode || '',
          colorCode: liveLine.colorCode,
          sizeCode: liveLine.sizeCode,
          exposureQty: liveLine.exposureQty,
          clickQty: liveLine.clickQty,
          orderQty: liveLine.orderQty,
          gmvAmount: liveLine.gmvAmount,
          businessDate: liveLine.businessDate,
        }
      : null,
    videoTestingDetail: videoRecord
      ? {
          videoRecordCode: videoRecord.videoRecordCode,
          videoTitle: videoRecord.videoTitle,
          publishedAt: videoRecord.publishedAt,
          channelName: videoRecord.channelName,
          channelProductCode: videoChannelProduct?.channelProductCode || '',
          upstreamChannelProductCode: videoChannelProduct?.upstreamChannelProductCode || '',
          exposureQty: videoRecord.exposureQty,
          clickQty: videoRecord.clickQty,
          orderQty: videoRecord.orderQty,
          gmvAmount: videoRecord.gmvAmount,
          businessDate: videoRecord.businessDate,
        }
      : null,
    channelProductDetail: channelProduct
      ? {
          channelProductCode: channelProduct.channelProductCode,
          upstreamChannelProductCode: channelProduct.upstreamChannelProductCode,
          listingTitle: channelProduct.listingTitle,
          channelProductStatus: channelProduct.channelProductStatus,
          upstreamSyncStatus: channelProduct.upstreamSyncStatus,
          styleCode: channelProduct.styleCode,
          invalidatedReason: channelProduct.invalidatedReason,
          effectiveAt: channelProduct.effectiveAt,
          linkedRevisionTaskCode: channelProduct.linkedRevisionTaskCode,
          upstreamSyncTime: channelProduct.lastUpstreamSyncAt,
        }
      : null,
    upstreamSyncDetail: upstreamSyncRecord
      ? {
          channelProductCode: upstreamSyncRecord.channelProductCode,
          upstreamChannelProductCode: upstreamSyncRecord.upstreamChannelProductCode,
          upstreamSyncStatus: upstreamSyncRecord.upstreamSyncStatus,
          upstreamSyncTime: upstreamSyncRecord.lastUpstreamSyncAt,
          upstreamSyncLog: upstreamSyncRecord.upstreamSyncLog,
          styleCode: upstreamSyncRecord.styleCode,
        }
      : null,
    sampleLedgerDetail: sampleLedgerEvent
      ? {
          ledgerEventCode: sampleLedgerEvent.ledgerEventCode,
          eventName: sampleLedgerEvent.eventName,
          sampleCode: sampleLedgerEvent.sampleCode,
          sampleName: sampleLedgerEvent.sampleName,
          sourceDocType: sampleLedgerEvent.sourceDocType,
          sourceDocCode: sampleLedgerEvent.sourceDocCode,
          inventoryStatusAfter: sampleLedgerEvent.inventoryStatusAfter,
          businessDate: sampleLedgerEvent.businessDate,
        }
      : null,
    sampleAssetDetail: sampleAsset
      ? {
          sampleCode: sampleAsset.sampleCode,
          sampleName: sampleAsset.sampleName,
          inventoryStatus: sampleAsset.inventoryStatus,
          availabilityStatus: sampleAsset.availabilityStatus,
          locationDisplay: sampleAsset.locationDisplay,
          lastEventType: sampleAsset.lastEventType,
          lastEventTime: sampleAsset.lastEventTime,
        }
      : null,
    styleArchiveDetail: styleArchive
      ? {
          styleCode: styleArchive.styleCode,
          styleName: styleArchive.styleName,
          archiveStatus: getStyleArchiveStatusLabel(styleArchive.archiveStatus),
          generatedAt: styleArchive.generatedAt,
          specificationStatus: styleArchive.specificationStatus,
          techPackStatus: styleArchive.techPackStatus,
          costPricingStatus: styleArchive.costPricingStatus,
        }
      : null,
    technicalVersionDetail: technicalVersion
      ? {
          technicalVersionCode: technicalVersion.technicalVersionCode,
          versionLabel: technicalVersion.versionLabel,
          versionStatus: getTechnicalVersionStatusLabel(technicalVersion.versionStatus),
          completenessScore: technicalVersion.completenessScore,
          missingItemNames: [...technicalVersion.missingItemNames],
          isCurrentTechPackVersion:
            technicalVersionStyle?.currentTechPackVersionId === technicalVersion.technicalVersionId,
          styleName: technicalVersion.styleName,
          createdAt: technicalVersion.createdAt,
          publishedAt: technicalVersion.publishedAt,
        }
      : null,
    projectArchiveDetail: projectArchive
      ? {
          archiveNo: projectArchive.archiveNo,
          archiveStatus: getProjectArchiveStatusLabel(projectArchive.archiveStatus),
          documentCount: projectArchive.documentCount,
          fileCount: projectArchive.fileCount,
          missingItemCount: projectArchive.missingItemCount,
          readyForFinalize: projectArchive.readyForFinalize,
          updatedAt: projectArchive.updatedAt,
          finalizedAt: projectArchive.finalizedAt,
        }
      : null,
  }
}

export function buildProjectDetailRelationSectionViewModel(projectId: string): ProjectDetailRelationSectionViewModel {
  ensureSampleBootstrapInitialized()
  const records = listProjectRelationsByProject(projectId)
  const nodeNameMap = buildNodeNameMap(projectId)
  const groupsMap = new Map<string, ProjectRelationItemViewModel[]>()

  records.forEach((record) => {
    const item = buildRelationItemViewModel(record, nodeNameMap)
    const list = groupsMap.get(item.sourceModule) ?? []
    list.push(item)
    groupsMap.set(item.sourceModule, list)
  })

  const groups = Array.from(groupsMap.entries())
    .map(([sourceModule, items]) => ({
      sourceModule,
      items: items.sort((a, b) => b.businessDate.localeCompare(a.businessDate)),
    }))
    .sort((a, b) => {
      const latestA = a.items[0]?.businessDate ?? ''
      const latestB = b.items[0]?.businessDate ?? ''
      return latestB.localeCompare(latestA)
    })

  return {
    groups,
    totalCount: records.length,
    unboundRelationCount: records.filter((record) => !record.projectNodeId).length,
    pendingCount: listProjectRelationPendingItems().length,
  }
}

export function buildProjectNodeRelationSectionViewModel(
  projectId: string,
  projectNodeId: string,
): ProjectNodeRelationSectionViewModel {
  ensureSampleBootstrapInitialized()
  const nodeNameMap = buildNodeNameMap(projectId)
  const items = listProjectRelationsByProjectNode(projectId, projectNodeId)
    .map((record) => buildRelationItemViewModel(record, nodeNameMap))
    .sort((a, b) => b.businessDate.localeCompare(a.businessDate))

  return {
    items,
    totalCount: items.length,
  }
}

export function listProjectLiveTestingRelationItems(projectId: string): ProjectRelationItemViewModel[] {
  return filterLiveTestingItems(
    buildProjectDetailRelationSectionViewModel(projectId).groups.flatMap((group) => group.items),
  )
}

export function listProjectVideoTestingRelationItems(projectId: string): ProjectRelationItemViewModel[] {
  return filterVideoTestingItems(
    buildProjectDetailRelationSectionViewModel(projectId).groups.flatMap((group) => group.items),
  )
}

export function listProjectNodeLiveTestingRelationItems(projectId: string, projectNodeId: string): ProjectRelationItemViewModel[] {
  return filterLiveTestingItems(buildProjectNodeRelationSectionViewModel(projectId, projectNodeId).items)
}

export function listProjectNodeVideoTestingRelationItems(projectId: string, projectNodeId: string): ProjectRelationItemViewModel[] {
  return filterVideoTestingItems(buildProjectNodeRelationSectionViewModel(projectId, projectNodeId).items)
}

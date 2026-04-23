import {
  findProjectByCode,
  getChannelNamesByCodes,
  getProjectById,
  getProjectNodeRecordByWorkItemTypeCode,
  listProjectNodes,
  listProjects,
  listProjectPhases,
  updateProjectNodeRecord,
  updateProjectPhaseRecord,
  updateProjectRecord,
} from './pcs-project-repository.ts'
import {
  listProjectRelationsByProject,
  upsertProjectRelation,
} from './pcs-project-relation-repository.ts'
import { getProjectPhaseNameByCode } from './pcs-project-phase-definitions.ts'
import { getStyleArchiveById, updateStyleArchive } from './pcs-style-archive-repository.ts'
import { getLiveProductLineById, getLiveSessionRecordById } from './pcs-live-testing-repository.ts'
import { getVideoTestRecordById } from './pcs-video-testing-repository.ts'
import {
  findPcsChannelStoreMasterRecord,
  getDefaultPcsStoreIdByChannel,
  resolvePcsStoreCurrency,
  resolvePcsStoreDisplayName,
} from './pcs-channel-store-master.ts'
import {
  getTechnicalDataVersionById,
  updateTechnicalDataVersionRecord,
} from './pcs-technical-data-version-repository.ts'
import {
  createProjectImageAssetRecords,
  getProjectImageAssetById,
  upsertProjectImageAssets,
} from './pcs-project-image-repository.ts'
import {
  getLatestProjectInlineNodeRecord,
  upsertProjectInlineNodeRecord,
} from './pcs-project-inline-node-record-repository.ts'
import {
  STYLE_ARCHIVE_STATUS_RULES,
  resolveStyleArchiveBusinessStatus,
} from './pcs-product-lifecycle-governance.ts'
import type { ProjectRelationRecord } from './pcs-project-relation-types.ts'
import type { PcsProjectChannelProductRecord } from './pcs-project-domain-contract.ts'
import { syncProjectNodeInstanceRuntime } from './pcs-project-node-instance-registry.ts'
import { completeDecisionNodeWithResult } from './pcs-project-decision-flow-service.ts'
import { markProjectNodeCompletedAndUnlockNext } from './pcs-project-flow-service.ts'
import type {
  ChannelListingSpecLineInput,
  ChannelListingSpecLineRecord,
} from './pcs-channel-listing-spec-types.ts'
import type {
  ChannelListingImageInput,
  ChannelListingImageRecord,
} from './pcs-channel-listing-image-types.ts'
import {
  cloneChannelListingImages,
  deriveListingImageIds,
  deriveListingMainImageId,
  normalizeChannelListingImages,
  validateChannelListingImagesForUpload,
} from './pcs-channel-listing-image-utils.ts'
import {
  buildChannelListingSellerSku,
  buildUploadedUpstreamSkuId,
  countUploadedChannelListingSpecLines,
  cloneChannelListingSpecLines,
  normalizeChannelListingSpecLines,
  validateChannelListingSpecLinesForCreate,
  validateChannelListingSpecLinesForUpload,
} from './pcs-channel-listing-spec-utils.ts'

export type ProjectChannelProductScenario =
  | 'MEASURING'
  | 'FAILED_ADJUST'
  | 'FAILED_PAUSED'
  | 'FAILED_ELIMINATED'
  | 'STYLE_PENDING_TECH'
  | 'STYLE_ACTIVE'
  | 'HISTORY_INVALIDATED'

export type ProjectTestingConclusion = '' | '通过' | '淘汰'
export type UpstreamSyncResult = '待执行' | '成功' | '失败'

export interface ProjectChannelProductRecord extends PcsProjectChannelProductRecord {
  scenario: ProjectChannelProductScenario
  conclusion: ProjectTestingConclusion
  testingStatusText: string
  listingInstanceCode: string
  linkedRevisionTaskId: string
  linkedRevisionTaskCode: string
  linkedLiveLineId: string
  linkedLiveLineCode: string
  linkedVideoRecordId: string
  linkedVideoRecordCode: string
  upstreamSyncNote: string
  upstreamSyncResult: UpstreamSyncResult
  upstreamSyncBy: string
  upstreamSyncLog: string
}

export interface ProjectChannelProductChainSummary {
  projectId: string
  projectCode: string
  projectName: string
  currentChannelProductId: string
  currentChannelProductCode: string
  currentChannelProductMainImageId: string
  currentChannelProductMainImageUrl: string
  currentUpstreamChannelProductCode: string
  currentChannelProductStatus: string
  currentUpstreamSyncStatus: string
  currentUpstreamSyncNote: string
  currentUpstreamSyncTime: string
  linkedStyleId: string
  linkedStyleCode: string
  linkedStyleName: string
  linkedStyleStatus: string
  linkedTechPackVersionId: string
  linkedTechPackVersionCode: string
  linkedTechPackVersionLabel: string
  linkedTechPackVersionStatus: string
  currentConclusion: ProjectTestingConclusion
  invalidatedReason: string
  linkedRevisionTaskCode: string
  canGenerateStyleArchive: boolean
  summaryText: string
  channelProducts: ProjectChannelProductRecord[]
}

function getTechPackSourceNodeBinding(projectId: string, createdFromTaskType: string) {
  if (createdFromTaskType === 'PLATE') {
    const node = getProjectNodeRecordByWorkItemTypeCode(projectId, 'PATTERN_TASK')
    return {
      projectNodeId: node?.projectNodeId || null,
      workItemTypeCode: 'PATTERN_TASK',
      workItemTypeName: node?.workItemTypeName || '制版任务',
    }
  }

  if (createdFromTaskType === 'ARTWORK') {
    const node = getProjectNodeRecordByWorkItemTypeCode(projectId, 'PATTERN_ARTWORK_TASK')
    return {
      projectNodeId: node?.projectNodeId || null,
      workItemTypeCode: 'PATTERN_ARTWORK_TASK',
      workItemTypeName: node?.workItemTypeName || '花型任务',
    }
  }

  const node = getProjectNodeRecordByWorkItemTypeCode(projectId, 'REVISION_TASK')
  return {
    projectNodeId: node?.projectNodeId || null,
    workItemTypeCode: 'REVISION_TASK',
    workItemTypeName: node?.workItemTypeName || '改版任务',
  }
}

export interface ProjectChannelProductListingPayload {
  targetChannelCode?: string
  targetStoreId?: string
  listingTitle?: string
  listingDescription?: string
  defaultPriceAmount?: number
  listingPrice?: number
  currencyCode?: string
  currency?: string
  listingMainImageId?: string
  listingImageIds?: string[]
  listingImages?: ChannelListingImageInput[]
  mainImageUrls?: string[]
  detailImageUrls?: string[]
  listingRemark?: string
  specLines?: ChannelListingSpecLineInput[]
}

interface ResolvedProjectChannelProductListingPayload {
  targetChannelCode: string
  targetStoreId: string
  listingTitle: string
  listingDescription: string
  defaultPriceAmount: number
  currencyCode: string
  listingMainImageId: string
  listingImageIds: string[]
  listingImages: ChannelListingImageInput[]
  mainImageUrls: string[]
  detailImageUrls: string[]
  listingRemark: string
  specLines: ChannelListingSpecLineInput[]
}

export interface ProjectTestingSummaryPayload {
  summaryText?: string
}

export interface ProjectTestingSummaryBreakdownItem {
  key: string
  label: string
  relationCount: number
  sourceCodes: string[]
  channelProductCodes: string[]
  exposureQty: number
  clickQty: number
  orderQty: number
  gmvAmount: number
}

export interface ProjectTestingSummaryAggregate {
  liveRelationIds: string[]
  liveRelationCodes: string[]
  videoRelationIds: string[]
  videoRelationCodes: string[]
  totalExposureQty: number
  totalClickQty: number
  totalOrderQty: number
  totalGmvAmount: number
  channelBreakdownLines: string[]
  storeBreakdownLines: string[]
  channelProductBreakdownLines: string[]
  testingSourceBreakdownLines: string[]
  currencyBreakdownLines: string[]
  channelBreakdowns: ProjectTestingSummaryBreakdownItem[]
  storeBreakdowns: ProjectTestingSummaryBreakdownItem[]
  channelProductBreakdowns: ProjectTestingSummaryBreakdownItem[]
  testingSourceBreakdowns: ProjectTestingSummaryBreakdownItem[]
  currencyBreakdowns: ProjectTestingSummaryBreakdownItem[]
}

export interface ProjectTestingConclusionPayload {
  conclusion: Exclude<ProjectTestingConclusion, ''>
  note: string
}

export interface ProjectChannelProductWriteResult {
  ok: boolean
  message: string
  record: ProjectChannelProductRecord | null
  relationCount?: number
  summaryText?: string
  revisionTaskId?: string
  revisionTaskCode?: string
}

interface ChannelProductStoreSnapshot {
  version: number
  records: ProjectChannelProductRecord[]
}

export interface ProjectChannelProductRelationBootstrapSnapshot {
  relations: ProjectRelationRecord[]
  records: ProjectChannelProductRecord[]
}

interface ChannelSeed {
  projectCode: string
  sequence: string
  scenario: ProjectChannelProductScenario
  channelCode: string
  storeId: string
  listingTitle: string
  listingPrice: number
  currency: string
  channelProductStatus: PcsProjectChannelProductRecord['channelProductStatus']
  upstreamSyncStatus: PcsProjectChannelProductRecord['upstreamSyncStatus']
  styleId?: string
  styleCode?: string
  styleName?: string
  conclusion?: ProjectTestingConclusion
  invalidatedReason?: string
  createdAt: string
  updatedAt: string
  effectiveAt?: string
  invalidatedAt?: string
  lastUpstreamSyncAt?: string
  linkedRevisionTaskId?: string
  linkedRevisionTaskCode?: string
  linkedLiveLineId?: string
  linkedLiveLineCode?: string
  linkedVideoRecordId?: string
  linkedVideoRecordCode?: string
  upstreamSyncNote?: string
  upstreamSyncResult?: UpstreamSyncResult
  upstreamSyncBy?: string
  upstreamSyncLog?: string
}

const STORAGE_KEY = 'higood-pcs-project-channel-product-store-v2'
const STORE_VERSION = 1
const DEMO_OPERATOR = '系统初始化'

let memorySnapshot: ChannelProductStoreSnapshot | null = null
let demoStateApplied = false

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function cloneRecord(record: ProjectChannelProductRecord): ProjectChannelProductRecord {
  return {
    ...record,
    listingImageIds: [...(record.listingImageIds || [])],
    listingImages: cloneChannelListingImages(record.listingImages || []),
    mainImageUrls: [...(record.mainImageUrls || [])],
    detailImageUrls: [...(record.detailImageUrls || [])],
    specLines: cloneChannelListingSpecLines(record.specLines || []),
  }
}

function cloneSnapshot(snapshot: ChannelProductStoreSnapshot): ChannelProductStoreSnapshot {
  return {
    version: snapshot.version,
    records: snapshot.records.map(cloneRecord),
  }
}

function getChannelMeta(channelCode: string, storeId = ''): {
  channelName: string
  storeName: string
} {
  if (channelCode === 'shopee') {
    return { channelName: '虾皮', storeName: resolvePcsStoreDisplayName(storeId, channelCode) }
  }
  if (channelCode === 'lazada') {
    return { channelName: '来赞达', storeName: resolvePcsStoreDisplayName(storeId, channelCode) }
  }
  if (channelCode === 'wechat-mini-program') {
    return { channelName: '微信小程序', storeName: resolvePcsStoreDisplayName(storeId, channelCode) }
  }
  return { channelName: '抖音商城', storeName: resolvePcsStoreDisplayName(storeId, channelCode) }
}

function getDefaultStoreId(channelCode: string): string {
  return getDefaultPcsStoreIdByChannel(channelCode) || 'store-tiktok-01'
}

function resolveListingPayload(
  projectId: string,
  payload: ProjectChannelProductListingPayload,
): ResolvedProjectChannelProductListingPayload {
  const project = getProjectById(projectId)
  const targetChannelCode = payload.targetChannelCode || project?.targetChannelCodes[0] || 'tiktok-shop'
  const targetStoreId = payload.targetStoreId || getDefaultStoreId(targetChannelCode)
  const channelMeta = getChannelMeta(targetChannelCode, targetStoreId)
  const defaultPriceAmount =
    typeof payload.defaultPriceAmount === 'number' && Number.isFinite(payload.defaultPriceAmount)
      ? payload.defaultPriceAmount
      : typeof payload.listingPrice === 'number' && Number.isFinite(payload.listingPrice)
        ? payload.listingPrice
      : typeof project?.sampleUnitPrice === 'number' && Number.isFinite(project.sampleUnitPrice)
        ? project.sampleUnitPrice
        : 199

  return {
    targetChannelCode,
    targetStoreId,
    listingTitle: payload.listingTitle?.trim() || `${project?.projectName || '商品项目'} 测款渠道店铺商品`,
    listingDescription: payload.listingDescription?.trim() || '',
    defaultPriceAmount,
    currencyCode:
      payload.currencyCode?.trim() ||
      payload.currency?.trim() ||
      resolvePcsStoreCurrency(targetStoreId, targetChannelCode),
    listingMainImageId: payload.listingMainImageId?.trim() || '',
    listingImageIds: [...(payload.listingImageIds || [])],
    listingImages: [...(payload.listingImages || [])],
    mainImageUrls: [...(payload.mainImageUrls || [])],
    detailImageUrls: [...(payload.detailImageUrls || [])],
    listingRemark: payload.listingRemark?.trim() || '',
    specLines: [...(payload.specLines || [])],
  }
}

function validateListingStoreChannel(targetChannelCode: string, targetStoreId: string): string | null {
  const store = findPcsChannelStoreMasterRecord(targetStoreId)
  if (!store) return null
  if (store.channelCode !== targetChannelCode) {
    return `当前店铺 ${store.storeName} 不属于渠道 ${targetChannelCode}，请重新选择正确的渠道店铺组合。`
  }
  return null
}

function buildTestingStatusText(seed: ChannelSeed): string {
  if (seed.scenario === 'MEASURING') return '已完成上架，正在测款'
  if (seed.scenario === 'FAILED_ADJUST') return '历史测款结论待重新确认，当前渠道店铺商品已作废'
  if (seed.scenario === 'FAILED_PAUSED') return '历史测款结论待重新确认，当前渠道店铺商品已作废'
  if (seed.scenario === 'FAILED_ELIMINATED') return '测款结论为淘汰，当前渠道店铺商品已作废'
  if (seed.scenario === 'STYLE_PENDING_TECH') return '测款通过，已生成款式档案，待启用技术包'
  if (seed.scenario === 'STYLE_ACTIVE') return '测款通过，已关联款式档案并完成上游最终更新'
  return '历史测款渠道店铺商品，已失效'
}

function buildChannelProductId(projectCode: string, sequence: string): string {
  return `channel_product_${projectCode.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_${sequence}`
}

function buildChannelProductCode(projectCode: string, sequence: string): string {
  return `CP-${projectCode.slice(-7).replace(/-/g, '')}-${sequence}`
}

function buildUpstreamCode(projectCode: string, sequence: string): string {
  return `UP-${projectCode.slice(-7).replace(/-/g, '')}-${sequence}`
}

function buildLegacySpecSnapshot(
  record: Pick<
    ProjectChannelProductRecord,
    | 'channelProductId'
    | 'channelProductCode'
    | 'projectCode'
    | 'listingPrice'
    | 'defaultPriceAmount'
    | 'currency'
    | 'currencyCode'
    | 'skuCode'
    | 'skuName'
    | 'upstreamProductId'
    | 'upstreamChannelProductCode'
  >,
): ChannelListingSpecLineRecord[] {
  if (!record.skuCode && !record.skuName && !record.listingPrice && !record.defaultPriceAmount) {
    return []
  }

  const listingBatchCode = record.channelProductCode || record.channelProductId
  const upstreamProductId = record.upstreamProductId || record.upstreamChannelProductCode || ''
  const priceAmount = record.defaultPriceAmount || record.listingPrice || 0
  const currencyCode = record.currencyCode || record.currency || ''
  const sellerSku =
    record.skuCode ||
    buildChannelListingSellerSku({
      projectCode: record.projectCode,
      colorName: '',
      sizeName: '',
      index: 0,
    })

  return [
    {
      specLineId: `${record.channelProductId}__spec_01`,
      specLineCode: `${listingBatchCode}-SPEC-01`,
      listingBatchId: record.channelProductId,
      colorName: '',
      sizeName: '',
      printName: '',
      sellerSku,
      priceAmount,
      currencyCode,
      stockQty: 0,
      lineStatus: upstreamProductId ? '已上传' : '待上传',
      upstreamSkuId: '',
      uploadResultText: upstreamProductId ? '旧记录已回填上游款式商品编号，规格编号待补齐。' : '',
    },
  ]
}

function buildListingImageSourceText(listingImages: ChannelListingImageRecord[]): string {
  const sourceTypes = Array.from(new Set(listingImages.map((item) => item.sourceType)))
  return sourceTypes.join('、')
}

function deriveLegacyListingImageUrls(record: Pick<ProjectChannelProductRecord, 'mainImageUrls' | 'detailImageUrls'>): string[] {
  return [...new Set([...(record.mainImageUrls || []), ...(record.detailImageUrls || [])].map((item) => item.trim()).filter(Boolean))]
}

function ensureLegacyListingImageAssets(record: ProjectChannelProductRecord): ChannelListingImageRecord[] {
  const legacyUrls = deriveLegacyListingImageUrls(record)
  if (legacyUrls.length === 0) return []
  const legacyAssets = createProjectImageAssetRecords(
    {
      projectId: record.projectId,
      projectCode: record.projectCode,
      projectName: record.projectName,
    },
    legacyUrls.map((imageUrl, index) => ({
      imageId: `${record.channelProductId}-listing-image-${String(index + 1).padStart(2, '0')}`,
      imageUrl,
      imageName: `上架图片 ${index + 1}`,
      imageType: '上架图',
      sourceNodeCode: 'CHANNEL_PRODUCT_LISTING',
      sourceRecordId: record.channelProductId,
      sourceType: '商品上架',
      usageScopes: ['商品上架', '项目资料归档'],
      imageStatus: '可用于上架',
      mainFlag: index === 0,
      sortNo: index + 1,
    })),
    '系统迁移',
    record.updatedAt || record.createdAt || nowText(),
  )
  upsertProjectImageAssets(legacyAssets)
  return normalizeChannelListingImages({
    listingBatchId: record.channelProductId,
    imageInputs: legacyAssets.map((asset, index) => ({
      imageId: asset.imageId,
      sortNo: index + 1,
      mainFlag: index === 0,
    })),
    mainImageId: legacyAssets[0]?.imageId || '',
    imageAssets: legacyAssets,
  })
}

function buildListingImagesFromPayload(input: {
  listingBatchId: string
  listingImageIds: string[]
  listingImages: ChannelListingImageInput[]
  listingMainImageId: string
}): ChannelListingImageRecord[] {
  const imageInputs =
    input.listingImages.length > 0
      ? input.listingImages
      : input.listingImageIds.map((imageId, index) => ({
          imageId,
          sortNo: index + 1,
          mainFlag: imageId === input.listingMainImageId,
        }))
  const imageAssets = imageInputs
    .map((item) => getProjectImageAssetById(item.imageId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  const mainImageId = input.listingMainImageId || imageInputs[0]?.imageId || ''
  return normalizeChannelListingImages({
    listingBatchId: input.listingBatchId,
    imageInputs,
    mainImageId,
    imageAssets,
  })
}

function resolveListingImageAssetSnapshot(imageId: string): { imageUrl: string; imageName: string } | null {
  const asset = getProjectImageAssetById(imageId)
  if (!asset) return null
  return {
    imageUrl: asset.imageUrl,
    imageName: asset.imageName,
  }
}

function getDefaultSpecProductImageId(input: {
  listingMainImageId: string
  listingImageIds: string[]
  mainImageUrls: string[]
  detailImageUrls: string[]
}): string {
  if (input.listingMainImageId) return input.listingMainImageId
  if (input.listingImageIds[0]) return input.listingImageIds[0]
  if (input.mainImageUrls[0] || input.detailImageUrls[0]) return ''
  return ''
}

function hasListingSpecProductImages(specLines: ChannelListingSpecLineRecord[]): boolean {
  return specLines.every((item) => Boolean(item.productImageId))
}

function isNodeCompletableChannelProduct(record: ProjectChannelProductRecord): boolean {
  if (record.channelProductStatus === '已作废') return false
  return (
    record.listingBatchStatus === '已上传待确认' ||
    record.listingBatchStatus === '已完成' ||
    record.channelProductStatus === '已上架待测款' ||
    record.channelProductStatus === '已生效'
  )
}

function normalizeChannelProductRecord(record: ProjectChannelProductRecord): ProjectChannelProductRecord {
  const linkedStyle = record.styleId ? getStyleArchiveById(record.styleId) : null
  const listingBatchCode = record.listingBatchCode || record.channelProductCode
  const defaultSpecProductImageId = getDefaultSpecProductImageId({
    listingMainImageId: record.listingMainImageId || '',
    listingImageIds: record.listingImageIds || [],
    mainImageUrls: record.mainImageUrls || [],
    detailImageUrls: record.detailImageUrls || [],
  })
  const specLines = normalizeChannelListingSpecLines({
    listingBatchId: record.channelProductId,
    listingBatchCode,
    projectCode: record.projectCode,
    defaultPriceAmount: record.defaultPriceAmount || record.listingPrice || 0,
    currencyCode: record.currencyCode || record.currency || '',
    specLines: record.specLines?.length
      ? record.specLines.map((line) => ({
          specLineId: line.specLineId,
          specLineCode: line.specLineCode,
          productImageId: line.productImageId || defaultSpecProductImageId,
          productImageUrl: line.productImageUrl,
          productImageName: line.productImageName,
          colorName: line.colorName,
          sizeName: line.sizeName,
          printName: line.printName,
          sellerSku: line.sellerSku,
          priceAmount: line.priceAmount,
          currencyCode: line.currencyCode,
          stockQty: line.stockQty,
          lineStatus: line.lineStatus,
          upstreamSkuId: line.upstreamSkuId,
          uploadResultText: line.uploadResultText,
        }))
      : buildLegacySpecSnapshot(record).map((line) => ({
          ...line,
          productImageId: defaultSpecProductImageId,
        })),
    resolveProductImage: resolveListingImageAssetSnapshot,
  }).map((line) => {
    const legacyUploaded = Boolean(record.upstreamProductId || record.upstreamChannelProductCode)
    if (line.upstreamSkuId || !legacyUploaded) return line
    return {
      ...line,
      lineStatus: '已上传',
      uploadResultText: line.uploadResultText || '旧记录已回填上游款式商品编号，规格编号待补齐。',
    }
  })
  const upstreamProductId = record.upstreamProductId || record.upstreamChannelProductCode || ''
  const uploadedSpecLineCount = countUploadedChannelListingSpecLines(specLines)
  const listingBatchStatus =
    record.listingBatchStatus ||
    (record.channelProductStatus === '已上架待测款'
      ? '已完成'
      : upstreamProductId
        ? '已上传待确认'
        : record.channelProductStatus === '待上传'
          ? '待上传'
          : record.channelProductStatus)
  const primarySpec = specLines[0] || null
  const listingImages =
    record.listingImages?.length > 0
      ? normalizeChannelListingImages({
          listingBatchId: record.channelProductId,
          imageInputs: record.listingImages.map((item) => ({
            imageId: item.imageId,
            sortNo: item.sortNo,
            mainFlag: item.mainFlag,
          })),
          mainImageId: record.listingMainImageId || deriveListingMainImageId(record.listingImages),
          imageAssets: record.listingImages
            .map((item) => getProjectImageAssetById(item.imageId))
            .filter((item): item is NonNullable<typeof item> => Boolean(item)),
        })
      : ensureLegacyListingImageAssets(record)
  const listingImageIds = record.listingImageIds?.length
    ? [...record.listingImageIds]
    : deriveListingImageIds(listingImages)
  const listingMainImageId = record.listingMainImageId || deriveListingMainImageId(listingImages)
  const mainImageRecord = listingImages.find((item) => item.imageId === listingMainImageId) || listingImages[0] || null
  const detailImageUrls = listingImages
    .filter((item) => item.imageId !== listingMainImageId)
    .sort((left, right) => left.sortNo - right.sortNo)
    .map((item) => item.imageUrl)
  const derivedSkuName =
    primarySpec && (primarySpec.colorName || primarySpec.sizeName || primarySpec.printName)
      ? [primarySpec.colorName, primarySpec.sizeName, primarySpec.printName].filter(Boolean).join(' / ')
      : record.skuName || ''
  return {
    ...cloneRecord(record),
    listingBatchCode,
    upstreamProductId,
    upstreamChannelProductCode: upstreamProductId,
    styleId: record.styleId || linkedStyle?.styleId || '',
    styleCode: record.styleCode || linkedStyle?.styleCode || '',
    styleName: record.styleName || linkedStyle?.styleName || '',
    styleListingTitle: record.styleListingTitle || record.listingTitle,
    listingDescription: record.listingDescription || '',
    defaultPriceAmount: record.defaultPriceAmount || record.listingPrice || 0,
    currencyCode: record.currencyCode || record.currency || '',
    listingMainImageId,
    listingImageIds,
    listingImageSource: record.listingImageSource || buildListingImageSourceText(listingImages),
    listingImageConfirmedAt: record.listingImageConfirmedAt || (listingImages.length > 0 ? record.updatedAt : ''),
    listingImageConfirmedBy: record.listingImageConfirmedBy || (listingImages.length > 0 ? record.updatedBy || '系统迁移' : ''),
    listingImages,
    mainImageUrls: mainImageRecord ? [mainImageRecord.imageUrl] : [],
    detailImageUrls,
    listingRemark: record.listingRemark || '',
    specLines,
    specLineCount: specLines.length,
    uploadedSpecLineCount,
    listingBatchStatus,
    uploadResultText:
      record.uploadResultText ||
      (listingBatchStatus === '已上传待确认'
        ? '旧记录已上传到渠道，待确认并补齐规格上游编号。'
        : ''),
    uploadedAt: record.uploadedAt || (upstreamProductId ? record.updatedAt : ''),
    channelProductStatus:
      record.channelProductStatus,
    listingPrice: record.listingPrice || record.defaultPriceAmount || 0,
    currency: record.currency || record.currencyCode || '',
    skuId: record.skuId || primarySpec?.specLineId || '',
    skuCode: record.skuCode || primarySpec?.sellerSku || primarySpec?.specLineCode || '',
    skuName: derivedSkuName,
  }
}

function buildSeedRecord(seed: ChannelSeed): ProjectChannelProductRecord | null {
  const project = findProjectByCode(seed.projectCode)
  const listingNode = project
    ? getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'CHANNEL_PRODUCT_LISTING')
    : null
  if (!project || !listingNode) return null
  const channelMeta = getChannelMeta(seed.channelCode, seed.storeId)
  const channelProductId = buildChannelProductId(seed.projectCode, seed.sequence)
  const channelProductCode = buildChannelProductCode(seed.projectCode, seed.sequence)
  const upstreamProductId =
    seed.channelProductStatus === '待上传'
      ? ''
      : buildUpstreamCode(seed.projectCode, seed.sequence)
  const baseSpecInputs: ChannelListingSpecLineInput[] = [
    {
      colorName: seed.sequence === '02' ? '米白' : '黑色',
      sizeName: 'M',
      priceAmount: seed.listingPrice,
      currencyCode: resolvePcsStoreCurrency(seed.storeId, seed.channelCode) || seed.currency,
      stockQty: 30,
    },
    {
      colorName: seed.sequence === '02' ? '米白' : '黑色',
      sizeName: 'L',
      priceAmount: seed.listingPrice,
      currencyCode: resolvePcsStoreCurrency(seed.storeId, seed.channelCode) || seed.currency,
      stockQty: 24,
    },
  ]
  const specLines = normalizeChannelListingSpecLines({
    listingBatchId: channelProductId,
    listingBatchCode: channelProductCode,
    projectCode: project.projectCode,
    defaultPriceAmount: seed.listingPrice,
    currencyCode: resolvePcsStoreCurrency(seed.storeId, seed.channelCode) || seed.currency,
    specLines: baseSpecInputs,
  }).map((line) =>
    upstreamProductId
      ? {
          ...line,
          lineStatus: '已上传',
          upstreamSkuId: buildUploadedUpstreamSkuId(upstreamProductId, line.specLineCode),
          uploadResultText: '已上传到渠道。',
        }
      : line,
  )
  const primarySpec = specLines[0] || null
  return {
    channelProductId,
    channelProductCode,
    listingBatchCode: channelProductCode,
    upstreamChannelProductCode: upstreamProductId,
    upstreamProductId,
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    projectNodeId: listingNode.projectNodeId,
    channelCode: seed.channelCode,
    channelName: channelMeta.channelName,
    storeId: seed.storeId,
    storeName: channelMeta.storeName,
    styleListingTitle: seed.listingTitle,
    listingTitle: seed.listingTitle,
    listingDescription: '',
    listingPrice: seed.listingPrice,
    defaultPriceAmount: seed.listingPrice,
    currency: resolvePcsStoreCurrency(seed.storeId, seed.channelCode) || seed.currency,
    currencyCode: resolvePcsStoreCurrency(seed.storeId, seed.channelCode) || seed.currency,
    listingMainImageId: '',
    listingImageIds: [],
    listingImageSource: '',
    listingImageConfirmedAt: '',
    listingImageConfirmedBy: '',
    listingImages: [],
    mainImageUrls: [],
    detailImageUrls: [],
    listingRemark: '',
    specLines,
    specLineCount: specLines.length,
    uploadedSpecLineCount: countUploadedChannelListingSpecLines(specLines),
    listingBatchStatus:
      seed.channelProductStatus,
    uploadResultText: upstreamProductId ? '历史初始化数据已回填上游款式商品编号。' : '',
    uploadedAt: upstreamProductId ? seed.updatedAt : '',
    channelProductStatus:
      seed.channelProductStatus,
    upstreamSyncStatus: seed.upstreamSyncStatus,
    skuId: primarySpec?.specLineId || '',
    skuCode: primarySpec?.sellerSku || '',
    skuName: [primarySpec?.colorName, primarySpec?.sizeName].filter(Boolean).join(' / '),
    styleId: seed.styleId || '',
    styleCode: seed.styleCode || '',
    styleName: seed.styleName || '',
    invalidatedReason: seed.invalidatedReason || '',
    createdAt: seed.createdAt,
    updatedAt: seed.updatedAt,
    effectiveAt: seed.effectiveAt || '',
    invalidatedAt: seed.invalidatedAt || '',
    lastUpstreamSyncAt: seed.lastUpstreamSyncAt || '',
    scenario: seed.scenario,
    conclusion: seed.conclusion || '',
    testingStatusText: buildTestingStatusText(seed),
    listingInstanceCode: `LIST-${seed.projectCode.slice(-7).replace(/-/g, '')}-${seed.sequence}`,
    linkedRevisionTaskId: seed.linkedRevisionTaskId || '',
    linkedRevisionTaskCode: seed.linkedRevisionTaskCode || '',
    linkedLiveLineId: seed.linkedLiveLineId || '',
    linkedLiveLineCode: seed.linkedLiveLineCode || '',
    linkedVideoRecordId: seed.linkedVideoRecordId || '',
    linkedVideoRecordCode: seed.linkedVideoRecordCode || '',
    upstreamSyncNote: seed.upstreamSyncNote || '',
    upstreamSyncResult: seed.upstreamSyncResult || '待执行',
    upstreamSyncBy: seed.upstreamSyncBy || '',
    upstreamSyncLog: seed.upstreamSyncLog || '',
  }
}

function seedSnapshot(): ChannelProductStoreSnapshot {
  if (listProjects().length === 0) {
    return {
      version: STORE_VERSION,
      records: [],
    }
  }
  const seeds: ChannelSeed[] = [
    {
      projectCode: 'PRJ-20251216-005',
      sequence: '01',
      scenario: 'MEASURING',
      channelCode: 'tiktok-shop',
      storeId: 'store-tiktok-01',
      listingTitle: '法式优雅衬衫连衣裙测款款',
      listingPrice: 239,
      currency: 'CNY',
      channelProductStatus: '已上架待测款',
      upstreamSyncStatus: '无需更新',
      createdAt: '2026-04-02 10:20',
      updatedAt: '2026-04-03 16:40',
      linkedLiveLineId: 'LS-20260122-001__item-003',
      linkedLiveLineCode: 'LS-20260122-001-L03',
      linkedVideoRecordId: 'SV-20260123-012',
      linkedVideoRecordCode: 'SV-20260123-012',
      upstreamSyncNote: '已完成首次上架，等待测款结论。',
      upstreamSyncLog: '已完成首次上架，等待测款结论。',
    },
    {
      projectCode: 'PRJ-20251216-001',
      sequence: '01',
      scenario: 'FAILED_ADJUST',
      channelCode: 'tiktok-shop',
      storeId: 'store-tiktok-01',
      listingTitle: '印尼风格碎花连衣裙第一轮测款款',
      listingPrice: 259,
      currency: 'CNY',
      channelProductStatus: '已作废',
      upstreamSyncStatus: '无需更新',
      createdAt: '2026-03-20 09:10',
      updatedAt: '2026-03-25 18:20',
      invalidatedAt: '2026-03-25 18:20',
      conclusion: '',
      invalidatedReason: '历史测款结论待重新确认，当前渠道店铺商品已作废。',
      linkedRevisionTaskId: 'RT-20260109-003',
      linkedRevisionTaskCode: 'RT-20260109-003',
      linkedVideoRecordId: 'SV-20260122-008',
      linkedVideoRecordCode: 'SV-20260122-008',
      upstreamSyncNote: '测款未通过，已停止后续渠道更新。',
      upstreamSyncLog: '测款未通过，已停止后续渠道更新。',
    },
    {
      projectCode: 'PRJ-20251216-001',
      sequence: '02',
      scenario: 'HISTORY_INVALIDATED',
      channelCode: 'tiktok-shop',
      storeId: 'store-tiktok-01',
      listingTitle: '印尼风格碎花连衣裙历史重测款',
      listingPrice: 269,
      currency: 'CNY',
      channelProductStatus: '待上传',
      upstreamSyncStatus: '无需更新',
      createdAt: '2026-03-26 09:30',
      updatedAt: '2026-03-26 09:30',
      linkedRevisionTaskId: 'RT-20260109-003',
      linkedRevisionTaskCode: 'RT-20260109-003',
      upstreamSyncNote: '改版任务已建立，等待重新上架。',
      upstreamSyncLog: '改版任务已建立，等待重新上架。',
    },
    {
      projectCode: 'PRJ-20251216-008',
      sequence: '01',
      scenario: 'FAILED_ELIMINATED',
      channelCode: 'wechat-mini-program',
      storeId: 'store-mini-program-01',
      listingTitle: '商务休闲西装外套测款款',
      listingPrice: 399,
      currency: 'CNY',
      channelProductStatus: '已作废',
      upstreamSyncStatus: '无需更新',
      createdAt: '2026-03-12 11:30',
      updatedAt: '2026-03-16 15:20',
      invalidatedAt: '2026-03-16 15:20',
      conclusion: '淘汰',
      invalidatedReason: '测款结论为淘汰，当前渠道店铺商品已作废。',
      upstreamSyncNote: '项目已终止，不再创建款式档案。',
      upstreamSyncLog: '项目已终止，不再创建款式档案。',
    },
    {
      projectCode: 'PRJ-20251216-006',
      sequence: '01',
      scenario: 'STYLE_PENDING_TECH',
      channelCode: 'shopee',
      storeId: 'store-shopee-01',
      listingTitle: '运动休闲卫衣套装正式候选款',
      listingPrice: 299,
      currency: 'CNY',
      channelProductStatus: '已生效',
      upstreamSyncStatus: '待更新',
      styleId: 'style_seed_020',
      styleCode: 'SPU-TEE-084',
      styleName: '针织撞色短袖上衣',
      createdAt: '2026-03-18 13:10',
      updatedAt: '2026-04-01 10:40',
      effectiveAt: '2026-04-01 10:40',
      upstreamSyncNote: '款式档案已建立，待技术包启用后更新上游商品。',
      upstreamSyncLog: '款式档案已建立，待技术包启用后更新上游商品。',
    },
    {
      projectCode: 'PRJ-20251216-002',
      sequence: '01',
      scenario: 'STYLE_ACTIVE',
      channelCode: 'tiktok-shop',
      storeId: 'store-tiktok-01',
      listingTitle: '百搭纯色基础短袖正式款',
      listingPrice: 129,
      currency: 'CNY',
      channelProductStatus: '已生效',
      upstreamSyncStatus: '已更新',
      styleId: 'style_seed_004',
      styleCode: 'SPU-2024-004',
      styleName: 'Kaos Polos Premium',
      createdAt: '2026-03-06 10:10',
      updatedAt: '2026-04-05 09:20',
      effectiveAt: '2026-03-28 14:00',
      lastUpstreamSyncAt: '2026-04-05 09:20',
      upstreamSyncNote: '技术包已启用，已完成上游商品最终更新。',
      upstreamSyncResult: '成功',
      upstreamSyncBy: '商品中心',
      upstreamSyncLog: '2026-04-05 09:20 已将当前生效技术包版本同步到上游渠道商品。',
    },
    {
      projectCode: 'PRJ-20251216-007',
      sequence: '01',
      scenario: 'HISTORY_INVALIDATED',
      channelCode: 'shopee',
      storeId: 'store-shopee-01',
      listingTitle: '碎花雪纺半身裙第一轮测款款',
      listingPrice: 199,
      currency: 'CNY',
      channelProductStatus: '已作废',
      upstreamSyncStatus: '无需更新',
      createdAt: '2026-03-01 09:10',
      updatedAt: '2026-03-08 18:00',
      invalidatedAt: '2026-03-08 18:00',
      conclusion: '',
      invalidatedReason: '历史测款结论待重新确认，旧渠道店铺商品已作废。',
      upstreamSyncNote: '旧渠道店铺商品已失效，保留历史链路。',
      upstreamSyncLog: '旧渠道店铺商品已失效，保留历史链路。',
    },
    {
      projectCode: 'PRJ-20251216-007',
      sequence: '02',
      scenario: 'STYLE_ACTIVE',
      channelCode: 'shopee',
      storeId: 'store-shopee-01',
      listingTitle: '碎花雪纺半身裙改版后正式款',
      listingPrice: 219,
      currency: 'CNY',
      channelProductStatus: '已生效',
      upstreamSyncStatus: '已更新',
      styleId: 'style_seed_019',
      styleCode: 'SPU-DRESS-083',
      styleName: '春季定位印花连衣裙',
      createdAt: '2026-03-09 10:00',
      updatedAt: '2026-04-06 16:30',
      effectiveAt: '2026-03-16 10:20',
      lastUpstreamSyncAt: '2026-04-06 16:30',
      upstreamSyncNote: '改版后测款通过，已完成最终上游更新。',
      upstreamSyncResult: '成功',
      upstreamSyncBy: '商品中心',
      upstreamSyncLog: '2026-04-06 16:30 已完成最终上游更新。',
    },
  ]

  const scenarioSeeds: ChannelSeed[] = [
    {
      projectCode: 'PRJ-20251216-011',
      sequence: '01',
      scenario: 'STYLE_PENDING_TECH',
      channelCode: 'shopee',
      storeId: 'store-shopee-01',
      listingTitle: '基础轻甜印花连衣裙正式候选款',
      listingPrice: 239,
      currency: 'CNY',
      channelProductStatus: '已生效',
      upstreamSyncStatus: '待更新',
      styleId: 'style_seed_017',
      styleCode: 'SPU-TSHIRT-081',
      styleName: '春季休闲印花短袖 T 恤',
      createdAt: '2026-03-28 10:10',
      updatedAt: '2026-04-03 15:20',
      effectiveAt: '2026-04-03 10:40',
      linkedVideoRecordId: 'SV-PJT-011',
      linkedVideoRecordCode: 'SV-PJT-011',
      upstreamSyncNote: '款式档案已建立，待技术包启用后更新上游商品。',
      upstreamSyncLog: '款式档案已建立，待技术包启用后更新上游商品。',
    },
    {
      projectCode: 'PRJ-20251216-012',
      sequence: '01',
      scenario: 'STYLE_PENDING_TECH',
      channelCode: 'wechat-mini-program',
      storeId: 'store-mini-program-01',
      listingTitle: '快反撞色卫衣套装正式候选款',
      listingPrice: 199,
      currency: 'CNY',
      channelProductStatus: '已生效',
      upstreamSyncStatus: '待更新',
      styleId: 'style_seed_018',
      styleCode: 'SPU-HOODIE-082',
      styleName: '连帽拉链卫衣套装',
      createdAt: '2026-03-27 14:20',
      updatedAt: '2026-04-02 11:00',
      effectiveAt: '2026-04-02 09:50',
      linkedVideoRecordId: 'SV-PJT-012',
      linkedVideoRecordCode: 'SV-PJT-012',
      upstreamSyncNote: '短视频测款通过，等待技术包启用。',
      upstreamSyncLog: '短视频测款通过，等待技术包启用。',
    },
    {
      projectCode: 'PRJ-20251216-013',
      sequence: '01',
      scenario: 'STYLE_PENDING_TECH',
      channelCode: 'tiktok-shop',
      storeId: 'store-tiktok-01',
      listingTitle: '设计款户外轻量夹克正式候选款',
      listingPrice: 369,
      currency: 'CNY',
      channelProductStatus: '已生效',
      upstreamSyncStatus: '待更新',
      styleId: 'style_seed_021',
      styleCode: 'SPU-JACKET-085',
      styleName: '户外轻量夹克',
      createdAt: '2026-03-29 09:40',
      updatedAt: '2026-04-04 16:10',
      effectiveAt: '2026-04-04 14:30',
      linkedLiveLineId: 'LS-20260404-011__item-001',
      linkedLiveLineCode: 'LS-20260404-011-L01',
      linkedVideoRecordId: 'SV-PJT-011',
      linkedVideoRecordCode: 'SV-PJT-011',
      upstreamSyncNote: '直播测款通过，等待技术包启用后同步上游商品。',
      upstreamSyncLog: '直播测款通过，等待技术包启用后同步上游商品。',
    },
    {
      projectCode: 'PRJ-20251216-014',
      sequence: '01',
      scenario: 'STYLE_ACTIVE',
      channelCode: 'tiktok-shop',
      storeId: 'store-tiktok-01',
      listingTitle: '快反商务修身长袖衬衫正式款',
      listingPrice: 219,
      currency: 'CNY',
      channelProductStatus: '已生效',
      upstreamSyncStatus: '已更新',
      styleId: 'style_seed_022',
      styleCode: 'SPU-SHIRT-086',
      styleName: '商务修身长袖衬衫',
      createdAt: '2026-03-25 09:15',
      updatedAt: '2026-04-05 10:50',
      effectiveAt: '2026-04-01 13:20',
      lastUpstreamSyncAt: '2026-04-05 10:50',
      linkedLiveLineId: 'LS-20260405-014__item-001',
      linkedLiveLineCode: 'LS-20260405-014-L01',
      upstreamSyncNote: '技术包已启用，已完成上游商品最终更新。',
      upstreamSyncResult: '成功',
      upstreamSyncBy: '商品中心',
      upstreamSyncLog: '2026-04-05 10:50 已将当前生效技术包版本同步到上游渠道商品。',
    },
    {
      projectCode: 'PRJ-20251216-015',
      sequence: '01',
      scenario: 'STYLE_ACTIVE',
      channelCode: 'shopee',
      storeId: 'store-shopee-01',
      listingTitle: '设计款中式结饰上衣正式款',
      listingPrice: 319,
      currency: 'CNY',
      channelProductStatus: '已生效',
      upstreamSyncStatus: '已更新',
      styleId: 'style_seed_005',
      styleCode: 'SPU-2024-005',
      styleName: '中式结饰上衣',
      createdAt: '2026-03-24 11:05',
      updatedAt: '2026-04-06 14:40',
      effectiveAt: '2026-03-30 11:15',
      lastUpstreamSyncAt: '2026-04-06 14:40',
      linkedVideoRecordId: 'SV-PJT-015',
      linkedVideoRecordCode: 'SV-PJT-015',
      upstreamSyncNote: '技术包已启用，已完成上游商品最终更新。',
      upstreamSyncResult: '成功',
      upstreamSyncBy: '商品中心',
      upstreamSyncLog: '2026-04-06 14:40 已完成最终上游更新。',
    },
    {
      projectCode: 'PRJ-20251216-016',
      sequence: '01',
      scenario: 'FAILED_ADJUST',
      channelCode: 'tiktok-shop',
      storeId: 'store-tiktok-01',
      listingTitle: '基础款波点雪纺连衣裙第一轮测款款',
      listingPrice: 249,
      currency: 'CNY',
      channelProductStatus: '已作废',
      upstreamSyncStatus: '无需更新',
      createdAt: '2026-03-20 13:10',
      updatedAt: '2026-03-29 18:10',
      invalidatedAt: '2026-03-29 18:10',
      conclusion: '',
      invalidatedReason: '历史测款结论待重新确认，当前渠道店铺商品已作废。',
      linkedRevisionTaskId: 'RT-20260401-016',
      linkedRevisionTaskCode: 'RT-20260401-016',
      linkedLiveLineId: 'LS-20260329-016__item-001',
      linkedLiveLineCode: 'LS-20260329-016-L01',
      upstreamSyncNote: '测款未通过，已转改版任务。',
      upstreamSyncLog: '测款未通过，已转改版任务。',
    },
    {
      projectCode: 'PRJ-20251216-017',
      sequence: '01',
      scenario: 'FAILED_ADJUST',
      channelCode: 'shopee',
      storeId: 'store-shopee-01',
      listingTitle: '改版牛仔机车短外套测款款',
      listingPrice: 329,
      currency: 'CNY',
      channelProductStatus: '已作废',
      upstreamSyncStatus: '无需更新',
      createdAt: '2026-03-22 10:30',
      updatedAt: '2026-03-31 17:20',
      invalidatedAt: '2026-03-31 17:20',
      conclusion: '',
      invalidatedReason: '历史测款结论待重新确认，当前渠道店铺商品已作废。',
      linkedRevisionTaskId: 'RT-20260401-017',
      linkedRevisionTaskCode: 'RT-20260401-017',
      linkedLiveLineId: 'LS-20260331-017__item-001',
      linkedLiveLineCode: 'LS-20260331-017-L01',
      upstreamSyncNote: '历史测款结论待重新确认。',
      upstreamSyncLog: '历史测款结论待重新确认。',
    },
    {
      projectCode: 'PRJ-20251216-018',
      sequence: '01',
      scenario: 'FAILED_ADJUST',
      channelCode: 'tiktok-shop',
      storeId: 'store-tiktok-01',
      listingTitle: '设计款印花阔腿连体裤测款款',
      listingPrice: 359,
      currency: 'CNY',
      channelProductStatus: '已作废',
      upstreamSyncStatus: '无需更新',
      createdAt: '2026-03-23 09:50',
      updatedAt: '2026-04-01 18:20',
      invalidatedAt: '2026-04-01 18:20',
      conclusion: '',
      invalidatedReason: '历史测款结论待重新确认，当前渠道店铺商品已作废。',
      linkedRevisionTaskId: 'RT-20260402-018',
      linkedRevisionTaskCode: 'RT-20260402-018',
      linkedLiveLineId: 'LS-20260331-017__item-001',
      linkedLiveLineCode: 'LS-20260331-017-L01',
      linkedVideoRecordId: 'SV-PJT-018',
      linkedVideoRecordCode: 'SV-PJT-018',
      upstreamSyncNote: '历史测款结论待重新确认。',
      upstreamSyncLog: '历史测款结论待重新确认。',
    },
    {
      projectCode: 'PRJ-20251216-019',
      sequence: '01',
      scenario: 'FAILED_PAUSED',
      channelCode: 'wechat-mini-program',
      storeId: 'store-mini-program-01',
      listingTitle: '基础款针织开衫测款款',
      listingPrice: 179,
      currency: 'CNY',
      channelProductStatus: '已作废',
      upstreamSyncStatus: '无需更新',
      createdAt: '2026-03-21 11:10',
      updatedAt: '2026-04-02 10:30',
      invalidatedAt: '2026-04-02 10:30',
      conclusion: '',
      invalidatedReason: '历史测款结论待重新确认，当前渠道店铺商品已作废。',
      linkedVideoRecordId: 'SV-PJT-019',
      linkedVideoRecordCode: 'SV-PJT-019',
      upstreamSyncNote: '历史测款结论待重新确认，保留历史商品记录。',
      upstreamSyncLog: '历史测款结论待重新确认，保留历史商品记录。',
    },
    {
      projectCode: 'PRJ-20251216-020',
      sequence: '01',
      scenario: 'FAILED_PAUSED',
      channelCode: 'tiktok-shop',
      storeId: 'store-tiktok-01',
      listingTitle: '快反 POLO 衫测款款',
      listingPrice: 169,
      currency: 'CNY',
      channelProductStatus: '已作废',
      upstreamSyncStatus: '无需更新',
      createdAt: '2026-03-21 15:20',
      updatedAt: '2026-04-03 13:10',
      invalidatedAt: '2026-04-03 13:10',
      conclusion: '',
      invalidatedReason: '历史测款结论待重新确认，当前渠道店铺商品已作废。',
      linkedLiveLineId: 'LS-20260403-020__item-001',
      linkedLiveLineCode: 'LS-20260403-020-L01',
      linkedVideoRecordId: 'SV-PJT-019',
      linkedVideoRecordCode: 'SV-PJT-019',
      upstreamSyncNote: '历史测款结论待重新确认，等待重新判定。',
      upstreamSyncLog: '历史测款结论待重新确认，等待重新判定。',
    },
    {
      projectCode: 'PRJ-20251216-021',
      sequence: '01',
      scenario: 'FAILED_PAUSED',
      channelCode: 'shopee',
      storeId: 'store-shopee-01',
      listingTitle: '改版都市西装马甲测款款',
      listingPrice: 229,
      currency: 'CNY',
      channelProductStatus: '已作废',
      upstreamSyncStatus: '无需更新',
      createdAt: '2026-03-22 16:40',
      updatedAt: '2026-04-04 09:40',
      invalidatedAt: '2026-04-04 09:40',
      conclusion: '',
      invalidatedReason: '历史测款结论待重新确认，当前渠道店铺商品已作废。',
      linkedLiveLineId: 'LS-20260404-021__item-001',
      linkedLiveLineCode: 'LS-20260404-021-L01',
      upstreamSyncNote: '项目已阻塞，等待重新评估。',
      upstreamSyncLog: '项目已阻塞，等待重新评估。',
    },
    {
      projectCode: 'PRJ-20251216-022',
      sequence: '01',
      scenario: 'FAILED_PAUSED',
      channelCode: 'tiktok-shop',
      storeId: 'store-tiktok-01',
      listingTitle: '设计款民族印花半裙测款款',
      listingPrice: 269,
      currency: 'CNY',
      channelProductStatus: '已作废',
      upstreamSyncStatus: '无需更新',
      createdAt: '2026-03-24 10:45',
      updatedAt: '2026-04-04 15:30',
      invalidatedAt: '2026-04-04 15:30',
      conclusion: '',
      invalidatedReason: '历史测款结论待重新确认，当前渠道店铺商品已作废。',
      linkedVideoRecordId: 'SV-PJT-022',
      linkedVideoRecordCode: 'SV-PJT-022',
      upstreamSyncNote: '历史测款结论待重新确认，等待重新判定。',
      upstreamSyncLog: '历史测款结论待重新确认，等待重新判定。',
    },
    {
      projectCode: 'PRJ-20251216-023',
      sequence: '01',
      scenario: 'FAILED_ELIMINATED',
      channelCode: 'tiktok-shop',
      storeId: 'store-tiktok-01',
      listingTitle: '基础款男装休闲夹克测款款',
      listingPrice: 289,
      currency: 'CNY',
      channelProductStatus: '已作废',
      upstreamSyncStatus: '无需更新',
      createdAt: '2026-03-25 08:50',
      updatedAt: '2026-04-05 11:10',
      invalidatedAt: '2026-04-05 11:10',
      conclusion: '淘汰',
      invalidatedReason: '测款结论为淘汰，当前渠道店铺商品已作废。',
      linkedLiveLineId: 'LS-20260405-023__item-001',
      linkedLiveLineCode: 'LS-20260405-023-L01',
      upstreamSyncNote: '项目已终止，不再创建款式档案。',
      upstreamSyncLog: '项目已终止，不再创建款式档案。',
    },
    {
      projectCode: 'PRJ-20251216-024',
      sequence: '01',
      scenario: 'FAILED_ELIMINATED',
      channelCode: 'wechat-mini-program',
      storeId: 'store-mini-program-01',
      listingTitle: '快反居家套装测款款',
      listingPrice: 159,
      currency: 'CNY',
      channelProductStatus: '已作废',
      upstreamSyncStatus: '无需更新',
      createdAt: '2026-03-26 10:20',
      updatedAt: '2026-04-05 16:20',
      invalidatedAt: '2026-04-05 16:20',
      conclusion: '淘汰',
      invalidatedReason: '测款结论为淘汰，当前渠道店铺商品已作废。',
      linkedLiveLineId: 'LS-20260405-024__item-001',
      linkedLiveLineCode: 'LS-20260405-024-L01',
      linkedVideoRecordId: 'SV-PJT-024',
      linkedVideoRecordCode: 'SV-PJT-024',
      upstreamSyncNote: '双渠道测款表现不达标，项目终止。',
      upstreamSyncLog: '双渠道测款表现不达标，项目终止。',
    },
    {
      projectCode: 'PRJ-20251216-025',
      sequence: '01',
      scenario: 'FAILED_ELIMINATED',
      channelCode: 'shopee',
      storeId: 'store-shopee-01',
      listingTitle: '改版针织背心测款款',
      listingPrice: 149,
      currency: 'CNY',
      channelProductStatus: '已作废',
      upstreamSyncStatus: '无需更新',
      createdAt: '2026-03-26 15:50',
      updatedAt: '2026-04-06 09:50',
      invalidatedAt: '2026-04-06 09:50',
      conclusion: '淘汰',
      invalidatedReason: '测款结论为淘汰，当前渠道店铺商品已作废。',
      linkedLiveLineId: 'LS-20260406-025__item-001',
      linkedLiveLineCode: 'LS-20260406-025-L01',
      upstreamSyncNote: '项目已终止，不再进入款式档案链路。',
      upstreamSyncLog: '项目已终止，不再进入款式档案链路。',
    },
  ]

  return {
    version: STORE_VERSION,
    records: [...seeds, ...scenarioSeeds]
      .map(buildSeedRecord)
      .filter((item): item is ProjectChannelProductRecord => Boolean(item)),
  }
}

function hydrateSnapshot(snapshot: ChannelProductStoreSnapshot): ChannelProductStoreSnapshot {
  return {
    version: STORE_VERSION,
    records: Array.isArray(snapshot.records) ? snapshot.records.map(normalizeChannelProductRecord) : [],
  }
}

function loadSnapshot(): ChannelProductStoreSnapshot {
  if (memorySnapshot) return cloneSnapshot(memorySnapshot)
  if (!canUseStorage()) {
    memorySnapshot = seedSnapshot()
    return cloneSnapshot(memorySnapshot)
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      memorySnapshot = seedSnapshot()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot))
      return cloneSnapshot(memorySnapshot)
    }
    const parsed = JSON.parse(raw) as Partial<ChannelProductStoreSnapshot>
    memorySnapshot = hydrateSnapshot({
      version: STORE_VERSION,
      records: Array.isArray(parsed.records) ? (parsed.records as ProjectChannelProductRecord[]) : seedSnapshot().records,
    })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot))
    return cloneSnapshot(memorySnapshot)
  } catch {
    memorySnapshot = seedSnapshot()
    if (canUseStorage()) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot))
    }
    return cloneSnapshot(memorySnapshot)
  }
}

function persistSnapshot(snapshot: ChannelProductStoreSnapshot): void {
  memorySnapshot = hydrateSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot))
  }
}

function buildStyleRelation(
  projectId: string,
  styleId: string,
  operatorName: string,
): ProjectRelationRecord | null {
  const project = getProjectById(projectId)
  const style = getStyleArchiveById(styleId)
  const node = getProjectNodeRecordByWorkItemTypeCode(projectId, 'STYLE_ARCHIVE_CREATE')
  if (!project || !style || !node) return null
  return {
    projectRelationId: `rel_style_${style.styleId}`,
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectNodeId: node.projectNodeId,
    workItemTypeCode: 'STYLE_ARCHIVE_CREATE',
    workItemTypeName: '生成款式档案',
    relationRole: '产出对象',
    sourceModule: '款式档案',
    sourceObjectType: '款式档案',
    sourceObjectId: style.styleId,
    sourceObjectCode: style.styleCode,
    sourceLineId: null,
    sourceLineCode: null,
    sourceTitle: style.styleName,
    sourceStatus: style.archiveStatus,
    businessDate: style.generatedAt || style.updatedAt,
    ownerName: operatorName,
    createdAt: style.generatedAt || style.updatedAt,
    createdBy: operatorName,
    updatedAt: style.updatedAt,
    updatedBy: operatorName,
    note: '已建立款式档案与渠道店铺商品三码关联。',
    legacyRefType: '',
    legacyRefValue: '',
  }
}

function buildTechnicalVersionRelation(
  projectId: string,
  technicalVersionId: string,
  operatorName: string,
): ProjectRelationRecord | null {
  const project = getProjectById(projectId)
  const record = getTechnicalDataVersionById(technicalVersionId)
  if (!project || !record) return null
  const node = getTechPackSourceNodeBinding(projectId, record.createdFromTaskType)
  return {
    projectRelationId: `rel_technical_version_${record.technicalVersionId}`,
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectNodeId: node.projectNodeId,
    workItemTypeCode: node.workItemTypeCode,
    workItemTypeName: node.workItemTypeName,
    relationRole: '产出对象',
    sourceModule: '技术包',
    sourceObjectType: '技术包版本',
    sourceObjectId: record.technicalVersionId,
    sourceObjectCode: record.technicalVersionCode,
    sourceLineId: null,
    sourceLineCode: null,
    sourceTitle: `${record.styleName} ${record.versionLabel}`,
    sourceStatus: record.versionStatus,
    businessDate: record.publishedAt || record.updatedAt,
    ownerName: operatorName,
    createdAt: record.createdAt,
    createdBy: operatorName,
    updatedAt: record.updatedAt,
    updatedBy: operatorName,
    note: '',
    legacyRefType: '',
    legacyRefValue: '',
  }
}

function buildChannelProductRelation(
  record: ProjectChannelProductRecord,
  operatorName: string,
): ProjectRelationRecord {
  const listingNode = getProjectNodeRecordByWorkItemTypeCode(record.projectId, 'CHANNEL_PRODUCT_LISTING')
  return {
    projectRelationId: `rel_channel_product_${record.channelProductId}`,
    projectId: record.projectId,
    projectCode: record.projectCode,
    projectNodeId: listingNode?.projectNodeId || null,
    workItemTypeCode: 'CHANNEL_PRODUCT_LISTING',
    workItemTypeName: '商品上架',
    relationRole: '产出对象',
    sourceModule: '渠道店铺商品',
    sourceObjectType: '渠道店铺商品',
    sourceObjectId: record.channelProductId,
    sourceObjectCode: record.channelProductCode,
    sourceLineId: null,
    sourceLineCode: null,
    sourceTitle: record.listingTitle,
    sourceStatus: record.channelProductStatus,
    businessDate: record.updatedAt || record.createdAt,
    ownerName: operatorName,
    createdAt: record.createdAt,
    createdBy: operatorName,
    updatedAt: record.updatedAt,
    updatedBy: operatorName,
    note: record.styleCode
      ? `已形成款式档案 / 渠道店铺商品 / 上游编码串联：${record.styleCode} / ${record.channelProductCode} / ${record.upstreamChannelProductCode}`
      : record.invalidatedReason || record.testingStatusText,
    legacyRefType: '',
    legacyRefValue: '',
  }
}

function buildUpstreamSyncRelation(
  record: ProjectChannelProductRecord,
  operatorName: string,
): ProjectRelationRecord | null {
  if (!record.upstreamChannelProductCode || record.upstreamSyncStatus !== '已更新') return null
  const styleNode = getProjectNodeRecordByWorkItemTypeCode(record.projectId, 'STYLE_ARCHIVE_CREATE')
  return {
    projectRelationId: `rel_upstream_sync_${record.channelProductId}`,
    projectId: record.projectId,
    projectCode: record.projectCode,
    projectNodeId: styleNode?.projectNodeId || null,
    workItemTypeCode: styleNode ? 'STYLE_ARCHIVE_CREATE' : '',
    workItemTypeName: styleNode?.workItemTypeName || '',
    relationRole: '执行记录',
    sourceModule: '上游渠道商品同步',
    sourceObjectType: '上游渠道商品同步',
    sourceObjectId: `sync_${record.channelProductId}`,
    sourceObjectCode: record.upstreamChannelProductCode,
    sourceLineId: null,
    sourceLineCode: null,
    sourceTitle: `${record.channelProductCode} 上游最终更新`,
    sourceStatus: record.upstreamSyncStatus,
    businessDate: record.lastUpstreamSyncAt || record.updatedAt,
    ownerName: operatorName,
    createdAt: record.lastUpstreamSyncAt || record.updatedAt,
    createdBy: operatorName,
    updatedAt: record.lastUpstreamSyncAt || record.updatedAt,
    updatedBy: operatorName,
    note: record.upstreamSyncLog || record.upstreamSyncNote,
    legacyRefType: '',
    legacyRefValue: '',
  }
}

function toTechnicalVersionId(styleId: string): string {
  const matched = styleId.match(/style_seed_(\d+)/)
  if (!matched) return ''
  return `tdv_seed_${matched[1]}`
}

function applyScenarioStyleLinks(): void {
  const currentRecords = loadSnapshot()
    .records
    .filter(
      (record) =>
        record.styleId &&
        (record.scenario === 'STYLE_ACTIVE' || record.scenario === 'STYLE_PENDING_TECH'),
    )

  currentRecords.forEach((record) => {
    const project = findProjectByCode(record.projectCode)
    const style = getStyleArchiveById(record.styleId)
    const technicalVersionId = toTechnicalVersionId(record.styleId)
    const technicalVersion = technicalVersionId ? getTechnicalDataVersionById(technicalVersionId) : null
    const styleNode = project
      ? getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'STYLE_ARCHIVE_CREATE')
      : null
    const techPackNode = project && technicalVersion
      ? getTechPackSourceNodeBinding(project.projectId, technicalVersion.createdFromTaskType)
      : null
    if (!project || !style || !technicalVersion) return

    const activated = record.scenario === 'STYLE_ACTIVE'
    updateStyleArchive(style.styleId, {
      sourceProjectId: project.projectId,
      sourceProjectCode: project.projectCode,
      sourceProjectName: project.projectName,
      sourceProjectNodeId: styleNode?.projectNodeId || '',
      archiveStatus: activated ? 'ACTIVE' : 'DRAFT',
      techPackStatus: activated ? '已启用' : '已发布待启用',
      channelProductCount: listProjectChannelProductsByProjectId(project.projectId).filter(
        (item) => item.styleId === style.styleId,
      ).length || 1,
      currentTechPackVersionId: activated ? technicalVersion.technicalVersionId : '',
      currentTechPackVersionCode: activated ? technicalVersion.technicalVersionCode : '',
      currentTechPackVersionLabel: activated ? technicalVersion.versionLabel : '',
      currentTechPackVersionStatus: activated ? '已启用' : '',
      currentTechPackVersionActivatedAt: activated ? technicalVersion.publishedAt : '',
      currentTechPackVersionActivatedBy: activated ? '商品中心' : '',
      updatedAt: (activated ? technicalVersion.publishedAt : technicalVersion.updatedAt) || style.updatedAt,
      updatedBy: DEMO_OPERATOR,
    })

    updateTechnicalDataVersionRecord(technicalVersion.technicalVersionId, {
      sourceProjectId: project.projectId,
      sourceProjectCode: project.projectCode,
      sourceProjectName: project.projectName,
      sourceProjectNodeId: techPackNode?.projectNodeId || '',
    })

    updateProjectRecord(
      project.projectId,
      {
        linkedStyleId: style.styleId,
        linkedStyleCode: style.styleCode,
        linkedStyleName: style.styleName,
        linkedStyleGeneratedAt: style.generatedAt,
        linkedTechPackVersionId: technicalVersion.technicalVersionId,
        linkedTechPackVersionCode: technicalVersion.technicalVersionCode,
        linkedTechPackVersionLabel: technicalVersion.versionLabel,
        linkedTechPackVersionStatus: technicalVersion.versionStatus,
        linkedTechPackVersionPublishedAt: technicalVersion.publishedAt,
        updatedAt: (activated ? technicalVersion.publishedAt : technicalVersion.updatedAt) || project.updatedAt,
      },
      DEMO_OPERATOR,
    )

    if (styleNode) {
      updateProjectNodeRecord(
        project.projectId,
        styleNode.projectNodeId,
        {
          currentStatus: '已完成',
          latestInstanceId: style.styleId,
          latestInstanceCode: style.styleCode,
          latestResultType: '已生成款式档案',
          latestResultText: activated
            ? '测款通过后已生成正式款式档案，并建立三码关联。'
            : '测款通过后已生成款式档案，当前状态为技术包待完善。',
          pendingActionType: '启用技术包版本',
          pendingActionText: activated ? '请保持当前生效技术包版本并等待生产消费。' : '请启用已发布技术包版本后同步上游商品。',
          updatedAt: style.updatedAt,
        },
        DEMO_OPERATOR,
      )
      syncProjectNodeInstanceRuntime(project.projectId, styleNode.projectNodeId, DEMO_OPERATOR, style.updatedAt)
    }

    if (techPackNode?.projectNodeId) {
      updateProjectNodeRecord(
        project.projectId,
        techPackNode.projectNodeId,
        {
          currentStatus: '进行中',
          latestInstanceId: technicalVersion.technicalVersionId,
          latestInstanceCode: technicalVersion.technicalVersionCode,
          latestResultType: activated ? '已启用当前生效技术包' : '已建立技术包版本',
          latestResultText: activated
            ? '款式档案已可生产，上游商品已完成最终更新。'
            : '款式档案已建立，状态为技术包待完善，上游商品待最终更新。',
          pendingActionType: activated ? '等待生产消费' : '启用技术包版本',
          pendingActionText: activated
            ? '后续生产需求转生产单时将消费当前生效技术包版本。'
            : '请启用当前已发布版本并完成上游最终更新。',
          updatedAt: (activated ? technicalVersion.publishedAt : technicalVersion.updatedAt) || project.updatedAt,
        },
        DEMO_OPERATOR,
      )
      syncProjectNodeInstanceRuntime(
        project.projectId,
        techPackNode.projectNodeId,
        DEMO_OPERATOR,
        (activated ? technicalVersion.publishedAt : technicalVersion.updatedAt) || project.updatedAt,
      )
    }
  })
}

function ensureDemoState(): void {
  if (demoStateApplied) return
  demoStateApplied = true
  applyScenarioStyleLinks()
}

export function ensureProjectChannelProductDemoStateReady(): void {
  ensureDemoState()
}

export function createProjectChannelProductRelationBootstrapSnapshot(
  operatorName = DEMO_OPERATOR,
): ProjectChannelProductRelationBootstrapSnapshot {
  ensureDemoState()
  const records = loadSnapshot().records.map(cloneRecord)
  const relations: ProjectRelationRecord[] = []

  records.forEach((record) => {
    relations.push(buildChannelProductRelation(record, operatorName))

    if (record.styleId) {
      const styleRelation = buildStyleRelation(record.projectId, record.styleId, operatorName)
      if (styleRelation) relations.push(styleRelation)
    }

    const project = getProjectById(record.projectId)
    if (project?.linkedTechPackVersionId) {
      const technicalRelation = buildTechnicalVersionRelation(
        record.projectId,
        project.linkedTechPackVersionId,
        operatorName,
      )
      if (technicalRelation) relations.push(technicalRelation)
    }

    const upstreamRelation = buildUpstreamSyncRelation(record, operatorName)
    if (upstreamRelation) relations.push(upstreamRelation)
  })

  return { relations, records }
}

function listValidChannelProducts(records: ProjectChannelProductRecord[]): ProjectChannelProductRecord[] {
  return [...records]
    .filter((item) => item.channelProductStatus !== '已作废')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function buildSummaryText(
  currentRecord: ProjectChannelProductRecord | null,
  styleStatus: string,
  activeCount: number,
): string {
  if (!currentRecord) return '当前项目尚未创建渠道店铺商品。'
  const multiInstancePrefix = activeCount > 1 ? `当前共有 ${activeCount} 个有效渠道店铺商品实例；` : ''
  if (currentRecord.conclusion === '通过' && !currentRecord.styleCode) {
    return `${multiInstancePrefix}测款通过，待显式生成款式档案；当前最新用于测款的渠道店铺商品为 ${currentRecord.channelProductCode}`
  }
  if (!currentRecord.conclusion && currentRecord.channelProductStatus === '已作废') {
    return `${multiInstancePrefix}当前渠道店铺商品已作废，历史测款结论待重新确认。`
  }
  if (currentRecord.conclusion === '淘汰') {
    return `${multiInstancePrefix}当前渠道店铺商品已作废，当前项目已进入样衣退回处理。`
  }
  if (currentRecord.channelProductStatus === '已作废') {
    return `${multiInstancePrefix}当前渠道店铺商品已作废，不会创建款式档案`
  }
  if (currentRecord.styleCode && styleStatus === '可生产') {
    return `${multiInstancePrefix}款式档案已可生产，上游商品已完成最终更新`
  }
  if (currentRecord.styleCode) {
    return `${multiInstancePrefix}款式档案已建立，状态=技术包待完善，上游商品待最终更新`
  }
  return `${multiInstancePrefix}尚未创建款式档案；当前最新用于测款的渠道店铺商品为 ${currentRecord.channelProductCode}`
}

function getCurrentChannelProduct(records: ProjectChannelProductRecord[]): ProjectChannelProductRecord | null {
  const activeRecord = listValidChannelProducts(records)[0] || null
  if (activeRecord) return activeRecord
  return [...records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null
}

function listLaunchReadyChannelProducts(records: ProjectChannelProductRecord[]): ProjectChannelProductRecord[] {
  return listValidChannelProducts(records).filter(
    (item) =>
      item.listingBatchStatus === '已完成' ||
      item.channelProductStatus === '已上架待测款' ||
      item.channelProductStatus === '已生效',
  )
}

function listTestingConclusionTargetRecords(records: ProjectChannelProductRecord[]): ProjectChannelProductRecord[] {
  const launchReadyRecords = listLaunchReadyChannelProducts(records)
  if (launchReadyRecords.length > 0) return launchReadyRecords

  return [...records]
    .filter((item) => Boolean(item.upstreamProductId || item.upstreamChannelProductCode))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function findOpenChannelProductByChannelStore(
  projectId: string,
  targetChannelCode: string,
  targetStoreId: string,
): ProjectChannelProductRecord | null {
  return (
    listValidChannelProducts(listProjectChannelProductsByProjectId(projectId)).find(
      (item) =>
        item.channelCode === targetChannelCode &&
        item.storeId === targetStoreId,
    ) || null
  )
}

function getTechPackVersionStatusText(status: string): string {
  if (status === 'DRAFT') return '草稿中'
  if (status === 'PUBLISHED') return '已发布待启用'
  if (status === 'ARCHIVED') return '已归档'
  return status
}

function parseSequenceFromChannelProductCode(channelProductCode: string): number {
  const matched = channelProductCode.match(/-(\d{2})$/)
  return matched ? Number(matched[1]) : 0
}

function nextChannelProductSequence(projectId: string): string {
  const records = listProjectChannelProductsByProjectId(projectId)
  const maxSequence = records.reduce(
    (currentMax, item) => Math.max(currentMax, parseSequenceFromChannelProductCode(item.channelProductCode)),
    0,
  )
  return String(maxSequence + 1).padStart(2, '0')
}

function updateProjectPhaseStatuses(projectId: string, currentPhaseCode: string): void {
  const phases = listProjectPhases(projectId)
  phases.forEach((phase) => {
    const nextStatus =
      phase.phaseCode === currentPhaseCode
        ? '进行中'
        : phase.phaseOrder <
            (phases.find((item) => item.phaseCode === currentPhaseCode)?.phaseOrder ?? Number.POSITIVE_INFINITY)
          ? '已完成'
          : phase.phaseStatus === '已终止'
            ? '已终止'
            : '未开始'
    updateProjectPhaseRecord(projectId, phase.projectPhaseId, { phaseStatus: nextStatus })
  })
}

function updateProjectCurrentPhase(
  projectId: string,
  phaseCode: 'PHASE_03' | 'PHASE_04',
  operatorName = DEMO_OPERATOR,
): void {
  updateProjectRecord(
    projectId,
    {
      currentPhaseCode: phaseCode,
      currentPhaseName: getProjectPhaseNameByCode(phaseCode),
      projectStatus: '进行中',
      updatedAt: nowText(),
    },
    operatorName,
  )
  updateProjectPhaseStatuses(projectId, phaseCode)
}

function getFormalTestingRelations(projectId: string): ProjectRelationRecord[] {
  return listProjectRelationsByProject(projectId)
    .filter(
      (item) =>
        item.sourceModule === '直播' ||
        item.sourceModule === '短视频' ||
        item.sourceObjectType === '直播商品明细' ||
        item.sourceObjectType === '短视频记录',
    )
    .sort((a, b) => b.businessDate.localeCompare(a.businessDate))
}

function buildTestingLinkPatch(
  relations: ProjectRelationRecord[],
): Pick<ProjectChannelProductRecord, 'linkedLiveLineId' | 'linkedLiveLineCode' | 'linkedVideoRecordId' | 'linkedVideoRecordCode'> {
  const latestLive = relations.find((item) => item.sourceObjectType === '直播商品明细')
  const latestVideo = relations.find((item) => item.sourceObjectType === '短视频记录')
  return {
    linkedLiveLineId: latestLive?.sourceLineId || '',
    linkedLiveLineCode: latestLive?.sourceLineCode || '',
    linkedVideoRecordId: latestVideo?.sourceObjectId || '',
    linkedVideoRecordCode: latestVideo?.sourceObjectCode || '',
  }
}

interface TestingSummaryFactItem {
  relationId: string
  sourceType: '直播' | '短视频'
  sourceCode: string
  channelCode: string
  channelName: string
  storeId: string
  storeName: string
  currency: string
  channelProductCode: string
  exposureQty: number
  clickQty: number
  orderQty: number
  gmvAmount: number
}

function getChannelDisplayName(channelCode: string): string {
  return getChannelNamesByCodes(channelCode ? [channelCode] : [])[0] || channelCode || '未识别渠道'
}

function normalizeTestingSourceChannelCode(channelLabel: string): string {
  const normalized = channelLabel.trim().toLowerCase()
  if (!normalized) return ''
  if (
    normalized === '抖音' ||
    normalized === '抖音商城' ||
    normalized === 'tiktok' ||
    normalized === 'tiktok shop' ||
    normalized === 'tiktok-shop'
  ) {
    return 'tiktok-shop'
  }
  if (normalized === '虾皮' || normalized === 'shopee') return 'shopee'
  if (normalized === '微信小程序' || normalized === '微信视频号' || normalized === 'wechat-mini-program') {
    return 'wechat-mini-program'
  }
  if (normalized === '来赞达' || normalized === 'lazada') return 'lazada'
  return ''
}

function parseTestingSourceChannelLabel(channelLabel: string): {
  channelCode: string
  channelName: string
  storeName: string
} {
  const segments = channelLabel
    .split(/[\/|｜]/)
    .map((item) => item.trim())
    .filter(Boolean)
  const primaryLabel = segments[0] || channelLabel.trim()
  const channelCode = normalizeTestingSourceChannelCode(primaryLabel)
  return {
    channelCode,
    channelName: channelCode ? getChannelDisplayName(channelCode) : primaryLabel || '未识别渠道',
    storeName: segments[1] || '',
  }
}

function toBreakdownMetricLine(label: string, item: Omit<ProjectTestingSummaryBreakdownItem, 'key' | 'label'>): string {
  return `${label}：曝光 ${item.exposureQty.toLocaleString('zh-CN')}，点击 ${item.clickQty.toLocaleString('zh-CN')}，下单 ${item.orderQty.toLocaleString('zh-CN')}，GMV ${item.gmvAmount.toLocaleString('zh-CN')}，记录 ${item.relationCount} 条`
}

function sortBreakdownItems(items: ProjectTestingSummaryBreakdownItem[]): ProjectTestingSummaryBreakdownItem[] {
  return [...items].sort((left, right) => {
    if (right.gmvAmount !== left.gmvAmount) return right.gmvAmount - left.gmvAmount
    if (right.orderQty !== left.orderQty) return right.orderQty - left.orderQty
    if (right.clickQty !== left.clickQty) return right.clickQty - left.clickQty
    if (right.exposureQty !== left.exposureQty) return right.exposureQty - left.exposureQty
    return left.label.localeCompare(right.label, 'zh-CN')
  })
}

function buildBreakdownItems(
  facts: TestingSummaryFactItem[],
  resolveKey: (item: TestingSummaryFactItem) => string,
  resolveLabel: (item: TestingSummaryFactItem) => string,
): ProjectTestingSummaryBreakdownItem[] {
  const metricsByKey = new Map<string, ProjectTestingSummaryBreakdownItem>()

  for (const fact of facts) {
    const key = resolveKey(fact)
    if (!key) continue
    const current = metricsByKey.get(key) || {
      key,
      label: resolveLabel(fact),
      relationCount: 0,
      sourceCodes: [],
      channelProductCodes: [],
      exposureQty: 0,
      clickQty: 0,
      orderQty: 0,
      gmvAmount: 0,
    }

    current.label = current.label || resolveLabel(fact)
    current.relationCount += 1
    current.exposureQty += fact.exposureQty
    current.clickQty += fact.clickQty
    current.orderQty += fact.orderQty
    current.gmvAmount += fact.gmvAmount

    if (fact.sourceCode && !current.sourceCodes.includes(fact.sourceCode)) {
      current.sourceCodes.push(fact.sourceCode)
    }
    if (fact.channelProductCode && !current.channelProductCodes.includes(fact.channelProductCode)) {
      current.channelProductCodes.push(fact.channelProductCode)
    }

    metricsByKey.set(key, current)
  }

  return sortBreakdownItems([...metricsByKey.values()])
}

function buildTestingSummaryFacts(
  projectId: string,
  relations: ProjectRelationRecord[],
  channelProducts: ProjectChannelProductRecord[],
): {
  liveRelationIds: string[]
  liveRelationCodes: string[]
  videoRelationIds: string[]
  videoRelationCodes: string[]
  facts: TestingSummaryFactItem[]
} {
  const parseRelationMeta = (note: string | null | undefined): Record<string, unknown> => {
    if (!note) return {}
    try {
      const parsed = JSON.parse(note) as Record<string, unknown>
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  const toMetricNumber = (value: unknown): number => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  const activeChannelProducts = channelProducts.filter((item) => item.projectId === projectId && item.channelProductStatus !== '已作废')

  const facts = relations
    .map((relation) => {
      const meta = parseRelationMeta(relation.note)
      if (relation.sourceObjectType === '直播商品明细') {
        const liveLineId = relation.sourceLineId || ''
        const liveRecord = liveLineId ? getLiveProductLineById(liveLineId) : null
        const liveSession = relation.sourceObjectId ? getLiveSessionRecordById(relation.sourceObjectId) : null
        const sourceChannel = parseTestingSourceChannelLabel(
          String(
            liveSession?.channelName ||
              meta.channelName ||
              meta.targetChannelCode ||
              meta.liveAccount ||
              '',
          ),
        )
        const relatedChannelProduct =
          (liveLineId
            ? findProjectChannelProductByLiveLine(projectId, liveLineId) ||
              activeChannelProducts.find((item) => item.linkedLiveLineCode === relation.sourceLineCode)
            : null) ||
          (sourceChannel.channelCode
            ? activeChannelProducts.find((item) => item.channelCode === sourceChannel.channelCode)
            : null) ||
          activeChannelProducts[0] ||
          null
        const channelCode = relatedChannelProduct?.channelCode || sourceChannel.channelCode || String(meta.channelCode || '')
        const storeId = relatedChannelProduct?.storeId || String(meta.storeId || '')
        const channelName =
          relatedChannelProduct?.channelName ||
          sourceChannel.channelName ||
          String(meta.channelName || meta.targetChannelCode || '')
        const storeName =
          relatedChannelProduct?.storeName ||
          (storeId ? resolvePcsStoreDisplayName(storeId, channelCode) : '') ||
          String(meta.storeName || meta.targetStoreId || '') ||
          sourceChannel.storeName ||
          '未识别店铺'
        const currency =
          relatedChannelProduct?.currency ||
          String(meta.currency || '') ||
          resolvePcsStoreCurrency(storeId, channelCode) ||
          '未识别币种'
        const channelProductCode =
          relatedChannelProduct?.channelProductCode ||
          String(meta.channelProductCode || '') ||
          '未识别渠道店铺商品'
        return {
          relationId: relation.projectRelationId,
          sourceType: '直播' as const,
          sourceCode:
            liveRecord?.liveLineCode ||
            relation.sourceLineCode ||
            String(meta.liveLineCode || meta.liveSessionCode || '') ||
            relation.sourceObjectCode ||
            '',
          channelCode,
          channelName,
          storeId,
          storeName,
          currency,
          channelProductCode,
          exposureQty: liveRecord?.exposureQty ?? toMetricNumber(meta.exposure ?? meta.exposureQty),
          clickQty: liveRecord?.clickQty ?? toMetricNumber(meta.click ?? meta.clickQty),
          orderQty: liveRecord?.orderQty ?? toMetricNumber(meta.order ?? meta.orderQty),
          gmvAmount: liveRecord?.gmvAmount ?? toMetricNumber(meta.gmv ?? meta.gmvAmount),
        }
      }

      const videoRecordId = relation.sourceObjectId || ''
      const videoRecord = videoRecordId ? getVideoTestRecordById(videoRecordId) : null
      const sourceChannel = parseTestingSourceChannelLabel(
        String(
          videoRecord?.channelName ||
            meta.channelName ||
            meta.targetChannelCode ||
            meta.account ||
            '',
        ),
      )
      const relatedChannelProduct =
        (videoRecordId
          ? findProjectChannelProductByVideoRecord(projectId, videoRecordId) ||
            activeChannelProducts.find((item) => item.linkedVideoRecordCode === relation.sourceObjectCode)
          : null) ||
        (sourceChannel.channelCode
          ? activeChannelProducts.find((item) => item.channelCode === sourceChannel.channelCode)
          : null) ||
        activeChannelProducts[0] ||
        null
      const channelCode = relatedChannelProduct?.channelCode || sourceChannel.channelCode || String(meta.channelCode || '')
      const storeId = relatedChannelProduct?.storeId || String(meta.storeId || '')
      const channelName =
        relatedChannelProduct?.channelName ||
        sourceChannel.channelName ||
        String(meta.channelName || meta.targetChannelCode || '')
      const storeName =
        relatedChannelProduct?.storeName ||
        (storeId ? resolvePcsStoreDisplayName(storeId, channelCode) : '') ||
        String(meta.storeName || meta.targetStoreId || '') ||
        sourceChannel.storeName ||
        '未识别店铺'
      const currency =
        relatedChannelProduct?.currency ||
        String(meta.currency || '') ||
        resolvePcsStoreCurrency(storeId, channelCode) ||
        '未识别币种'
      const channelProductCode =
        relatedChannelProduct?.channelProductCode ||
        String(meta.channelProductCode || '') ||
        '未识别渠道店铺商品'
      return {
        relationId: relation.projectRelationId,
        sourceType: '短视频' as const,
        sourceCode:
          videoRecord?.videoRecordCode ||
          relation.sourceObjectCode ||
          String(meta.videoRecordCode || meta.videoCode || '') ||
          '',
        channelCode,
        channelName,
        storeId,
        storeName,
        currency,
        channelProductCode,
        exposureQty: videoRecord?.exposureQty ?? toMetricNumber(meta.views ?? meta.exposureQty),
        clickQty: videoRecord?.clickQty ?? toMetricNumber(meta.clicks ?? meta.clickQty),
        orderQty: videoRecord?.orderQty ?? toMetricNumber(meta.orders ?? meta.orderQty),
        gmvAmount: videoRecord?.gmvAmount ?? toMetricNumber(meta.gmv ?? meta.gmvAmount),
      }
    })
    .filter((item) => item.exposureQty > 0 || item.clickQty > 0 || item.orderQty > 0 || item.gmvAmount > 0 || item.sourceCode)

  return {
    liveRelationIds: relations
      .filter((relation) => relation.sourceObjectType === '直播商品明细')
      .map((relation) => relation.projectRelationId),
    liveRelationCodes: relations
      .filter((relation) => relation.sourceObjectType === '直播商品明细')
      .map((relation) => relation.sourceLineCode || relation.sourceObjectCode)
      .filter(Boolean) as string[],
    videoRelationIds: relations
      .filter((relation) => relation.sourceObjectType === '短视频记录')
      .map((relation) => relation.projectRelationId),
    videoRelationCodes: relations
      .filter((relation) => relation.sourceObjectType === '短视频记录')
      .map((relation) => relation.sourceObjectCode)
      .filter(Boolean) as string[],
    facts,
  }
}

function buildProjectTestingSummaryAggregate(
  projectId: string,
  relations: ProjectRelationRecord[] = getFormalTestingRelations(projectId),
  channelProducts: ProjectChannelProductRecord[] = listProjectChannelProductsByProjectId(projectId),
): ProjectTestingSummaryAggregate {
  const { liveRelationIds, liveRelationCodes, videoRelationIds, videoRelationCodes, facts } = buildTestingSummaryFacts(
    projectId,
    relations,
    channelProducts,
  )

  const channelBreakdowns = buildBreakdownItems(facts, (item) => item.channelCode || item.channelName, (item) => item.channelName)
  const storeBreakdowns = buildBreakdownItems(
    facts,
    (item) => `${item.channelCode}::${item.storeId || item.storeName}`,
    (item) => `${item.channelName} / ${item.storeName}`,
  )
  const channelProductBreakdowns = buildBreakdownItems(
    facts,
    (item) => item.channelProductCode,
    (item) => `${item.channelProductCode}（${item.channelName} / ${item.storeName}）`,
  )
  const testingSourceBreakdowns = buildBreakdownItems(facts, (item) => item.sourceType, (item) => item.sourceType)
  const currencyBreakdowns = buildBreakdownItems(facts, (item) => item.currency, (item) => item.currency)

  return {
    liveRelationIds: Array.from(new Set(liveRelationIds.filter(Boolean))),
    liveRelationCodes: Array.from(new Set(liveRelationCodes.filter(Boolean))),
    videoRelationIds: Array.from(new Set(videoRelationIds.filter(Boolean))),
    videoRelationCodes: Array.from(new Set(videoRelationCodes.filter(Boolean))),
    totalExposureQty: facts.reduce((sum, item) => sum + item.exposureQty, 0),
    totalClickQty: facts.reduce((sum, item) => sum + item.clickQty, 0),
    totalOrderQty: facts.reduce((sum, item) => sum + item.orderQty, 0),
    totalGmvAmount: facts.reduce((sum, item) => sum + item.gmvAmount, 0),
    channelBreakdownLines: channelBreakdowns.map((item) => toBreakdownMetricLine(item.label, item)),
    storeBreakdownLines: storeBreakdowns.map((item) => toBreakdownMetricLine(item.label, item)),
    channelProductBreakdownLines: channelProductBreakdowns.map((item) => toBreakdownMetricLine(item.label, item)),
    testingSourceBreakdownLines: testingSourceBreakdowns.map((item) => toBreakdownMetricLine(item.label, item)),
    currencyBreakdownLines: currencyBreakdowns.map((item) => toBreakdownMetricLine(item.label, item)),
    channelBreakdowns,
    storeBreakdowns,
    channelProductBreakdowns,
    testingSourceBreakdowns,
    currencyBreakdowns,
  }
}

export function getProjectTestingSummaryAggregate(projectId: string): ProjectTestingSummaryAggregate {
  return buildProjectTestingSummaryAggregate(projectId)
}

function getProjectNodeOrMessage(projectId: string, workItemTypeCode: string, nodeName: string) {
  const node = getProjectNodeRecordByWorkItemTypeCode(projectId, workItemTypeCode)
  if (!node) {
    return {
      node: null,
      message: `当前项目未配置“${nodeName}”节点，不能继续执行。`,
    }
  }
  if (node.currentStatus === '已取消') {
    return {
      node: null,
      message: `当前项目的“${nodeName}”节点已取消，不能继续执行。`,
    }
  }
  return { node, message: '' }
}

function buildInlineRecordId(projectNodeId: string, sourceDocId: string): string {
  return `${projectNodeId}::${sourceDocId}`.replace(/[^a-zA-Z0-9:_-]/g, '_')
}

function buildInlineRecordCode(projectCode: string, suffix: string): string {
  return `INR-${projectCode.slice(-3)}-${suffix}`
}

function buildTestingSummaryInlineRecord(
  project: NonNullable<ReturnType<typeof getProjectById>>,
  projectNodeId: string,
  summaryText: string,
  relations: ProjectRelationRecord[],
  channelProducts: ProjectChannelProductRecord[],
  operatorName: string,
  businessDate: string,
): void {
  const primaryChannelProduct = getCurrentChannelProduct(channelProducts) || channelProducts[0]
  if (!primaryChannelProduct) return
  const liveRelations = relations.filter((item) => item.sourceObjectType === '直播商品明细')
  const videoRelations = relations.filter((item) => item.sourceObjectType === '短视频记录')
  const aggregate = buildProjectTestingSummaryAggregate(project.projectId, relations, channelProducts)
  const sourceDocCode = buildInlineRecordCode(project.projectCode, 'TEST-SUMMARY')

  upsertProjectInlineNodeRecord({
    recordId: buildInlineRecordId(projectNodeId, sourceDocCode),
    recordCode: sourceDocCode,
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    projectNodeId,
    workItemTypeCode: 'TEST_DATA_SUMMARY',
    workItemTypeName: '测款数据汇总',
    businessDate,
    recordStatus: '已完成',
    ownerId: project.ownerId,
    ownerName: operatorName,
    payload: {
      summaryText,
      totalExposureQty: aggregate.totalExposureQty,
      totalClickQty: aggregate.totalClickQty,
      totalOrderQty: aggregate.totalOrderQty,
      totalGmvAmount: aggregate.totalGmvAmount,
      channelBreakdownLines: aggregate.channelBreakdownLines,
      storeBreakdownLines: aggregate.storeBreakdownLines,
      channelProductBreakdownLines: aggregate.channelProductBreakdownLines,
      testingSourceBreakdownLines: aggregate.testingSourceBreakdownLines,
      currencyBreakdownLines: aggregate.currencyBreakdownLines,
    },
    detailSnapshot: {
      liveRelationIds: liveRelations.map((item) => item.projectRelationId),
      videoRelationIds: videoRelations.map((item) => item.projectRelationId),
      liveRelationCodes: liveRelations.map((item) => item.sourceLineCode || item.sourceObjectCode),
      videoRelationCodes: videoRelations.map((item) => item.sourceObjectCode),
      summaryOwner: operatorName,
      summaryAt: businessDate,
      channelProductId: primaryChannelProduct.channelProductId,
      channelProductCode: primaryChannelProduct.channelProductCode,
      upstreamChannelProductCode: primaryChannelProduct.upstreamChannelProductCode,
      channelProductIds: channelProducts.map((item) => item.channelProductId),
      channelProductCodes: channelProducts.map((item) => item.channelProductCode),
      upstreamChannelProductCodes: channelProducts.map((item) => item.upstreamChannelProductCode).filter(Boolean),
      channelProductCount: channelProducts.length,
      channelBreakdowns: aggregate.channelBreakdowns,
      storeBreakdowns: aggregate.storeBreakdowns,
      channelProductBreakdowns: aggregate.channelProductBreakdowns,
      testingSourceBreakdowns: aggregate.testingSourceBreakdowns,
      currencyBreakdowns: aggregate.currencyBreakdowns,
    },
    sourceModule: '商品项目',
    sourceDocType: '测款汇总记录',
    sourceDocId: `testing_summary_${project.projectId}`,
    sourceDocCode,
    upstreamRefs: [
      ...liveRelations.map((item) => ({
        refModule: '直播测款',
        refType: '直播测款关系',
        refId: item.projectRelationId,
        refCode: item.sourceLineCode || item.sourceObjectCode,
        refTitle: item.sourceTitle,
        refStatus: item.sourceStatus,
      })),
      ...videoRelations.map((item) => ({
        refModule: '短视频测款',
        refType: '短视频测款关系',
        refId: item.projectRelationId,
        refCode: item.sourceObjectCode,
        refTitle: item.sourceTitle,
        refStatus: item.sourceStatus,
      })),
      ...channelProducts.map((channelProduct) => ({
        refModule: '渠道店铺商品',
        refType: '当前渠道店铺商品',
        refId: channelProduct.channelProductId,
        refCode: channelProduct.channelProductCode,
        refTitle: channelProduct.listingTitle,
        refStatus: channelProduct.channelProductStatus,
      })),
    ],
    downstreamRefs: [],
    createdAt: businessDate,
    createdBy: operatorName,
    updatedAt: businessDate,
    updatedBy: operatorName,
    legacyProjectRef: null,
    legacyWorkItemInstanceId: null,
  })
}

function buildTestingConclusionInlineRecord(
  project: NonNullable<ReturnType<typeof getProjectById>>,
  projectNodeId: string,
  payload: ProjectTestingConclusionPayload,
  channelProducts: ProjectChannelProductRecord[],
  summaryRecord: ReturnType<typeof getLatestProjectInlineNodeRecord>,
  branchDetail: {
    invalidatedChannelProductId?: string
    linkedStyleId?: string
    linkedStyleCode?: string
    nextActionType?: string
  },
  downstreamRefs: Array<{
    refModule: string
    refType: string
    refId: string
    refCode: string
    refTitle: string
    refStatus: string
  }>,
  operatorName: string,
  businessDate: string,
): void {
  const primaryChannelProduct = getCurrentChannelProduct(channelProducts) || channelProducts[0]
  if (!primaryChannelProduct) return
  const sourceDocCode = buildInlineRecordCode(project.projectCode, 'TEST-CONCLUSION')

  upsertProjectInlineNodeRecord({
    recordId: buildInlineRecordId(projectNodeId, sourceDocCode),
    recordCode: sourceDocCode,
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    projectNodeId,
    workItemTypeCode: 'TEST_CONCLUSION',
    workItemTypeName: '测款结论判定',
    businessDate,
    recordStatus: '已完成',
    ownerId: project.ownerId,
    ownerName: operatorName,
    payload: {
      conclusion: payload.conclusion,
      conclusionNote: payload.note,
      linkedChannelProductCode: primaryChannelProduct.channelProductCode,
      invalidationPlanned: payload.conclusion !== '通过',
      linkedStyleId: branchDetail.linkedStyleId || '',
      linkedStyleCode: branchDetail.linkedStyleCode || '',
      invalidatedChannelProductId: branchDetail.invalidatedChannelProductId || '',
      nextActionType: branchDetail.nextActionType || '',
    },
    detailSnapshot: {
      summaryRecordId: summaryRecord?.recordId || '',
      summaryRecordCode: summaryRecord?.recordCode || '',
      channelProductId: primaryChannelProduct.channelProductId,
      channelProductCode: primaryChannelProduct.channelProductCode,
      upstreamChannelProductCode: primaryChannelProduct.upstreamChannelProductCode,
      channelProductIds: channelProducts.map((item) => item.channelProductId),
      channelProductCodes: channelProducts.map((item) => item.channelProductCode),
      upstreamChannelProductCodes: channelProducts.map((item) => item.upstreamChannelProductCode).filter(Boolean),
      channelProductCount: channelProducts.length,
      invalidatedChannelProductId: branchDetail.invalidatedChannelProductId || '',
      linkedStyleId: branchDetail.linkedStyleId || '',
      linkedStyleCode: branchDetail.linkedStyleCode || '',
    },
    sourceModule: '商品项目',
    sourceDocType: '测款结论记录',
    sourceDocId: `testing_conclusion_${project.projectId}`,
    sourceDocCode,
    upstreamRefs: [
      ...(summaryRecord
        ? [
            {
              refModule: '测款汇总',
              refType: '测款汇总记录',
              refId: summaryRecord.recordId,
              refCode: summaryRecord.recordCode,
              refTitle: '测款汇总记录',
              refStatus: summaryRecord.recordStatus,
            },
          ]
        : []),
      ...channelProducts.map((channelProduct) => ({
        refModule: '渠道店铺商品',
        refType: '当前渠道店铺商品',
        refId: channelProduct.channelProductId,
        refCode: channelProduct.channelProductCode,
        refTitle: channelProduct.listingTitle,
        refStatus: channelProduct.channelProductStatus,
      })),
    ],
    downstreamRefs,
    createdAt: businessDate,
    createdBy: operatorName,
    updatedAt: businessDate,
    updatedBy: operatorName,
    legacyProjectRef: null,
    legacyWorkItemInstanceId: null,
  })
}

function ensureListingPrerequisites(projectId: string): string | null {
  const prerequisites = [
    { code: 'SAMPLE_CONFIRM', label: '样衣确认' },
    { code: 'SAMPLE_COST_REVIEW', label: '样衣核价' },
    { code: 'SAMPLE_PRICING', label: '样衣定价' },
  ] as const

  for (const item of prerequisites) {
    const node = getProjectNodeRecordByWorkItemTypeCode(projectId, item.code)
    if (node && node.currentStatus !== '已完成') {
      return `${item.label}尚未完成，不能创建渠道店铺商品。`
    }
  }

  return null
}

function replaceRecord(nextRecord: ProjectChannelProductRecord, operatorName = DEMO_OPERATOR): void {
  const snapshot = loadSnapshot()
  persistSnapshot({
    version: STORE_VERSION,
    records: [nextRecord, ...snapshot.records.filter((item) => item.channelProductId !== nextRecord.channelProductId)],
  })
  upsertProjectRelation(buildChannelProductRelation(nextRecord, operatorName))
  const upstreamRelation = buildUpstreamSyncRelation(nextRecord, operatorName)
  if (upstreamRelation) upsertProjectRelation(upstreamRelation)
}

function updateStyleArchiveCreateNode(projectId: string, patch: Partial<Parameters<typeof updateProjectNodeRecord>[2]>) {
  const node = getProjectNodeRecordByWorkItemTypeCode(projectId, 'STYLE_ARCHIVE_CREATE')
  if (!node) return
  updateProjectNodeRecord(projectId, node.projectNodeId, patch, DEMO_OPERATOR)
  syncProjectNodeInstanceRuntime(projectId, node.projectNodeId, DEMO_OPERATOR, String(patch.updatedAt || nowText()))
}

function isClosedProjectNodeStatus(status: string): boolean {
  return status === '已完成' || status === '已取消'
}

function activateProjectNodeByWorkItemTypeCode(
  projectId: string,
  workItemTypeCode: string,
  patch: Partial<Parameters<typeof updateProjectNodeRecord>[2]> & {
    currentStatus?: '进行中' | '待确认'
  },
  operatorName: string,
): void {
  const node = getProjectNodeRecordByWorkItemTypeCode(projectId, workItemTypeCode)
  if (!node || isClosedProjectNodeStatus(node.currentStatus)) return
  updateProjectNodeRecord(
    projectId,
    node.projectNodeId,
    {
      currentStatus: patch.currentStatus || '进行中',
      ...patch,
    },
    operatorName,
  )
}

function activateTestingConclusionDecisionNode(
  projectId: string,
  operatorName: string,
  timestamp: string,
): void {
  activateProjectNodeByWorkItemTypeCode(
    projectId,
    'TEST_CONCLUSION',
    {
      currentStatus: '待确认',
      pendingActionType: '结论判定',
      pendingActionText: '当前待确认：测款结论判定',
      latestResultType: '待结论判定',
      latestResultText: '请确认测款结论：通过或淘汰。',
      updatedAt: timestamp,
    },
    operatorName,
  )
}

function invalidateChannelProductRecord(
  record: ProjectChannelProductRecord,
  input: {
    scenario: ProjectChannelProductScenario
    conclusion: ProjectTestingConclusion
    reason: string
    testingStatusText: string
    upstreamNote: string
  },
  operatorName: string,
): ProjectChannelProductRecord {
  const timestamp = nowText()
  const nextRecord: ProjectChannelProductRecord = {
    ...record,
    scenario: input.scenario,
    conclusion: input.conclusion,
    channelProductStatus: '已作废',
    invalidatedReason: input.reason,
    invalidatedAt: timestamp,
    updatedAt: timestamp,
    upstreamSyncStatus: '无需更新',
    testingStatusText: input.testingStatusText,
    upstreamSyncNote: input.upstreamNote,
    upstreamSyncLog: `${timestamp} ${input.upstreamNote}`,
  }
  replaceRecord(nextRecord, operatorName)
  return nextRecord
}

export function listProjectChannelProducts(): ProjectChannelProductRecord[] {
  ensureDemoState()
  return loadSnapshot().records.map(cloneRecord).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function listProjectChannelProductsByProjectId(projectId: string): ProjectChannelProductRecord[] {
  return listProjectChannelProducts().filter((item) => item.projectId === projectId)
}

export function repairChannelListingNodeInstanceConsistency(operatorName = '系统修复'): void {
  listProjects().forEach((project) => {
    const listingNode = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'CHANNEL_PRODUCT_LISTING')
    if (!listingNode || listingNode.currentStatus !== '进行中') {
      return
    }

    const activeRecords = listValidChannelProducts(listProjectChannelProductsByProjectId(project.projectId))
    if (activeRecords.length > 0) {
      return
    }
    updateProjectNodeRecord(
      project.projectId,
      listingNode.projectNodeId,
      {
        latestResultType: '待创建款式上架批次',
        latestResultText: '当前尚未创建款式上架批次，请先填写规格明细并创建上架批次。',
        pendingActionType: '创建款式上架批次',
        pendingActionText: '请先创建款式上架批次，再上传到渠道。',
        updatedAt: nowText(),
      },
      operatorName,
    )
  })
}

export function getProjectChannelProductById(channelProductId: string): ProjectChannelProductRecord | null {
  return listProjectChannelProducts().find((item) => item.channelProductId === channelProductId) || null
}

export function findProjectChannelProductByStyleId(styleId: string): ProjectChannelProductRecord | null {
  return listProjectChannelProducts().find((item) => item.styleId === styleId) || null
}

export function findProjectChannelProductByLiveLine(
  projectId: string,
  liveLineId: string,
): ProjectChannelProductRecord | null {
  return (
    listProjectChannelProducts()
      .filter((item) => item.projectId === projectId && item.linkedLiveLineId === liveLineId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null
  )
}

export function findProjectChannelProductByVideoRecord(
  projectId: string,
  videoRecordId: string,
): ProjectChannelProductRecord | null {
  return (
    listProjectChannelProducts()
      .filter((item) => item.projectId === projectId && item.linkedVideoRecordId === videoRecordId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null
  )
}

export function buildProjectChannelProductChainSummary(projectId: string): ProjectChannelProductChainSummary | null {
  const project = getProjectById(projectId)
  if (!project) return null
  const records = listProjectChannelProductsByProjectId(projectId)
  const activeRecords = listValidChannelProducts(records)
  const currentRecord = getCurrentChannelProduct(records)
  const style = currentRecord?.styleId ? getStyleArchiveById(currentRecord.styleId) : null
  const styleStatus = style
    ? STYLE_ARCHIVE_STATUS_RULES[resolveStyleArchiveBusinessStatus(style)].label
    : ''
  const linkedVersion = project.linkedTechPackVersionId ? getTechnicalDataVersionById(project.linkedTechPackVersionId) : null
  return {
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    currentChannelProductId: currentRecord?.channelProductId || '',
    currentChannelProductCode: currentRecord?.channelProductCode || '',
    currentChannelProductMainImageId: currentRecord?.listingMainImageId || '',
    currentChannelProductMainImageUrl: currentRecord?.mainImageUrls?.[0] || currentRecord?.listingImages?.[0]?.imageUrl || '',
    currentUpstreamChannelProductCode:
      currentRecord?.upstreamProductId || currentRecord?.upstreamChannelProductCode || '',
    currentChannelProductStatus:
      currentRecord?.listingBatchStatus === '已完成'
        ? '已上架待测款'
        : currentRecord?.listingBatchStatus || currentRecord?.channelProductStatus || '',
    currentUpstreamSyncStatus: currentRecord?.upstreamSyncStatus || '',
    currentUpstreamSyncNote: currentRecord?.upstreamSyncNote || '',
    currentUpstreamSyncTime: currentRecord?.lastUpstreamSyncAt || '',
    linkedStyleId: style?.styleId || currentRecord?.styleId || '',
    linkedStyleCode: style?.styleCode || currentRecord?.styleCode || '',
    linkedStyleName: style?.styleName || currentRecord?.styleName || '',
    linkedStyleStatus: styleStatus,
    linkedTechPackVersionId: linkedVersion?.technicalVersionId || project.linkedTechPackVersionId || '',
    linkedTechPackVersionCode: linkedVersion?.technicalVersionCode || project.linkedTechPackVersionCode || '',
    linkedTechPackVersionLabel: linkedVersion?.versionLabel || project.linkedTechPackVersionLabel || '',
    linkedTechPackVersionStatus: getTechPackVersionStatusText(
      linkedVersion?.versionStatus || project.linkedTechPackVersionStatus || '',
    ),
    currentConclusion: currentRecord?.conclusion || '',
    invalidatedReason: currentRecord?.invalidatedReason || '',
    linkedRevisionTaskCode: currentRecord?.linkedRevisionTaskCode || '',
    canGenerateStyleArchive: Boolean(
      currentRecord &&
        currentRecord.channelProductStatus !== '已作废' &&
        currentRecord.conclusion === '通过',
    ),
    summaryText: buildSummaryText(currentRecord, styleStatus, activeRecords.length),
    channelProducts: records,
  }
}

export function createProjectChannelProductFromListingNode(
  projectId: string,
  payload: ProjectChannelProductListingPayload = {},
  operatorName = '当前用户',
): ProjectChannelProductWriteResult {
  const project = getProjectById(projectId)
  if (!project) {
    return { ok: false, message: '未找到对应商品项目，不能创建渠道店铺商品。', record: null }
  }
  if (project.projectStatus === '已终止') {
    return { ok: false, message: '当前项目已终止，不能创建渠道店铺商品。', record: null }
  }

  const prerequisiteError = ensureListingPrerequisites(projectId)
  if (prerequisiteError) {
    return { ok: false, message: prerequisiteError, record: null }
  }

  const { node: listingNode, message } = getProjectNodeOrMessage(projectId, 'CHANNEL_PRODUCT_LISTING', '商品上架')
  if (!listingNode) {
    return { ok: false, message, record: null }
  }

  const resolvedPayload = resolveListingPayload(projectId, payload)
  const createSpecError = validateChannelListingSpecLinesForCreate(resolvedPayload.specLines)
  if (createSpecError) {
    return { ok: false, message: createSpecError, record: null }
  }
  const uploadSpecError = validateChannelListingSpecLinesForUpload(resolvedPayload.specLines)
  if (uploadSpecError) {
    return { ok: false, message: uploadSpecError, record: null }
  }
  const sequence = nextChannelProductSequence(projectId)
  const channelProductId = buildChannelProductId(project.projectCode, sequence)
  const linkedStyle = project.linkedStyleId ? getStyleArchiveById(project.linkedStyleId) : null
  if (
    project.targetChannelCodes.length > 0 &&
    !project.targetChannelCodes.includes(resolvedPayload.targetChannelCode)
  ) {
    return {
      ok: false,
      message: `当前项目未将 ${resolvedPayload.targetChannelCode} 配置为目标测款渠道，不能直接创建商品上架实例。`,
      record: null,
    }
  }
  const duplicateRecord = findOpenChannelProductByChannelStore(
    projectId,
    resolvedPayload.targetChannelCode,
    resolvedPayload.targetStoreId,
  )
  const channelStoreError = validateListingStoreChannel(
    resolvedPayload.targetChannelCode,
    resolvedPayload.targetStoreId,
  )
  if (channelStoreError) {
    return {
      ok: false,
      message: channelStoreError,
      record: null,
    }
  }
  if (duplicateRecord) {
    return {
      ok: false,
      message: `当前项目在该渠道 / 店铺下已存在有效款式上架批次 ${duplicateRecord.channelProductCode}；同一渠道、同一店铺不能重复创建，请改用其他渠道或店铺继续并行上架。`,
      record: duplicateRecord,
    }
  }
  const channelMeta = getChannelMeta(resolvedPayload.targetChannelCode, resolvedPayload.targetStoreId)
  const timestamp = nowText()
  const channelProductCode = buildChannelProductCode(project.projectCode, sequence)
  const specLines = normalizeChannelListingSpecLines({
    listingBatchId: channelProductId,
    listingBatchCode: channelProductCode,
    projectCode: project.projectCode,
    defaultPriceAmount: resolvedPayload.defaultPriceAmount,
    currencyCode: resolvedPayload.currencyCode,
    specLines: resolvedPayload.specLines,
    resolveProductImage: resolveListingImageAssetSnapshot,
  })
  const migratedListingImages =
    resolvedPayload.listingImageIds.length === 0 &&
    resolvedPayload.listingImages.length === 0 &&
    [...resolvedPayload.mainImageUrls, ...resolvedPayload.detailImageUrls].some(Boolean)
      ? createProjectImageAssetRecords(
          project,
          [...new Set([...resolvedPayload.mainImageUrls, ...resolvedPayload.detailImageUrls].map((item) => item.trim()).filter(Boolean))]
            .map((imageUrl, index) => ({
              imageUrl,
              imageName: `上架图片 ${index + 1}`,
              imageType: '上架图',
              sourceNodeCode: 'CHANNEL_PRODUCT_LISTING',
              sourceRecordId: channelProductId,
              sourceType: '商品上架',
              usageScopes: ['商品上架', '项目资料归档'],
              imageStatus: '可用于上架',
              mainFlag: index === 0,
              sortNo: index + 1,
            })),
          operatorName,
          timestamp,
        )
      : []
  if (migratedListingImages.length > 0) {
    upsertProjectImageAssets(migratedListingImages)
  }
  const listingImages = buildListingImagesFromPayload({
    listingBatchId: channelProductId,
    listingImageIds:
      resolvedPayload.listingImageIds.length > 0
        ? resolvedPayload.listingImageIds
        : migratedListingImages.map((item) => item.imageId),
    listingImages:
      resolvedPayload.listingImages.length > 0
        ? resolvedPayload.listingImages
        : migratedListingImages.map((item, index) => ({
            imageId: item.imageId,
            sortNo: index + 1,
            mainFlag: index === 0,
          })),
    listingMainImageId: resolvedPayload.listingMainImageId || migratedListingImages[0]?.imageId || '',
  })
  const listingMainImageId = deriveListingMainImageId(listingImages)
  const mainImageRecord = listingImages.find((item) => item.imageId === listingMainImageId) || null
  const primarySpec = specLines[0] || null
  const record: ProjectChannelProductRecord = {
    channelProductId,
    channelProductCode,
    listingBatchCode: channelProductCode,
    upstreamChannelProductCode: '',
    upstreamProductId: '',
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    projectNodeId: listingNode.projectNodeId,
    channelCode: resolvedPayload.targetChannelCode,
    channelName: channelMeta.channelName,
    storeId: resolvedPayload.targetStoreId,
    storeName: channelMeta.storeName,
    styleListingTitle: resolvedPayload.listingTitle,
    listingTitle: resolvedPayload.listingTitle,
    listingDescription: resolvedPayload.listingDescription,
    listingPrice: resolvedPayload.defaultPriceAmount,
    defaultPriceAmount: resolvedPayload.defaultPriceAmount,
    currency: resolvedPayload.currencyCode,
    currencyCode: resolvedPayload.currencyCode,
    listingMainImageId,
    listingImageIds: deriveListingImageIds(listingImages),
    listingImageSource: buildListingImageSourceText(listingImages),
    listingImageConfirmedAt: listingImages.length > 0 ? timestamp : '',
    listingImageConfirmedBy: listingImages.length > 0 ? operatorName : '',
    listingImages,
    mainImageUrls: mainImageRecord ? [mainImageRecord.imageUrl] : [],
    detailImageUrls: listingImages
      .filter((item) => item.imageId !== listingMainImageId)
      .map((item) => item.imageUrl),
    listingRemark: resolvedPayload.listingRemark,
    specLines,
    specLineCount: specLines.length,
    uploadedSpecLineCount: 0,
    listingBatchStatus: '待上传',
    uploadResultText: '已创建款式上架批次，待上传到渠道。',
    uploadedAt: '',
    channelProductStatus: '待上传',
    upstreamSyncStatus: '无需更新',
    skuId: primarySpec?.specLineId || '',
    skuCode: primarySpec?.sellerSku || '',
    skuName: [primarySpec?.colorName, primarySpec?.sizeName, primarySpec?.printName].filter(Boolean).join(' / '),
    styleId: linkedStyle?.styleId || '',
    styleCode: linkedStyle?.styleCode || '',
    styleName: linkedStyle?.styleName || '',
    invalidatedReason: '',
    createdAt: timestamp,
    updatedAt: timestamp,
    effectiveAt: '',
    invalidatedAt: '',
    lastUpstreamSyncAt: '',
    scenario: 'MEASURING',
    conclusion: '',
    testingStatusText: '已创建渠道店铺商品，等待发起上架',
    listingInstanceCode: `LIST-${project.projectCode.slice(-7).replace(/-/g, '')}-${sequence}`,
    linkedRevisionTaskId: '',
    linkedRevisionTaskCode: '',
    linkedLiveLineId: '',
    linkedLiveLineCode: '',
    linkedVideoRecordId: '',
    linkedVideoRecordCode: '',
    upstreamSyncNote: '款式上架批次已创建，等待上传到渠道。',
    upstreamSyncResult: '待执行',
    upstreamSyncBy: '',
    upstreamSyncLog: '款式上架批次已创建，等待上传到渠道。',
  }

  replaceRecord(record, operatorName)
  updateProjectCurrentPhase(projectId, 'PHASE_03', operatorName)
  updateProjectNodeRecord(
    projectId,
    listingNode.projectNodeId,
    {
      currentStatus: '进行中',
      latestInstanceId: record.channelProductId,
      latestInstanceCode: record.channelProductCode,
      validInstanceCount: (listingNode.validInstanceCount || 0) + 1,
      latestResultType: '已创建款式上架批次',
      latestResultText: `已创建款式上架批次 ${record.listingBatchCode}，待上传到渠道。`,
      pendingActionType: '上传款式到渠道',
      pendingActionText: '请补齐规格明细并上传款式到渠道。',
      updatedAt: timestamp,
    },
    operatorName,
  )
  syncProjectNodeInstanceRuntime(projectId, listingNode.projectNodeId, operatorName, timestamp)

  return {
    ok: true,
    message: '已创建款式上架批次，待上传到渠道。',
    record,
  }
}

export function launchProjectChannelProductListing(
  channelProductId: string,
  operatorName = '当前用户',
): ProjectChannelProductWriteResult {
  const record = getProjectChannelProductById(channelProductId)
  if (!record) {
    return { ok: false, message: '未找到对应款式上架批次，不能上传到渠道。', record: null }
  }
  if (record.channelProductStatus === '已作废') {
    return { ok: false, message: '当前款式上架批次已作废，不能再次上传到渠道。', record }
  }
  if (record.listingBatchStatus === '已完成') {
    return { ok: false, message: '当前款式上架批次已完成，不需要重复上传。', record }
  }
  const uploadSpecError = validateChannelListingSpecLinesForUpload(record.specLines)
  if (uploadSpecError) {
    return { ok: false, message: uploadSpecError, record }
  }
  const uploadImageError = validateChannelListingImagesForUpload({
    listingImages: record.listingImages || [],
    listingMainImageId: record.listingMainImageId || '',
    getImageAssetById: getProjectImageAssetById,
  })
  if (uploadImageError) {
    return { ok: false, message: uploadImageError, record }
  }

  const timestamp = nowText()
  const upstreamProductId = buildUpstreamCode(
    record.projectCode,
    String(parseSequenceFromChannelProductCode(record.channelProductCode)).padStart(2, '0'),
  )
  const nextSpecLines = cloneChannelListingSpecLines(record.specLines).map((line) => ({
    ...line,
    lineStatus: '已上传',
    upstreamSkuId: buildUploadedUpstreamSkuId(upstreamProductId, line.specLineCode),
    uploadResultText: '已上传到渠道。',
  }))
  const nextRecord: ProjectChannelProductRecord = {
    ...record,
    upstreamProductId,
    upstreamChannelProductCode: upstreamProductId,
    specLines: nextSpecLines,
    uploadedSpecLineCount: nextSpecLines.length,
    listingBatchStatus: '已上传待确认',
    channelProductStatus: '已上传待确认',
    uploadedAt: timestamp,
    uploadResultText: `已上传款式到渠道，已回填 ${nextSpecLines.length} 条规格编号。`,
    listingImageConfirmedAt: timestamp,
    listingImageConfirmedBy: operatorName,
    updatedAt: timestamp,
    testingStatusText: '已上传款式到渠道，待确认完成',
    upstreamSyncStatus: '无需更新',
    upstreamSyncNote: '已上传款式到渠道，请确认后标记商品上架完成。',
    upstreamSyncLog: `${timestamp} 已上传款式到渠道并回填上游款式商品编号与规格编号。`,
  }

  replaceRecord(nextRecord, operatorName)
  const listingNode = getProjectNodeRecordByWorkItemTypeCode(record.projectId, 'CHANNEL_PRODUCT_LISTING')
  if (listingNode) {
    updateProjectNodeRecord(
      record.projectId,
      listingNode.projectNodeId,
      {
      currentStatus: '进行中',
      latestInstanceId: nextRecord.channelProductId,
      latestInstanceCode: nextRecord.channelProductCode,
      latestResultType: '款式已上传到渠道',
      latestResultText: `已回填上游款式商品编号 ${nextRecord.upstreamProductId}，请确认后标记商品上架完成。`,
      pendingActionType: '确认并标记商品上架完成',
      pendingActionText: '请确认上传结果并标记商品上架完成。',
      updatedAt: timestamp,
    },
    operatorName,
  )
  syncProjectNodeInstanceRuntime(record.projectId, listingNode.projectNodeId, operatorName, timestamp)
  }

  return {
    ok: true,
    message: '已上传款式到渠道，请确认后标记商品上架完成。',
    record: nextRecord,
  }
}

export function markProjectChannelProductListingCompleted(
  channelProductId: string,
  operatorName = '当前用户',
): ProjectChannelProductWriteResult {
  const record = getProjectChannelProductById(channelProductId)
  if (!record) {
    return { ok: false, message: '未找到对应款式上架批次，不能标记完成。', record: null }
  }
  if (record.channelProductStatus === '已作废') {
    return { ok: false, message: '当前款式上架批次已作废，不能标记完成。', record }
  }
  if (record.listingBatchStatus === '已完成' || record.channelProductStatus === '已上架待测款') {
    return { ok: false, message: '当前款式上架批次已完成，不需要重复标记。', record }
  }
  if (record.listingBatchStatus !== '已上传待确认') {
    return { ok: false, message: '当前款式尚未成功上传到渠道，不能标记完成。', record }
  }
  if (!record.upstreamProductId) {
    return { ok: false, message: '当前款式尚未回填上游款式商品编号，不能标记完成。', record }
  }
  if (record.specLines.some((item) => !item.upstreamSkuId)) {
    return { ok: false, message: '存在未上传成功的规格，不能标记完成。', record }
  }
  const uploadImageError = validateChannelListingImagesForUpload({
    listingImages: record.listingImages || [],
    listingMainImageId: record.listingMainImageId || '',
    getImageAssetById: getProjectImageAssetById,
  })
  if (uploadImageError) {
    return { ok: false, message: uploadImageError, record }
  }

  const timestamp = nowText()
  const nextRecord: ProjectChannelProductRecord = {
    ...record,
    listingBatchStatus: '已完成',
    channelProductStatus: '已上架待测款',
    updatedAt: timestamp,
    testingStatusText: '已完成上架，正在测款',
    uploadResultText: '商品上架已完成，可进入正式测款。',
    upstreamSyncNote: '商品上架已完成，等待直播或短视频正式测款。',
    upstreamSyncLog: `${timestamp} 已确认商品上架完成。`,
  }

  replaceRecord(nextRecord, operatorName)
  const listingNode = getProjectNodeRecordByWorkItemTypeCode(record.projectId, 'CHANNEL_PRODUCT_LISTING')
  if (listingNode) {
    updateProjectNodeRecord(
      record.projectId,
      listingNode.projectNodeId,
      {
        latestInstanceId: nextRecord.channelProductId,
        latestInstanceCode: nextRecord.channelProductCode,
        latestResultType: '商品上架已完成',
        latestResultText: `款式上架批次 ${nextRecord.listingBatchCode} 已完成，已进入下一工作项。`,
        pendingActionType: '',
        pendingActionText: '',
        updatedAt: timestamp,
      },
      operatorName,
    )
  }

  const result = markProjectNodeCompletedAndUnlockNext(record.projectId, record.projectNodeId, {
    operatorName,
    timestamp,
    resultType: '商品上架已完成',
    resultText: `款式上架批次 ${nextRecord.listingBatchCode} 已完成。`,
  })
  if (!result.ok) {
    return { ok: false, message: result.message, record: nextRecord }
  }
  syncProjectNodeInstanceRuntime(record.projectId, record.projectNodeId, operatorName, timestamp)

  return {
    ok: true,
    message: '商品上架已完成，已进入下一工作项。',
    record: nextRecord,
  }
}

export function completeProjectChannelListingNode(
  projectId: string,
  operatorName = '当前用户',
): ProjectChannelProductWriteResult {
  const project = getProjectById(projectId)
  if (!project) {
    return { ok: false, message: '未找到对应商品项目，不能标记完成。', record: null }
  }

  const { node: listingNode, message } = getProjectNodeOrMessage(projectId, 'CHANNEL_PRODUCT_LISTING', '商品上架')
  if (!listingNode) {
    return { ok: false, message, record: null }
  }

  const effectiveRecords = listProjectChannelProductsByProjectId(projectId)
    .filter((item) => item.projectNodeId === listingNode.projectNodeId)
    .filter(isNodeCompletableChannelProduct)

  if (effectiveRecords.length === 0) {
    return { ok: false, message: '当前尚无已上架商品，不能标记完成。', record: null }
  }

  for (const record of effectiveRecords) {
    if (!record.upstreamProductId) {
      return { ok: false, message: '当前商品尚未上传到渠道，不能标记完成。', record }
    }
    if (!record.specLines.length) {
      return { ok: false, message: '当前尚无已上架商品，不能标记完成。', record }
    }
    if (!hasListingSpecProductImages(record.specLines)) {
      return { ok: false, message: '存在未选择商品图片的规格，不能标记完成。', record }
    }
  }

  const timestamp = nowText()
  let latestRecord = effectiveRecords[0] || null
  effectiveRecords.forEach((record) => {
    if (record.listingBatchStatus === '已上传待确认') {
      const nextRecord: ProjectChannelProductRecord = {
        ...record,
        listingBatchStatus: '已完成',
        channelProductStatus: '已上架待测款',
        updatedAt: timestamp,
        testingStatusText: '已完成上架，正在测款',
        uploadResultText: '商品上架已完成，可进入正式测款。',
        upstreamSyncNote: '商品上架已完成，等待直播或短视频正式测款。',
        upstreamSyncLog: `${timestamp} 已确认商品上架完成。`,
      }
      replaceRecord(nextRecord, operatorName)
      latestRecord = nextRecord
    }
  })

  const flowResult = markProjectNodeCompletedAndUnlockNext(projectId, listingNode.projectNodeId, {
    operatorName,
    timestamp,
    resultType: '商品上架已完成',
    resultText: '商品上架已完成。',
  })

  if (!flowResult.ok) {
    return { ok: false, message: flowResult.message, record: latestRecord }
  }

  updateProjectNodeRecord(
    projectId,
    listingNode.projectNodeId,
    {
      latestResultType: '商品上架已完成',
      latestResultText: '商品上架已完成。',
      pendingActionType: '',
      pendingActionText: '',
      updatedAt: timestamp,
    },
    operatorName,
  )
  syncProjectNodeInstanceRuntime(projectId, listingNode.projectNodeId, operatorName, timestamp)

  return {
    ok: true,
    message: '商品上架已完成，已进入下一工作项。',
    record: latestRecord,
  }
}

export function submitProjectTestingSummary(
  projectId: string,
  payload: ProjectTestingSummaryPayload = {},
  operatorName = '当前用户',
): ProjectChannelProductWriteResult {
  const project = getProjectById(projectId)
  if (!project) {
    return { ok: false, message: '未找到对应商品项目，不能提交测款汇总。', record: null }
  }
  const targetRecords = listLaunchReadyChannelProducts(listProjectChannelProductsByProjectId(projectId))
  const primaryRecord = getCurrentChannelProduct(targetRecords)
  if (!primaryRecord) {
    return { ok: false, message: '当前项目尚未完成商品上架，不能提交测款汇总。', record: null }
  }

  const { node: summaryNode, message } = getProjectNodeOrMessage(projectId, 'TEST_DATA_SUMMARY', '测款数据汇总')
  if (!summaryNode) {
    return { ok: false, message, record: primaryRecord }
  }

  const relations = getFormalTestingRelations(projectId)
  if (relations.length === 0) {
    return { ok: false, message: '当前项目尚未建立正式直播或短视频测款关系，不能提交测款汇总。', record: primaryRecord }
  }

  const liveCount = relations.filter((item) => item.sourceObjectType === '直播商品明细').length
  const videoCount = relations.filter((item) => item.sourceObjectType === '短视频记录').length
  const aggregate = buildProjectTestingSummaryAggregate(projectId, relations, targetRecords)
  const summaryText =
    payload.summaryText?.trim() ||
    `已汇总 ${relations.length} 条正式测款记录，其中直播 ${liveCount} 条，短视频 ${videoCount} 条，覆盖 ${aggregate.channelBreakdowns.length} 个渠道、${aggregate.storeBreakdowns.length} 个店铺、${targetRecords.length} 个渠道店铺商品实例。`
  const timestamp = nowText()
  const testingLinkPatch = buildTestingLinkPatch(relations)
  const nextRecords = targetRecords.map((record) => {
    const nextRecord: ProjectChannelProductRecord = {
      ...record,
      ...testingLinkPatch,
      updatedAt: timestamp,
      testingStatusText: '已提交测款汇总，等待确认最终结论',
      upstreamSyncNote: summaryText,
      upstreamSyncLog: `${timestamp} ${summaryText}`,
    }
    replaceRecord(nextRecord, operatorName)
    return nextRecord
  })
  const latestRecord = getCurrentChannelProduct(nextRecords) || nextRecords[0]
  updateProjectNodeRecord(
    projectId,
    summaryNode.projectNodeId,
    {
      currentStatus: '已完成',
      latestInstanceId: latestRecord.channelProductId,
      latestInstanceCode: latestRecord.channelProductCode,
      latestResultType: '已完成测款汇总',
      latestResultText: summaryText,
      pendingActionType: '提交测款结论',
      pendingActionText: '请根据正式测款汇总提交最终测款结论。',
      updatedAt: timestamp,
    },
    operatorName,
  )
  buildTestingSummaryInlineRecord(project, summaryNode.projectNodeId, summaryText, relations, nextRecords, operatorName, timestamp)
  syncProjectNodeInstanceRuntime(projectId, summaryNode.projectNodeId, operatorName, timestamp)
  activateTestingConclusionDecisionNode(projectId, operatorName, timestamp)

  return {
    ok: true,
    message: '已提交测款汇总。',
    record: latestRecord,
    relationCount: relations.length,
    summaryText,
  }
}

export function generateProjectTestingSummaryFromRelations(
  projectId: string,
  operatorName = '当前用户',
): ProjectChannelProductWriteResult {
  return submitProjectTestingSummary(projectId, {}, operatorName)
}

export function submitProjectTestingConclusion(
  projectId: string,
  payload: ProjectTestingConclusionPayload,
  operatorName = '当前用户',
): ProjectChannelProductWriteResult {
  if (payload.conclusion !== '通过' && payload.conclusion !== '淘汰') {
    return { ok: false, message: '测款结论判定只允许选择通过或淘汰。', record: null }
  }

  const project = getProjectById(projectId)
  if (!project) {
    return { ok: false, message: '未找到对应商品项目，不能提交测款结论。', record: null }
  }
  const targetRecords = listTestingConclusionTargetRecords(listProjectChannelProductsByProjectId(projectId))
  const primaryRecord = getCurrentChannelProduct(targetRecords)
  if (!primaryRecord) {
    return { ok: false, message: '当前项目尚未完成商品上架，不能提交测款结论。', record: null }
  }

  const { node: conclusionNode, message } = getProjectNodeOrMessage(projectId, 'TEST_CONCLUSION', '测款结论判定')
  if (!conclusionNode) {
    return { ok: false, message, record: primaryRecord }
  }

  const relations = getFormalTestingRelations(projectId)
  if (relations.length === 0) {
    return { ok: false, message: '当前项目尚未建立正式测款关系，不能提交测款结论。', record: primaryRecord }
  }

  const note = payload.note.trim() || `测款结论为${payload.conclusion}。`
  const testingLinkPatch = buildTestingLinkPatch(relations)
  const timestamp = nowText()
  const summaryNode = getProjectNodeRecordByWorkItemTypeCode(projectId, 'TEST_DATA_SUMMARY')
  const summaryRecord = summaryNode ? getLatestProjectInlineNodeRecord(summaryNode.projectNodeId) : null

  if (payload.conclusion === '通过') {
    const nextRecords = targetRecords.map((record) => {
      const nextRecord: ProjectChannelProductRecord = {
        ...record,
        ...testingLinkPatch,
        scenario: 'MEASURING',
        conclusion: '通过',
        invalidatedReason: '',
        updatedAt: timestamp,
        testingStatusText: '测款通过，等待显式生成款式档案',
        upstreamSyncNote: note,
        upstreamSyncLog: `${timestamp} ${note}`,
      }
      replaceRecord(nextRecord, operatorName)
      return nextRecord
    })
    const latestRecord = getCurrentChannelProduct(nextRecords) || nextRecords[0]
    updateProjectCurrentPhase(projectId, 'PHASE_04', operatorName)
    updateProjectNodeRecord(
      projectId,
      conclusionNode.projectNodeId,
      {
        latestInstanceId: latestRecord.channelProductId,
        latestInstanceCode: latestRecord.channelProductCode,
        latestResultType: '测款通过',
        latestResultText: note,
        pendingActionType: '生成款式档案',
        pendingActionText:
          nextRecords.length > 1
            ? `请显式执行生成款式档案操作，并为当前 ${nextRecords.length} 个渠道店铺商品实例建立三码关联。`
            : '请显式执行生成款式档案操作，并建立三码关联。',
        updatedAt: timestamp,
      },
      operatorName,
    )
    updateStyleArchiveCreateNode(projectId, {
      currentStatus: '进行中',
      latestResultType: '等待生成款式档案',
      latestResultText: '测款通过，已解锁款式档案生成。',
      pendingActionType: '生成款式档案',
      pendingActionText:
        nextRecords.length > 1
          ? `请确认后生成款式档案壳，并保留当前 ${nextRecords.length} 个渠道店铺商品实例链路。`
          : '请确认后生成款式档案壳，并保留当前渠道店铺商品链路。',
      updatedAt: timestamp,
    })
    buildTestingConclusionInlineRecord(
      project,
      conclusionNode.projectNodeId,
      payload,
      nextRecords,
      summaryRecord,
      {
        linkedStyleId: latestRecord.styleId || project.linkedStyleId || '',
        linkedStyleCode: latestRecord.styleCode || project.linkedStyleCode || '',
        nextActionType: '生成款式档案',
      },
      [],
      operatorName,
      timestamp,
    )
    try {
      completeDecisionNodeWithResult(projectId, conclusionNode.projectNodeId, '通过', operatorName, note, timestamp)
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : '测款结论流转失败。',
        record: latestRecord,
      }
    }
    return {
      ok: true,
      message:
        nextRecords.length > 1
          ? `已提交测款通过结论，当前 ${nextRecords.length} 个渠道店铺商品实例可关联同一款式档案。`
          : '已提交测款通过结论，当前可生成款式档案。',
      record: latestRecord,
    }
  }

  const nextRecords = targetRecords.map((record) =>
    invalidateChannelProductRecord(
      { ...record, ...testingLinkPatch },
      {
        scenario: 'FAILED_ELIMINATED',
        conclusion: '淘汰',
        reason: note,
        testingStatusText: '测款结论为淘汰，当前渠道店铺商品已作废',
        upstreamNote: '测款结论为淘汰，当前项目进入样衣退回处理。',
      },
      operatorName,
    ),
  )
  const latestRecord = getCurrentChannelProduct(nextRecords) || nextRecords[0]
  updateProjectNodeRecord(
    projectId,
    conclusionNode.projectNodeId,
    {
      latestInstanceId: latestRecord.channelProductId,
      latestInstanceCode: latestRecord.channelProductCode,
      latestResultType: '测款淘汰',
      latestResultText: note,
      pendingActionType: '样衣退回处理',
      pendingActionText: '请完成样衣退回处理。',
      updatedAt: timestamp,
    },
    operatorName,
  )
  buildTestingConclusionInlineRecord(
    project,
    conclusionNode.projectNodeId,
    payload,
    nextRecords,
    summaryRecord,
      {
        invalidatedChannelProductId: latestRecord.channelProductId,
        nextActionType: '样衣退回处理',
      },
    nextRecords.map((nextRecord) => ({
      refModule: '渠道店铺商品',
      refType: '已作废渠道店铺商品',
      refId: nextRecord.channelProductId,
      refCode: nextRecord.channelProductCode,
      refTitle: nextRecord.listingTitle,
      refStatus: nextRecord.channelProductStatus,
    })),
    operatorName,
    timestamp,
  )
  try {
    completeDecisionNodeWithResult(projectId, conclusionNode.projectNodeId, '淘汰', operatorName, note, timestamp)
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : '测款结论流转失败。',
      record: latestRecord,
    }
  }
  return {
    ok: true,
    message:
      nextRecords.length > 1
        ? `已提交淘汰结论，已作废 ${nextRecords.length} 个渠道店铺商品实例，当前项目已进入样衣退回处理。`
        : '已提交淘汰结论，当前项目已进入样衣退回处理。',
    record: latestRecord,
  }
}

export function invalidateProjectChannelProduct(
  channelProductId: string,
  operatorName = '当前用户',
): ProjectChannelProductWriteResult {
  const record = getProjectChannelProductById(channelProductId)
  if (!record) {
    return { ok: false, message: '未找到对应渠道店铺商品，不能执行作废。', record: null }
  }
  if (record.channelProductStatus === '已作废') {
    return { ok: false, message: '当前渠道店铺商品已作废，不需要重复处理。', record }
  }
  if (record.styleId) {
    return { ok: false, message: '当前渠道店铺商品已关联款式档案，不能直接作废。', record }
  }

  const nextRecord = invalidateChannelProductRecord(
    record,
    {
      scenario: 'HISTORY_INVALIDATED',
      conclusion: record.conclusion || '',
      reason: '已由当前用户手动作废当前渠道店铺商品。',
      testingStatusText: '渠道店铺商品已手动作废，需重新创建渠道店铺商品后才能继续。',
      upstreamNote: '已手动作废当前渠道店铺商品，停止后续测款与上游更新。',
    },
    operatorName,
  )
  const listingNode = getProjectNodeRecordByWorkItemTypeCode(record.projectId, 'CHANNEL_PRODUCT_LISTING')
  if (listingNode) {
    updateProjectNodeRecord(
      record.projectId,
      listingNode.projectNodeId,
      {
        currentStatus: '进行中',
        latestInstanceId: nextRecord.channelProductId,
        latestInstanceCode: nextRecord.channelProductCode,
        latestResultType: '已作废',
        latestResultText: '已手动作废当前渠道店铺商品。',
        pendingActionType: '重新创建渠道店铺商品',
        pendingActionText: '请重新创建渠道店铺商品并发起上架后再进入测款。',
        updatedAt: nextRecord.updatedAt,
      },
      operatorName,
    )
    syncProjectNodeInstanceRuntime(record.projectId, listingNode.projectNodeId, operatorName, nextRecord.updatedAt)
  }
  return { ok: true, message: `已作废渠道店铺商品 ${nextRecord.channelProductCode}。`, record: nextRecord }
}

export function bindStyleArchiveToProjectChannelProduct(
  projectId: string,
  input: {
    styleId: string
    styleCode: string
    styleName: string
  },
  operatorName = '当前用户',
): ProjectChannelProductRecord | null {
  const targetRecords = listValidChannelProducts(listProjectChannelProductsByProjectId(projectId))
  if (targetRecords.length === 0) return null
  const timestamp = nowText()
  const nextRecords = targetRecords.map((currentRecord) => {
    const nextRecord: ProjectChannelProductRecord = {
      ...currentRecord,
      scenario: 'STYLE_PENDING_TECH',
      conclusion: currentRecord.conclusion || '通过',
      styleId: input.styleId,
      styleCode: input.styleCode,
      styleName: input.styleName,
      channelProductStatus: '已生效',
      upstreamSyncStatus: '待更新',
      effectiveAt: timestamp,
      updatedAt: timestamp,
      testingStatusText: '测款通过，已生成款式档案，待启用技术包',
      upstreamSyncNote: '款式档案已建立，待技术包启用后更新上游商品。',
      upstreamSyncLog: '款式档案已建立，待技术包启用后更新上游商品。',
    }
    replaceRecord(nextRecord, operatorName)
    return nextRecord
  })
  const styleRelation = buildStyleRelation(projectId, input.styleId, operatorName)
  if (styleRelation) upsertProjectRelation(styleRelation)
  return getCurrentChannelProduct(nextRecords) || nextRecords[0]
}

export function markProjectChannelProductConclusion(
  projectId: string,
  conclusion: '淘汰',
  operatorName = '当前用户',
): ProjectChannelProductRecord | null {
  const targetRecords = listValidChannelProducts(listProjectChannelProductsByProjectId(projectId))
  if (targetRecords.length === 0) return null
  const timestamp = nowText()
  const nextRecords = targetRecords.map((currentRecord) => {
    const nextRecord: ProjectChannelProductRecord = {
      ...currentRecord,
      scenario: 'FAILED_ELIMINATED',
      conclusion,
      channelProductStatus: '已作废',
      invalidatedReason: `测款结论为${conclusion}，当前渠道店铺商品已作废。`,
      invalidatedAt: timestamp,
      updatedAt: timestamp,
      testingStatusText: '测款结论为淘汰，当前渠道店铺商品已作废',
      upstreamSyncNote: '测款未通过，停止后续渠道更新。',
      upstreamSyncLog: `测款结论为${conclusion}，停止后续渠道更新。`,
    }
    replaceRecord(nextRecord, operatorName)
    return nextRecord
  })
  return getCurrentChannelProduct(nextRecords) || nextRecords[0]
}

export function syncProjectChannelProductAfterTechPackActivation(
  styleId: string,
  technicalVersion: {
    technicalVersionId: string
    technicalVersionCode: string
    versionLabel: string
  },
  operatorName = '当前用户',
): ProjectChannelProductRecord | null {
  const currentRecords = listProjectChannelProducts().filter((item) => item.styleId === styleId)
  if (currentRecords.length === 0) return null
  const timestamp = nowText()
  const nextRecords = currentRecords.map((currentRecord) => {
    const nextRecord: ProjectChannelProductRecord = {
      ...currentRecord,
      scenario: 'STYLE_ACTIVE',
      upstreamSyncStatus: '已更新',
      lastUpstreamSyncAt: timestamp,
      updatedAt: timestamp,
      testingStatusText: '测款通过，已关联款式档案并完成上游最终更新',
      upstreamSyncResult: '成功',
      upstreamSyncBy: operatorName,
      upstreamSyncNote: '技术包已启用，已完成上游最终更新。',
      upstreamSyncLog: `${timestamp} 已将 ${technicalVersion.technicalVersionCode} ${technicalVersion.versionLabel} 同步到上游渠道商品。`,
    }
    replaceRecord(nextRecord, operatorName)
    return nextRecord
  })
  return getCurrentChannelProduct(nextRecords) || nextRecords[0]
}

export function resetProjectChannelProductRepository(): void {
  demoStateApplied = false
  const snapshot = seedSnapshot()
  persistSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  }
}

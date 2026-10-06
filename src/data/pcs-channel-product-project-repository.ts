/** 既有测款消费者的渠道投影适配器。唯一持久事实在 pcs-channel-catalog。 */
import { getChannelListing, listChannelListings, listChannelVariants, getPcsChannelCatalogSnapshot, resetPcsChannelCatalogCache, resolveChannelPrice } from './pcs-channel-catalog.ts'
import { getChannelStore, channelLabel } from './pcs-channel-store-repository.ts'
import { getStyleArchiveById } from './pcs-style-archive-repository.ts'
import { getSkuArchiveById } from './pcs-sku-archive-repository.ts'
import type { PcsProjectChannelProductRecord } from './pcs-project-domain-contract.ts'
import type { ProjectRelationRecord } from './pcs-project-relation-types.ts'
import type { ChannelListingImageInput } from './pcs-channel-listing-image-types.ts'
import type { ChannelListingSpecLineInput } from './pcs-channel-listing-spec-types.ts'
import type { ChannelListing } from './pcs-channel-catalog-types.ts'
export type ProjectChannelProductScenario =
  | 'MEASURING'
  | 'FAILED_ADJUST'
  | 'FAILED_PAUSED'
  | 'FAILED_ELIMINATED'
  | 'STYLE_PENDING_TECH'
  | 'STYLE_ACTIVE'
  | 'HISTORY_INVALIDATED'

export type ProjectTestingConclusion = '' | '通过' | '不通过' | '暂保留'
export type UpstreamSyncResult = '待执行' | '成功' | '失败'

export interface ProjectChannelProductRecord extends PcsProjectChannelProductRecord {
  sourceTestingOrderId?: string
  scenario: ProjectChannelProductScenario
  conclusion: ProjectTestingConclusion
  testingStatusText: string
  listingInstanceCode: string
  linkedDesignRevisionTaskId: string
  linkedDesignRevisionTaskCode: string
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
  linkedDesignRevisionTaskCode: string
  summaryText: string
  channelProducts: ProjectChannelProductRecord[]
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
  productPositioningConclusion?: string
  stockGrade?: string
  holdDecisionFlag?: boolean
  downShelfFlag?: boolean
  returnDestination?: string
  revisitDate?: string
}

export interface ProjectChannelProductWriteResult {
  ok: boolean
  message: string
  record: ProjectChannelProductRecord | null
  relationCount?: number
  summaryText?: string
}


export interface ProjectChannelProductRelationBootstrapSnapshot { relations: ProjectRelationRecord[]; records: ProjectChannelProductRecord[] }
function projectListing(listing: ChannelListing): ProjectChannelProductRecord {
  const snapshot = getPcsChannelCatalogSnapshot(), style = getStyleArchiveById(listing.styleId), store = getChannelStore(listing.storeId)!, variants = listChannelVariants(listing.id), sku = variants[0] && getSkuArchiveById(variants[0].internalSkuId), operation = snapshot.syncOperations.filter(o => o.listingId === listing.id).at(-1)
  const price = variants[0] ? resolveChannelPrice(variants[0], 'regular', new Date().toISOString(), snapshot).amount || 0 : 0
  const published = listing.platformStatus === '在售'
  return {
    channelProductId: listing.id, channelProductCode: listing.id, listingBatchCode: operation?.id || '', upstreamChannelProductCode: listing.platformProductId, upstreamProductId: listing.platformProductId,
    channelCode: store.channelCode, channelName: channelLabel(store.channelCode), storeId: store.id, storeName: store.storeName,
    skuId: sku?.skuId || '', skuCode: sku?.skuCode || '', skuName: sku?.skuName || '', styleListingTitle: style?.styleName || '', listingTitle: listing.content.title, listingDescription: listing.content.description,
    listingPrice: price, defaultPriceAmount: price, currency: store.salesCurrency, currencyCode: store.salesCurrency, listingMainImageId: listing.content.media.find(m => m.role === '主图')?.id || '', listingImageIds: listing.content.media.map(m => m.id), listingImageSource: '渠道内容', listingImageConfirmedAt: listing.updatedAt, listingImageConfirmedBy: listing.updatedBy,
    listingImages: listing.content.media.map(m => ({ listingImageId: `${listing.id}:${m.id}`, listingBatchId: listing.id, imageId: m.id, imageUrl: m.url, imageName: m.name, sortNo: m.sort, mainFlag: m.role === '主图', sourceType: '上架补充图' })), mainImageUrls: listing.content.media.filter(m => m.role === '主图').map(m => m.url), detailImageUrls: listing.content.media.filter(m => m.role === '详情图').map(m => m.url), listingRemark: listing.remark,
    specLines: variants.map(v => ({ specLineId: v.id, specLineCode: v.id, listingBatchId: listing.id, productImageId: v.imageId, productImageUrl: v.imageUrl, productImageName: v.sellerSku, colorName: v.displayColor, sizeName: v.displaySize, printName: v.displayPattern, sellerSku: v.sellerSku, priceAmount: resolveChannelPrice(v, 'regular', new Date().toISOString(), snapshot).amount || 0, currencyCode: store.salesCurrency, lineStatus: v.platformVariantId ? '已上传' : '待上传', upstreamSkuId: v.platformVariantId, internalSkuId: v.internalSkuId, uploadResultText: operation ? `演示回执：${operation.result}` : '尚未提交' })),
    specLineCount: variants.length, uploadedSpecLineCount: variants.filter(v => v.platformVariantId).length, listingBatchStatus: published ? '已完成' : '待上传', uploadResultText: operation ? `演示回执：${operation.result}` : '尚未提交', uploadedAt: listing.lastSuccessAt, channelProductStatus: published ? '已上架待测款' : listing.platformStatus === '已删除' ? '已作废' : '待上传', upstreamSyncStatus: listing.syncStatus === '一致' ? '无需更新' : '待更新', styleId: listing.styleId, styleCode: style?.styleCode || '', styleName: style?.styleName || '', invalidatedReason: '', createdAt: listing.createdAt, updatedAt: listing.updatedAt, effectiveAt: listing.lastSuccessAt, invalidatedAt: '', lastUpstreamSyncAt: listing.lastSuccessAt,
    sourceTestingOrderId: listing.sourceTestingOrderId, scenario: 'MEASURING', conclusion: '', testingStatusText: listing.sourceTestingOrderId ? '关联测款单' : '独立渠道商品', listingInstanceCode: listing.id, linkedDesignRevisionTaskId: '', linkedDesignRevisionTaskCode: '', linkedLiveLineId: '', linkedLiveLineCode: '', linkedVideoRecordId: '', linkedVideoRecordCode: '', upstreamSyncNote: operation ? `演示回执：${operation.result}` : '待平台分配外部身份', upstreamSyncResult: listing.syncStatus === '一致' ? '成功' : listing.syncStatus === '失败' ? '失败' : '待执行', upstreamSyncBy: listing.updatedBy, upstreamSyncLog: listing.lastSuccessAt,
  }
}
export function listProjectChannelProducts(): ProjectChannelProductRecord[] { return listChannelListings(true).map(projectListing) }
export function listProjectChannelProductsSnapshot(): ProjectChannelProductRecord[] { return listProjectChannelProducts() }
export function getProjectChannelProductById(id: string): ProjectChannelProductRecord | null { const listing = getChannelListing(id); return listing ? projectListing(listing) : null }
export function findProjectChannelProductByStyleId(id: string): ProjectChannelProductRecord | null { return listProjectChannelProducts().find(l => l.styleId === id) || null }
export function listProjectChannelProductsByProjectId(_id: string): ProjectChannelProductRecord[] { return [] }
export function findProjectChannelProductByLiveLine(_projectId: string, _liveLineId: string): ProjectChannelProductRecord | null { return null }
export function findProjectChannelProductByVideoRecord(_projectId: string, _videoId: string): ProjectChannelProductRecord | null { return null }
export function buildProjectChannelProductChainSummary(_id: string): ProjectChannelProductChainSummary | null { return null }
export function ensureProjectChannelProductDemoStateReady(): void { getPcsChannelCatalogSnapshot() }
export function createProjectChannelProductRelationBootstrapSnapshot(..._args: unknown[]): ProjectChannelProductRelationBootstrapSnapshot { return { relations: [], records: [] } }
export function repairChannelListingNodeInstanceConsistency(_actor = ''): void { /* 项目节点不再是渠道商品的事实来源。 */ }
export function resetProjectChannelProductRepository(): void { resetPcsChannelCatalogCache() }
const retired = (): ProjectChannelProductWriteResult => ({ ok: false, message: '此项目式入口已停用，请从渠道店铺商品或测款单的渠道上架入口操作。', record: null })
export function createProjectChannelProductFromListingNode(_id: string, _payload: ProjectChannelProductListingPayload = {}, _actor = ''): ProjectChannelProductWriteResult { return retired() }
export function completeProjectChannelListingNode(_id: string, _actor = ''): ProjectChannelProductWriteResult { return retired() }
export function submitProjectTestingSummary(_id: string, _payload: ProjectTestingSummaryPayload = {}, _actor = ''): ProjectChannelProductWriteResult { return retired() }
export function generateProjectTestingSummaryFromRelations(_id: string, _actor = ''): ProjectChannelProductWriteResult { return retired() }
export function submitProjectTestingConclusion(_id: string, _payload: ProjectTestingConclusionPayload, _actor = ''): ProjectChannelProductWriteResult { return retired() }
export function markProjectChannelProductConclusion(_id: string, _conclusion: '不通过', _actor = ''): ProjectChannelProductRecord | null { return null }
export function syncProjectChannelProductAfterTechPackActivation(styleId: string, _version: { technicalVersionId: string; technicalVersionCode: string; versionLabel: string }, _actor = ''): ProjectChannelProductRecord | null { return findProjectChannelProductByStyleId(styleId) }
export function getProjectTestingSummaryAggregate(_id: string): ProjectTestingSummaryAggregate { return { liveRelationIds: [], liveRelationCodes: [], videoRelationIds: [], videoRelationCodes: [], totalExposureQty: 0, totalClickQty: 0, totalOrderQty: 0, totalGmvAmount: 0, channelBreakdownLines: [], storeBreakdownLines: [], channelProductBreakdownLines: [], testingSourceBreakdownLines: [], currencyBreakdownLines: [], channelBreakdowns: [], storeBreakdowns: [], channelProductBreakdowns: [], testingSourceBreakdowns: [], currencyBreakdowns: [] } }
export function createTestingOrderChannelProducts(_input: { testingOrderId: string; styleId: string; skuCodes: string[]; channelCodes: string[]; channelPrices: Record<string, number>; actor: string }): ProjectChannelProductRecord[] {
  throw new Error('按渠道默认选店并自动上架的旧入口已停用。请从测款单选择具体店铺与同款 PID。')
}

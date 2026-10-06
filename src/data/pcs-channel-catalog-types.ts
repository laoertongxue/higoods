/** PCS 渠道经营契约。内部款式和 SKU 只引用，不复制其身份、库存或采购事实。 */
export type ChannelCode = 'tiktok' | 'shopify' | 'independent-site' | 'shopee' | 'lazada' | 'shopxo' | 'shopline'
export type ChannelReviewStatus = '草稿' | '待审核' | '审核通过'
export type ChannelPlatformStatus = '未发布' | '未取得状态' | '待平台审核' | '在售' | '已下架' | '平台限制' | '已删除'
export type ChannelSyncStatus = '待同步' | '同步中' | '一致' | '失败' | '同时变更待处理' | '结果待核实'
export type ChannelPriceType = 'retail' | 'regular' | 'live' | 'wholesale' | 'clearance'
export const CHANNEL_PRICE_LABELS: Record<ChannelPriceType, string> = { retail: '吊牌价', regular: '日常售价', live: '直播价', wholesale: '批发价', clearance: '清仓价' }
export interface ChannelPlatformTemplate {
  version: number; requiredFields: Array<'platformCategoryId' | 'platformBrandId' | 'handle'>
  requiredMediaRoles?: ChannelMedia['role'][]; requiredVariantFields?: Array<'sellerSku' | 'displayColor' | 'displaySize' | 'displayPattern' | 'imageId'>; requiredVariantAttributes?: string[]
  requiredAttributes: string[]; categoryMappings: Record<string, string>; brandMappings: Record<string, string>
  attributeMappings: Record<string, string>; defaultBrandId: string; defaultAttributes: Record<string, string>; attributeUnits: Record<string, string>
}
export interface ChannelBaseContentReference { id: string; styleId: string; language: string; version: number | null; source: '销售内容' | '历史基础资料'; styleUpdatedAt: string }
export interface ChannelStore {
  id: string; storeCode: string; storeName: string; channelCode: ChannelCode; externalStoreId: string
  marketCode: string; salesCurrency: string; settlementCurrency: string; languageCode: string; timeZone: string
  teamId: string; ownerId: string; operatingStatus: '启用' | '停用'; inventorySource: 'WMS_SHARED'
  connectionDescription: string; allowListing: boolean; defaultCategoryId: string; handlingDays: number
  legacyAliases: string[]; version: number; createdAt: string; updatedAt: string; updatedBy: string
  platformTemplate?: ChannelPlatformTemplate
}
export interface ChannelMedia { id: string; url: string; name: string; role: '主图' | '详情图' | '尺码图' | '视频'; sort: number; fileId?: string; sourceVersion?: string }
export interface ChannelContent {
  title: string; description: string; languageCode: string; sellingPoints: string; handle: string; platformCategoryId: string; platformBrandId: string
  platformAttributes: Record<string, string>; platformAttributeSchemaVersion?: string; platformAttributeUnits?: Record<string,string>; translations: Array<{ language: string; title: string; description: string }>
  media: ChannelMedia[]; sizeChartSourceVersion: string
}
export interface ChannelListing {
  id: string; storeId: string; styleId: string; platformProductId: string; content: ChannelContent
  contentVersion: number; version: number; reviewStatus: ChannelReviewStatus; approvedVersion: number | null
  platformStatus: ChannelPlatformStatus; platformRawStatus: string; platformObservedAt?: string; syncStatus: ChannelSyncStatus; lastSuccessAt: string
  sourceTestingOrderId: string; testingListingActionId: string; sourceIdentity: string; contentOverrides: string[]
  baseStyleVersion: string; publishedContent?: ChannelContent; createdAt: string; updatedAt: string; updatedBy: string
  baseContentReference?: ChannelBaseContentReference
  remark: string
  testingReferences?: Array<{ id: string; testingOrderId: string; testingListingActionId: string; at: string }>
}
export interface ChannelMappingHistory { version: number; internalSkuId: string; effectiveAt: string; reason: string; actor: string }
export interface ChannelVariant {
  id: string; listingId: string; platformVariantId: string; sellerSku: string; internalSkuId: string
  displayColor: string; displaySize: string; displayPattern: string; platformAttributeValues: Record<string, string>; platformAttributeUnits?: Record<string,string>; platformAttributeSchemaVersion?: string
  imageId: string; imageUrl: string; mappingVersion: number; mappingEffectiveAt: string; mappingReason: string
  mappingHistory: ChannelMappingHistory[]; defaultPriceGroupId: string; active: boolean; version: number
}
export interface ChannelPrice {
  id: string; storeId: string; internalSkuId: string; externalVariantId: string; priceType: ChannelPriceType
  amount: number | null; currency: string; mode: '默认' | '覆盖'; validFrom: string; validTo: string
  origin: 'PCS' | '平台' | '导入' | '演示'; version: number; updatedAt: string
}
export interface ChannelSyncItem {
  targetId: string; field: string; submittedValue: unknown; baseValue: unknown; fieldVersion: number
  result: '待回执' | '成功' | '失败' | '不支持' | '已过期' | '结果待核实'; error: string
  observedValue?: unknown; platformVariantId?: string
}
export interface ChannelSyncConflict { targetId: string; field: string; baseValue: unknown; pcsValue: unknown; platformValue: unknown; pcsVersion: number; pcsAt?: string; platformEventId: string; platformAt: string }
export interface ChannelSyncReceiptSnapshot {
  eventId: string; receivedAt: string; platformProductId: string; platformStatus?: ChannelPlatformStatus; rawStatus: string; unknown: boolean
  items: Array<{ targetId: string; field: string; success: boolean; error?: string; platformVariantId?: string; value?: unknown }>
}
export interface ChannelSyncOperation {
  id: string; listingId: string; targetVariantIds: string[]; action: '发布' | '更新' | '下架' | '重新同步' | '平台变更' | '共享可售' | '核实结果'
  direction: 'PCS→平台' | '平台→PCS' | 'WMS→平台'; fieldScope: string[]; baseVersion: number; submittedVersion: number
  sourceEventId: string; result: '提交中' | '成功' | '部分成功' | '失败' | '结果待核实' | '同时变更待处理' | '已过期'
  items: ChannelSyncItem[]; conflicts: ChannelSyncConflict[]; errorReason: string; startedAt: string; completedAt: string
  parentOperationId: string; demo: boolean; observedAvailability?: Array<{ externalVariantId: string; quantity: number; unit: string; internalSkuId: string }>
  wmsSourceRef?: string; attempt: number; processedEventIds: string[]
  receiptSnapshots?: ChannelSyncReceiptSnapshot[]
}
export interface ChannelFieldBaseline { id: string; listingId: string; targetId: string; field: string; value: unknown; version: number; eventId: string; updatedAt: string }
export interface ChannelLog { id: string; objectId: string; action: string; actor: string; at: string; detail: string; source: string }
export interface ChannelOrderReference { id: string; listingId: string; externalVariantId: string; internalSkuId: string; mappingVersion: number; orderCode: string; status: '履约中' | '已完成'; route: string }
export interface ChannelCatalogSnapshot {
  version: number; listings: ChannelListing[]; variants: ChannelVariant[]; prices: ChannelPrice[]
  syncOperations: ChannelSyncOperation[]; fieldBaselines: ChannelFieldBaseline[]; logs: ChannelLog[]; orderReferences: ChannelOrderReference[]
}
export interface ChannelStoreSnapshot { version: number; stores: ChannelStore[]; logs: ChannelLog[] }

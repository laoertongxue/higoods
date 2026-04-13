export type {
  PcsChannelProductStatus as ProjectChannelProductStatus,
  PcsChannelProductUpstreamSyncStatus as ProjectChannelProductUpstreamSyncStatus,
  PcsProjectChannelProductRecord,
} from './pcs-project-domain-contract.ts'

export interface ChannelOption {
  id: string
  name: string
}

export interface StoreOption {
  id: string
  name: string
  channel: string
  country: string
}

export type GroupStatus = 'ACTIVE' | 'PARTIAL_ONLINE' | 'ALL_OFFLINE' | 'HAS_BLOCKED' | 'PENDING_MIGRATION'
export type InternalRefType = 'CANDIDATE' | 'SPU'
export type PricingMode = 'UNIFIED' | 'STORE_OVERRIDE'
export type MappingHealth = 'OK' | 'MISSING' | 'CONFLICT'
export type ContentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export interface ChannelProductGroup {
  id: string
  channel: string
  internalRefType: InternalRefType
  internalRefId: string
  internalRefCode: string
  internalRefName: string
  originProjectId: string
  originProjectName: string
  pricingMode: PricingMode
  channelDefaultPrice: number
  currency: string
  coverStoreCount: number
  onlineStoreCount: number
  contentStatus: ContentStatus
  contentVersionId: string
  mappingHealth: MappingHealth
  groupStatus: GroupStatus
  hasCandidateToSpuMapping?: boolean
  targetSpuId?: string
  createdAt: string
  updatedAt: string
}

export interface ProjectSource {
  id: string
  name: string
  status: 'ACTIVE' | 'ARCHIVED'
  hasSpu: boolean
  spuId?: string
  candidateId?: string
}

export type ChannelProductStatus =
  | 'DRAFT'
  | 'READY'
  | 'LISTING_IN_PROGRESS'
  | 'ONLINE'
  | 'OFFLINE'
  | 'BLOCKED'
  | 'ARCHIVED'

export interface ChannelProduct {
  id: string
  groupId: string
  channel: string
  storeId: string
  storeName: string
  platformItemId: string | null
  platformItemTitle: string
  status: ChannelProductStatus
  internalRefType: InternalRefType
  internalRefCode: string
  internalRefName: string
  variantCount: number
  storePrice: number
  currency: string
  activeListingInstanceId: string | null
  lastListingResult: 'success' | 'fail' | null
  lastListingFailReason?: string
  lastOrderAt: string | null
  mappingHealth: MappingHealth
  createdAt: string
  updatedAt: string
}

export interface ChannelProductVariant {
  id: string
  platformSkuId: string
  sellerSku: string
  color: string
  size: string
  price: number
  internalSkuId: string | null
  mapStatus: 'OK' | 'MISSING' | 'CONFLICT'
}

export interface ListingInstance {
  id: string
  code: string
  status: '已完成' | '失败' | '已取消' | '执行中'
  owner: string
  createdAt: string
  completedAt: string | null
  failReason: string | null
}

export interface ProductOrderTrace {
  id: string
  platformOrderId: string
  buyerName: string
  qty: number
  amount: number
  orderTime: string
  platformSkuId: string
  mappedTo: string
}

export interface ProductLog {
  id: string
  action: string
  detail: string
  operator: string
  time: string
}

export interface ProductDetail {
  id: string
  channel: string
  store: string
  platformItemId: string
  platformItemTitle: string
  platformCategory: string
  status: ChannelProductStatus
  internalRefType: InternalRefType
  internalRefCode: string
  internalRefTitle: string
  mappingHealth: 'OK' | 'MISSING_SKU_MAP' | 'CONFLICT'
  listingTime: string
  createdAt: string
  updatedAt: string
}

export type MappingType = 'CANDIDATE_TO_SPU' | 'ITEM_TO_INTERNAL' | 'SKU_TO_INTERNAL'
export type MappingStatus = 'ACTIVE' | 'EXPIRED' | 'CONFLICT'

export interface MappingRecord {
  id: string
  type: MappingType
  sourceKey: string
  targetKey: string
  channel: string | null
  store: string | null
  effectiveFrom: string
  effectiveTo: string | null
  status: MappingStatus
  remark: string
  updatedAt: string
}

export type StoreStatus = 'ACTIVE' | 'INACTIVE'
export type StoreAuthStatus = 'CONNECTED' | 'EXPIRED' | 'ERROR'
export type OwnerType = 'PERSONAL' | 'LEGAL'

export interface ChannelStore {
  id: string
  channel: string
  storeName: string
  storeCode: string
  platformStoreId: string | null
  country: string
  pricingCurrency: string
  status: StoreStatus
  authStatus: StoreAuthStatus
  payoutAccountId: string | null
  payoutAccountName: string | null
  payoutIdentifier: string | null
  ownerType: OwnerType | null
  ownerName: string | null
  updatedAt: string
}

export interface PayoutAccount {
  id: string
  name: string
  payoutChannel: string
  identifierMasked: string
  ownerType: OwnerType
  ownerRefId: string
  ownerName: string
  country: string
  currency: string
  status: 'ACTIVE' | 'INACTIVE'
  relatedStoresCount: number
  updatedAt: string
}

export interface BindingHistory {
  id: string
  payoutAccountId: string
  payoutAccountName: string
  ownerType: OwnerType
  ownerName: string
  effectiveFrom: string
  effectiveTo: string | null
  changeReason: string
  changedBy: string
  changedAt: string
}

export interface SyncError {
  id: string
  store: string
  errorType: string
  errorMsg: string
  time: string
  status: string
}

export interface ProductSyncError extends SyncError {
  productId: string
  productName: string
}

export interface OrderSyncError extends SyncError {
  orderId: string
}

export const CHANNEL_OPTIONS: ChannelOption[] = [
  { id: 'tiktok', name: 'TikTok Shop' },
  { id: 'shopee', name: 'Shopee' },
  { id: 'lazada', name: 'Lazada' },
  { id: 'standalone', name: '独立站' },
]

export const STORE_OPTIONS: StoreOption[] = [
  { id: 'store-1', name: 'HiGood官方旗舰店', channel: 'tiktok', country: 'ID' },
  { id: 'store-2', name: 'HiGood印尼店', channel: 'tiktok', country: 'ID' },
  { id: 'store-3', name: 'HiGood马来店', channel: 'shopee', country: 'MY' },
  { id: 'store-4', name: 'HiGood菲律宾店', channel: 'lazada', country: 'PH' },
  { id: 'store-5', name: 'HiGood越南店', channel: 'shopee', country: 'VN' },
]

export const GROUP_STATUS_META: Record<GroupStatus, { label: string; color: string }> = {
  ACTIVE: { label: '活跃', color: 'bg-emerald-100 text-emerald-700' },
  PARTIAL_ONLINE: { label: '部分在售', color: 'bg-blue-100 text-blue-700' },
  ALL_OFFLINE: { label: '全部下架', color: 'bg-orange-100 text-orange-700' },
  HAS_BLOCKED: { label: '有受限', color: 'bg-rose-100 text-rose-700' },
  PENDING_MIGRATION: { label: '待迁移', color: 'bg-violet-100 text-violet-700' },
}

export const INTERNAL_REF_META: Record<InternalRefType, { label: string; color: string }> = {
  CANDIDATE: { label: '候选商品', color: 'bg-violet-100 text-violet-700' },
  SPU: { label: '款式档案', color: 'bg-blue-100 text-blue-700' },
}

export const PRICING_MODE_META: Record<PricingMode, { label: string; color: string }> = {
  UNIFIED: { label: '渠道统一价', color: 'bg-emerald-100 text-emerald-700' },
  STORE_OVERRIDE: { label: '店铺差异价', color: 'bg-orange-100 text-orange-700' },
}

export const MAPPING_HEALTH_META: Record<MappingHealth, { label: string; color: string }> = {
  OK: { label: '正常', color: 'bg-emerald-100 text-emerald-700' },
  MISSING: { label: '缺映射', color: 'bg-amber-100 text-amber-700' },
  CONFLICT: { label: '冲突', color: 'bg-rose-100 text-rose-700' },
}

export const CONTENT_STATUS_META: Record<ContentStatus, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'bg-slate-100 text-slate-600' },
  PUBLISHED: { label: '已发布', color: 'bg-emerald-100 text-emerald-700' },
  ARCHIVED: { label: '已归档', color: 'bg-slate-200 text-slate-600' },
}

export const CHANNEL_PRODUCT_STATUS_META: Record<ChannelProductStatus, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'bg-slate-100 text-slate-600' },
  READY: { label: '就绪', color: 'bg-blue-100 text-blue-700' },
  LISTING_IN_PROGRESS: { label: '上架中', color: 'bg-amber-100 text-amber-700' },
  ONLINE: { label: '在售', color: 'bg-emerald-100 text-emerald-700' },
  OFFLINE: { label: '已下架', color: 'bg-orange-100 text-orange-700' },
  BLOCKED: { label: '受限', color: 'bg-rose-100 text-rose-700' },
  ARCHIVED: { label: '归档', color: 'bg-slate-200 text-slate-600' },
}

export const MAP_STATUS_META: Record<ChannelProductVariant['mapStatus'], { label: string; color: string }> = {
  OK: { label: '正常', color: 'bg-emerald-100 text-emerald-700' },
  MISSING: { label: '缺失', color: 'bg-amber-100 text-amber-700' },
  CONFLICT: { label: '冲突', color: 'bg-rose-100 text-rose-700' },
}

export const MAPPING_TYPE_META: Record<MappingType, { label: string; color: string }> = {
  CANDIDATE_TO_SPU: { label: '候选→款式档案', color: 'bg-violet-100 text-violet-700' },
  ITEM_TO_INTERNAL: { label: '商品→内部', color: 'bg-blue-100 text-blue-700' },
  SKU_TO_INTERNAL: { label: '规格→内部', color: 'bg-emerald-100 text-emerald-700' },
}

export const MAPPING_STATUS_META: Record<MappingStatus, { label: string; color: string }> = {
  ACTIVE: { label: '有效', color: 'bg-emerald-100 text-emerald-700' },
  EXPIRED: { label: '已过期', color: 'bg-slate-100 text-slate-600' },
  CONFLICT: { label: '冲突', color: 'bg-rose-100 text-rose-700' },
}

export const STORE_STATUS_META: Record<StoreStatus, { label: string; color: string }> = {
  ACTIVE: { label: '启用', color: 'bg-emerald-100 text-emerald-700' },
  INACTIVE: { label: '停用', color: 'bg-slate-100 text-slate-600' },
}

export const STORE_AUTH_STATUS_META: Record<StoreAuthStatus, { label: string; color: string }> = {
  CONNECTED: { label: '已连接', color: 'bg-emerald-100 text-emerald-700' },
  EXPIRED: { label: '已过期', color: 'bg-amber-100 text-amber-700' },
  ERROR: { label: '连接错误', color: 'bg-rose-100 text-rose-700' },
}

export const OWNER_TYPE_META: Record<OwnerType, { label: string; color: string }> = {
  PERSONAL: { label: '个人', color: 'bg-blue-100 text-blue-700' },
  LEGAL: { label: '法人', color: 'bg-violet-100 text-violet-700' },
}

export const CHANNEL_PRODUCT_GROUPS: ChannelProductGroup[] = [
  {
    id: 'CPG-001',
    channel: 'tiktok',
    internalRefType: 'SPU',
    internalRefId: 'SPU-20260110-001',
    internalRefCode: 'SPU-20260110-001',
    internalRefName: '印尼风格碎花连衣裙',
    originProjectId: 'PRJ-20251216-001',
    originProjectName: '印尼风格碎花连衣裙',
    pricingMode: 'UNIFIED',
    channelDefaultPrice: 199000,
    currency: 'IDR',
    coverStoreCount: 2,
    onlineStoreCount: 2,
    contentStatus: 'PUBLISHED',
    contentVersionId: 'CV-001',
    mappingHealth: 'OK',
    groupStatus: 'ACTIVE',
    createdAt: '2026-01-05 10:00',
    updatedAt: '2026-01-12 14:30',
  },
  {
    id: 'CPG-002',
    channel: 'tiktok',
    internalRefType: 'CANDIDATE',
    internalRefId: 'CAND-20260108-001',
    internalRefCode: 'CAND-测款001',
    internalRefName: '波西米亚风印花半身裙',
    originProjectId: 'PRJ-20251220-002',
    originProjectName: '波西米亚风印花半身裙',
    pricingMode: 'UNIFIED',
    channelDefaultPrice: 159000,
    currency: 'IDR',
    coverStoreCount: 1,
    onlineStoreCount: 1,
    contentStatus: 'PUBLISHED',
    contentVersionId: 'CV-002',
    mappingHealth: 'OK',
    groupStatus: 'PENDING_MIGRATION',
    hasCandidateToSpuMapping: true,
    targetSpuId: 'SPU-20260115-001',
    createdAt: '2026-01-08 09:00',
    updatedAt: '2026-01-13 11:00',
  },
  {
    id: 'CPG-003',
    channel: 'shopee',
    internalRefType: 'SPU',
    internalRefId: 'SPU-20260112-002',
    internalRefCode: 'SPU-20260112-002',
    internalRefName: '清新格纹休闲衬衫',
    originProjectId: 'PRJ-20251218-003',
    originProjectName: '清新格纹休闲衬衫',
    pricingMode: 'STORE_OVERRIDE',
    channelDefaultPrice: 89000,
    currency: 'IDR',
    coverStoreCount: 2,
    onlineStoreCount: 1,
    contentStatus: 'DRAFT',
    contentVersionId: 'CV-003',
    mappingHealth: 'MISSING',
    groupStatus: 'PARTIAL_ONLINE',
    createdAt: '2026-01-10 14:00',
    updatedAt: '2026-01-14 09:30',
  },
  {
    id: 'CPG-004',
    channel: 'tiktok',
    internalRefType: 'SPU',
    internalRefId: 'SPU-20260108-003',
    internalRefCode: 'SPU-20260108-003',
    internalRefName: '运动休闲套装',
    originProjectId: 'PRJ-20251215-004',
    originProjectName: '运动休闲套装',
    pricingMode: 'UNIFIED',
    channelDefaultPrice: 299000,
    currency: 'IDR',
    coverStoreCount: 2,
    onlineStoreCount: 0,
    contentStatus: 'PUBLISHED',
    contentVersionId: 'CV-004',
    mappingHealth: 'CONFLICT',
    groupStatus: 'HAS_BLOCKED',
    createdAt: '2026-01-08 11:00',
    updatedAt: '2026-01-13 16:00',
  },
]

export const PROJECT_SOURCES: ProjectSource[] = [
  { id: 'PRJ-20251216-001', name: '印尼风格碎花连衣裙', status: 'ARCHIVED', hasSpu: true, spuId: 'SPU-20260110-001' },
  {
    id: 'PRJ-20251220-002',
    name: '波西米亚风印花半身裙',
    status: 'ARCHIVED',
    hasSpu: false,
    candidateId: 'CAND-20260108-001',
  },
  { id: 'PRJ-20251218-003', name: '清新格纹休闲衬衫', status: 'ACTIVE', hasSpu: true, spuId: 'SPU-20260112-002' },
  { id: 'PRJ-20260105-007', name: '简约百搭T恤', status: 'ACTIVE', hasSpu: false, candidateId: 'CAND-20260105-002' },
]

export const CHANNEL_PRODUCTS: ChannelProduct[] = [
  {
    id: 'CP-001',
    groupId: 'CPG-001',
    channel: 'tiktok',
    storeId: 'store-1',
    storeName: 'HiGood官方旗舰店',
    platformItemId: 'TT-10001234567',
    platformItemTitle: '印尼风格碎花连衣裙夏季新款',
    status: 'ONLINE',
    internalRefType: 'SPU',
    internalRefCode: 'SPU-20260110-001',
    internalRefName: '印尼风格碎花连衣裙',
    variantCount: 6,
    storePrice: 199000,
    currency: 'IDR',
    activeListingInstanceId: null,
    lastListingResult: 'success',
    lastOrderAt: '2026-01-14 15:30',
    mappingHealth: 'OK',
    createdAt: '2026-01-05 10:00',
    updatedAt: '2026-01-14 15:30',
  },
  {
    id: 'CP-002',
    groupId: 'CPG-001',
    channel: 'tiktok',
    storeId: 'store-2',
    storeName: 'HiGood印尼店',
    platformItemId: 'TT-10001234590',
    platformItemTitle: '印尼风格碎花连衣裙夏季新款',
    status: 'ONLINE',
    internalRefType: 'SPU',
    internalRefCode: 'SPU-20260110-001',
    internalRefName: '印尼风格碎花连衣裙',
    variantCount: 6,
    storePrice: 189000,
    currency: 'IDR',
    activeListingInstanceId: null,
    lastListingResult: 'success',
    lastOrderAt: '2026-01-14 12:00',
    mappingHealth: 'OK',
    createdAt: '2026-01-06 09:00',
    updatedAt: '2026-01-14 12:00',
  },
  {
    id: 'CP-003',
    groupId: 'CPG-002',
    channel: 'tiktok',
    storeId: 'store-1',
    storeName: 'HiGood官方旗舰店',
    platformItemId: 'TT-10001234568',
    platformItemTitle: '波西米亚风印花半身裙',
    status: 'ONLINE',
    internalRefType: 'CANDIDATE',
    internalRefCode: 'CAND-测款001',
    internalRefName: '波西米亚风印花半身裙',
    variantCount: 4,
    storePrice: 159000,
    currency: 'IDR',
    activeListingInstanceId: null,
    lastListingResult: 'success',
    lastOrderAt: '2026-01-13 18:00',
    mappingHealth: 'OK',
    createdAt: '2026-01-08 09:00',
    updatedAt: '2026-01-13 18:00',
  },
  {
    id: 'CP-004',
    groupId: 'CPG-003',
    channel: 'shopee',
    storeId: 'store-3',
    storeName: 'HiGood马来店',
    platformItemId: 'SP-20001234567',
    platformItemTitle: '清新格纹休闲衬衫',
    status: 'ONLINE',
    internalRefType: 'SPU',
    internalRefCode: 'SPU-20260112-002',
    internalRefName: '清新格纹休闲衬衫',
    variantCount: 8,
    storePrice: 45.9,
    currency: 'MYR',
    activeListingInstanceId: null,
    lastListingResult: 'success',
    lastOrderAt: '2026-01-14 10:00',
    mappingHealth: 'MISSING',
    createdAt: '2026-01-10 14:00',
    updatedAt: '2026-01-14 10:00',
  },
  {
    id: 'CP-005',
    groupId: 'CPG-003',
    channel: 'shopee',
    storeId: 'store-5',
    storeName: 'HiGood越南店',
    platformItemId: null,
    platformItemTitle: '清新格纹休闲衬衫',
    status: 'DRAFT',
    internalRefType: 'SPU',
    internalRefCode: 'SPU-20260112-002',
    internalRefName: '清新格纹休闲衬衫',
    variantCount: 8,
    storePrice: 350000,
    currency: 'VND',
    activeListingInstanceId: null,
    lastListingResult: null,
    lastOrderAt: null,
    mappingHealth: 'MISSING',
    createdAt: '2026-01-12 11:00',
    updatedAt: '2026-01-12 11:00',
  },
  {
    id: 'CP-006',
    groupId: 'CPG-004',
    channel: 'tiktok',
    storeId: 'store-1',
    storeName: 'HiGood官方旗舰店',
    platformItemId: 'TT-10001234580',
    platformItemTitle: '运动休闲套装',
    status: 'BLOCKED',
    internalRefType: 'SPU',
    internalRefCode: 'SPU-20260108-003',
    internalRefName: '运动休闲套装',
    variantCount: 6,
    storePrice: 299000,
    currency: 'IDR',
    activeListingInstanceId: null,
    lastListingResult: 'fail',
    lastListingFailReason: '平台审核不通过：图片包含敏感信息',
    lastOrderAt: '2026-01-10 14:00',
    mappingHealth: 'CONFLICT',
    createdAt: '2026-01-08 11:00',
    updatedAt: '2026-01-13 16:00',
  },
]

export const PRODUCT_DETAIL_SEED: ProductDetail = {
  id: 'CP-001',
  channel: 'TikTok Shop',
  store: 'HiGood官方旗舰店',
  platformItemId: 'TT-10001234567',
  platformItemTitle: '印尼风格碎花连衣裙夏季新款',
  platformCategory: '女装 > 连衣裙',
  status: 'ONLINE',
  internalRefType: 'SPU',
  internalRefCode: 'SPU-20260110-001',
  internalRefTitle: '印尼风格碎花连衣裙夏季新款',
  mappingHealth: 'OK',
  listingTime: '2026-01-05 14:30',
  createdAt: '2026-01-05 10:00',
  updatedAt: '2026-01-12 15:30',
}

export const PRODUCT_VARIANTS: ChannelProductVariant[] = [
  { id: 'V-001', platformSkuId: 'TT-SKU-001', sellerSku: 'HG-DRESS-RED-S', color: '红色', size: 'S', price: 199000, internalSkuId: 'SKU-001', mapStatus: 'OK' },
  { id: 'V-002', platformSkuId: 'TT-SKU-002', sellerSku: 'HG-DRESS-RED-M', color: '红色', size: 'M', price: 199000, internalSkuId: 'SKU-002', mapStatus: 'OK' },
  { id: 'V-003', platformSkuId: 'TT-SKU-003', sellerSku: 'HG-DRESS-RED-L', color: '红色', size: 'L', price: 199000, internalSkuId: 'SKU-003', mapStatus: 'OK' },
  { id: 'V-004', platformSkuId: 'TT-SKU-004', sellerSku: 'HG-DRESS-BLUE-S', color: '蓝色', size: 'S', price: 199000, internalSkuId: 'SKU-004', mapStatus: 'OK' },
  { id: 'V-005', platformSkuId: 'TT-SKU-005', sellerSku: 'HG-DRESS-BLUE-M', color: '蓝色', size: 'M', price: 199000, internalSkuId: null, mapStatus: 'MISSING' },
]

export const LISTING_INSTANCES: ListingInstance[] = [
  { id: 'LI-003', code: 'WI-LISTING-003', status: '已完成', owner: '渠道运营-李明', createdAt: '2026-01-05 10:30', completedAt: '2026-01-05 14:30', failReason: null },
  { id: 'LI-002', code: 'WI-LISTING-002', status: '失败', owner: '渠道运营-李明', createdAt: '2026-01-04 16:00', completedAt: null, failReason: '主图不符合平台规范' },
  { id: 'LI-001', code: 'WI-LISTING-001', status: '已取消', owner: '渠道运营-王芳', createdAt: '2026-01-03 11:00', completedAt: null, failReason: null },
]

export const PRODUCT_ORDER_TRACES: ProductOrderTrace[] = [
  {
    id: 'ORD-001',
    platformOrderId: 'TT-ORD-20260112001',
    buyerName: '用户A***',
    qty: 2,
    amount: 398000,
    orderTime: '2026-01-12 15:30',
    platformSkuId: 'TT-SKU-001',
    mappedTo: 'SKU-001',
  },
  {
    id: 'ORD-002',
    platformOrderId: 'TT-ORD-20260111002',
    buyerName: '用户B***',
    qty: 1,
    amount: 199000,
    orderTime: '2026-01-11 10:20',
    platformSkuId: 'TT-SKU-004',
    mappedTo: 'SKU-004',
  },
]

export const PRODUCT_LOGS: ProductLog[] = [
  { id: 'LOG-001', action: '规格映射更新', detail: 'TT-SKU-005 映射到 SKU-005', operator: '系统', time: '2026-01-12 10:00' },
  { id: 'LOG-002', action: '上架完成', detail: '工作项 WI-LISTING-003 执行成功', operator: '渠道运营-李明', time: '2026-01-05 14:30' },
  { id: 'LOG-003', action: '创建渠道商品', detail: '挂接款式档案 SPU-20260110-001', operator: '渠道运营-李明', time: '2026-01-05 10:00' },
]

export const MAPPING_RECORDS: MappingRecord[] = [
  {
    id: 'MAP-001',
    type: 'CANDIDATE_TO_SPU',
    sourceKey: 'CAND-20260108-001',
    targetKey: 'SPU-20260115-001',
    channel: null,
    store: null,
    effectiveFrom: '2026-01-15 10:00',
    effectiveTo: null,
    status: 'ACTIVE',
    remark: '测款通过转档',
    updatedAt: '2026-01-15 10:00',
  },
  {
    id: 'MAP-002',
    type: 'ITEM_TO_INTERNAL',
    sourceKey: 'TT-10001234567',
    targetKey: 'SPU-20260110-001',
    channel: 'tiktok',
    store: 'store-1',
    effectiveFrom: '2026-01-05 14:30',
    effectiveTo: null,
    status: 'ACTIVE',
    remark: '上架时自动创建',
    updatedAt: '2026-01-05 14:30',
  },
  {
    id: 'MAP-005',
    type: 'SKU_TO_INTERNAL',
    sourceKey: 'TT-SKU-005',
    targetKey: 'SKU-005',
    channel: 'tiktok',
    store: 'store-1',
    effectiveFrom: '2026-01-12 10:00',
    effectiveTo: null,
    status: 'CONFLICT',
    remark: '与 MAP-006 冲突',
    updatedAt: '2026-01-12 10:00',
  },
  {
    id: 'MAP-006',
    type: 'SKU_TO_INTERNAL',
    sourceKey: 'TT-SKU-005',
    targetKey: 'SKU-006',
    channel: 'tiktok',
    store: 'store-1',
    effectiveFrom: '2026-01-10 15:00',
    effectiveTo: null,
    status: 'CONFLICT',
    remark: '与 MAP-005 冲突',
    updatedAt: '2026-01-10 15:00',
  },
]

export const CHANNEL_STORES: ChannelStore[] = [
  {
    id: 'ST-001',
    channel: 'TikTok',
    storeName: 'IDN-Store-A',
    storeCode: 'TT_IDN_A',
    platformStoreId: '7239012',
    country: '印尼',
    pricingCurrency: 'IDR',
    status: 'ACTIVE',
    authStatus: 'CONNECTED',
    payoutAccountId: 'PA-002',
    payoutAccountName: 'PT HIGOOD LIVE - IDN Payout',
    payoutIdentifier: '****1234',
    ownerType: 'LEGAL',
    ownerName: 'PT HIGOOD LIVE JAKARTA',
    updatedAt: '2026-01-10 14:30',
  },
  {
    id: 'ST-002',
    channel: 'TikTok',
    storeName: 'VN-Store-B',
    storeCode: 'TT_VN_B',
    platformStoreId: '7239013',
    country: '越南',
    pricingCurrency: 'VND',
    status: 'ACTIVE',
    authStatus: 'EXPIRED',
    payoutAccountId: 'PA-004',
    payoutAccountName: '李四-个人卡',
    payoutIdentifier: '****9012',
    ownerType: 'PERSONAL',
    ownerName: '李四',
    updatedAt: '2026-01-08 10:00',
  },
  {
    id: 'ST-003',
    channel: 'Shopee',
    storeName: 'MY-Store-C',
    storeCode: 'SP_MY_C',
    platformStoreId: '88901234',
    country: '马来西亚',
    pricingCurrency: 'MYR',
    status: 'ACTIVE',
    authStatus: 'CONNECTED',
    payoutAccountId: 'PA-001',
    payoutAccountName: 'HiGOOD LIVE Limited - TikTok Payout',
    payoutIdentifier: '****6789',
    ownerType: 'LEGAL',
    ownerName: 'HiGOOD LIVE Limited',
    updatedAt: '2026-01-05 16:20',
  },
]

export const LEGAL_ENTITIES = [
  { id: 'LE-001', name: 'HiGOOD LIVE Limited', country: 'HK' },
  { id: 'LE-002', name: 'PT HIGOOD LIVE JAKARTA', country: 'ID' },
]

export const PAYOUT_ACCOUNTS: PayoutAccount[] = [
  {
    id: 'PA-001',
    name: 'HiGOOD LIVE Limited - TikTok Payout',
    payoutChannel: '平台内提现',
    identifierMasked: '****6789',
    ownerType: 'LEGAL',
    ownerRefId: 'LE-001',
    ownerName: 'HiGOOD LIVE Limited',
    country: 'HK',
    currency: 'USD',
    status: 'ACTIVE',
    relatedStoresCount: 2,
    updatedAt: '2026-01-10 10:00',
  },
  {
    id: 'PA-002',
    name: 'PT HIGOOD LIVE - IDN Payout',
    payoutChannel: '平台内提现',
    identifierMasked: '****1234',
    ownerType: 'LEGAL',
    ownerRefId: 'LE-002',
    ownerName: 'PT HIGOOD LIVE JAKARTA',
    country: 'ID',
    currency: 'IDR',
    status: 'ACTIVE',
    relatedStoresCount: 1,
    updatedAt: '2026-01-08 14:30',
  },
  {
    id: 'PA-003',
    name: '张三-个人卡',
    payoutChannel: '银行转账',
    identifierMasked: '****5678',
    ownerType: 'PERSONAL',
    ownerRefId: 'P-001',
    ownerName: '张三',
    country: 'ID',
    currency: 'IDR',
    status: 'ACTIVE',
    relatedStoresCount: 1,
    updatedAt: '2026-01-05 09:00',
  },
]

export const STORE_BINDING_HISTORY: BindingHistory[] = [
  {
    id: 'BND-002',
    payoutAccountId: 'PA-002',
    payoutAccountName: 'PT HIGOOD LIVE - IDN Payout',
    ownerType: 'LEGAL',
    ownerName: 'PT HIGOOD LIVE JAKARTA',
    effectiveFrom: '2025-10-01',
    effectiveTo: null,
    changeReason: '店铺正式上线，绑定公司提现账号',
    changedBy: '李运营',
    changedAt: '2025-10-01 09:00',
  },
  {
    id: 'BND-001',
    payoutAccountId: 'PA-003',
    payoutAccountName: '张三-个人卡',
    ownerType: 'PERSONAL',
    ownerName: '张三',
    effectiveFrom: '2025-08-15',
    effectiveTo: '2025-09-30',
    changeReason: '测试阶段临时绑定个人账号',
    changedBy: '系统管理员',
    changedAt: '2025-08-15 10:00',
  },
]

export const STORE_DETAIL_SEED = {
  id: 'ST-001',
  channel: 'TikTok',
  storeName: 'IDN-Store-A',
  storeCode: 'TT_IDN_A',
  platformStoreId: '7239012',
  country: '印尼',
  region: 'ID',
  pricingCurrency: 'IDR',
  settlementCurrency: 'IDR',
  timezone: 'Asia/Jakarta',
  status: 'ACTIVE' as StoreStatus,
  authStatus: 'CONNECTED' as StoreAuthStatus,
  tokenExpireAt: '2026-02-15',
  lastRefreshAt: '2026-01-10 14:30',
  storeOwner: '李运营',
  team: '东南亚运营组',
  reviewer: '陈主管',
  currentPayoutBinding: {
    payoutAccountId: 'PA-002',
    payoutAccountName: 'PT HIGOOD LIVE - IDN Payout',
    payoutIdentifier: '****1234',
    ownerType: 'LEGAL' as OwnerType,
    ownerName: 'PT HIGOOD LIVE JAKARTA',
    effectiveFrom: '2025-10-01',
    effectiveTo: null as string | null,
  },
  policies: {
    allowListing: true,
    inventorySyncMode: 'AVAILABLE_TO_SELL',
    safetyStock: 10,
    handlingTime: 3,
    defaultCategoryId: 'Women>Dresses',
  },
  createdAt: '2025-10-15 09:00',
  createdBy: '系统管理员',
  updatedAt: '2026-01-10 14:30',
  updatedBy: '李运营',
}

export const STORE_DETAIL_LOGS: ProductLog[] = [
  { id: 'SL-001', action: '刷新授权', detail: '授权token刷新成功，有效期至2026-02-15', operator: '李运营', time: '2026-01-10 14:30' },
  { id: 'SL-002', action: '修改策略', detail: '修改安全库存从5改为10', operator: '李运营', time: '2026-01-05 11:00' },
  {
    id: 'SL-003',
    action: '变更提现账号',
    detail: '从张三-个人卡变更为PT HIGOOD LIVE - IDN Payout',
    operator: '李运营',
    time: '2025-10-01 09:00',
  },
]

export const PRODUCT_SYNC_ERRORS: ProductSyncError[] = [
  {
    id: 'E-001',
    store: 'IDN-Store-A',
    productId: 'CP-001',
    productName: '印尼风格碎花连衣裙',
    errorType: '类目不匹配',
    errorMsg: '平台类目Women>Dresses已下架',
    time: '2026-01-13 10:30',
    status: '待处理',
  },
  {
    id: 'E-002',
    store: 'VN-Store-B',
    productId: 'CP-005',
    productName: '波西米亚长裙',
    errorType: '库存同步失败',
    errorMsg: '仓库接口超时',
    time: '2026-01-13 09:15',
    status: '已重试',
  },
]

export const ORDER_SYNC_ERRORS: OrderSyncError[] = [
  {
    id: 'OE-001',
    store: 'IDN-Store-A',
    orderId: 'TT7890123456',
    errorType: '订单拉取失败',
    errorMsg: 'API限流，稍后重试',
    time: '2026-01-13 11:00',
    status: '已恢复',
  },
  {
    id: 'OE-002',
    store: 'TH-Store-D',
    orderId: 'LZ1234567890',
    errorType: '发货同步失败',
    errorMsg: '运单号格式错误',
    time: '2026-01-12 14:30',
    status: '待处理',
  },
]

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function listChannelProductGroups(): ChannelProductGroup[] {
  return clone(CHANNEL_PRODUCT_GROUPS)
}

export function listProjectSources(): ProjectSource[] {
  return clone(PROJECT_SOURCES)
}

export function listChannelProducts(): ChannelProduct[] {
  return clone(CHANNEL_PRODUCTS)
}

export function listMappingRecords(): MappingRecord[] {
  return clone(MAPPING_RECORDS)
}

export function listChannelStores(): ChannelStore[] {
  return clone(CHANNEL_STORES)
}

export function listPayoutAccounts(): PayoutAccount[] {
  return clone(PAYOUT_ACCOUNTS)
}

export function listStoreBindingHistory(): BindingHistory[] {
  return clone(STORE_BINDING_HISTORY)
}

export function getChannelProductDetail(id: string): ProductDetail | null {
  const listed = CHANNEL_PRODUCTS.find((item) => item.id === id)
  if (!listed) return null

  return {
    ...clone(PRODUCT_DETAIL_SEED),
    id: listed.id,
    platformItemTitle: listed.platformItemTitle,
    platformItemId: listed.platformItemId ?? `${listed.channel.toUpperCase()}-${listed.id}`,
    status: listed.status,
    internalRefType: listed.internalRefType,
    internalRefCode: listed.internalRefCode,
    internalRefTitle: listed.internalRefName,
    mappingHealth: listed.mappingHealth === 'MISSING' ? 'MISSING_SKU_MAP' : listed.mappingHealth,
    channel: CHANNEL_OPTIONS.find((item) => item.id === listed.channel)?.name ?? listed.channel,
    store: listed.storeName,
    updatedAt: listed.updatedAt,
  }
}

export function getChannelStoreById(id: string): ChannelStore | null {
  const found = CHANNEL_STORES.find((item) => item.id === id)
  return found ? clone(found) : null
}

export function listProductSyncErrors(): ProductSyncError[] {
  return clone(PRODUCT_SYNC_ERRORS)
}

export function listOrderSyncErrors(): OrderSyncError[] {
  return clone(ORDER_SYNC_ERRORS)
}

import { archiveLog, PCS_DEMO_OPERATOR_ID, assertProductStyleIdentity, completeProductArchiveAudit } from './pcs-product-archive-rules.ts'
import { hasPcsRecordSnapshot } from './pcs-record-runtime.ts'
import { pcsRecordStore, withPcsDemoData, registerPcsRepositoryReset } from './pcs-record-runtime.ts'
import { PRODUCT_CONFIG_FIELDS, createStyleProductInformationContext, resolveStyleProductInformation } from './pcs-style-product-information.ts'
import { createStyleArchiveBootstrapSnapshot } from './pcs-style-archive-bootstrap.ts'
import { buildStyleFixture, isLegacyProductFixtureImage, migrateProductFixtureImage } from './pcs-product-archive-fixtures.ts'
import { normalizeStyleTechPackStatusText } from './pcs-product-lifecycle-governance.ts'
import type {
  StyleArchivePendingItem,
  StyleArchiveShellRecord,
  StyleArchiveStoreSnapshot,
} from './pcs-style-archive-types.ts'

const STYLE_ARCHIVE_STORAGE_KEY = 'higood-pcs-style-archive-store-v3'
const STYLE_ARCHIVE_STORE_VERSION = 3

let memorySnapshot: StyleArchiveStoreSnapshot | null = null

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

function canUseStorage(): boolean {
  try {
    if (typeof window === 'undefined') return false
    const storage = pcsRecordStore
    return (
      typeof storage?.getItem === 'function' &&
      typeof storage.setItem === 'function' &&
      typeof storage.removeItem === 'function'
    )
  } catch {
    return false
  }
}

function cloneRecord(record: StyleArchiveShellRecord): StyleArchiveShellRecord {
  return {
    ...record,
    legacyValues: record.legacyValues ? structuredClone(record.legacyValues) : undefined,
    styleNameTranslations: record.styleNameTranslations ? { ...record.styleNameTranslations } : undefined,
    archiveLogs: record.archiveLogs ? structuredClone(record.archiveLogs) : undefined,
    sameStyleIds: [...(record.sameStyleIds || [])],
    substitutionRelations: record.substitutionRelations?.map(item => ({ ...item })),
    salesContents: record.salesContents?.map(item => ({ ...item, imageUrls: [...item.imageUrls], videoUrls: [...item.videoUrls] })),
    productConfigRefs: record.productConfigRefs ? Object.fromEntries(Object.entries(record.productConfigRefs).map(([key, ids]) => [key, [...ids]])) : undefined,
    categoryTags: [...(record.categoryTags || [])],
    popularElementTags: [...(record.popularElementTags || [])],
    fabricTags: [...(record.fabricTags || [])],
    ageTags: [...(record.ageTags || [])],
    audiencePositionTags: [...(record.audiencePositionTags || [])],

    seasonTags: Array.isArray(record.seasonTags) ? [...record.seasonTags] : [],
    styleTags: Array.isArray(record.styleTags) ? [...record.styleTags] : [],
    targetAudienceTags: Array.isArray(record.targetAudienceTags) ? [...record.targetAudienceTags] : [],
    targetChannelCodes: Array.isArray(record.targetChannelCodes) ? [...record.targetChannelCodes] : [],
    galleryImagePurposes: record.galleryImagePurposes ? [...record.galleryImagePurposes] : undefined,
    galleryImageIds: Array.isArray(record.galleryImageIds) ? [...record.galleryImageIds] : [],
    galleryImageUrls: Array.isArray(record.galleryImageUrls) ? [...record.galleryImageUrls] : [],
    linkedDesignRevisionTaskIds: Array.isArray(record.linkedDesignRevisionTaskIds) ? [...record.linkedDesignRevisionTaskIds] : [],
    inheritedDesignFileIds: Array.isArray(record.inheritedDesignFileIds) ? [...record.inheritedDesignFileIds] : [],
    inheritedPatternFileIds: Array.isArray(record.inheritedPatternFileIds) ? [...record.inheritedPatternFileIds] : [],
    inheritedBomVersionIds: Array.isArray(record.inheritedBomVersionIds) ? [...record.inheritedBomVersionIds] : [],
    currentTechPackVersionId: record.currentTechPackVersionId || '',
    currentTechPackVersionCode: record.currentTechPackVersionCode || '',
    currentTechPackVersionLabel: record.currentTechPackVersionLabel || '',
    currentTechPackVersionStatus: record.currentTechPackVersionStatus || '',
    currentTechPackVersionActivatedAt: record.currentTechPackVersionActivatedAt || '',
    currentTechPackVersionActivatedBy: record.currentTechPackVersionActivatedBy || '',
  }
}

function clonePendingItem(item: StyleArchivePendingItem): StyleArchivePendingItem {
  return { ...item }
}

function cloneSnapshot(snapshot: StyleArchiveStoreSnapshot): StyleArchiveStoreSnapshot {
  return {
    version: snapshot.version,
    records: snapshot.records.map(cloneRecord),
    pendingItems: snapshot.pendingItems.map(clonePendingItem),
  }
}

function seedSnapshot(): StyleArchiveStoreSnapshot {
  // Keep the in-memory baseline in the same shape as hydrated records. Otherwise
  // saving one style would persist normalization-only changes for every demo style.
  return hydrateSnapshot(createStyleArchiveBootstrapSnapshot(STYLE_ARCHIVE_STORE_VERSION))
}

function normalizeBaseInfoStatus(status: string): string {
  if (status === '已维护') return '已建档'
  return status || '待完善'
}

function normalizeRecord(record: StyleArchiveShellRecord): StyleArchiveShellRecord {
  const fixture = buildStyleFixture(record.styleCode || record.styleId, record.styleName || record.styleCode)
  const manual = record.identitySource === 'MANUAL'
  const mainImageUrl = manual ? record.mainImageUrl || '' : migrateProductFixtureImage(record.styleCode, record.mainImageUrl || '')
  const legacyGallery = !manual && (record.galleryImageUrls || []).some(isLegacyProductFixtureImage)
  const galleryImageUrls = legacyGallery && fixture.mainImageUrl
    ? [...new Set([...fixture.galleryImageUrls, ...(record.galleryImageUrls || []).filter((url) => !isLegacyProductFixtureImage(url))])]
    : [...(record.galleryImageUrls || [])]
  return {
    ...cloneRecord(record),
    approvalStatus: record.approvalStatus || (record.archiveStatus === 'DRAFT' ? 'DRAFT' : 'APPROVED'),
    lifecycleStatus: record.lifecycleStatus || (record.archiveStatus === 'DRAFT' ? 'NOT_ENABLED' : record.archiveStatus),
    deliveryMode: record.deliveryMode || 'SINGLE',
    recordVersion: record.recordVersion || 1,
    archiveLogs: structuredClone(record.archiveLogs || []),
    sameStyleIds: [...(record.sameStyleIds || [])],
    substitutionRelations: record.substitutionRelations?.map(item => ({ ...item })),
    salesContents: (record.salesContents || [{ language: 'id', title: record.styleNameEn || record.styleName, description: record.detailDescription || '', sellingPoints: record.sellingPointText || '', imageUrls: record.galleryImageUrls || [], videoUrls: [], sizeChartUrl: '', version: 1 }]).map(item => ({ ...item, imageUrls: [...item.imageUrls], videoUrls: [...item.videoUrls] })),
    archiveStatus: record.archiveStatus === 'ACTIVE' || record.archiveStatus === 'ARCHIVED' ? record.archiveStatus : 'DRAFT',
    styleNameEn: record.styleNameEn || (manual ? '' : fixture.styleNameEn),
    baseInfoStatus: normalizeBaseInfoStatus(record.baseInfoStatus),
    specificationStatus: record.specificationStatus || '未建立',
    techPackStatus: normalizeStyleTechPackStatusText(record.techPackStatus || '未建立'),
    costPricingStatus: record.costPricingStatus || '未建立',
    specificationCount: Number.isFinite(record.specificationCount) ? record.specificationCount : 0,
    techPackVersionCount: Number.isFinite(record.techPackVersionCount) ? record.techPackVersionCount : 0,
    costVersionCount: Number.isFinite(record.costVersionCount) ? record.costVersionCount : 0,
    channelProductCount: Number.isFinite(record.channelProductCount) ? record.channelProductCount : 0,
    currentTechPackVersionId: record.currentTechPackVersionId || '',
    currentTechPackVersionCode: record.currentTechPackVersionCode || '',
    currentTechPackVersionLabel: record.currentTechPackVersionLabel || '',
    currentTechPackVersionStatus: record.currentTechPackVersionStatus || '',
    currentTechPackVersionActivatedAt: record.currentTechPackVersionActivatedAt || '',
    currentTechPackVersionActivatedBy: record.currentTechPackVersionActivatedBy || '',
    mainImageId: record.mainImageId || '',
    mainImageUrl,
    galleryImagePurposes: record.galleryImagePurposes ? [...record.galleryImagePurposes] : undefined,
    galleryImageIds: Array.isArray(record.galleryImageIds) ? [...record.galleryImageIds] : [],
    galleryImageUrls,
    imageSource: mainImageUrl !== record.mainImageUrl ? '原型实拍素材（来源见图片台账）' : record.imageSource || (record.mainImageUrl ? '历史图片' : ''),
    sellingPointText: record.sellingPointText || (manual ? '' : fixture.sellingPointText),
    detailDescription: record.detailDescription || (manual ? '' : fixture.detailDescription),
    packagingInfo: record.packagingInfo || (manual ? '' : fixture.packagingInfo),
    remark: record.remark || '',
    sourceProjectNodeId: record.sourceProjectNodeId || '',
    generatedAt: record.generatedAt || record.updatedAt || '',
    generatedBy: record.generatedBy || '系统初始化',
    updatedAt: record.updatedAt || record.generatedAt || '',
    updatedBy: record.updatedBy || '系统初始化',
    legacyOriginProject: record.legacyOriginProject || '',
    temporarySpuName: record.temporarySpuName || '',
    linkedDesignRevisionTaskIds: Array.isArray(record.linkedDesignRevisionTaskIds) ? [...record.linkedDesignRevisionTaskIds] : [],
    inheritedDesignFileIds: Array.isArray(record.inheritedDesignFileIds) ? [...record.inheritedDesignFileIds] : [],
    inheritedPatternFileIds: Array.isArray(record.inheritedPatternFileIds) ? [...record.inheritedPatternFileIds] : [],
    inheritedBomVersionIds: Array.isArray(record.inheritedBomVersionIds) ? [...record.inheritedBomVersionIds] : [],
  }
}

function normalizePendingItem(item: StyleArchivePendingItem): StyleArchivePendingItem {
  return {
    ...clonePendingItem(item),
    rawStyleCode: item.rawStyleCode || '',
    rawOriginProject: item.rawOriginProject || '',
    reason: item.reason || '未说明原因',
    discoveredAt: item.discoveredAt || '',
  }
}

function hydrateSnapshot(snapshot: StyleArchiveStoreSnapshot): StyleArchiveStoreSnapshot {
  const records = Array.isArray(snapshot.records) ? snapshot.records.map(normalizeRecord) : []
  const styleIdCounts = new Map<string, number>()
  records.forEach((record) => {
    styleIdCounts.set(record.styleId, (styleIdCounts.get(record.styleId) || 0) + 1)
  })
  const duplicateStyleIds = Array.from(styleIdCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([styleId]) => styleId)
  if (duplicateStyleIds.length > 0) {
    throw new Error(`款式档案 ID 重复冲突：${duplicateStyleIds.join('、')}。请先处理重复档案，原始数据未改写。`)
  }
  return {
    version: STYLE_ARCHIVE_STORE_VERSION,
    records,
    pendingItems: Array.isArray(snapshot.pendingItems) ? snapshot.pendingItems.map(normalizePendingItem) : [],
  }
}

function mergeMissingSeedData(snapshot: StyleArchiveStoreSnapshot): StyleArchiveStoreSnapshot {
  if (hasPcsRecordSnapshot('higood-pcs-style-archive-store-v3')) return snapshot

  const seed = withPcsDemoData(() => seedSnapshot())
  const seedById = new Map(seed.records.map((item) => [item.styleId, item]))
  const legacyById = new Map(createStyleArchiveBootstrapSnapshot(STYLE_ARCHIVE_STORE_VERSION, false).records.map((item) => [item.styleId, item]))
  const existingIds = new Set(snapshot.records.map((item) => item.styleId))
  const existingPendingIds = new Set(snapshot.pendingItems.map((item) => item.pendingId))
  const patchedRecords = snapshot.records.map((record) => {
    const seeded = seedById.get(record.styleId)
    if (!seeded) return record
    if (!record.productInformationVersion) {
      // 升级已知 Mock 的旧空字段及旧配置占位；保留用户明确维护的属性。
      const refs = { ...seeded.productConfigRefs }
      const next = { ...seeded, ...record }
      for (const [field, dimension] of Object.entries(PRODUCT_CONFIG_FIELDS)) {
        const value = record[field as keyof StyleArchiveShellRecord]
        const missing = Array.isArray(value) ? !value.length : !value
        const legacy = JSON.stringify(value) === JSON.stringify(legacyById.get(record.styleId)?.[field as keyof StyleArchiveShellRecord])
        if (missing || legacy) Object.assign(next, { [field]: seeded[field as keyof StyleArchiveShellRecord] })
        else delete refs[dimension]
      }
      const customCategory = ['categoryName', 'subCategoryName', 'thirdCategoryName'].some((key) => record[key as keyof StyleArchiveShellRecord] && record[key as keyof StyleArchiveShellRecord] !== legacyById.get(record.styleId)?.[key as keyof StyleArchiveShellRecord])
      if (record.categoryCode && record.categoryCodeName) delete refs.categoryNumbers
      Object.assign(record, next, { productConfigRefs: refs, productInformationVersion: 1,
        productCategoryId: record.productCategoryId || (customCategory ? undefined : seeded.productCategoryId),
        materialType: record.materialType || seeded.materialType,
        buyerId: record.buyerId || (record.buyerName && record.buyerName !== seeded.buyerName ? `legacy-buyer-${record.styleId}` : seeded.buyerId), buyerName: record.buyerName || seeded.buyerName,
        categoryCode: record.categoryCode || seeded.categoryCode,
      })
    }
    const recordWithSeedVersionCount = {
      ...record,
      techPackVersionCount: Math.max(record.techPackVersionCount || 0, seeded.techPackVersionCount || 0),
    }
    if (!seeded.currentTechPackVersionId || record.currentTechPackVersionId) return recordWithSeedVersionCount
    return {
      ...recordWithSeedVersionCount,
      techPackStatus: seeded.techPackStatus,
      currentTechPackVersionId: seeded.currentTechPackVersionId,
      currentTechPackVersionCode: seeded.currentTechPackVersionCode,
      currentTechPackVersionLabel: seeded.currentTechPackVersionLabel,
      currentTechPackVersionStatus: seeded.currentTechPackVersionStatus,
      currentTechPackVersionActivatedAt: seeded.currentTechPackVersionActivatedAt,
      currentTechPackVersionActivatedBy: seeded.currentTechPackVersionActivatedBy,
      updatedAt: seeded.updatedAt || record.updatedAt,
      updatedBy: seeded.updatedBy || record.updatedBy,
    }
  })

  return {
    version: STYLE_ARCHIVE_STORE_VERSION,
    records: [
      ...patchedRecords,
      ...seed.records.filter((item) => !existingIds.has(item.styleId)).map(cloneRecord),
    ],
    pendingItems: [
      ...snapshot.pendingItems,
      ...seed.pendingItems.filter((item) => !existingPendingIds.has(item.pendingId)).map(clonePendingItem),
    ],
  }
}

function loadSnapshot(): StyleArchiveStoreSnapshot {
  if (memorySnapshot) return cloneSnapshot(memorySnapshot)

  if (!canUseStorage()) {
    memorySnapshot = withPcsDemoData(() => seedSnapshot())
    return cloneSnapshot(memorySnapshot)
  }

  try {
    const raw = pcsRecordStore.getItem(STYLE_ARCHIVE_STORAGE_KEY)
    if (!raw) {
      memorySnapshot = withPcsDemoData(() => seedSnapshot())
      return cloneSnapshot(memorySnapshot)
    }

    const parsed = JSON.parse(raw) as Partial<StyleArchiveStoreSnapshot>
    if (!Array.isArray(parsed.records) || !Array.isArray(parsed.pendingItems)) throw new Error('商品档案格式不完整，原数据已保留，请核对后重试。')

    memorySnapshot = mergeMissingSeedData(
      hydrateSnapshot({
        version: STYLE_ARCHIVE_STORE_VERSION,
        records: parsed.records as StyleArchiveShellRecord[],
        pendingItems: parsed.pendingItems as StyleArchivePendingItem[],
      }),
    )
    return cloneSnapshot(memorySnapshot)
  } catch (error) {
    memorySnapshot = null
    throw error
  }
}

function persistSnapshot(snapshot: StyleArchiveStoreSnapshot): void {
  const nextSnapshot = hydrateSnapshot(snapshot)
  if (canUseStorage()) {
    pcsRecordStore.setItem(STYLE_ARCHIVE_STORAGE_KEY, JSON.stringify(nextSnapshot))
  }
  memorySnapshot = nextSnapshot
}

export interface StyleArchiveRepositoryState {
  rawSnapshot: string | null
  memorySnapshot: StyleArchiveStoreSnapshot | null
}

export interface PreparedStyleArchiveRepositorySnapshot {
  snapshot: StyleArchiveStoreSnapshot
  writeRequired: boolean
}

export function captureStyleArchiveRepositoryState(): StyleArchiveRepositoryState {
  return {
    rawSnapshot: canUseStorage() ? pcsRecordStore.getItem(STYLE_ARCHIVE_STORAGE_KEY) : null,
    memorySnapshot: memorySnapshot ? cloneSnapshot(memorySnapshot) : null,
  }
}

export function prepareStyleArchiveRepositorySnapshot(
  state: StyleArchiveRepositoryState,
): PreparedStyleArchiveRepositorySnapshot {
  if (state.memorySnapshot) {
    return {
      snapshot: cloneSnapshot(state.memorySnapshot),
      writeRequired: state.rawSnapshot === null,
    }
  }
  if (state.rawSnapshot === null) {
    return {
      snapshot: withPcsDemoData(() => seedSnapshot()),
      writeRequired: true,
    }
  }

  const parsed = JSON.parse(state.rawSnapshot) as Partial<StyleArchiveStoreSnapshot>
  if (!Array.isArray(parsed.records) || !Array.isArray(parsed.pendingItems)) {
    return {
      snapshot: withPcsDemoData(() => seedSnapshot()),
      writeRequired: true,
    }
  }
  return {
    snapshot: mergeMissingSeedData(
      hydrateSnapshot({
        version: STYLE_ARCHIVE_STORE_VERSION,
        records: parsed.records as StyleArchiveShellRecord[],
        pendingItems: parsed.pendingItems as StyleArchivePendingItem[],
      }),
    ),
    writeRequired: false,
  }
}

export function commitStyleArchiveStoreSnapshot(snapshot: StyleArchiveStoreSnapshot): void {
  persistSnapshot(snapshot)
}

export function restoreStyleArchiveRepositoryState(
  state: StyleArchiveRepositoryState,
  restoreRawSnapshot = true,
): void {
  try {
    if (restoreRawSnapshot && canUseStorage()) {
      if (state.rawSnapshot === null) {
        pcsRecordStore.removeItem(STYLE_ARCHIVE_STORAGE_KEY)
      } else {
        pcsRecordStore.setItem(STYLE_ARCHIVE_STORAGE_KEY, state.rawSnapshot)
      }
    }
  } finally {
    memorySnapshot = state.memorySnapshot ? cloneSnapshot(state.memorySnapshot) : null
  }
}

export function getStyleArchiveStoreSnapshot(): StyleArchiveStoreSnapshot {
  return loadSnapshot()
}

export function listStyleArchives(): StyleArchiveShellRecord[] {
  const context = createStyleProductInformationContext()
  return (memorySnapshot ?? loadSnapshot()).records.map((record) => resolveStyleProductInformation(cloneRecord(record), context)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getStyleArchiveById(styleId: string): StyleArchiveShellRecord | null {
  const record = (memorySnapshot ?? loadSnapshot()).records.find((item) => item.styleId === styleId)
  return record ? resolveStyleProductInformation(cloneRecord(record)) : null
}

export function findStyleArchiveByCode(styleCode: string): StyleArchiveShellRecord | null {
  // FCS 需求页与转单链路都从正式款式档案读取当前生效技术包版本指针。
  const matchedRecords = (memorySnapshot ?? loadSnapshot()).records.filter((item) => item.styleCode === styleCode)
  const record =
    matchedRecords.find((item) => item.styleId.startsWith('style_demand_') && Boolean(item.currentTechPackVersionId)) ??
    matchedRecords.find((item) => Boolean(item.currentTechPackVersionId)) ??
    matchedRecords.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  return record ? resolveStyleProductInformation(cloneRecord(record)) : null
}

export function findStyleArchiveByProjectId(projectId: string): StyleArchiveShellRecord | null {
  const record = loadSnapshot().records.find((item) => item.sourceProjectId === projectId)
  return record ? resolveStyleProductInformation(cloneRecord(record)) : null
}

export function hasStyleArchiveForProject(projectId: string): boolean {
  return Boolean(findStyleArchiveByProjectId(projectId))
}

export function createStyleArchiveShell(record: StyleArchiveShellRecord): StyleArchiveShellRecord {
  const snapshot = loadSnapshot()
  const normalized = normalizeRecord(record)
  assertProductStyleIdentity(normalized, snapshot.records)
  const hasProjectBinding = Boolean(normalized.sourceProjectId)
  if (
    hasProjectBinding &&
    (!normalized.sourceProjectId ||
      !normalized.sourceProjectCode ||
      !normalized.sourceProjectName ||
      !normalized.sourceProjectNodeId)
  ) {
    throw new Error('商品项目建档必须完整提供项目关联信息；无测款历史也可直接建档。')
  }
  if (snapshot.records.some((item) => item.styleId === normalized.styleId)) {
    throw new Error(`款式档案 ID ${normalized.styleId} 已存在，不能重复创建或改绑到其他商品项目。`)
  }
  if (normalized.sourceProjectId && snapshot.records.some((item) => item.sourceProjectId === normalized.sourceProjectId)) {
    throw new Error('当前商品项目已存在正式款式档案主关联。')
  }

  persistSnapshot({
    ...snapshot,
    records: [normalized, ...snapshot.records],
  })
  return cloneRecord(normalized)
}

/** ARCH-001：无测款历史、无商品项目也可直接创建 SPU 草稿档案。 */
export function createStyleArchiveDirect(input: {
  styleName: string
  styleCode?: string
  styleNameEn?: string
  styleNumber?: string
  productType?: string
  categoryName?: string
  operator?: string
}): StyleArchiveShellRecord {
  const stamp = nowText()
  const year = new Date().getFullYear()
  const prefix = `SPU-${year}-`
  const serial = Math.max(0, ...listStyleArchives().filter(item => item.styleCode.startsWith(prefix)).map(item => Number(item.styleCode.slice(prefix.length)) || 0)) + 1
  const styleCode = input.styleCode?.trim() || `${prefix}${String(serial).padStart(6, '0')}`
  const styleId = `style_${crypto.randomUUID()}`
  const base = normalizeRecord({
    styleId,
    styleCode,
    identitySource: 'MANUAL', sourceSystem: 'PCS手工建档', sourceId: '', createdById: PCS_DEMO_OPERATOR_ID, updatedById: PCS_DEMO_OPERATOR_ID,
    styleName: input.styleName.trim() || '未命名款式',
    styleNameEn: (input.styleNameEn || '').trim(),
    styleNumber: (input.styleNumber || '').trim() || styleCode,
    productType: input.productType?.trim() || '成衣',
    sourceProjectId: '',
    sourceProjectCode: '',
    sourceProjectName: '',
    sourceProjectNodeId: '',
    categoryId: '',
    categoryName: input.categoryName?.trim() || '',
    subCategoryId: '',
    subCategoryName: '',
    brandId: '',
    brandName: '',
    yearTag: String(year),
    seasonTags: [],
    styleTags: [],
    targetAudienceTags: [],
    targetChannelCodes: [],
    priceRangeLabel: '',
    archiveStatus: 'DRAFT',
    approvalStatus: 'DRAFT', lifecycleStatus: 'NOT_ENABLED', deliveryMode: 'SINGLE', recordVersion: 1,
    archiveLogs: [archiveLog('新建款式', styleCode, input.operator)], salesContents: [],
    baseInfoStatus: '待完善',
    specificationStatus: '未建立',
    techPackStatus: '未建立',
    costPricingStatus: '未建立',
    specificationCount: 0,
    techPackVersionCount: 0,
    costVersionCount: 0,
    channelProductCount: 0,
    currentTechPackVersionId: '',
    currentTechPackVersionCode: '',
    currentTechPackVersionLabel: '',
    currentTechPackVersionStatus: '',
    currentTechPackVersionActivatedAt: '',
    currentTechPackVersionActivatedBy: '',
    mainImageId: '',
    mainImageUrl: '',
    galleryImageIds: [],
    galleryImageUrls: [],
    imageSource: '',
    sellingPointText: '',
    detailDescription: '',
    packagingInfo: '',
    remark: '选品直接建档，尚无测款历史。',
    generatedAt: stamp,
    generatedBy: input.operator?.trim() || '当前用户',
    updatedAt: stamp,
    updatedBy: input.operator?.trim() || '当前用户',
    legacyOriginProject: '',
  } as unknown as StyleArchiveShellRecord)
  return createStyleArchiveShell(base)
}

export function updateStyleArchive(styleId: string, patch: Partial<StyleArchiveShellRecord>): StyleArchiveShellRecord | null {
  const current = getStyleArchiveById(styleId)
  if (current && !patch.productConfigRefs) {
    const refs = { ...current.productConfigRefs }
    for (const [field, dimension] of Object.entries(PRODUCT_CONFIG_FIELDS)) {
      if (field in patch && JSON.stringify(patch[field as keyof StyleArchiveShellRecord]) !== JSON.stringify(current[field as keyof StyleArchiveShellRecord])) delete refs[dimension]
    }
    patch = { ...patch, productConfigRefs: refs }
    if (patch.productCategoryId === undefined && ['categoryName', 'subCategoryName', 'thirdCategoryName'].some((field) => field in patch && patch[field as keyof StyleArchiveShellRecord] !== current[field as keyof StyleArchiveShellRecord])) patch.productCategoryId = ''
  }
  const snapshot = loadSnapshot()
  const index = snapshot.records.findIndex((item) => item.styleId === styleId)
  if (index < 0) return null
  const currentRecord = snapshot.records[index]
  const nextRecord = normalizeRecord({
    ...currentRecord,
    ...patch,
  })
  if (nextRecord.styleId !== currentRecord.styleId && snapshot.records.some((item, itemIndex) => itemIndex !== index && item.styleId === nextRecord.styleId)) {
    throw new Error(`款式档案 ID ${nextRecord.styleId} 已存在，不能重复创建或改绑到其他商品项目。`)
  }
  if (
    nextRecord.sourceProjectId !== currentRecord.sourceProjectId &&
    nextRecord.sourceProjectId &&
    snapshot.records.some(
      (item, itemIndex) => itemIndex !== index && item.sourceProjectId === nextRecord.sourceProjectId,
    )
  ) {
    throw new Error('当前商品项目已存在正式款式档案主关联。')
  }
  assertProductStyleIdentity(nextRecord, snapshot.records, currentRecord)
  completeProductArchiveAudit(currentRecord, nextRecord)
  nextRecord.recordVersion = (currentRecord.recordVersion || 1) + 1
  const nextRecords = [...snapshot.records]
  nextRecords.splice(index, 1, nextRecord)
  persistSnapshot({
    ...snapshot,
    records: nextRecords,
  })
  return cloneRecord(nextRecord)
}

export function listStyleArchivePendingItems(): StyleArchivePendingItem[] {
  return loadSnapshot().pendingItems.map(clonePendingItem)
}

export function pushStyleArchivePendingItem(item: StyleArchivePendingItem): void {
  const snapshot = loadSnapshot()
  if (snapshot.pendingItems.some((current) => current.pendingId === item.pendingId)) return
  persistSnapshot({
    ...snapshot,
    pendingItems: [...snapshot.pendingItems, normalizePendingItem(item)],
  })
}

export function replaceStyleArchiveStore(snapshot: StyleArchiveStoreSnapshot): void {
  persistSnapshot(snapshot)
}

export function resetStyleArchiveRepository(): void {
  const snapshot = withPcsDemoData(() => seedSnapshot())
  persistSnapshot(snapshot)
  if (canUseStorage()) {
    pcsRecordStore.removeItem(STYLE_ARCHIVE_STORAGE_KEY)
    pcsRecordStore.setItem(STYLE_ARCHIVE_STORAGE_KEY, JSON.stringify(snapshot))
  }
}

registerPcsRepositoryReset(() => { memorySnapshot = null })

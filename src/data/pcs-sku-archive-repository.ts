import { assertProductSkuIdentity, completeProductArchiveAudit, resolveProductMainUnit } from './pcs-product-archive-rules.ts'
import { hasPcsRecordSnapshot } from './pcs-record-runtime.ts'
import { pcsRecordStore, withPcsDemoData, registerPcsRepositoryReset } from './pcs-record-runtime.ts'
import { createStyleArchiveBootstrapSnapshot } from './pcs-style-archive-bootstrap.ts'
import { buildSkuFixture, migrateProductFixtureImage } from './pcs-product-archive-fixtures.ts'
import { listProductionDemandTechPackSeeds } from './pcs-production-demand-tech-pack-seeds.ts'
import { listProjectWorkspaceColors, listProjectWorkspaceSizes } from './pcs-project-config-workspace-adapter.ts'
import { listStyleArchives, updateStyleArchive } from './pcs-style-archive-repository.ts'
import { listTechnicalDataVersionsByStyleId } from './pcs-technical-data-version-repository.ts'
import type {
  SkuArchiveMappingHealth,
  SkuArchiveRecord,
  SkuArchiveStatusCode,
  SkuArchiveStoreSnapshot,
} from './pcs-sku-archive-types.ts'

const SKU_ARCHIVE_STORAGE_KEY = 'higood-pcs-sku-archive-store-v1'
const SKU_ARCHIVE_STORE_VERSION = 1

let memorySnapshot: SkuArchiveStoreSnapshot | null = null

function canUseStorage(): boolean {
  return (
    typeof pcsRecordStore !== 'undefined' &&
    typeof pcsRecordStore.getItem === 'function' &&
    typeof pcsRecordStore.setItem === 'function' &&
    typeof pcsRecordStore.removeItem === 'function'
  )
}

function cloneRecord(record: SkuArchiveRecord): SkuArchiveRecord {
  return { ...record, legacyValues: record.legacyValues ? structuredClone(record.legacyValues) : undefined, packageSpecs: record.packageSpecs?.map(item => ({ ...item })), packageSpecHistory: record.packageSpecHistory?.map(item => ({ ...item })), extraIdentityValues: record.extraIdentityValues ? { ...record.extraIdentityValues } : undefined, skuNameTranslations: record.skuNameTranslations ? { ...record.skuNameTranslations } : undefined, barcodeAliases: record.barcodeAliases ? [...record.barcodeAliases] : undefined, bundleComponents: record.bundleComponents?.map(item => ({ ...item })), archiveLogs: record.archiveLogs ? structuredClone(record.archiveLogs) : undefined }
}

function cloneSnapshot(snapshot: SkuArchiveStoreSnapshot): SkuArchiveStoreSnapshot {
  return {
    version: snapshot.version,
    records: snapshot.records.map(cloneRecord),
  }
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function toDigits(value: string): string {
  return value.replace(/\D/g, '')
}

function pickWorkspaceValues(
  workspaceValues: string[],
  preferredValues: string[],
  fallbackValues: string[],
  count: number,
): string[] {
  const normalizedWorkspace = workspaceValues.filter(Boolean)
  const preferred = preferredValues
    .map((item) => normalizedWorkspace.find((current) => current.toLowerCase() === item.toLowerCase()))
    .filter((item): item is string => Boolean(item))
  const remainder = normalizedWorkspace.filter((item) => !preferred.includes(item))
  const picked = [...preferred, ...remainder].slice(0, count)
  return picked.length > 0 ? picked : fallbackValues.slice(0, count)
}

function getWorkspaceFallbackColors(): string[] {
  return pickWorkspaceValues(
    listProjectWorkspaceColors().map((item) => item.name),
    ['Black', 'White'],
    ['Black', 'White'],
    2,
  )
}

function getWorkspaceFallbackSizes(): string[] {
  return pickWorkspaceValues(
    listProjectWorkspaceSizes().map((item) => item.name),
    ['S', 'M'],
    ['S', 'M'],
    2,
  )
}

function createFallbackSkuLines(styleCode: string): Array<{ skuCode: string; color: string; size: string }> {
  const colors = getWorkspaceFallbackColors()
  const sizes = getWorkspaceFallbackSizes()
  const records: Array<{ skuCode: string; color: string; size: string }> = []

  colors.forEach((color) => {
    sizes.forEach((size) => {
      records.push({
        skuCode: `${styleCode}-${resolveColorCode(color)}-${size}`,
        color,
        size,
      })
    })
  })

  return records
}

function resolveColorCode(colorName: string): string {
  const normalized = colorName.trim().toLowerCase()
  if (normalized.includes('黑')) return 'BLK'
  if (normalized.includes('白')) return 'WHT'
  if (normalized.includes('红')) return 'RED'
  if (normalized.includes('蓝')) return 'BLU'
  if (normalized.includes('绿')) return 'GRN'
  if (normalized.includes('黄')) return 'YLW'
  if (normalized.includes('灰')) return 'GRY'
  if (normalized.includes('粉')) return 'PNK'
  if (normalized.includes('紫')) return 'PUR'
  const ascii = normalized.replace(/[^a-z0-9]/g, '').slice(0, 3).toUpperCase()
  return ascii || 'CLR'
}

function resolvePrintName(styleName: string, index: number, explicit = ''): string {
  if (explicit.trim()) return explicit.trim()
  if (styleName.includes('印花') || styleName.includes('碎花')) {
    return `花型${String.fromCharCode(65 + (index % 4))}`
  }
  return index % 3 === 0 ? '基础款' : index % 3 === 1 ? '常规版' : '升级版'
}

function resolveWeightText(styleName: string): string {
  if (styleName.includes('外套') || styleName.includes('夹克')) return '0.85kg'
  if (styleName.includes('裙')) return '0.48kg'
  if (styleName.includes('裤')) return '0.62kg'
  return '0.36kg'
}

function resolveVolumeText(styleName: string): string {
  if (styleName.includes('外套') || styleName.includes('夹克')) return '38*28*8cm'
  if (styleName.includes('裙')) return '34*24*5cm'
  if (styleName.includes('裤')) return '36*26*6cm'
  return '30*22*4cm'
}

function normalizeRecord(record: SkuArchiveRecord): SkuArchiveRecord {
  const defaultColor = record.colorName || getWorkspaceFallbackColors()[0] || 'Black'
  const defaultSize = record.sizeName || getWorkspaceFallbackSizes()[0] || 'One Size'
  let fixture: ReturnType<typeof buildSkuFixture> | undefined
  const fallback = () => fixture ||= buildSkuFixture(record.styleCode || record.skuCode, record.styleName || record.skuCode, defaultColor, defaultSize)
  const archiveStatus: SkuArchiveStatusCode =
    record.archiveStatus === 'INACTIVE' || record.archiveStatus === 'ARCHIVED' ? record.archiveStatus : 'ACTIVE'
  const mappingHealth: SkuArchiveMappingHealth =
    record.mappingHealth === 'MISSING' || record.mappingHealth === 'CONFLICT' ? record.mappingHealth : 'OK'

  return {
    ...cloneRecord(record),
    approvalStatus: record.approvalStatus || 'APPROVED',
    lifecycleStatus: record.lifecycleStatus || archiveStatus,
    deliveryMode: record.deliveryMode || 'SINGLE', recordVersion: record.recordVersion || 1,
    compositionId: record.deliveryMode === 'VIRTUAL_BUNDLE' ? record.compositionId || `composition:${record.skuId}` : undefined,
    archiveStatus,
    mappingHealth,
    skuName: record.skuName || `${record.styleName || record.styleCode} ${record.colorName || defaultColor}/${record.sizeName || defaultSize}`,
    skuNameEn: record.skuNameEn || (record.identitySource === 'MANUAL' ? '' : fallback().skuNameEn),
    colorName: record.identitySource === 'MANUAL' ? record.colorName : record.colorName || defaultColor,
    sizeName: record.identitySource === 'MANUAL' ? record.sizeName : record.sizeName || defaultSize,
    printName: record.printName || '基础款',
    barcode: record.barcode || '',
    channelTitle: record.channelTitle || (record.identitySource === 'MANUAL' ? '' : fallback().channelTitle),
    skuImageUrl: record.identitySource === 'MANUAL' ? record.skuImageUrl : migrateProductFixtureImage(record.styleCode, record.skuImageUrl, record.colorName) || fallback().skuImageUrl,
    channelMappingCount: Number.isFinite(record.channelMappingCount) ? record.channelMappingCount : 0,
    listedChannelCount: Number.isFinite(record.listedChannelCount) ? record.listedChannelCount : 0,
    techPackVersionId: record.techPackVersionId || '',
    techPackVersionCode: record.techPackVersionCode || '',
    techPackVersionLabel: record.techPackVersionLabel || '',
    legacySystem: record.legacySystem || '',
    legacyCode: record.legacyCode || '',
    costPrice: Number.isFinite(record.costPrice) ? record.costPrice : fallback().costPrice,
    freightCost: Number.isFinite(record.freightCost) ? record.freightCost : fallback().freightCost,
    suggestedRetailPrice: Number.isFinite(record.suggestedRetailPrice) ? record.suggestedRetailPrice : fallback().suggestedRetailPrice,
    currency: record.currency || (record.identitySource === 'MANUAL' ? '' : fallback().currency),
    pricingUnit: record.pricingUnit || fallback().pricingUnit,
    mainUnitId: record.mainUnitId || resolveProductMainUnit(record.pricingUnit || fallback().pricingUnit)?.id,
    weightKg: Number.isFinite(record.weightKg) ? record.weightKg : record.identitySource === 'MANUAL' ? 0 : fallback().weightKg,
    lengthCm: Number.isFinite(record.lengthCm) ? record.lengthCm : record.identitySource === 'MANUAL' ? 0 : fallback().lengthCm,
    widthCm: Number.isFinite(record.widthCm) ? record.widthCm : record.identitySource === 'MANUAL' ? 0 : fallback().widthCm,
    heightCm: Number.isFinite(record.heightCm) ? record.heightCm : record.identitySource === 'MANUAL' ? 0 : fallback().heightCm,
    packagingInfo: record.packagingInfo || (record.identitySource === 'MANUAL' ? '' : fallback().packagingInfo),
    weightText: record.weightText || (record.identitySource === 'MANUAL' ? (record.weightKg ? `${record.weightKg}kg` : '') : `${fallback().weightKg}kg`),
    volumeText: record.volumeText || (record.identitySource === 'MANUAL' ? (record.lengthCm && record.widthCm && record.heightCm ? `${record.lengthCm}*${record.widthCm}*${record.heightCm}cm` : '') : `${fallback().lengthCm}*${fallback().widthCm}*${fallback().heightCm}cm`),
    lastListingAt: record.lastListingAt || '',
    createdAt: record.createdAt || record.updatedAt || nowText(),
    createdBy: record.createdBy || '系统初始化',
    updatedAt: record.updatedAt || record.createdAt || nowText(),
    updatedBy: record.updatedBy || '系统初始化',
    remark: record.remark || '',
  }
}

function buildSeedRecord(
  style: ReturnType<typeof listStyleArchives>[number],
  input: { skuCode: string; color: string; size: string },
  styleIndex: number,
  skuIndex: number,
): SkuArchiveRecord {
  const globalIndex = styleIndex * 20 + skuIndex + 1
  const versions = listTechnicalDataVersionsByStyleId(style.styleId)
  const latestVersion = versions[0] || null
  const mappingHealth: SkuArchiveMappingHealth =
    style.archiveStatus === 'ARCHIVED'
      ? 'MISSING'
      : globalIndex % 7 === 0
        ? 'CONFLICT'
        : globalIndex % 5 === 0 || !style.channelProductCount
          ? 'MISSING'
          : 'OK'
  const archiveStatus: SkuArchiveStatusCode =
    style.archiveStatus === 'ARCHIVED' ? 'ARCHIVED' : globalIndex % 6 === 0 ? 'INACTIVE' : 'ACTIVE'
  const channelMappingCount = archiveStatus === 'ARCHIVED' ? 0 : Math.max(1, style.channelProductCount || 1)
  const listedChannelCount =
    archiveStatus === 'ACTIVE' && mappingHealth === 'OK'
      ? channelMappingCount
      : archiveStatus === 'ACTIVE' && mappingHealth === 'MISSING'
        ? Math.max(0, channelMappingCount - 1)
        : 0
  const printName = resolvePrintName(style.styleName, skuIndex)
  const barcodeSeed = `${toDigits(style.styleCode).slice(-6) || String(styleIndex + 1).padStart(6, '0')}${String(skuIndex + 1).padStart(3, '0')}`
  const fixture = buildSkuFixture(style.styleCode, style.styleName, input.color, input.size)
  const expectedMaterials = skuIndex === 0
    ? [
        {
          materialSkuId: 'matSeed_fabric_main',
          materialSkuCode: 'FAB-COTTON-180-WHT',
          materialName: '精梳棉平纹主布',
          quantity: 1.8,
          unit: '米',
          note: '按单件净用量×1.05 损耗',
        },
        {
          materialSkuId: 'matSeed_thread_002',
          materialSkuCode: 'THREAD-40S-002-WHT',
          materialName: '40S 缝纫线（白）',
          quantity: 0.12,
          unit: '卷',
          note: '',
        },
        {
          materialSkuId: 'matSeed_elastic_wht',
          materialSkuCode: 'ACC-ELASTIC-42CM-WHITE',
          materialName: '42cm 松紧带（白）',
          quantity: 0.6,
          unit: '米',
          note: '腰口辅料',
        },
      ]
    : undefined

  return normalizeRecord({
    skuId: `skuSeed_${style.styleId}_${String(skuIndex + 1).padStart(3, '0')}`,
    skuCode: input.skuCode,
    styleId: style.styleId,
    styleCode: style.styleCode,
    styleName: style.styleName,
    skuName: `${style.styleName} ${input.color}/${input.size}`,
    skuNameEn: fixture.skuNameEn,
    colorName: input.color,
    sizeName: input.size,
    printName,
    barcode: `69${barcodeSeed}`.slice(0, 13),
    channelTitle: fixture.channelTitle,
    skuImageUrl: fixture.skuImageUrl,
    archiveStatus,
    mappingHealth,
    channelMappingCount,
    listedChannelCount,
    techPackVersionId: style.currentTechPackVersionId || latestVersion?.technicalVersionId || '',
    techPackVersionCode: style.currentTechPackVersionCode || latestVersion?.technicalVersionCode || '',
    techPackVersionLabel: style.currentTechPackVersionLabel || latestVersion?.versionLabel || '',
    legacySystem: style.legacyOriginProject ? '老系统复用' : 'ERP-A',
    legacyCode: `${style.styleCode}-${resolveColorCode(input.color)}-${input.size}`,
    costPrice: fixture.costPrice,
    freightCost: fixture.freightCost,
    suggestedRetailPrice: fixture.suggestedRetailPrice,
    currency: fixture.currency,
    pricingUnit: fixture.pricingUnit,
    weightKg: fixture.weightKg,
    lengthCm: fixture.lengthCm,
    widthCm: fixture.widthCm,
    heightCm: fixture.heightCm,
    packagingInfo: fixture.packagingInfo,
    weightText: resolveWeightText(style.styleName),
    volumeText: resolveVolumeText(style.styleName),
    lastListingAt: listedChannelCount > 0 ? style.updatedAt.slice(0, 10) : '',
    createdAt: style.generatedAt || style.updatedAt,
    createdBy: style.generatedBy || style.updatedBy,
    updatedAt: style.updatedAt,
    updatedBy: style.updatedBy,
    remark: '',
    ...(expectedMaterials ? { expectedMaterials } : {}),
  })
}

function buildSeedRecords(styles: ReturnType<typeof listStyleArchives>): SkuArchiveRecord[] {
  const seedBySpu = new Map(listProductionDemandTechPackSeeds().map((seed) => [seed.demand.spuCode, seed]))
  // Demo statuses must be stable when current styles are added or reordered.
  const baselineIndex = new Map(createStyleArchiveBootstrapSnapshot(1).records
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((style, index) => [style.styleId, index]))
  return styles.flatMap((style) => {
    const styleIndex = baselineIndex.get(style.styleId) ?? 0
    if (style.styleId.startsWith('style_r1_')) {
      const lines = style.styleId === 'style_r1_wms_tee' ? [
        { skuId: 'sku_r1_wms_tee_black_s', skuCode: 'SKU-GC-20001', color: '黑色', size: 'S' },
        { skuId: 'sku_r1_tee_white_m', skuCode: 'SPU-GC-1001-white-m', color: '白色', size: 'M' },
      ] : [{ skuId: style.styleId === 'style_r1_physical_set' ? 'sku_r1_physical_set_m' : 'sku_r1_virtual_bundle_m', skuCode: `${style.styleCode}-black-m`, color: '黑色', size: 'M' }]
      return lines.map((line, index) => ({ ...buildSeedRecord(style, line, styleIndex, index), skuId: line.skuId, skuImageUrl: line.skuId === 'sku_r1_tee_white_m' ? '/materials/pcs-reviewed/tee-white.jpg' : style.mainImageUrl, deliveryMode: style.deliveryMode,
        legacyCode: line.skuId === 'sku_r1_wms_tee_black_s' ? 'SKU-GC-20001' : '', approvalStatus: 'APPROVED' as const, lifecycleStatus: 'ACTIVE' as const, archiveStatus: 'ACTIVE' as const,
        pricingUnit: style.deliveryMode === 'SINGLE' ? '件' : '套', mainUnitId: resolveProductMainUnit(style.deliveryMode === 'SINGLE' ? '件' : '套')?.id, printName: '', patternId: '', expectedMaterials: undefined,
        ...(style.deliveryMode === 'VIRTUAL_BUNDLE' ? { compositionVersion: 1, bundleComponents: [{ skuId: 'sku_r1_wms_tee_black_s', quantity: 1 }, { skuId: 'sku_r1_tee_white_m', quantity: 1 }] } : {}),
      }))
    }
    const seed = seedBySpu.get(style.styleCode)
    const skuLines =
      seed?.demand.skuLines.map((item) => ({
        skuCode: item.skuCode || `${style.styleCode}-${resolveColorCode(item.color)}-${item.size}`,
        color: item.color,
        size: item.size,
      })) || createFallbackSkuLines(style.styleCode)

    return skuLines.map((line, skuIndex) => buildSeedRecord(style, line, styleIndex, skuIndex))
  })
}

function seedSnapshot(): SkuArchiveStoreSnapshot {
  return {
    version: SKU_ARCHIVE_STORE_VERSION,
    records: buildSeedRecords(listStyleArchives()),
  }
}

function hydrateSnapshot(snapshot: SkuArchiveStoreSnapshot): SkuArchiveStoreSnapshot {
  return {
    version: SKU_ARCHIVE_STORE_VERSION,
    records: Array.isArray(snapshot.records) ? snapshot.records.map(normalizeRecord) : [],
  }
}

function mergeMissingSeedData(snapshot: SkuArchiveStoreSnapshot): SkuArchiveStoreSnapshot {
  if (hasPcsRecordSnapshot('higood-pcs-sku-archive-store-v1')) return snapshot

  const existingStyleIds = new Set(snapshot.records.map((item) => item.styleId).filter(Boolean))
  const missingStyles = listStyleArchives().filter((style) => !existingStyleIds.has(style.styleId))
  if (missingStyles.length === 0) {
    return {
      version: SKU_ARCHIVE_STORE_VERSION,
      records: snapshot.records,
    }
  }
  const existingCodes = new Set(snapshot.records.map((item) => item.skuCode))
  const missingSeedRecords = buildSeedRecords(missingStyles)
  return {
    version: SKU_ARCHIVE_STORE_VERSION,
    records: [
      ...snapshot.records,
      ...missingSeedRecords.filter((item) => !existingCodes.has(item.skuCode)).map(cloneRecord),
    ],
  }
}

function readSnapshot(): SkuArchiveStoreSnapshot {
  if (memorySnapshot) return memorySnapshot
  if (!canUseStorage()) {
    memorySnapshot = withPcsDemoData(() => seedSnapshot())
    return memorySnapshot
  }
  let raw: string | null
  try { raw = pcsRecordStore.getItem(SKU_ARCHIVE_STORAGE_KEY) }
  catch { throw new Error('已保存 SKU 档案无法读取，请允许本机数据访问后重试；未使用空档案替换。') }
  if (raw === null) {
    memorySnapshot = withPcsDemoData(() => seedSnapshot())
    return memorySnapshot
  }
  let parsed: Partial<SkuArchiveStoreSnapshot>
  try { parsed = JSON.parse(raw) as Partial<SkuArchiveStoreSnapshot> }
  catch { throw new Error('已保存 SKU 档案格式错误，请保留原数据并核对。') }
  if (!parsed || parsed.version !== SKU_ARCHIVE_STORE_VERSION || !Array.isArray(parsed.records)) throw new Error('已保存 SKU 档案版本或记录格式错误，请保留原数据并核对。')
  memorySnapshot = mergeMissingSeedData(hydrateSnapshot({version: SKU_ARCHIVE_STORE_VERSION, records: parsed.records}))
  return memorySnapshot
}

function loadSnapshot(): SkuArchiveStoreSnapshot { return cloneSnapshot(readSnapshot()) }

function persistSnapshot(snapshot: SkuArchiveStoreSnapshot): void {
  memorySnapshot = hydrateSnapshot(snapshot)
  if (canUseStorage()) {
    pcsRecordStore.setItem(SKU_ARCHIVE_STORAGE_KEY, JSON.stringify(memorySnapshot))
  }
}

function syncStyleArchiveSpecificationCount(styleId: string): void {
  const relatedRecords = loadSnapshot().records.filter((item) => item.styleId === styleId && item.archiveStatus !== 'ARCHIVED')
  updateStyleArchive(styleId, {
    specificationCount: relatedRecords.length,
    specificationStatus: relatedRecords.length > 0 ? '已建立' : '未建立',
    updatedAt: relatedRecords[0]?.updatedAt || nowText(),
    updatedBy: relatedRecords[0]?.updatedBy || '系统同步',
  })
}

export function listSkuArchives(): SkuArchiveRecord[] {
  return readSnapshot().records.map(cloneRecord).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** List counters do not copy every SKU's attachments, packaging and audit history. */
export function getSkuArchiveCountsByStyle(): Map<string, number> {
  const counts = new Map<string, number>()
  for (const record of readSnapshot().records) counts.set(record.styleId, (counts.get(record.styleId) || 0) + 1)
  return counts
}

export function listSkuArchivesByStyleId(styleId: string): SkuArchiveRecord[] {
  return readSnapshot().records.filter(item => item.styleId === styleId).map(cloneRecord).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getSkuArchiveById(skuId: string): SkuArchiveRecord | null {
  const record = readSnapshot().records.find((item) => item.skuId === skuId)
  return record ? cloneRecord(record) : null
}

export function findSkuArchiveByCode(skuCode: string): SkuArchiveRecord | null {
  const record = readSnapshot().records.find((item) => item.skuCode === skuCode)
  return record ? cloneRecord(record) : null
}

export function createSkuArchive(record: SkuArchiveRecord): SkuArchiveRecord {
  const snapshot = loadSnapshot()
  const nextRecord = normalizeRecord(record)
  assertProductSkuIdentity(nextRecord, snapshot.records)
  if (snapshot.records.some((item) => item.skuCode === nextRecord.skuCode)) {
    throw new Error('当前规格编码已存在。')
  }

  persistSnapshot({
    version: SKU_ARCHIVE_STORE_VERSION,
    records: [nextRecord, ...snapshot.records],
  })
  syncStyleArchiveSpecificationCount(nextRecord.styleId)
  return cloneRecord(nextRecord)
}

export function createSkuArchiveBatch(records: SkuArchiveRecord[]): SkuArchiveRecord[] {
  const snapshot = loadSnapshot(), created: SkuArchiveRecord[] = []
  for (const input of records) {
    const next = normalizeRecord(input)
    assertProductSkuIdentity(next, [...snapshot.records, ...created])
    if ([...snapshot.records, ...created].some(item => item.skuId === next.skuId)) throw new Error('SKU 身份已存在。')
    created.push(next)
  }
  persistSnapshot({ ...snapshot, records: [...created, ...snapshot.records] })
  new Set(created.map(item => item.styleId)).forEach(syncStyleArchiveSpecificationCount)
  return created.map(cloneRecord)
}

export function updateSkuArchive(skuId: string, patch: Partial<SkuArchiveRecord>): SkuArchiveRecord | null {
  const snapshot = loadSnapshot()
  const index = snapshot.records.findIndex((item) => item.skuId === skuId)
  if (index < 0) return null

  const nextRecord = normalizeRecord({
    ...snapshot.records[index],
    ...patch,
  })
  assertProductSkuIdentity(nextRecord, snapshot.records, snapshot.records[index])
  completeProductArchiveAudit(snapshot.records[index], nextRecord)
  nextRecord.recordVersion = (snapshot.records[index].recordVersion || 1) + 1
  const nextRecords = [...snapshot.records]
  nextRecords.splice(index, 1, nextRecord)
  persistSnapshot({
    version: SKU_ARCHIVE_STORE_VERSION,
    records: nextRecords,
  })
  syncStyleArchiveSpecificationCount(nextRecord.styleId)
  return cloneRecord(nextRecord)
}

export function replaceSkuArchiveStore(snapshot: SkuArchiveStoreSnapshot): void {
  persistSnapshot(snapshot)
}

export function resetSkuArchiveRepository(): void {
  const snapshot = withPcsDemoData(() => seedSnapshot())
  persistSnapshot(snapshot)
  if (canUseStorage()) {
    pcsRecordStore.removeItem(SKU_ARCHIVE_STORAGE_KEY)
    pcsRecordStore.setItem(SKU_ARCHIVE_STORAGE_KEY, JSON.stringify(snapshot))
  }
}

registerPcsRepositoryReset(() => { memorySnapshot = null })

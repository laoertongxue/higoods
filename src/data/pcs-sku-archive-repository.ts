import { techPacks } from './fcs/tech-packs.ts'
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
  return typeof localStorage !== 'undefined'
}

function cloneRecord(record: SkuArchiveRecord): SkuArchiveRecord {
  return { ...record }
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
  const [defaultColor = 'Black'] = getWorkspaceFallbackColors()
  const [defaultSize = 'One Size'] = getWorkspaceFallbackSizes()
  const archiveStatus: SkuArchiveStatusCode =
    record.archiveStatus === 'INACTIVE' || record.archiveStatus === 'ARCHIVED' ? record.archiveStatus : 'ACTIVE'
  const mappingHealth: SkuArchiveMappingHealth =
    record.mappingHealth === 'MISSING' || record.mappingHealth === 'CONFLICT' ? record.mappingHealth : 'OK'

  return {
    ...cloneRecord(record),
    archiveStatus,
    mappingHealth,
    colorName: record.colorName || defaultColor,
    sizeName: record.sizeName || defaultSize,
    printName: record.printName || '基础款',
    barcode: record.barcode || '',
    channelMappingCount: Number.isFinite(record.channelMappingCount) ? record.channelMappingCount : 0,
    listedChannelCount: Number.isFinite(record.listedChannelCount) ? record.listedChannelCount : 0,
    techPackVersionId: record.techPackVersionId || '',
    techPackVersionCode: record.techPackVersionCode || '',
    techPackVersionLabel: record.techPackVersionLabel || '',
    legacySystem: record.legacySystem || '',
    legacyCode: record.legacyCode || '',
    weightText: record.weightText || '',
    volumeText: record.volumeText || '',
    lastListingAt: record.lastListingAt || '',
    lastOrderAt: record.lastOrderAt || '',
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

  return normalizeRecord({
    skuId: `sku_seed_${style.styleId}_${String(skuIndex + 1).padStart(3, '0')}`,
    skuCode: input.skuCode,
    styleId: style.styleId,
    styleCode: style.styleCode,
    styleName: style.styleName,
    colorName: input.color,
    sizeName: input.size,
    printName,
    barcode: `69${barcodeSeed}`.slice(0, 13),
    archiveStatus,
    mappingHealth,
    channelMappingCount,
    listedChannelCount,
    techPackVersionId: style.currentTechPackVersionId || latestVersion?.technicalVersionId || '',
    techPackVersionCode: style.currentTechPackVersionCode || latestVersion?.technicalVersionCode || '',
    techPackVersionLabel: style.currentTechPackVersionLabel || latestVersion?.versionLabel || '',
    legacySystem: style.legacyOriginProject ? '老系统复用' : 'ERP-A',
    legacyCode: `${style.styleCode}-${resolveColorCode(input.color)}-${input.size}`,
    weightText: resolveWeightText(style.styleName),
    volumeText: resolveVolumeText(style.styleName),
    lastListingAt: listedChannelCount > 0 ? style.updatedAt.slice(0, 10) : '',
    lastOrderAt: archiveStatus === 'ACTIVE' ? style.updatedAt.slice(0, 10) : '',
    createdAt: style.generatedAt || style.updatedAt,
    createdBy: style.generatedBy || style.updatedBy,
    updatedAt: style.updatedAt,
    updatedBy: style.updatedBy,
    remark: '',
  })
}

function seedSnapshot(): SkuArchiveStoreSnapshot {
  const styles = listStyleArchives()
  const records = styles.flatMap((style, styleIndex) => {
    const techPack = techPacks.find((item) => item.spuCode === style.styleCode)
    const skuLines =
      techPack?.skuCatalog?.map((item) => ({
        skuCode: item.skuCode || `${style.styleCode}-${resolveColorCode(item.color)}-${item.size}`,
        color: item.color,
        size: item.size,
      })) || createFallbackSkuLines(style.styleCode)

    return skuLines.map((line, skuIndex) => buildSeedRecord(style, line, styleIndex, skuIndex))
  })

  return {
    version: SKU_ARCHIVE_STORE_VERSION,
    records,
  }
}

function hydrateSnapshot(snapshot: SkuArchiveStoreSnapshot): SkuArchiveStoreSnapshot {
  return {
    version: SKU_ARCHIVE_STORE_VERSION,
    records: Array.isArray(snapshot.records) ? snapshot.records.map(normalizeRecord) : [],
  }
}

function mergeMissingSeedData(snapshot: SkuArchiveStoreSnapshot): SkuArchiveStoreSnapshot {
  const seed = seedSnapshot()
  const existingCodes = new Set(snapshot.records.map((item) => item.skuCode))
  return {
    version: SKU_ARCHIVE_STORE_VERSION,
    records: [...snapshot.records, ...seed.records.filter((item) => !existingCodes.has(item.skuCode)).map(cloneRecord)],
  }
}

function loadSnapshot(): SkuArchiveStoreSnapshot {
  if (memorySnapshot) return cloneSnapshot(memorySnapshot)

  if (!canUseStorage()) {
    memorySnapshot = seedSnapshot()
    return cloneSnapshot(memorySnapshot)
  }

  try {
    const raw = localStorage.getItem(SKU_ARCHIVE_STORAGE_KEY)
    if (!raw) {
      memorySnapshot = seedSnapshot()
      localStorage.setItem(SKU_ARCHIVE_STORAGE_KEY, JSON.stringify(memorySnapshot))
      return cloneSnapshot(memorySnapshot)
    }

    const parsed = JSON.parse(raw) as Partial<SkuArchiveStoreSnapshot>
    if (!Array.isArray(parsed.records)) {
      memorySnapshot = seedSnapshot()
      localStorage.setItem(SKU_ARCHIVE_STORAGE_KEY, JSON.stringify(memorySnapshot))
      return cloneSnapshot(memorySnapshot)
    }

    memorySnapshot = mergeMissingSeedData(
      hydrateSnapshot({
        version: SKU_ARCHIVE_STORE_VERSION,
        records: parsed.records as SkuArchiveRecord[],
      }),
    )
    localStorage.setItem(SKU_ARCHIVE_STORAGE_KEY, JSON.stringify(memorySnapshot))
    return cloneSnapshot(memorySnapshot)
  } catch {
    memorySnapshot = seedSnapshot()
    if (canUseStorage()) {
      localStorage.setItem(SKU_ARCHIVE_STORAGE_KEY, JSON.stringify(memorySnapshot))
    }
    return cloneSnapshot(memorySnapshot)
  }
}

function persistSnapshot(snapshot: SkuArchiveStoreSnapshot): void {
  memorySnapshot = hydrateSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.setItem(SKU_ARCHIVE_STORAGE_KEY, JSON.stringify(memorySnapshot))
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
  return loadSnapshot().records.map(cloneRecord).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function listSkuArchivesByStyleId(styleId: string): SkuArchiveRecord[] {
  return listSkuArchives().filter((item) => item.styleId === styleId)
}

export function getSkuArchiveById(skuId: string): SkuArchiveRecord | null {
  const record = loadSnapshot().records.find((item) => item.skuId === skuId)
  return record ? cloneRecord(record) : null
}

export function findSkuArchiveByCode(skuCode: string): SkuArchiveRecord | null {
  const record = loadSnapshot().records.find((item) => item.skuCode === skuCode)
  return record ? cloneRecord(record) : null
}

export function createSkuArchive(record: SkuArchiveRecord): SkuArchiveRecord {
  const snapshot = loadSnapshot()
  const nextRecord = normalizeRecord(record)
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
  const created = records.map((item) => createSkuArchive(item))
  const touchedStyleIds = new Set(created.map((item) => item.styleId))
  touchedStyleIds.forEach((styleId) => syncStyleArchiveSpecificationCount(styleId))
  return created
}

export function updateSkuArchive(skuId: string, patch: Partial<SkuArchiveRecord>): SkuArchiveRecord | null {
  const snapshot = loadSnapshot()
  const index = snapshot.records.findIndex((item) => item.skuId === skuId)
  if (index < 0) return null

  const nextRecord = normalizeRecord({
    ...snapshot.records[index],
    ...patch,
  })
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
  const snapshot = seedSnapshot()
  persistSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.removeItem(SKU_ARCHIVE_STORAGE_KEY)
    localStorage.setItem(SKU_ARCHIVE_STORAGE_KEY, JSON.stringify(snapshot))
  }
}

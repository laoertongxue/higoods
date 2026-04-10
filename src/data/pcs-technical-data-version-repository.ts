import { createTechnicalDataVersionBootstrapSnapshot } from './pcs-technical-data-version-bootstrap.ts'
import type {
  TechnicalAttachment,
  TechnicalBomItem,
  TechnicalColorMaterialMapping,
  TechnicalDataVersionContent,
  TechnicalDataVersionPendingItem,
  TechnicalDataVersionRecord,
  TechnicalDataVersionStoreSnapshot,
  TechnicalDomainStatus,
  TechnicalPatternDesign,
  TechnicalPatternFile,
  TechnicalProcessEntry,
  TechnicalQualityRule,
  TechnicalSizeRow,
  TechnicalVersionStatus,
} from './pcs-technical-data-version-types.ts'

const TECHNICAL_VERSION_STORAGE_KEY = 'higood-pcs-technical-data-version-store-v1'
const TECHNICAL_VERSION_STORE_VERSION = 1

let memorySnapshot: TechnicalDataVersionStoreSnapshot | null = null

const CORE_MISSING_NAME_MAP: Record<string, string> = {
  BOM: '物料清单',
  PATTERN: '纸样管理',
  PROCESS: '工序工艺',
  GRADING: '放码规则',
  QUALITY: '质检标准',
  COLOR_MATERIAL: '款色用料对应',
}

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function clonePatternFiles(items: TechnicalPatternFile[]): TechnicalPatternFile[] {
  return items.map((item) => ({
    ...item,
    pieceRows: item.pieceRows?.map((row) => ({
      ...row,
      applicableSkuCodes: [...(row.applicableSkuCodes ?? [])],
    })),
  }))
}

function cloneProcessEntries(items: TechnicalProcessEntry[]): TechnicalProcessEntry[] {
  return items.map((item) => ({
    ...item,
    detailSplitDimensions: [...(item.detailSplitDimensions ?? [])],
  }))
}

function cloneSizeTable(items: TechnicalSizeRow[]): TechnicalSizeRow[] {
  return items.map((item) => ({ ...item }))
}

function cloneBomItems(items: TechnicalBomItem[]): TechnicalBomItem[] {
  return items.map((item) => ({
    ...item,
    applicableSkuCodes: [...(item.applicableSkuCodes ?? [])],
    linkedPatternIds: [...(item.linkedPatternIds ?? [])],
    usageProcessCodes: [...(item.usageProcessCodes ?? [])],
  }))
}

function cloneQualityRules(items: TechnicalQualityRule[]): TechnicalQualityRule[] {
  return items.map((item) => ({ ...item }))
}

function cloneColorMappings(items: TechnicalColorMaterialMapping[]): TechnicalColorMaterialMapping[] {
  return items.map((item) => ({
    ...item,
    lines: item.lines.map((line) => ({
      ...line,
      applicableSkuCodes: [...(line.applicableSkuCodes ?? [])],
    })),
  }))
}

function clonePatternDesigns(items: TechnicalPatternDesign[]): TechnicalPatternDesign[] {
  return items.map((item) => ({ ...item }))
}

function cloneAttachments(items: TechnicalAttachment[]): TechnicalAttachment[] {
  return items.map((item) => ({ ...item }))
}

function cloneRecord(record: TechnicalDataVersionRecord): TechnicalDataVersionRecord {
  return {
    ...record,
    linkedPatternTaskIds: [...record.linkedPatternTaskIds],
    linkedArtworkTaskIds: [...record.linkedArtworkTaskIds],
    linkedPartTemplateIds: [...record.linkedPartTemplateIds],
    linkedPatternLibraryVersionIds: [...record.linkedPatternLibraryVersionIds],
    missingItemCodes: [...record.missingItemCodes],
    missingItemNames: [...record.missingItemNames],
  }
}

function cloneContent(content: TechnicalDataVersionContent): TechnicalDataVersionContent {
  return {
    technicalVersionId: content.technicalVersionId,
    patternFiles: clonePatternFiles(content.patternFiles),
    patternDesc: content.patternDesc,
    processEntries: cloneProcessEntries(content.processEntries),
    sizeTable: cloneSizeTable(content.sizeTable),
    bomItems: cloneBomItems(content.bomItems),
    qualityRules: cloneQualityRules(content.qualityRules),
    colorMaterialMappings: cloneColorMappings(content.colorMaterialMappings),
    patternDesigns: clonePatternDesigns(content.patternDesigns),
    attachments: cloneAttachments(content.attachments),
    legacyCompatibleCostPayload: { ...content.legacyCompatibleCostPayload },
  }
}

function clonePendingItem(item: TechnicalDataVersionPendingItem): TechnicalDataVersionPendingItem {
  return { ...item }
}

function cloneSnapshot(snapshot: TechnicalDataVersionStoreSnapshot): TechnicalDataVersionStoreSnapshot {
  return {
    version: snapshot.version,
    records: snapshot.records.map(cloneRecord),
    contents: snapshot.contents.map(cloneContent),
    pendingItems: snapshot.pendingItems.map(clonePendingItem),
  }
}

function seedSnapshot(): TechnicalDataVersionStoreSnapshot {
  return createTechnicalDataVersionBootstrapSnapshot(TECHNICAL_VERSION_STORE_VERSION)
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function buildDateKey(dateText: string): string {
  return dateText.slice(0, 10).replace(/-/g, '')
}

function normalizeVersionStatus(value: string | null | undefined): TechnicalVersionStatus {
  if (value === 'PUBLISHED' || value === 'ARCHIVED') return value
  return 'DRAFT'
}

function normalizeDomainStatus(value: string | null | undefined): TechnicalDomainStatus {
  if (value === 'DRAFT' || value === 'COMPLETE') return value
  return 'EMPTY'
}

function createEmptyContent(technicalVersionId: string): TechnicalDataVersionContent {
  return {
    technicalVersionId,
    patternFiles: [],
    patternDesc: '',
    processEntries: [],
    sizeTable: [],
    bomItems: [],
    qualityRules: [],
    colorMaterialMappings: [],
    patternDesigns: [],
    attachments: [],
    legacyCompatibleCostPayload: {},
  }
}

function normalizeContent(content: TechnicalDataVersionContent): TechnicalDataVersionContent {
  return {
    technicalVersionId: content.technicalVersionId,
    patternFiles: clonePatternFiles(Array.isArray(content.patternFiles) ? content.patternFiles : []),
    patternDesc: content.patternDesc || '',
    processEntries: cloneProcessEntries(Array.isArray(content.processEntries) ? content.processEntries : []),
    sizeTable: cloneSizeTable(Array.isArray(content.sizeTable) ? content.sizeTable : []),
    bomItems: cloneBomItems(Array.isArray(content.bomItems) ? content.bomItems : []),
    qualityRules: cloneQualityRules(Array.isArray(content.qualityRules) ? content.qualityRules : []),
    colorMaterialMappings: cloneColorMappings(
      Array.isArray(content.colorMaterialMappings) ? content.colorMaterialMappings : [],
    ),
    patternDesigns: clonePatternDesigns(Array.isArray(content.patternDesigns) ? content.patternDesigns : []),
    attachments: cloneAttachments(Array.isArray(content.attachments) ? content.attachments : []),
    legacyCompatibleCostPayload:
      content.legacyCompatibleCostPayload && typeof content.legacyCompatibleCostPayload === 'object'
        ? { ...content.legacyCompatibleCostPayload }
        : {},
  }
}

function getDomainStatus(count: number, versionStatus: TechnicalVersionStatus): TechnicalDomainStatus {
  if (count <= 0) return 'EMPTY'
  return versionStatus === 'PUBLISHED' ? 'COMPLETE' : 'DRAFT'
}

export function buildTechnicalDataDerivedState(
  versionStatus: TechnicalVersionStatus,
  content: TechnicalDataVersionContent,
): Pick<
  TechnicalDataVersionRecord,
  | 'bomStatus'
  | 'patternStatus'
  | 'processStatus'
  | 'gradingStatus'
  | 'qualityStatus'
  | 'colorMaterialStatus'
  | 'designStatus'
  | 'attachmentStatus'
  | 'bomItemCount'
  | 'patternFileCount'
  | 'processEntryCount'
  | 'gradingRuleCount'
  | 'qualityRuleCount'
  | 'colorMaterialMappingCount'
  | 'designAssetCount'
  | 'attachmentCount'
  | 'completenessScore'
  | 'missingItemCodes'
  | 'missingItemNames'
> {
  const bomItemCount = content.bomItems.length
  const patternFileCount = content.patternFiles.length
  const processEntryCount = content.processEntries.length
  const gradingRuleCount = content.sizeTable.length
  const qualityRuleCount = content.qualityRules.length
  const colorMaterialMappingCount = content.colorMaterialMappings.length
  const designAssetCount = content.patternDesigns.length
  const attachmentCount = content.attachments.length

  let completenessScore = 0
  const missingItemCodes: string[] = []

  if (bomItemCount > 0) completenessScore += 20
  else missingItemCodes.push('BOM')
  if (patternFileCount > 0) completenessScore += 20
  else missingItemCodes.push('PATTERN')
  if (processEntryCount > 0) completenessScore += 20
  else missingItemCodes.push('PROCESS')
  if (gradingRuleCount > 0) completenessScore += 15
  else missingItemCodes.push('GRADING')
  if (qualityRuleCount > 0) completenessScore += 15
  else missingItemCodes.push('QUALITY')
  if (colorMaterialMappingCount > 0) completenessScore += 10
  else missingItemCodes.push('COLOR_MATERIAL')

  return {
    bomStatus: getDomainStatus(bomItemCount, versionStatus),
    patternStatus: getDomainStatus(patternFileCount, versionStatus),
    processStatus: getDomainStatus(processEntryCount, versionStatus),
    gradingStatus: getDomainStatus(gradingRuleCount, versionStatus),
    qualityStatus: getDomainStatus(qualityRuleCount, versionStatus),
    colorMaterialStatus: getDomainStatus(colorMaterialMappingCount, versionStatus),
    designStatus: getDomainStatus(designAssetCount, versionStatus),
    attachmentStatus: getDomainStatus(attachmentCount, versionStatus),
    bomItemCount,
    patternFileCount,
    processEntryCount,
    gradingRuleCount,
    qualityRuleCount,
    colorMaterialMappingCount,
    designAssetCount,
    attachmentCount,
    completenessScore,
    missingItemCodes,
    missingItemNames: missingItemCodes.map((code) => CORE_MISSING_NAME_MAP[code] || code),
  }
}

function applyDerivedFields(
  record: TechnicalDataVersionRecord,
  content: TechnicalDataVersionContent,
): TechnicalDataVersionRecord {
  const versionStatus = normalizeVersionStatus(record.versionStatus)
  const derived = buildTechnicalDataDerivedState(versionStatus, content)
  return {
    ...cloneRecord(record),
    versionStatus,
    effectiveFlag: versionStatus === 'PUBLISHED' ? Boolean(record.effectiveFlag) : false,
    ...derived,
    publishedAt: record.publishedAt || '',
    publishedBy: record.publishedBy || '',
    createdAt: record.createdAt || record.updatedAt || nowText(),
    createdBy: record.createdBy || '系统初始化',
    updatedAt: record.updatedAt || record.createdAt || nowText(),
    updatedBy: record.updatedBy || record.createdBy || '系统初始化',
    note: record.note || '',
    legacySpuCode: record.legacySpuCode || '',
    legacyVersionLabel: record.legacyVersionLabel || '',
  }
}

function normalizeEffectiveFlags(records: TechnicalDataVersionRecord[]): TechnicalDataVersionRecord[] {
  const publishedByStyle = new Map<string, TechnicalDataVersionRecord[]>()
  records.forEach((record) => {
    if (record.versionStatus !== 'PUBLISHED') return
    const list = publishedByStyle.get(record.styleId) ?? []
    list.push(record)
    publishedByStyle.set(record.styleId, list)
  })

  const effectiveIds = new Set<string>()
  publishedByStyle.forEach((list) => {
    const preferred =
      [...list]
        .sort((a, b) => {
          if (Number(b.effectiveFlag) !== Number(a.effectiveFlag)) {
            return Number(b.effectiveFlag) - Number(a.effectiveFlag)
          }
          return b.publishedAt.localeCompare(a.publishedAt)
        })[0] ?? null
    if (preferred) effectiveIds.add(preferred.technicalVersionId)
  })

  return records.map((record) => ({
    ...record,
    effectiveFlag: record.versionStatus === 'PUBLISHED' ? effectiveIds.has(record.technicalVersionId) : false,
  }))
}

function normalizeRecord(
  rawRecord: TechnicalDataVersionRecord,
  contentMap: Map<string, TechnicalDataVersionContent>,
): TechnicalDataVersionRecord {
  const content = contentMap.get(rawRecord.technicalVersionId) ?? createEmptyContent(rawRecord.technicalVersionId)
  return applyDerivedFields(
    {
      ...cloneRecord(rawRecord),
      versionStatus: normalizeVersionStatus(rawRecord.versionStatus),
      bomStatus: normalizeDomainStatus(rawRecord.bomStatus),
      patternStatus: normalizeDomainStatus(rawRecord.patternStatus),
      processStatus: normalizeDomainStatus(rawRecord.processStatus),
      gradingStatus: normalizeDomainStatus(rawRecord.gradingStatus),
      qualityStatus: normalizeDomainStatus(rawRecord.qualityStatus),
      colorMaterialStatus: normalizeDomainStatus(rawRecord.colorMaterialStatus),
      designStatus: normalizeDomainStatus(rawRecord.designStatus),
      attachmentStatus: normalizeDomainStatus(rawRecord.attachmentStatus),
    },
    content,
  )
}

function normalizePendingItem(item: TechnicalDataVersionPendingItem): TechnicalDataVersionPendingItem {
  return {
    ...clonePendingItem(item),
    rawTechnicalCode: item.rawTechnicalCode || '',
    rawStyleField: item.rawStyleField || '',
    rawProjectField: item.rawProjectField || '',
    rawVersionLabel: item.rawVersionLabel || '',
    reason: item.reason || '未说明原因',
    discoveredAt: item.discoveredAt || nowText(),
  }
}

function hydrateSnapshot(snapshot: TechnicalDataVersionStoreSnapshot): TechnicalDataVersionStoreSnapshot {
  const contentMap = new Map<string, TechnicalDataVersionContent>()
  const contents = Array.isArray(snapshot.contents) ? snapshot.contents.map(normalizeContent) : []
  contents.forEach((content) => {
    contentMap.set(content.technicalVersionId, content)
  })

  const rawRecords = Array.isArray(snapshot.records) ? snapshot.records.map((item) => normalizeRecord(item, contentMap)) : []
  const records = normalizeEffectiveFlags(rawRecords)

  records.forEach((record) => {
    if (!contentMap.has(record.technicalVersionId)) {
      const content = createEmptyContent(record.technicalVersionId)
      contentMap.set(record.technicalVersionId, content)
      contents.push(content)
    }
  })

  return {
    version: TECHNICAL_VERSION_STORE_VERSION,
    records: records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    contents,
    pendingItems: Array.isArray(snapshot.pendingItems) ? snapshot.pendingItems.map(normalizePendingItem) : [],
  }
}

function mergeMissingSeedData(snapshot: TechnicalDataVersionStoreSnapshot): TechnicalDataVersionStoreSnapshot {
  const seed = seedSnapshot()
  const existingIds = new Set(snapshot.records.map((item) => item.technicalVersionId))
  const existingPendingIds = new Set(snapshot.pendingItems.map((item) => item.pendingId))
  const merged = hydrateSnapshot({
    version: TECHNICAL_VERSION_STORE_VERSION,
    records: [
      ...snapshot.records,
      ...seed.records.filter((item) => !existingIds.has(item.technicalVersionId)).map(cloneRecord),
    ],
    contents: [
      ...snapshot.contents,
      ...seed.contents
        .filter((item) => !existingIds.has(item.technicalVersionId))
        .map(cloneContent),
    ],
    pendingItems: [
      ...snapshot.pendingItems,
      ...seed.pendingItems.filter((item) => !existingPendingIds.has(item.pendingId)).map(clonePendingItem),
    ],
  })
  return merged
}

function loadSnapshot(): TechnicalDataVersionStoreSnapshot {
  if (memorySnapshot) return cloneSnapshot(memorySnapshot)

  if (!canUseStorage()) {
    memorySnapshot = seedSnapshot()
    return cloneSnapshot(memorySnapshot)
  }

  try {
    const raw = localStorage.getItem(TECHNICAL_VERSION_STORAGE_KEY)
    if (!raw) {
      memorySnapshot = seedSnapshot()
      localStorage.setItem(TECHNICAL_VERSION_STORAGE_KEY, JSON.stringify(memorySnapshot))
      return cloneSnapshot(memorySnapshot)
    }
    const parsed = JSON.parse(raw) as Partial<TechnicalDataVersionStoreSnapshot>
    if (!Array.isArray(parsed.records) || !Array.isArray(parsed.contents) || !Array.isArray(parsed.pendingItems)) {
      memorySnapshot = seedSnapshot()
      localStorage.setItem(TECHNICAL_VERSION_STORAGE_KEY, JSON.stringify(memorySnapshot))
      return cloneSnapshot(memorySnapshot)
    }

    memorySnapshot = mergeMissingSeedData(
      hydrateSnapshot({
        version: TECHNICAL_VERSION_STORE_VERSION,
        records: parsed.records as TechnicalDataVersionRecord[],
        contents: parsed.contents as TechnicalDataVersionContent[],
        pendingItems: parsed.pendingItems as TechnicalDataVersionPendingItem[],
      }),
    )
    localStorage.setItem(TECHNICAL_VERSION_STORAGE_KEY, JSON.stringify(memorySnapshot))
    return cloneSnapshot(memorySnapshot)
  } catch {
    memorySnapshot = seedSnapshot()
    if (canUseStorage()) {
      localStorage.setItem(TECHNICAL_VERSION_STORAGE_KEY, JSON.stringify(memorySnapshot))
    }
    return cloneSnapshot(memorySnapshot)
  }
}

function persistSnapshot(snapshot: TechnicalDataVersionStoreSnapshot): void {
  memorySnapshot = hydrateSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.setItem(TECHNICAL_VERSION_STORAGE_KEY, JSON.stringify(memorySnapshot))
  }
}

function nextDailySequence(dateKey: string): number {
  return loadSnapshot().records.filter((item) => buildDateKey(item.createdAt || item.updatedAt) === dateKey).length + 1
}

export function buildTechnicalVersionId(dateKey: string, sequence: number): string {
  return `tdv_${dateKey}_${String(sequence).padStart(3, '0')}`
}

export function buildTechnicalVersionCode(dateKey: string, sequence: number): string {
  return `TDV-${dateKey}-${String(sequence).padStart(3, '0')}`
}

export function getNextTechnicalVersionIdentity() {
  const timestamp = nowText()
  const dateKey = buildDateKey(timestamp)
  const sequence = nextDailySequence(dateKey)
  return {
    timestamp,
    dateKey,
    sequence,
    technicalVersionId: buildTechnicalVersionId(dateKey, sequence),
    technicalVersionCode: buildTechnicalVersionCode(dateKey, sequence),
  }
}

export function getNextStyleVersionMeta(styleId: string): { versionNo: number; versionLabel: string } {
  const current = listTechnicalDataVersionsByStyleId(styleId)
  const versionNo = current.length + 1
  return {
    versionNo,
    versionLabel: `V${versionNo}`,
  }
}

export function getTechnicalDataVersionStoreSnapshot(): TechnicalDataVersionStoreSnapshot {
  return loadSnapshot()
}

export function listTechnicalDataVersions(): TechnicalDataVersionRecord[] {
  return loadSnapshot().records.map(cloneRecord).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getTechnicalDataVersionById(technicalVersionId: string): TechnicalDataVersionRecord | null {
  const record = loadSnapshot().records.find((item) => item.technicalVersionId === technicalVersionId)
  return record ? cloneRecord(record) : null
}

export function getTechnicalDataVersionContent(technicalVersionId: string): TechnicalDataVersionContent | null {
  const content = loadSnapshot().contents.find((item) => item.technicalVersionId === technicalVersionId)
  return content ? cloneContent(content) : null
}

export function listTechnicalDataVersionsByStyleId(styleId: string): TechnicalDataVersionRecord[] {
  return loadSnapshot()
    .records
    .filter((item) => item.styleId === styleId)
    .sort((a, b) => b.versionNo - a.versionNo || b.updatedAt.localeCompare(a.updatedAt))
    .map(cloneRecord)
}

export function listTechnicalDataVersionsByProjectId(projectId: string): TechnicalDataVersionRecord[] {
  return loadSnapshot()
    .records
    .filter((item) => item.sourceProjectId === projectId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(cloneRecord)
}

export function getEffectiveTechnicalDataVersionByStyleId(styleId: string): TechnicalDataVersionRecord | null {
  const record = loadSnapshot().records.find((item) => item.styleId === styleId && item.effectiveFlag)
  return record ? cloneRecord(record) : null
}

export function createTechnicalDataVersionDraft(
  record: TechnicalDataVersionRecord,
  content?: TechnicalDataVersionContent,
): TechnicalDataVersionRecord {
  const snapshot = loadSnapshot()
  const normalizedContent = normalizeContent(content ?? createEmptyContent(record.technicalVersionId))
  const normalizedRecord = normalizeRecord(record, new Map([[record.technicalVersionId, normalizedContent]]))
  persistSnapshot({
    version: TECHNICAL_VERSION_STORE_VERSION,
    records: [normalizedRecord, ...snapshot.records.filter((item) => item.technicalVersionId !== normalizedRecord.technicalVersionId)],
    contents: [normalizedContent, ...snapshot.contents.filter((item) => item.technicalVersionId !== normalizedRecord.technicalVersionId)],
    pendingItems: snapshot.pendingItems,
  })
  return cloneRecord(normalizedRecord)
}

export function updateTechnicalDataVersionRecord(
  technicalVersionId: string,
  patch: Partial<TechnicalDataVersionRecord>,
): TechnicalDataVersionRecord | null {
  const snapshot = loadSnapshot()
  const index = snapshot.records.findIndex((item) => item.technicalVersionId === technicalVersionId)
  if (index < 0) return null
  const content = snapshot.contents.find((item) => item.technicalVersionId === technicalVersionId) ?? createEmptyContent(technicalVersionId)
  const nextRecord = normalizeRecord(
    {
      ...snapshot.records[index],
      ...patch,
    },
    new Map([[technicalVersionId, content]]),
  )
  const nextRecords = [...snapshot.records]
  nextRecords.splice(index, 1, nextRecord)
  persistSnapshot({
    ...snapshot,
    records: nextRecords,
  })
  return cloneRecord(nextRecord)
}

export function updateTechnicalDataVersionContent(
  technicalVersionId: string,
  patch: Partial<TechnicalDataVersionContent>,
): TechnicalDataVersionContent | null {
  const snapshot = loadSnapshot()
  const contentIndex = snapshot.contents.findIndex((item) => item.technicalVersionId === technicalVersionId)
  const base = contentIndex >= 0 ? snapshot.contents[contentIndex] : createEmptyContent(technicalVersionId)
  const nextContent = normalizeContent({
    ...base,
    ...patch,
    technicalVersionId,
  })
  const nextContents = [...snapshot.contents]
  if (contentIndex >= 0) nextContents.splice(contentIndex, 1, nextContent)
  else nextContents.push(nextContent)

  const recordIndex = snapshot.records.findIndex((item) => item.technicalVersionId === technicalVersionId)
  const nextRecords = [...snapshot.records]
  if (recordIndex >= 0) {
    nextRecords.splice(
      recordIndex,
      1,
      normalizeRecord(snapshot.records[recordIndex], new Map([[technicalVersionId, nextContent]])),
    )
  }

  persistSnapshot({
    version: TECHNICAL_VERSION_STORE_VERSION,
    records: nextRecords,
    contents: nextContents,
    pendingItems: snapshot.pendingItems,
  })
  return cloneContent(nextContent)
}

export function publishTechnicalDataVersionRecord(
  technicalVersionId: string,
  publishedAt: string,
  publishedBy: string,
): TechnicalDataVersionRecord | null {
  const snapshot = loadSnapshot()
  const target = snapshot.records.find((item) => item.technicalVersionId === technicalVersionId)
  if (!target) return null
  const nextRecords = snapshot.records.map((item) => {
    if (item.styleId !== target.styleId) return item
    if (item.technicalVersionId === technicalVersionId) {
      return normalizeRecord(
        {
          ...item,
          versionStatus: 'PUBLISHED',
          effectiveFlag: true,
          publishedAt,
          publishedBy,
          updatedAt: publishedAt,
          updatedBy: publishedBy,
        },
        new Map([
          [
            item.technicalVersionId,
            snapshot.contents.find((content) => content.technicalVersionId === item.technicalVersionId) ??
              createEmptyContent(item.technicalVersionId),
          ],
        ]),
      )
    }
    return normalizeRecord(
      {
        ...item,
        effectiveFlag: false,
      },
      new Map([
        [
          item.technicalVersionId,
          snapshot.contents.find((content) => content.technicalVersionId === item.technicalVersionId) ??
            createEmptyContent(item.technicalVersionId),
        ],
      ]),
    )
  })
  persistSnapshot({
    ...snapshot,
    records: normalizeEffectiveFlags(nextRecords),
  })
  return getTechnicalDataVersionById(technicalVersionId)
}

export function archiveTechnicalDataVersionRecord(
  technicalVersionId: string,
  updatedAt: string,
  updatedBy: string,
): TechnicalDataVersionRecord | null {
  return updateTechnicalDataVersionRecord(technicalVersionId, {
    versionStatus: 'ARCHIVED',
    effectiveFlag: false,
    updatedAt,
    updatedBy,
  })
}

export function listTechnicalDataVersionPendingItems(): TechnicalDataVersionPendingItem[] {
  return loadSnapshot().pendingItems.map(clonePendingItem)
}

export function pushTechnicalDataVersionPendingItem(item: TechnicalDataVersionPendingItem): void {
  const snapshot = loadSnapshot()
  if (snapshot.pendingItems.some((current) => current.pendingId === item.pendingId)) return
  persistSnapshot({
    ...snapshot,
    pendingItems: [...snapshot.pendingItems, normalizePendingItem(item)],
  })
}

export function replaceTechnicalDataVersionStore(snapshot: TechnicalDataVersionStoreSnapshot): void {
  persistSnapshot(snapshot)
}

export function resetTechnicalDataVersionRepository(): void {
  const snapshot = seedSnapshot()
  persistSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.removeItem(TECHNICAL_VERSION_STORAGE_KEY)
    localStorage.setItem(TECHNICAL_VERSION_STORAGE_KEY, JSON.stringify(snapshot))
  }
}

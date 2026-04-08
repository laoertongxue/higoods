import {
  type ParsedPartInstance,
  suggestStandardPartName,
} from '../utils/pcs-part-template-parser'
import { getBrowserLocalStorage } from './browser-storage'

export interface PartTemplatePackage {
  id: string
  templateName: string
  sourceDxfFileName: string
  sourceRulFileName: string
  parsedAt: string
  rulSummary: {
    units?: string
    sampleSize?: string
    sizeList: string[]
  }
}

export interface PartTemplateRecord {
  id: string
  templatePackageId: string
  templateName: string
  sourceDxfFileName: string
  sourceRulFileName: string
  parsedAt: string
  updatedAt: string

  standardPartName: string
  sourcePartName: string
  systemPieceName?: string
  candidatePartNames: string[]
  sizeCode?: string
  quantity?: string
  annotation?: string
  category?: string

  width?: number
  height?: number
  area?: number
  perimeter?: number
  geometryHash?: string
  previewSvg?: string

  parserStatus: '解析成功' | '待人工矫正' | '解析异常'
  machineReadyStatus: '可模板机处理' | '待评估' | '不适用'

  reuseHitCount: number
  hotStyleCount: number
  cumulativeOrderQty: number
  lastMatchedAt?: string
  hotStyleNames: string[]
}

export interface PartTemplateDraftSaveRow {
  part: ParsedPartInstance
  standardPartName: string
}

export interface PartTemplateRecommendation {
  record: PartTemplateRecord
  matchScore: number
  reasons: string[]
}

interface PartTemplateStore {
  packages: PartTemplatePackage[]
  records: PartTemplateRecord[]
}

const PART_TEMPLATE_STORAGE_KEY = 'pcs-part-template-library-v1'

let cachedStore: PartTemplateStore | null = null

function getStorage(): Storage | null {
  const storage = getBrowserLocalStorage()
  if (!storage || typeof storage.setItem !== 'function') return null
  return storage as Storage
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s_\-./\\()[\]{}，。:：;；、]+/g, '')
    .trim()
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function createSeedHash(seed: string): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash >>> 0)
}

function formatDateTime(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function getDefaultStore(): PartTemplateStore {
  return {
    packages: [],
    records: [],
  }
}

function loadStore(): PartTemplateStore {
  if (cachedStore) return cachedStore

  const storage = getStorage()
  if (!storage) {
    cachedStore = getDefaultStore()
    return cachedStore
  }

  try {
    const raw = storage.getItem(PART_TEMPLATE_STORAGE_KEY)
    if (!raw) {
      cachedStore = getDefaultStore()
      return cachedStore
    }

    const parsed = JSON.parse(raw) as PartTemplateStore
    cachedStore = {
      packages: Array.isArray(parsed.packages) ? parsed.packages : [],
      records: Array.isArray(parsed.records) ? parsed.records : [],
    }
    return cachedStore
  } catch {
    cachedStore = getDefaultStore()
    return cachedStore
  }
}

function persistStore(store: PartTemplateStore): void {
  cachedStore = store
  const storage = getStorage()
  if (!storage) return

  try {
    storage.setItem(PART_TEMPLATE_STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Ignore persistence failures in prototype mode.
  }
}

function pickStyleNames(seed: number, sourcePartName: string): string[] {
  const stylePool = [
    '春夏爆款衬衣领',
    '基础商务衬衫',
    '轻熟通勤连衣裙',
    '印尼直播热销款',
    '返单高频基础款',
    '快反爆款立领衫',
  ]
  const names: string[] = []
  const preferred = sourcePartName.includes('领')
    ? ['春夏爆款衬衣领', '快反爆款立领衫']
    : sourcePartName.includes('袖口')
      ? ['基础商务衬衫', '返单高频基础款']
      : []

  for (const name of preferred) {
    if (!names.includes(name)) names.push(name)
  }

  while (names.length < Math.max(1, Math.min(3, (seed % 3) + 1))) {
    const nextName = stylePool[(seed + names.length * 7) % stylePool.length]
    if (!names.includes(nextName)) {
      names.push(nextName)
    } else {
      break
    }
  }

  return names
}

function buildStats(seedInput: string, sourcePartName: string): Pick<
  PartTemplateRecord,
  'reuseHitCount' | 'hotStyleCount' | 'cumulativeOrderQty' | 'lastMatchedAt' | 'hotStyleNames'
> {
  const seed = createSeedHash(seedInput)
  const reuseHitCount = 6 + (seed % 37)
  const hotStyleCount = 1 + (seed % 6)
  const cumulativeOrderQty = 320 + (seed % 6200)
  const daysAgo = seed % 28
  const lastMatchedDate = new Date()
  lastMatchedDate.setDate(lastMatchedDate.getDate() - daysAgo)

  return {
    reuseHitCount,
    hotStyleCount,
    cumulativeOrderQty,
    lastMatchedAt: formatDateTime(lastMatchedDate),
    hotStyleNames: pickStyleNames(seed, sourcePartName),
  }
}

function buildRecordFromPart(params: {
  packageId: string
  templateName: string
  sourceDxfFileName: string
  sourceRulFileName: string
  parsedAt: string
  row: PartTemplateDraftSaveRow
}): PartTemplateRecord {
  const { packageId, templateName, sourceDxfFileName, sourceRulFileName, parsedAt, row } = params
  const part = row.part
  const standardPartName = row.standardPartName.trim() || suggestStandardPartName(part)
  const seedInput = `${templateName}|${part.sourceBlockName}|${part.geometryHash ?? part.sourcePartName}`
  const metrics = part.metrics
  const stats = buildStats(seedInput, part.sourcePartName)

  return {
    id: createId('PTR'),
    templatePackageId: packageId,
    templateName,
    sourceDxfFileName,
    sourceRulFileName,
    parsedAt,
    updatedAt: parsedAt,
    standardPartName,
    sourcePartName: part.sourcePartName,
    systemPieceName: part.systemPieceName,
    candidatePartNames: part.candidatePartNames,
    sizeCode: part.sizeCode,
    quantity: part.quantity,
    annotation: part.annotation,
    category: part.category,
    width: metrics?.width,
    height: metrics?.height,
    area: metrics?.area,
    perimeter: metrics?.perimeter,
    geometryHash: part.geometryHash,
    previewSvg: part.previewSvg,
    parserStatus:
      metrics && standardPartName
        ? '解析成功'
        : metrics
          ? '待人工矫正'
          : '解析异常',
    machineReadyStatus: part.machineReadyStatus,
    reuseHitCount: stats.reuseHitCount,
    hotStyleCount: stats.hotStyleCount,
    cumulativeOrderQty: stats.cumulativeOrderQty,
    lastMatchedAt: stats.lastMatchedAt,
    hotStyleNames: stats.hotStyleNames,
  }
}

export function listPartTemplatePackages(): PartTemplatePackage[] {
  return [...loadStore().packages]
}

export function listPartTemplateRecords(): PartTemplateRecord[] {
  return [...loadStore().records].sort((left, right) => {
    const timeDelta = new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    if (timeDelta !== 0) return timeDelta
    return right.reuseHitCount - left.reuseHitCount
  })
}

export function getPartTemplateRecordById(recordId: string): PartTemplateRecord | null {
  return loadStore().records.find((record) => record.id === recordId) ?? null
}

export function listSiblingPartTemplateRecords(templatePackageId: string): PartTemplateRecord[] {
  return listPartTemplateRecords().filter((record) => record.templatePackageId === templatePackageId)
}

export function savePartTemplatePackage(params: {
  templateName: string
  sourceDxfFileName: string
  sourceRulFileName: string
  rulSummary: PartTemplatePackage['rulSummary']
  rows: PartTemplateDraftSaveRow[]
}): { templatePackage: PartTemplatePackage; records: PartTemplateRecord[] } {
  const store = loadStore()
  const parsedAt = formatDateTime(new Date())
  const templatePackage: PartTemplatePackage = {
    id: createId('PTPKG'),
    templateName: params.templateName.trim(),
    sourceDxfFileName: params.sourceDxfFileName,
    sourceRulFileName: params.sourceRulFileName,
    parsedAt,
    rulSummary: params.rulSummary,
  }

  const records = params.rows.map((row) =>
    buildRecordFromPart({
      packageId: templatePackage.id,
      templateName: templatePackage.templateName,
      sourceDxfFileName: templatePackage.sourceDxfFileName,
      sourceRulFileName: templatePackage.sourceRulFileName,
      parsedAt,
      row,
    }),
  )

  persistStore({
    packages: [templatePackage, ...store.packages],
    records: [...records, ...store.records],
  })

  return { templatePackage, records }
}

export function updatePartTemplateRecord(
  recordId: string,
  patch: Partial<Pick<PartTemplateRecord, 'standardPartName' | 'parserStatus' | 'machineReadyStatus'>>,
): PartTemplateRecord | null {
  const store = loadStore()
  const target = store.records.find((record) => record.id === recordId)
  if (!target) return null

  const nextRecord: PartTemplateRecord = {
    ...target,
    ...patch,
    standardPartName: patch.standardPartName?.trim() ?? target.standardPartName,
    updatedAt: formatDateTime(new Date()),
  }

  const nextStore: PartTemplateStore = {
    ...store,
    records: store.records.map((record) => (record.id === recordId ? nextRecord : record)),
  }

  persistStore(nextStore)
  return nextRecord
}

function calculateNameScore(part: ParsedPartInstance, record: PartTemplateRecord): { score: number; reason?: string } {
  const sourceNames = [
    part.sourcePartName,
    part.systemPieceName ?? '',
    ...part.candidatePartNames,
  ]
    .map(normalizeText)
    .filter(Boolean)

  const recordNames = [
    record.standardPartName,
    record.sourcePartName,
    record.systemPieceName ?? '',
    ...record.candidatePartNames,
  ]
    .map(normalizeText)
    .filter(Boolean)

  const standardHit = sourceNames.some((name) => normalizeText(record.standardPartName) === name)
  if (standardHit) {
    return {
      score: 38,
      reason: `部位名命中：与模板标准部位“${record.standardPartName}”一致`,
    }
  }

  const candidateHit = sourceNames.find((name) => recordNames.includes(name))
  if (candidateHit) {
    const matchedText =
      [part.sourcePartName, part.systemPieceName ?? '', ...part.candidatePartNames].find(
        (value) => normalizeText(value) === candidateHit,
      ) ?? part.sourcePartName

    return {
      score: 25,
      reason: `候选名命中：识别文本“${matchedText}”与模板候选名重合`,
    }
  }

  return { score: 0 }
}

function calculateSizeScore(part: ParsedPartInstance, record: PartTemplateRecord): { score: number; reason?: string } {
  if (!part.sizeCode || !record.sizeCode) return { score: 0 }
  if (normalizeText(part.sizeCode) !== normalizeText(record.sizeCode)) return { score: 0 }
  return {
    score: 12,
    reason: `尺码命中：待匹配尺码 ${part.sizeCode} 与模板尺码一致`,
  }
}

function calculateGeometryScore(part: ParsedPartInstance, record: PartTemplateRecord): { score: number; reasons: string[] } {
  if (!part.metrics || !record.width || !record.height || !record.area) {
    return { score: 0, reasons: [] }
  }

  const partRatio = part.metrics.width > 0 ? part.metrics.width / Math.max(part.metrics.height, 1) : 0
  const recordRatio = record.width > 0 ? record.width / Math.max(record.height ?? 1, 1) : 0
  const ratioGap = recordRatio === 0 ? 1 : Math.abs(partRatio - recordRatio) / recordRatio
  const areaGap = record.area === 0 ? 1 : Math.abs(part.metrics.area - record.area) / record.area
  let score = 0
  const reasons: string[] = []

  if (ratioGap <= 0.03) {
    score += 12
    reasons.push(`几何尺寸接近：宽高比偏差 ${(ratioGap * 100).toFixed(1)}%`)
  } else if (ratioGap <= 0.08) {
    score += 8
    reasons.push(`几何尺寸接近：宽高比偏差 ${(ratioGap * 100).toFixed(1)}%`)
  }

  if (areaGap <= 0.06) {
    score += 11
    reasons.push(`面积接近：面积偏差 ${(areaGap * 100).toFixed(1)}%`)
  } else if (areaGap <= 0.15) {
    score += 6
    reasons.push(`面积接近：面积偏差 ${(areaGap * 100).toFixed(1)}%`)
  }

  if (part.geometryHash && record.geometryHash && part.geometryHash === record.geometryHash) {
    score += 10
    reasons.push('几何哈希命中：外轮廓归一化形状一致')
  }

  return { score, reasons }
}

function calculateHistoryScore(record: PartTemplateRecord): { score: number; reason: string } {
  const score = Math.min(
    18,
    Math.round(record.reuseHitCount * 0.18 + record.hotStyleCount * 1.5 + record.cumulativeOrderQty / 1600),
  )

  return {
    score,
    reason: `历史复用：命中 ${record.reuseHitCount} 次，爆款 ${record.hotStyleCount} 次，累计下单 ${record.cumulativeOrderQty} 件`,
  }
}

export function recommendPartTemplateRecords(
  part: ParsedPartInstance,
  limit = 3,
): PartTemplateRecommendation[] {
  return listPartTemplateRecords()
    .map((record) => {
      const reasons: string[] = []
      const name = calculateNameScore(part, record)
      const size = calculateSizeScore(part, record)
      const geometry = calculateGeometryScore(part, record)
      const history = calculateHistoryScore(record)

      if (name.reason) reasons.push(name.reason)
      if (size.reason) reasons.push(size.reason)
      reasons.push(...geometry.reasons)
      reasons.push(history.reason)

      const matchScore = Math.max(16, Math.min(99, name.score + size.score + geometry.score + history.score))

      return {
        record,
        matchScore,
        reasons,
      }
    })
    .sort((left, right) => {
      if (right.matchScore !== left.matchScore) return right.matchScore - left.matchScore
      if (right.record.reuseHitCount !== left.record.reuseHitCount) {
        return right.record.reuseHitCount - left.record.reuseHitCount
      }
      return right.record.cumulativeOrderQty - left.record.cumulativeOrderQty
    })
    .slice(0, limit)
}

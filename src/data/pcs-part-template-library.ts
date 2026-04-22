import {
  type ParsedPartInstance,
  suggestStandardPartName,
} from '../utils/pcs-part-template-parser'
import type { PartGeometryFeatures } from '../utils/pcs-part-template-geometry'
import { buildPartShapeDescription, type PartShapeDescription } from '../utils/pcs-part-template-shape-description'
import { scorePartTemplateRecommendation } from '../utils/pcs-part-template-recommendation'
import { getBrowserLocalStorage } from './browser-storage'

export interface PartTemplatePackage {
  id: string
  templateName: string
  sourceDxfFileName: string
  sourceRulFileName: string
  sourceDxfFileDownloadUrl?: string
  sourceRulFileDownloadUrl?: string
  parsedAt: string
  rulSummary: {
    units?: string
    sampleSize?: string
    sizeList: string[]
    rawRuleSummary?: unknown
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
  sourceMarkerText?: string
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
  normalizedShapeSignature?: string
  previewSvg?: string
  geometryFeatures: PartGeometryFeatures | null
  shapeDescription: PartShapeDescription | null

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

function buildSeedPreviewSvg(label: string, fill: string): string {
  return `
    <svg viewBox="0 0 160 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">
      <rect width="160" height="120" rx="12" fill="#f8fafc" />
      <path d="M30 28c10-8 26-8 36 0l16 14 16-14c10-8 26-8 36 0l-12 24v40c0 10-8 18-18 18H60c-10 0-18-8-18-18V52L30 28Z" fill="${fill}" stroke="#334155" stroke-width="4" stroke-linejoin="round" />
      <text x="80" y="104" font-size="12" text-anchor="middle" fill="#0f172a">${label}</text>
    </svg>
  `.trim()
}

function createSeedRecord(input: {
  id: string
  templatePackageId: string
  templateName: string
  standardPartName: string
  sourcePartName: string
  sizeCode?: string
  quantity?: string
  category?: string
  previewSvg: string
  width: number
  height: number
  area: number
  perimeter: number
  normalizedShapeSignature: string
  parserStatus: PartTemplateRecord['parserStatus']
  machineReadyStatus: PartTemplateRecord['machineReadyStatus']
  hotStyleNames: string[]
}): PartTemplateRecord {
  const geometryFeatures = createFallbackGeometryFeatures({
    width: input.width,
    height: input.height,
    area: input.area,
    perimeter: input.perimeter,
    normalizedShapeSignature: input.normalizedShapeSignature,
  })

  return normalizeRecord({
    id: input.id,
    templatePackageId: input.templatePackageId,
    templateName: input.templateName,
    sourceDxfFileName: `${input.templateName}.dxf`,
    sourceRulFileName: `${input.templateName}.rul`,
    parsedAt: '2026-04-20 09:20',
    updatedAt: '2026-04-20 09:20',
    standardPartName: input.standardPartName,
    sourcePartName: input.sourcePartName,
    systemPieceName: input.standardPartName,
    sourceMarkerText: input.sourcePartName,
    candidatePartNames: [input.standardPartName, input.sourcePartName],
    sizeCode: input.sizeCode,
    quantity: input.quantity,
    annotation: '',
    category: input.category,
    width: input.width,
    height: input.height,
    area: input.area,
    perimeter: input.perimeter,
    geometryHash: `${input.id}-geo`,
    normalizedShapeSignature: input.normalizedShapeSignature,
    previewSvg: input.previewSvg,
    geometryFeatures,
    shapeDescription: buildPartShapeDescription(geometryFeatures),
    parserStatus: input.parserStatus,
    machineReadyStatus: input.machineReadyStatus,
    reuseHitCount: 18,
    hotStyleCount: input.hotStyleNames.length,
    cumulativeOrderQty: 1680,
    lastMatchedAt: '2026-04-19 16:30',
    hotStyleNames: input.hotStyleNames,
  })
}

function getDefaultStore(): PartTemplateStore {
  const packageId = 'ptpkg-seed-shirt-core'
  const templatePackage: PartTemplatePackage = {
    id: packageId,
    templateName: '衬衫基础模板包',
    sourceDxfFileName: 'shirt-core.dxf',
    sourceRulFileName: 'shirt-core.rul',
    parsedAt: '2026-04-20 09:20',
    rulSummary: {
      units: 'cm',
      sampleSize: 'M',
      sizeList: ['S', 'M', 'L', 'XL'],
    },
  }

  return {
    packages: [templatePackage],
    records: [
      createSeedRecord({
        id: 'PT-001',
        templatePackageId: packageId,
        templateName: '前片基础模板',
        standardPartName: '前片',
        sourcePartName: 'FRONT_PANEL',
        sizeCode: 'M',
        quantity: '2',
        category: '主体片',
        previewSvg: buildSeedPreviewSvg('前片', '#dbeafe'),
        width: 42,
        height: 68,
        area: 2400,
        perimeter: 210,
        normalizedShapeSignature: '42-68-2400-210',
        parserStatus: '解析成功',
        machineReadyStatus: '可模板机处理',
        hotStyleNames: ['春夏休闲T恤', '基础衬衫'],
      }),
      createSeedRecord({
        id: 'PT-002',
        templatePackageId: packageId,
        templateName: '后片基础模板',
        standardPartName: '后片',
        sourcePartName: 'BACK_PANEL',
        sizeCode: 'M',
        quantity: '2',
        category: '主体片',
        previewSvg: buildSeedPreviewSvg('后片', '#dcfce7'),
        width: 40,
        height: 70,
        area: 2360,
        perimeter: 208,
        normalizedShapeSignature: '40-70-2360-208',
        parserStatus: '解析成功',
        machineReadyStatus: '可模板机处理',
        hotStyleNames: ['运动上衣', '基础衬衫'],
      }),
      createSeedRecord({
        id: 'PT-003',
        templatePackageId: packageId,
        templateName: '袖片通用模板',
        standardPartName: '袖片',
        sourcePartName: 'SLEEVE',
        sizeCode: 'M',
        quantity: '2',
        category: '结构片',
        previewSvg: buildSeedPreviewSvg('袖片', '#fef3c7'),
        width: 28,
        height: 52,
        area: 1320,
        perimeter: 164,
        normalizedShapeSignature: '28-52-1320-164',
        parserStatus: '解析成功',
        machineReadyStatus: '待评估',
        hotStyleNames: ['运动外套', '针织卫衣'],
      }),
    ],
  }
}

function createFallbackGeometryFeatures(record: Pick<PartTemplateRecord, 'width' | 'height' | 'area' | 'perimeter' | 'normalizedShapeSignature'>): PartGeometryFeatures {
  const width = record.width ?? 0
  const height = record.height ?? 0
  const area = record.area ?? 0
  const perimeter = record.perimeter ?? 0
  const normalizedShapeSignature =
    record.normalizedShapeSignature ??
    `${width.toFixed(2)},${height.toFixed(2)},${area.toFixed(2)},${perimeter.toFixed(2)}`

  return {
    bboxWidth: width,
    bboxHeight: height,
    area,
    perimeter,
    aspectRatio: height > 0 ? width / height : width,
    symmetryScore: 0.2,
    taperRatio: 1,
    headWidth: width * 0.8,
    midWidth: width,
    tailWidth: width * 0.8,
    curveRate: 0.3,
    straightRate: 0.7,
    cornerCount: 4,
    majorArcCount: 1,
    maxSagitta: 0,
    avgSagitta: 0,
    maxEstimatedRadius: null,
    curvatureLevel: 'slight',
    outerBoundaryCount: 1,
    innerBoundaryCount: 0,
    innerHoleCount: 0,
    grainLineCount: 0,
    grainLineAngle: null,
    notchCountEstimate: 0,
    pointCount: 0,
    complexityLevel: 'medium',
    normalizedShapeSignature,
  }
}

function normalizeRecord(record: PartTemplateRecord): PartTemplateRecord {
  const geometryFeatures = record.geometryFeatures ?? createFallbackGeometryFeatures(record)
  const shapeDescription = record.shapeDescription ?? buildPartShapeDescription(geometryFeatures)

  return {
    ...record,
    normalizedShapeSignature: record.normalizedShapeSignature ?? geometryFeatures.normalizedShapeSignature,
    geometryFeatures,
    shapeDescription,
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
    const normalizedStore = {
      packages: Array.isArray(parsed.packages) ? parsed.packages : [],
      records: Array.isArray(parsed.records) ? parsed.records.map((record) => normalizeRecord(record as PartTemplateRecord)) : [],
    }
    cachedStore =
      normalizedStore.packages.length === 0 && normalizedStore.records.length === 0
        ? getDefaultStore()
        : normalizedStore
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

  return normalizeRecord({
    id: createId('PTR'),
    templatePackageId: packageId,
    templateName,
    sourceDxfFileName,
    sourceRulFileName,
    parsedAt,
    updatedAt: parsedAt,
    standardPartName,
    sourcePartName: part.sourcePartName,
    sourceMarkerText: part.sourceMarkerText,
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
    normalizedShapeSignature: part.normalizedShapeSignature,
    previewSvg: part.previewSvg,
    geometryFeatures: part.geometryFeatures,
    shapeDescription: part.shapeDescription,
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
  })
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
  sourceDxfFileDownloadUrl?: string
  sourceRulFileDownloadUrl?: string
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
    sourceDxfFileDownloadUrl: params.sourceDxfFileDownloadUrl,
    sourceRulFileDownloadUrl: params.sourceRulFileDownloadUrl,
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

  const nextRecord: PartTemplateRecord = normalizeRecord({
    ...target,
    ...patch,
    standardPartName: patch.standardPartName?.trim() ?? target.standardPartName,
    updatedAt: formatDateTime(new Date()),
  })

  const nextStore: PartTemplateStore = {
    ...store,
    records: store.records.map((record) => (record.id === recordId ? nextRecord : record)),
  }

  persistStore(nextStore)
  return nextRecord
}

export function recommendPartTemplateRecords(
  part: ParsedPartInstance,
  limit = 3,
): PartTemplateRecommendation[] {
  return listPartTemplateRecords()
    .map((record) => {
      const recommendation = scorePartTemplateRecommendation(
        {
          standardPartName: suggestStandardPartName(part),
          sourcePartName: part.sourcePartName,
          systemPieceName: part.systemPieceName,
          candidatePartNames: part.candidatePartNames,
          sizeCode: part.sizeCode,
          geometryFeatures: part.geometryFeatures ?? undefined,
          normalizedShapeSignature: part.normalizedShapeSignature,
        },
        {
          id: record.id,
          templateName: record.templateName,
          standardPartName: record.standardPartName,
          sourcePartName: record.sourcePartName,
          systemPieceName: record.systemPieceName,
          candidatePartNames: record.candidatePartNames,
          sizeCode: record.sizeCode,
          geometryFeatures: record.geometryFeatures ?? undefined,
          normalizedShapeSignature: record.normalizedShapeSignature,
          reuseHitCount: record.reuseHitCount,
          hotStyleCount: record.hotStyleCount,
          cumulativeOrderQty: record.cumulativeOrderQty,
        },
      )

      return {
        record,
        matchScore: recommendation.matchScore,
        reasons: recommendation.reasons,
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

import { findStyleArchiveByCode } from '../pcs-style-archive-repository.ts'
import {
  getCurrentTechPackVersionByStyleId,
  getTechnicalDataVersionContentById,
} from '../pcs-technical-data-version-repository.ts'
import type { StyleArchiveShellRecord } from '../pcs-style-archive-types.ts'
import type { ProductionDemand } from './production-demands.ts'
import {
  patternMaterialFileTypeLabels,
  type PatternMaterialType,
  type ProductionOrderTechPackSnapshot,
  type TechPackBomItemSnapshot,
  type TechPackCutPiecePartSnapshot,
  type TechPackImageSnapshot,
  type TechPackPatternFileSnapshot,
  type TechPackSizeMeasurementSnapshot,
} from './production-tech-pack-snapshot-types.ts'
import type {
  TechnicalColorMaterialMapping,
  TechnicalDataVersionContent,
  TechnicalDataVersionRecord,
  TechnicalPatternDesign,
  TechnicalProcessEntry,
  TechnicalSizeRow,
} from '../pcs-technical-data-version-types.ts'

export interface DemandCurrentTechPackInfo {
  styleId: string
  styleCode: string
  styleName: string
  currentTechPackVersionId: string
  currentTechPackVersionCode: string
  currentTechPackVersionLabel: string
  publishedAt: string
  completenessScore: number
  linkedRevisionTaskIds: string[]
  linkedPatternTaskIds: string[]
  linkedArtworkTaskIds: string[]
  canConvertToProductionOrder: boolean
  blockReason: string
}

export interface DemandCurrentTechPackSource {
  style: StyleArchiveShellRecord
  record: TechnicalDataVersionRecord
  content: TechnicalDataVersionContent
}

const IMAGE_PLACEHOLDER_MARKERS = ['/placeholder.svg', 'picsum', 'unsplash', 'dummyimage', 'loremflickr']

function buildPatternFileDisplayName(input: {
  patternFileMode?: string
  dxfFileName?: string
  rulFileName?: string
  singlePatternFileName?: string
  fileName?: string
}): string {
  if (input.patternFileMode === 'PAIRED_DXF_RUL') {
    const paired = [normalizeText(input.dxfFileName), normalizeText(input.rulFileName)].filter(Boolean)
    if (paired.length > 0) return paired.join(' / ')
  }

  if (input.patternFileMode === 'SINGLE_FILE') {
    const single = normalizeText(input.singlePatternFileName)
    if (single) return single
  }

  const fallbackPaired = [normalizeText(input.dxfFileName), normalizeText(input.rulFileName)].filter(Boolean)
  if (fallbackPaired.length > 0) return fallbackPaired.join(' / ')

  return normalizeText(input.singlePatternFileName) || normalizeText(input.fileName)
}

function normalizeText(value: string | undefined | null): string {
  return String(value || '').trim()
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)))
}

function isAllowedSnapshotImage(url: string | undefined | null): url is string {
  const normalized = normalizeText(url)
  if (!normalized || normalized === '#') return false
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) return false
  return !IMAGE_PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker))
}

function inferPatternMaterialTypeFromText(input: string): PatternMaterialType {
  const normalized = normalizeText(input).toLowerCase()
  if (!normalized) return 'UNKNOWN'
  if (normalized.includes('毛织') || normalized.includes('毛织') || normalized.includes('wool')) return 'WOOL'
  if (normalized.includes('梭织') || normalized.includes('布料') || normalized.includes('woven')) return 'WOVEN'
  return 'UNKNOWN'
}

function inferPatternFileMode(materialType: PatternMaterialType, item: { patternFileMode?: string }): 'PAIRED_DXF_RUL' | 'SINGLE_FILE' {
  if (item.patternFileMode === 'PAIRED_DXF_RUL' || item.patternFileMode === 'SINGLE_FILE') {
    return item.patternFileMode
  }
  return materialType === 'WOVEN' ? 'PAIRED_DXF_RUL' : 'SINGLE_FILE'
}

function inferPatternParseStatus(input: {
  materialType: PatternMaterialType
  parseStatus?: string
  pieceRows?: Array<unknown>
}): 'NOT_PARSED' | 'PARSING' | 'PARSED' | 'FAILED' | 'NOT_REQUIRED' {
  if (
    input.parseStatus === 'NOT_PARSED'
    || input.parseStatus === 'PARSING'
    || input.parseStatus === 'PARSED'
    || input.parseStatus === 'FAILED'
    || input.parseStatus === 'NOT_REQUIRED'
  ) {
    return input.parseStatus
  }
  if (input.materialType === 'WOOL') return 'NOT_REQUIRED'
  if ((input.pieceRows ?? []).length > 0) return 'PARSED'
  return 'NOT_PARSED'
}

function formatSizeRange(sizeTable: TechnicalSizeRow[]): string {
  const order = ['S', 'M', 'L', 'XL']
  const available = order.filter((sizeCode) => sizeTable.some((row) => Number.isFinite(row[sizeCode as keyof TechnicalSizeRow] as number)))
  return available.length ? available.join(' / ') : ''
}

function parseSizeRangeText(sizeRange?: string): string[] {
  const normalized = normalizeText(sizeRange)
  if (!normalized) return []
  return uniqueStrings(
    normalized
      .split(/[\/,，、;；\s]+/)
      .map((item) => item.trim())
      .filter(Boolean),
  )
}

function clonePatternFiles(items: TechPackPatternFileSnapshot[]): TechPackPatternFileSnapshot[] {
  return items.map((item) => ({
    ...item,
    rulSizeList: [...(item.rulSizeList ?? [])],
    selectedSizeCodes: [...(item.selectedSizeCodes ?? [])],
    pieceRows: item.pieceRows?.map((row) => ({
      ...row,
      applicableSkuCodes: [...(row.applicableSkuCodes ?? [])],
      colorAllocations: row.colorAllocations?.map((allocation) => ({
        ...allocation,
        skuCodes: [...(allocation.skuCodes ?? [])],
      })),
      specialCrafts: row.specialCrafts?.map((craft) => ({
        ...craft,
        supportedTargetObjects: [...(craft.supportedTargetObjects ?? [])],
        supportedTargetObjectLabels: [...(craft.supportedTargetObjectLabels ?? [])],
      })),
      bundleLengthCm: row.bundleLengthCm,
      bundleWidthCm: row.bundleWidthCm,
      candidatePartNames: [...(row.candidatePartNames ?? [])],
      rawTextLabels: [...(row.rawTextLabels ?? [])],
    })),
  }))
}

function cloneProcessEntries(items: TechnicalProcessEntry[]): TechnicalProcessEntry[] {
  return items.map((item) => ({
    ...item,
    detailSplitDimensions: [...(item.detailSplitDimensions ?? [])],
    supportedTargetObjects: [...(item.supportedTargetObjects ?? [])],
    supportedTargetObjectLabels: [...(item.supportedTargetObjectLabels ?? [])],
    linkedBomItemIds: [...(item.linkedBomItemIds ?? [])],
    linkedPatternIds: [...(item.linkedPatternIds ?? [])],
  }))
}

function buildDefaultPostFinishingProcessEntry(snapshotId: string): TechnicalProcessEntry {
  return {
    id: `${snapshotId}-process-post-finishing`,
    entryType: 'PROCESS_BASELINE',
    stageCode: 'POST',
    stageName: '后道阶段',
    processCode: 'POST_FINISHING',
    processName: '后道',
    assignmentGranularity: 'SKU',
    ruleSource: 'INHERIT_PROCESS',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['GARMENT_SKU'],
    defaultDocType: 'TASK',
    taskTypeMode: 'PROCESS',
    isSpecialCraft: false,
    sourceType: 'DICT',
    triggerSource: '技术包默认后道工序',
    standardTimeMinutes: 0,
    timeUnit: '分钟/件',
    difficulty: 'MEDIUM',
    remark: '所有生产单默认包含后道工序，质检完成后由质检人员判断是否生成后道单。',
  }
}

function ensurePostFinishingProcessEntry(items: TechnicalProcessEntry[], snapshotId: string): TechnicalProcessEntry[] {
  const entries = cloneProcessEntries(items)
  if (entries.some((item) => item.processCode === 'POST_FINISHING')) return entries
  return [...entries, buildDefaultPostFinishingProcessEntry(snapshotId)]
}

function cloneSizeTable(items: TechnicalSizeRow[]): TechnicalSizeRow[] {
  return items.map((item) => ({ ...item }))
}

function cloneSizeMeasurements(items: TechPackSizeMeasurementSnapshot[]): TechPackSizeMeasurementSnapshot[] {
  return items.map((item) => ({ ...item }))
}

function cloneBomItems(items: TechPackBomItemSnapshot[]): TechPackBomItemSnapshot[] {
  return items.map((item) => ({
    ...item,
    applicableSkuCodes: [...(item.applicableSkuCodes ?? [])],
    linkedPatternIds: [...(item.linkedPatternIds ?? [])],
    usageProcessCodes: [...(item.usageProcessCodes ?? [])],
  }))
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

function cloneCutPieceParts(items: TechPackCutPiecePartSnapshot[]): TechPackCutPiecePartSnapshot[] {
  return items.map((item) => ({
    ...item,
    applicableColorList: [...item.applicableColorList],
    applicableSizeList: [...item.applicableSizeList],
    specialCrafts: item.specialCrafts?.map((craft) => ({
      ...craft,
      supportedTargetObjects: [...(craft.supportedTargetObjects ?? [])],
      supportedTargetObjectLabels: [...(craft.supportedTargetObjectLabels ?? [])],
    })),
  }))
}

function cloneImageSnapshot(snapshot: TechPackImageSnapshot): TechPackImageSnapshot {
  return {
    productImages: [...snapshot.productImages],
    styleImages: [...snapshot.styleImages],
    sampleImages: [...snapshot.sampleImages],
    materialImages: [...snapshot.materialImages],
    accessoryImages: [...snapshot.accessoryImages],
    patternImages: [...snapshot.patternImages],
    markerImages: [...snapshot.markerImages],
    artworkImages: [...snapshot.artworkImages],
  }
}

function getBomDisplayCode(item: TechPackBomItemSnapshot, index: number): string {
  return (
    normalizeText((item as { materialCode?: string }).materialCode)
    || normalizeText(item.id)
    || `MAT-${String(index + 1).padStart(3, '0')}`
  )
}

function buildMaterialSwatchImageUrl(item: TechPackBomItemSnapshot, index: number): string {
  const palettes = [
    ['#dbeafe', '#1d4ed8', '#eff6ff'],
    ['#dcfce7', '#047857', '#f0fdf4'],
    ['#fef3c7', '#b45309', '#fffbeb'],
    ['#fce7f3', '#be185d', '#fff1f2'],
    ['#e0e7ff', '#4338ca', '#eef2ff'],
  ] as const
  const [base, accent, soft] = palettes[index % palettes.length]
  const code = getBomDisplayCode(item, index)
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90" viewBox="0 0 120 90">',
    `<rect width="120" height="90" rx="10" fill="${soft}"/>`,
    `<rect x="10" y="10" width="100" height="70" rx="8" fill="${base}"/>`,
    `<path d="M10 28h100M10 48h100M10 68h100" stroke="${accent}" stroke-width="1.2" opacity=".32"/>`,
    `<path d="M28 10v70M58 10v70M88 10v70" stroke="${accent}" stroke-width="1.2" opacity=".22"/>`,
    `<text x="60" y="48" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="${accent}">${code}</text>`,
    '</svg>',
  ].join('')
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function enrichBomItemsWithMaterialAssets(
  bomItems: TechPackBomItemSnapshot[],
  patternFiles: TechPackPatternFileSnapshot[],
): TechPackBomItemSnapshot[] {
  return bomItems.map((item, index) => {
    const itemCode = getBomDisplayCode(item, index).toLowerCase()
    const itemName = normalizeText(item.name).toLowerCase()
    const linkedPatterns = patternFiles.filter((pattern) => {
      const linkedSku = normalizeText(pattern.linkedMaterialSku).toLowerCase()
      const linkedName = normalizeText(pattern.linkedMaterialName).toLowerCase()
      return (
        pattern.linkedBomItemId === item.id
        || pattern.linkedMaterialId === item.id
        || linkedSku === itemCode
        || (Boolean(itemName) && linkedName === itemName)
      )
    })
    const aliases = uniqueStrings([
      normalizeText((item as { materialAlias?: string }).materialAlias),
      ...linkedPatterns.map((pattern) => pattern.linkedMaterialAlias),
    ])
    const linkedImage = linkedPatterns.map((pattern) => normalizeText(pattern.imageUrl)).find(isAllowedSnapshotImage)
    const materialImageUrl = isAllowedSnapshotImage(item.materialImageUrl)
      ? normalizeText(item.materialImageUrl)
      : linkedImage || buildMaterialSwatchImageUrl(item, index)

    return {
      ...item,
      materialAlias: aliases.join(' / '),
      materialImageUrl,
    }
  })
}

function normalizePatternFiles(
  patternFiles: TechnicalDataVersionContent['patternFiles'],
  options: {
    bomItems: TechPackBomItemSnapshot[]
    sizeTable: TechnicalSizeRow[]
    versionLabel: string
  },
): TechPackPatternFileSnapshot[] {
  const defaultSizeRange = formatSizeRange(options.sizeTable)
  return patternFiles.map((item, index) => {
    const linkedBom = options.bomItems.find((bom) => bom.id === item.linkedBomItemId) || null
    const explicitPatternMaterialType = (item as { patternMaterialType?: string }).patternMaterialType
    const patternMaterialType =
      explicitPatternMaterialType === 'WOOL' || explicitPatternMaterialType === 'WOVEN'
        ? explicitPatternMaterialType
        : inferPatternMaterialTypeFromText([
            linkedBom?.name,
            linkedBom?.spec,
            linkedBom?.type,
            (item as { singlePatternFileName?: string }).singlePatternFileName,
            (item as { dxfFileName?: string }).dxfFileName,
            (item as { rulFileName?: string }).rulFileName,
            item.fileName,
          ].join(' '))
    const sequence = index + 1
    const patternFileMode = inferPatternFileMode(patternMaterialType, item as { patternFileMode?: string })
    const patternFileName = buildPatternFileDisplayName({
      patternFileMode,
      dxfFileName: (item as { dxfFileName?: string }).dxfFileName,
      rulFileName: (item as { rulFileName?: string }).rulFileName,
      singlePatternFileName: (item as { singlePatternFileName?: string }).singlePatternFileName,
      fileName: item.fileName,
    })
    const parseStatus = inferPatternParseStatus({
      materialType: patternMaterialType,
      parseStatus: (item as { parseStatus?: string }).parseStatus,
      pieceRows: item.pieceRows,
    })

    return {
      ...item,
      patternFileId: item.id,
      patternFileName,
      patternVersion: options.versionLabel || `V${sequence}`,
      patternMaterialType,
      patternMaterialTypeLabel: patternMaterialFileTypeLabels[patternMaterialType],
      patternFileMode,
      dxfFileName: normalizeText((item as { dxfFileName?: string }).dxfFileName) || undefined,
      rulFileName: normalizeText((item as { rulFileName?: string }).rulFileName) || undefined,
      singlePatternFileName: normalizeText((item as { singlePatternFileName?: string }).singlePatternFileName) || undefined,
      patternSoftwareName: normalizeText((item as { patternSoftwareName?: string }).patternSoftwareName) || undefined,
      selectedSizeCodes: uniqueStrings([
        ...(((item as { selectedSizeCodes?: string[] }).selectedSizeCodes ?? []).filter(Boolean)),
        ...parseSizeRangeText((item as { sizeRange?: string }).sizeRange),
      ]),
      sizeRange:
        uniqueStrings([
          ...(((item as { selectedSizeCodes?: string[] }).selectedSizeCodes ?? []).filter(Boolean)),
          ...parseSizeRangeText((item as { sizeRange?: string }).sizeRange),
        ]).join(' / ')
        || defaultSizeRange
        || undefined,
      rulSizeList: [...(((item as { rulSizeList?: string[] }).rulSizeList ?? []).filter(Boolean))],
      rulSampleSize: normalizeText((item as { rulSampleSize?: string }).rulSampleSize) || undefined,
      parseStatus,
      parsedAt: normalizeText((item as { parsedAt?: string }).parsedAt) || undefined,
      imageUrl: isAllowedSnapshotImage((item as { imageUrl?: string }).imageUrl)
        ? normalizeText((item as { imageUrl?: string }).imageUrl)
        : undefined,
      remark: normalizeText((item as { remark?: string }).remark) || undefined,
      pieceRows: item.pieceRows?.map((row) => ({
        ...row,
        bundleLengthCm: row.bundleLengthCm,
        bundleWidthCm: row.bundleWidthCm,
        specialCrafts: row.specialCrafts?.map((craft) => ({
          ...craft,
          selectedTargetObject: craft.selectedTargetObject,
          supportedTargetObjects: [...(craft.supportedTargetObjects ?? [])],
          supportedTargetObjectLabels: [...(craft.supportedTargetObjectLabels ?? [])],
        })),
      })),
    }
  })
}

function buildSizeMeasurements(sizeTable: TechnicalSizeRow[]): TechPackSizeMeasurementSnapshot[] {
  const sizeOrder = ['S', 'M', 'L', 'XL'] as const
  return sizeTable.flatMap((row) =>
    sizeOrder
      .filter((sizeCode) => Number.isFinite(row[sizeCode]))
      .map((sizeCode) => ({
        sizeCode,
        measurementPart: row.part,
        measurementValue: row[sizeCode],
        measurementUnit: 'cm',
        tolerance: row.tolerance,
      })),
  )
}

function buildCutPieceParts(input: {
  patternFiles: TechPackPatternFileSnapshot[]
  bomItems: TechPackBomItemSnapshot[]
  sizeTable: TechnicalSizeRow[]
}): TechPackCutPiecePartSnapshot[] {
  const sizeRange = uniqueStrings(
    ['S', 'M', 'L', 'XL'].filter((sizeCode) => input.sizeTable.some((row) => Number.isFinite(row[sizeCode as keyof TechnicalSizeRow] as number))),
  )

  const partMap = new Map<string, TechPackCutPiecePartSnapshot>()
  input.patternFiles.forEach((patternFile) => {
    if (patternFile.patternMaterialType === 'WOOL') return
    const linkedBom = input.bomItems.find((bom) => bom.id === patternFile.linkedBomItemId) || input.bomItems[0] || null
    const patternSizeCodes = uniqueStrings([
      ...(patternFile.selectedSizeCodes ?? []),
      ...parseSizeRangeText(patternFile.sizeRange),
    ])

    ;(patternFile.pieceRows ?? []).forEach((pieceRow) => {
      const partCode = normalizeText((pieceRow as { partCode?: string }).partCode) || normalizeText(pieceRow.id) || normalizeText(pieceRow.name)
      const partNameCn = normalizeText(pieceRow.name)
      if (!partCode || !partNameCn) return

      const applicableColors = uniqueStrings([
        linkedBom?.colorLabel,
        ...(linkedBom?.applicableSkuCodes ?? []).map((skuCode) => skuCode.split('-')[1]),
        ...((pieceRow.colorAllocations ?? []).map((allocation) => allocation.colorName)),
      ])

      const existing = partMap.get(partCode)
      const mergedColors = uniqueStrings([
        ...(existing?.applicableColorList ?? []),
        ...applicableColors,
      ])
      const mergedSizes = uniqueStrings([
        ...(existing?.applicableSizeList ?? []),
        ...(pieceRow.applicableSkuCodes ?? []).map((skuCode) => skuCode.split('-').pop()),
        ...patternSizeCodes,
        ...sizeRange,
      ])

      partMap.set(partCode, {
        partCode,
        partNameCn,
        partNameId: normalizeText((pieceRow as { partNameId?: string }).partNameId) || undefined,
        partNameIdn: normalizeText((pieceRow as { partNameIdn?: string }).partNameIdn) || undefined,
        pieceCountPerGarment: Math.max(Number(pieceRow.count || 0), 1),
        materialSku: normalizeText(linkedBom?.id) || normalizeText(existing?.materialSku) || '',
        materialName: normalizeText(linkedBom?.name) || existing?.materialName || undefined,
        fabricColor: normalizeText(linkedBom?.colorLabel) || existing?.fabricColor || undefined,
        applicableColorList: mergedColors,
        applicableSizeList: mergedSizes,
        specialCrafts:
          (pieceRow.specialCrafts ?? []).length > 0
            ? pieceRow.specialCrafts?.map((craft) => ({
                ...craft,
                selectedTargetObject: craft.selectedTargetObject,
                supportedTargetObjects: [...(craft.supportedTargetObjects ?? [])],
                supportedTargetObjectLabels: [...(craft.supportedTargetObjectLabels ?? [])],
              }))
            : existing?.specialCrafts,
        bundleLengthCm: Number.isFinite(Number((pieceRow as { bundleLengthCm?: number }).bundleLengthCm))
          ? Number((pieceRow as { bundleLengthCm?: number }).bundleLengthCm)
          : existing?.bundleLengthCm,
        bundleWidthCm: Number.isFinite(Number((pieceRow as { bundleWidthCm?: number }).bundleWidthCm))
          ? Number((pieceRow as { bundleWidthCm?: number }).bundleWidthCm)
          : existing?.bundleWidthCm,
        manualConfirmRequired:
          Boolean(existing?.manualConfirmRequired)
          || partNameCn.includes('袖')
          || Boolean((pieceRow as { manualConfirmRequired?: boolean }).manualConfirmRequired),
        remark: normalizeText((pieceRow as { note?: string }).note) || existing?.remark || undefined,
      })
    })
  })

  return [...partMap.values()].sort((left, right) => left.partNameCn.localeCompare(right.partNameCn, 'zh-CN'))
}

function buildImageSnapshot(input: {
  bomItems: TechPackBomItemSnapshot[]
  patternFiles: TechPackPatternFileSnapshot[]
  patternDesigns: TechnicalPatternDesign[]
}): TechPackImageSnapshot {
  const materialImages = input.bomItems
    .filter((item) => item.type === '面料')
    .map((item) => normalizeText(item.materialImageUrl))
    .filter(isAllowedSnapshotImage)

  const accessoryImages = input.bomItems
    .filter((item) => item.type !== '面料')
    .map((item) => normalizeText(item.materialImageUrl))
    .filter(isAllowedSnapshotImage)

  return {
    productImages: [],
    styleImages: [],
    sampleImages: [],
    materialImages,
    accessoryImages,
    patternImages: input.patternFiles.map((item) => normalizeText(item.imageUrl)).filter(isAllowedSnapshotImage),
    markerImages: [],
    artworkImages: input.patternDesigns
      .map((item) => normalizeText(item.previewThumbnailDataUrl || item.imageUrl))
      .filter(isAllowedSnapshotImage),
  }
}

export function cloneProductionOrderTechPackSnapshot(
  snapshot: ProductionOrderTechPackSnapshot | null,
): ProductionOrderTechPackSnapshot | null {
  if (!snapshot) return null
  return {
    ...snapshot,
    garmentDifficultyGrade: snapshot.garmentDifficultyGrade || 'B',
    bomItems: cloneBomItems(snapshot.bomItems),
    patternFiles: clonePatternFiles(snapshot.patternFiles),
    processEntries: cloneProcessEntries(snapshot.processEntries),
    sizeTable: cloneSizeTable(snapshot.sizeTable),
    sizeMeasurements: cloneSizeMeasurements(snapshot.sizeMeasurements),
    colorMaterialMappings: cloneColorMappings(snapshot.colorMaterialMappings),
    cutPieceParts: cloneCutPieceParts(snapshot.cutPieceParts),
    imageSnapshot: cloneImageSnapshot(snapshot.imageSnapshot),
    patternDesigns: clonePatternDesigns(snapshot.patternDesigns),
    linkedRevisionTaskIds: [...snapshot.linkedRevisionTaskIds],
    linkedPatternTaskIds: [...snapshot.linkedPatternTaskIds],
    linkedArtworkTaskIds: [...snapshot.linkedArtworkTaskIds],
  }
}

function createSnapshotId(productionOrderNo: string): string {
  return `TPS-${productionOrderNo}`
}

function buildSnapshotFromSource(input: {
  productionOrderId: string
  productionOrderNo: string
  style: StyleArchiveShellRecord
  record: TechnicalDataVersionRecord
  content: TechnicalDataVersionContent
  snapshotAt: string
  snapshotBy: string
}): ProductionOrderTechPackSnapshot {
  const { productionOrderId, productionOrderNo, style, record, content, snapshotAt, snapshotBy } = input
  const baseBomItems = cloneBomItems(content.bomItems as TechPackBomItemSnapshot[])
  const patternFiles = normalizePatternFiles(content.patternFiles, {
    bomItems: baseBomItems,
    sizeTable: content.sizeTable,
    versionLabel: record.versionLabel,
  })
  const bomItems = enrichBomItemsWithMaterialAssets(baseBomItems, patternFiles)
  const patternDesigns = clonePatternDesigns(content.patternDesigns)
  const imageSnapshot = buildImageSnapshot({
    bomItems,
    patternFiles,
    patternDesigns,
  })
  const snapshotId = createSnapshotId(productionOrderNo)
  return {
    snapshotId,
    productionOrderId,
    productionOrderNo,
    styleId: style.styleId,
    styleCode: style.styleCode,
    styleName: style.styleName,
    status: 'RELEASED',
    versionLabel: record.versionLabel,
    sourceTechPackVersionId: record.technicalVersionId,
    sourceTechPackVersionCode: record.technicalVersionCode,
    sourceTechPackVersionLabel: record.versionLabel,
    garmentDifficultyGrade: record.garmentDifficultyGrade || 'B',
    sourcePublishedAt: record.publishedAt,
    snapshotAt,
    snapshotBy,
    patternDesc: content.patternDesc || '',
    bomItems,
    patternFiles,
    processEntries: ensurePostFinishingProcessEntry(content.processEntries, snapshotId),
    sizeTable: cloneSizeTable(content.sizeTable),
    sizeMeasurements: buildSizeMeasurements(content.sizeTable),
    colorMaterialMappings: cloneColorMappings(content.colorMaterialMappings),
    cutPieceParts: buildCutPieceParts({
      patternFiles,
      bomItems,
      sizeTable: content.sizeTable,
    }),
    imageSnapshot,
    patternDesigns,
    linkedRevisionTaskIds: [...record.linkedRevisionTaskIds],
    linkedPatternTaskIds: [...record.linkedPatternTaskIds],
    linkedArtworkTaskIds: [...record.linkedArtworkTaskIds],
    completenessScore: record.completenessScore,
  }
}

function resolveDemandColorMaterialInfo(input: {
  demand: Pick<ProductionDemand, 'spuCode'>
  color: string
  colorIndex: number
  fallbackBomItemId: string
  fallbackMaterialName: string
}): { code: string; name: string } {
  const colorKey = normalizeText(input.color).toLowerCase()
  if (input.demand.spuCode === 'SPU-2024-010') {
    const joggerMaterialMap: Record<string, { code: string; name: string }> = {
      black: {
        code: 'tdv_demand_SPU_2024_010-bom-black-stretch-twill',
        name: 'Black 弹力斜纹主面料',
      },
      charcoal: {
        code: 'tdv_demand_SPU_2024_010-bom-charcoal-stretch-twill',
        name: 'Charcoal 弹力斜纹主面料',
      },
      navy: {
        code: 'tdv_demand_SPU_2024_010-bom-navy-twill',
        name: 'Navy 斜纹主面料',
      },
      khaki: {
        code: 'tdv_demand_SPU_2024_010-bom-khaki-canvas',
        name: 'Khaki 帆布主面料',
      },
    }
    const mapped = joggerMaterialMap[colorKey]
    if (mapped) return mapped
    const colorToken = colorKey.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `color-${input.colorIndex + 1}`
    return {
      code: `tdv_demand_SPU_2024_010-bom-${colorToken}`,
      name: `${input.color} 主面料`,
    }
  }
  return {
    code: input.fallbackBomItemId,
    name: input.fallbackMaterialName,
  }
}

function alignSnapshotWithDemandSkuLines(
  snapshot: ProductionOrderTechPackSnapshot,
  demand: Pick<ProductionDemand, 'spuCode'> & Partial<Pick<ProductionDemand, 'skuLines'>>,
): ProductionOrderTechPackSnapshot {
  const skuLines = demand.skuLines ?? []
  if (!skuLines.length || !snapshot.colorMaterialMappings.length) return snapshot

  const colors = uniqueStrings(skuLines.map((line) => line.color))
  const sizes = uniqueStrings(skuLines.map((line) => line.size))
  const allSkuCodes = uniqueStrings(skuLines.map((line) => line.skuCode))
  const fallbackMapping = snapshot.colorMaterialMappings[0]
  const fallbackBomItem = snapshot.bomItems[0] ?? null
  const fallbackMaterialName = normalizeText(fallbackBomItem?.name) || normalizeText(fallbackMapping?.lines?.[0]?.materialName) || '主面料'
  const fallbackBomItemId = normalizeText(fallbackBomItem?.id) || normalizeText(fallbackMapping?.lines?.[0]?.bomItemId)

  const colorMaterialMappings = colors
    .map((color, colorIndex) => {
      const existing = snapshot.colorMaterialMappings.find(
        (mapping) =>
          normalizeText(mapping.colorName).toLowerCase() === color.toLowerCase()
          || normalizeText(mapping.colorCode).toLowerCase() === color.toLowerCase(),
      )
      const template = existing ?? fallbackMapping
      if (!template) return null
      const skuCodesForColor = uniqueStrings(
        skuLines
          .filter((line) => normalizeText(line.color).toLowerCase() === color.toLowerCase())
          .map((line) => line.skuCode),
      )
      const materialInfo = resolveDemandColorMaterialInfo({
        demand,
        color,
        colorIndex,
        fallbackBomItemId,
        fallbackMaterialName,
      })
      return {
        ...template,
        id: `${snapshot.snapshotId}-mapping-${colorIndex + 1}`,
        spuCode: demand.spuCode,
        colorCode: color,
        colorName: color,
        lines: template.lines.map((line, lineIndex) => ({
          ...line,
          id: `${snapshot.snapshotId}-mapping-${colorIndex + 1}-${normalizeText(line.pieceId) || lineIndex + 1}`,
          materialCode: materialInfo.code,
          materialName: materialInfo.name,
          applicableSkuCodes: skuCodesForColor,
        })),
      } satisfies TechnicalColorMaterialMapping
    })
    .filter((item): item is TechnicalColorMaterialMapping => Boolean(item))

  return {
    ...snapshot,
    bomItems: snapshot.bomItems.map((item) => ({
      ...item,
      colorLabel: colors.join(' / '),
      applicableSkuCodes: allSkuCodes,
    })),
    patternFiles: snapshot.patternFiles.map((item) => ({
      ...item,
      selectedSizeCodes: sizes,
      sizeRange: sizes.join(' / ') || item.sizeRange,
      pieceRows: item.pieceRows?.map((row) => ({
        ...row,
        applicableSkuCodes: allSkuCodes,
      })),
    })),
    colorMaterialMappings,
    cutPieceParts: snapshot.cutPieceParts.map((item) => ({
      ...item,
      applicableColorList: colors,
      applicableSizeList: sizes,
      materialSku: resolveDemandColorMaterialInfo({
        demand,
        color: colors[0] || '',
        colorIndex: 0,
        fallbackBomItemId,
        fallbackMaterialName,
      }).code,
      materialName: resolveDemandColorMaterialInfo({
        demand,
        color: colors[0] || '',
        colorIndex: 0,
        fallbackBomItemId,
        fallbackMaterialName,
      }).name,
    })),
  }
}

export function resolveCurrentTechPackSourceForDemand(
  demand: Pick<ProductionDemand, 'spuCode'>,
): DemandCurrentTechPackSource | null {
  const style = findStyleArchiveByCode(demand.spuCode)
  if (!style) return null

  const record = getCurrentTechPackVersionByStyleId(style.styleId)
  if (!record || !style.currentTechPackVersionId) return null

  const content = getTechnicalDataVersionContentById(record.technicalVersionId)
  if (!content) return null

  return {
    style,
    record,
    content,
  }
}

export function getDemandCurrentTechPackInfo(
  demand: Pick<ProductionDemand, 'spuCode'>,
): DemandCurrentTechPackInfo {
  const style = findStyleArchiveByCode(demand.spuCode)
  if (!style) {
    return {
      styleId: '',
      styleCode: demand.spuCode,
      styleName: '',
      currentTechPackVersionId: '',
      currentTechPackVersionCode: '',
      currentTechPackVersionLabel: '',
      publishedAt: '',
      completenessScore: 0,
      linkedRevisionTaskIds: [],
      linkedPatternTaskIds: [],
      linkedArtworkTaskIds: [],
      canConvertToProductionOrder: false,
      blockReason: '当前需求未关联正式款式档案',
    }
  }

  const record = getCurrentTechPackVersionByStyleId(style.styleId)
  if (!style.currentTechPackVersionId || !record) {
    return {
      styleId: style.styleId,
      styleCode: style.styleCode,
      styleName: style.styleName,
      currentTechPackVersionId: '',
      currentTechPackVersionCode: '',
      currentTechPackVersionLabel: '',
      publishedAt: '',
      completenessScore: 0,
      linkedRevisionTaskIds: [],
      linkedPatternTaskIds: [],
      linkedArtworkTaskIds: [],
      canConvertToProductionOrder: false,
      blockReason: '当前款式尚未启用技术包版本',
    }
  }

  if (record.versionStatus !== 'PUBLISHED') {
    return {
      styleId: style.styleId,
      styleCode: style.styleCode,
      styleName: style.styleName,
      currentTechPackVersionId: record.technicalVersionId,
      currentTechPackVersionCode: record.technicalVersionCode,
      currentTechPackVersionLabel: record.versionLabel,
      publishedAt: record.publishedAt,
      completenessScore: record.completenessScore,
      linkedRevisionTaskIds: [...record.linkedRevisionTaskIds],
      linkedPatternTaskIds: [...record.linkedPatternTaskIds],
      linkedArtworkTaskIds: [...record.linkedArtworkTaskIds],
      canConvertToProductionOrder: false,
      blockReason: '当前生效技术包版本未发布',
    }
  }

  const content = getTechnicalDataVersionContentById(record.technicalVersionId)
  if (!content) {
    return {
      styleId: style.styleId,
      styleCode: style.styleCode,
      styleName: style.styleName,
      currentTechPackVersionId: record.technicalVersionId,
      currentTechPackVersionCode: record.technicalVersionCode,
      currentTechPackVersionLabel: record.versionLabel,
      publishedAt: record.publishedAt,
      completenessScore: record.completenessScore,
      linkedRevisionTaskIds: [...record.linkedRevisionTaskIds],
      linkedPatternTaskIds: [...record.linkedPatternTaskIds],
      linkedArtworkTaskIds: [...record.linkedArtworkTaskIds],
      canConvertToProductionOrder: false,
      blockReason: '当前生效技术包版本缺少正式内容',
    }
  }

  return {
    styleId: style.styleId,
    styleCode: style.styleCode,
    styleName: style.styleName,
    currentTechPackVersionId: record.technicalVersionId,
    currentTechPackVersionCode: record.technicalVersionCode,
    currentTechPackVersionLabel: record.versionLabel,
    publishedAt: record.publishedAt,
    completenessScore: record.completenessScore,
    linkedRevisionTaskIds: [...record.linkedRevisionTaskIds],
    linkedPatternTaskIds: [...record.linkedPatternTaskIds],
    linkedArtworkTaskIds: [...record.linkedArtworkTaskIds],
    canConvertToProductionOrder: true,
    blockReason: '',
  }
}

export function buildProductionOrderTechPackSnapshot(input: {
  productionOrderId: string
  productionOrderNo: string
  demand: Pick<ProductionDemand, 'spuCode'> & Partial<Pick<ProductionDemand, 'spuName' | 'skuLines' | 'techPackVersionLabel' | 'techPackStatus'>>
  snapshotAt: string
  snapshotBy: string
}): ProductionOrderTechPackSnapshot {
  const source = resolveCurrentTechPackSourceForDemand(input.demand)
  if (!source) {
    const info = getDemandCurrentTechPackInfo(input.demand)
    throw new Error(info.blockReason || '当前需求未关联可用技术包版本')
  }

  if (source.record.versionStatus !== 'PUBLISHED') {
    throw new Error('当前生效技术包版本未发布')
  }

  return alignSnapshotWithDemandSkuLines(buildSnapshotFromSource({
    productionOrderId: input.productionOrderId,
    productionOrderNo: input.productionOrderNo,
    style: source.style,
    record: source.record,
    content: source.content,
    snapshotAt: input.snapshotAt,
    snapshotBy: input.snapshotBy,
  }), input.demand)
}

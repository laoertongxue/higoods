import { buildLegacyTechPackFromTechnicalVersion } from '../pcs-technical-data-fcs-adapter.ts'
import { findStyleArchiveByCode } from '../pcs-style-archive-repository.ts'
import {
  getCurrentTechPackVersionByStyleId,
  getTechnicalDataVersionContentById,
} from '../pcs-technical-data-version-repository.ts'
import type { StyleArchiveShellRecord } from '../pcs-style-archive-types.ts'
import type { TechPack } from './tech-packs.ts'
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
  TechnicalAttachment,
  TechnicalColorMaterialMapping,
  TechnicalDataVersionContent,
  TechnicalDataVersionRecord,
  TechnicalPatternDesign,
  TechnicalProcessEntry,
  TechnicalQualityRule,
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
const FALLBACK_PATTERN_PARTS = [
  { partCode: 'tech-front', partNameCn: '前片', pieceCountPerGarment: 1, manualConfirmRequired: false },
  { partCode: 'tech-back', partNameCn: '后片', pieceCountPerGarment: 1, manualConfirmRequired: false },
  { partCode: 'tech-sleeve', partNameCn: '袖子', pieceCountPerGarment: 2, manualConfirmRequired: true },
] as const

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
  if (normalized.includes('针织') || normalized.includes('毛织') || normalized.includes('knit')) return 'KNIT'
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
  if (input.materialType === 'KNIT') return 'NOT_REQUIRED'
  if ((input.pieceRows ?? []).length > 0) return 'PARSED'
  return 'NOT_PARSED'
}

function formatSizeRange(sizeTable: TechnicalSizeRow[]): string {
  const order = ['S', 'M', 'L', 'XL']
  const available = order.filter((sizeCode) => sizeTable.some((row) => Number.isFinite(row[sizeCode as keyof TechnicalSizeRow] as number)))
  return available.length ? available.join(' / ') : ''
}

function clonePatternFiles(items: TechPackPatternFileSnapshot[]): TechPackPatternFileSnapshot[] {
  return items.map((item) => ({
    ...item,
    rulSizeList: [...(item.rulSizeList ?? [])],
    pieceRows: item.pieceRows?.map((row) => ({
      ...row,
      applicableSkuCodes: [...(row.applicableSkuCodes ?? [])],
      candidatePartNames: [...(row.candidatePartNames ?? [])],
      rawTextLabels: [...(row.rawTextLabels ?? [])],
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

function cloneCutPieceParts(items: TechPackCutPiecePartSnapshot[]): TechPackCutPiecePartSnapshot[] {
  return items.map((item) => ({
    ...item,
    applicableColorList: [...item.applicableColorList],
    applicableSizeList: [...item.applicableSizeList],
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
      explicitPatternMaterialType === 'KNIT' || explicitPatternMaterialType === 'WOVEN'
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
      sizeRange: normalizeText((item as { sizeRange?: string }).sizeRange) || defaultSizeRange || undefined,
      rulSizeList: [...(((item as { rulSizeList?: string[] }).rulSizeList ?? []).filter(Boolean))],
      rulSampleSize: normalizeText((item as { rulSampleSize?: string }).rulSampleSize) || undefined,
      parseStatus,
      parsedAt: normalizeText((item as { parsedAt?: string }).parsedAt) || undefined,
      imageUrl: isAllowedSnapshotImage((item as { imageUrl?: string }).imageUrl)
        ? normalizeText((item as { imageUrl?: string }).imageUrl)
        : undefined,
      remark: normalizeText((item as { remark?: string }).remark) || undefined,
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
    const linkedBom = input.bomItems.find((bom) => bom.id === patternFile.linkedBomItemId) || input.bomItems[0] || null
    const applicableColors = uniqueStrings([
      linkedBom?.colorLabel,
      ...(linkedBom?.applicableSkuCodes ?? []).map((skuCode) => skuCode.split('-')[1]),
    ])

    ;(patternFile.pieceRows ?? []).forEach((pieceRow) => {
      const partCode = normalizeText((pieceRow as { partCode?: string }).partCode) || normalizeText(pieceRow.id) || normalizeText(pieceRow.name)
      const partNameCn = normalizeText(pieceRow.name)
      if (!partCode || !partNameCn) return

      const existing = partMap.get(partCode)
      const mergedColors = uniqueStrings([
        ...(existing?.applicableColorList ?? []),
        ...applicableColors,
      ])
      const mergedSizes = uniqueStrings([
        ...(existing?.applicableSizeList ?? []),
        ...(pieceRow.applicableSkuCodes ?? []).map((skuCode) => skuCode.split('-').pop()),
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
        manualConfirmRequired:
          Boolean(existing?.manualConfirmRequired)
          || partNameCn.includes('袖')
          || Boolean((pieceRow as { manualConfirmRequired?: boolean }).manualConfirmRequired),
        remark: normalizeText((pieceRow as { note?: string }).note) || existing?.remark || undefined,
      })
    })
  })

  if (partMap.size === 0) {
    FALLBACK_PATTERN_PARTS.forEach((item) => {
      const linkedBom = input.bomItems[0] || null
      partMap.set(item.partCode, {
        partCode: item.partCode,
        partNameCn: item.partNameCn,
        pieceCountPerGarment: item.pieceCountPerGarment,
        materialSku: linkedBom?.id || '',
        materialName: linkedBom?.name || undefined,
        fabricColor: linkedBom?.colorLabel || undefined,
        applicableColorList: linkedBom?.colorLabel ? [linkedBom.colorLabel] : [],
        applicableSizeList: sizeRange,
        manualConfirmRequired: item.manualConfirmRequired,
      })
    })
  } else {
    FALLBACK_PATTERN_PARTS.forEach((item) => {
      if (partMap.has(item.partCode)) return
      const linkedBom = input.bomItems[0] || null
      partMap.set(item.partCode, {
        partCode: item.partCode,
        partNameCn: item.partNameCn,
        pieceCountPerGarment: item.pieceCountPerGarment,
        materialSku: linkedBom?.id || '',
        materialName: linkedBom?.name || undefined,
        fabricColor: linkedBom?.colorLabel || undefined,
        applicableColorList: linkedBom?.colorLabel ? [linkedBom.colorLabel] : [],
        applicableSizeList: sizeRange,
        manualConfirmRequired: item.manualConfirmRequired,
      })
    })
  }

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
    artworkImages: input.patternDesigns.map((item) => normalizeText(item.imageUrl)).filter(isAllowedSnapshotImage),
  }
}

export function cloneProductionOrderTechPackSnapshot(
  snapshot: ProductionOrderTechPackSnapshot | null,
): ProductionOrderTechPackSnapshot | null {
  if (!snapshot) return null
  return {
    ...snapshot,
    bomItems: cloneBomItems(snapshot.bomItems),
    patternFiles: clonePatternFiles(snapshot.patternFiles),
    processEntries: cloneProcessEntries(snapshot.processEntries),
    sizeTable: cloneSizeTable(snapshot.sizeTable),
    sizeMeasurements: cloneSizeMeasurements(snapshot.sizeMeasurements),
    qualityRules: cloneQualityRules(snapshot.qualityRules),
    colorMaterialMappings: cloneColorMappings(snapshot.colorMaterialMappings),
    cutPieceParts: cloneCutPieceParts(snapshot.cutPieceParts),
    imageSnapshot: cloneImageSnapshot(snapshot.imageSnapshot),
    patternDesigns: clonePatternDesigns(snapshot.patternDesigns),
    attachments: cloneAttachments(snapshot.attachments),
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
  const bomItems = cloneBomItems(content.bomItems as TechPackBomItemSnapshot[])
  const patternFiles = normalizePatternFiles(content.patternFiles, {
    bomItems,
    sizeTable: content.sizeTable,
    versionLabel: record.versionLabel,
  })
  const patternDesigns = clonePatternDesigns(content.patternDesigns)
  const imageSnapshot = buildImageSnapshot({
    bomItems,
    patternFiles,
    patternDesigns,
  })
  return {
    snapshotId: createSnapshotId(productionOrderNo),
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
    sourcePublishedAt: record.publishedAt,
    snapshotAt,
    snapshotBy,
    patternDesc: content.patternDesc || '',
    bomItems,
    patternFiles,
    processEntries: cloneProcessEntries(content.processEntries),
    sizeTable: cloneSizeTable(content.sizeTable),
    sizeMeasurements: buildSizeMeasurements(content.sizeTable),
    qualityRules: cloneQualityRules(content.qualityRules),
    colorMaterialMappings: cloneColorMappings(content.colorMaterialMappings),
    cutPieceParts: buildCutPieceParts({
      patternFiles,
      bomItems,
      sizeTable: content.sizeTable,
    }),
    imageSnapshot,
    patternDesigns,
    attachments: cloneAttachments(content.attachments),
    linkedRevisionTaskIds: [...record.linkedRevisionTaskIds],
    linkedPatternTaskIds: [...record.linkedPatternTaskIds],
    linkedArtworkTaskIds: [...record.linkedArtworkTaskIds],
    completenessScore: record.completenessScore,
  }
}

function buildFallbackSizeTable(demand: Pick<ProductionDemand, 'skuLines'>): TechnicalSizeRow[] {
  const sizeSet = Array.from(new Set(demand.skuLines.map((item) => item.size)))
  const has = (size: string) => sizeSet.includes(size)
  return [
    {
      id: 'seed-size-1',
      part: '胸围',
      S: has('S') ? 48 : 0,
      M: has('M') ? 50 : 0,
      L: has('L') ? 52 : 0,
      XL: has('XL') ? 54 : 0,
      tolerance: 1,
    },
  ]
}

export function buildSeedProductionOrderTechPackSnapshot(input: {
  productionOrderId: string
  productionOrderNo: string
  demand: Pick<ProductionDemand, 'spuCode' | 'spuName' | 'skuLines' | 'techPackVersionLabel' | 'techPackStatus'>
  snapshotAt: string
  snapshotBy: string
}): ProductionOrderTechPackSnapshot {
  const { productionOrderId, productionOrderNo, demand, snapshotAt, snapshotBy } = input
  const firstSku = demand.skuLines[0]
  const primaryColor = firstSku?.color || '默认色'
  const primarySkuCode = firstSku?.skuCode || `${demand.spuCode}-SKU-001`
  const primarySize = firstSku?.size || 'M'
  const sourceVersionLabel =
    demand.techPackStatus === 'RELEASED'
      ? demand.techPackVersionLabel || 'v1.0'
      : '草稿快照'
  const bomItems: TechPackBomItemSnapshot[] = [
    {
      id: `seed-bom-${productionOrderId}-1`,
      type: '面料',
      name: '主面料',
      spec: `${primaryColor} 主面料`,
      colorLabel: primaryColor,
      unitConsumption: 1.2,
      lossRate: 0.03,
      supplier: '历史供应商',
      applicableSkuCodes: [primarySkuCode],
      linkedPatternIds: [`seed-pattern-${productionOrderId}-1`, `seed-pattern-${productionOrderId}-2`],
      usageProcessCodes: ['SEW'],
    },
    {
      id: `seed-bom-${productionOrderId}-2`,
      type: '辅料',
      name: '辅料包',
      spec: `适配 ${primarySize}`,
      unitConsumption: 1,
      lossRate: 0.01,
      supplier: '历史辅料商',
      applicableSkuCodes: [primarySkuCode],
      linkedPatternIds: [],
      usageProcessCodes: ['PACK'],
    },
  ]
  const patternFiles: TechPackPatternFileSnapshot[] = [
    {
      id: `seed-pattern-${productionOrderId}-1`,
      patternFileId: `seed-pattern-${productionOrderId}-1`,
      fileName: `${demand.spuCode}-针织纸样.pdf`,
      patternFileName: `${demand.spuCode}-针织纸样.pdf`,
      patternVersion: sourceVersionLabel,
      patternMaterialType: 'KNIT',
      patternMaterialTypeLabel: patternMaterialFileTypeLabels.KNIT,
      patternFileMode: 'SINGLE_FILE',
      singlePatternFileName: `${demand.spuCode}-针织纸样.pdf`,
      parseStatus: 'NOT_REQUIRED',
      rulSizeList: [],
      patternSoftwareName: 'Gerber',
      sizeRange: 'S / M / L / XL',
      fileUrl: `local://seed-pattern/${productionOrderId}/knit`,
      uploadedAt: snapshotAt,
      uploadedBy: snapshotBy,
      linkedBomItemId: `seed-bom-${productionOrderId}-1`,
      totalPieceCount: 6,
      pieceRows: [
        {
          id: `seed-piece-${productionOrderId}-front`,
          name: '前片',
          count: 1,
          applicableSkuCodes: [primarySkuCode],
          sourceType: 'MANUAL',
        },
        {
          id: `seed-piece-${productionOrderId}-back`,
          name: '后片',
          count: 1,
          applicableSkuCodes: [primarySkuCode],
          sourceType: 'MANUAL',
        },
        {
          id: `seed-piece-${productionOrderId}-sleeve`,
          name: '袖子',
          count: 2,
          applicableSkuCodes: [primarySkuCode],
          sourceType: 'MANUAL',
        },
      ],
    },
    {
      id: `seed-pattern-${productionOrderId}-2`,
      patternFileId: `seed-pattern-${productionOrderId}-2`,
      fileName: `${demand.spuCode}-前后片.dxf / ${demand.spuCode}-前后片.rul`,
      patternFileName: `${demand.spuCode}-前后片.dxf / ${demand.spuCode}-前后片.rul`,
      patternVersion: sourceVersionLabel,
      patternMaterialType: 'WOVEN',
      patternMaterialTypeLabel: patternMaterialFileTypeLabels.WOVEN,
      patternFileMode: 'PAIRED_DXF_RUL',
      dxfFileName: `${demand.spuCode}-前后片.dxf`,
      rulFileName: `${demand.spuCode}-前后片.rul`,
      parseStatus: 'PARSED',
      parsedAt: snapshotAt,
      rulSizeList: ['S', 'M', 'L', 'XL'],
      rulSampleSize: 'M',
      patternSoftwareName: 'Lectra',
      sizeRange: 'S / M / L / XL',
      fileUrl: `local://seed-pattern/${productionOrderId}/woven`,
      uploadedAt: snapshotAt,
      uploadedBy: snapshotBy,
      linkedBomItemId: `seed-bom-${productionOrderId}-1`,
      totalPieceCount: 4,
      pieceRows: [
        {
          id: `seed-piece-${productionOrderId}-front-woven`,
          name: '前片',
          count: 1,
          sourceType: 'PARSED_PATTERN',
          sourcePartName: 'FRONT',
          systemPieceName: '前片',
          quantityText: '1',
          sizeCode: primarySize,
          parserStatus: '解析成功',
          applicableSkuCodes: [primarySkuCode],
        },
        {
          id: `seed-piece-${productionOrderId}-back-woven`,
          name: '后片',
          count: 1,
          sourceType: 'PARSED_PATTERN',
          sourcePartName: 'BACK',
          systemPieceName: '后片',
          quantityText: '1',
          sizeCode: primarySize,
          parserStatus: '解析成功',
          applicableSkuCodes: [primarySkuCode],
        },
      ],
    },
  ]
  const sizeTable = buildFallbackSizeTable(demand)
  const cutPieceParts = buildCutPieceParts({
    patternFiles,
    bomItems,
    sizeTable,
  })
  const patternDesigns = clonePatternDesigns([
    {
      id: `seed-design-${productionOrderId}-1`,
      name: `${demand.spuName} 花型图`,
      imageUrl: '',
    },
  ])
  const imageSnapshot = buildImageSnapshot({
    bomItems,
    patternFiles,
    patternDesigns,
  })

  return {
    snapshotId: createSnapshotId(productionOrderNo),
    productionOrderId,
    productionOrderNo,
    styleId: '',
    styleCode: demand.spuCode,
    styleName: demand.spuName,
    status: 'RELEASED',
    versionLabel: sourceVersionLabel,
    sourceTechPackVersionId: `seed-tech-pack-${productionOrderId}`,
    sourceTechPackVersionCode: `TP-SNAPSHOT-${productionOrderNo}`,
    sourceTechPackVersionLabel: sourceVersionLabel,
    sourcePublishedAt: demand.techPackStatus === 'RELEASED' ? snapshotAt : '',
    snapshotAt,
    snapshotBy,
    patternDesc: '历史生产单初始化快照',
    bomItems,
    patternFiles,
    processEntries: [
      {
        id: `seed-process-${productionOrderId}-1`,
        entryType: 'PROCESS_BASELINE',
        stageCode: 'PREP',
        stageName: '前准备',
        processCode: 'SEW',
        processName: '车缝',
        assignmentGranularity: 'ORDER',
        defaultDocType: 'TASK',
        taskTypeMode: 'PROCESS',
        isSpecialCraft: false,
        standardTimeMinutes: 12,
        timeUnit: '分钟/件',
      },
      {
        id: `seed-process-${productionOrderId}-2`,
        entryType: 'CRAFT',
        stageCode: 'POST',
        stageName: '后整理',
        processCode: 'PACK',
        processName: '包装',
        assignmentGranularity: 'ORDER',
        defaultDocType: 'TASK',
        taskTypeMode: 'PROCESS',
        isSpecialCraft: false,
        standardTimeMinutes: 4,
        timeUnit: '分钟/件',
      },
    ],
    sizeTable,
    sizeMeasurements: buildSizeMeasurements(sizeTable),
    qualityRules: [
      {
        id: `seed-quality-${productionOrderId}-1`,
        checkItem: '车缝平整度',
        standardText: '无线头、无明显起皱',
        samplingRule: '抽检',
        note: '',
      },
    ],
    colorMaterialMappings: [
      {
        id: `seed-mapping-${productionOrderId}-1`,
        spuCode: demand.spuCode,
        colorCode: primaryColor,
        colorName: primaryColor,
        status: 'CONFIRMED',
        generatedMode: 'MANUAL',
        lines: [
          {
            id: `seed-mapping-line-${productionOrderId}-1`,
            bomItemId: `seed-bom-${productionOrderId}-1`,
            materialName: '主面料',
            materialType: '面料',
            patternId: `seed-pattern-${productionOrderId}-1`,
            patternName: '主纸样',
            unit: '米',
            applicableSkuCodes: [primarySkuCode],
            sourceMode: 'MANUAL',
          },
        ],
      },
    ],
    cutPieceParts,
    imageSnapshot,
    patternDesigns,
    attachments: [
      {
        id: `seed-attachment-${productionOrderId}-1`,
        fileName: `${demand.spuCode}-说明.pdf`,
        fileType: 'PDF',
        fileSize: '128 KB',
        uploadedAt: snapshotAt,
        uploadedBy: snapshotBy,
        downloadUrl: `local://seed-attachment/${productionOrderId}`,
      },
    ],
    linkedRevisionTaskIds: [],
    linkedPatternTaskIds: [],
    linkedArtworkTaskIds: [],
    completenessScore: demand.techPackStatus === 'RELEASED' ? 100 : 60,
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
  demand: Pick<ProductionDemand, 'spuCode'>
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

  return buildSnapshotFromSource({
    productionOrderId: input.productionOrderId,
    productionOrderNo: input.productionOrderNo,
    style: source.style,
    record: source.record,
    content: source.content,
    snapshotAt: input.snapshotAt,
    snapshotBy: input.snapshotBy,
  })
}

export function buildCompatTechPackFromProductionSnapshot(snapshot: ProductionOrderTechPackSnapshot): TechPack {
  const mockRecord: TechnicalDataVersionRecord = {
    technicalVersionId: snapshot.sourceTechPackVersionId,
    technicalVersionCode: snapshot.sourceTechPackVersionCode,
    versionLabel: snapshot.sourceTechPackVersionLabel,
    versionNo: 1,
    styleId: snapshot.styleId,
    styleCode: snapshot.styleCode,
    styleName: snapshot.styleName,
    sourceProjectId: '',
    sourceProjectCode: '',
    sourceProjectName: '',
    sourceProjectNodeId: '',
    linkedRevisionTaskIds: [...snapshot.linkedRevisionTaskIds],
    linkedPatternTaskIds: [...snapshot.linkedPatternTaskIds],
    linkedArtworkTaskIds: [...snapshot.linkedArtworkTaskIds],
    createdFromTaskType: 'REVISION',
    createdFromTaskId: '',
    createdFromTaskCode: '',
    baseTechnicalVersionId: '',
    baseTechnicalVersionCode: '',
    linkedPartTemplateIds: [],
    linkedPatternLibraryVersionIds: [],
    versionStatus: snapshot.sourcePublishedAt ? 'PUBLISHED' : 'DRAFT',
    bomStatus: snapshot.bomItems.length > 0 ? 'COMPLETE' : 'EMPTY',
    patternStatus: snapshot.patternFiles.length > 0 ? 'COMPLETE' : 'EMPTY',
    processStatus: snapshot.processEntries.length > 0 ? 'COMPLETE' : 'EMPTY',
    gradingStatus: snapshot.sizeTable.length > 0 ? 'COMPLETE' : 'EMPTY',
    qualityStatus: snapshot.qualityRules.length > 0 ? 'COMPLETE' : 'EMPTY',
    colorMaterialStatus: snapshot.colorMaterialMappings.length > 0 ? 'COMPLETE' : 'EMPTY',
    designStatus: snapshot.patternDesigns.length > 0 ? 'COMPLETE' : 'EMPTY',
    attachmentStatus: snapshot.attachments.length > 0 ? 'COMPLETE' : 'EMPTY',
    bomItemCount: snapshot.bomItems.length,
    patternFileCount: snapshot.patternFiles.length,
    processEntryCount: snapshot.processEntries.length,
    gradingRuleCount: snapshot.sizeTable.length,
    qualityRuleCount: snapshot.qualityRules.length,
    colorMaterialMappingCount: snapshot.colorMaterialMappings.length,
    designAssetCount: snapshot.patternDesigns.length,
    attachmentCount: snapshot.attachments.length,
    completenessScore: snapshot.completenessScore,
    missingItemCodes: [],
    missingItemNames: [],
    publishedAt: snapshot.sourcePublishedAt,
    publishedBy: snapshot.snapshotBy,
    createdAt: snapshot.snapshotAt,
    createdBy: snapshot.snapshotBy,
    updatedAt: snapshot.snapshotAt,
    updatedBy: snapshot.snapshotBy,
    note: '生产单技术包快照兼容对象',
    legacySpuCode: snapshot.styleCode,
    legacyVersionLabel: snapshot.sourceTechPackVersionLabel,
  }

  const mockContent: TechnicalDataVersionContent = {
    technicalVersionId: snapshot.sourceTechPackVersionId,
    patternFiles: clonePatternFiles(snapshot.patternFiles),
    patternDesc: snapshot.patternDesc,
    processEntries: cloneProcessEntries(snapshot.processEntries),
    sizeTable: cloneSizeTable(snapshot.sizeTable),
    bomItems: cloneBomItems(snapshot.bomItems),
    qualityRules: cloneQualityRules(snapshot.qualityRules),
    colorMaterialMappings: cloneColorMappings(snapshot.colorMaterialMappings),
    patternDesigns: clonePatternDesigns(snapshot.patternDesigns),
    attachments: cloneAttachments(snapshot.attachments),
    legacyCompatibleCostPayload: {},
  }

  return buildLegacyTechPackFromTechnicalVersion(mockRecord, mockContent)
}

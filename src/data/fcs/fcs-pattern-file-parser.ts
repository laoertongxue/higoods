import {
  parsePartTemplateFiles,
  resolveTemplateFilePair,
  suggestStandardPartName,
  type ParsedPartInstance,
} from '../../utils/pcs-part-template-parser.ts'
import type {
  TechPackPatternPieceColorAllocation,
  TechPackPatternPieceSpecialCraft,
} from './tech-packs.ts'

export interface FcsParsedPatternPieceRow {
  id: string
  name: string
  count: number
  note: string
  colorAllocations: TechPackPatternPieceColorAllocation[]
  specialCrafts: TechPackPatternPieceSpecialCraft[]
  sourceType: 'PARSED_PATTERN'
  sourcePartName?: string
  systemPieceName?: string
  candidatePartNames?: string[]
  sizeCode?: string
  parsedQuantity?: number
  quantityText?: string
  annotation?: string
  category?: string
  width?: number
  height?: number
  area?: number
  perimeter?: number
  geometryHash?: string
  previewSvg?: string
  parserStatus?: '解析成功' | '待人工矫正' | '解析异常'
  machineReadyStatus?: '可模板机处理' | '待评估' | '不适用'
  rawTextLabels?: string[]
  missingName?: boolean
  missingCount?: boolean
}

export interface FcsParsedPatternResult {
  patternName: string
  dxfFileName: string
  rulFileName: string
  parsedAt: string
  dxfEncoding: string
  rulEncoding: string
  sizeList: string[]
  sampleSize?: string
  pieceRows: FcsParsedPatternPieceRow[]
}

function normalizeText(value: unknown): string {
  return String(value || '').trim()
}

function parsePositiveInteger(value: string | undefined): number | null {
  const normalized = normalizeText(value)
  if (!normalized) return null
  if (!/^\d+$/.test(normalized)) return null
  const numeric = Number.parseInt(normalized, 10)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

function buildRowName(part: ParsedPartInstance): { name: string; missingName: boolean } {
  const suggestedName = normalizeText(suggestStandardPartName(part))
  const sourcePartName = normalizeText(part.sourcePartName)
  const systemPieceName = normalizeText(part.systemPieceName)
  const resolvedName = suggestedName || sourcePartName || systemPieceName
  return {
    name: resolvedName,
    missingName: !resolvedName,
  }
}

function buildRowNote(part: ParsedPartInstance): string {
  return [normalizeText(part.annotation), normalizeText(part.category), normalizeText(part.parserStatus)]
    .filter(Boolean)
    .join('｜')
}

function mapPartToRow(part: ParsedPartInstance, index: number): FcsParsedPatternPieceRow {
  const { name, missingName } = buildRowName(part)
  const parsedCount = parsePositiveInteger(part.quantity)
  const missingCount = parsedCount === null
  return {
    id: `parsed-piece-${index + 1}`,
    name,
    count: parsedCount ?? 0,
    note: buildRowNote(part),
    colorAllocations: [],
    specialCrafts: [],
    sourceType: 'PARSED_PATTERN',
    sourcePartName: normalizeText(part.sourcePartName) || undefined,
    systemPieceName: normalizeText(part.systemPieceName) || undefined,
    candidatePartNames: (part.candidatePartNames ?? []).map((item) => normalizeText(item)).filter(Boolean),
    sizeCode: normalizeText(part.sizeCode) || undefined,
    parsedQuantity: parsedCount ?? undefined,
    quantityText: normalizeText(part.quantity) || undefined,
    annotation: normalizeText(part.annotation) || undefined,
    category: normalizeText(part.category) || undefined,
    width: part.metrics?.width,
    height: part.metrics?.height,
    area: part.metrics?.area,
    perimeter: part.metrics?.perimeter,
    geometryHash: normalizeText(part.geometryHash) || undefined,
    previewSvg: normalizeText(part.previewSvg) || undefined,
    parserStatus: part.parserStatus,
    machineReadyStatus: part.machineReadyStatus,
    rawTextLabels: (part.rawTextLabels ?? []).map((item) => normalizeText(item)).filter(Boolean),
    missingName,
    missingCount,
  }
}

export function resolveFcsPatternFilePair(
  filesLike: File[] | FileList | null | undefined,
): ReturnType<typeof resolveTemplateFilePair> {
  return resolveTemplateFilePair(filesLike)
}

export async function parseFcsPatternFilePair(params: {
  patternName: string
  dxfFile: File
  rulFile: File
}): Promise<FcsParsedPatternResult> {
  const parsed = await parsePartTemplateFiles({
    templateName: params.patternName,
    dxfFile: params.dxfFile,
    rulFile: params.rulFile,
  })

  return {
    patternName: parsed.templateName,
    dxfFileName: parsed.dxfFileName,
    rulFileName: parsed.rulFileName,
    parsedAt: parsed.parsedAt,
    dxfEncoding: parsed.dxfEncoding,
    rulEncoding: parsed.rulEncoding,
    sizeList: [...(parsed.rul.sizeList ?? [])],
    sampleSize: normalizeText(parsed.rul.sampleSize) || undefined,
    pieceRows: parsed.parts.map((part, index) => mapPartToRow(part, index)),
  }
}

export type PatternDuplicateFile = {
  fileName?: string
  fileSize?: number
} | null | undefined

export type PatternDuplicatePieceRow = {
  name?: string
  sourcePartName?: string
  systemPieceName?: string
}

export type PatternDuplicateInput = {
  id?: string
  patternId?: string
  name?: string
  patternName?: string
  type?: string
  patternType?: string
  patternMaterialType?: string
  linkedMaterialId?: string
  linkedBomItemId?: string
  prjFile?: PatternDuplicateFile
  markerImage?: PatternDuplicateFile
  dxfFile?: PatternDuplicateFile
  rulFile?: PatternDuplicateFile
  dxfFileName?: string
  dxfFileSize?: number
  rulFileName?: string
  rulFileSize?: number
  selectedSizeCodes?: string[]
  sizeRange?: string
  pieceRows?: PatternDuplicatePieceRow[]
}

export type PatternDuplicateCheckResult = {
  hasBlockingDuplicate: boolean
  hasWarningDuplicate: boolean
  blockingReasons: string[]
  warningReasons: string[]
  duplicatePatternIds: string[]
  duplicatePatternNames: string[]
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim()
}

function normalizeComparable(value: unknown): string {
  return normalizeText(value).replace(/\s+/g, ' ').toLowerCase()
}

function getPatternId(pattern: PatternDuplicateInput): string {
  return normalizeText(pattern.id || pattern.patternId)
}

function getPatternName(pattern: PatternDuplicateInput): string {
  return normalizeText(pattern.name || pattern.patternName)
}

function getPatternType(pattern: PatternDuplicateInput): string {
  return normalizeText(pattern.patternType || pattern.patternMaterialType || pattern.type)
}

function samePattern(current: PatternDuplicateInput, existing: PatternDuplicateInput): boolean {
  const currentId = getPatternId(current)
  const existingId = getPatternId(existing)
  return Boolean(currentId && existingId && currentId === existingId)
}

function normalizeFile(input: PatternDuplicateFile, legacyName?: string, legacySize?: number): { fileName: string; fileSize: number } {
  return {
    fileName: normalizeComparable(input?.fileName || legacyName),
    fileSize: Number(input?.fileSize ?? legacySize ?? 0),
  }
}

function sameFile(a: ReturnType<typeof normalizeFile>, b: ReturnType<typeof normalizeFile>): boolean {
  return Boolean(a.fileName && b.fileName && a.fileName === b.fileName && a.fileSize > 0 && a.fileSize === b.fileSize)
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function makeResult(): PatternDuplicateCheckResult {
  return {
    hasBlockingDuplicate: false,
    hasWarningDuplicate: false,
    blockingReasons: [],
    warningReasons: [],
    duplicatePatternIds: [],
    duplicatePatternNames: [],
  }
}

function mergeResult(target: PatternDuplicateCheckResult, next: PatternDuplicateCheckResult): PatternDuplicateCheckResult {
  return {
    hasBlockingDuplicate: target.hasBlockingDuplicate || next.hasBlockingDuplicate,
    hasWarningDuplicate: target.hasWarningDuplicate || next.hasWarningDuplicate,
    blockingReasons: unique([...target.blockingReasons, ...next.blockingReasons]),
    warningReasons: unique([...target.warningReasons, ...next.warningReasons]),
    duplicatePatternIds: unique([...target.duplicatePatternIds, ...next.duplicatePatternIds]),
    duplicatePatternNames: unique([...target.duplicatePatternNames, ...next.duplicatePatternNames]),
  }
}

function addDuplicate(
  result: PatternDuplicateCheckResult,
  existing: PatternDuplicateInput,
  reason: string,
  kind: 'blocking' | 'warning',
): PatternDuplicateCheckResult {
  const patternId = getPatternId(existing)
  const patternName = getPatternName(existing)
  return {
    ...result,
    hasBlockingDuplicate: result.hasBlockingDuplicate || kind === 'blocking',
    hasWarningDuplicate: result.hasWarningDuplicate || kind === 'warning',
    blockingReasons: kind === 'blocking' ? unique([...result.blockingReasons, reason]) : result.blockingReasons,
    warningReasons: kind === 'warning' ? unique([...result.warningReasons, reason]) : result.warningReasons,
    duplicatePatternIds: unique([...result.duplicatePatternIds, patternId]),
    duplicatePatternNames: unique([...result.duplicatePatternNames, patternName]),
  }
}

export function buildPatternSignature(pattern: PatternDuplicateInput): string {
  const pieceNames = unique(
    (pattern.pieceRows || [])
      .map((row) => normalizeComparable(row.name || row.sourcePartName || row.systemPieceName))
      .sort(),
  ).join('|')
  const sizes = unique([
    ...(pattern.selectedSizeCodes || []),
    ...normalizeText(pattern.sizeRange).split(/[\/,，、\s]+/),
  ].map((item) => normalizeComparable(item))).sort().join('|')
  return [
    getPatternType(pattern),
    normalizeText(pattern.linkedMaterialId || pattern.linkedBomItemId),
    normalizeText(pattern.dxfFile?.fileName || pattern.dxfFileName),
    normalizeText(pattern.rulFile?.fileName || pattern.rulFileName),
    pieceNames,
    sizes,
  ].map((item) => normalizeComparable(item)).join('::')
}

export function checkDuplicatePatternName(
  pattern: PatternDuplicateInput,
  existingPatterns: PatternDuplicateInput[],
): PatternDuplicateCheckResult {
  const result = makeResult()
  const name = normalizeComparable(getPatternName(pattern))
  if (!name) return result
  return existingPatterns.reduce((current, existing) => {
    if (samePattern(pattern, existing)) return current
    if (normalizeComparable(getPatternName(existing)) !== name) return current
    return addDuplicate(current, existing, '当前技术包已存在同名纸样，请修改纸样名称。', 'blocking')
  }, result)
}

export function checkDuplicateLinkedMaterial(
  pattern: PatternDuplicateInput,
  existingPatterns: PatternDuplicateInput[],
): PatternDuplicateCheckResult {
  const result = makeResult()
  const linkedMaterialId = normalizeText(pattern.linkedMaterialId || pattern.linkedBomItemId)
  const patternType = normalizeComparable(getPatternType(pattern))
  if (!linkedMaterialId || !patternType) return result
  return existingPatterns.reduce((current, existing) => {
    if (samePattern(pattern, existing)) return current
    const existingMaterialId = normalizeText(existing.linkedMaterialId || existing.linkedBomItemId)
    if (existingMaterialId !== linkedMaterialId || normalizeComparable(getPatternType(existing)) !== patternType) return current
    return addDuplicate(current, existing, '当前技术包中该物料已关联相同类型纸样，是否继续保存为新纸样？', 'warning')
  }, result)
}

export function checkDuplicatePrjFile(
  pattern: PatternDuplicateInput,
  existingPatterns: PatternDuplicateInput[],
): PatternDuplicateCheckResult {
  const result = makeResult()
  const currentFile = normalizeFile(pattern.prjFile)
  return existingPatterns.reduce((current, existing) => {
    if (samePattern(pattern, existing)) return current
    return sameFile(currentFile, normalizeFile(existing.prjFile))
      ? addDuplicate(current, existing, '当前技术包已上传相同 PRJ 文件，请勿重复上传同一纸样。', 'blocking')
      : current
  }, result)
}

export function checkDuplicateDxfFile(
  pattern: PatternDuplicateInput,
  existingPatterns: PatternDuplicateInput[],
): PatternDuplicateCheckResult {
  const result = makeResult()
  const currentFile = normalizeFile(pattern.dxfFile, pattern.dxfFileName, pattern.dxfFileSize)
  return existingPatterns.reduce((current, existing) => {
    if (samePattern(pattern, existing)) return current
    return sameFile(currentFile, normalizeFile(existing.dxfFile, existing.dxfFileName, existing.dxfFileSize))
      ? addDuplicate(current, existing, '当前技术包已上传相同 DXF 文件，请勿重复上传同一纸样。', 'blocking')
      : current
  }, result)
}

export function checkDuplicateRulFile(
  pattern: PatternDuplicateInput,
  existingPatterns: PatternDuplicateInput[],
): PatternDuplicateCheckResult {
  const result = makeResult()
  const currentFile = normalizeFile(pattern.rulFile, pattern.rulFileName, pattern.rulFileSize)
  return existingPatterns.reduce((current, existing) => {
    if (samePattern(pattern, existing)) return current
    return sameFile(currentFile, normalizeFile(existing.rulFile, existing.rulFileName, existing.rulFileSize))
      ? addDuplicate(current, existing, '当前技术包已上传相同 RUL 文件，请勿重复上传同一纸样。', 'blocking')
      : current
  }, result)
}

export function checkDuplicateMarkerImage(
  pattern: PatternDuplicateInput,
  existingPatterns: PatternDuplicateInput[],
): PatternDuplicateCheckResult {
  const result = makeResult()
  const currentFile = normalizeFile(pattern.markerImage)
  return existingPatterns.reduce((current, existing) => {
    if (samePattern(pattern, existing)) return current
    return sameFile(currentFile, normalizeFile(existing.markerImage))
      ? addDuplicate(current, existing, '当前技术包已存在相同唛架图片，是否继续保存为新纸样？', 'warning')
      : current
  }, result)
}

export function checkSimilarParsedStructure(
  pattern: PatternDuplicateInput,
  existingPatterns: PatternDuplicateInput[],
): PatternDuplicateCheckResult {
  const result = makeResult()
  const currentSignature = buildPatternSignature({
    ...pattern,
    dxfFile: null,
    rulFile: null,
    dxfFileName: '',
    rulFileName: '',
  })
  if (!currentSignature.replace(/:/g, '')) return result
  return existingPatterns.reduce((current, existing) => {
    if (samePattern(pattern, existing)) return current
    const existingSignature = buildPatternSignature({
      ...existing,
      dxfFile: null,
      rulFile: null,
      dxfFileName: '',
      rulFileName: '',
    })
    if (existingSignature !== currentSignature) return current
    return addDuplicate(current, existing, '当前技术包中存在结构相似的纸样，请确认是否重复上传。', 'warning')
  }, result)
}

export function checkDuplicatePattern(
  pattern: PatternDuplicateInput,
  existingPatterns: PatternDuplicateInput[],
): PatternDuplicateCheckResult {
  return [
    checkDuplicatePatternName,
    checkDuplicateLinkedMaterial,
    checkDuplicatePrjFile,
    checkDuplicateDxfFile,
    checkDuplicateRulFile,
    checkDuplicateMarkerImage,
    checkSimilarParsedStructure,
  ].reduce(
    (result, checker) => mergeResult(result, checker(pattern, existingPatterns)),
    makeResult(),
  )
}

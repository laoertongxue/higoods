import { appStore } from '../../state/store.ts'
import {
  parseFcsPatternFilePair,
  resolveFcsPatternFilePair,
} from '../../data/fcs/fcs-pattern-file-parser.ts'
import { publishTechnicalDataVersion } from '../../data/pcs-project-technical-data-writeback.ts'
import {
  TECH_PACK_PATTERN_CATEGORY_OPTIONS,
  buildPatternDisplayFile,
  buildPatternFormStateFromItem,
  closeAllDialogs,
  canEditTechnique,
  copySystemDraftToManual,
  createEmptyMappingLine,
  currentUser,
  dedupeStrings,
  buildPatternPiecePartKey,
  getBaselineProcessByCode,
  getCraftOptionByCode,
  getBomColorOptionsForPattern,
  getPartTemplateRecordById,
  getPatternPieceSpecialCraftOptionsFromCurrentTechPack,
  getPatternDesignOptionsBySide,
  getPatternMaterialTypeLabel,
  getPatternParseStatusLabel,
  getPatternById,
  getPatternPieceById,
  getSizeCodeOptionsFromSizeRules,
  getTechniqueReferenceMetaByCraftCode,
  isBomDrivenPrepTechnique,
  isPrepStage,
  getSelectedDraftMeta,
  getSkuOptionsForCurrentSpu,
  normalizePatternPieceRows,
  requestTechPackRender,
  resetAttachmentForm,
  resetBomForm,
  resetColorMappingToSystemSuggestion,
  resetPatternForm,
  resetQualityRuleForm,
  resetSizeForm,
  resetTechniqueForm,
  state,
  stageNameToCode,
  syncMaterialCostRows,
  syncProcessCostRows,
  syncTechPackToStore,
  toTimestamp,
  touchMappingAsManual,
  updateColorMapping,
  updateColorMappingLine,
} from './context.ts'
import type {
  BomItemRow,
  TechPackAssignmentGranularity,
  TechPackDetailSplitDimension,
  TechPackPatternMaterialType,
  TechPackSizeRow,
  TechPackTab,
  TechniqueItem,
} from './context.ts'

function getTechniqueById(techId: string): TechniqueItem | null {
  return state.techniques.find((item) => item.id === techId) ?? null
}

function updateTechnique(techId: string, updater: (item: TechniqueItem) => TechniqueItem): void {
  state.techniques = state.techniques.map((item) => (item.id === techId ? updater(item) : item))
  syncProcessCostRows()
  syncTechPackToStore()
}

function clearParsedPatternRows(): void {
  state.newPattern.pieceRows = []
  state.newPattern.totalPieceCount = 0
}

function clearWovenFileState(): void {
  state.newPattern.selectedDxfFile = null
  state.newPattern.selectedRulFile = null
  state.newPattern.dxfFileName = ''
  state.newPattern.dxfFileSize = 0
  state.newPattern.dxfLastModified = ''
  state.newPattern.rulFileName = ''
  state.newPattern.rulFileSize = 0
  state.newPattern.rulLastModified = ''
  state.newPattern.dxfEncoding = ''
  state.newPattern.rulEncoding = ''
  state.newPattern.rulSizeList = []
  state.newPattern.rulSampleSize = ''
  state.newPattern.file = ''
}

function clearKnitFileState(): void {
  state.newPattern.selectedSinglePatternFile = null
  state.newPattern.singlePatternFileName = ''
  state.newPattern.singlePatternFileSize = 0
  state.newPattern.singlePatternFileLastModified = ''
  if (state.newPattern.patternFileMode === 'SINGLE_FILE') {
    state.newPattern.file = ''
  }
}

function clearPatternParseState(status: 'NOT_PARSED' | 'NOT_REQUIRED' = 'NOT_PARSED'): void {
  state.newPattern.patternParsing = false
  state.newPattern.parseStatus = status
  state.newPattern.parseStatusLabel = getPatternParseStatusLabel(status)
  state.newPattern.parseError = ''
  state.newPattern.parsedAt = ''
}

function revokeDraftDesignPreview(): void {
}

function resetDesignDraft(): void {
  revokeDraftDesignPreview()
  state.newDesignName = ''
  state.newDesignSideType = 'FRONT'
  state.newDesignFileName = ''
  state.newDesignOriginalFileMimeType = ''
  state.newDesignOriginalFileDataUrl = ''
  state.newDesignPreviewThumbnailDataUrl = ''
  state.selectedDesignFile = null
}

function buildDesignPlaceholderImage(fileName: string, sideType: 'FRONT' | 'INSIDE'): string {
  const label = sideType === 'FRONT' ? '正面花型' : '里面花型'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="100%" height="100%" fill="#f3f4f6"/><rect x="24" y="24" width="272" height="272" rx="16" fill="#ffffff" stroke="#d1d5db"/><text x="160" y="138" text-anchor="middle" font-size="26" fill="#111827" font-family="Arial, sans-serif">${label}</text><text x="160" y="182" text-anchor="middle" font-size="16" fill="#6b7280" font-family="Arial, sans-serif">${fileName || '设计稿文件'}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function isImageDesignFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  return /\.(png|jpe?g|webp|svg)$/i.test(file.name)
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('读取设计稿文件失败'))
    reader.readAsDataURL(file)
  })
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('生成设计稿缩略图失败'))
    image.src = source
  })
}

async function buildDesignThumbnailDataUrl(
  originalFileDataUrl: string,
  fileName: string,
  sideType: 'FRONT' | 'INSIDE',
): Promise<string> {
  if (!originalFileDataUrl.startsWith('data:image/')) {
    return buildDesignPlaceholderImage(fileName, sideType)
  }

  const image = await loadImage(originalFileDataUrl)
  const maxSize = 320
  const scale = Math.min(maxSize / image.width, maxSize / image.height, 1)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const context = canvas.getContext('2d')
  if (!context) return buildDesignPlaceholderImage(fileName, sideType)
  context.fillStyle = '#f8fafc'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}

async function applySelectedDesignFile(file: File | null): Promise<void> {
  state.selectedDesignFile = file
  state.newDesignFileName = file?.name || ''
  state.newDesignOriginalFileMimeType = file?.type || ''
  state.newDesignOriginalFileDataUrl = ''
  state.newDesignPreviewThumbnailDataUrl = file
    ? buildDesignPlaceholderImage(file.name, state.newDesignSideType)
    : ''

  if (!file) {
    requestTechPackRender()
    return
  }

  try {
    const originalFileDataUrl = await readFileAsDataUrl(file)
    const previewThumbnailDataUrl = isImageDesignFile(file)
      ? await buildDesignThumbnailDataUrl(originalFileDataUrl, file.name, state.newDesignSideType)
      : buildDesignPlaceholderImage(file.name, state.newDesignSideType)

    if (state.selectedDesignFile !== file) return

    state.newDesignOriginalFileDataUrl = originalFileDataUrl
    state.newDesignPreviewThumbnailDataUrl = previewThumbnailDataUrl
  } catch {
    if (state.selectedDesignFile !== file) return
    state.newDesignOriginalFileDataUrl = ''
    state.newDesignPreviewThumbnailDataUrl = buildDesignPlaceholderImage(file.name, state.newDesignSideType)
  }

  requestTechPackRender()
}

function triggerDataUrlDownload(dataUrl: string, fileName: string): void {
  const anchor = document.createElement('a')
  anchor.href = dataUrl
  anchor.download = fileName || '设计稿文件'
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

function getPatternPieceTemplateConflict(
  pieceId: string,
  templateId: string,
): (typeof state.newPattern.pieceRows)[number] | null {
  const activeRow = state.newPattern.pieceRows.find((row) => row.id === pieceId)
  if (!activeRow) return null
  const partKey = buildPatternPiecePartKey(activeRow)
  if (!partKey) return null

  return (
    state.newPattern.pieceRows.find(
      (row) =>
        row.id !== pieceId
        && row.isTemplate
        && String(row.partTemplateId || '').trim()
        && buildPatternPiecePartKey(row) === partKey
        && String(row.partTemplateId || '').trim() !== templateId,
    ) ?? null
  )
}

function applyBomPrintRequirementChange(nextRequirement: string): void {
  state.newBomItem.printRequirement = nextRequirement
  if (nextRequirement === '无') {
    state.newBomItem.printSideMode = ''
    state.newBomItem.frontPatternDesignId = ''
    state.newBomItem.insidePatternDesignId = ''
  }
}

function applyBomPrintSideModeChange(nextMode: '' | 'SINGLE' | 'DOUBLE'): void {
  state.newBomItem.printSideMode = nextMode
  if (nextMode !== 'DOUBLE') {
    state.newBomItem.insidePatternDesignId = ''
  }
  if (nextMode === '') {
    state.newBomItem.frontPatternDesignId = ''
  }
}

function updatePatternPieceRow(
  pieceId: string,
  updater: (row: (typeof state.newPattern.pieceRows)[number]) => (typeof state.newPattern.pieceRows)[number],
): void {
  state.newPattern.pieceRows = state.newPattern.pieceRows.map((row) =>
    row.id === pieceId ? updater(row) : row,
  )
}

function clearPatternPieceTemplate(pieceId: string): void {
  updatePatternPieceRow(pieceId, (row) => ({
    ...row,
    isTemplate: false,
    partTemplateId: undefined,
    partTemplateName: undefined,
    partTemplatePreviewSvg: undefined,
    partTemplateShapeDescription: undefined,
  }))
}

function openPatternTemplateDialogForPiece(pieceId: string): void {
  state.activePatternTemplatePieceId = pieceId
  state.patternTemplateDialogOpen = true
  state.patternTemplateSearchKeyword = ''
}

function closePatternTemplateDialog(restoreIfMissing = true): void {
  const activePieceId = state.activePatternTemplatePieceId
  if (restoreIfMissing && activePieceId) {
    const activeRow = state.newPattern.pieceRows.find((row) => row.id === activePieceId)
    if (activeRow?.isTemplate && !String(activeRow.partTemplateId || '').trim()) {
      clearPatternPieceTemplate(activePieceId)
    }
  }
  state.patternTemplateDialogOpen = false
  state.activePatternTemplatePieceId = null
  state.patternTemplateSearchKeyword = ''
}

function buildColorAllocationId(pieceId: string, colorName: string): string {
  return `${pieceId}-${colorName.trim().replace(/\s+/g, '-')}`
}

function syncPieceApplicableSkuCodes(pieceId: string): void {
  updatePatternPieceRow(pieceId, (row) => ({
    ...row,
    applicableSkuCodes: dedupeStrings(
      row.colorAllocations.flatMap((allocation) => allocation.skuCodes ?? []),
    ),
  }))
}

function getPatternSizeCodeSet(): Set<string> {
  return new Set(getSizeCodeOptionsFromSizeRules().map((item) => item.sizeCode))
}

function getPatternBomColorOptions() {
  return getBomColorOptionsForPattern(state.newPattern.linkedBomItemId)
}

function getPatternBomColorNameSet(): Set<string> {
  return new Set(
    getPatternBomColorOptions().map((item) => item.colorName.trim().toLowerCase()),
  )
}

function getPatternSpecialCraftKeySet(): Set<string> {
  return new Set(
    getPatternPieceSpecialCraftOptionsFromCurrentTechPack().map((item) => `${item.processCode}:${item.craftCode}`),
  )
}

function toFileLastModifiedText(file: File): string {
  return new Date(file.lastModified).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function applyPatternMaterialTypeChange(nextType: TechPackPatternMaterialType): void {
  state.newPattern.patternMaterialType = nextType
  state.newPattern.patternMaterialTypeLabel = getPatternMaterialTypeLabel(nextType)

  if (nextType === 'WOVEN') {
    clearKnitFileState()
    clearParsedPatternRows()
    state.newPattern.patternFileMode = 'PAIRED_DXF_RUL'
    clearPatternParseState('NOT_PARSED')
    return
  }

  if (nextType === 'KNIT') {
    clearWovenFileState()
    clearParsedPatternRows()
    state.newPattern.patternFileMode = 'SINGLE_FILE'
    clearPatternParseState('NOT_REQUIRED')
    return
  }

  state.newPattern.patternFileMode = 'SINGLE_FILE'
  clearWovenFileState()
  clearKnitFileState()
  clearParsedPatternRows()
  clearPatternParseState('NOT_PARSED')
}

async function startPatternParsing(): Promise<void> {
  if (state.newPattern.patternMaterialType !== 'WOVEN') return
  if (!state.newPattern.name.trim()) {
    state.newPattern.parseError = '请先填写纸样名称'
    requestTechPackRender()
    return
  }

  state.newPattern.patternParsing = true
  state.newPattern.parseStatus = 'PARSING'
  state.newPattern.parseStatusLabel = getPatternParseStatusLabel('PARSING')
  state.newPattern.parseError = ''
  requestTechPackRender()

  try {
    const pair = resolveFcsPatternFilePair([
      state.newPattern.selectedDxfFile,
      state.newPattern.selectedRulFile,
    ].filter((file): file is File => Boolean(file)))

    if (!pair) {
      throw new Error('请成对上传 1 个 DXF 和 1 个 RUL 文件')
    }

    const parsed = await parseFcsPatternFilePair({
      patternName: state.newPattern.name.trim(),
      dxfFile: pair.dxfFile,
      rulFile: pair.rulFile,
    })

    const normalizedRows = normalizePatternPieceRows(
      parsed.pieceRows,
      state.editPatternItemId || `PAT-${Date.now()}`,
      state.newPattern.linkedBomItemId,
    )
    state.newPattern.dxfFileName = parsed.dxfFileName
    state.newPattern.rulFileName = parsed.rulFileName
    state.newPattern.dxfEncoding = parsed.dxfEncoding
    state.newPattern.rulEncoding = parsed.rulEncoding
    state.newPattern.parsedAt = parsed.parsedAt
    state.newPattern.rulSizeList = [...parsed.sizeList]
    state.newPattern.rulSampleSize = parsed.sampleSize || ''
    state.newPattern.parseStatus = 'PARSED'
    state.newPattern.parseStatusLabel = getPatternParseStatusLabel('PARSED')
    state.newPattern.parseError = ''
    state.newPattern.pieceRows = normalizedRows.map((row) => ({
      ...row,
      colorAllocations: [],
      specialCrafts: [],
      isTemplate: false,
      partTemplateId: undefined,
      partTemplateName: undefined,
      partTemplatePreviewSvg: undefined,
      partTemplateShapeDescription: undefined,
      note: row.note || row.annotation || '',
    }))
    state.newPattern.totalPieceCount = normalizedRows.reduce((sum, row) => sum + row.count, 0)
    state.newPattern.file = buildPatternDisplayFile({
      patternFileMode: 'PAIRED_DXF_RUL',
      dxfFileName: parsed.dxfFileName,
      rulFileName: parsed.rulFileName,
    })
  } catch (error) {
    clearParsedPatternRows()
    state.newPattern.parseStatus = 'FAILED'
    state.newPattern.parseStatusLabel = getPatternParseStatusLabel('FAILED')
    state.newPattern.parseError = error instanceof Error ? error.message : '解析失败'
    state.newPattern.parsedAt = ''
  } finally {
    state.newPattern.patternParsing = false
    requestTechPackRender()
  }
}

function validatePatternForm(): string | null {
  if (!state.newPattern.name.trim()) return '请先填写纸样名称'
  if (state.newPattern.patternMaterialType === 'UNKNOWN') return '请选择纸样文件类型'
  const sizeCodeSet = getPatternSizeCodeSet()
  if (sizeCodeSet.size === 0) return '请先维护放码规则'
  if (
    state.newPattern.selectedSizeCodes.length === 0
    || state.newPattern.selectedSizeCodes.some((code) => !sizeCodeSet.has(code))
  ) {
    return '请至少选择 1 个尺码'
  }

  const bomColorOptions = getPatternBomColorOptions()
  if (bomColorOptions.length === 0) return '请先维护物料清单颜色'
  const bomColorNameSet = getPatternBomColorNameSet()
  const validSpecialCraftKeys = getPatternSpecialCraftKeySet()

  const invalidColorRow = state.newPattern.pieceRows.find((row) => {
    if (row.colorAllocations.length === 0) return true
    return row.colorAllocations.some(
      (allocation) =>
        !bomColorNameSet.has(allocation.colorName.trim().toLowerCase())
        || !Number.isFinite(Number(allocation.pieceCount))
        || Number(allocation.pieceCount) <= 0,
    )
  })
  if (invalidColorRow) return '每行裁片必须至少选择 1 个适用颜色，并填写每种颜色的片数'

  const invalidSpecialCraftRow = state.newPattern.pieceRows.find((row) =>
    row.specialCrafts.some(
      (craft) => !validSpecialCraftKeys.has(`${craft.processCode}:${craft.craftCode}`),
    ),
  )
  if (invalidSpecialCraftRow) return '特殊工艺必须来自工序工艺字典'

  const invalidTemplateRow = state.newPattern.pieceRows.find(
    (row) => row.isTemplate && !String(row.partTemplateId || '').trim(),
  )
  if (invalidTemplateRow) return '选择了模板裁片后，必须指定具体部位模板'

  const templateIdsByPartKey = new Map<string, Set<string>>()
  state.newPattern.pieceRows.forEach((row) => {
    if (!row.isTemplate || !String(row.partTemplateId || '').trim()) return
    const partKey = buildPatternPiecePartKey(row)
    if (!partKey) return
    const current = templateIdsByPartKey.get(partKey) || new Set<string>()
    current.add(String(row.partTemplateId || '').trim())
    templateIdsByPartKey.set(partKey, current)
  })
  if (Array.from(templateIdsByPartKey.values()).some((item) => item.size > 1)) {
    return '同一部位只能绑定一个模板，请统一模板绑定后再保存'
  }

  if (state.newPattern.patternMaterialType === 'WOVEN') {
    if (state.newPattern.parseStatus !== 'PARSED') return '布料纸样需先解析纸样'
    if (state.newPattern.pieceRows.length === 0) return '布料纸样解析不到裁片明细，不能保存'
    const invalidRow = state.newPattern.pieceRows.find(
      (row) =>
        row.sourceType !== 'PARSED_PATTERN'
        || !row.name.trim()
        || Number(row.count) <= 0
        || row.missingName
        || row.missingCount,
    )
    if (invalidRow?.missingName) return '布料纸样存在名称缺失，不能保存'
    if (invalidRow?.missingCount) return '布料纸样存在数量缺失，不能保存'
    if (invalidRow) return '布料纸样解析结果不完整，不能保存'
    return null
  }

  if (!state.newPattern.singlePatternFileName.trim() && !state.newPattern.file.trim()) {
    return '针织纸样需先选择纸样文件'
  }
  if (state.newPattern.pieceRows.length === 0) return '针织纸样至少保留 1 行裁片明细'
  const invalidRow = state.newPattern.pieceRows.find(
    (row) => row.sourceType !== 'MANUAL' || !row.name.trim() || Number(row.count) <= 0,
  )
  if (invalidRow) return '针织纸样裁片名称和片数必须填写完整'
  return null
}

function handleTechPackField(
  node: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
): boolean {
  const field = node.dataset.techField
  if (!field) return false

  const value = node.value
  const checked = node instanceof HTMLInputElement ? node.checked : false

  if (field === 'new-pattern-name') {
    state.newPattern.name = value
    return true
  }
  if (field === 'new-pattern-material-type') {
    applyPatternMaterialTypeChange(
      value === 'WOVEN' || value === 'KNIT' ? value : 'UNKNOWN',
    )
    return true
  }
  if (field === 'new-pattern-type') {
    state.newPattern.type = TECH_PACK_PATTERN_CATEGORY_OPTIONS.includes(value as never)
      ? value
      : '其他'
    return true
  }
  if (field === 'new-pattern-image') {
    state.newPattern.image = value
    return true
  }
  if (field === 'new-pattern-dxf-file' && node instanceof HTMLInputElement) {
    const file = node.files?.[0] ?? null
    state.newPattern.selectedDxfFile = file
    state.newPattern.dxfFileName = file?.name || ''
    state.newPattern.dxfFileSize = file?.size || 0
    state.newPattern.dxfLastModified = file ? toFileLastModifiedText(file) : ''
    clearParsedPatternRows()
    clearPatternParseState('NOT_PARSED')
    state.newPattern.file = buildPatternDisplayFile({
      patternFileMode: 'PAIRED_DXF_RUL',
      dxfFileName: state.newPattern.dxfFileName,
      rulFileName: state.newPattern.rulFileName,
    })
    return true
  }
  if (field === 'new-pattern-rul-file' && node instanceof HTMLInputElement) {
    const file = node.files?.[0] ?? null
    state.newPattern.selectedRulFile = file
    state.newPattern.rulFileName = file?.name || ''
    state.newPattern.rulFileSize = file?.size || 0
    state.newPattern.rulLastModified = file ? toFileLastModifiedText(file) : ''
    clearParsedPatternRows()
    clearPatternParseState('NOT_PARSED')
    state.newPattern.file = buildPatternDisplayFile({
      patternFileMode: 'PAIRED_DXF_RUL',
      dxfFileName: state.newPattern.dxfFileName,
      rulFileName: state.newPattern.rulFileName,
    })
    return true
  }
  if (field === 'new-pattern-single-file' && node instanceof HTMLInputElement) {
    const file = node.files?.[0] ?? null
    state.newPattern.selectedSinglePatternFile = file
    state.newPattern.singlePatternFileName = file?.name || ''
    state.newPattern.singlePatternFileSize = file?.size || 0
    state.newPattern.singlePatternFileLastModified = file ? toFileLastModifiedText(file) : ''
    state.newPattern.file = buildPatternDisplayFile({
      patternFileMode: 'SINGLE_FILE',
      singlePatternFileName: state.newPattern.singlePatternFileName,
    })
    return true
  }
  if (field === 'new-pattern-file') {
    state.newPattern.file = value
    return true
  }
  if (field === 'new-pattern-remark') {
    state.newPattern.remark = value
    return true
  }
  if (field === 'new-pattern-pattern-software-name') {
    state.newPattern.patternSoftwareName = value
    return true
  }
  if (field === 'new-pattern-linked-bom-item') {
    state.newPattern.linkedBomItemId = value
    state.newPattern.pieceRows = state.newPattern.pieceRows.map((row) => ({
      ...row,
      colorAllocations: row.colorAllocations.filter((allocation) =>
        getBomColorOptionsForPattern(value).some(
          (option) => option.colorName.trim().toLowerCase() === allocation.colorName.trim().toLowerCase(),
        ),
      ),
    }))
    state.newPattern.pieceRows.forEach((row) => syncPieceApplicableSkuCodes(row.id))
    return true
  }
  if (field === 'new-pattern-width-cm') {
    state.newPattern.widthCm = Number.parseFloat(value) || 0
    return true
  }
  if (field === 'new-pattern-marker-length-m') {
    state.newPattern.markerLengthM = Number.parseFloat(value) || 0
    return true
  }
  if (field === 'new-pattern-total-piece-count') {
    state.newPattern.totalPieceCount = Number.parseInt(value, 10) || 0
    return true
  }
  if (field === 'new-pattern-piece-name') {
    if (state.newPattern.patternMaterialType === 'WOVEN') return true
    const pieceId = node.dataset.pieceId
    if (!pieceId) return true
    updatePatternPieceRow(pieceId, (row) => ({ ...row, name: value }))
    return true
  }
  if (field === 'new-pattern-piece-count') {
    if (state.newPattern.patternMaterialType === 'WOVEN') return true
    const pieceId = node.dataset.pieceId
    if (!pieceId) return true
    const nextCount = Number.parseInt(value, 10) || 0
    updatePatternPieceRow(pieceId, (row) => ({
      ...row,
      count: nextCount,
      colorAllocations: row.colorAllocations.map((allocation) =>
        allocation.pieceCount > 0 ? allocation : { ...allocation, pieceCount: nextCount }
      ),
    }))
    return true
  }
  if (field === 'new-pattern-piece-note') {
    const pieceId = node.dataset.pieceId
    if (!pieceId) return true
    updatePatternPieceRow(pieceId, (row) => ({ ...row, note: value }))
    return true
  }
  if (field === 'new-pattern-piece-is-template') {
    const pieceId = node.dataset.pieceId
    if (!pieceId) return true
    if (value === 'true') {
      updatePatternPieceRow(pieceId, (row) => ({ ...row, isTemplate: true }))
      openPatternTemplateDialogForPiece(pieceId)
    } else {
      clearPatternPieceTemplate(pieceId)
    }
    return true
  }
  if (field === 'new-pattern-piece-color-count') {
    const pieceId = node.dataset.pieceId
    const colorName = node.dataset.colorName
    if (!pieceId || !colorName) return true
    const pieceCount = Number.parseInt(value, 10) || 0
    updatePatternPieceRow(pieceId, (row) => ({
      ...row,
      colorAllocations: row.colorAllocations.map((allocation) =>
        allocation.colorName === colorName
          ? { ...allocation, pieceCount }
          : allocation,
      ),
    }))
    syncPieceApplicableSkuCodes(pieceId)
    return true
  }

  if (field === 'new-bom-type') {
    state.newBomItem.type = value
    return true
  }
  if (field === 'new-bom-color-label') {
    state.newBomItem.colorLabel = value
    return true
  }
  if (field === 'new-bom-material-code') {
    state.newBomItem.materialCode = value
    return true
  }
  if (field === 'new-bom-material-name') {
    state.newBomItem.materialName = value
    return true
  }
  if (field === 'new-bom-spec') {
    state.newBomItem.spec = value
    return true
  }
  if (field === 'new-bom-usage') {
    state.newBomItem.usage = value
    return true
  }
  if (field === 'new-bom-loss-rate') {
    state.newBomItem.lossRate = value
    return true
  }
  if (field === 'new-bom-print-requirement') {
    applyBomPrintRequirementChange(value)
    return true
  }
  if (field === 'new-bom-dye-requirement') {
    state.newBomItem.dyeRequirement = value
    return true
  }
  if (field === 'new-bom-print-side-mode') {
    applyBomPrintSideModeChange((value === 'SINGLE' || value === 'DOUBLE' ? value : '') as '' | 'SINGLE' | 'DOUBLE')
    return true
  }
  if (field === 'new-bom-front-pattern-design-id') {
    state.newBomItem.frontPatternDesignId = value
    return true
  }
  if (field === 'new-bom-inside-pattern-design-id') {
    state.newBomItem.insidePatternDesignId = value
    return true
  }
  if (field === 'new-bom-apply-all-sku') {
    if (checked) {
      state.newBomItem.applicableSkuCodes = []
      state.newBomItem.colorLabel = '全部SKU（当前未区分颜色）'
    } else if (state.newBomItem.applicableSkuCodes.length === 0) {
      const skuOptions = getSkuOptionsForCurrentSpu()
      if (skuOptions.length > 0) {
        state.newBomItem.applicableSkuCodes = [skuOptions[0].skuCode]
        if (!state.newBomItem.colorLabel || state.newBomItem.colorLabel.startsWith('全部SKU')) {
          state.newBomItem.colorLabel = skuOptions[0].color
        }
      }
    }
    return true
  }
  if (field === 'new-bom-sku') {
    const skuCode = node.dataset.skuCode
    if (!skuCode) return true
    if (checked) {
      const current = new Set(state.newBomItem.applicableSkuCodes)
      current.add(skuCode)
      state.newBomItem.applicableSkuCodes = Array.from(current)
    } else {
      state.newBomItem.applicableSkuCodes = state.newBomItem.applicableSkuCodes.filter(
        (code) => code !== skuCode,
      )
    }
    return true
  }
  if (field === 'new-bom-usage-process') {
    const processCode = node.dataset.processCode
    if (!processCode) return true
    if (checked) {
      state.newBomItem.usageProcessCodes = dedupeStrings([
        ...state.newBomItem.usageProcessCodes,
        processCode,
      ])
    } else {
      state.newBomItem.usageProcessCodes = state.newBomItem.usageProcessCodes.filter(
        (code) => code !== processCode,
      )
    }
    return true
  }

  if (field === 'new-technique-entry-type') {
    const entryType = value === 'PROCESS_BASELINE' ? 'PROCESS_BASELINE' : 'CRAFT'
    state.newTechnique = {
      ...state.newTechnique,
      entryType,
      baselineProcessCode: '',
      craftCode: '',
      ruleSource: entryType === 'PROCESS_BASELINE' ? 'INHERIT_PROCESS' : 'INHERIT_PROCESS',
      assignmentGranularity: 'ORDER',
      detailSplitMode: 'COMPOSITE',
      detailSplitDimensions: ['PATTERN', 'MATERIAL_SKU'],
      standardTime: '',
      timeUnit: '分钟/件',
      difficulty: '中等',
      remark: '',
    }
    return true
  }
  if (field === 'new-technique-process-code') {
    state.newTechnique = {
      ...state.newTechnique,
      processCode: value,
      craftCode: '',
    }
    return true
  }
  if (field === 'new-technique-baseline-process') {
    const option = getBaselineProcessByCode(value)
    state.newTechnique = {
      ...state.newTechnique,
      baselineProcessCode: value,
      ruleSource: 'INHERIT_PROCESS',
      assignmentGranularity: option?.assignmentGranularity ?? 'ORDER',
      detailSplitMode: option?.detailSplitMode ?? 'COMPOSITE',
      detailSplitDimensions: [...(option?.detailSplitDimensions ?? ['PATTERN', 'MATERIAL_SKU'])],
      standardTime: option?.processCode === 'DYE' ? '10' : option ? '12' : '',
      timeUnit: option?.processCode === 'DYE' ? '分钟/件' : '分钟/件',
      difficulty: option?.processCode === 'DYE' ? '中等' : option ? '中等' : state.newTechnique.difficulty,
    }
    return true
  }
  if (field === 'new-technique-craft-code') {
    const craft = getCraftOptionByCode(value)
    state.newTechnique = {
      ...state.newTechnique,
      craftCode: value,
      standardTime: craft ? String(craft.referencePublishedSamValue) : state.newTechnique.standardTime,
      timeUnit: craft ? craft.referencePublishedSamUnitLabel : state.newTechnique.timeUnit,
    }
    return true
  }
  if (field === 'new-technique-rule-source') {
    state.newTechnique.ruleSource = value === 'OVERRIDE_CRAFT' ? 'OVERRIDE_CRAFT' : 'INHERIT_PROCESS'
    return true
  }
  if (field === 'new-technique-assignment-granularity') {
    state.newTechnique.assignmentGranularity = (value || 'ORDER') as TechPackAssignmentGranularity
    return true
  }
  if (field === 'new-technique-detail-split-mode') {
    state.newTechnique.detailSplitMode = 'COMPOSITE'
    return true
  }
  if (field === 'new-technique-detail-split-dimension') {
    const dimension = node.dataset.dimension as TechPackDetailSplitDimension | undefined
    if (!dimension) return true
    const current = new Set(state.newTechnique.detailSplitDimensions)
    if (checked) {
      current.add(dimension)
    } else {
      current.delete(dimension)
    }
    state.newTechnique.detailSplitDimensions = Array.from(current)
    return true
  }
  if (field === 'new-technique-standard-time') {
    state.newTechnique.standardTime = value
    return true
  }
  if (field === 'new-technique-time-unit') {
    state.newTechnique.timeUnit = value
    return true
  }
  if (field === 'new-technique-difficulty') {
    state.newTechnique.difficulty = value as TechniqueItem['difficulty']
    return true
  }
  if (field === 'new-technique-remark') {
    state.newTechnique.remark = value
    return true
  }

  if (field === 'bom-print') {
    const bomId = node.dataset.bomId
    if (!bomId) return true
    state.bomItems = state.bomItems.map((item) =>
      item.id === bomId
        ? {
            ...item,
            printRequirement: value,
            ...(value === '无'
              ? {
                  printSideMode: '',
                  frontPatternDesignId: '',
                  insidePatternDesignId: '',
                }
              : {}),
          }
        : item,
    )
    syncTechPackToStore()
    return true
  }
  if (field === 'bom-dye') {
    const bomId = node.dataset.bomId
    if (!bomId) return true
    state.bomItems = state.bomItems.map((item) =>
      item.id === bomId ? { ...item, dyeRequirement: value } : item,
    )
    syncTechPackToStore()
    return true
  }

  if (field === 'tech-standard-time') {
    const techId = node.dataset.techId
    if (!techId) return true
    updateTechnique(techId, (item) => ({
      ...item,
      standardTime: Number.parseFloat(value) || 0,
    }))
    return true
  }
  if (field === 'tech-time-unit') {
    const techId = node.dataset.techId
    if (!techId) return true
    updateTechnique(techId, (item) => ({ ...item, timeUnit: value }))
    return true
  }
  if (field === 'tech-difficulty') {
    const techId = node.dataset.techId
    if (!techId) return true
    updateTechnique(techId, (item) => ({
      ...item,
      difficulty: value as TechniqueItem['difficulty'],
    }))
    return true
  }
  if (field === 'tech-remark') {
    const techId = node.dataset.techId
    if (!techId) return true
    updateTechnique(techId, (item) => ({ ...item, remark: value }))
    return true
  }

  if (field === 'material-price') {
    const rowId = node.dataset.rowId
    if (!rowId) return true
    state.materialCostRows = state.materialCostRows.map((row) =>
      row.id === rowId ? { ...row, price: value } : row,
    )
    syncTechPackToStore({ touch: false })
    return true
  }
  if (field === 'material-currency') {
    const rowId = node.dataset.rowId
    if (!rowId) return true
    state.materialCostRows = state.materialCostRows.map((row) =>
      row.id === rowId ? { ...row, currency: value } : row,
    )
    syncTechPackToStore({ touch: false })
    return true
  }
  if (field === 'material-unit') {
    const rowId = node.dataset.rowId
    if (!rowId) return true
    state.materialCostRows = state.materialCostRows.map((row) =>
      row.id === rowId ? { ...row, unit: value } : row,
    )
    syncTechPackToStore({ touch: false })
    return true
  }

  if (field === 'process-price') {
    const rowId = node.dataset.rowId
    if (!rowId) return true
    state.processCostRows = state.processCostRows.map((row) =>
      row.id === rowId ? { ...row, price: value } : row,
    )
    syncTechPackToStore({ touch: false })
    return true
  }
  if (field === 'process-currency') {
    const rowId = node.dataset.rowId
    if (!rowId) return true
    state.processCostRows = state.processCostRows.map((row) =>
      row.id === rowId ? { ...row, currency: value } : row,
    )
    syncTechPackToStore({ touch: false })
    return true
  }
  if (field === 'process-unit') {
    const rowId = node.dataset.rowId
    if (!rowId) return true
    state.processCostRows = state.processCostRows.map((row) =>
      row.id === rowId ? { ...row, unit: value } : row,
    )
    syncTechPackToStore({ touch: false })
    return true
  }

  if (field === 'custom-cost-name') {
    const rowId = node.dataset.rowId
    if (!rowId) return true
    state.customCostRows = state.customCostRows.map((row) =>
      row.id === rowId ? { ...row, name: value } : row,
    )
    syncTechPackToStore({ touch: false })
    return true
  }
  if (field === 'custom-cost-price') {
    const rowId = node.dataset.rowId
    if (!rowId) return true
    state.customCostRows = state.customCostRows.map((row) =>
      row.id === rowId ? { ...row, price: value } : row,
    )
    syncTechPackToStore({ touch: false })
    return true
  }
  if (field === 'custom-cost-currency') {
    const rowId = node.dataset.rowId
    if (!rowId) return true
    state.customCostRows = state.customCostRows.map((row) =>
      row.id === rowId ? { ...row, currency: value } : row,
    )
    syncTechPackToStore({ touch: false })
    return true
  }
  if (field === 'custom-cost-unit') {
    const rowId = node.dataset.rowId
    if (!rowId) return true
    state.customCostRows = state.customCostRows.map((row) =>
      row.id === rowId ? { ...row, unit: value } : row,
    )
    syncTechPackToStore({ touch: false })
    return true
  }
  if (field === 'custom-cost-remark') {
    const rowId = node.dataset.rowId
    if (!rowId) return true
    state.customCostRows = state.customCostRows.map((row) =>
      row.id === rowId ? { ...row, remark: value } : row,
    )
    syncTechPackToStore({ touch: false })
    return true
  }

  if (field === 'mapping-remark') {
    const mappingId = node.dataset.mappingId
    if (!mappingId) return true
    updateColorMapping(mappingId, (mapping) => ({
      ...mapping,
      remark: value,
      ...(mapping.generatedMode === 'AUTO' ? { generatedMode: 'MANUAL', status: 'MANUAL_ADJUSTED' } : {}),
    }))
    syncTechPackToStore({ touch: false })
    return true
  }

  if (
    field === 'mapping-line-bom-item' ||
    field === 'mapping-line-material-name' ||
    field === 'mapping-line-material-code' ||
    field === 'mapping-line-pattern-id' ||
    field === 'mapping-line-piece-id' ||
    field === 'mapping-line-piece-count' ||
    field === 'mapping-line-unit' ||
    field === 'mapping-line-skus' ||
    field === 'mapping-line-source-mode' ||
    field === 'mapping-line-note'
  ) {
    const mappingId = node.dataset.mappingId
    const lineId = node.dataset.lineId
    if (!mappingId || !lineId) return true

    if (field === 'mapping-line-bom-item') {
      const selectedBom = state.bomItems.find((item) => item.id === value)
      updateColorMappingLine(mappingId, lineId, (line) => ({
        ...line,
        bomItemId: value,
        materialCode: selectedBom?.materialCode || line.materialCode,
        materialName: selectedBom?.materialName || line.materialName,
        materialType: selectedBom?.type || line.materialType,
        applicableSkuCodes:
          selectedBom && selectedBom.applicableSkuCodes.length > 0
            ? [...selectedBom.applicableSkuCodes]
            : line.applicableSkuCodes,
      }))
      syncTechPackToStore({ touch: false })
      return true
    }

    if (field === 'mapping-line-material-name') {
      updateColorMappingLine(mappingId, lineId, (line) => ({ ...line, materialName: value }))
      syncTechPackToStore({ touch: false })
      return true
    }

    if (field === 'mapping-line-material-code') {
      updateColorMappingLine(mappingId, lineId, (line) => ({ ...line, materialCode: value }))
      syncTechPackToStore({ touch: false })
      return true
    }

    if (field === 'mapping-line-pattern-id') {
      const selectedPattern = getPatternById(value)
      updateColorMappingLine(mappingId, lineId, (line) => ({
        ...line,
        patternId: value,
        patternName: selectedPattern?.name || '',
        pieceId: '',
        pieceName: '',
      }))
      syncTechPackToStore({ touch: false })
      return true
    }

    if (field === 'mapping-line-piece-id') {
      let patternId = ''
      const currentMapping = state.colorMaterialMappings.find((item) => item.id === mappingId)
      const currentLine = currentMapping?.lines.find((line) => line.id === lineId)
      if (currentLine) patternId = currentLine.patternId
      const piece = getPatternPieceById(patternId, value)
      updateColorMappingLine(mappingId, lineId, (line) => ({
        ...line,
        pieceId: value,
        pieceName: piece?.name || '',
        pieceCountPerUnit: piece?.count ?? line.pieceCountPerUnit,
        applicableSkuCodes:
          piece && piece.applicableSkuCodes.length > 0
            ? [...piece.applicableSkuCodes]
            : line.applicableSkuCodes,
      }))
      syncTechPackToStore({ touch: false })
      return true
    }

    if (field === 'mapping-line-piece-count') {
      updateColorMappingLine(mappingId, lineId, (line) => ({
        ...line,
        pieceCountPerUnit: Number.parseFloat(value) || 0,
      }))
      syncTechPackToStore({ touch: false })
      return true
    }

    if (field === 'mapping-line-unit') {
      updateColorMappingLine(mappingId, lineId, (line) => ({ ...line, unit: value }))
      syncTechPackToStore({ touch: false })
      return true
    }

    if (field === 'mapping-line-skus') {
      updateColorMappingLine(mappingId, lineId, (line) => ({
        ...line,
        applicableSkuCodes: dedupeStrings(
          value
            .split(',')
            .map((item) => item.trim())
            .filter((item) => item.length > 0),
        ),
      }))
      syncTechPackToStore({ touch: false })
      return true
    }

    if (field === 'mapping-line-source-mode') {
      updateColorMappingLine(mappingId, lineId, (line) => ({
        ...line,
        sourceMode: value === 'MANUAL' ? 'MANUAL' : 'AUTO',
      }))
      syncTechPackToStore({ touch: false })
      return true
    }

    if (field === 'mapping-line-note') {
      updateColorMappingLine(mappingId, lineId, (line) => ({ ...line, note: value }))
      syncTechPackToStore({ touch: false })
      return true
    }
  }

  if (field === 'new-size-part') {
    state.newSizeRow.part = value
    return true
  }
  if (field === 'new-size-s') {
    state.newSizeRow.S = value
    return true
  }
  if (field === 'new-size-m') {
    state.newSizeRow.M = value
    return true
  }
  if (field === 'new-size-l') {
    state.newSizeRow.L = value
    return true
  }
  if (field === 'new-size-xl') {
    state.newSizeRow.XL = value
    return true
  }
  if (field === 'new-size-tolerance') {
    state.newSizeRow.tolerance = value
    return true
  }

  if (field === 'new-quality-check-item') {
    state.newQualityRule.checkItem = value
    return true
  }
  if (field === 'new-quality-standard-text') {
    state.newQualityRule.standardText = value
    return true
  }
  if (field === 'new-quality-sampling-rule') {
    state.newQualityRule.samplingRule = value
    return true
  }
  if (field === 'new-quality-note') {
    state.newQualityRule.note = value
    return true
  }

  if (field === 'new-design-name') {
    state.newDesignName = value
    return true
  }
  if (field === 'new-design-side-type') {
    state.newDesignSideType = value === 'INSIDE' ? 'INSIDE' : 'FRONT'
    if (state.selectedDesignFile && !isImageDesignFile(state.selectedDesignFile)) {
      state.newDesignPreviewThumbnailDataUrl = buildDesignPlaceholderImage(
        state.selectedDesignFile.name,
        state.newDesignSideType,
      )
    }
    return true
  }
  if (field === 'new-design-file') {
    if (!(node instanceof HTMLInputElement)) return true
    const file = node.files?.[0] ?? null
    revokeDraftDesignPreview()
    void applySelectedDesignFile(file)
    return true
  }
  if (field === 'pattern-template-search-keyword') {
    state.patternTemplateSearchKeyword = value
    return true
  }

  if (field === 'new-attachment-file-name') {
    state.newAttachment.fileName = value
    return true
  }
  if (field === 'new-attachment-file-type') {
    state.newAttachment.fileType = value
    return true
  }
  if (field === 'new-attachment-file-size') {
    state.newAttachment.fileSize = value
    return true
  }

  return false
}

function performRelease(): void {
  if (!state.currentTechnicalVersionId) return
  // 发布只更新技术包版本本身，当前生效版本需回到款式档案页单独启用。
  const record = publishTechnicalDataVersion(state.currentTechnicalVersionId, currentUser.name)
  ensureTechPackPageState(record.technicalVersionId, {
    styleId: record.styleId,
    technicalVersionId: record.technicalVersionId,
    activeTab: state.activeTab,
  })
  state.releaseDialogOpen = false
}

export function handleTechPackEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-tech-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    return handleTechPackField(fieldNode)
  }

  const actionNode = target.closest<HTMLElement>('[data-tech-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.techAction
  if (!action) return false

  if (action === 'switch-tab') {
    const tab = actionNode.dataset.tab as TechPackTab | undefined
    if (!tab) return true
    state.activeTab = tab
    return true
  }

  if (action === 'tech-back') {
    const pathname = appStore.getState().pathname
    const normalizedPath = pathname.split('?')[0].split('#')[0]
    const styleMatch = normalizedPath.match(/^\/pcs\/products\/styles\/([^/]+)$/)
    const technicalVersionMatch = normalizedPath.match(/^\/pcs\/products\/styles\/([^/]+)\/technical-data\/([^/]+)$/)

    if (technicalVersionMatch) {
      const styleId = decodeURIComponent(technicalVersionMatch[1])
      appStore.navigate(`/pcs/products/styles/${encodeURIComponent(styleId)}`)
      return true
    }

    if (styleMatch) {
      const styleId = decodeURIComponent(styleMatch[1])
      appStore.navigate(`/pcs/products/styles/${encodeURIComponent(styleId)}`)
      return true
    }

    if (state.currentSpuCode) {
      appStore.closeTab(`tech-pack-${state.currentSpuCode}`)
      return true
    }

    appStore.navigate('/fcs/production/demand-inbox')
    return true
  }

  if (action === 'close-dialog') {
    if (state.releaseDialogOpen) {
      state.releaseDialogOpen = false
    } else if (state.designPreviewDialogOpen) {
      state.designPreviewDialogOpen = false
      state.designPreviewDesignId = null
      state.designPreviewSource = null
    } else if (state.addPatternDialogOpen) {
      state.addPatternDialogOpen = false
      closePatternTemplateDialog(false)
      resetPatternForm()
    } else if (state.addBomDialogOpen) {
      state.addBomDialogOpen = false
    } else if (state.addTechniqueDialogOpen) {
      state.addTechniqueDialogOpen = false
    } else if (state.addSizeDialogOpen) {
      state.addSizeDialogOpen = false
    } else if (state.addDesignDialogOpen) {
      state.addDesignDialogOpen = false
    } else if (state.addAttachmentDialogOpen) {
      state.addAttachmentDialogOpen = false
    } else if (state.patternDialogOpen) {
      state.patternDialogOpen = false
    } else if (state.patternTemplateDialogOpen) {
      closePatternTemplateDialog(true)
    } else {
      return false
    }
    return true
  }

  if (action === 'open-release') {
    state.releaseDialogOpen = true
    return true
  }
  if (action === 'close-release') {
    state.releaseDialogOpen = false
    return true
  }
  if (action === 'confirm-release') {
    performRelease()
    return true
  }

  if (action === 'open-add-pattern') {
    resetPatternForm()
    state.addPatternDialogOpen = true
    return true
  }
  if (action === 'close-add-pattern') {
    state.addPatternDialogOpen = false
    closePatternTemplateDialog(false)
    resetPatternForm()
    return true
  }
  if (action === 'edit-pattern') {
    const patternId = actionNode.dataset.patternId
    if (!patternId) return true

    const pattern = state.patternItems.find((item) => item.id === patternId)
    if (!pattern) return true

    state.editPatternItemId = pattern.id
    state.newPattern = buildPatternFormStateFromItem(pattern)
    state.addPatternDialogOpen = true
    return true
  }
  if (action === 'delete-pattern') {
    const patternId = actionNode.dataset.patternId
    if (!patternId) return true

    state.patternItems = state.patternItems.filter((item) => item.id !== patternId)
    syncTechPackToStore()
    return true
  }
  if (action === 'save-pattern') {
    const validationError = validatePatternForm()
    if (validationError) {
      state.newPattern.parseError = validationError
      return true
    }
    const nowId = state.editPatternItemId || `PAT-${Date.now()}`
    const normalizedPieceRows = normalizePatternPieceRows(
      state.newPattern.pieceRows.map((row) => ({ ...row })),
      nowId,
      state.newPattern.linkedBomItemId,
    )
    const totalPieceCount = normalizedPieceRows.reduce((sum, row) => sum + row.count, 0)
    const selectedSizeCodes = dedupeStrings([...state.newPattern.selectedSizeCodes])
    const sizeRange = selectedSizeCodes.join(' / ')
    const nextPattern = {
      name: state.newPattern.name.trim(),
      type: state.newPattern.type,
      image: state.newPattern.image,
      file:
        state.newPattern.patternMaterialType === 'WOVEN'
          ? buildPatternDisplayFile({
              patternFileMode: 'PAIRED_DXF_RUL',
              dxfFileName: state.newPattern.dxfFileName,
              rulFileName: state.newPattern.rulFileName,
            })
          : buildPatternDisplayFile({
              patternFileMode: 'SINGLE_FILE',
              singlePatternFileName: state.newPattern.singlePatternFileName,
            }),
      remark: state.newPattern.remark,
      linkedBomItemId: state.newPattern.linkedBomItemId,
      widthCm: state.newPattern.widthCm,
      markerLengthM: state.newPattern.markerLengthM,
      totalPieceCount,
      patternMaterialType: state.newPattern.patternMaterialType,
      patternMaterialTypeLabel: getPatternMaterialTypeLabel(state.newPattern.patternMaterialType),
      patternFileMode: state.newPattern.patternFileMode,
      parseStatus:
        state.newPattern.patternMaterialType === 'KNIT'
          ? 'NOT_REQUIRED'
          : state.newPattern.parseStatus,
      parseStatusLabel:
        state.newPattern.patternMaterialType === 'KNIT'
          ? getPatternParseStatusLabel('NOT_REQUIRED')
          : state.newPattern.parseStatusLabel,
      parseError: '',
      parsedAt: state.newPattern.patternMaterialType === 'WOVEN' ? state.newPattern.parsedAt : '',
      dxfFileName: state.newPattern.patternMaterialType === 'WOVEN' ? state.newPattern.dxfFileName : '',
      dxfFileSize: state.newPattern.patternMaterialType === 'WOVEN' ? state.newPattern.dxfFileSize : 0,
      dxfLastModified: state.newPattern.patternMaterialType === 'WOVEN' ? state.newPattern.dxfLastModified : '',
      rulFileName: state.newPattern.patternMaterialType === 'WOVEN' ? state.newPattern.rulFileName : '',
      rulFileSize: state.newPattern.patternMaterialType === 'WOVEN' ? state.newPattern.rulFileSize : 0,
      rulLastModified: state.newPattern.patternMaterialType === 'WOVEN' ? state.newPattern.rulLastModified : '',
      singlePatternFileName:
        state.newPattern.patternMaterialType === 'KNIT' ? state.newPattern.singlePatternFileName : '',
      singlePatternFileSize:
        state.newPattern.patternMaterialType === 'KNIT' ? state.newPattern.singlePatternFileSize : 0,
      singlePatternFileLastModified:
        state.newPattern.patternMaterialType === 'KNIT' ? state.newPattern.singlePatternFileLastModified : '',
      dxfEncoding: state.newPattern.patternMaterialType === 'WOVEN' ? state.newPattern.dxfEncoding : '',
      rulEncoding: state.newPattern.patternMaterialType === 'WOVEN' ? state.newPattern.rulEncoding : '',
      rulSizeList:
        state.newPattern.patternMaterialType === 'WOVEN' ? [...state.newPattern.rulSizeList] : [],
      rulSampleSize:
        state.newPattern.patternMaterialType === 'WOVEN' ? state.newPattern.rulSampleSize : '',
      patternSoftwareName: state.newPattern.patternSoftwareName,
      selectedSizeCodes,
      sizeRange,
      pieceRows:
        state.newPattern.patternMaterialType === 'WOVEN'
          ? normalizedPieceRows.map((row) => ({
              ...row,
              sourceType: 'PARSED_PATTERN' as const,
              applicableSkuCodes: dedupeStrings(
                row.colorAllocations.flatMap((allocation) => allocation.skuCodes ?? []),
              ),
            }))
          : normalizedPieceRows.map((row) => ({
              ...row,
              sourceType: 'MANUAL' as const,
              applicableSkuCodes: dedupeStrings(
                row.colorAllocations.flatMap((allocation) => allocation.skuCodes ?? []),
              ),
              missingName: false,
              missingCount: false,
            })),
    }

    if (state.editPatternItemId) {
      state.patternItems = state.patternItems.map((item) =>
        item.id === state.editPatternItemId
          ? {
              ...item,
              ...nextPattern,
            }
          : item,
      )
    } else {
      state.patternItems = [
        ...state.patternItems,
        {
          id: nowId,
          ...nextPattern,
        },
      ]
    }

    syncTechPackToStore()
    state.addPatternDialogOpen = false
    closePatternTemplateDialog(false)
    resetPatternForm()
    return true
  }
  if (action === 'open-pattern-dxf-picker') {
    document.getElementById('tech-pack-pattern-dxf-input')?.click()
    return false
  }
  if (action === 'open-pattern-rul-picker') {
    document.getElementById('tech-pack-pattern-rul-input')?.click()
    return false
  }
  if (action === 'open-pattern-single-file-picker') {
    document.getElementById('tech-pack-pattern-single-input')?.click()
    return false
  }
  if (action === 'clear-pattern-uploaded-files') {
    if (state.newPattern.patternMaterialType === 'WOVEN') {
      clearWovenFileState()
      clearParsedPatternRows()
      clearPatternParseState('NOT_PARSED')
      const dxfInput = document.getElementById('tech-pack-pattern-dxf-input')
      const rulInput = document.getElementById('tech-pack-pattern-rul-input')
      if (dxfInput instanceof HTMLInputElement) dxfInput.value = ''
      if (rulInput instanceof HTMLInputElement) rulInput.value = ''
    } else {
      clearKnitFileState()
      const singleInput = document.getElementById('tech-pack-pattern-single-input')
      if (singleInput instanceof HTMLInputElement) singleInput.value = ''
    }
    return true
  }
  if (action === 'parse-pattern') {
    void startPatternParsing()
    return true
  }
  if (action === 'toggle-pattern-size-code') {
    const sizeCode = actionNode.dataset.sizeCode
    if (!sizeCode) return true
    const current = new Set(state.newPattern.selectedSizeCodes)
    if (current.has(sizeCode)) {
      current.delete(sizeCode)
    } else {
      current.add(sizeCode)
    }
    state.newPattern.selectedSizeCodes = Array.from(current)
    state.newPattern.sizeRange = state.newPattern.selectedSizeCodes.join(' / ')
    return true
  }
  if (action === 'toggle-pattern-piece-color') {
    const pieceId = actionNode.dataset.pieceId
    const colorName = actionNode.dataset.colorName
    if (!pieceId || !colorName) return true
    const colorOption = getPatternBomColorOptions().find(
      (option) => option.colorName.trim().toLowerCase() === colorName.trim().toLowerCase(),
    )
    if (!colorOption) return true
    updatePatternPieceRow(pieceId, (row) => {
      const exists = row.colorAllocations.some(
        (allocation) => allocation.colorName.trim().toLowerCase() === colorName.trim().toLowerCase(),
      )
      return {
        ...row,
        colorAllocations: exists
          ? row.colorAllocations.filter(
              (allocation) => allocation.colorName.trim().toLowerCase() !== colorName.trim().toLowerCase(),
            )
          : [
              ...row.colorAllocations,
              {
                id: buildColorAllocationId(pieceId, colorName),
                colorName: colorOption.colorName,
                colorCode: colorOption.colorCode,
                skuCodes: [...colorOption.skuCodes],
                pieceCount: row.count,
              },
            ],
      }
    })
    syncPieceApplicableSkuCodes(pieceId)
    return true
  }
  if (action === 'toggle-pattern-piece-special-craft') {
    const pieceId = actionNode.dataset.pieceId
    const processCode = actionNode.dataset.processCode
    const craftCode = actionNode.dataset.craftCode
    if (!pieceId || !processCode || !craftCode) return true
    const specialCraft = getPatternPieceSpecialCraftOptionsFromCurrentTechPack().find(
      (item) => item.processCode === processCode && item.craftCode === craftCode,
    )
    if (!specialCraft) return true
    updatePatternPieceRow(pieceId, (row) => {
      const exists = row.specialCrafts.some(
        (item) => item.processCode === processCode && item.craftCode === craftCode,
      )
      return {
        ...row,
        specialCrafts: exists
          ? row.specialCrafts.filter(
              (item) => !(item.processCode === processCode && item.craftCode === craftCode),
            )
          : [...row.specialCrafts, { ...specialCraft }],
      }
    })
    return true
  }
  if (action === 'open-pattern-piece-template-dialog') {
    const pieceId = actionNode.dataset.pieceId
    if (!pieceId) return true
    updatePatternPieceRow(pieceId, (row) => ({ ...row, isTemplate: true }))
    openPatternTemplateDialogForPiece(pieceId)
    return true
  }
  if (action === 'close-pattern-template-dialog') {
    closePatternTemplateDialog(true)
    return true
  }
  if (action === 'select-pattern-template') {
    const pieceId = state.activePatternTemplatePieceId
    const templateId = actionNode.dataset.templateId
    if (!pieceId || !templateId) return true
    const templateRecord = getPartTemplateRecordById(templateId)
    if (!templateRecord) return true
    const conflictRow = getPatternPieceTemplateConflict(pieceId, templateRecord.id)
    if (conflictRow) {
      state.newPattern.parseError = '同一部位只能绑定一个模板，请与同部位裁片保持一致'
      return true
    }
    updatePatternPieceRow(pieceId, (row) => ({
      ...row,
      isTemplate: true,
      partTemplateId: templateRecord.id,
      partTemplateName: templateRecord.templateName,
      partTemplatePreviewSvg: templateRecord.previewSvg,
      partTemplateShapeDescription: templateRecord.shapeDescription?.autoDescription,
    }))
    closePatternTemplateDialog(false)
    return true
  }
  if (action === 'add-new-pattern-piece-row') {
    if (state.newPattern.patternMaterialType !== 'KNIT') return true
    state.newPattern.pieceRows = [
      ...state.newPattern.pieceRows,
      {
        id: `piece-${Date.now()}`,
        name: '',
        count: 1,
        note: '',
        isTemplate: false,
        applicableSkuCodes: [],
        colorAllocations: [],
        specialCrafts: [],
        sourceType: 'MANUAL',
      },
    ]
    return true
  }
  if (action === 'delete-new-pattern-piece-row') {
    if (state.newPattern.patternMaterialType !== 'KNIT') return true
    const pieceId = actionNode.dataset.pieceId
    if (!pieceId) return true
    state.newPattern.pieceRows = state.newPattern.pieceRows.filter((row) => row.id !== pieceId)
    return true
  }

  if (action === 'open-pattern-detail') {
    const patternId = actionNode.dataset.patternId
    const patternName = actionNode.dataset.patternName
    if (!patternId && !patternName) return true
    state.selectedPattern = patternId || patternName || null
    state.patternDialogOpen = true
    return true
  }
  if (action === 'close-pattern-detail') {
    state.patternDialogOpen = false
    state.selectedPattern = null
    return true
  }

  if (action === 'open-add-bom') {
    resetBomForm()
    state.addBomDialogOpen = true
    return true
  }
  if (action === 'edit-bom') {
    const bomId = actionNode.dataset.bomId
    if (!bomId) return true
    const bom = state.bomItems.find((item) => item.id === bomId)
    if (!bom) return true
    state.editBomItemId = bom.id
    state.newBomItem = {
      type: bom.type,
      colorLabel: bom.colorLabel,
      materialCode: bom.materialCode,
      materialName: bom.materialName,
      spec: bom.spec,
      patternPieces: [...bom.patternPieces],
      linkedPatternIds: [...bom.linkedPatternIds],
      applicableSkuCodes: [...bom.applicableSkuCodes],
      usageProcessCodes: [...bom.usageProcessCodes],
      usage: String(bom.usage),
      lossRate: String(bom.lossRate),
      printRequirement: bom.printRequirement,
      dyeRequirement: bom.dyeRequirement,
      printSideMode: bom.printSideMode,
      frontPatternDesignId: bom.frontPatternDesignId,
      insidePatternDesignId: bom.insidePatternDesignId,
    }
    state.addBomDialogOpen = true
    return true
  }
  if (action === 'close-add-bom') {
    state.addBomDialogOpen = false
    return true
  }
  if (action === 'save-bom') {
    if (!state.newBomItem.materialName.trim()) return true
    if (state.newBomItem.printRequirement !== '无' && !state.newBomItem.printSideMode) {
      window.alert('请选择单面印或双面印')
      return true
    }
    if (state.newBomItem.printRequirement !== '无' && state.newBomItem.printSideMode === 'SINGLE' && !state.newBomItem.frontPatternDesignId.trim()) {
      window.alert('请选择正面花型')
      return true
    }
    if (
      state.newBomItem.printRequirement !== '无'
      && state.newBomItem.printSideMode === 'DOUBLE'
      && (!state.newBomItem.frontPatternDesignId.trim() || !state.newBomItem.insidePatternDesignId.trim())
    ) {
      window.alert('双面印必须同时选择正面花型和里面花型')
      return true
    }
    const editingBom = state.editBomItemId
      ? state.bomItems.find((item) => item.id === state.editBomItemId) ?? null
      : null
    const linkedPatternIds = editingBom ? [...editingBom.linkedPatternIds] : []
    const patternPieces = editingBom ? [...editingBom.patternPieces] : []
    const nextBom: BomItemRow = {
      id: state.editBomItemId || `bom-${Date.now()}`,
      type: state.newBomItem.type,
      colorLabel: (() => {
        const skuOptions = getSkuOptionsForCurrentSpu()
        const skuByCode = new Map(skuOptions.map((item) => [item.skuCode, item]))
        if (state.newBomItem.applicableSkuCodes.length === 0) return '全部SKU（当前未区分颜色）'
        if (state.newBomItem.colorLabel.trim()) return state.newBomItem.colorLabel.trim()
        const colors = dedupeStrings(
          state.newBomItem.applicableSkuCodes
            .map((skuCode) => skuByCode.get(skuCode)?.color || '')
            .filter((color) => color.trim().length > 0),
        )
        if (colors.length === 1) return colors[0]
        if (colors.length > 1) return '多颜色'
        return '未识别颜色'
      })(),
      materialCode: state.newBomItem.materialCode,
      materialName: state.newBomItem.materialName,
      spec: state.newBomItem.spec,
      patternPieces,
      linkedPatternIds,
      applicableSkuCodes: [...state.newBomItem.applicableSkuCodes],
      usageProcessCodes:
        state.newBomItem.usageProcessCodes.length > 0
          ? dedupeStrings([...state.newBomItem.usageProcessCodes])
          : [],
      usage: Number.parseFloat(state.newBomItem.usage) || 0,
      lossRate: Number.parseFloat(state.newBomItem.lossRate) || 0,
      printRequirement: state.newBomItem.printRequirement,
      dyeRequirement: state.newBomItem.dyeRequirement,
      printSideMode:
        state.newBomItem.printRequirement === '无'
          ? ''
          : state.newBomItem.printSideMode,
      frontPatternDesignId:
        state.newBomItem.printRequirement === '无'
          ? ''
          : state.newBomItem.frontPatternDesignId,
      insidePatternDesignId:
        state.newBomItem.printRequirement === '无' || state.newBomItem.printSideMode !== 'DOUBLE'
          ? ''
          : state.newBomItem.insidePatternDesignId,
    }

    if (state.editBomItemId) {
      state.bomItems = state.bomItems.map((item) => (item.id === state.editBomItemId ? nextBom : item))
    } else {
      state.bomItems = [...state.bomItems, nextBom]
    }

    syncMaterialCostRows()
    syncTechPackToStore()
    state.addBomDialogOpen = false
    return true
  }
  if (action === 'delete-bom') {
    const bomId = actionNode.dataset.bomId
    if (!bomId) return true

    state.bomItems = state.bomItems.filter((item) => item.id !== bomId)
    syncMaterialCostRows()
    syncTechPackToStore()
    return true
  }

  if (action === 'add-custom-cost') {
    state.customCostRows = [
      ...state.customCostRows,
      {
        id: `custom-cost-${Date.now()}`,
        name: '',
        price: '',
        currency: '人民币',
        unit: '人民币/项',
        remark: '',
      },
    ]
    syncTechPackToStore({ touch: false })
    return true
  }

  if (action === 'delete-custom-cost') {
    const rowId = actionNode.dataset.rowId
    if (!rowId) return true
    state.customCostRows = state.customCostRows.filter((row) => row.id !== rowId)
    syncTechPackToStore({ touch: false })
    return true
  }

  if (action === 'confirm-color-mapping') {
    const mappingId = actionNode.dataset.mappingId
    if (!mappingId) return true
    state.colorMaterialMappings = state.colorMaterialMappings.map((item) =>
      item.id === mappingId
        ? {
            ...item,
            status:
              item.status === 'AUTO_DRAFT' || item.status === 'MANUAL_ADJUSTED'
                ? 'CONFIRMED'
                : item.status,
            confirmedBy: currentUser.name,
            confirmedAt: toTimestamp(),
          }
        : item,
    )
    syncTechPackToStore()
    return true
  }

  if (action === 'mark-color-mapping-manual') {
    const mappingId = actionNode.dataset.mappingId
    if (!mappingId) return true
    state.colorMaterialMappings = state.colorMaterialMappings.map((item) =>
      item.id === mappingId
        ? {
            ...item,
            status: 'MANUAL_ADJUSTED',
            generatedMode: 'MANUAL',
            confirmedBy: currentUser.name,
            confirmedAt: toTimestamp(),
            remark: item.remark || '已由技术员人工调整映射关系',
          }
        : item,
    )
    syncTechPackToStore()
    return true
  }

  if (action === 'copy-system-draft-manual') {
    const mappingId = actionNode.dataset.mappingId
    if (!mappingId) return true
    copySystemDraftToManual(mappingId)
    syncTechPackToStore()
    return true
  }

  if (action === 'reset-color-mapping-suggestion') {
    const mappingId = actionNode.dataset.mappingId
    if (!mappingId) return true
    resetColorMappingToSystemSuggestion(mappingId)
    syncTechPackToStore()
    return true
  }

  if (action === 'add-mapping-line') {
    const mappingId = actionNode.dataset.mappingId
    if (!mappingId) return true
    updateColorMapping(mappingId, (mapping) =>
      touchMappingAsManual({
        ...mapping,
        lines: [...mapping.lines, createEmptyMappingLine(mapping.id)],
      }),
    )
    syncTechPackToStore({ touch: false })
    return true
  }

  if (action === 'delete-mapping-line') {
    const mappingId = actionNode.dataset.mappingId
    const lineId = actionNode.dataset.lineId
    if (!mappingId || !lineId) return true
    updateColorMapping(mappingId, (mapping) =>
      touchMappingAsManual({
        ...mapping,
        lines: mapping.lines.filter((line) => line.id !== lineId),
      }),
    )
    syncTechPackToStore({ touch: false })
    return true
  }

  if (action === 'open-add-technique') {
    const stage = actionNode.dataset.stage || ''
    if (isPrepStage(stage)) return true
    resetTechniqueForm()
    state.newTechnique.stageCode = stageNameToCode.get(stage) ?? ''
    state.addTechniqueDialogOpen = true
    return true
  }
  if (action === 'edit-technique') {
    const techId = actionNode.dataset.techId
    if (!techId) return true
    const target = getTechniqueById(techId)
    if (!target) return true
    if (!canEditTechnique(target)) return true
    state.editTechniqueId = target.id
    state.newTechnique = {
      stageCode: target.stageCode,
      processCode: target.processCode,
      entryType: target.entryType,
      baselineProcessCode: target.entryType === 'PROCESS_BASELINE' ? target.processCode : '',
      craftCode: target.entryType === 'CRAFT' ? target.craftCode : '',
      ruleSource: target.ruleSource,
      assignmentGranularity: target.assignmentGranularity,
      detailSplitMode: target.detailSplitMode,
      detailSplitDimensions: [...target.detailSplitDimensions],
      standardTime: String(target.standardTime || ''),
      timeUnit: target.timeUnit,
      difficulty: target.difficulty,
      remark: target.remark,
    }
    state.addTechniqueDialogOpen = true
    return true
  }
  if (action === 'close-add-technique') {
    state.addTechniqueDialogOpen = false
    resetTechniqueForm()
    return true
  }
  if (action === 'save-technique') {
    const selectedMeta = getSelectedDraftMeta()
    if (!selectedMeta) return true
    const editingTarget = state.editTechniqueId ? getTechniqueById(state.editTechniqueId) : null
    if (editingTarget && !canEditTechnique(editingTarget)) return true

    if (!editingTarget && selectedMeta.stageCode === 'PREP') {
      return true
    }

    const immutablePrepMeta =
      editingTarget && isBomDrivenPrepTechnique(editingTarget)
        ? {
            entryType: editingTarget.entryType,
            stageCode: editingTarget.stageCode,
            stageName: editingTarget.stage,
            processCode: editingTarget.processCode,
            processName: editingTarget.process,
            craftCode: editingTarget.craftCode,
            craftName: editingTarget.technique,
            assignmentGranularity: editingTarget.assignmentGranularity,
            ruleSource: editingTarget.ruleSource,
            detailSplitMode: editingTarget.detailSplitMode,
            detailSplitDimensions: [...editingTarget.detailSplitDimensions],
            defaultDocType: editingTarget.defaultDocType,
            taskTypeMode: editingTarget.taskTypeMode,
            isSpecialCraft: editingTarget.isSpecialCraft,
            triggerSource: editingTarget.triggerSource,
          }
        : null
    const effectiveMeta = immutablePrepMeta ?? selectedMeta

    const nextItem: TechniqueItem = {
      ...getTechniqueReferenceMetaByCraftCode(effectiveMeta.craftCode),
      id: state.editTechniqueId || `tech-${Date.now()}`,
      entryType: effectiveMeta.entryType,
      stageCode: effectiveMeta.stageCode,
      stage: effectiveMeta.stageName,
      processCode: effectiveMeta.processCode,
      process: effectiveMeta.processName,
      craftCode: effectiveMeta.craftCode,
      technique: effectiveMeta.craftName,
      assignmentGranularity: effectiveMeta.assignmentGranularity,
      ruleSource: effectiveMeta.ruleSource,
      detailSplitMode: effectiveMeta.detailSplitMode,
      detailSplitDimensions: [...effectiveMeta.detailSplitDimensions],
      defaultDocType: effectiveMeta.defaultDocType,
      taskTypeMode: effectiveMeta.taskTypeMode,
      isSpecialCraft: effectiveMeta.isSpecialCraft,
      triggerSource: effectiveMeta.triggerSource,
      standardTime: Number.parseFloat(state.newTechnique.standardTime) || 0,
      timeUnit: state.newTechnique.timeUnit,
      difficulty: state.newTechnique.difficulty,
      remark: state.newTechnique.remark,
      source: '字典引用',
    }

    if (state.editTechniqueId) {
      state.techniques = state.techniques.map((item) =>
        item.id === state.editTechniqueId ? nextItem : item,
      )
    } else {
      state.techniques = [...state.techniques, nextItem]
    }

    syncProcessCostRows()
    syncTechPackToStore()
    state.addTechniqueDialogOpen = false
    resetTechniqueForm()
    return true
  }
  if (action === 'delete-technique') {
    const techId = actionNode.dataset.techId
    if (!techId) return true
    const target = getTechniqueById(techId)
    if (target && isBomDrivenPrepTechnique(target)) return true

    state.techniques = state.techniques.filter((item) => item.id !== techId)
    syncProcessCostRows()
    syncTechPackToStore()
    return true
  }

  if (action === 'open-add-size') {
    resetSizeForm()
    state.addSizeDialogOpen = true
    return true
  }
  if (action === 'close-add-size') {
    state.addSizeDialogOpen = false
    return true
  }
  if (action === 'save-size') {
    if (!state.techPack || !state.newSizeRow.part.trim()) return true

    const row: TechPackSizeRow = {
      id: `size-${Date.now()}`,
      part: state.newSizeRow.part,
      S: Number.parseFloat(state.newSizeRow.S) || 0,
      M: Number.parseFloat(state.newSizeRow.M) || 0,
      L: Number.parseFloat(state.newSizeRow.L) || 0,
      XL: Number.parseFloat(state.newSizeRow.XL) || 0,
      tolerance: Number.parseFloat(state.newSizeRow.tolerance) || 0,
    }

    state.techPack = {
      ...state.techPack,
      sizeTable: [...state.techPack.sizeTable, row],
    }

    syncTechPackToStore()
    state.addSizeDialogOpen = false
    return true
  }
  if (action === 'delete-size') {
    const sizeId = actionNode.dataset.sizeId
    if (!sizeId || !state.techPack) return true

    state.techPack = {
      ...state.techPack,
      sizeTable: state.techPack.sizeTable.filter((row) => row.id !== sizeId),
    }

    syncTechPackToStore()
    return true
  }

  if (action === 'open-add-quality') {
    resetQualityRuleForm()
    state.addQualityDialogOpen = true
    return true
  }
  if (action === 'close-add-quality') {
    state.addQualityDialogOpen = false
    return true
  }
  if (action === 'save-quality') {
    if (!state.newQualityRule.checkItem.trim() || !state.newQualityRule.standardText.trim()) return true
    state.qualityRules = [
      ...state.qualityRules,
      {
        id: `quality-${Date.now()}`,
        checkItem: state.newQualityRule.checkItem.trim(),
        standardText: state.newQualityRule.standardText.trim(),
        samplingRule: state.newQualityRule.samplingRule.trim(),
        note: state.newQualityRule.note.trim(),
      },
    ]
    syncTechPackToStore()
    state.addQualityDialogOpen = false
    resetQualityRuleForm()
    return true
  }
  if (action === 'delete-quality') {
    const qualityId = actionNode.dataset.qualityId
    if (!qualityId) return true
    state.qualityRules = state.qualityRules.filter((item) => item.id !== qualityId)
    syncTechPackToStore()
    return true
  }

  if (action === 'open-add-design') {
    resetDesignDraft()
    state.addDesignDialogOpen = true
    return true
  }
  if (action === 'close-add-design') {
    state.addDesignDialogOpen = false
    resetDesignDraft()
    const fileInput = document.getElementById('tech-pack-design-file-input')
    if (fileInput instanceof HTMLInputElement) fileInput.value = ''
    return true
  }
  if (action === 'open-design-file-picker') {
    document.getElementById('tech-pack-design-file-input')?.click()
    return false
  }
  if (action === 'preview-design-thumbnail') {
    const designId = actionNode.dataset.designId
    const design = state.techPack?.patternDesigns.find((item) => item.id === designId)
    const previewUrl = String(design?.previewThumbnailDataUrl || design?.imageUrl || '').trim()
    if (!previewUrl) return true
    window.open(previewUrl, '_blank', 'noopener,noreferrer')
    return true
  }
  if (action === 'open-design-thumbnail-preview') {
    const designId = String(actionNode.dataset.designId || '').trim()
    const designSource = actionNode.dataset.designSource === 'inside' ? 'inside' : 'front'
    if (!designId || !state.techPack) return true

    const design = state.techPack.patternDesigns.find((item) => item.id === designId)
    if (!design) return true

    state.designPreviewDialogOpen = true
    state.designPreviewDesignId = designId
    state.designPreviewSource = designSource
    return true
  }
  if (action === 'close-design-thumbnail-preview') {
    state.designPreviewDialogOpen = false
    state.designPreviewDesignId = null
    state.designPreviewSource = null
    return true
  }
  if (action === 'download-design-original-file') {
    const designId = actionNode.dataset.designId
    const design = state.techPack?.patternDesigns.find((item) => item.id === designId)
    const originalFileDataUrl = String(design?.originalFileDataUrl || '').trim()
    const originalFileName = String(design?.originalFileName || design?.fileName || '').trim()
    if (!originalFileDataUrl || !originalFileName) {
      window.alert('设计稿原文件缺失，无法下载')
      return true
    }
    triggerDataUrlDownload(originalFileDataUrl, originalFileName)
    return true
  }
  if (action === 'save-design') {
    if (!state.techPack || !state.newDesignName.trim() || !state.newDesignFileName.trim()) return true
    if (!state.newDesignOriginalFileDataUrl.trim()) {
      window.alert('设计稿文件处理中，请稍后再保存')
      return true
    }

    const previewThumbnailDataUrl =
      state.newDesignPreviewThumbnailDataUrl
      || buildDesignPlaceholderImage(state.newDesignFileName, state.newDesignSideType)

    state.techPack = {
      ...state.techPack,
      patternDesigns: [
        ...state.techPack.patternDesigns,
        {
          id: `design-${Date.now()}`,
          name: state.newDesignName.trim(),
          imageUrl: previewThumbnailDataUrl,
          designSideType: state.newDesignSideType,
          fileName: state.newDesignFileName,
          originalFileName: state.newDesignFileName,
          originalFileMimeType: state.newDesignOriginalFileMimeType || undefined,
          originalFileDataUrl: state.newDesignOriginalFileDataUrl,
          previewThumbnailDataUrl,
          uploadedAt: toTimestamp(),
        },
      ],
    }

    syncTechPackToStore()
    state.addDesignDialogOpen = false
    resetDesignDraft()
    const fileInput = document.getElementById('tech-pack-design-file-input')
    if (fileInput instanceof HTMLInputElement) fileInput.value = ''
    return true
  }
  if (action === 'delete-design') {
    const designId = actionNode.dataset.designId
    if (!state.techPack || !designId) return true
    const referencedByBom = state.bomItems.find(
      (item) => item.frontPatternDesignId === designId || item.insidePatternDesignId === designId,
    )
    if (referencedByBom) {
      window.alert('该花型已被物料清单引用，请先解除引用后再删除')
      return true
    }

    state.techPack = {
      ...state.techPack,
      patternDesigns: state.techPack.patternDesigns.filter((item) => item.id !== designId),
    }

    syncTechPackToStore()
    return true
  }

  if (action === 'open-add-attachment') {
    resetAttachmentForm()
    state.addAttachmentDialogOpen = true
    return true
  }
  if (action === 'close-add-attachment') {
    state.addAttachmentDialogOpen = false
    return true
  }
  if (action === 'save-attachment') {
    if (!state.techPack || !state.newAttachment.fileName.trim()) return true

    state.techPack = {
      ...state.techPack,
      attachments: [
        ...state.techPack.attachments,
        {
          id: `att-${Date.now()}`,
          fileName: state.newAttachment.fileName,
          fileType: state.newAttachment.fileType,
          fileSize: state.newAttachment.fileSize,
          uploadedAt: toTimestamp(),
          uploadedBy: currentUser.name,
          downloadUrl: '#',
        },
      ],
    }

    syncTechPackToStore()
    state.addAttachmentDialogOpen = false
    return true
  }
  if (action === 'delete-attachment') {
    const attachmentId = actionNode.dataset.attachmentId
    if (!state.techPack || !attachmentId) return true

    state.techPack = {
      ...state.techPack,
      attachments: state.techPack.attachments.filter((item) => item.id !== attachmentId),
    }

    syncTechPackToStore()
    return true
  }
  if (action === 'download-attachment') {
    return true
  }

  if (action === 'close-dialog') {
    closeAllDialogs()
    return true
  }

  if (action === 'noop') {
    return true
  }

  return false
}

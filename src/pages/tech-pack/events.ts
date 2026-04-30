import { appStore } from '../../state/store.ts'
import {
  parseFcsPatternFilePair,
  resolveFcsPatternFilePair,
} from '../../data/fcs/fcs-pattern-file-parser.ts'
import {
  publishTechPackDraft,
  validateTechPackForPublish,
  type TechPackSpecialCraftTargetObject,
} from '../../data/fcs/tech-packs.ts'
import { normalizeBomRequirement } from './bom-process-linkage.ts'
import { buildPatternSignature, checkDuplicatePattern } from './pattern-duplicate-check.ts'
import { renderPieceInstanceSpecialCraftDialog } from './pattern-domain.ts'
import {
  TECH_PACK_PATTERN_CATEGORY_OPTIONS,
  buildPatternDisplayFile,
  buildPatternFormStateFromItem,
  calculatePatternPieceTotalQty,
  calculatePatternTotalPieceQty,
  closeAllDialogs,
  canEditTechnique,
  copySystemDraftToManual,
  createEmptyMappingLine,
  createPatternBindingStrip,
  createPatternManagedFile,
  currentUser,
  dedupeStrings,
  buildPatternPiecePartKey,
  getBaselineProcessByCode,
  getCraftOptionByCode,
  getBomColorOptionsForPattern,
  getPatternColorQuantityOptions,
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
  normalizePatternBindingStrips,
  generatePieceInstancesFromColorQuantities,
  summarizePieceInstances,
  findConfiguredPieceInstancesRemoved,
  getPatternPieceInstanceSpecialCraftOptions,
  PATTERN_CRAFT_POSITION_OPTIONS,
  hasEnabledColorPiece,
  hasInvalidColorPieceQty,
  hasPositiveEnabledColorPiece,
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
  state.newPattern.pieceInstances = []
  state.newPattern.pieceInstanceTotal = 0
  state.newPattern.specialCraftConfiguredPieceTotal = 0
  state.newPattern.specialCraftUnconfiguredPieceTotal = 0
  state.newPattern.totalPieceCount = 0
  state.newPattern.patternTotalPieceQty = 0
}

function clearWovenFileState(): void {
  state.newPattern.selectedDxfFile = null
  state.newPattern.selectedRulFile = null
  state.newPattern.dxfFile = null
  state.newPattern.rulFile = null
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

function syncColorAllocationsFromColorPieceQuantities(
  row: (typeof state.newPattern.pieceRows)[number],
): (typeof state.newPattern.pieceRows)[number] {
  const colorOptions = getPatternColorQuantityOptions(state.newPattern.linkedBomItemId)
  const colorAllocations = row.colorPieceQuantities
    .filter((quantity) => quantity.enabled)
    .map((quantity, index) => {
      const matched = colorOptions.find(
        (option) =>
          String(option.colorCode || option.colorName).trim().toLowerCase()
            === String(quantity.colorId || quantity.colorName).trim().toLowerCase()
          || option.colorName.trim().toLowerCase() === quantity.colorName.trim().toLowerCase(),
      )
      return {
        id: `${row.id}-color-${index + 1}`,
        colorName: matched?.colorName || quantity.colorName,
        colorCode: matched?.colorCode || quantity.colorId,
        skuCodes: [...(matched?.skuCodes ?? [])],
        pieceCount: Number.isFinite(Number(quantity.pieceQty)) ? Math.max(0, Math.trunc(Number(quantity.pieceQty))) : 0,
      }
    })
  const totalPieceQty = calculatePatternPieceTotalQty(row.colorPieceQuantities)
  return {
    ...row,
    count: totalPieceQty,
    totalPieceQty,
    colorAllocations,
    applicableSkuCodes: dedupeStrings(colorAllocations.flatMap((allocation) => allocation.skuCodes ?? [])),
  }
}

function refreshPatternPieceTotals(): void {
  state.newPattern.pieceRows = state.newPattern.pieceRows.map(syncColorAllocationsFromColorPieceQuantities)
  state.newPattern.totalPieceCount = calculatePatternTotalPieceQty(state.newPattern.pieceRows)
  state.newPattern.patternTotalPieceQty = state.newPattern.totalPieceCount
  const patternId = state.editPatternItemId || state.newPattern.name || 'NEW-PATTERN'
  const pieceInstances = generatePieceInstancesFromColorQuantities({
    id: patternId,
    pieceRows: state.newPattern.pieceRows,
    pieceInstances: state.newPattern.pieceInstances,
  })
  const pieceInstanceSummary = summarizePieceInstances(pieceInstances)
  state.newPattern.pieceInstances = pieceInstances
  state.newPattern.pieceInstanceTotal = pieceInstanceSummary.pieceInstanceTotal
  state.newPattern.specialCraftConfiguredPieceTotal = pieceInstanceSummary.specialCraftConfiguredPieceTotal
  state.newPattern.specialCraftUnconfiguredPieceTotal = pieceInstanceSummary.specialCraftUnconfiguredPieceTotal
}

function clonePatternPieceRows(rows: typeof state.newPattern.pieceRows): typeof state.newPattern.pieceRows {
  return rows.map((row) => ({
    ...row,
    applicableSkuCodes: [...row.applicableSkuCodes],
    colorAllocations: row.colorAllocations.map((allocation) => ({
      ...allocation,
      skuCodes: [...(allocation.skuCodes ?? [])],
    })),
    colorPieceQuantities: row.colorPieceQuantities.map((quantity) => ({ ...quantity })),
    specialCrafts: row.specialCrafts.map((craft) => ({
      ...craft,
      supportedTargetObjects: [...(craft.supportedTargetObjects ?? [])],
      supportedTargetObjectLabels: [...(craft.supportedTargetObjectLabels ?? [])],
    })),
    candidatePartNames: [...(row.candidatePartNames ?? [])],
    rawTextLabels: [...(row.rawTextLabels ?? [])],
  }))
}

function clonePieceInstances(instances: typeof state.newPattern.pieceInstances): typeof state.newPattern.pieceInstances {
  return instances.map((instance) => ({
    ...instance,
    specialCraftAssignments: instance.specialCraftAssignments.map((assignment) => ({ ...assignment })),
  }))
}

function applyPatternPieceRowsWithInstanceProtection(updater: () => void): void {
  const previousRows = clonePatternPieceRows(state.newPattern.pieceRows)
  const previousInstances = clonePieceInstances(state.newPattern.pieceInstances)
  updater()
  refreshPatternPieceTotals()
  const removedConfigured = findConfiguredPieceInstancesRemoved(previousInstances, state.newPattern.pieceInstances)
  if (removedConfigured.length === 0) return
  if (window.confirm('当前减少片数会删除已配置特殊工艺的裁片实例，是否继续？')) return
  state.newPattern.pieceRows = previousRows
  state.newPattern.pieceInstances = previousInstances
  const previousSummary = summarizePieceInstances(previousInstances)
  state.newPattern.totalPieceCount = calculatePatternTotalPieceQty(previousRows)
  state.newPattern.patternTotalPieceQty = state.newPattern.totalPieceCount
  state.newPattern.pieceInstanceTotal = previousSummary.pieceInstanceTotal
  state.newPattern.specialCraftConfiguredPieceTotal = previousSummary.specialCraftConfiguredPieceTotal
  state.newPattern.specialCraftUnconfiguredPieceTotal = previousSummary.specialCraftUnconfiguredPieceTotal
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
    getPatternPieceSpecialCraftOptionsFromCurrentTechPack().map((item) => `${item.processCode}:${item.craftCode}:${item.selectedTargetObject}`),
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

function hasFileExtension(fileName: string, extensions: string[]): boolean {
  const normalized = fileName.trim().toLowerCase()
  return extensions.some((extension) => normalized.endsWith(extension.toLowerCase()))
}

function applyPatternFileError(message: string, input: HTMLInputElement): void {
  state.newPattern.parseError = message
  input.value = ''
}

function openPatternFileInput(inputId: string): void {
  const input = document.getElementById(inputId)
  if (!(input instanceof HTMLInputElement)) return
  input.onchange = () => {
    handleTechPackField(input)
    requestTechPackRender()
    input.onchange = null
  }
  input.click()
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
      colorAllocations: [...row.colorAllocations],
      colorPieceQuantities: [...row.colorPieceQuantities],
      totalPieceQty: row.totalPieceQty,
      parsedQuantity: row.parsedQuantity,
      specialCrafts: [],
      isTemplate: false,
      partTemplateId: undefined,
      partTemplateName: undefined,
      partTemplatePreviewSvg: undefined,
      partTemplateShapeDescription: undefined,
      note: row.note || row.annotation || '',
    }))
    state.newPattern.totalPieceCount = calculatePatternTotalPieceQty(normalizedRows)
    state.newPattern.patternTotalPieceQty = state.newPattern.totalPieceCount
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

  const invalidColorQtyRow = state.newPattern.pieceRows.find((row) => hasInvalidColorPieceQty(row))
  if (invalidColorQtyRow) return '颜色片数必须为非负整数'

  const noEnabledColorRow = state.newPattern.pieceRows.find((row) => !hasEnabledColorPiece(row))
  if (noEnabledColorRow) return '请至少选择一个适用颜色'

  const noPositiveColorRow = state.newPattern.pieceRows.find((row) => !hasPositiveEnabledColorPiece(row))
  if (noPositiveColorRow) return '当前总片数为 0，请维护颜色片数'

  const invalidColorRow = state.newPattern.pieceRows.find((row) =>
    row.colorPieceQuantities.some(
      (quantity) => quantity.enabled && !bomColorNameSet.has(quantity.colorName.trim().toLowerCase()),
    ),
  )
  if (invalidColorRow) return '适用颜色必须来自当前技术包颜色'

  const invalidSpecialCraftRow = state.newPattern.pieceRows.find((row) =>
    row.specialCrafts.some(
      (craft) => !validSpecialCraftKeys.has(`${craft.processCode}:${craft.craftCode}:${craft.selectedTargetObject}`),
    ),
  )
  if (invalidSpecialCraftRow) return '特殊工艺必须来自当前技术包且作用对象为已裁部位'

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
        || Number(row.totalPieceQty) <= 0
        || row.missingName,
    )
    if (invalidRow?.missingName) return '布料纸样存在名称缺失，不能保存'
    if (invalidRow) return '布料纸样解析结果不完整，不能保存'
    return null
  }

  if (!state.newPattern.singlePatternFileName.trim() && !state.newPattern.file.trim()) {
    return '针织纸样需先选择纸样文件'
  }
  if (state.newPattern.pieceRows.length === 0) return '针织纸样至少保留 1 行裁片明细'
  const invalidRow = state.newPattern.pieceRows.find(
    (row) => row.sourceType !== 'MANUAL' || !row.name.trim() || Number(row.totalPieceQty) <= 0,
  )
  if (invalidRow) return '针织纸样裁片名称和颜色片数必须填写完整'
  return null
}

function validatePatternMerchandiserStep(): string | null {
  if (!state.newPattern.name.trim()) return '请填写纸样名称'
  if (!String(state.newPattern.type || '').trim()) return '请选择纸样类型'
  if (state.newPattern.patternMaterialType === 'UNKNOWN') return '请选择纸样类型'
  if (!Number.isFinite(Number(state.newPattern.widthCm)) || Number(state.newPattern.widthCm) <= 0) {
    return '门幅必须大于 0'
  }
  if (!state.newPattern.linkedBomItemId.trim()) return '请选择关联物料'
  return null
}

function validatePatternMakerStep(): string | null {
  const firstStepError = validatePatternMerchandiserStep()
  if (firstStepError) return firstStepError
  if (!Number.isFinite(Number(state.newPattern.markerLengthM)) || Number(state.newPattern.markerLengthM) <= 0) {
    return '排料长度必须大于 0'
  }
  if (!state.newPattern.prjFile?.fileName) return '请上传纸样 PRJ 文件'
  if (!state.newPattern.markerImage?.fileName) return '请上传唛架图片'
  if (!state.newPattern.dxfFileName.trim()) return '请上传 DXF 文件'
  if (!state.newPattern.rulFileName.trim()) return '请上传 RUL 文件'
  if (!hasFileExtension(state.newPattern.prjFile.fileName, ['.prj'])) {
    return '文件格式不正确，请上传 PRJ 文件'
  }
  if (!hasFileExtension(state.newPattern.markerImage.fileName, ['.png', '.jpg', '.jpeg', '.webp'])) {
    return '文件格式不正确，请上传唛架图片'
  }
  if (!hasFileExtension(state.newPattern.dxfFileName, ['.dxf'])) return '文件格式不正确，请上传 DXF 文件'
  if (!hasFileExtension(state.newPattern.rulFileName, ['.rul'])) return '文件格式不正确，请上传 RUL 文件'
  const invalidNameStrip = state.newPattern.bindingStrips.find((item) => !String(item.bindingStripName || '').trim())
  if (invalidNameStrip) return '请填写捆条名称'
  const invalidLengthStrip = state.newPattern.bindingStrips.find((item) => !Number.isFinite(Number(item.lengthCm)) || Number(item.lengthCm) <= 0)
  if (invalidLengthStrip) return '捆条长度必须大于 0'
  const invalidWidthStrip = state.newPattern.bindingStrips.find((item) => !Number.isFinite(Number(item.widthCm)) || Number(item.widthCm) <= 0)
  if (invalidWidthStrip) return '捆条宽度必须大于 0'
  return null
}

function updatePatternMaintainerStatuses(nextStatus: typeof state.newPattern.maintainerStepStatus): void {
  state.newPattern.maintainerStepStatus = nextStatus
  state.newPattern.merchandiserInfoStatus = '已填写'
  if (nextStatus === '待版师维护') {
    state.newPattern.patternMakerInfoStatus = '未填写'
  } else if (nextStatus === '待解析') {
    state.newPattern.patternMakerInfoStatus = '待解析'
  } else if (nextStatus === '已解析待确认' || nextStatus === '已完成') {
    state.newPattern.patternMakerInfoStatus = '已解析'
  }
}

function buildPatternItemFromForm(nowId: string, finalStatus: typeof state.newPattern.maintainerStepStatus) {
  const normalizedPieceRows = normalizePatternPieceRows(
    state.newPattern.pieceRows.map((row) => ({ ...row })),
    nowId,
    state.newPattern.linkedBomItemId,
  )
  const totalPieceCount = calculatePatternTotalPieceQty(normalizedPieceRows)
  const selectedSizeCodes = dedupeStrings(
    state.newPattern.selectedSizeCodes.length > 0
      ? [...state.newPattern.selectedSizeCodes]
      : getSizeCodeOptionsFromSizeRules().map((item) => item.sizeCode),
  )
  const sizeRange = selectedSizeCodes.join(' / ')
  const linkedBom = state.bomItems.find((item) => item.id === state.newPattern.linkedBomItemId) || null
  const bindingStrips = normalizePatternBindingStrips(state.newPattern.bindingStrips)
  const pieceInstances = generatePieceInstancesFromColorQuantities({
    id: nowId,
    pieceRows: normalizedPieceRows,
    pieceInstances: state.newPattern.pieceInstances,
  })
  const pieceInstanceSummary = summarizePieceInstances(pieceInstances)

  return {
    name: state.newPattern.name.trim(),
    type: state.newPattern.type,
    image: state.newPattern.markerImage?.previewUrl || state.newPattern.image,
    file: buildPatternDisplayFile({
      patternFileMode: 'PAIRED_DXF_RUL',
      dxfFileName: state.newPattern.dxfFileName,
      rulFileName: state.newPattern.rulFileName,
    }),
    remark: state.newPattern.remark,
    linkedBomItemId: state.newPattern.linkedBomItemId,
    linkedMaterialId: state.newPattern.linkedBomItemId,
    linkedMaterialName: linkedBom?.materialName || state.newPattern.linkedMaterialName,
    linkedMaterialSku: linkedBom?.materialCode || state.newPattern.linkedMaterialSku,
    widthCm: state.newPattern.widthCm,
    markerLengthM: state.newPattern.markerLengthM,
    totalPieceCount,
    patternTotalPieceQty: totalPieceCount,
    isKnitted: state.newPattern.patternMaterialType === 'KNIT' ? '是' as const : '否' as const,
    maintainerStepStatus: finalStatus,
    merchandiserInfoStatus: '已填写' as const,
    patternMakerInfoStatus:
      finalStatus === '已解析待确认' || finalStatus === '已完成'
        ? '已解析' as const
        : finalStatus === '待解析'
          ? '待解析' as const
          : '未填写' as const,
    prjFile: state.newPattern.prjFile ? { ...state.newPattern.prjFile } : null,
    markerImage: state.newPattern.markerImage ? { ...state.newPattern.markerImage } : null,
    dxfFile: state.newPattern.dxfFile ? { ...state.newPattern.dxfFile } : createPatternManagedFile({
      fileName: state.newPattern.dxfFileName,
      fileSize: state.newPattern.dxfFileSize,
      uploadedAt: state.newPattern.dxfLastModified,
      uploadedBy: currentUser.name,
    }),
    rulFile: state.newPattern.rulFile ? { ...state.newPattern.rulFile } : createPatternManagedFile({
      fileName: state.newPattern.rulFileName,
      fileSize: state.newPattern.rulFileSize,
      uploadedAt: state.newPattern.rulLastModified,
      uploadedBy: currentUser.name,
    }),
    bindingStrips,
    pieceInstances,
    ...pieceInstanceSummary,
    patternSignature: buildPatternSignature({
      ...state.newPattern,
      id: nowId,
      name: state.newPattern.name.trim(),
      linkedMaterialId: state.newPattern.linkedBomItemId,
      pieceRows: normalizedPieceRows,
    }),
    duplicateConfirmed: Boolean(state.newPattern.duplicateConfirmed),
    duplicateWarningReasons: [...state.newPattern.duplicateWarningReasons],
    patternMaterialType: state.newPattern.patternMaterialType === 'UNKNOWN' ? 'WOVEN' as const : state.newPattern.patternMaterialType,
    patternMaterialTypeLabel: getPatternMaterialTypeLabel(
      state.newPattern.patternMaterialType === 'UNKNOWN' ? 'WOVEN' : state.newPattern.patternMaterialType,
    ),
    patternFileMode: 'PAIRED_DXF_RUL' as const,
    parseStatus:
      finalStatus === '已解析待确认' || finalStatus === '已完成'
        ? 'PARSED' as const
        : state.newPattern.parseStatus === 'FAILED'
          ? 'FAILED' as const
          : 'NOT_PARSED' as const,
    parseStatusLabel:
      finalStatus === '已解析待确认' || finalStatus === '已完成'
        ? getPatternParseStatusLabel('PARSED')
        : getPatternParseStatusLabel(state.newPattern.parseStatus === 'FAILED' ? 'FAILED' : 'NOT_PARSED'),
    parseError: finalStatus === '待解析' ? '' : state.newPattern.parseError,
    parsedAt:
      finalStatus === '已解析待确认' || finalStatus === '已完成'
        ? state.newPattern.parsedAt || toTimestamp()
        : '',
    dxfFileName: state.newPattern.dxfFileName,
    dxfFileSize: state.newPattern.dxfFileSize,
    dxfLastModified: state.newPattern.dxfLastModified,
    rulFileName: state.newPattern.rulFileName,
    rulFileSize: state.newPattern.rulFileSize,
    rulLastModified: state.newPattern.rulLastModified,
    singlePatternFileName: '',
    singlePatternFileSize: 0,
    singlePatternFileLastModified: '',
    dxfEncoding: state.newPattern.dxfEncoding,
    rulEncoding: state.newPattern.rulEncoding,
    rulSizeList: [...state.newPattern.rulSizeList],
    rulSampleSize: state.newPattern.rulSampleSize,
    patternSoftwareName: state.newPattern.patternSoftwareName,
    selectedSizeCodes,
    sizeRange,
    pieceRows: normalizedPieceRows.map((row) => ({
      ...row,
      sourceType: row.sourceType || 'MANUAL' as const,
      applicableSkuCodes: dedupeStrings(row.colorAllocations.flatMap((allocation) => allocation.skuCodes ?? [])),
      missingName: false,
      missingCount: false,
    })),
  }
}

function resetPieceInstanceCraftDraft(): void {
  state.pieceInstanceCraftDraft = {
    craftCode: '',
    craftPosition: '',
    remark: '',
  }
  state.pieceInstanceCraftError = ''
}

function updatePieceInstances(nextInstances: typeof state.newPattern.pieceInstances): void {
  const summary = summarizePieceInstances(nextInstances)
  state.newPattern.pieceInstances = nextInstances
  state.newPattern.pieceInstanceTotal = summary.pieceInstanceTotal
  state.newPattern.specialCraftConfiguredPieceTotal = summary.specialCraftConfiguredPieceTotal
  state.newPattern.specialCraftUnconfiguredPieceTotal = summary.specialCraftUnconfiguredPieceTotal
}

function refreshPieceInstanceSpecialCraftDom(): void {
  if (typeof document === 'undefined') return
  const existingDialog = document.querySelector('[data-testid="piece-instance-special-craft-dialog"]')
  const dialogHtml = renderPieceInstanceSpecialCraftDialog()
  if (dialogHtml) {
    if (existingDialog) {
      existingDialog.outerHTML = dialogHtml
    } else {
      const host = document.querySelector('[data-testid="pattern-two-step-dialog"]')?.parentElement
      host?.insertAdjacentHTML('beforeend', dialogHtml)
    }
  } else {
    existingDialog?.remove()
  }

  document.querySelectorAll<HTMLElement>('[data-testid="piece-instance-craft-summary"][data-piece-id]').forEach((summaryNode) => {
    const sourcePieceId = summaryNode.dataset.pieceId || ''
    const instances = state.newPattern.pieceInstances.filter((instance) => instance.sourcePieceId === sourcePieceId)
    const configured = instances.filter((instance) => instance.specialCraftAssignments.length > 0).length
    summaryNode.textContent = `已配置 ${configured} / 共 ${instances.length} 片`
  })

  const configuredTotal = document.querySelector<HTMLElement>('[data-testid="pattern-special-craft-configured-total"]')
  if (configuredTotal) {
    configuredTotal.textContent = `已配置特殊工艺裁片：${state.newPattern.specialCraftConfiguredPieceTotal} 片`
  }
  const unconfiguredTotal = document.querySelector<HTMLElement>('[data-testid="pattern-special-craft-unconfigured-total"]')
  if (unconfiguredTotal) {
    unconfiguredTotal.textContent = `未配置特殊工艺裁片：${state.newPattern.specialCraftUnconfiguredPieceTotal} 片`
  }
}

function schedulePieceInstanceSpecialCraftDomRefresh(): void {
  refreshPieceInstanceSpecialCraftDom()
  if (typeof window === 'undefined') return
  window.setTimeout(() => {
    refreshPieceInstanceSpecialCraftDom()
  }, 0)
  window.setTimeout(() => {
    refreshPieceInstanceSpecialCraftDom()
  }, 50)
}

function getActivePieceInstance() {
  return state.newPattern.pieceInstances.find(
    (instance) => instance.pieceInstanceId === state.activePieceInstanceId,
  ) ?? null
}

function createPieceInstanceSpecialCraftAssignmentFromDraft() {
  const craftCode = state.pieceInstanceCraftDraft.craftCode
  const craftPosition = state.pieceInstanceCraftDraft.craftPosition
  if (!craftCode) {
    state.pieceInstanceCraftError = '请选择特殊工艺。'
    return null
  }
  if (!craftPosition) {
    state.pieceInstanceCraftError = '请选择工艺位置。'
    return null
  }
  const craft = getPatternPieceInstanceSpecialCraftOptions().find((item) => item.craftCode === craftCode)
  if (!craft) {
    state.pieceInstanceCraftError = '该工艺不适用于裁片部位。'
    return null
  }
  const position = PATTERN_CRAFT_POSITION_OPTIONS.find((item) => item.code === craftPosition)
  if (!position) {
    state.pieceInstanceCraftError = '请选择工艺位置。'
    return null
  }
  return {
    assignmentId: `PIA-${Date.now()}-${craft.craftCode}-${craftPosition}`,
    craftCode: craft.craftCode,
    craftName: craft.craftName,
    craftCategory: craft.craftCategory,
    craftCategoryName: craft.craftCategoryName,
    targetObject: craft.targetObject,
    targetObjectName: craft.targetObjectName,
    craftPosition,
    craftPositionName: position.name,
    remark: state.pieceInstanceCraftDraft.remark.trim() || undefined,
    createdBy: currentUser.name,
    updatedAt: toTimestamp(),
  }
}

function savePatternFromTwoStep(finalStatus: typeof state.newPattern.maintainerStepStatus): boolean {
  const nowId = state.editPatternItemId || `PAT-${Date.now()}`
  const nextPattern = buildPatternItemFromForm(nowId, finalStatus)
  const duplicateResult = checkDuplicatePattern(
    { id: nowId, ...nextPattern },
    state.patternItems,
  )
  if (duplicateResult.hasBlockingDuplicate) {
    state.newPattern.parseError = duplicateResult.blockingReasons.join('；')
    state.patternDuplicateWarning = null
    return false
  }
  if (duplicateResult.hasWarningDuplicate && !state.newPattern.duplicateConfirmed) {
    state.newPattern.parseError = ''
    state.patternDuplicateWarning = {
      finalStatus,
      warningReasons: duplicateResult.warningReasons,
      duplicatePatternNames: duplicateResult.duplicatePatternNames,
    }
    return false
  }
  if (state.editPatternItemId) {
    state.patternItems = state.patternItems.map((item) =>
      item.id === state.editPatternItemId ? { ...item, ...nextPattern } : item,
    )
  } else {
    state.patternItems = [...state.patternItems, { id: nowId, ...nextPattern }]
  }
  state.patternDuplicateWarning = null
  syncTechPackToStore()
  return true
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
    state.newPattern.duplicateConfirmed = false
    state.newPattern.duplicateWarningReasons = []
    return true
  }
  if (field === 'new-pattern-material-type') {
    applyPatternMaterialTypeChange(
      value === 'WOVEN' || value === 'KNIT' ? value : 'UNKNOWN',
    )
    state.newPattern.isKnitted = value === 'KNIT' ? '是' : '否'
    return true
  }
  if (field === 'new-pattern-is-knitted') {
    const nextType: TechPackPatternMaterialType = value === '是' ? 'KNIT' : 'WOVEN'
    applyPatternMaterialTypeChange(nextType)
    state.newPattern.isKnitted = value === '是' ? '是' : '否'
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
  if (field === 'new-pattern-prj-file' && node instanceof HTMLInputElement) {
    const file = node.files?.[0] ?? null
    if (file && !hasFileExtension(file.name, ['.prj'])) {
      applyPatternFileError('文件格式不正确，请上传 PRJ 文件', node)
      state.newPattern.selectedPrjFile = null
      state.newPattern.prjFile = null
      return true
    }
    state.newPattern.selectedPrjFile = file
    state.newPattern.prjFile = file
      ? createPatternManagedFile({
          fileName: file.name,
          fileSize: file.size,
          uploadedAt: toFileLastModifiedText(file),
          uploadedBy: currentUser.name,
        })
      : null
    state.newPattern.parseError = ''
    state.newPattern.duplicateConfirmed = false
    state.newPattern.duplicateWarningReasons = []
    return true
  }
  if (field === 'new-pattern-marker-image-file' && node instanceof HTMLInputElement) {
    const file = node.files?.[0] ?? null
    if (file && !hasFileExtension(file.name, ['.png', '.jpg', '.jpeg', '.webp'])) {
      applyPatternFileError('文件格式不正确，请上传唛架图片', node)
      state.newPattern.selectedMarkerImageFile = null
      state.newPattern.markerImage = null
      return true
    }
    state.newPattern.selectedMarkerImageFile = file
    state.newPattern.markerImage = file
      ? createPatternManagedFile({
          fileName: file.name,
          fileSize: file.size,
          uploadedAt: toFileLastModifiedText(file),
          uploadedBy: currentUser.name,
          previewUrl: file.name,
        })
      : null
    state.newPattern.image = state.newPattern.markerImage?.previewUrl || ''
    state.newPattern.parseError = ''
    state.newPattern.duplicateConfirmed = false
    state.newPattern.duplicateWarningReasons = []
    return true
  }
  if (field === 'new-pattern-dxf-file' && node instanceof HTMLInputElement) {
    const file = node.files?.[0] ?? null
    if (file && !hasFileExtension(file.name, ['.dxf'])) {
      applyPatternFileError('文件格式不正确，请上传 DXF 文件', node)
      state.newPattern.selectedDxfFile = null
      state.newPattern.dxfFile = null
      state.newPattern.dxfFileName = ''
      return true
    }
    state.newPattern.selectedDxfFile = file
    state.newPattern.dxfFileName = file?.name || ''
    state.newPattern.dxfFileSize = file?.size || 0
    state.newPattern.dxfLastModified = file ? toFileLastModifiedText(file) : ''
    state.newPattern.dxfFile = file
      ? createPatternManagedFile({
          fileName: file.name,
          fileSize: file.size,
          uploadedAt: state.newPattern.dxfLastModified,
          uploadedBy: currentUser.name,
        })
      : null
    clearParsedPatternRows()
    clearPatternParseState('NOT_PARSED')
    state.newPattern.file = buildPatternDisplayFile({
      patternFileMode: 'PAIRED_DXF_RUL',
      dxfFileName: state.newPattern.dxfFileName,
      rulFileName: state.newPattern.rulFileName,
    })
    state.newPattern.duplicateConfirmed = false
    state.newPattern.duplicateWarningReasons = []
    return true
  }
  if (field === 'new-pattern-rul-file' && node instanceof HTMLInputElement) {
    const file = node.files?.[0] ?? null
    if (file && !hasFileExtension(file.name, ['.rul'])) {
      applyPatternFileError('文件格式不正确，请上传 RUL 文件', node)
      state.newPattern.selectedRulFile = null
      state.newPattern.rulFile = null
      state.newPattern.rulFileName = ''
      return true
    }
    state.newPattern.selectedRulFile = file
    state.newPattern.rulFileName = file?.name || ''
    state.newPattern.rulFileSize = file?.size || 0
    state.newPattern.rulLastModified = file ? toFileLastModifiedText(file) : ''
    state.newPattern.rulFile = file
      ? createPatternManagedFile({
          fileName: file.name,
          fileSize: file.size,
          uploadedAt: state.newPattern.rulLastModified,
          uploadedBy: currentUser.name,
        })
      : null
    clearParsedPatternRows()
    clearPatternParseState('NOT_PARSED')
    state.newPattern.file = buildPatternDisplayFile({
      patternFileMode: 'PAIRED_DXF_RUL',
      dxfFileName: state.newPattern.dxfFileName,
      rulFileName: state.newPattern.rulFileName,
    })
    state.newPattern.duplicateConfirmed = false
    state.newPattern.duplicateWarningReasons = []
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
    const linkedBom = state.bomItems.find((item) => item.id === value) || null
    state.newPattern.linkedMaterialId = value
    state.newPattern.linkedMaterialName = linkedBom?.materialName || ''
    state.newPattern.linkedMaterialSku = linkedBom?.materialCode || ''
    state.newPattern.duplicateConfirmed = false
    state.newPattern.duplicateWarningReasons = []
    const nextColorOptions = getPatternColorQuantityOptions(value)
    applyPatternPieceRowsWithInstanceProtection(() => {
      state.newPattern.pieceRows = state.newPattern.pieceRows.map((row) => ({
        ...row,
        colorAllocations: row.colorAllocations.filter((allocation) =>
          getBomColorOptionsForPattern(value).some(
            (option) => option.colorName.trim().toLowerCase() === allocation.colorName.trim().toLowerCase(),
          ),
        ),
        colorPieceQuantities: row.colorPieceQuantities.filter((quantity) =>
          nextColorOptions.some(
            (option) =>
              String(option.colorCode || option.colorName).trim().toLowerCase()
                === String(quantity.colorId || quantity.colorName).trim().toLowerCase()
              || option.colorName.trim().toLowerCase() === quantity.colorName.trim().toLowerCase(),
          ),
        ),
      }))
      state.newPattern.pieceRows = normalizePatternPieceRows(
        state.newPattern.pieceRows,
        state.editPatternItemId || 'DRAFT',
        state.newPattern.linkedBomItemId,
      )
    })
    return true
  }
  if (field === 'new-pattern-binding-strip-name') {
    const bindingStripId = node.dataset.bindingStripId
    state.newPattern.bindingStrips = normalizePatternBindingStrips(state.newPattern.bindingStrips.map((item) =>
      item.bindingStripId === bindingStripId ? { ...item, bindingStripName: value } : item,
    ))
    return true
  }
  if (field === 'new-pattern-binding-strip-length-cm') {
    const bindingStripId = node.dataset.bindingStripId
    state.newPattern.bindingStrips = normalizePatternBindingStrips(state.newPattern.bindingStrips.map((item) =>
      item.bindingStripId === bindingStripId ? { ...item, lengthCm: Number(value) } : item,
    ))
    return true
  }
  if (field === 'new-pattern-binding-strip-width-cm') {
    const bindingStripId = node.dataset.bindingStripId
    state.newPattern.bindingStrips = normalizePatternBindingStrips(state.newPattern.bindingStrips.map((item) =>
      item.bindingStripId === bindingStripId ? { ...item, widthCm: Number(value) } : item,
    ))
    return true
  }
  if (field === 'new-pattern-binding-strip-remark') {
    const bindingStripId = node.dataset.bindingStripId
    state.newPattern.bindingStrips = normalizePatternBindingStrips(state.newPattern.bindingStrips.map((item) =>
      item.bindingStripId === bindingStripId ? { ...item, remark: value } : item,
    ))
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
    state.newPattern.patternTotalPieceQty = state.newPattern.totalPieceCount
    return true
  }
  if (field === 'new-pattern-piece-name') {
    if (state.newPattern.patternMaterialType === 'WOVEN') return true
    const pieceId = node.dataset.pieceId
    if (!pieceId) return true
    updatePatternPieceRow(pieceId, (row) => ({ ...row, name: value }))
    refreshPatternPieceTotals()
    return true
  }
  if (field === 'new-pattern-piece-count') {
    if (state.newPattern.patternMaterialType === 'WOVEN') return true
    const pieceId = node.dataset.pieceId
    if (!pieceId) return true
    const nextCount = Number.parseInt(value, 10) || 0
    applyPatternPieceRowsWithInstanceProtection(() => {
      updatePatternPieceRow(pieceId, (row) => ({
        ...row,
        count: nextCount,
        colorPieceQuantities: row.colorPieceQuantities.map((quantity, index) =>
          index === 0 || quantity.pieceQty > 0 ? { ...quantity, enabled: true, pieceQty: nextCount } : quantity,
        ),
      }))
    })
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
    const colorId = node.dataset.colorId
    const colorName = node.dataset.colorName
    if (!pieceId || (!colorId && !colorName)) return true
    const pieceQty = value.trim() === '' ? 0 : Number(value)
    applyPatternPieceRowsWithInstanceProtection(() => {
      updatePatternPieceRow(pieceId, (row) => ({
        ...row,
        colorPieceQuantities: row.colorPieceQuantities.map((quantity) =>
          quantity.colorId === colorId || quantity.colorName === colorName
            ? { ...quantity, pieceQty }
            : quantity,
        ),
      }))
    })
    return true
  }
  if (field === 'new-pattern-piece-color-enabled') {
    const pieceId = node.dataset.pieceId
    const colorId = node.dataset.colorId
    const colorName = node.dataset.colorName
    if (!pieceId || (!colorId && !colorName)) return true
    applyPatternPieceRowsWithInstanceProtection(() => {
      updatePatternPieceRow(pieceId, (row) => ({
        ...row,
        colorPieceQuantities: row.colorPieceQuantities.map((quantity) => {
          if (quantity.colorId !== colorId && quantity.colorName !== colorName) return quantity
          return {
            ...quantity,
            enabled: checked,
            pieceQty: checked ? quantity.pieceQty : 0,
          }
        }),
      }))
    })
    return true
  }
  if (field === 'piece-instance-craft-code') {
    state.pieceInstanceCraftDraft = {
      ...state.pieceInstanceCraftDraft,
      craftCode: value,
    }
    state.pieceInstanceCraftError = ''
    schedulePieceInstanceSpecialCraftDomRefresh()
    return true
  }
  if (field === 'piece-instance-craft-position') {
    const position = PATTERN_CRAFT_POSITION_OPTIONS.some((item) => item.code === value)
      ? value as typeof state.pieceInstanceCraftDraft.craftPosition
      : ''
    state.pieceInstanceCraftDraft = {
      ...state.pieceInstanceCraftDraft,
      craftPosition: position,
    }
    state.pieceInstanceCraftError = ''
    schedulePieceInstanceSpecialCraftDomRefresh()
    return true
  }
  if (field === 'piece-instance-craft-remark') {
    state.pieceInstanceCraftDraft = {
      ...state.pieceInstanceCraftDraft,
      remark: value,
    }
    schedulePieceInstanceSpecialCraftDomRefresh()
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
  if (field === 'new-bom-shrink-requirement') {
    state.newBomItem.shrinkRequirement = normalizeBomRequirement(value)
    return true
  }
  if (field === 'new-bom-wash-requirement') {
    state.newBomItem.washRequirement = normalizeBomRequirement(value)
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
      selectedTargetObject: '',
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
      selectedTargetObject: '',
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
    const selectedTargetObject =
      craft?.isSpecialCraft && craft.supportedTargetObjectLabels?.length === 1
        ? craft.supportedTargetObjectLabels[0]
        : ''
    state.newTechnique = {
      ...state.newTechnique,
      craftCode: value,
      selectedTargetObject,
      standardTime: craft ? String(craft.referencePublishedSamValue) : state.newTechnique.standardTime,
      timeUnit: craft ? craft.referencePublishedSamUnitLabel : state.newTechnique.timeUnit,
    }
    return true
  }
  if (field === 'new-technique-target-object') {
    state.newTechnique.selectedTargetObject = value as TechPackSpecialCraftTargetObject
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
  if (field === 'bom-shrink') {
    const bomId = node.dataset.bomId
    if (!bomId) return true
    state.bomItems = state.bomItems.map((item) =>
      item.id === bomId ? { ...item, shrinkRequirement: normalizeBomRequirement(value) } : item,
    )
    syncTechPackToStore()
    return true
  }
  if (field === 'bom-wash') {
    const bomId = node.dataset.bomId
    if (!bomId) return true
    state.bomItems = state.bomItems.map((item) =>
      item.id === bomId ? { ...item, washRequirement: normalizeBomRequirement(value) } : item,
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
  if (!state.techPack) return
  syncTechPackToStore()
  const validation = validateTechPackForPublish(state.techPack)
  if (validation.length > 0) {
    state.compatibilityMessage = validation[0] || '请检查技术包'
    state.releaseDialogOpen = false
    return
  }
  const result = publishTechPackDraft(state.techPack.spuCode)
  if (!result.ok) {
    state.compatibilityMessage = result.message || '请检查技术包'
    state.techPack = result.techPack
    state.releaseDialogOpen = false
    return
  }
  state.techPack = result.techPack
  state.compatibilityMessage = ''
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
    } else if (state.pieceInstanceCraftDialogOpen) {
      state.pieceInstanceCraftDialogOpen = false
      state.activePieceInstanceSourcePieceId = null
      state.activePieceInstanceId = null
      resetPieceInstanceCraftDraft()
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
    state.patternMaintenanceStep = 'MERCHANDISER'
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
    state.patternMaintenanceStep = 'MERCHANDISER'
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
  if (action === 'switch-pattern-maintenance-step') {
    const nextStep = actionNode.dataset.patternStep
    if (nextStep === 'MERCHANDISER' || nextStep === 'PATTERN_MAKER') {
      if (nextStep === 'PATTERN_MAKER') {
        const validationError = validatePatternMerchandiserStep()
        if (validationError) {
          state.newPattern.parseError = validationError
          return true
        }
        state.newPattern.parseError = ''
        updatePatternMaintainerStatuses('待版师维护')
      }
      state.patternMaintenanceStep = nextStep
    }
    return true
  }
  if (action === 'save-pattern-merchandiser-step') {
    const validationError = validatePatternMerchandiserStep()
    if (validationError) {
      state.newPattern.parseError = validationError
      return true
    }
    state.newPattern.parseError = ''
    updatePatternMaintainerStatuses('待版师维护')
    if (!savePatternFromTwoStep('待版师维护')) return true
    state.addPatternDialogOpen = false
    closePatternTemplateDialog(false)
    resetPatternForm()
    return true
  }
  if (action === 'save-pattern-and-go-maker') {
    const validationError = validatePatternMerchandiserStep()
    if (validationError) {
      state.newPattern.parseError = validationError
      return true
    }
    state.newPattern.parseError = ''
    updatePatternMaintainerStatuses('待版师维护')
    state.patternMaintenanceStep = 'PATTERN_MAKER'
    return true
  }
  if (action === 'add-pattern-binding-strip') {
    state.newPattern.bindingStrips = normalizePatternBindingStrips([
      ...state.newPattern.bindingStrips,
      createPatternBindingStrip({}, state.newPattern.bindingStrips.length),
    ])
    state.newPattern.parseError = ''
    return true
  }
  if (action === 'delete-pattern-binding-strip') {
    const bindingStripId = actionNode.dataset.bindingStripId
    if (!bindingStripId) return true
    if (!window.confirm('确认删除该捆条？')) return true
    state.newPattern.bindingStrips = normalizePatternBindingStrips(
      state.newPattern.bindingStrips.filter((item) => item.bindingStripId !== bindingStripId),
    )
    return true
  }
  if (action === 'cancel-pattern-duplicate-warning') {
    state.patternDuplicateWarning = null
    state.newPattern.parseError = ''
    return true
  }
  if (action === 'confirm-pattern-duplicate-warning') {
    const warning = state.patternDuplicateWarning
    if (!warning) return true
    state.newPattern.duplicateConfirmed = true
    state.newPattern.duplicateWarningReasons = [...warning.warningReasons]
    state.patternDuplicateWarning = null
    if (!savePatternFromTwoStep(warning.finalStatus)) return true
    state.addPatternDialogOpen = false
    closePatternTemplateDialog(false)
    resetPatternForm()
    return true
  }
  if (action === 'save-pattern-maker-step' || action === 'save-pattern-and-parse') {
    const validationError = validatePatternMakerStep()
    if (validationError) {
      state.newPattern.parseError = validationError
      return true
    }
    state.newPattern.parseError = ''
    const finalStatus =
      action === 'save-pattern-and-parse' || state.newPattern.parseStatus === 'PARSED'
        ? '已解析待确认'
        : '待解析'
    updatePatternMaintainerStatuses(finalStatus)
    if (!savePatternFromTwoStep(finalStatus)) return true
    state.addPatternDialogOpen = false
    closePatternTemplateDialog(false)
    resetPatternForm()
    return true
  }
  if (action === 'save-pattern') {
    const validationError = validatePatternMakerStep()
    if (validationError) {
      state.newPattern.parseError = validationError
      return true
    }
    updatePatternMaintainerStatuses('待解析')
    if (!savePatternFromTwoStep('待解析')) return true
    state.addPatternDialogOpen = false
    closePatternTemplateDialog(false)
    resetPatternForm()
    return true
  }
  if (action === 'open-pattern-dxf-picker') {
    openPatternFileInput('tech-pack-pattern-dxf-input')
    return false
  }
  if (action === 'open-pattern-prj-picker') {
    openPatternFileInput('tech-pack-pattern-prj-input')
    return false
  }
  if (action === 'open-pattern-marker-image-picker') {
    openPatternFileInput('tech-pack-marker-image-input')
    return false
  }
  if (action === 'open-pattern-rul-picker') {
    openPatternFileInput('tech-pack-pattern-rul-input')
    return false
  }
  if (action === 'open-pattern-single-file-picker') {
    openPatternFileInput('tech-pack-pattern-single-input')
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
    const colorId = actionNode.dataset.colorId
    const colorName = actionNode.dataset.colorName
    if (!pieceId || !colorName) return true
    const colorOption = getPatternBomColorOptions().find(
      (option) =>
        option.colorName.trim().toLowerCase() === colorName.trim().toLowerCase()
        || String(option.colorCode || '').trim().toLowerCase() === String(colorId || '').trim().toLowerCase(),
    )
    if (!colorOption) return true
    applyPatternPieceRowsWithInstanceProtection(() => {
      updatePatternPieceRow(pieceId, (row) => {
        const exists = row.colorPieceQuantities.some(
          (quantity) =>
            (colorId && quantity.colorId.trim().toLowerCase() === colorId.trim().toLowerCase())
            || quantity.colorName.trim().toLowerCase() === colorName.trim().toLowerCase(),
        )
        return {
          ...row,
          colorPieceQuantities: exists
            ? row.colorPieceQuantities.map((quantity) =>
                (colorId && quantity.colorId.trim().toLowerCase() === colorId.trim().toLowerCase())
                  || quantity.colorName.trim().toLowerCase() === colorName.trim().toLowerCase()
                  ? { ...quantity, enabled: !quantity.enabled, pieceQty: quantity.enabled ? 0 : quantity.pieceQty }
                  : quantity,
              )
            : [
                ...row.colorPieceQuantities,
                {
                  colorId: colorOption.colorCode || colorOption.colorName,
                  colorName: colorOption.colorName,
                  enabled: true,
                  pieceQty: row.totalPieceQty || row.count || 0,
                },
              ],
        }
      })
    })
    return true
  }
  if (action === 'toggle-pattern-piece-special-craft') {
    const pieceId = actionNode.dataset.pieceId
    const processCode = actionNode.dataset.processCode
    const craftCode = actionNode.dataset.craftCode
    const selectedTargetObject = actionNode.dataset.targetObject as TechPackSpecialCraftTargetObject | undefined
    if (!pieceId || !processCode || !craftCode || !selectedTargetObject) return true
    const specialCraft = getPatternPieceSpecialCraftOptionsFromCurrentTechPack().find(
      (item) =>
        item.processCode === processCode
        && item.craftCode === craftCode
        && item.selectedTargetObject === selectedTargetObject,
    )
    if (!specialCraft) return true
    updatePatternPieceRow(pieceId, (row) => {
      const exists = row.specialCrafts.some(
        (item) =>
          item.processCode === processCode
          && item.craftCode === craftCode
          && item.selectedTargetObject === selectedTargetObject,
      )
      const nextSpecialCrafts = exists
        ? row.specialCrafts.filter(
            (item) =>
              !(item.processCode === processCode
                && item.craftCode === craftCode
                && item.selectedTargetObject === selectedTargetObject),
          )
        : [...row.specialCrafts, { ...specialCraft }]
      const stillHasBundle = nextSpecialCrafts.some((item) => item.craftName === '捆条' || item.displayName === '捆条')
      return {
        ...row,
        specialCrafts: nextSpecialCrafts,
        bundleLengthCm: stillHasBundle ? row.bundleLengthCm : undefined,
        bundleWidthCm: stillHasBundle ? row.bundleWidthCm : undefined,
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
        count: 0,
        note: '',
        isTemplate: false,
        applicableSkuCodes: [],
        colorAllocations: [],
        colorPieceQuantities: getPatternColorQuantityOptions(state.newPattern.linkedBomItemId).map((option) => ({
          colorId: option.colorCode || option.colorName,
          colorName: option.colorName,
          enabled: false,
          pieceQty: 0,
          remark: '请维护颜色片数',
        })),
        totalPieceQty: 0,
        specialCrafts: [],
        sourceType: 'MANUAL',
      },
    ]
    refreshPatternPieceTotals()
    return true
  }
  if (action === 'delete-new-pattern-piece-row') {
    if (state.newPattern.patternMaterialType !== 'KNIT') return true
    const pieceId = actionNode.dataset.pieceId
    if (!pieceId) return true
    applyPatternPieceRowsWithInstanceProtection(() => {
      state.newPattern.pieceRows = state.newPattern.pieceRows.filter((row) => row.id !== pieceId)
    })
    return true
  }
  if (action === 'open-piece-instance-special-craft-dialog') {
    const pieceId = actionNode.dataset.pieceId
    if (!pieceId) return true
    refreshPatternPieceTotals()
    const instances = state.newPattern.pieceInstances.filter((instance) => instance.sourcePieceId === pieceId)
    state.activePieceInstanceSourcePieceId = pieceId
    state.activePieceInstanceId = instances[0]?.pieceInstanceId ?? null
    state.pieceInstanceCraftDialogOpen = true
    resetPieceInstanceCraftDraft()
    schedulePieceInstanceSpecialCraftDomRefresh()
    return true
  }
  if (action === 'close-piece-instance-special-craft-dialog') {
    state.pieceInstanceCraftDialogOpen = false
    state.activePieceInstanceSourcePieceId = null
    state.activePieceInstanceId = null
    resetPieceInstanceCraftDraft()
    schedulePieceInstanceSpecialCraftDomRefresh()
    return true
  }
  if (action === 'select-piece-instance') {
    const pieceInstanceId = actionNode.dataset.pieceInstanceId
    if (!pieceInstanceId) return true
    state.activePieceInstanceId = pieceInstanceId
    resetPieceInstanceCraftDraft()
    schedulePieceInstanceSpecialCraftDomRefresh()
    return true
  }
  if (action === 'add-piece-instance-special-craft') {
    const activeInstance = getActivePieceInstance()
    if (!activeInstance) return true
    const assignment = createPieceInstanceSpecialCraftAssignmentFromDraft()
    if (!assignment) {
      schedulePieceInstanceSpecialCraftDomRefresh()
      return true
    }
    if (activeInstance.specialCraftAssignments.some((item) => item.craftCode === assignment.craftCode)) {
      state.pieceInstanceCraftError = '该裁片已配置该特殊工艺，请勿重复添加。'
      schedulePieceInstanceSpecialCraftDomRefresh()
      return true
    }
    updatePieceInstances(state.newPattern.pieceInstances.map((instance) => {
      if (instance.pieceInstanceId !== activeInstance.pieceInstanceId) return instance
      const specialCraftAssignments = [...instance.specialCraftAssignments, assignment]
      return {
        ...instance,
        specialCraftAssignments,
        status: specialCraftAssignments.length > 0 ? '已配置' : '未配置',
      }
    }))
    resetPieceInstanceCraftDraft()
    schedulePieceInstanceSpecialCraftDomRefresh()
    return true
  }
  if (action === 'delete-piece-instance-special-craft') {
    const pieceInstanceId = actionNode.dataset.pieceInstanceId
    const assignmentId = actionNode.dataset.assignmentId
    if (!pieceInstanceId || !assignmentId) return true
    updatePieceInstances(state.newPattern.pieceInstances.map((instance) => {
      if (instance.pieceInstanceId !== pieceInstanceId) return instance
      const specialCraftAssignments = instance.specialCraftAssignments.filter(
        (assignment) => assignment.assignmentId !== assignmentId,
      )
      return {
        ...instance,
        specialCraftAssignments,
        status: specialCraftAssignments.length > 0 ? '已配置' : '未配置',
      }
    }))
    schedulePieceInstanceSpecialCraftDomRefresh()
    return true
  }
  if (action === 'apply-piece-instance-craft-to-same-color') {
    const activeInstance = getActivePieceInstance()
    if (!activeInstance || activeInstance.specialCraftAssignments.length === 0) return true
    if (!window.confirm('是否将当前片的特殊工艺应用到同颜色全部片？')) return true
    updatePieceInstances(state.newPattern.pieceInstances.map((instance) => {
      if (
        instance.sourcePieceId !== activeInstance.sourcePieceId
        || instance.colorId !== activeInstance.colorId
        || instance.pieceInstanceId === activeInstance.pieceInstanceId
      ) {
        return instance
      }
      const existingCraftCodes = new Set(instance.specialCraftAssignments.map((assignment) => assignment.craftCode))
      const copiedAssignments = activeInstance.specialCraftAssignments
        .filter((assignment) => !existingCraftCodes.has(assignment.craftCode))
        .map((assignment) => ({
          ...assignment,
          assignmentId: `PIA-${Date.now()}-${instance.pieceInstanceId}-${assignment.craftCode}`,
          updatedAt: toTimestamp(),
        }))
      const specialCraftAssignments = [...instance.specialCraftAssignments, ...copiedAssignments]
      return {
        ...instance,
        specialCraftAssignments,
        status: specialCraftAssignments.length > 0 ? '已配置' : '未配置',
      }
    }))
    schedulePieceInstanceSpecialCraftDomRefresh()
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
      shrinkRequirement: bom.shrinkRequirement,
      washRequirement: bom.washRequirement,
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
      shrinkRequirement: state.newBomItem.shrinkRequirement,
      washRequirement: state.newBomItem.washRequirement,
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
  if (action === 'keep-bom-prep-process') {
    const techId = actionNode.dataset.techId
    if (!techId) return true
    state.techniques = state.techniques.map((item) =>
      item.id === techId
        ? {
            ...item,
            sourceType: 'MANUAL',
            isAutoGenerated: false,
            canRemoveAutomatically: false,
            hasManualOverride: true,
            requiresRemovalConfirmation: false,
            linkageStatus: '已生成',
            triggerSource: `${item.process}由人工确认保留`,
          }
        : item,
    )
    syncProcessCostRows()
    syncTechPackToStore()
    return true
  }
  if (action === 'remove-bom-prep-process') {
    const techId = actionNode.dataset.techId
    if (!techId) return true
    state.techniques = state.techniques.filter((item) => item.id !== techId)
    syncProcessCostRows()
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
      selectedTargetObject: target.selectedTargetObject || '',
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
            selectedTargetObject: editingTarget.selectedTargetObject,
            supportedTargetObjects: editingTarget.supportedTargetObjects ? [...editingTarget.supportedTargetObjects] : undefined,
            supportedTargetObjectLabels: editingTarget.supportedTargetObjectLabels ? [...editingTarget.supportedTargetObjectLabels] : undefined,
            triggerSource: editingTarget.triggerSource,
          }
        : null
    const effectiveMeta = immutablePrepMeta ?? selectedMeta

    if (effectiveMeta.isSpecialCraft) {
      const duplicate = state.techniques.some((item) =>
        item.id !== state.editTechniqueId
        && item.entryType === 'CRAFT'
        && item.craftCode === effectiveMeta.craftCode
        && item.selectedTargetObject === effectiveMeta.selectedTargetObject,
      )
      if (duplicate) {
        window.alert('该特殊工艺和作用对象已存在')
        return true
      }
    }

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
      selectedTargetObject: effectiveMeta.selectedTargetObject,
      supportedTargetObjects: effectiveMeta.supportedTargetObjects ? [...effectiveMeta.supportedTargetObjects] : undefined,
      supportedTargetObjectLabels: effectiveMeta.supportedTargetObjectLabels ? [...effectiveMeta.supportedTargetObjectLabels] : undefined,
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

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
  publishTechnicalDataVersion,
  saveTechnicalDataVersionRecordMeta,
} from '../../data/pcs-project-technical-data-writeback.ts'
import {
  createProductionTechPackPublishEvaluationBatch,
} from '../../data/fcs/production-tech-pack-change-domain.ts'
import {
  approveTechPackReview,
  reopenTechPackReviewForRoles,
  rejectTechPackReview,
  returnTechPackReviewByModules,
  returnTechPackReviewToFirstStage,
  startTechPackReview,
  submitTechPackFirstStageReview,
} from '../../data/pcs-tech-pack-review.ts'
import {
  formatTechPackDesignRequirementBlockMessage,
  validateTechPackDesignRequirement,
} from '../../data/pcs-tech-pack-design-requirement.ts'
import { getFixedTechPackReviewers } from '../../data/pcs-tech-pack-reviewer-directory.ts'
import type {
  TechnicalGarmentDifficultyGrade,
  TechnicalModuleKey,
  TechnicalReviewNodeKey,
} from '../../data/pcs-technical-data-version-types.ts'
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
  escapeHtml,
  buildPatternPiecePartKey,
  getBaselineProcessByCode,
  getCraftOptionByCode,
  getBomColorOptionsForPattern,
  getPatternColorQuantityOptions,
  getPartTemplateRecordById,
  getPatternPieceSpecialCraftOptionsFromCurrentTechPack,
  getPatternDesignOptionsBySide,
  getBomPatternDesignIds,
  getPrimaryBomPatternDesignId,
  normalizePatternDesignIdList,
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
  normalizeTechniqueRoutes,
  generatePieceInstancesFromColorQuantities,
  summarizePieceInstances,
  findConfiguredPieceInstancesRemoved,
  getPatternPieceInstanceSpecialCraftOptions,
  PATTERN_CRAFT_POSITION_OPTIONS,
  hasEnabledColorPiece,
  hasInvalidColorPieceQty,
  hasPositiveEnabledColorPiece,
  isTechPackModuleReadOnly,
  isTechPackReadOnly,
  markProcessRouteUnconfirmed,
  requestTechPackRender,
  resetBomForm,
  resetColorMappingToSystemSuggestion,
  resetPatternForm,
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

const PATTERN_IMAGE_PREVIEW_MODAL_ID = 'tech-pack-pattern-image-preview-modal'

function openProductionChangeEvaluationFromPublishedVersion(
  record: ReturnType<typeof publishTechnicalDataVersion>,
): string {
  const batch = createProductionTechPackPublishEvaluationBatch({
    technicalVersionId: record.technicalVersionId,
    technicalVersionCode: record.technicalVersionCode,
    versionLabel: record.versionLabel,
    styleId: record.styleId,
    styleCode: record.styleCode,
    styleName: record.styleName,
    publishedAt: record.publishedAt || record.updatedAt,
    publishedBy: record.publishedBy || record.updatedBy || currentUser.name,
    changeSummary: record.changeSummary,
  })
  if (batch.affectedOrders.length === 0) {
    return `已发布技术包版本 ${record.versionLabel}，当前没有关联旧版本生产单需要评估。`
  }
  appStore.openTab({
    key: `production-change-${batch.batchId}`,
    title: '生产单变更',
    href: `/fcs/production/changes?publishBatchId=${encodeURIComponent(batch.batchId)}`,
    closable: true,
  })
  return `已发布技术包版本 ${record.versionLabel}，已生成 ${batch.affectedOrders.length} 个生产单评估入口。`
}

const TECH_PACK_ACTION_MODULE_MAP: Record<string, TechnicalModuleKey> = {
  'open-add-bom': 'BOM',
  'edit-bom': 'BOM',
  'save-bom': 'BOM',
  'delete-bom': 'BOM',
  'add-custom-cost': 'COST',
  'delete-custom-cost': 'COST',
  'confirm-color-mapping': 'COLOR_MATERIAL_MAPPING',
  'mark-color-mapping-manual': 'COLOR_MATERIAL_MAPPING',
  'copy-system-draft-manual': 'COLOR_MATERIAL_MAPPING',
  'reset-color-mapping-suggestion': 'COLOR_MATERIAL_MAPPING',
  'add-mapping-line': 'COLOR_MATERIAL_MAPPING',
  'delete-mapping-line': 'COLOR_MATERIAL_MAPPING',
  'open-add-pattern': 'MATERIAL_PATTERN_LINK',
  'open-add-pattern-package': 'PATTERN',
  'switch-pattern-maintenance-step': 'MATERIAL_PATTERN_LINK',
  'save-pattern-merchandiser-step': 'MATERIAL_PATTERN_LINK',
  'save-pattern-and-go-maker': 'MATERIAL_PATTERN_LINK',
  'add-pattern-binding-strip': 'PATTERN',
  'delete-pattern-binding-strip': 'PATTERN',
  'confirm-pattern-duplicate-warning': 'PATTERN',
  'save-pattern-package': 'PATTERN',
  'save-pattern-maker-step': 'PATTERN',
  'save-pattern-and-parse': 'PATTERN',
  'save-pattern': 'PATTERN',
  'open-pattern-prj-picker': 'PATTERN',
  'open-pattern-dxf-picker': 'PATTERN',
  'open-pattern-rul-picker': 'PATTERN',
  'open-pattern-marker-image-picker': 'PATTERN',
  'open-pattern-single-file-picker': 'PATTERN',
  'clear-pattern-uploaded-files': 'PATTERN',
  'parse-pattern': 'PATTERN',
  'toggle-pattern-size-code': 'PATTERN',
  'toggle-pattern-piece-color': 'PATTERN',
  'toggle-pattern-piece-special-craft': 'PATTERN',
  'open-pattern-piece-template-dialog': 'PATTERN',
  'select-pattern-template': 'PATTERN',
  'add-new-pattern-piece-row': 'PATTERN',
  'delete-new-pattern-piece-row': 'PATTERN',
  'open-piece-instance-special-craft-dialog': 'PATTERN',
  'add-piece-instance-special-craft': 'PATTERN',
  'delete-piece-instance-special-craft': 'PATTERN',
  'apply-piece-instance-craft-to-same-color': 'PATTERN',
  'open-add-technique': 'PROCESS',
  'edit-technique': 'PROCESS',
  'save-technique': 'PROCESS',
  'delete-technique': 'PROCESS',
  'move-technique-route-up': 'PROCESS',
  'move-technique-route-down': 'PROCESS',
  'make-techniques-parallel': 'PROCESS',
  'remove-technique-from-parallel': 'PROCESS',
  'toggle-parallel-group-acceptance': 'PROCESS',
  'confirm-process-route': 'PROCESS',
  'keep-bom-prep-process': 'PROCESS',
  'remove-bom-prep-process': 'PROCESS',
  'open-add-size': 'SIZE',
  'save-size': 'SIZE',
  'delete-size': 'SIZE',
  'open-add-design': 'DESIGN',
  'open-design-file-picker': 'DESIGN',
  'save-design': 'DESIGN',
  'delete-design': 'DESIGN',
}

function validateCurrentDesignRequirement(prefix: string): string {
  if (!state.techPack) return ''
  const validation = validateTechPackDesignRequirement({
    bomItems: state.bomItems,
    patternDesigns: state.techPack.patternDesigns,
  })
  return formatTechPackDesignRequirementBlockMessage(validation, prefix)
}

function getTechPackFieldModuleKey(field: string): TechnicalModuleKey | null {
  const normalized = field.trim()
  if (!normalized) return null
  if (normalized === 'garment-difficulty-grade') return 'QUALITY'
  if (normalized.startsWith('new-bom-') || normalized.startsWith('bom-')) return 'BOM'
  if (
    normalized.startsWith('custom-cost-') ||
    normalized.startsWith('material-') ||
    normalized.startsWith('process-')
  ) {
    return 'COST'
  }
  if (normalized === 'mapping-remark' || normalized.startsWith('mapping-line-')) {
    return 'COLOR_MATERIAL_MAPPING'
  }
  if (normalized.startsWith('new-pattern-') || normalized.startsWith('piece-instance-')) {
    if (
      state.patternFormPurpose === 'ASSOCIATION' &&
      (
        normalized === 'new-pattern-linked-bom-item' ||
        normalized === 'new-pattern-linked-material-alias' ||
        normalized === 'new-pattern-source-package' ||
        normalized.startsWith('new-pattern-piece-') ||
        normalized.startsWith('piece-instance-')
      )
    ) {
      return 'MATERIAL_PATTERN_LINK'
    }
    return 'PATTERN'
  }
  if (normalized.startsWith('new-technique-') || normalized.startsWith('tech-')) return 'PROCESS'
  if (normalized.startsWith('new-size-')) return 'SIZE'
  if (normalized.startsWith('new-design-')) return 'DESIGN'
  return null
}

function getTechPackActionModuleKey(action: string, actionNode?: HTMLElement): TechnicalModuleKey | null {
  const normalized = action.trim()
  if (normalized === 'edit-pattern' || normalized === 'delete-pattern') {
    const patternId = actionNode?.dataset.patternId || ''
    const pattern = state.patternItems.find((item) => item.id === patternId)
    return pattern?.recordKind === 'PACKAGE' ? 'PATTERN' : 'MATERIAL_PATTERN_LINK'
  }
  if (
    state.patternFormPurpose === 'ASSOCIATION' &&
    (
      normalized === 'toggle-pattern-piece-color' ||
      normalized === 'open-pattern-piece-template-dialog' ||
      normalized === 'select-pattern-template' ||
      normalized === 'add-new-pattern-piece-row' ||
      normalized === 'delete-new-pattern-piece-row' ||
      normalized === 'open-piece-instance-special-craft-dialog' ||
      normalized === 'add-piece-instance-special-craft' ||
      normalized === 'delete-piece-instance-special-craft' ||
      normalized === 'apply-piece-instance-craft-to-same-color'
    )
  ) {
    return 'MATERIAL_PATTERN_LINK'
  }
  return TECH_PACK_ACTION_MODULE_MAP[normalized] ?? null
}

function isTechPackFieldReadOnly(field: string): boolean {
  const moduleKey = getTechPackFieldModuleKey(field)
  return moduleKey ? isTechPackModuleReadOnly(moduleKey) : isTechPackReadOnly()
}

function closePatternImagePreviewModal(): void {
  document.getElementById(PATTERN_IMAGE_PREVIEW_MODAL_ID)?.remove()
}

function openPatternImagePreviewModal(input: {
  previewUrl: string
  title: string
  fileName: string
}): void {
  const previewUrl = input.previewUrl.trim()
  if (!previewUrl) return
  closePatternImagePreviewModal()
  const root = document.querySelector('#app') || document.body
  const modal = document.createElement('div')
  modal.id = PATTERN_IMAGE_PREVIEW_MODAL_ID
  modal.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4'
  modal.dataset.skipPageRerender = 'true'
  modal.innerHTML = `
    <section class="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
      <header class="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div class="min-w-0">
          <h3 class="truncate text-base font-semibold">${escapeHtml(input.title || '纸样图预览')}</h3>
          <p class="mt-1 truncate text-xs text-muted-foreground">${escapeHtml(input.fileName || '纸样图')}</p>
        </div>
        <button type="button" class="inline-flex h-9 w-9 items-center justify-center rounded-md border text-lg leading-none hover:bg-muted" data-tech-action="close-pattern-image-preview" data-skip-page-rerender="true" aria-label="关闭大图预览">
          ×
        </button>
      </header>
      <div class="min-h-0 flex-1 overflow-auto bg-slate-50 p-4">
        <img src="${escapeHtml(previewUrl)}" alt="${escapeHtml(input.title || input.fileName || '纸样图')}" class="mx-auto max-h-[76vh] max-w-full rounded-lg border bg-white object-contain shadow-sm" />
      </div>
    </section>
  `
  root.appendChild(modal)
}

function getTechniqueById(techId: string): TechniqueItem | null {
  return state.techniques.find((item) => item.id === techId) ?? null
}

function updateTechnique(techId: string, updater: (item: TechniqueItem) => TechniqueItem): void {
  state.techniques = state.techniques.map((item) => (item.id === techId ? updater(item) : item))
  syncProcessCostRows()
  syncTechPackToStore()
}

type TechniqueRouteGroup = {
  items: TechniqueItem[]
}

function getTechniqueRouteGroups(): TechniqueRouteGroup[] {
  const normalized = normalizeTechniqueRoutes(state.techniques)
  const groups = new Map<number, TechniqueItem[]>()
  normalized.forEach((item) => {
    groups.set(item.routeStepNo, [...(groups.get(item.routeStepNo) ?? []), item])
  })
  return Array.from(groups.entries())
    .sort(([left], [right]) => left - right)
    .map(([, items]) => ({
      items: items.slice().sort((left, right) => left.routeLaneNo - right.routeLaneNo),
    }))
}

function flattenTechniqueRouteGroups(groups: TechniqueRouteGroup[]): TechniqueItem[] {
  const updatedAt = toTimestamp()
  return groups.flatMap((group, groupIndex) => {
    const isParallel = group.items.length > 1
    const groupId = isParallel ? `route-step-${groupIndex + 1}` : undefined
    const groupName = isParallel ? `第 ${groupIndex + 1} 步并行组` : undefined
    const groupAcceptanceMode: TechniqueItem['routeParallelAcceptanceMode'] = isParallel
      ? group.items.find((item) => item.routeParallelAcceptanceMode === 'WHOLE_GROUP_ALLOWED')
        ? 'WHOLE_GROUP_ALLOWED'
        : 'INDEPENDENT_ONLY'
      : 'INDEPENDENT_ONLY'
    return group.items.map((item, laneIndex) => ({
      ...item,
      routeStepNo: groupIndex + 1,
      routeLaneNo: laneIndex + 1,
      routeParallelGroupId: groupId,
      routeParallelGroupName: groupName,
      routeParallelAcceptanceMode: groupAcceptanceMode,
      routeSourceKind: 'MANUAL',
      routeUpdatedBy: currentUser.name,
      routeUpdatedAt: updatedAt,
    }))
  })
}

function findTechniqueRouteGroupIndex(groups: TechniqueRouteGroup[], techId: string): number {
  return groups.findIndex((group) => group.items.some((item) => item.id === techId))
}

function saveTechniqueRouteGroups(groups: TechniqueRouteGroup[]): void {
  state.techniques = normalizeTechniqueRoutes(flattenTechniqueRouteGroups(groups))
  markProcessRouteUnconfirmed()
  syncProcessCostRows()
  syncTechPackToStore()
}

function moveTechniqueRoute(techId: string, direction: 'up' | 'down'): void {
  const groups = getTechniqueRouteGroups()
  const index = findTechniqueRouteGroupIndex(groups, techId)
  if (index < 0) return
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= groups.length) return
  const nextGroups = [...groups]
  ;[nextGroups[index], nextGroups[targetIndex]] = [nextGroups[targetIndex], nextGroups[index]]
  saveTechniqueRouteGroups(nextGroups)
}

function makeTechniqueParallel(techId: string, direction: 'previous' | 'next'): void {
  const groups = getTechniqueRouteGroups()
  const index = findTechniqueRouteGroupIndex(groups, techId)
  if (index < 0) return
  if (direction === 'previous') {
    if (index === 0) return
    const merged = { items: [...groups[index - 1].items, ...groups[index].items] }
    const nextGroups = [...groups]
    nextGroups.splice(index - 1, 2, merged)
    saveTechniqueRouteGroups(nextGroups)
    return
  }
  if (index >= groups.length - 1) return
  const merged = { items: [...groups[index].items, ...groups[index + 1].items] }
  const nextGroups = [...groups]
  nextGroups.splice(index, 2, merged)
  saveTechniqueRouteGroups(nextGroups)
}

function removeTechniqueFromParallel(techId: string): void {
  const groups = getTechniqueRouteGroups()
  const index = findTechniqueRouteGroupIndex(groups, techId)
  if (index < 0) return
  const group = groups[index]
  if (group.items.length <= 1) return
  const removed = group.items.find((item) => item.id === techId)
  if (!removed) return
  const remaining = group.items.filter((item) => item.id !== techId)
  const nextGroups = [...groups]
  nextGroups.splice(index, 1, { items: remaining }, { items: [removed] })
  saveTechniqueRouteGroups(nextGroups)
}

function toggleParallelGroupAcceptance(techId: string): void {
  const groups = getTechniqueRouteGroups()
  const index = findTechniqueRouteGroupIndex(groups, techId)
  if (index < 0) return
  const group = groups[index]
  if (group.items.length <= 1) return
  const nextMode = group.items[0].routeParallelAcceptanceMode === 'WHOLE_GROUP_ALLOWED'
    ? 'INDEPENDENT_ONLY'
    : 'WHOLE_GROUP_ALLOWED'
  const updatedAt = toTimestamp()
  groups[index] = {
    items: group.items.map((item) => ({
      ...item,
      routeParallelAcceptanceMode: nextMode,
      routeSourceKind: 'MANUAL',
      routeUpdatedBy: currentUser.name,
      routeUpdatedAt: updatedAt,
    })),
  }
  saveTechniqueRouteGroups(groups)
}

function confirmProcessRoute(): void {
  if (state.techniques.length === 0) return
  const confirmedAt = toTimestamp()
  state.techniques = normalizeTechniqueRoutes(state.techniques).map((item) => ({
    ...item,
    routeUpdatedBy: item.routeUpdatedBy || currentUser.name,
    routeUpdatedAt: item.routeUpdatedAt || confirmedAt,
  }))
  state.processRouteStatus = 'CONFIRMED'
  state.processRouteConfirmedBy = currentUser.name
  state.processRouteConfirmedAt = confirmedAt
  state.processRouteUpdatedBy = currentUser.name
  state.processRouteUpdatedAt = confirmedAt
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

function clearWoolFileState(): void {
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
  state.selectedDesignFiles = []
  state.newDesignFiles = []
  state.designFileSelectionToken += 1
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

function syncPrimaryDesignDraftFile(): void {
  const primary = state.newDesignFiles[0] ?? null
  state.selectedDesignFile = state.selectedDesignFiles[0] ?? null
  state.newDesignFileName = primary?.fileName || ''
  state.newDesignOriginalFileMimeType = primary?.mimeType || ''
  state.newDesignOriginalFileDataUrl = primary?.originalFileDataUrl || ''
  state.newDesignPreviewThumbnailDataUrl = primary?.previewThumbnailDataUrl || ''
}

async function applySelectedDesignFiles(files: File[]): Promise<void> {
  const selectionToken = state.designFileSelectionToken + 1
  state.designFileSelectionToken = selectionToken
  state.selectedDesignFiles = [...files]
  state.newDesignFiles = files.map((file, index) => ({
    id: `${selectionToken}-${index}-${file.name}`,
    fileName: file.name,
    mimeType: file.type,
    originalFileDataUrl: '',
    previewThumbnailDataUrl: buildDesignPlaceholderImage(file.name, state.newDesignSideType),
    processing: true,
  }))
  syncPrimaryDesignDraftFile()
  requestTechPackRender()

  if (files.length === 0) return

  const draftFiles = await Promise.all(
    files.map(async (file, index) => {
      try {
        const originalFileDataUrl = await readFileAsDataUrl(file)
        const previewThumbnailDataUrl = isImageDesignFile(file)
          ? await buildDesignThumbnailDataUrl(originalFileDataUrl, file.name, state.newDesignSideType)
          : buildDesignPlaceholderImage(file.name, state.newDesignSideType)

        return {
          id: `${selectionToken}-${index}-${file.name}`,
          fileName: file.name,
          mimeType: file.type,
          originalFileDataUrl,
          previewThumbnailDataUrl,
          processing: false,
        }
      } catch {
        return {
          id: `${selectionToken}-${index}-${file.name}`,
          fileName: file.name,
          mimeType: file.type,
          originalFileDataUrl: '',
          previewThumbnailDataUrl: buildDesignPlaceholderImage(file.name, state.newDesignSideType),
          processing: false,
        }
      }
    }),
  )

  if (state.designFileSelectionToken !== selectionToken) return
  state.newDesignFiles = draftFiles
  syncPrimaryDesignDraftFile()
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
    state.newBomItem.frontPatternDesignIds = []
    state.newBomItem.insidePatternDesignId = ''
    state.newBomItem.insidePatternDesignIds = []
  }
}

function applyBomPrintSideModeChange(nextMode: '' | 'SINGLE' | 'DOUBLE'): void {
  state.newBomItem.printSideMode = nextMode
  if (nextMode === '') {
    state.newBomItem.frontPatternDesignId = ''
    state.newBomItem.frontPatternDesignIds = []
    state.newBomItem.insidePatternDesignId = ''
    state.newBomItem.insidePatternDesignIds = []
  }
}

function setBomPatternDesignIds(side: 'FRONT' | 'INSIDE', ids: string[]): void {
  const nextIds = normalizePatternDesignIdList(ids)
  if (side === 'FRONT') {
    state.newBomItem.frontPatternDesignIds = nextIds
    state.newBomItem.frontPatternDesignId = nextIds[0] || ''
    return
  }

  state.newBomItem.insidePatternDesignIds = nextIds
  state.newBomItem.insidePatternDesignId = nextIds[0] || ''
}

function toggleBomPatternDesignId(side: 'FRONT' | 'INSIDE', designId: string, checked: boolean): void {
  const currentIds = getBomPatternDesignIds(state.newBomItem, side)
  const nextIds = checked
    ? normalizePatternDesignIdList([...currentIds, designId])
    : currentIds.filter((item) => item !== designId)
  setBomPatternDesignIds(side, nextIds)
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

function normalizePackagePieceQty(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  const integer = Math.trunc(numeric)
  return integer >= 0 ? integer : 0
}

function getPackagePieceQty(row: (typeof state.newPattern.pieceRows)[number]): number {
  const candidates = [row.totalPieceQty, row.count, row.parsedQuantity]
  for (const candidate of candidates) {
    const normalized = normalizePackagePieceQty(candidate)
    if (normalized > 0) return normalized
  }
  return 0
}

function sanitizePatternPackagePieceRow(
  row: (typeof state.newPattern.pieceRows)[number],
): (typeof state.newPattern.pieceRows)[number] {
  const pieceQty = getPackagePieceQty(row)
  return {
    ...row,
    count: pieceQty,
    note: row.note || row.annotation || '',
    isTemplate: false,
    partTemplateId: undefined,
    partTemplateName: undefined,
    partTemplatePreviewSvg: undefined,
    partTemplateShapeDescription: undefined,
    applicableSkuCodes: [],
    colorAllocations: [],
    colorPieceQuantities: [],
    totalPieceQty: pieceQty,
    specialCrafts: [],
    bundleLengthCm: undefined,
    bundleWidthCm: undefined,
  }
}

function sanitizePatternPackagePieceRows(
  rows: typeof state.newPattern.pieceRows,
): typeof state.newPattern.pieceRows {
  return rows.map(sanitizePatternPackagePieceRow)
}

function refreshPatternPackagePieceTotals(): void {
  state.newPattern.pieceRows = sanitizePatternPackagePieceRows(state.newPattern.pieceRows)
  state.newPattern.totalPieceCount = calculatePatternTotalPieceQty(state.newPattern.pieceRows)
  state.newPattern.patternTotalPieceQty = state.newPattern.totalPieceCount
  state.newPattern.pieceInstances = []
  state.newPattern.pieceInstanceTotal = 0
  state.newPattern.specialCraftConfiguredPieceTotal = 0
  state.newPattern.specialCraftUnconfiguredPieceTotal = 0
}

function refreshPatternPieceTotals(): void {
  if (state.patternFormPurpose === 'PACKAGE') {
    refreshPatternPackagePieceTotals()
    return
  }
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
    clearWoolFileState()
    clearParsedPatternRows()
    state.newPattern.patternFileMode = 'PAIRED_DXF_RUL'
    clearPatternParseState('NOT_PARSED')
    return
  }

  if (nextType === 'WOOL') {
    clearWovenFileState()
    clearParsedPatternRows()
    state.newPattern.patternFileMode = 'SINGLE_FILE'
    clearPatternParseState('NOT_REQUIRED')
    return
  }

  state.newPattern.patternFileMode = 'SINGLE_FILE'
  clearWovenFileState()
  clearWoolFileState()
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
    const nextRows = state.patternFormPurpose === 'PACKAGE'
      ? sanitizePatternPackagePieceRows(normalizedRows)
      : normalizedRows
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
    state.newPattern.pieceRows = nextRows.map((row) => ({
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
    state.newPattern.totalPieceCount = calculatePatternTotalPieceQty(nextRows)
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

  const noEnabledColorRow = state.newPattern.pieceRows.find(
    (row) => row.colorAllocations.length === 0 && !hasEnabledColorPiece(row),
  )
  if (noEnabledColorRow) return '请至少选择一个适用颜色'

  const invalidColorAllocationRow = state.newPattern.pieceRows.find((row) =>
    row.colorAllocations.some((allocation) => Number(allocation.pieceCount) <= 0),
  )
  if (invalidColorAllocationRow) return '每个颜色片数必须大于 0'

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
    if (invalidRow && Number(invalidRow.totalPieceQty) <= 0) return '布料纸样存在数量缺失，不能保存'
    if (invalidRow) return '布料纸样解析结果不完整，不能保存'
    return null
  }

  if (!state.newPattern.singlePatternFileName.trim() && !state.newPattern.file.trim()) {
    return '毛织纸样需先选择纸样文件'
  }
  if (state.newPattern.pieceRows.length === 0) return '毛织纸样至少保留 1 行裁片明细'
  const invalidRow = state.newPattern.pieceRows.find(
    (row) => row.sourceType !== 'MANUAL' || !row.name.trim() || Number(row.totalPieceQty) <= 0,
  )
  if (invalidRow) return '毛织纸样裁片名称和片数必须填写完整'
  return null
}

function validatePatternMerchandiserStep(): string | null {
  if (state.patternFormPurpose === 'PACKAGE') {
    if (!state.newPattern.name.trim()) return '请填写纸样名称'
    if (!String(state.newPattern.type || '').trim()) return '请选择纸样分类'
    if (state.newPattern.patternMaterialType === 'UNKNOWN') return '请选择纸样类型'
    return null
  }

  if (!state.newPattern.linkedBomItemId.trim()) return '请选择关联物料'
  if (!state.newPattern.sourcePatternPackageId.trim()) return '请选择关联纸样'
  if (!state.newPattern.name.trim()) return '请选择关联纸样'
  if (!String(state.newPattern.type || '').trim()) return '请选择纸样分类'
  if (state.newPattern.patternMaterialType === 'UNKNOWN') return '请选择纸样类型'
  return null
}

function validatePatternMakerStep(): string | null {
  if (state.patternFormPurpose !== 'PACKAGE') {
    return validatePatternMerchandiserStep()
  }
  if (!state.newPattern.name.trim()) return '请填写纸样名称'
  if (!String(state.newPattern.type || '').trim()) return '请选择纸样分类'
  if (state.newPattern.patternMaterialType === 'UNKNOWN') return '请选择纸样类型'
  if (!Number.isFinite(Number(state.newPattern.widthCm)) || Number(state.newPattern.widthCm) <= 0) {
    return '门幅必须大于 0'
  }
  if (!Number.isFinite(Number(state.newPattern.markerLengthM)) || Number(state.newPattern.markerLengthM) <= 0) {
    return '排料长度必须大于 0'
  }
  const invalidNameStrip = state.newPattern.bindingStrips.find((item) => !String(item.bindingStripName || '').trim())
  if (invalidNameStrip) return '请填写捆条名称'
  const invalidLengthStrip = state.newPattern.bindingStrips.find((item) => !Number.isFinite(Number(item.lengthCm)) || Number(item.lengthCm) <= 0)
  if (invalidLengthStrip) return '捆条长度必须大于 0'
  const invalidWidthStrip = state.newPattern.bindingStrips.find((item) => !Number.isFinite(Number(item.widthCm)) || Number(item.widthCm) <= 0)
  if (invalidWidthStrip) return '捆条宽度必须大于 0'
  const invalidCuttingMethodStrip = state.newPattern.bindingStrips.find((item) => !['斜切', '直切', '横切'].includes(String(item.cuttingMethod || '')))
  if (invalidCuttingMethodStrip) return '请选择捆条切割方式'
  if (state.newPattern.patternMaterialType === 'WOVEN' && state.newPattern.pieceRows.length === 0) {
    return '布料纸样请先在纸样池解析部位信息'
  }
  if (state.newPattern.patternMaterialType === 'WOOL' && state.newPattern.pieceRows.length === 0) {
    return '毛织纸样请添加部位信息'
  }
  return null
}

function validatePatternPackage(): string | null {
  const baseError = validatePatternMerchandiserStep()
  if (baseError) return baseError
  const technicalError = validatePatternMakerStep()
  if (technicalError) return technicalError
  if (state.newPattern.patternMaterialType === 'WOOL') {
    if (!state.newPattern.singlePatternFileName.trim() && !state.newPattern.file.trim()) return '请上传毛织纸样 Zip 文件'
    if (!hasFileExtension(state.newPattern.singlePatternFileName || state.newPattern.file, ['.zip'])) return '毛织纸样包只能上传 Zip 文件'
    if (state.newPattern.pieceRows.length === 0) return '请新增毛织部位明细'
    const invalidRow = state.newPattern.pieceRows.find(
      (row) => row.sourceType !== 'MANUAL' || !row.name.trim() || Number(row.totalPieceQty) <= 0,
    )
    if (invalidRow) return '毛织部位名称和片数必须填写完整'
    return null
  }
  if (!state.newPattern.prjFile?.fileName) return '请上传纸样 PRJ 文件'
  if (!state.newPattern.markerImage?.fileName) return '请上传唛架图片'
  if (!hasFileExtension(state.newPattern.prjFile.fileName, ['.prj'])) return '文件格式不正确，请上传 PRJ 文件'
  if (!hasFileExtension(state.newPattern.markerImage.fileName, ['.png', '.jpg', '.jpeg', '.webp'])) {
    return '文件格式不正确，请上传唛架图片'
  }
  if (state.newPattern.patternMaterialType === 'WOVEN') {
    if (!state.newPattern.dxfFileName.trim()) return '请上传 DXF 文件'
    if (!state.newPattern.rulFileName.trim()) return '请上传 RUL 文件'
    if (!hasFileExtension(state.newPattern.dxfFileName, ['.dxf'])) return '文件格式不正确，请上传 DXF 文件'
    if (!hasFileExtension(state.newPattern.rulFileName, ['.rul'])) return '文件格式不正确，请上传 RUL 文件'
    if (state.newPattern.parseStatus !== 'PARSED') return '布料纸样需先解析部位信息'
    if (state.newPattern.pieceRows.length === 0) return '布料纸样解析不到部位明细，不能保存'
    const invalidRow = state.newPattern.pieceRows.find(
      (row) =>
        row.sourceType !== 'PARSED_PATTERN'
        || !row.name.trim()
        || Number(row.totalPieceQty) <= 0
        || row.missingName,
    )
    if (invalidRow?.missingName) return '布料纸样存在名称缺失，不能保存'
    if (invalidRow && Number(invalidRow.totalPieceQty) <= 0) return '布料纸样存在数量缺失，不能保存'
    if (invalidRow) return '布料纸样解析结果不完整，不能保存'
  }
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
  const isPatternPackage = state.patternFormPurpose === 'PACKAGE'
  const normalizedFormPieceRows = normalizePatternPieceRows(
    state.newPattern.pieceRows.map((row) => ({ ...row })),
    nowId,
    state.newPattern.linkedBomItemId,
  )
  const normalizedPieceRows = isPatternPackage
    ? sanitizePatternPackagePieceRows(normalizedFormPieceRows)
    : normalizedFormPieceRows
  const totalPieceCount = calculatePatternTotalPieceQty(normalizedPieceRows)
  const selectedSizeCodes = dedupeStrings(
    state.newPattern.selectedSizeCodes.length > 0
      ? [...state.newPattern.selectedSizeCodes]
      : getSizeCodeOptionsFromSizeRules().map((item) => item.sizeCode),
  )
  const sizeRange = selectedSizeCodes.join(' / ')
  const linkedBom = state.bomItems.find((item) => item.id === state.newPattern.linkedBomItemId) || null
  const bindingStrips = normalizePatternBindingStrips(state.newPattern.bindingStrips)
  const normalizedPatternMaterialType =
    state.newPattern.patternMaterialType === 'UNKNOWN'
      ? 'WOVEN'
      : state.newPattern.patternMaterialType
  const normalizedPatternFileMode =
    normalizedPatternMaterialType === 'WOOL'
      ? 'SINGLE_FILE'
      : state.newPattern.patternFileMode || 'PAIRED_DXF_RUL'
  const pieceInstances = isPatternPackage
    ? []
    : generatePieceInstancesFromColorQuantities({
        id: nowId,
        pieceRows: normalizedPieceRows,
        pieceInstances: state.newPattern.pieceInstances,
      })
  const pieceInstanceSummary = isPatternPackage
    ? {
        pieceInstanceTotal: 0,
        specialCraftConfiguredPieceTotal: 0,
        specialCraftUnconfiguredPieceTotal: 0,
      }
    : summarizePieceInstances(pieceInstances)
  const nextParseStatus =
    normalizedPatternMaterialType === 'WOOL'
      ? 'NOT_REQUIRED'
      : finalStatus === '已解析待确认' || finalStatus === '已完成'
        ? 'PARSED'
        : state.newPattern.parseStatus === 'FAILED'
          ? 'FAILED'
          : 'NOT_PARSED'
  const parsedPatternSource = { sourceType: 'PARSED_PATTERN' as const }
  const manualPatternSource = { sourceType: 'MANUAL' as const }

  return {
    recordKind: isPatternPackage ? 'PACKAGE' as const : 'MATERIAL_ASSOCIATION' as const,
    name: state.newPattern.name.trim(),
    type: state.newPattern.type,
    image: state.newPattern.markerImage?.previewUrl || state.newPattern.image,
    file: buildPatternDisplayFile({
      patternFileMode: normalizedPatternFileMode,
      dxfFileName: state.newPattern.dxfFileName,
      rulFileName: state.newPattern.rulFileName,
      singlePatternFileName: state.newPattern.singlePatternFileName,
      fileName: state.newPattern.file,
    }),
    remark: state.newPattern.remark,
    linkedBomItemId: isPatternPackage ? '' : state.newPattern.linkedBomItemId,
    linkedMaterialId: isPatternPackage ? '' : state.newPattern.linkedBomItemId,
    linkedMaterialName: isPatternPackage ? '' : linkedBom?.materialName || state.newPattern.linkedMaterialName,
    linkedMaterialAlias: isPatternPackage ? '' : state.newPattern.linkedMaterialAlias?.trim() || '',
    linkedMaterialSku: isPatternPackage ? '' : linkedBom?.materialCode || state.newPattern.linkedMaterialSku,
    widthCm: state.newPattern.widthCm,
    markerLengthM: state.newPattern.markerLengthM,
    totalPieceCount,
    patternTotalPieceQty: totalPieceCount,
    isWoolted: state.newPattern.patternMaterialType === 'WOOL' ? '是' as const : '否' as const,
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
    dxfFile: state.newPattern.dxfFile
      ? { ...state.newPattern.dxfFile }
      : state.newPattern.dxfFileName.trim()
        ? createPatternManagedFile({
            fileName: state.newPattern.dxfFileName,
            fileSize: state.newPattern.dxfFileSize,
            uploadedAt: state.newPattern.dxfLastModified,
            uploadedBy: currentUser.name,
          })
        : null,
    rulFile: state.newPattern.rulFile
      ? { ...state.newPattern.rulFile }
      : state.newPattern.rulFileName.trim()
        ? createPatternManagedFile({
            fileName: state.newPattern.rulFileName,
            fileSize: state.newPattern.rulFileSize,
            uploadedAt: state.newPattern.rulLastModified,
            uploadedBy: currentUser.name,
          })
        : null,
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
    patternMaterialType: normalizedPatternMaterialType,
    patternMaterialTypeLabel: getPatternMaterialTypeLabel(normalizedPatternMaterialType),
    internalStyleCode:
      normalizedPatternMaterialType === 'WOOL'
        ? state.newPattern.internalStyleCode.trim()
        : '',
    patternFileMode: normalizedPatternFileMode,
    parseStatus: nextParseStatus,
    parseStatusLabel: getPatternParseStatusLabel(nextParseStatus),
    parseError: finalStatus === '待解析' ? '' : state.newPattern.parseError,
    parsedAt:
      normalizedPatternMaterialType === 'WOVEN' && (finalStatus === '已解析待确认' || finalStatus === '已完成')
        ? state.newPattern.parsedAt || toTimestamp()
        : '',
    dxfFileName: state.newPattern.dxfFileName,
    dxfFileSize: state.newPattern.dxfFileSize,
    dxfLastModified: state.newPattern.dxfLastModified,
    rulFileName: state.newPattern.rulFileName,
    rulFileSize: state.newPattern.rulFileSize,
    rulLastModified: state.newPattern.rulLastModified,
    singlePatternFileName: state.newPattern.singlePatternFileName,
    singlePatternFileSize: state.newPattern.singlePatternFileSize,
    singlePatternFileLastModified: state.newPattern.singlePatternFileLastModified,
    dxfEncoding: state.newPattern.dxfEncoding,
    rulEncoding: state.newPattern.rulEncoding,
    rulSizeList: [...state.newPattern.rulSizeList],
    rulSampleSize: state.newPattern.rulSampleSize,
    patternSoftwareName: state.newPattern.patternSoftwareName,
    selectedSizeCodes,
    sizeRange,
    pieceRows: normalizedPieceRows.map((row) =>
      isPatternPackage
        ? {
            ...row,
            ...(normalizedPatternMaterialType === 'WOVEN' ? parsedPatternSource : manualPatternSource),
            missingName: false,
            missingCount: false,
          }
        : {
            ...row,
            sourceType: row.sourceType || 'MANUAL' as const,
            applicableSkuCodes: dedupeStrings(row.colorAllocations.flatMap((allocation) => allocation.skuCodes ?? [])),
            missingName: false,
            missingCount: false,
          },
    ),
    sourcePatternPackageId: state.newPattern.sourcePatternPackageId,
    sourcePatternPackageName: state.newPattern.sourcePatternPackageName,
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
      const host =
        document.querySelector('[data-testid="pattern-association-dialog"]')?.parentElement ||
        document.querySelector('[data-testid="pattern-two-step-dialog"]')?.parentElement
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
  if (state.patternFormPurpose === 'PACKAGE') {
    const duplicateResult = checkDuplicatePattern(
      { id: nowId, ...nextPattern },
      state.patternItems.filter((item) => item.recordKind === 'PACKAGE'),
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

function applyPatternPackageToAssociation(patternPackageId: string): void {
  const selectedPackage = state.patternItems.find((item) => item.id === patternPackageId) ?? null
  if (!selectedPackage) {
    state.newPattern.sourcePatternPackageId = ''
    state.newPattern.sourcePatternPackageName = ''
    return
  }

  const linkedBomItemId = state.newPattern.linkedBomItemId
  const linkedMaterialId = state.newPattern.linkedMaterialId
  const linkedMaterialName = state.newPattern.linkedMaterialName
  const linkedMaterialAlias = state.newPattern.linkedMaterialAlias
  const linkedMaterialSku = state.newPattern.linkedMaterialSku
  const currentPieceRows = state.newPattern.pieceRows
  const currentPieceInstances = state.newPattern.pieceInstances

  state.newPattern = {
    ...buildPatternFormStateFromItem(selectedPackage),
    linkedBomItemId,
    linkedMaterialId,
    linkedMaterialName,
    linkedMaterialAlias,
    linkedMaterialSku,
    sourcePatternPackageId: selectedPackage.id,
    sourcePatternPackageName: selectedPackage.name,
    duplicateConfirmed: false,
    duplicateWarningReasons: [],
    patternParsing: false,
  }

  if (selectedPackage.patternMaterialType === 'WOOL' && selectedPackage.pieceRows.length === 0 && currentPieceRows.length > 0) {
    state.newPattern.pieceRows = currentPieceRows
    state.newPattern.pieceInstances = currentPieceInstances
  }

  state.newPattern.pieceRows = normalizePatternPieceRows(
    state.newPattern.pieceRows,
    state.editPatternItemId || 'DRAFT',
    state.newPattern.linkedBomItemId,
  )
  refreshPatternPieceTotals()
}

function handleTechPackField(
  node: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
): boolean {
  const field = node.dataset.techField
  if (!field) return false

  const value = node.value
  const checked = node instanceof HTMLInputElement ? node.checked : false

  if (field === 'review-action-opinion') {
    state.reviewActionOpinion = value
    return true
  }

  if (field === 'review-return-module') {
    const moduleKey = value as TechnicalModuleKey
    const nextKeys = new Set(state.reviewReturnModuleKeys)
    if (checked) nextKeys.add(moduleKey)
    else nextKeys.delete(moduleKey)
    state.reviewReturnModuleKeys = [...nextKeys]
    return true
  }

  if (field === 'review-return-all-modules') {
    state.reviewReturnModuleKeys = checked
      ? ['BOM', 'COST', 'PATTERN', 'MATERIAL_PATTERN_LINK', 'COLOR_MATERIAL_MAPPING', 'PROCESS', 'SIZE', 'DESIGN', 'QUALITY']
      : []
    return true
  }

  if (field === 'review-reopen-role') {
    const nodeKey = value as TechnicalReviewNodeKey
    state.reviewReopenNodeKeys =
      nodeKey === 'BUYER' || nodeKey === 'PATTERN_MAKER' || nodeKey === 'MERCHANDISER'
        ? [nodeKey]
        : []
    return true
  }

  if (field === 'garment-difficulty-grade') {
    if (!state.currentTechnicalVersionId) return true
    const nextGrade: TechnicalGarmentDifficultyGrade =
      value === 'A' || value === 'A+' || value === 'A++' || value === 'B' || value === 'C' || value === 'D'
        ? value
        : 'B'
    saveTechnicalDataVersionRecordMeta(
      state.currentTechnicalVersionId,
      { garmentDifficultyGrade: nextGrade },
      currentUser.name,
    )
    return true
  }

  if (field === 'new-pattern-name') {
    state.newPattern.name = value
    state.newPattern.duplicateConfirmed = false
    state.newPattern.duplicateWarningReasons = []
    return true
  }
  if (field === 'new-pattern-material-type') {
    applyPatternMaterialTypeChange(
      value === 'WOVEN' || value === 'WOOL' ? value : 'UNKNOWN',
    )
    state.newPattern.isWoolted = value === 'WOOL' ? '是' : '否'
    return true
  }
  if (field === 'new-pattern-is-woolted') {
    const nextType: TechPackPatternMaterialType = value === '是' ? 'WOOL' : 'WOVEN'
    applyPatternMaterialTypeChange(nextType)
    state.newPattern.isWoolted = value === '是' ? '是' : '否'
    return true
  }
  if (field === 'new-pattern-type') {
    state.newPattern.type = TECH_PACK_PATTERN_CATEGORY_OPTIONS.includes(value as never)
      ? value
      : '其他'
    return true
  }
  if (field === 'new-pattern-source-package') {
    applyPatternPackageToAssociation(value)
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
    if (
      file
      && state.patternFormPurpose === 'PACKAGE'
      && state.newPattern.patternMaterialType === 'WOOL'
      && !hasFileExtension(file.name, ['.zip'])
    ) {
      applyPatternFileError('毛织纸样包只能上传 Zip 文件', node)
      state.newPattern.selectedSinglePatternFile = null
      state.newPattern.singlePatternFileName = ''
      state.newPattern.singlePatternFileSize = 0
      state.newPattern.singlePatternFileLastModified = ''
      state.newPattern.file = ''
      return true
    }
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
  if (field === 'new-pattern-internal-style-code') {
    state.newPattern.internalStyleCode = value.trim()
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
    const previousLinkedBomItemId = state.newPattern.linkedBomItemId
    state.newPattern.linkedBomItemId = value
    const linkedBom = state.bomItems.find((item) => item.id === value) || null
    state.newPattern.linkedMaterialId = value
    state.newPattern.linkedMaterialName = linkedBom?.materialName || ''
    if (previousLinkedBomItemId !== value) {
      state.newPattern.linkedMaterialAlias = ''
    }
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
  if (field === 'new-pattern-linked-material-alias') {
    state.newPattern.linkedMaterialAlias = value
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
  if (field === 'new-pattern-binding-strip-cutting-method') {
    const bindingStripId = node.dataset.bindingStripId
    const cuttingMethod = ['斜切', '直切', '横切'].includes(value) ? value : '斜切'
    state.newPattern.bindingStrips = normalizePatternBindingStrips(state.newPattern.bindingStrips.map((item) =>
      item.bindingStripId === bindingStripId ? { ...item, cuttingMethod } : item,
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
    if (state.newPattern.patternMaterialType === 'WOVEN' && state.patternFormPurpose !== 'PACKAGE') return true
    const pieceId = node.dataset.pieceId
    if (!pieceId) return true
    const nextCount = Number.parseInt(value, 10) || 0
    if (state.patternFormPurpose === 'PACKAGE') {
      updatePatternPieceRow(pieceId, (row) => ({
        ...row,
        count: nextCount,
        totalPieceQty: nextCount,
        colorAllocations: [],
        colorPieceQuantities: [],
        applicableSkuCodes: [],
        specialCrafts: [],
      }))
      refreshPatternPieceTotals()
      return true
    }
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
    if (node instanceof HTMLInputElement && node.type === 'checkbox') {
      toggleBomPatternDesignId('FRONT', String(node.dataset.designId || value).trim(), checked)
    } else {
      setBomPatternDesignIds('FRONT', value ? [value] : [])
    }
    return true
  }
  if (field === 'new-bom-inside-pattern-design-id') {
    if (node instanceof HTMLInputElement && node.type === 'checkbox') {
      toggleBomPatternDesignId('INSIDE', String(node.dataset.designId || value).trim(), checked)
    } else {
      setBomPatternDesignIds('INSIDE', value ? [value] : [])
    }
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
      outputValue: '',
      outputValueUnit: '产值/件',
      difficulty: '中等',
      packagingRequired: false,
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
      packagingRequired: false,
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
      outputValue: option?.processCode === 'DYE' ? '10' : option ? '12' : '',
      outputValueUnit: option?.processCode === 'DYE' ? '产值/件' : '产值/件',
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
      packagingRequired: craft?.craftName === '整件毛织' ? state.newTechnique.packagingRequired : false,
      outputValue: craft ? String(craft.referenceOutputValueValue) : state.newTechnique.outputValue,
      outputValueUnit: craft ? craft.referenceOutputValueUnitLabel : state.newTechnique.outputValueUnit,
    }
    return true
  }
  if (field === 'new-technique-packaging-required') {
    state.newTechnique.packagingRequired = checked
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
  if (field === 'new-technique-output-value') {
    state.newTechnique.outputValue = value
    return true
  }
  if (field === 'new-technique-output-value-unit') {
    state.newTechnique.outputValueUnit = value
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
                  frontPatternDesignIds: [],
                  insidePatternDesignId: '',
                  insidePatternDesignIds: [],
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

  if (field === 'tech-output-value') {
    const techId = node.dataset.techId
    if (!techId) return true
    updateTechnique(techId, (item) => ({
      ...item,
      outputValue: Number.parseFloat(value) || 0,
    }))
    return true
  }
  if (field === 'tech-output-value-unit') {
    const techId = node.dataset.techId
    if (!techId) return true
    updateTechnique(techId, (item) => ({ ...item, outputValueUnit: value }))
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
  if (field === 'tech-packaging-required') {
    const techId = node.dataset.techId
    if (!techId) return true
    updateTechnique(techId, (item) => ({
      ...item,
      packagingRequired: item.technique === '整件毛织' || item.woolTaskType === 'WHOLE_GARMENT' ? checked : false,
    }))
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

  if (field === 'new-design-name') {
    state.newDesignName = value
    return true
  }
  if (field === 'new-design-side-type') {
    state.newDesignSideType = value === 'INSIDE' ? 'INSIDE' : 'FRONT'
    if (state.newDesignFiles.length > 0) {
      state.newDesignFiles = state.newDesignFiles.map((draft, index) => {
        const file = state.selectedDesignFiles[index] ?? null
        if (!file || isImageDesignFile(file)) return draft
        return {
          ...draft,
          previewThumbnailDataUrl: buildDesignPlaceholderImage(file.name, state.newDesignSideType),
        }
      })
      syncPrimaryDesignDraftFile()
    }
    return true
  }
  if (field === 'new-design-file') {
    if (!(node instanceof HTMLInputElement)) return true
    const files = Array.from(node.files ?? [])
    revokeDraftDesignPreview()
    void applySelectedDesignFiles(files)
    return true
  }
  if (field === 'pattern-template-search-keyword') {
    state.patternTemplateSearchKeyword = value
    return true
  }

  return false
}

function performRelease(): void {
  if (!state.techPack) return
  syncTechPackToStore()
  if (state.currentTechnicalVersionId) {
    try {
      const record = publishTechnicalDataVersion(state.currentTechnicalVersionId, currentUser.name)
      state.techPack = {
        ...state.techPack,
        status: 'ENABLED',
        versionLabel: record.versionLabel,
        lastUpdatedAt: record.updatedAt,
        lastUpdatedBy: record.updatedBy,
      }
      state.compatibilityMessage = openProductionChangeEvaluationFromPublishedVersion(record)
    } catch (error) {
      state.compatibilityMessage = error instanceof Error ? error.message : '发布技术包版本失败'
    }
    state.releaseDialogOpen = false
    return
  }
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

function closeReviewDetailDrawer(): void {
  state.reviewDetailDrawerOpen = false
  const pathname = appStore.getState().pathname
  const queryStart = pathname.indexOf('?')
  if (queryStart < 0) return

  const path = pathname.slice(0, queryStart)
  const queryAndHash = pathname.slice(queryStart + 1)
  const [queryText, hashText = ''] = queryAndHash.split('#')
  const params = new URLSearchParams(queryText)
  if (!params.has('reviewDetail')) return

  params.delete('reviewDetail')
  const nextQuery = params.toString()
  const nextPathname = `${path}${nextQuery ? `?${nextQuery}` : ''}${hashText ? `#${hashText}` : ''}`
  appStore.navigate(nextPathname, { historyMode: 'replace' })
}

export function handleTechPackEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-tech-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    if (isTechPackFieldReadOnly(fieldNode.dataset.techField || '')) return true
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
    } else if (state.versionLogDialogOpen) {
      state.versionLogDialogOpen = false
    } else if (state.reviewSubmitDialogOpen) {
      state.reviewSubmitDialogOpen = false
    } else if (state.reviewDetailDrawerOpen) {
      state.reviewDetailDrawerOpen = false
    } else if (state.reviewActionDialogOpen) {
      state.reviewActionDialogOpen = false
      state.reviewActionNodeKey = null
      state.reviewActionType = null
      state.reviewActionOpinion = ''
    } else if (state.reviewDiffDialogNodeKey) {
      state.reviewDiffDialogNodeKey = null
    } else if (state.reviewNotificationDialogNodeKey) {
      state.reviewNotificationDialogNodeKey = null
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

  if (action === 'open-pattern-image-preview') {
    openPatternImagePreviewModal({
      previewUrl: actionNode.dataset.techPatternPreviewUrl || '',
      title: actionNode.dataset.techPatternPreviewTitle || '纸样图预览',
      fileName: actionNode.dataset.techPatternPreviewFile || '',
    })
    return true
  }
  if (action === 'close-pattern-image-preview') {
    closePatternImagePreviewModal()
    return true
  }

  if (action === 'submit-review') {
    if (state.currentTechnicalVersionId) syncTechPackToStore()
    state.reviewSubmitDialogOpen = true
    state.compatibilityMessage = ''
    return true
  }
  if (action === 'close-review-submit') {
    state.reviewSubmitDialogOpen = false
    return true
  }
  if (action === 'confirm-submit-review') {
    if (!state.currentTechnicalVersionId) return true
    syncTechPackToStore()
    const designMessage = validateCurrentDesignRequirement('提交审核前请先补齐花型设计')
    if (designMessage) {
      state.compatibilityMessage = designMessage
      return true
    }
    const reviewers = getFixedTechPackReviewers({
      styleId: state.currentStyleId || '',
      technicalVersionId: state.currentTechnicalVersionId,
    })
    try {
      submitTechPackFirstStageReview(state.currentTechnicalVersionId, {
        buyerReviewerId: reviewers.buyerReviewer.reviewerId,
        patternMakerReviewerId: reviewers.patternMakerReviewer.reviewerId,
        merchandiserReviewerId: reviewers.merchandiserReviewer.reviewerId,
        operator: currentUser,
      })
      state.reviewSubmitDialogOpen = false
      state.compatibilityMessage = ''
    } catch (error) {
      state.compatibilityMessage = error instanceof Error ? error.message : '提交审核失败'
    }
    return true
  }
  if (action === 'open-review-detail-drawer') {
    state.reviewDetailDrawerOpen = true
    return true
  }
  if (action === 'close-review-detail-drawer') {
    closeReviewDetailDrawer()
    return true
  }
  if (action === 'start-review') {
    const nodeKey = actionNode.dataset.reviewNode as TechnicalReviewNodeKey | undefined
    if (!state.currentTechnicalVersionId || !nodeKey) return true
    state.reviewActionNodeKey = nodeKey
    state.reviewActionType = 'start'
    state.reviewActionOpinion = ''
    state.reviewActionDialogOpen = true
    state.compatibilityMessage = ''
    return true
  }
  if (action === 'approve-review') {
    const nodeKey = actionNode.dataset.reviewNode as TechnicalReviewNodeKey | undefined
    if (!state.currentTechnicalVersionId || !nodeKey) return true
    state.reviewActionNodeKey = nodeKey
    state.reviewActionType = 'approve'
    state.reviewActionOpinion = ''
    state.reviewActionDialogOpen = true
    state.compatibilityMessage = ''
    return true
  }
  if (action === 'reject-review') {
    const nodeKey = actionNode.dataset.reviewNode as TechnicalReviewNodeKey | undefined
    if (!state.currentTechnicalVersionId || !nodeKey) return true
    state.reviewActionNodeKey = nodeKey
    state.reviewActionType = 'reject'
    state.reviewActionOpinion = ''
    state.reviewActionDialogOpen = true
    state.compatibilityMessage = ''
    return true
  }
  if (action === 'return-review-first-stage') {
    if (!state.currentTechnicalVersionId) return true
    state.reviewActionNodeKey = 'MERCHANDISER'
    state.reviewActionType = 'return'
    state.reviewActionOpinion = ''
    state.reviewReturnModuleKeys = ['BOM', 'COST', 'PATTERN', 'MATERIAL_PATTERN_LINK', 'COLOR_MATERIAL_MAPPING', 'PROCESS', 'SIZE', 'DESIGN', 'QUALITY']
    state.reviewActionDialogOpen = true
    state.compatibilityMessage = ''
    return true
  }
  if (action === 'return-review-modules') {
    if (!state.currentTechnicalVersionId) return true
    state.reviewActionNodeKey = 'MERCHANDISER'
    state.reviewActionType = 'return-modules'
    state.reviewActionOpinion = ''
    state.reviewReturnModuleKeys = []
    state.reviewActionDialogOpen = true
    state.compatibilityMessage = ''
    return true
  }
  if (action === 'reopen-pending-publish-review') {
    if (!state.currentTechnicalVersionId) return true
    state.reviewActionNodeKey = 'MERCHANDISER'
    state.reviewActionType = 'reopen-role'
    state.reviewActionOpinion = ''
    state.reviewReopenNodeKeys = []
    state.reviewActionDialogOpen = true
    state.compatibilityMessage = ''
    return true
  }
  if (action === 'close-review-action') {
    state.reviewActionDialogOpen = false
    state.reviewActionNodeKey = null
    state.reviewActionType = null
    state.reviewActionOpinion = ''
    state.reviewReturnModuleKeys = []
    state.reviewReopenNodeKeys = []
    return true
  }
  if (action === 'confirm-review-action') {
    if (!state.currentTechnicalVersionId || !state.reviewActionNodeKey || !state.reviewActionType) return true
    try {
      if (state.reviewActionType === 'start') {
        startTechPackReview(state.currentTechnicalVersionId, state.reviewActionNodeKey, {
          operator: currentUser,
          opinion: state.reviewActionOpinion,
        })
      } else if (state.reviewActionType === 'approve') {
        if (state.reviewActionNodeKey === 'MERCHANDISER') {
          syncTechPackToStore()
          const designMessage = validateCurrentDesignRequirement('跟单无法审核通过')
          if (designMessage) {
            state.compatibilityMessage = designMessage
            return true
          }
        }
        approveTechPackReview(
          state.currentTechnicalVersionId,
          state.reviewActionNodeKey,
          state.reviewActionOpinion,
          currentUser,
        )
      } else if (state.reviewActionType === 'reject') {
        rejectTechPackReview(
          state.currentTechnicalVersionId,
          state.reviewActionNodeKey,
          state.reviewActionOpinion,
          currentUser,
        )
      } else if (state.reviewActionType === 'return-modules') {
        returnTechPackReviewByModules(
          state.currentTechnicalVersionId,
          state.reviewReturnModuleKeys,
          state.reviewActionOpinion,
          currentUser,
        )
      } else if (state.reviewActionType === 'reopen-role') {
        reopenTechPackReviewForRoles(
          state.currentTechnicalVersionId,
          state.reviewReopenNodeKeys,
          state.reviewActionOpinion,
          currentUser,
        )
      } else {
        returnTechPackReviewToFirstStage(
          state.currentTechnicalVersionId,
          state.reviewActionOpinion,
          currentUser,
        )
      }
      state.reviewActionDialogOpen = false
      state.reviewActionNodeKey = null
      state.reviewActionType = null
      state.reviewActionOpinion = ''
      state.reviewReturnModuleKeys = []
      state.reviewReopenNodeKeys = []
      state.compatibilityMessage = ''
    } catch (error) {
      state.compatibilityMessage = error instanceof Error ? error.message : '审核操作失败'
    }
    return true
  }
  if (action === 'open-review-diff') {
    const nodeKey = actionNode.dataset.reviewNode as TechnicalReviewNodeKey | undefined
    if (nodeKey) state.reviewDiffDialogNodeKey = nodeKey
    return true
  }
  if (action === 'close-review-diff') {
    state.reviewDiffDialogNodeKey = null
    return true
  }
  if (action === 'open-review-notifications') {
    const nodeKey = actionNode.dataset.reviewNode as TechnicalReviewNodeKey | undefined
    if (nodeKey) state.reviewNotificationDialogNodeKey = nodeKey
    return true
  }
  if (action === 'close-review-notifications') {
    state.reviewNotificationDialogNodeKey = null
    return true
  }
  if (action === 'open-version-logs') {
    state.versionLogDialogOpen = true
    return true
  }
  if (action === 'close-version-logs') {
    state.versionLogDialogOpen = false
    return true
  }

  if (isTechPackReadOnly()) {
    const isReadonlySafeAction =
      action.startsWith('close-') ||
      action === 'open-pattern-detail' ||
      action === 'open-pattern-image-preview' ||
      action === 'open-design-thumbnail-preview' ||
      action === 'preview-design-thumbnail' ||
      action === 'download-design-original-file'
    if (!isReadonlySafeAction) return true
  }

  const lockedModuleKey = getTechPackActionModuleKey(action, actionNode)
  if (lockedModuleKey && isTechPackModuleReadOnly(lockedModuleKey)) return true

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
    state.patternFormPurpose = 'ASSOCIATION'
    state.patternMaintenanceStep = 'MERCHANDISER'
    state.addPatternDialogOpen = true
    return true
  }
  if (action === 'open-add-pattern-package') {
    resetPatternForm()
    state.patternFormPurpose = 'PACKAGE'
    state.patternMaintenanceStep = 'PATTERN_MAKER'
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
    state.patternFormPurpose = pattern.recordKind === 'PACKAGE' ? 'PACKAGE' : 'ASSOCIATION'
    state.newPattern = buildPatternFormStateFromItem(pattern)
    state.patternMaintenanceStep = pattern.recordKind === 'PACKAGE' ? 'PATTERN_MAKER' : 'MERCHANDISER'
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
    updatePatternMaintainerStatuses('已完成')
    if (!savePatternFromTwoStep('已完成')) return true
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
  if (action === 'save-pattern-package') {
    const validationError = validatePatternPackage()
    if (validationError) {
      state.newPattern.parseError = validationError
      return true
    }
    state.newPattern.parseError = ''
    const finalStatus =
      state.newPattern.patternMaterialType === 'WOOL'
        ? '已解析待确认'
        : state.newPattern.patternMaterialType === 'WOVEN' && state.newPattern.parseStatus === 'PARSED'
        ? '已解析待确认'
        : '待解析'
    updatePatternMaintainerStatuses(finalStatus)
    if (!savePatternFromTwoStep(finalStatus)) return true
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
      action === 'save-pattern-and-parse' || state.newPattern.parseStatus === 'PARSED' || state.newPattern.patternMaterialType === 'WOOL'
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
      clearWoolFileState()
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
    if (state.newPattern.patternMaterialType !== 'WOOL') return true
    if (state.patternFormPurpose === 'PACKAGE') {
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
          colorPieceQuantities: [],
          totalPieceQty: 1,
          specialCrafts: [],
          sourceType: 'MANUAL',
        },
      ]
      refreshPatternPieceTotals()
      return true
    }
    const colorOptions = getPatternColorQuantityOptions(state.newPattern.linkedBomItemId)
    const colorPieceQuantities = colorOptions.length > 0
      ? colorOptions.map((option) => ({
          colorId: option.colorCode || option.colorName,
          colorName: option.colorName,
          enabled: false,
          pieceQty: 0,
          remark: '请维护颜色片数',
        }))
      : [
          {
            colorId: 'COMMON',
            colorName: '通用',
            enabled: true,
            pieceQty: 1,
            remark: '纸样包部位明细',
          },
        ]
    state.newPattern.pieceRows = [
      ...state.newPattern.pieceRows,
      {
        id: `piece-${Date.now()}`,
        name: '',
        count: colorOptions.length > 0 ? 0 : 1,
        note: '',
        isTemplate: false,
        applicableSkuCodes: [],
        colorAllocations: [],
        colorPieceQuantities,
        totalPieceQty: colorOptions.length > 0 ? 0 : 1,
        specialCrafts: [],
        sourceType: 'MANUAL',
      },
    ]
    refreshPatternPieceTotals()
    return true
  }
  if (action === 'delete-new-pattern-piece-row') {
    if (state.newPattern.patternMaterialType !== 'WOOL') return true
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
      frontPatternDesignId: getPrimaryBomPatternDesignId(bom, 'FRONT'),
      frontPatternDesignIds: getBomPatternDesignIds(bom, 'FRONT'),
      insidePatternDesignId: getPrimaryBomPatternDesignId(bom, 'INSIDE'),
      insidePatternDesignIds: getBomPatternDesignIds(bom, 'INSIDE'),
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
    const frontPatternDesignIds = getBomPatternDesignIds(state.newBomItem, 'FRONT')
    const insidePatternDesignIds = getBomPatternDesignIds(state.newBomItem, 'INSIDE')
    if (state.newBomItem.printRequirement !== '无' && !state.newBomItem.printSideMode) {
      window.alert('请选择单面印或双面印')
      return true
    }
    if (
      state.newBomItem.printRequirement !== '无'
      && state.newBomItem.printSideMode === 'SINGLE'
      && frontPatternDesignIds.length === 0
      && insidePatternDesignIds.length === 0
    ) {
      window.alert('请至少选择一个正面或里面花型')
      return true
    }
    if (
      state.newBomItem.printRequirement !== '无'
      && state.newBomItem.printSideMode === 'DOUBLE'
      && (frontPatternDesignIds.length === 0 || insidePatternDesignIds.length === 0)
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
          : frontPatternDesignIds[0] || '',
      frontPatternDesignIds:
        state.newBomItem.printRequirement === '无'
          ? []
          : frontPatternDesignIds,
      insidePatternDesignId:
        state.newBomItem.printRequirement === '无'
          ? ''
          : insidePatternDesignIds[0] || '',
      insidePatternDesignIds:
        state.newBomItem.printRequirement === '无'
          ? []
          : insidePatternDesignIds,
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
    markProcessRouteUnconfirmed()
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
      packagingRequired: Boolean(target.packagingRequired),
      ruleSource: target.ruleSource,
      assignmentGranularity: target.assignmentGranularity,
      detailSplitMode: target.detailSplitMode,
      detailSplitDimensions: [...target.detailSplitDimensions],
      outputValue: String(target.outputValue || ''),
      outputValueUnit: target.outputValueUnit,
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
  if (action === 'move-technique-route-up') {
    const techId = actionNode.dataset.techId
    if (!techId) return true
    moveTechniqueRoute(techId, 'up')
    return true
  }
  if (action === 'move-technique-route-down') {
    const techId = actionNode.dataset.techId
    if (!techId) return true
    moveTechniqueRoute(techId, 'down')
    return true
  }
  if (action === 'make-techniques-parallel') {
    const techId = actionNode.dataset.techId
    if (!techId) return true
    makeTechniqueParallel(
      techId,
      actionNode.dataset.routeDirection === 'previous' ? 'previous' : 'next',
    )
    return true
  }
  if (action === 'remove-technique-from-parallel') {
    const techId = actionNode.dataset.techId
    if (!techId) return true
    removeTechniqueFromParallel(techId)
    return true
  }
  if (action === 'toggle-parallel-group-acceptance') {
    const techId = actionNode.dataset.techId
    if (!techId) return true
    toggleParallelGroupAcceptance(techId)
    return true
  }
  if (action === 'confirm-process-route') {
    confirmProcessRoute()
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

    const routeUpdatedAt = toTimestamp()
    const routeFields = editingTarget
      ? {
          routeStepNo: editingTarget.routeStepNo,
          routeLaneNo: editingTarget.routeLaneNo,
          routeParallelGroupId: editingTarget.routeParallelGroupId,
          routeParallelGroupName: editingTarget.routeParallelGroupName,
          routeParallelAcceptanceMode: editingTarget.routeParallelAcceptanceMode,
          routeSourceKind: editingTarget.routeSourceKind,
          routeUpdatedBy: editingTarget.routeUpdatedBy,
          routeUpdatedAt: editingTarget.routeUpdatedAt,
        }
      : {
          routeStepNo: state.techniques.length + 1,
          routeLaneNo: 1,
          routeParallelGroupId: undefined,
          routeParallelGroupName: undefined,
          routeParallelAcceptanceMode: 'INDEPENDENT_ONLY' as const,
          routeSourceKind: 'MANUAL' as const,
          routeUpdatedBy: currentUser.name,
          routeUpdatedAt,
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
      targetObject: effectiveMeta.targetObject,
      targetObjectName: effectiveMeta.targetObjectName,
      woolTaskType: effectiveMeta.woolTaskType,
      downstreamTarget: effectiveMeta.downstreamTarget,
      requiresFeiTicket: effectiveMeta.requiresFeiTicket,
      packagingRequired: effectiveMeta.packagingRequired,
      materialIssueMode: effectiveMeta.materialIssueMode,
      linkedBomItemIds: effectiveMeta.linkedBomItemIds ? [...effectiveMeta.linkedBomItemIds] : undefined,
      linkedPatternIds: effectiveMeta.linkedPatternIds ? [...effectiveMeta.linkedPatternIds] : undefined,
      supportedTargetObjects: effectiveMeta.supportedTargetObjects ? [...effectiveMeta.supportedTargetObjects] : undefined,
      supportedTargetObjectLabels: effectiveMeta.supportedTargetObjectLabels ? [...effectiveMeta.supportedTargetObjectLabels] : undefined,
      triggerSource: effectiveMeta.triggerSource,
      outputValue: Number.parseFloat(state.newTechnique.outputValue) || 0,
      outputValueUnit: state.newTechnique.outputValueUnit,
      difficulty: state.newTechnique.difficulty,
      remark: state.newTechnique.remark,
      source: '字典引用',
      ...routeFields,
    }

    if (state.editTechniqueId) {
      state.techniques = state.techniques.map((item) =>
        item.id === state.editTechniqueId ? nextItem : item,
      )
    } else {
      state.techniques = [...state.techniques, nextItem]
    }

    syncProcessCostRows()
    markProcessRouteUnconfirmed()
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
    markProcessRouteUnconfirmed()
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
    if (!state.techPack || !state.newDesignName.trim() || state.newDesignFiles.length === 0) return true
    const notReady = state.newDesignFiles.some((file) => file.processing || !file.originalFileDataUrl.trim())
    if (notReady) {
      window.alert('设计稿文件处理中，请稍后再保存')
      return true
    }

    const baseName = state.newDesignName.trim()
    const uploadedAt = toTimestamp()
    const now = Date.now()
    const newPatternDesigns = state.newDesignFiles.map((file, index) => {
      const designName = state.newDesignFiles.length === 1 ? baseName : `${baseName}-${index + 1}`
      const previewThumbnailDataUrl =
        file.previewThumbnailDataUrl
        || buildDesignPlaceholderImage(file.fileName, state.newDesignSideType)

      return {
        id: `design-${now}-${index + 1}`,
        name: designName,
        imageUrl: previewThumbnailDataUrl,
        designSideType: state.newDesignSideType,
        fileName: file.fileName,
        originalFileName: file.fileName,
        originalFileMimeType: file.mimeType || undefined,
        originalFileDataUrl: file.originalFileDataUrl,
        previewThumbnailDataUrl,
        uploadedAt,
      }
    })

    state.techPack = {
      ...state.techPack,
      patternDesigns: [
        ...state.techPack.patternDesigns,
        ...newPatternDesigns,
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
      (item) =>
        getBomPatternDesignIds(item, 'FRONT').includes(designId)
        || getBomPatternDesignIds(item, 'INSIDE').includes(designId),
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

  if (action === 'close-dialog') {
    closeAllDialogs()
    return true
  }

  if (action === 'noop') {
    return true
  }

  return false
}

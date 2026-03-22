import { appStore } from '../../state/store'
import {
  closeAllDialogs,
  copySystemDraftToManual,
  createEmptyMappingLine,
  currentUser,
  dedupeStrings,
  getBaselineProcessByCode,
  getCraftOptionByCode,
  getPatternById,
  getPatternPieceById,
  getSelectedDraftMeta,
  getSkuOptionsForCurrentSpu,
  normalizePatternPieceRows,
  resetAttachmentForm,
  resetBomForm,
  resetColorMappingToSystemSuggestion,
  resetPatternForm,
  resetSizeForm,
  resetTechniqueForm,
  state,
  syncMaterialCostRows,
  syncProcessCostRows,
  syncTechPackToStore,
  toTimestamp,
  touchMappingAsManual,
  updateColorMapping,
  updateColorMappingLine,
} from './context'
import type {
  TechPackAssignmentGranularity,
  TechPackDetailSplitDimension,
  TechPackSizeRow,
  TechPackTab,
  TechniqueItem,
} from './context'

function getTechniqueById(techId: string): TechniqueItem | null {
  return state.techniques.find((item) => item.id === techId) ?? null
}

function updateTechnique(techId: string, updater: (item: TechniqueItem) => TechniqueItem): void {
  state.techniques = state.techniques.map((item) => (item.id === techId ? updater(item) : item))
  syncProcessCostRows()
  syncTechPackToStore()
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
  if (field === 'new-pattern-type') {
    state.newPattern.type = value
    return true
  }
  if (field === 'new-pattern-image') {
    state.newPattern.image = value
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
  if (field === 'new-pattern-linked-bom-item') {
    state.newPattern.linkedBomItemId = value
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
    const pieceId = node.dataset.pieceId
    if (!pieceId) return true
    state.newPattern.pieceRows = state.newPattern.pieceRows.map((row) =>
      row.id === pieceId ? { ...row, name: value } : row,
    )
    return true
  }
  if (field === 'new-pattern-piece-count') {
    const pieceId = node.dataset.pieceId
    if (!pieceId) return true
    state.newPattern.pieceRows = state.newPattern.pieceRows.map((row) =>
      row.id === pieceId ? { ...row, count: Number.parseInt(value, 10) || 0 } : row,
    )
    return true
  }
  if (field === 'new-pattern-piece-note') {
    const pieceId = node.dataset.pieceId
    if (!pieceId) return true
    state.newPattern.pieceRows = state.newPattern.pieceRows.map((row) =>
      row.id === pieceId ? { ...row, note: value } : row,
    )
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
    state.newBomItem.printRequirement = value
    return true
  }
  if (field === 'new-bom-dye-requirement') {
    state.newBomItem.dyeRequirement = value
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
    const option = getCraftOptionByCode(value)
    const forceOverride = Boolean(option?.isSpecialCraft)
    state.newTechnique = {
      ...state.newTechnique,
      craftCode: value,
      ruleSource: forceOverride ? 'OVERRIDE_CRAFT' : option?.ruleSource ?? 'INHERIT_PROCESS',
      assignmentGranularity: option?.assignmentGranularity ?? state.newTechnique.assignmentGranularity,
      detailSplitMode: option?.detailSplitMode ?? 'COMPOSITE',
      detailSplitDimensions: [...(option?.detailSplitDimensions ?? ['PATTERN', 'MATERIAL_SKU'])],
      standardTime: option ? String(state.newTechnique.standardTime || '') : state.newTechnique.standardTime,
      difficulty:
        option && option.isSpecialCraft ? '困难' : option ? '中等' : state.newTechnique.difficulty,
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
      item.id === bomId ? { ...item, printRequirement: value } : item,
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

  if (field === 'new-design-name') {
    state.newDesignName = value
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

  const currentVersionNum =
    state.techPack.versionLabel === 'beta'
      ? 0
      : Number.parseInt(state.techPack.versionLabel.replace('v', '').split('.')[0] || '0', 10) || 0

  state.techPack = {
    ...state.techPack,
    status: 'RELEASED',
    versionLabel: `v${currentVersionNum + 1}.0`,
    lastUpdatedAt: toTimestamp(),
    lastUpdatedBy: currentUser.name,
  }

  syncTechPackToStore({ touch: false })
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
    if (state.currentSpuCode) {
      appStore.closeTab(`tech-pack-${state.currentSpuCode}`)
      return true
    }

    appStore.navigate('/fcs/production/demand-inbox')
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
    return true
  }
  if (action === 'edit-pattern') {
    const patternId = actionNode.dataset.patternId
    if (!patternId) return true

    const pattern = state.patternItems.find((item) => item.id === patternId)
    if (!pattern) return true

    state.editPatternItemId = pattern.id
    state.newPattern = {
      name: pattern.name,
      type: pattern.type,
      image: pattern.image,
      file: pattern.file,
      remark: pattern.remark,
      linkedBomItemId: pattern.linkedBomItemId,
      widthCm: pattern.widthCm,
      markerLengthM: pattern.markerLengthM,
      totalPieceCount: pattern.totalPieceCount,
      pieceRows: pattern.pieceRows.map((row) => ({ ...row })),
    }
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
    if (!state.newPattern.name.trim()) return true
    const nowId = state.editPatternItemId || `PAT-${Date.now()}`
    const normalizedPieceRows = normalizePatternPieceRows(
      state.newPattern.pieceRows.map((row) => ({ ...row })),
      nowId,
    )

    if (state.editPatternItemId) {
      state.patternItems = state.patternItems.map((item) =>
        item.id === state.editPatternItemId
          ? {
              ...item,
              ...state.newPattern,
              pieceRows: normalizedPieceRows,
            }
          : item,
      )
    } else {
      state.patternItems = [
        ...state.patternItems,
        {
          id: nowId,
          ...state.newPattern,
          pieceRows: normalizedPieceRows,
        },
      ]
    }

    syncTechPackToStore()
    state.addPatternDialogOpen = false
    return true
  }
  if (action === 'add-new-pattern-piece-row') {
    state.newPattern.pieceRows = [
      ...state.newPattern.pieceRows,
      {
        id: `piece-${Date.now()}`,
        name: '',
        count: 1,
        note: '',
        applicableSkuCodes: [],
      },
    ]
    return true
  }
  if (action === 'delete-new-pattern-piece-row') {
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
    resetTechniqueForm()
    state.addTechniqueDialogOpen = true
    return true
  }
  if (action === 'edit-technique') {
    const techId = actionNode.dataset.techId
    if (!techId) return true
    const target = getTechniqueById(techId)
    if (!target) return true
    state.editTechniqueId = target.id
    state.newTechnique = {
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

    const nextItem: TechniqueItem = {
      id: state.editTechniqueId || `tech-${Date.now()}`,
      entryType: selectedMeta.entryType,
      stageCode: selectedMeta.stageCode,
      stage: selectedMeta.stageName,
      processCode: selectedMeta.processCode,
      process: selectedMeta.processName,
      craftCode: selectedMeta.craftCode,
      technique: selectedMeta.craftName,
      assignmentGranularity: selectedMeta.assignmentGranularity,
      ruleSource: selectedMeta.ruleSource,
      detailSplitMode: selectedMeta.detailSplitMode,
      detailSplitDimensions: [...selectedMeta.detailSplitDimensions],
      defaultDocType: selectedMeta.defaultDocType,
      taskTypeMode: selectedMeta.taskTypeMode,
      isSpecialCraft: selectedMeta.isSpecialCraft,
      triggerSource: selectedMeta.triggerSource,
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

  if (action === 'open-add-design') {
    state.newDesignName = ''
    state.addDesignDialogOpen = true
    return true
  }
  if (action === 'close-add-design') {
    state.addDesignDialogOpen = false
    return true
  }
  if (action === 'save-design') {
    if (!state.techPack || !state.newDesignName.trim()) return true

    state.techPack = {
      ...state.techPack,
      patternDesigns: [
        ...state.techPack.patternDesigns,
        {
          id: `design-${Date.now()}`,
          name: state.newDesignName,
          imageUrl: '/placeholder.svg',
        },
      ],
    }

    syncTechPackToStore()
    state.addDesignDialogOpen = false
    return true
  }
  if (action === 'delete-design') {
    const designId = actionNode.dataset.designId
    if (!state.techPack || !designId) return true

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


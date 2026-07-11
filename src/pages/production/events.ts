import {
  state,
  currentUser,
  closeAllProductionDialogs,
  showPlanMessage,
  toTimestamp,
  nextLocalEntityId,
  type ProductionDemand,
  type ProductionOrder,
  type ProductionOrderStatus,
  type ProductionState,
  type FactoryTier,
  type FactoryType,
  type DemandOwnerPartyType,
  type AssignmentModeFilter,
  type BiddingRiskFilter,
  type OrderViewMode,
  type OrderDetailTab,
  type MaterialMode,
  type AuditLog,
  productionOrderStatusConfig,
  getFilteredDemands,
  getPaginatedDemands,
  listOrdersFromDemandGeneratableDemands,
  getFilteredOrders,
  getPaginatedOrders,
  getOrderById,
  getOrderTaskBreakdownDisabledReason,
  openTaskGenerationPreview,
  closeTaskGenerationPreview,
  confirmTaskGenerationPreview,
  openAppRoute,
  indonesiaFactories,
  PAGE_SIZE,
  TECH_PACK_VERSION_CHANGE_EMPTY_FORM,
  PRODUCTION_PATCH_EMPTY_FORM,
  createProductionChangeForm,
  addMaterialToDraft,
  restoreMaterialDraftSuggestion,
  confirmMaterialRequestDraft,
  setMaterialDraftNeedMaterial,
  toggleMaterialDraftLine,
  setMaterialDraftMode,
  setMaterialDraftRemark,
  setMaterialDraftLineConfirmedQty,
} from './context'
import { getDemandCurrentTechPackInfo } from '../../data/fcs/production-tech-pack-snapshot-builder.ts'
import {
  openDemandBatchGenerate,
  openDemandMergeGenerate,
  openDemandSingleGenerate,
  openOrdersFromDemandGenerateDialog,
  performDemandGenerate,
  performOrdersFromDemandGenerate,
} from './demand-domain'
import {
  getProductionOrderTechPackRelation,
  getProductionOrderChangeOrder,
  listSelectableTechPackVersionsByOrder,
  listProductionOrderChangeOrdersByProductionOrder,
  getLatestPendingProductionTechPackPublishEvaluationBatch,
  ignoreProductionTechPackPublishEvaluationBatch,
  markProductionTechPackPublishEvaluationEntered,
  markProductionTechPackPublishEvaluationTodo,
  productionPatchTypeModuleMap,
  submitProductionOrderPatch,
  submitProductionOrderTechPackChange,
  voidProductionOrderPatch,
  type ChangeEffectiveMode,
  type PatchEffectivePoint,
  type ProductionPatchType,
} from '../../data/fcs/production-tech-pack-change-domain'
import {
  areMaterialSelectionsEquivalent,
  buildMaterialReplacementAllocations,
  createFollowingOrderPlans,
  createQuantityLinesForOrder,
  executeProductionChange,
  getProductionChangeDecisionSuggestedValue,
  listReplacementMaterialOptions,
  normalizeMaterialReplacementAllocations,
  validateProductionChangeDecisions,
} from '../../data/fcs/production-order-change-workflow.ts'
import {
  buildProductionChangePreviewForForm,
  createProductionChangeEditForm,
  listCurrentMaterialOptionsForOrder,
} from './production-change-form.ts'
import {
  handleProductionPreparationTimingEvent,
  handleProductionPreparationTimingSubmit,
} from './preparation-timing'

function isProductionPreparationTimingPath(): boolean {
  return typeof window !== 'undefined' && window.location.pathname === '/fcs/production/preparation-timing'
}

function getDefaultTechPackChangeTargetVersionId(productionOrderId: string): string {
  const relation = getProductionOrderTechPackRelation(productionOrderId)
  const options = listSelectableTechPackVersionsByOrder(productionOrderId)
  return (
    options.find((item) => item.versionId === relation?.latestPublishedTechPackVersionId)?.versionId ||
    options[0]?.versionId ||
    ''
  )
}

function getDefaultProductionPatchEffectivePoint(patchType: string): string {
  if (patchType === 'COSTING_OVERRIDE') return 'SETTLEMENT_ONLY'
  if (patchType === 'PATTERN_OVERRIDE') return 'FROM_NEXT_MARKER_PLAN'
  if (patchType === 'PROCESS_OVERRIDE') return 'FROM_NEXT_AUX_PROCESS'
  if (patchType === 'ARTWORK_OVERRIDE') return 'FROM_NEXT_PRINTING'
  if (patchType === 'MATERIAL_REPLACEMENT' || patchType === 'MATERIAL_USAGE_ADJUSTMENT' || patchType === 'COLOR_MATERIAL_MAPPING_OVERRIDE') return 'FROM_NEXT_PICKUP'
  return 'FROM_NOW'
}

function buildProductionPatchScopeText(): string {
  const form = state.productionPatchForm
  return [
    form.color && `颜色：${form.color}`,
    form.size && `尺码：${form.size}`,
    form.material && `物料：${form.material}`,
    form.part && `部位：${form.part}`,
    form.processNode && `工序节点：${form.processNode}`,
    form.factory && `工厂：${form.factory}`,
    form.cutOrder && `裁片单：${form.cutOrder}`,
    form.markerPlan && `唛架方案：${form.markerPlan}`,
    form.spreadingOrder && `铺布单：${form.spreadingOrder}`,
    form.processOrder && `工艺单：${form.processOrder}`,
  ].filter(Boolean).join(' / ')
}

function buildProductionPatchContentText(): string {
  const form = state.productionPatchForm
  const type = form.patchType as ProductionPatchType
  const lines: string[] = []
  if (type === 'MATERIAL_REPLACEMENT') {
    lines.push(`原物料：${form.material || '未选择'}${form.color ? ` / ${form.color}` : ''}`)
    lines.push(`替代物料：${form.targetMaterial || '未选择'}${form.targetColor ? ` / ${form.targetColor}` : ''}`)
  } else if (type === 'MATERIAL_USAGE_ADJUSTMENT') {
    lines.push(`物料：${form.material || '未选择'}${form.color ? ` / ${form.color}` : ''}`)
    lines.push(`用量：${form.usageValue || '未选择'} → ${form.targetUsageValue || '未选择'}`)
  } else if (type === 'PATTERN_OVERRIDE') {
    lines.push(`纸样文件：${form.patternFile || '未选择'} → ${form.targetPatternFile || '未选择'}`)
    lines.push(`影响部位：${form.part || '未选择'}${form.size ? ` / 尺码 ${form.size}` : ''}`)
  } else if (type === 'PROCESS_OVERRIDE') {
    lines.push(`工序：${form.processFrom || form.processNode || '未选择'} → ${form.processTo || '未选择'}`)
    lines.push(`承接工厂：${form.factory || '未指定'}`)
  } else if (type === 'SIZE_RULE_OVERRIDE') {
    lines.push(`放码规则：${form.sizeRule || '未选择'} → ${form.targetSizeRule || '未选择'}`)
    lines.push(`影响尺码：${form.size || '未指定'}${form.part ? ` / 部位 ${form.part}` : ''}`)
  } else if (type === 'COLOR_MATERIAL_MAPPING_OVERRIDE') {
    lines.push(`款色用料：${form.colorMaterialMapping || form.material || '未选择'} → ${form.targetColorMaterialMapping || form.targetMaterial || '未选择'}`)
    lines.push(`影响颜色：${form.color || '未指定'}`)
  } else if (type === 'COSTING_OVERRIDE') {
    lines.push(`核价项：${form.costItem || '未选择'} → ${form.targetCostValue || '未填写'}`)
  } else if (type === 'ARTWORK_OVERRIDE') {
    lines.push(`花型：${form.artworkFile || '未选择'} → ${form.targetArtworkFile || '未选择'}`)
    lines.push(`影响颜色 / 部位：${[form.color, form.part].filter(Boolean).join(' / ') || '未指定'}`)
  }
  if (form.contentText.trim()) lines.push(`补充说明：${form.contentText.trim()}`)
  return lines.filter((line) => !line.includes('未选择') || form.patchType === 'OTHER_PRODUCTION_OVERRIDE').join('；')
}

function validateProductionPatchForm(): string {
  const form = state.productionPatchForm
  const type = form.patchType as ProductionPatchType
  if (!form.reason.trim()) return '请填写补丁原因。'

  const missing: string[] = []
  const requireField = (value: string, label: string): void => {
    if (!value.trim()) missing.push(label)
  }

  if (type === 'MATERIAL_REPLACEMENT') {
    requireField(form.material, '原物料 SKU')
    requireField(form.color, '原物料颜色')
    requireField(form.targetMaterial, '替代物料 SKU')
    requireField(form.targetColor, '替代物料颜色')
    requireField(form.contentText, '替代原因')
  } else if (type === 'MATERIAL_USAGE_ADJUSTMENT') {
    requireField(form.material, '物料 SKU')
    requireField(form.usageValue, '原用量')
    requireField(form.targetUsageValue, '新用量')
    requireField(form.contentText, '调整原因')
  } else if (type === 'PATTERN_OVERRIDE') {
    requireField(form.patternFile, '原纸样文件')
    requireField(form.targetPatternFile, '新纸样文件')
    requireField(form.part, '影响部位')
  } else if (type === 'PROCESS_OVERRIDE') {
    requireField(form.processFrom, '原工序 / 原流向')
    requireField(form.processTo, '新工序 / 新流向')
    requireField(form.processNode, '生效工序节点')
  } else if (type === 'SIZE_RULE_OVERRIDE') {
    requireField(form.sizeRule, '原放码规则')
    requireField(form.targetSizeRule, '新放码规则')
    requireField(form.part, '影响部位')
  } else if (type === 'COLOR_MATERIAL_MAPPING_OVERRIDE') {
    requireField(form.colorMaterialMapping, '原款色用料对应')
    requireField(form.targetColorMaterialMapping, '新款色用料对应')
    requireField(form.color, '影响颜色')
  } else if (type === 'COSTING_OVERRIDE') {
    requireField(form.costItem, '原核价项')
    requireField(form.targetCostValue, '新核价值')
    requireField(form.contentText, '调整原因')
  } else if (type === 'ARTWORK_OVERRIDE') {
    requireField(form.artworkFile, '原花型文件')
    requireField(form.targetArtworkFile, '新花型文件')
    requireField(form.part, '花型位置')
  } else {
    requireField(form.contentText, '补丁内容')
  }

  if (missing.length > 0) return `请先完善：${missing.join('、')}。`
  if (!buildProductionPatchScopeText().trim()) return '请至少明确一个补丁影响范围。'
  if (!buildProductionPatchContentText().trim()) return '补丁内容不能为空。'
  return ''
}

type ProductionChangeForm = typeof state.productionChangeForm
type ProductionChangeFormStep = typeof state.productionChangeFormStep

export function createInitializedProductionChangeForm(
  productionOrderId: string,
  changeType: ProductionChangeForm['changeType'],
): ProductionChangeForm {
  const form = createProductionChangeForm()
  const normalizedOrderId = productionOrderId.trim()
  form.productionOrderId = normalizedOrderId
  form.changeType = changeType
  if (!normalizedOrderId) return form

  form.quantityLines = createQuantityLinesForOrder(normalizedOrderId)
  const initialAllocations = buildMaterialReplacementAllocations(normalizedOrderId, 0)
  const suggestedProductionQty = initialAllocations.reduce(
    (sum, line) => sum + line.suggestedReplacementQty,
    0,
  )
  const normalized = normalizeMaterialReplacementAllocations(
    normalizedOrderId,
    [],
    suggestedProductionQty,
  )
  form.materialReplacement = {
    ...form.materialReplacement,
    originalMaterialId: listCurrentMaterialOptionsForOrder(normalizedOrderId)[0]?.value ?? '',
    suggestedProductionQty,
    confirmedProductionQty: normalized.confirmedProductionQty,
    allocations: normalized.allocations,
    followingOrders: createFollowingOrderPlans(normalizedOrderId),
  }
  return form
}

export function createProductionChangeFormFromRecord(
  order: NonNullable<ReturnType<typeof getProductionOrderChangeOrder>>,
): ProductionChangeForm {
  const form = createProductionChangeEditForm(order)
  form.decisionValues = {}
  form.execution = createProductionChangeForm().execution
  form.advancedAllocationOpen = false
  return form
}

export function validateProductionChangeFormStep(
  step: ProductionChangeFormStep,
  form: ProductionChangeForm,
): string {
  if (step === 'order') {
    if (!form.productionOrderId.trim() || createQuantityLinesForOrder(form.productionOrderId).length === 0) {
      return '请选择有效生产单。'
    }
    return ''
  }

  if (step === 'content') {
    if (form.changeType === 'QUANTITY_CHANGE') {
      if (
        form.quantityLines.some(
          (line) => !Number.isInteger(line.targetQty) || line.targetQty < 0,
        )
      ) {
        return '变更后数量必须为非负整数。'
      }
      if (
        form.quantityLines.some(
          (line) => line.isNew && line.targetQty > 0 && (!line.skuCode.trim() || !line.color.trim() || !line.size.trim()),
        )
      ) {
        return '新增明细数量大于 0 时，请填写商品编码、颜色和尺码。'
      }
      if (!form.quantityLines.some((line) => line.targetQty !== line.currentQty || (line.isNew && line.targetQty > 0))) {
        return '数量内容未发生变化，请至少调整一条需求明细。'
      }
      if (!form.reason.trim()) return '请填写数量变更原因。'
      return ''
    }

    const replacement = form.materialReplacement
    if (!replacement.originalMaterialId || !replacement.replacementMaterialId) {
      return '请选择原面料和新面料。'
    }
    if (
      areMaterialSelectionsEquivalent(
        replacement.originalMaterialId,
        listCurrentMaterialOptionsForOrder(form.productionOrderId),
        replacement.replacementMaterialId,
        listReplacementMaterialOptions(),
      )
    ) {
      return '新面料不能与原面料相同。'
    }
    if (!Number.isInteger(replacement.confirmedProductionQty) || replacement.confirmedProductionQty <= 0) {
      return '确认生产件数必须为正整数。'
    }
    const totalDemandQty = replacement.allocations.reduce((sum, line) => sum + line.demandQty, 0)
    if (replacement.confirmedProductionQty > totalDemandQty) {
      return `确认生产件数不能超过当前需求总数 ${totalDemandQty} 件。`
    }
    if (
      replacement.allocations.some(
        (line) =>
          !Number.isInteger(line.confirmedReplacementQty) ||
          line.confirmedReplacementQty < 0 ||
          line.confirmedReplacementQty > line.demandQty,
      )
    ) {
      return '颜色尺码分配必须为非负整数，且不能超过对应需求数量。'
    }
    const allocationTotal = replacement.allocations.reduce(
      (sum, line) => sum + line.confirmedReplacementQty,
      0,
    )
    if (allocationTotal !== replacement.confirmedProductionQty) {
      return '分配合计必须等于确认生产件数。'
    }
    if (!form.reason.trim()) return '请填写物料替换原因。'
    return ''
  }

  if (step === 'handling') {
    const missingDecisionIds = validateProductionChangeDecisions(buildProductionChangePreviewForForm(form))
    return missingDecisionIds.length > 0
      ? `请先完成 ${missingDecisionIds.length} 项待跟单判断。`
      : ''
  }

  return ''
}

function setProductionChangeType(changeType: ProductionChangeForm['changeType']): void {
  state.productionChangeForm = createInitializedProductionChangeForm(
    state.productionChangeForm.productionOrderId,
    changeType,
  )
  state.productionChangeFormError = ''
}

function resetProductionChangeDerivedState(): void {
  resetProductionChangeFormDerivedState(state.productionChangeForm)
}

function resetProductionChangeFormDerivedState(form: ProductionChangeForm): void {
  form.decisionValues = {}
  form.execution = createProductionChangeForm().execution
}

function rebuildProductionChangeMaterialPlan(): void {
  const form = state.productionChangeForm
  const replacement = form.materialReplacement
  const baseAllocations = buildMaterialReplacementAllocations(form.productionOrderId, 0)
  const totalDemandQty = baseAllocations.reduce((sum, line) => sum + line.demandQty, 0)
  const suggestedProductionQty = replacement.replacementMode === 'FULL'
    ? totalDemandQty
    : baseAllocations.reduce((sum, line) => sum + line.suggestedReplacementQty, 0)
  const normalized = normalizeMaterialReplacementAllocations(
    form.productionOrderId,
    [],
    suggestedProductionQty,
  )
  form.materialReplacement = {
    ...replacement,
    suggestedProductionQty,
    confirmedProductionQty: normalized.confirmedProductionQty,
    allocations: normalized.allocations,
    followingOrders: createFollowingOrderPlans(form.productionOrderId),
  }
  resetProductionChangeDerivedState()
  state.productionChangeFormError = ''
}

function escapeProductionChangeSelectorValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function getProductionChangeDomRoot(node: HTMLElement): ParentNode | null {
  return node.closest<HTMLElement>('[data-production-change-form-body]') ??
    (typeof document === 'undefined' ? null : document)
}

function patchProductionChangeFormErrorDom(node: HTMLElement): void {
  const errorNode = getProductionChangeDomRoot(node)?.querySelector<HTMLElement>(
    '[data-production-change-form-error]',
  )
  if (!errorNode) return
  errorNode.textContent = state.productionChangeFormError
  errorNode.hidden = state.productionChangeFormError.length === 0
}

export function patchProductionChangeQuantityDom(node: HTMLElement, lineId: string): void {
  const root = getProductionChangeDomRoot(node)
  const line = state.productionChangeForm.quantityLines.find((item) => item.id === lineId)
  if (!root || !line) return
  const escapedLineId = escapeProductionChangeSelectorValue(lineId)
  const row = root.querySelector<HTMLElement>(
    `[data-production-change-quantity-row][data-line-id="${escapedLineId}"]`,
  )
  const difference = line.targetQty - line.currentQty
  const deltaText = difference === 0
    ? '不变'
    : difference > 0
      ? `增加 ${difference} 件`
      : `减少 ${Math.abs(difference)} 件`
  const deltaNode = row?.querySelector<HTMLElement>(
    `[data-production-change-quantity-delta][data-line-id="${escapedLineId}"]`,
  )
  const statusNode = row?.querySelector<HTMLElement>(
    `[data-production-change-quantity-status][data-line-id="${escapedLineId}"]`,
  )
  if (deltaNode) deltaNode.textContent = deltaText
  if (statusNode) statusNode.textContent = line.targetQty === 0 ? '已取消' : line.isNew ? '新增' : '保留'

  const targetTotalNode = root.querySelector<HTMLElement>('[data-production-change-quantity-target-total]')
  if (targetTotalNode) {
    const targetTotal = state.productionChangeForm.quantityLines.reduce((sum, item) => sum + item.targetQty, 0)
    targetTotalNode.textContent = `${targetTotal} 件`
  }
  patchProductionChangeFormErrorDom(node)
}

export function patchProductionChangeAllocationDom(
  node: HTMLElement,
  syncAllocationInputs = false,
): void {
  const root = getProductionChangeDomRoot(node)
  if (!root) return
  const replacement = state.productionChangeForm.materialReplacement
  const allocationTotal = replacement.allocations.reduce(
    (sum, line) => sum + line.confirmedReplacementQty,
    0,
  )
  const summaryNode = root.querySelector<HTMLElement>('[data-production-change-allocation-summary]')
  if (summaryNode) {
    summaryNode.textContent = `分配合计 ${allocationTotal} 件 / 确认 ${replacement.confirmedProductionQty} 件`
  }

  if (syncAllocationInputs) {
    replacement.allocations.forEach((line) => {
      const escapedAllocationId = escapeProductionChangeSelectorValue(line.id)
      const input = root.querySelector<HTMLInputElement>(
        `[data-prod-field="productionChangeAllocationQty"][data-allocation-id="${escapedAllocationId}"]`,
      )
      if (input) input.value = String(line.confirmedReplacementQty)
    })
  }

  const invalidAllocation = replacement.allocations.find(
    (line) =>
      !Number.isInteger(line.confirmedReplacementQty) ||
      line.confirmedReplacementQty < 0 ||
      line.confirmedReplacementQty > line.demandQty,
  )
  const errorText = invalidAllocation
    ? `${invalidAllocation.color} ${invalidAllocation.size} 的分配数量必须为非负整数，且不能超过 ${invalidAllocation.demandQty} 件。`
    : allocationTotal !== replacement.confirmedProductionQty
      ? `分配合计需等于确认生产件数，还差 ${replacement.confirmedProductionQty - allocationTotal} 件。`
      : ''
  const errorNode = root.querySelector<HTMLElement>('[data-production-change-allocation-error]')
  if (errorNode) errorNode.textContent = errorText
  patchProductionChangeFormErrorDom(node)
}

export function transitionProductionChangeStep(
  currentStep: ProductionChangeFormStep,
  targetStep: ProductionChangeFormStep,
  form: ProductionChangeForm,
): { step: ProductionChangeFormStep; error: string } {
  const steps: ProductionChangeFormStep[] = ['order', 'content', 'handling', 'execution']
  const currentIndex = Math.max(0, steps.indexOf(currentStep))
  const targetIndex = steps.indexOf(targetStep)
  if (targetIndex < 0) return { step: currentStep, error: '' }
  if (targetIndex <= currentIndex) {
    return { step: targetStep, error: '' }
  }

  for (let index = currentIndex; index < targetIndex; index += 1) {
    const step = steps[index]
    const error = validateProductionChangeFormStep(step, form)
    if (error) {
      return { step, error }
    }
  }
  return { step: targetStep, error: '' }
}

function moveProductionChangeFormToStep(targetStep: ProductionChangeFormStep): void {
  const result = transitionProductionChangeStep(
    state.productionChangeFormStep,
    targetStep,
    state.productionChangeForm,
  )
  state.productionChangeFormStep = result.step
  state.productionChangeFormError = result.error
}

export function executeProductionChangeForForm(
  form: ProductionChangeForm,
  options: { shouldFail?: boolean } = {},
): { executed: boolean; step: ProductionChangeFormStep; error: string } {
  if (form.execution.status === 'RUNNING' || form.execution.status === 'DONE') {
    return { executed: false, step: 'execution', error: '' }
  }

  const preview = buildProductionChangePreviewForForm(form)
  const missingDecisionIds = validateProductionChangeDecisions(preview)
  if (missingDecisionIds.length > 0) {
    return {
      executed: false,
      step: 'handling',
      error: `请先完成 ${missingDecisionIds.length} 项待跟单判断。`,
    }
  }

  form.execution = {
    status: 'RUNNING',
    message: '',
    progress: 0,
    steps: [],
  }
  form.execution = executeProductionChange(preview, options)
  return { executed: true, step: 'execution', error: '' }
}

interface ProductionChangeFieldMeta {
  lineId?: string
  allocationId?: string
  decisionId?: string
}

interface ProductionChangeFieldResult {
  handled: boolean
  normalizedValue?: string
  syncAllocationInputs?: boolean
}

export function applyProductionChangeFieldValue(
  form: ProductionChangeForm,
  field: string,
  value: string,
  meta: ProductionChangeFieldMeta = {},
): ProductionChangeFieldResult {
  if (field === 'productionChangeReason') {
    form.reason = value
    resetProductionChangeFormDerivedState(form)
    return { handled: true }
  }

  if (
    field === 'productionChangeQuantityTargetQty' ||
    field === 'productionChangeQuantitySkuCode' ||
    field === 'productionChangeQuantityColor' ||
    field === 'productionChangeQuantitySize'
  ) {
    const line = form.quantityLines.find((item) => item.id === meta.lineId)
    if (!line) return { handled: true }
    if (field === 'productionChangeQuantityTargetQty') {
      const qty = Number(value)
      line.targetQty = Number.isFinite(qty) ? qty : 0
    } else if (line.isNew) {
      const fieldMap = {
        productionChangeQuantitySkuCode: 'skuCode',
        productionChangeQuantityColor: 'color',
        productionChangeQuantitySize: 'size',
      } as const
      line[fieldMap[field]] = value
    }
    resetProductionChangeFormDerivedState(form)
    return { handled: true }
  }

  if (field === 'productionChangeOriginalMaterialId') {
    form.materialReplacement.originalMaterialId = value
    resetProductionChangeFormDerivedState(form)
    return { handled: true }
  }

  if (field === 'productionChangeReplacementMaterialId') {
    form.materialReplacement.replacementMaterialId = value
    resetProductionChangeFormDerivedState(form)
    return { handled: true }
  }

  if (field === 'productionChangeConfirmedProductionQty') {
    const qty = Number(value)
    const replacement = form.materialReplacement
    const normalized = normalizeMaterialReplacementAllocations(
      form.productionOrderId,
      replacement.allocations,
      Number.isFinite(qty) ? qty : 0,
    )
    replacement.confirmedProductionQty = normalized.confirmedProductionQty
    replacement.allocations = normalized.allocations
    resetProductionChangeFormDerivedState(form)
    return {
      handled: true,
      normalizedValue: String(normalized.confirmedProductionQty),
      syncAllocationInputs: true,
    }
  }

  if (field === 'productionChangeAllocationQty') {
    const allocation = form.materialReplacement.allocations.find((line) => line.id === meta.allocationId)
    if (!allocation) return { handled: true }
    const qty = Number(value)
    allocation.confirmedReplacementQty = Number.isFinite(qty) ? qty : 0
    resetProductionChangeFormDerivedState(form)
    return { handled: true }
  }

  if (field === 'productionChangeDecisionValue') {
    if (!meta.decisionId) return { handled: true }
    const currentDecision = form.decisionValues[meta.decisionId]
    const suggestedValue = getProductionChangeDecisionSuggestedValue(form, meta.decisionId)
    form.decisionValues[meta.decisionId] = {
      value,
      reason: value === suggestedValue ? '' : currentDecision?.reason ?? '',
    }
    return { handled: true }
  }

  if (field === 'productionChangeDecisionReason') {
    if (!meta.decisionId) return { handled: true }
    const currentDecision = form.decisionValues[meta.decisionId]
    form.decisionValues[meta.decisionId] = {
      value: currentDecision?.value ?? '',
      reason: value,
    }
    return { handled: true }
  }

  return { handled: false }
}

function openLatestProductionChangeOrderOrRelation(orderId: string): void {
  const createdChangeOrder = listProductionOrderChangeOrdersByProductionOrder(orderId)[0]
  if (createdChangeOrder) {
    openAppRoute(
      `/fcs/production/changes/${createdChangeOrder.id}`,
      `production-change-${createdChangeOrder.id}`,
      `生产单变更 ${createdChangeOrder.id}`,
    )
    return
  }

  openAppRoute(`/fcs/production/changes/orders/${orderId}`, `po-change-${orderId}`, `生产单版本关系 ${orderId}`)
}

function openCurrentTechPackEntry(spuCode: string): void {
  const info = getDemandCurrentTechPackInfo({ spuCode })
  const deferOpenAppRoute = (pathname: string, key?: string, title?: string): void => {
    window.setTimeout(() => {
      openAppRoute(pathname, key, title)
    }, 0)
  }

  if (info.styleId && info.currentTechPackVersionId) {
    deferOpenAppRoute(
      `/pcs/products/styles/${encodeURIComponent(info.styleId)}/technical-data/${encodeURIComponent(info.currentTechPackVersionId)}`,
      `pcs-tech-pack-${info.currentTechPackVersionId}`,
      `技术包版本 ${info.currentTechPackVersionCode || spuCode}`,
    )
    return
  }

  if (info.styleId) {
    deferOpenAppRoute(
      `/pcs/products/styles/${encodeURIComponent(info.styleId)}?tab=technical`,
      `pcs-style-${info.styleId}`,
      `款式档案 ${info.styleCode || spuCode}`,
    )
    return
  }

  deferOpenAppRoute('/pcs/products/styles', 'pcs-style-archives', '款式档案')
}

function openOrderTechPackSnapshot(productionOrderId: string): void {
  openAppRoute(
    `/fcs/production/orders/${encodeURIComponent(productionOrderId)}/tech-pack`,
    `order-tech-pack-${productionOrderId}`,
    `技术包快照 ${productionOrderId}`,
  )
}

function updateProductionField(
  field: string,
  node: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
): void {
  const value = node.value
  const checked = node instanceof HTMLInputElement ? node.checked : false

  if (field.startsWith('materialDraftMode:')) {
    const [, draftId] = field.split(':')
    if (draftId && (value === 'warehouse_delivery' || value === 'factory_pickup')) {
      setMaterialDraftMode(draftId, value as MaterialMode, currentUser.name)
    }
    return
  }

  if (field.startsWith('materialDraftRemark:')) {
    const [, draftId] = field.split(':')
    if (draftId) {
      setMaterialDraftRemark(draftId, value, currentUser.name)
    }
    return
  }

  if (field.startsWith('materialDraftLineQty:')) {
    const [, draftId, lineId] = field.split(':')
    if (draftId && lineId) {
      const qty = Number(value)
      setMaterialDraftLineConfirmedQty(draftId, lineId, Number.isFinite(qty) ? qty : 0, currentUser.name)
    }
    return
  }

  if (field === 'demandKeyword') {
    state.demandKeyword = value
    state.demandCurrentPage = 1
    return
  }

  if (field === 'demandStatusFilter') {
    state.demandStatusFilter = value as ProductionDemand['demandStatus'] | 'ALL'
    state.demandCurrentPage = 1
    return
  }

  if (field === 'demandTechPackFilter') {
    state.demandTechPackFilter = value as ProductionDemand['techPackStatus'] | 'ALL'
    state.demandCurrentPage = 1
    return
  }

  if (field === 'demandHasOrderFilter') {
    state.demandHasOrderFilter = value as 'ALL' | 'YES' | 'NO'
    state.demandCurrentPage = 1
    return
  }

  if (field === 'demandPriorityFilter') {
    state.demandPriorityFilter = value as ProductionDemand['priority'] | 'ALL'
    state.demandCurrentPage = 1
    return
  }

  if (field === 'demandOnlyUngenerated') {
    state.demandOnlyUngenerated = checked
    return
  }

  if (field === 'demandTierFilter') {
    state.demandTierFilter = value as FactoryTier | 'ALL'
    state.demandTypeFilter = 'ALL'
    state.demandSelectedFactoryId = ''
    return
  }

  if (field === 'demandTypeFilter') {
    state.demandTypeFilter = value as FactoryType | 'ALL'
    state.demandSelectedFactoryId = ''
    return
  }

  if (field === 'demandFactorySearch') {
    state.demandFactorySearch = value
    return
  }

  if (field === 'demandSelectedFactoryId') {
    state.demandSelectedFactoryId = value
    return
  }

  if (field === 'demandOwnerPartyManual') {
    state.demandOwnerPartyManual = checked
    return
  }

  if (field === 'demandOwnerPartyType') {
    state.demandOwnerPartyManual = true
    state.demandOwnerPartyType = value as DemandOwnerPartyType
    return
  }

  if (field === 'demandOwnerPartyId') {
    state.demandOwnerPartyId = value
    return
  }

  if (field === 'demandOwnerReason') {
    state.demandOwnerReason = value
    return
  }

  if (field === 'demandGenerateTechPackVersionId') {
    state.demandGenerateTechPackVersionId = value
    return
  }

  if (field.startsWith('demandGenerateTechPackVersion:')) {
    const [, demandId] = field.split(':')
    if (demandId) {
      state.demandGenerateTechPackVersionIds = {
        ...state.demandGenerateTechPackVersionIds,
        [demandId]: value,
      }
      state.demandGenerateTechPackVersionId = value
    }
    return
  }

  if (field === 'ordersKeyword') {
    state.ordersKeyword = value
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'ordersStatusFilter') {
    state.ordersStatusFilter = value === 'ALL' ? [] : [value as ProductionOrderStatus]
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'ordersTechPackFilter') {
    state.ordersTechPackFilter = value as ProductionState['ordersTechPackFilter']
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'ordersBreakdownFilter') {
    state.ordersBreakdownFilter = value as ProductionState['ordersBreakdownFilter']
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'ordersAssignmentProgressFilter') {
    state.ordersAssignmentProgressFilter = value as ProductionState['ordersAssignmentProgressFilter']
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'ordersAssignmentModeFilter') {
    state.ordersAssignmentModeFilter = value as AssignmentModeFilter
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'ordersBiddingRiskFilter') {
    state.ordersBiddingRiskFilter = value as BiddingRiskFilter
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'ordersTierFilter') {
    state.ordersTierFilter = value as FactoryTier | 'ALL'
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'ordersHasMaterialDraftFilter') {
    state.ordersHasMaterialDraftFilter = value as 'ALL' | 'YES' | 'NO'
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'ordersHasConfirmedMaterialRequestFilter') {
    state.ordersHasConfirmedMaterialRequestFilter = value as 'ALL' | 'YES' | 'NO'
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'techPackChangeKeyword') {
    state.techPackChangeKeyword = value
    state.productionChangeOrderPage = 1
    state.productionChangeSelectedOrderId = ''
    return
  }

  if (field === 'techPackChangeCurrentVersionFilter') {
    state.techPackChangeCurrentVersionFilter = value
    return
  }

  if (field === 'techPackChangeNewVersionFilter') {
    state.techPackChangeNewVersionFilter = value as ProductionState['techPackChangeNewVersionFilter']
    return
  }

  if (field === 'techPackChangePatchFilter') {
    state.techPackChangePatchFilter = value as ProductionState['techPackChangePatchFilter']
    return
  }

  if (field === 'techPackChangeStatusFilter') {
    state.techPackChangeStatusFilter = value
    return
  }

  if (field === 'techPackChangeModuleFilter') {
    state.techPackChangeModuleFilter = value
    return
  }

  if (field === 'techPackChangeProgressFilter') {
    state.techPackChangeProgressFilter = value
    return
  }

  if (field === 'techPackChangeOwnerFilter') {
    state.techPackChangeOwnerFilter = value
    return
  }

  if (field === 'techPackChangePublishIgnoreReason') {
    state.techPackChangePublishIgnoreReason = value
    return
  }

  if (field === 'techPackChangeTargetVersionId') {
    state.techPackChangeVersionForm.targetVersionId = value
    return
  }

  if (field === 'techPackChangeVersionReason') {
    state.techPackChangeVersionForm.reason = value
    state.techPackChangeVersionError = ''
    return
  }

  if (field === 'techPackChangeEffectiveMode') {
    state.techPackChangeVersionForm.effectiveMode = value
    return
  }

  if (field === 'techPackChangeVersionNote') {
    state.techPackChangeVersionForm.note = value
    return
  }

  if (field === 'techPackChangeVersionConfirmed') {
    state.techPackChangeVersionForm.confirmed = checked
    state.techPackChangeVersionError = ''
    return
  }

  if (field === 'productionChangeProductionOrderId') {
    state.productionChangeForm = createInitializedProductionChangeForm(
      value,
      state.productionChangeForm.changeType,
    )
    state.productionChangeFormError = ''
    return
  }

  const productionChangeFieldResult = applyProductionChangeFieldValue(
    state.productionChangeForm,
    field,
    value,
    {
      lineId: node.dataset.lineId,
      allocationId: node.dataset.allocationId,
      decisionId: node.dataset.decisionId,
    },
  )
  if (productionChangeFieldResult.handled) {
    state.productionChangeFormError = ''
    if (field.startsWith('productionChangeQuantity') && node.dataset.lineId) {
      patchProductionChangeQuantityDom(node, node.dataset.lineId)
    } else if (field === 'productionChangeConfirmedProductionQty') {
      node.value = productionChangeFieldResult.normalizedValue ?? node.value
      patchProductionChangeAllocationDom(node, productionChangeFieldResult.syncAllocationInputs)
    } else if (field === 'productionChangeAllocationQty') {
      patchProductionChangeAllocationDom(node)
    } else if (field === 'productionChangeReason' || field === 'productionChangeDecisionReason') {
      patchProductionChangeFormErrorDom(node)
    }
    return
  }

  if (field === 'productionPatchType') {
    state.productionPatchForm = {
      ...PRODUCTION_PATCH_EMPTY_FORM,
      patchType: value,
      effectivePoint: getDefaultProductionPatchEffectivePoint(value),
    }
    return
  }

  if (field === 'productionPatchEffectivePoint') {
    state.productionPatchForm.effectivePoint = value
    return
  }

  if (field === 'productionPatchReason') {
    state.productionPatchForm.reason = value
    state.productionPatchError = ''
    return
  }

  if (field === 'productionPatchContentText') {
    state.productionPatchForm.contentText = value
    state.productionPatchError = ''
    return
  }

  const productionPatchScopeFieldMap: Partial<Record<string, keyof typeof state.productionPatchForm>> = {
    productionPatchColor: 'color',
    productionPatchTargetColor: 'targetColor',
    productionPatchSize: 'size',
    productionPatchMaterial: 'material',
    productionPatchTargetMaterial: 'targetMaterial',
    productionPatchUsageValue: 'usageValue',
    productionPatchTargetUsageValue: 'targetUsageValue',
    productionPatchPart: 'part',
    productionPatchProcessNode: 'processNode',
    productionPatchProcessFrom: 'processFrom',
    productionPatchProcessTo: 'processTo',
    productionPatchFactory: 'factory',
    productionPatchCutOrder: 'cutOrder',
    productionPatchMarkerPlan: 'markerPlan',
    productionPatchSpreadingOrder: 'spreadingOrder',
    productionPatchProcessOrder: 'processOrder',
    productionPatchPatternFile: 'patternFile',
    productionPatchTargetPatternFile: 'targetPatternFile',
    productionPatchSizeRule: 'sizeRule',
    productionPatchTargetSizeRule: 'targetSizeRule',
    productionPatchColorMaterialMapping: 'colorMaterialMapping',
    productionPatchTargetColorMaterialMapping: 'targetColorMaterialMapping',
    productionPatchCostItem: 'costItem',
    productionPatchTargetCostValue: 'targetCostValue',
    productionPatchArtworkFile: 'artworkFile',
    productionPatchTargetArtworkFile: 'targetArtworkFile',
  }
  const productionPatchScopeField = productionPatchScopeFieldMap[field]
  if (productionPatchScopeField) {
    state.productionPatchForm[productionPatchScopeField] = value
    state.productionPatchError = ''
    return
  }

  if (field === 'detailSimulateStatus') {
    state.detailSimulateStatus = value as ProductionOrderStatus
  }
}

export function handleProductionEvent(target: HTMLElement): boolean {
  if (isProductionPreparationTimingPath() && handleProductionPreparationTimingEvent(target)) return true

  const fieldNode = target.closest<HTMLElement>('[data-prod-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const field = fieldNode.dataset.prodField
    if (!field) return true
    updateProductionField(field, fieldNode)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-prod-action]')
  if (!actionNode) {
    if (state.ordersActionMenuId && !target.closest('[data-prod-orders-menu-root]')) {
      state.ordersActionMenuId = null
      return true
    }
    return false
  }

  const action = actionNode.dataset.prodAction
  if (!action) return false

  if (action === 'close-dialog') {
    closeAllProductionDialogs()
    return true
  }

  if (action === 'noop') {
    return true
  }

  if (action === 'open-order-tech-pack-snapshot') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true

    state.ordersActionMenuId = null
    openOrderTechPackSnapshot(orderId)
    return true
  }

  if (action === 'open-current-tech-pack') {
    const spuCode = actionNode.dataset.spuCode
    if (!spuCode) return true

    state.ordersActionMenuId = null
    openCurrentTechPackEntry(spuCode)
    return true
  }

  if (action === 'open-current-tech-pack-from-demand-detail') {
    const spuCode = actionNode.dataset.spuCode
    if (!spuCode) return true

    openCurrentTechPackEntry(spuCode)
    state.demandDetailId = null
    return true
  }

  if (action === 'open-order-detail') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true

    state.ordersActionMenuId = null
    openAppRoute(`/fcs/production/orders/${orderId}`, `po-${orderId}`, `生产单管理 ${orderId}`)
    return true
  }

  if (action === 'open-production-change-detail') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    state.techPackChangeDetailTab = 'relation'
    openAppRoute(`/fcs/production/changes/orders/${orderId}`, `po-change-relation-${orderId}`, `生产单版本关系诊断 ${orderId}`)
    return true
  }

  if (action === 'change-production-change-order-page') {
    const page = Number(actionNode.dataset.page || '1')
    state.productionChangeOrderPage = Number.isFinite(page) && page > 0 ? page : 1
    return true
  }

  if (action === 'apply-production-change-search') {
    state.productionChangeOrderPage = 1
    state.productionChangeSelectedOrderId = ''
    return true
  }

  if (action === 'switch-production-change-list-tab') {
    const tab = actionNode.dataset.tab as ProductionState['productionChangeListTab'] | undefined
    if (!tab) return true
    state.productionChangeListTab = tab
    state.productionChangeOrderPage = 1
    state.productionChangeSelectedOrderId = ''
    return true
  }

  if (action === 'switch-production-change-detail-tab') {
    const tab = actionNode.dataset.tab as ProductionState['productionChangeDetailTab'] | undefined
    if (
      tab === 'content' ||
      tab === 'impact' ||
      tab === 'documents' ||
      tab === 'cost' ||
      tab === 'timing' ||
      tab === 'records'
    ) {
      state.productionChangeDetailTab = tab
    }
    return true
  }

  if (action === 'start-production-change-from-order') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    const sourceOrder = state.productionChangeSelectedOrderId
      ? getProductionOrderChangeOrder(state.productionChangeSelectedOrderId)
      : undefined
    state.productionChangeSelectedOrderId = ''
    state.productionChangeForm = sourceOrder?.productionOrderId === orderId
      ? createProductionChangeFormFromRecord(sourceOrder)
      : createInitializedProductionChangeForm(orderId, state.productionChangeForm.changeType)
    state.productionChangeFormStep = 'content'
    state.productionChangeFormError = ''
    openAppRoute('/fcs/production/changes/new', 'production-change-new', '新增生产单变更')
    return true
  }

  if (action === 'start-production-change-type') {
    const changeType = actionNode.dataset.changeType as typeof state.productionChangeForm.changeType | undefined
    if (changeType !== 'QUANTITY_CHANGE' && changeType !== 'MATERIAL_REPLACEMENT') return true
    const orderId = actionNode.dataset.orderId ?? ''
    state.productionChangeForm = createInitializedProductionChangeForm(orderId, changeType)
    state.productionChangeFormError = ''
    state.productionChangeSelectedOrderId = ''
    state.productionChangeFormStep = orderId ? 'content' : 'order'
    openAppRoute('/fcs/production/changes/new', 'production-change-new', '新增生产单变更')
    return true
  }

  if (action === 'set-production-change-type') {
    const changeType = actionNode.dataset.changeType as typeof state.productionChangeForm.changeType | undefined
    if (changeType === 'QUANTITY_CHANGE' || changeType === 'MATERIAL_REPLACEMENT') setProductionChangeType(changeType)
    return true
  }

  if (action === 'add-production-change-quantity-line') {
    state.productionChangeForm.quantityLines.push({
      id: nextLocalEntityId('QTY-NEW', 4),
      skuCode: '',
      color: '',
      size: '',
      originalQty: 0,
      currentQty: 0,
      targetQty: 0,
      unit: '件',
      isNew: true,
      coveredByCurrentVersion: false,
    })
    resetProductionChangeDerivedState()
    state.productionChangeFormError = ''
    return true
  }

  if (action === 'remove-production-change-quantity-line') {
    const lineId = actionNode.dataset.lineId
    state.productionChangeForm.quantityLines = state.productionChangeForm.quantityLines.filter(
      (line) => line.id !== lineId || !line.isNew,
    )
    resetProductionChangeDerivedState()
    state.productionChangeFormError = ''
    return true
  }

  if (action === 'set-production-change-replacement-mode') {
    const mode = actionNode.dataset.mode
    if (mode !== 'REMAINING' && mode !== 'FULL') return true
    state.productionChangeForm.materialReplacement.replacementMode = mode
    rebuildProductionChangeMaterialPlan()
    return true
  }

  if (action === 'set-production-change-scope') {
    const scope = actionNode.dataset.scope
    if (scope !== 'CURRENT_ONLY' && scope !== 'CURRENT_AND_FOLLOWING') return true
    state.productionChangeForm.materialReplacement.scope = scope
    rebuildProductionChangeMaterialPlan()
    return true
  }

  if (action === 'toggle-production-change-allocation') {
    state.productionChangeForm.advancedAllocationOpen = !state.productionChangeForm.advancedAllocationOpen
    return true
  }

  if (action === 'set-production-change-form-step') {
    const step = actionNode.dataset.step as ProductionState['productionChangeFormStep'] | undefined
    if (step === 'order' || step === 'content' || step === 'handling' || step === 'execution') {
      moveProductionChangeFormToStep(step)
    }
    return true
  }

  if (action === 'go-production-change-next-step') {
    const steps: ProductionChangeFormStep[] = ['order', 'content', 'handling', 'execution']
    const currentIndex = Math.max(0, steps.indexOf(state.productionChangeFormStep))
    moveProductionChangeFormToStep(steps[Math.min(currentIndex + 1, steps.length - 1)])
    return true
  }

  if (action === 'execute-production-change' || action === 'simulate-production-change-failure') {
    const result = executeProductionChangeForForm(state.productionChangeForm, {
      shouldFail: action === 'simulate-production-change-failure',
    })
    state.productionChangeFormStep = result.step
    state.productionChangeFormError = result.error
    return true
  }

  if (action === 'open-production-change-history') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    state.techPackChangeDetailTab = 'logs'
    openAppRoute(`/fcs/production/changes/orders/${orderId}`, `po-change-relation-${orderId}`, `生产单版本关系诊断 ${orderId}`)
    return true
  }

  if (action === 'switch-tech-pack-change-detail-tab') {
    const tab = actionNode.dataset.tab as ProductionState['techPackChangeDetailTab'] | undefined
    if (!tab) return true
    state.techPackChangeDetailTab = tab
    return true
  }

  if (action === 'open-change-module-landing') {
    const landingId = actionNode.dataset.landingId
    if (!landingId) return true
    state.techPackChangeModuleLandingId = landingId
    return true
  }

  if (action === 'close-change-module-landing') {
    state.techPackChangeModuleLandingId = ''
    return true
  }

  if (action === 'open-change-module-log') {
    const orderId = actionNode.dataset.orderId
    state.techPackChangeDetailTab = 'logs'
    if (orderId) {
      openAppRoute(`/fcs/production/changes/orders/${orderId}`, `po-change-relation-${orderId}`, `生产单版本关系诊断 ${orderId}`)
    }
    showPlanMessage('已切换到该模块相关操作日志')
    return true
  }

  if (action === 'open-tech-pack-publish-guide') {
    const latestBatch = getLatestPendingProductionTechPackPublishEvaluationBatch()
    state.techPackChangePublishGuideOpen = true
    state.techPackChangePublishGuideBatchId = latestBatch?.batchId || ''
    return true
  }

  if (action === 'close-tech-pack-publish-guide') {
    if (state.techPackChangePublishGuideBatchId) {
      markProductionTechPackPublishEvaluationEntered(state.techPackChangePublishGuideBatchId, currentUser.name)
    }
    state.techPackChangePublishGuideOpen = false
    state.techPackChangePublishGuideBatchId = ''
    state.techPackChangePublishIgnoreReason = ''
    showPlanMessage('已进入生产单变更')
    openAppRoute('/fcs/production/changes')
    return true
  }

  if (action === 'generate-tech-pack-evaluation-todo') {
    if (state.techPackChangePublishGuideBatchId) {
      markProductionTechPackPublishEvaluationTodo(state.techPackChangePublishGuideBatchId, currentUser.name)
    }
    state.techPackChangePublishGuideOpen = false
    state.techPackChangePublishGuideBatchId = ''
    state.techPackChangePublishIgnoreReason = ''
    showPlanMessage('生产单评估待办已生成')
    openAppRoute('/fcs/production/changes')
    return true
  }

  if (action === 'mark-tech-pack-publish-ignore') {
    if (!state.techPackChangePublishIgnoreReason) {
      showPlanMessage('请选择本次不处理原因', 'error')
      return true
    }
    if (state.techPackChangePublishGuideBatchId) {
      ignoreProductionTechPackPublishEvaluationBatch(
        state.techPackChangePublishGuideBatchId,
        state.techPackChangePublishIgnoreReason,
        currentUser.name,
      )
    }
    state.techPackChangePublishGuideOpen = false
    state.techPackChangePublishGuideBatchId = ''
    showPlanMessage(`已记录不处理原因：${state.techPackChangePublishIgnoreReason}`)
    state.techPackChangePublishIgnoreReason = ''
    openAppRoute('/fcs/production/changes')
    return true
  }

  if (action === 'refresh-tech-pack-change-status') {
    showPlanMessage('版本状态已刷新')
    return true
  }

  if (action === 'export-tech-pack-change') {
    showPlanMessage('已生成生产单变更导出任务')
    return true
  }

  if (action === 'open-tech-pack-version-change') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    state.techPackChangeVersionDialogOrderId = orderId
    state.techPackChangeVersionForm = { ...TECH_PACK_VERSION_CHANGE_EMPTY_FORM }
    state.techPackChangeVersionError = ''
    return true
  }

  if (action === 'close-tech-pack-version-change') {
    state.techPackChangeVersionDialogOrderId = null
    state.techPackChangeVersionForm = { ...TECH_PACK_VERSION_CHANGE_EMPTY_FORM }
    state.techPackChangeVersionError = ''
    return true
  }

  if (action === 'submit-tech-pack-version-change') {
    const orderId = state.techPackChangeVersionDialogOrderId
    if (!orderId) return true
    if (!state.techPackChangeVersionForm.confirmed) {
      state.techPackChangeVersionError = '请先确认版本差异与当前生产进度'
      return true
    }
    try {
      const targetVersionId =
        state.techPackChangeVersionForm.targetVersionId || getDefaultTechPackChangeTargetVersionId(orderId)
      const request = submitProductionOrderTechPackChange({
        productionOrderId: orderId,
        targetVersionId,
        reason: state.techPackChangeVersionForm.reason,
        effectiveMode: state.techPackChangeVersionForm.effectiveMode as ChangeEffectiveMode,
        note: state.techPackChangeVersionForm.note,
        operatorName: currentUser.name,
      })
      state.techPackChangeVersionDialogOrderId = null
      state.techPackChangeVersionForm = { ...TECH_PACK_VERSION_CHANGE_EMPTY_FORM }
      state.techPackChangeVersionError = ''
      state.techPackChangeDetailTab = 'logs'
      openLatestProductionChangeOrderOrRelation(orderId)
      showPlanMessage(`版本关系变更申请已提交：${request.changeRequestNo}`)
    } catch (error) {
      state.techPackChangeVersionError = error instanceof Error ? error.message : '提交版本关系变更失败'
    }
    return true
  }

  if (action === 'open-production-patch') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    state.techPackChangeVersionDialogOrderId = null
    state.techPackChangeVersionError = ''
    state.productionPatchDialogOrderId = orderId
    state.productionPatchForm = {
      ...PRODUCTION_PATCH_EMPTY_FORM,
      effectivePoint: getDefaultProductionPatchEffectivePoint(PRODUCTION_PATCH_EMPTY_FORM.patchType),
    }
    state.productionPatchError = ''
    return true
  }

  if (action === 'set-production-patch-type') {
    const patchType = actionNode.dataset.patchType
    if (!patchType) return true
    state.productionPatchForm = {
      ...PRODUCTION_PATCH_EMPTY_FORM,
      patchType,
      effectivePoint: getDefaultProductionPatchEffectivePoint(patchType),
    }
    state.productionPatchError = ''
    return true
  }

  if (action === 'close-production-patch') {
    state.productionPatchDialogOrderId = null
    state.productionPatchForm = { ...PRODUCTION_PATCH_EMPTY_FORM }
    state.productionPatchError = ''
    return true
  }

  if (action === 'view-production-patch') {
    const patchId = actionNode.dataset.patchId
    showPlanMessage(patchId ? `已打开补丁详情：${patchId}` : '已打开补丁详情')
    return true
  }

  if (action === 'void-production-patch') {
    const patchId = actionNode.dataset.patchId
    if (!patchId) return true
    try {
      const patch = voidProductionOrderPatch(patchId, currentUser.name)
      showPlanMessage(`生产单补丁已作废：${patch.patchNo}`)
    } catch (error) {
      showPlanMessage(error instanceof Error ? error.message : '作废生产单补丁失败', 'error')
    }
    return true
  }

  if (action === 'open-production-patch-notice') {
    const orderId = actionNode.dataset.orderId
    state.techPackChangeDetailTab = 'notice'
    if (orderId) {
      openAppRoute(`/fcs/production/changes/orders/${orderId}`, `po-change-${orderId}`, `生产单版本关系 ${orderId}`)
    }
    return true
  }

  if (action === 'resend-production-change-notice') {
    const noticeId = actionNode.dataset.noticeId
    showPlanMessage(noticeId ? `飞书通知已重发：${noticeId}` : '飞书通知已重发')
    return true
  }

  if (action === 'submit-production-patch') {
    const orderId = state.productionPatchDialogOrderId
    if (!orderId) return true
    const formError = validateProductionPatchForm()
    if (formError) {
      state.productionPatchError = formError
      return true
    }
    const scopeText = buildProductionPatchScopeText()
    const contentText = buildProductionPatchContentText()
    try {
      const patch = submitProductionOrderPatch({
        productionOrderId: orderId,
        patchType: state.productionPatchForm.patchType as ProductionPatchType,
        effectivePoint: state.productionPatchForm.effectivePoint as PatchEffectivePoint,
        scopeText,
        contentText,
        reason: state.productionPatchForm.reason,
        operatorName: currentUser.name,
      })
      state.productionPatchDialogOrderId = null
      state.productionPatchForm = { ...PRODUCTION_PATCH_EMPTY_FORM }
      state.productionPatchError = ''
      openLatestProductionChangeOrderOrRelation(orderId)
      showPlanMessage(`生产单补丁已提交：${patch.patchNo}`)
    } catch (error) {
      state.productionPatchError = error instanceof Error ? error.message : '提交生产单补丁失败'
    }
    return true
  }

  if (action === 'open-material-draft-drawer') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    state.ordersActionMenuId = null
    state.materialDraftOrderId = orderId
    state.materialDraftAddDraftId = null
    state.materialDraftAddSelections = new Set<string>()
    return true
  }

  if (action === 'close-material-draft-drawer') {
    state.materialDraftOrderId = null
    state.materialDraftAddDraftId = null
    state.materialDraftAddSelections = new Set<string>()
    return true
  }

  if (action === 'toggle-material-draft-needed') {
    const draftId = actionNode.dataset.draftId
    if (!draftId || !(actionNode instanceof HTMLInputElement)) return true
    setMaterialDraftNeedMaterial(draftId, actionNode.checked, currentUser.name)
    return true
  }

  if (action === 'toggle-material-draft-line') {
    const draftId = actionNode.dataset.draftId
    const lineId = actionNode.dataset.lineId
    if (!draftId || !lineId || !(actionNode instanceof HTMLInputElement)) return true
    toggleMaterialDraftLine(draftId, lineId, actionNode.checked, currentUser.name)
    return true
  }

  if (action === 'open-add-draft-materials') {
    const draftId = actionNode.dataset.draftId
    if (!draftId) return true
    state.materialDraftAddDraftId = draftId
    state.materialDraftAddSelections = new Set<string>()
    return true
  }

  if (action === 'close-add-draft-materials') {
    state.materialDraftAddDraftId = null
    state.materialDraftAddSelections = new Set<string>()
    return true
  }

  if (action === 'toggle-add-draft-material') {
    const optionKey = actionNode.dataset.optionKey
    if (!optionKey) return true
    const next = new Set(state.materialDraftAddSelections)
    if (next.has(optionKey)) {
      next.delete(optionKey)
    } else {
      next.add(optionKey)
    }
    state.materialDraftAddSelections = next
    return true
  }

  if (action === 'add-draft-materials') {
    const draftId = state.materialDraftAddDraftId
    if (!draftId) return true
    const added = addMaterialToDraft(draftId, [...state.materialDraftAddSelections], currentUser.name)
    if (added <= 0) {
      showPlanMessage('未选择可补充物料', 'error')
      return true
    }
    showPlanMessage(`已补充 ${added} 条物料`)
    state.materialDraftAddDraftId = null
    state.materialDraftAddSelections = new Set<string>()
    return true
  }

  if (action === 'restore-material-draft-suggestion') {
    const draftId = actionNode.dataset.draftId
    if (!draftId) return true
    restoreMaterialDraftSuggestion(draftId, currentUser.name)
    showPlanMessage('已恢复系统建议')
    return true
  }

  if (action === 'confirm-material-request-draft') {
    const draftId = actionNode.dataset.draftId
    if (!draftId) return true

    const result = confirmMaterialRequestDraft(draftId, { id: currentUser.id, name: currentUser.name })
    if (!result.ok) {
      showPlanMessage(`创建失败：${result.reason}`, 'error')
      return true
    }

    showPlanMessage(`领料需求已创建：${result.request.materialRequestNo}`)
    return true
  }

  if (action === 'copy-demand-legacy') {
    const legacyNo = actionNode.dataset.legacyNo
    if (!legacyNo) return true

    try {
      if (navigator?.clipboard?.writeText) {
        void navigator.clipboard.writeText(legacyNo)
      }
    } catch {
      // ignore clipboard errors
    }

    return true
  }

  if (action === 'toggle-demand-only-ungenerated') {
    state.demandOnlyUngenerated = !state.demandOnlyUngenerated
    state.demandCurrentPage = 1
    return true
  }

  if (action === 'query-demand') {
    state.demandCurrentPage = 1
    return true
  }

  if (action === 'demand-prev-page') {
    state.demandCurrentPage = Math.max(1, state.demandCurrentPage - 1)
    return true
  }

  if (action === 'demand-next-page') {
    const totalPages = Math.max(1, Math.ceil(getFilteredDemands().length / PAGE_SIZE))
    state.demandCurrentPage = Math.min(totalPages, state.demandCurrentPage + 1)
    return true
  }

  if (action === 'toggle-demand-select-all') {
    const filteredDemands = getPaginatedDemands(getFilteredDemands())
    const shouldClear =
      filteredDemands.length > 0 &&
      filteredDemands.every((demand) => state.demandSelectedIds.has(demand.demandId))

    if (shouldClear) {
      state.demandSelectedIds = new Set()
    } else {
      state.demandSelectedIds = new Set(filteredDemands.map((demand) => demand.demandId))
    }
    return true
  }

  if (action === 'toggle-demand-select') {
    const demandId = actionNode.dataset.demandId
    if (!demandId) return true

    const next = new Set(state.demandSelectedIds)
    if (next.has(demandId)) {
      next.delete(demandId)
    } else {
      next.add(demandId)
    }
    state.demandSelectedIds = next
    return true
  }

  if (action === 'open-demand-detail') {
    const demandId = actionNode.dataset.demandId
    if (!demandId) return true
    state.demandDetailId = demandId
    return true
  }

  if (action === 'close-demand-detail') {
    state.demandDetailId = null
    return true
  }

  if (action === 'open-demand-batch') {
    openDemandBatchGenerate()
    return true
  }

  if (action === 'open-demand-merge') {
    openDemandMergeGenerate()
    return true
  }

  if (action === 'open-demand-single') {
    const demandId = actionNode.dataset.demandId
    if (!demandId) return true
    openDemandSingleGenerate(demandId)
    return true
  }

  if (action === 'close-demand-generate') {
    state.demandBatchDialogOpen = false
    state.demandBatchGenerateMode = 'batch'
    state.demandSingleGenerateId = null
    state.demandGenerateConfirmOpen = false
    state.demandGenerateTechPackVersionId = ''
    state.demandGenerateTechPackVersionIds = {}
    return true
  }

  if (action === 'toggle-demand-advanced') {
    state.demandShowAdvanced = !state.demandShowAdvanced
    return true
  }

  if (action === 'open-demand-generate-confirm') {
    state.demandGenerateConfirmOpen = true
    return true
  }

  if (action === 'close-demand-generate-confirm') {
    state.demandGenerateConfirmOpen = false
    return true
  }

  if (action === 'confirm-demand-generate') {
    if (state.ordersFromDemandDialogOpen) {
      performOrdersFromDemandGenerate()
    } else {
      performDemandGenerate()
    }
    return true
  }

  if (action === 'toggle-orders-demand-select-all') {
    const demands = listOrdersFromDemandGeneratableDemands()
    const shouldClear = demands.length > 0 && demands.every((demand) => state.ordersFromDemandSelectedIds.has(demand.demandId))
    if (shouldClear) {
      state.ordersFromDemandSelectedIds = new Set<string>()
    } else {
      state.ordersFromDemandSelectedIds = new Set<string>(demands.map((demand) => demand.demandId))
    }
    return true
  }

  if (action === 'toggle-orders-demand-select') {
    const demandId = actionNode.dataset.demandId
    if (!demandId) return true
    const next = new Set(state.ordersFromDemandSelectedIds)
    if (next.has(demandId)) next.delete(demandId)
    else next.add(demandId)
    state.ordersFromDemandSelectedIds = next
    return true
  }

  if (action === 'open-orders-demand-generate-confirm') {
    state.demandGenerateConfirmOpen = true
    return true
  }

  if (action === 'close-orders-from-demand') {
    state.ordersFromDemandDialogOpen = false
    state.ordersFromDemandSelectedIds = new Set<string>()
    state.demandGenerateConfirmOpen = false
    state.demandGenerateTechPackVersionId = ''
    state.demandGenerateTechPackVersionIds = {}
    return true
  }

  if (action === 'reset-demand-filters') {
    state.demandKeyword = ''
    state.demandStatusFilter = 'ALL'
    state.demandTechPackFilter = 'ALL'
    state.demandHasOrderFilter = 'ALL'
    state.demandPriorityFilter = 'ALL'
    state.demandOnlyUngenerated = false
    state.demandCurrentPage = 1
    return true
  }

  if (action === 'hold-demand' || action === 'unhold-demand' || action === 'cancel-demand') {
    const demandId = actionNode.dataset.demandId
    if (!demandId) return true

    const targetStatus: ProductionDemand['demandStatus'] =
      action === 'hold-demand' ? 'HOLD' : action === 'unhold-demand' ? 'PENDING_CONVERT' : 'CANCELLED'

    state.demands = state.demands.map((demand) => {
      if (demand.demandId !== demandId) return demand
      return {
        ...demand,
        demandStatus: targetStatus,
        updatedAt: toTimestamp(),
      }
    })

    return true
  }

  if (action === 'refresh-demand') {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
    return true
  }

  if (action === 'reset-orders-filters') {
    state.ordersKeyword = ''
    state.ordersStatusFilter = []
    state.ordersTechPackFilter = 'ALL'
    state.ordersBreakdownFilter = 'ALL'
    state.ordersAssignmentProgressFilter = 'ALL'
    state.ordersAssignmentModeFilter = 'ALL'
    state.ordersBiddingRiskFilter = 'ALL'
    state.ordersTierFilter = 'ALL'
    state.ordersHasMaterialDraftFilter = 'ALL'
    state.ordersHasConfirmedMaterialRequestFilter = 'ALL'
    state.ordersMaterialStageFilter = 'ALL'
    state.ordersCurrentPage = 1
    state.ordersSelectedIds = new Set()
    state.ordersActionMenuId = null
    return true
  }

  if (action === 'query-orders') {
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return true
  }

  if (action === 'apply-material-reminder-filter') {
    const targetFilter = actionNode.dataset.target
    state.ordersHasMaterialDraftFilter = 'ALL'
    state.ordersHasConfirmedMaterialRequestFilter = 'ALL'
    state.ordersMaterialStageFilter = 'ALL'

    if (targetFilter === 'preview') {
      state.ordersMaterialStageFilter = 'PREVIEW'
    } else if (targetFilter === 'pending') {
      state.ordersMaterialStageFilter = 'ACTUAL_PENDING'
    } else if (targetFilter === 'confirmed') {
      state.ordersMaterialStageFilter = 'ACTUAL_CONFIRMED'
    }
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return true
  }

  if (action === 'switch-orders-view') {
    const view = actionNode.dataset.view as OrderViewMode | undefined
    if (view === 'table' || view === 'board') {
      state.ordersViewMode = view
      state.ordersActionMenuId = null

      if (view === 'board' && typeof window !== 'undefined') {
        window.alert('看板视图暂未开放')
      }
    }
    return true
  }

  if (action === 'toggle-orders-more-menu') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    state.ordersActionMenuId =
      state.ordersActionMenuId === orderId ? null : orderId
    return true
  }

  if (action === 'orders-prev-page') {
    state.ordersCurrentPage = Math.max(1, state.ordersCurrentPage - 1)
    state.ordersActionMenuId = null
    return true
  }

  if (action === 'orders-next-page') {
    const totalPages = Math.max(1, Math.ceil(getFilteredOrders().length / PAGE_SIZE))
    state.ordersCurrentPage = Math.min(totalPages, state.ordersCurrentPage + 1)
    state.ordersActionMenuId = null
    return true
  }

  if (action === 'toggle-orders-select-all') {
    const paged = getPaginatedOrders(getFilteredOrders())
    const shouldClear = paged.length > 0 && paged.every((order) => state.ordersSelectedIds.has(order.productionOrderId))

    if (shouldClear) {
      state.ordersSelectedIds = new Set()
    } else {
      state.ordersSelectedIds = new Set(paged.map((order) => order.productionOrderId))
    }

    return true
  }

  if (action === 'toggle-orders-select') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    const next = new Set(state.ordersSelectedIds)
    if (next.has(orderId)) next.delete(orderId)
    else next.add(orderId)
    state.ordersSelectedIds = next
    return true
  }

  if (action === 'open-orders-demand-snapshot') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    state.ordersActionMenuId = null
    state.ordersDemandSnapshotId = orderId
    return true
  }

  if (action === 'close-orders-demand-snapshot') {
    state.ordersDemandSnapshotId = null
    return true
  }

  if (action === 'open-orders-tech-pack-snapshot-dialog') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    state.ordersActionMenuId = null
    state.ordersTechPackSnapshotDialogId = orderId
    return true
  }

  if (action === 'close-orders-tech-pack-snapshot-dialog') {
    state.ordersTechPackSnapshotDialogId = null
    return true
  }

  if (action === 'open-orders-logs') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    state.ordersActionMenuId = null
    state.ordersLogsId = orderId
    return true
  }

  if (action === 'close-orders-logs') {
    state.ordersLogsId = null
    return true
  }

  if (action === 'open-breakdown-readiness') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    state.ordersActionMenuId = null
    state.ordersBreakdownReadinessOrderId = orderId
    return true
  }

  if (action === 'close-breakdown-readiness') {
    state.ordersBreakdownReadinessOrderId = null
    return true
  }

  if (action === 'breakdown-order') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true

    state.ordersActionMenuId = null
    const opened = openTaskGenerationPreview([orderId])
    if (opened > 0) {
      return true
    }

    const order = getOrderById(orderId)
    showPlanMessage(order ? getOrderTaskBreakdownDisabledReason(order) || '当前生产单不可拆解' : '未找到生产单', 'error')
    return true
  }

  if (action === 'batch-breakdown-orders') {
    const selectedIds = [...state.ordersSelectedIds]
    if (selectedIds.length === 0) {
      showPlanMessage('请先勾选需要拆解的生产单', 'error')
      return true
    }

    state.ordersActionMenuId = null
    const opened = openTaskGenerationPreview(selectedIds)
    if (opened > 0) {
      return true
    }

    showPlanMessage('所选生产单没有可拆解任务', 'error')
    return true
  }

  if (action === 'close-task-generation-preview') {
    closeTaskGenerationPreview()
    return true
  }

  if (action === 'confirm-task-generation-preview') {
    const changed = confirmTaskGenerationPreview()
    state.ordersSelectedIds = new Set<string>()
    if (changed > 0) {
      showPlanMessage(`已确认生成 ${changed} 张生产单的任务单元`)
      return true
    }
    showPlanMessage('当前没有可生成的任务单元', 'error')
    return true
  }

  if (action === 'open-orders-dispatch-center') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    state.ordersActionMenuId = null
    openAppRoute(`/fcs/dispatch/non-sewing?po=${orderId}`, `dispatch-center-${orderId}`, '非车缝任务分配')
    return true
  }

  if (action === 'open-orders-dispatch-board') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    state.ordersActionMenuId = null
    openAppRoute(`/fcs/dispatch/sewing?po=${orderId}`, `dispatch-sewing-${orderId}`, '车缝分配工作台')
    return true
  }

  if (action === 'orders-refresh') {
    state.ordersActionMenuId = null
    if (typeof window !== 'undefined') window.location.reload()
    return true
  }

  if (action === 'orders-export') {
    state.ordersActionMenuId = null
    if (typeof window !== 'undefined') window.alert('导出暂未开放')
    return true
  }

  if (action === 'orders-from-demand') {
    state.ordersActionMenuId = null
    openOrdersFromDemandGenerateDialog()
    return true
  }

  if (action === 'detail-switch-tab') {
    const tab = actionNode.dataset.tab as OrderDetailTab | undefined
    if (!tab) return true
    state.detailTab = tab
    return true
  }

  if (action === 'detail-open-logs') {
    state.detailLogsOpen = true
    return true
  }

  if (action === 'detail-close-logs') {
    state.detailLogsOpen = false
    return true
  }

  if (action === 'detail-open-simulate') {
    const order = getOrderById(state.detailCurrentOrderId)
    if (!order) return true
    state.detailSimulateStatus = order.status
    state.detailSimulateOpen = true
    return true
  }

  if (action === 'detail-close-simulate') {
    state.detailSimulateOpen = false
    return true
  }

  if (action === 'detail-open-simulate-confirm') {
    state.detailConfirmSimulateOpen = true
    return true
  }

  if (action === 'detail-close-simulate-confirm') {
    state.detailConfirmSimulateOpen = false
    return true
  }

  if (action === 'detail-apply-simulate') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true

    const now = toTimestamp()
    const targetStatus = state.detailSimulateStatus
    const lockedStatuses: ProductionOrderStatus[] = ['EXECUTING', 'COMPLETED', 'CANCELLED']

    state.orders = state.orders.map((order) => {
      if (order.productionOrderId !== orderId) return order

      const auditLog: AuditLog = {
        id: nextLocalEntityId('LOG', 4),
        action: 'STATUS_SIMULATE',
        detail: `状态模拟从 ${productionOrderStatusConfig[order.status].label} 变更为 ${productionOrderStatusConfig[targetStatus].label}`,
        at: now,
        by: currentUser.name,
      }

      return {
        ...order,
        status: targetStatus,
        lockedLegacy: lockedStatuses.includes(targetStatus),
        updatedAt: now,
        auditLogs: [...order.auditLogs, auditLog],
      }
    })

    state.detailConfirmSimulateOpen = false
    state.detailSimulateOpen = false
    return true
  }

  return false
}

export async function handleProductionSubmit(form: HTMLFormElement): Promise<boolean> {
  if (isProductionPreparationTimingPath()) return handleProductionPreparationTimingSubmit(form)

  return false
}

export function isProductionDialogOpen(): boolean {
  return (
    state.demandDetailId !== null ||
    state.demandBatchDialogOpen ||
    state.demandSingleGenerateId !== null ||
    state.demandGenerateConfirmOpen ||
    state.ordersDemandSnapshotId !== null ||
    state.ordersTechPackSnapshotDialogId !== null ||
    state.ordersLogsId !== null ||
    state.ordersBreakdownReadinessOrderId !== null ||
    state.materialDraftOrderId !== null ||
    state.materialDraftAddDraftId !== null ||
    state.techPackChangeVersionDialogOrderId !== null ||
    state.productionPatchDialogOrderId !== null ||
    state.techPackChangePublishGuideOpen ||
    state.detailLogsOpen ||
    state.detailSimulateOpen ||
    state.detailConfirmSimulateOpen
  )
}

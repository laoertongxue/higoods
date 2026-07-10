export type ProductionChangeType = 'QUANTITY_CHANGE' | 'MATERIAL_REPLACEMENT'

export type ProductionChangeResult = 'PRODUCTION_PATCH' | 'VERSION_RELATION' | 'VERSION_AND_PATCH'

export type MaterialReplacementMode = 'REMAINING' | 'FULL'

export type MaterialReplacementScope = 'CURRENT_ONLY' | 'CURRENT_AND_FOLLOWING'

export type ProductionChangePlanItemKind = 'AUTO' | 'MERCHANDISER_DECISION'

export interface QuantityChangeLine {
  id: string
  skuCode: string
  color: string
  size: string
  originalQty: number
  currentQty: number
  targetQty: number
  unit: '件'
  isNew: boolean
  coveredByCurrentVersion: boolean
}

export interface MaterialReplacementAllocation {
  id: string
  skuCode: string
  color: string
  size: string
  demandQty: number
  oldMaterialFactQty: number
  suggestedReplacementQty: number
  confirmedReplacementQty: number
}

export interface MaterialReplacementDraft {
  originalMaterialId: string
  replacementMaterialId: string
  replacementMode: MaterialReplacementMode
  scope: MaterialReplacementScope
  suggestedProductionQty: number
  confirmedProductionQty: number
  allocations: MaterialReplacementAllocation[]
  followingOrders: Array<{
    productionOrderId: string
    progressText: string
    started: boolean
    suggestedMode: MaterialReplacementMode
    confirmedMode: MaterialReplacementMode
  }>
}

export interface ProductionChangeDraft {
  productionOrderId: string
  changeType: ProductionChangeType
  reason: string
  quantityLines: QuantityChangeLine[]
  materialReplacement: MaterialReplacementDraft | null
  decisionValues: Record<string, { value: string; reason: string }>
}

export const productionChangeResultLabels: Record<ProductionChangeResult, string> = {
  PRODUCTION_PATCH: '生产单打补丁',
  VERSION_RELATION: '正式版本绑定调整',
  VERSION_AND_PATCH: '生产单打补丁 + 正式版本绑定调整',
}

export interface ProductionChangePlanItem {
  id: string
  kind: ProductionChangePlanItemKind
  group: '需求与物料' | '上下游单据' | '实物去向' | '成本与交期'
  title: string
  description: string
  affectedDocumentNo: string
  options: Array<{ value: string; label: string }>
  selectedValue: string
  reason: string
  reasonRequired: boolean
}

export interface ProductionChangeExecutionStep {
  id: string
  label: string
  status: 'WAITING' | 'RUNNING' | 'DONE' | 'ROLLED_BACK'
}

export interface ProductionChangePreview {
  result: ProductionChangeResult
  resultReason: string
  affectedOrderIds: string[]
  autoItems: ProductionChangePlanItem[]
  decisionItems: ProductionChangePlanItem[]
  summary: {
    affectedOrderCount: number
    affectedDocumentCount: number
    materialDeltaText: string
    costDeltaText: string
    deliveryImpactText: string
  }
  lockObjectIds: string[]
}

export type ProductionChangeStatus = 'DRAFT' | 'READY' | 'EXECUTING' | 'DONE' | 'ROLLED_BACK'

export interface ProductionChangeRecord extends ProductionChangeDraft {
  id: string
  result: ProductionChangeResult
  resultReason: string
  status: ProductionChangeStatus
  preview: ProductionChangePreview
  execution: {
    status: 'IDLE' | 'RUNNING' | 'DONE' | 'ROLLED_BACK'
    message: string
    progress: number
    steps: ProductionChangeExecutionStep[]
  }
  createdBy: string
  createdAt: string
}

export type InferProductionChangeResultInput =
  | {
      changeType: 'QUANTITY_CHANGE'
      requiresNewFormalVersion: boolean
    }
  | {
      changeType: 'MATERIAL_REPLACEMENT'
      replacementMode: MaterialReplacementMode
      scope: MaterialReplacementScope
    }

export function inferProductionChangeResult(input: InferProductionChangeResultInput): ProductionChangeResult {
  if (input.changeType === 'QUANTITY_CHANGE') {
    return input.requiresNewFormalVersion ? 'VERSION_AND_PATCH' : 'PRODUCTION_PATCH'
  }

  if (input.scope === 'CURRENT_ONLY') return 'PRODUCTION_PATCH'
  return input.replacementMode === 'REMAINING' ? 'VERSION_AND_PATCH' : 'VERSION_RELATION'
}

export function quantityChangeRequiresNewFormalVersion(lines: QuantityChangeLine[]): boolean {
  return lines.some((line) => line.isNew && !line.coveredByCurrentVersion)
}

function createAutoItem(input: Omit<ProductionChangePlanItem, 'kind' | 'options' | 'selectedValue' | 'reason' | 'reasonRequired'>): ProductionChangePlanItem {
  return {
    ...input,
    kind: 'AUTO',
    options: [],
    selectedValue: '',
    reason: '',
    reasonRequired: false,
  }
}

function createDecisionItem(
  draft: ProductionChangeDraft,
  input: Omit<ProductionChangePlanItem, 'kind' | 'selectedValue' | 'reason'> & { defaultValue?: string },
): ProductionChangePlanItem {
  const decision = draft.decisionValues[input.id]
  const { defaultValue = '', ...item } = input
  return {
    ...item,
    kind: 'MERCHANDISER_DECISION',
    selectedValue: decision?.value ?? defaultValue,
    reason: decision?.reason ?? '',
  }
}

function buildQuantityPlan(draft: ProductionChangeDraft): {
  result: ProductionChangeResult
  resultReason: string
  autoItems: ProductionChangePlanItem[]
  decisionItems: ProductionChangePlanItem[]
} {
  const requiresNewFormalVersion = quantityChangeRequiresNewFormalVersion(draft.quantityLines)
  const result = inferProductionChangeResult({ changeType: 'QUANTITY_CHANGE', requiresNewFormalVersion })
  const changedLineCount = draft.quantityLines.filter((line) => line.currentQty !== line.targetQty || line.isNew).length
  const autoItems = [
    createAutoItem({
      id: 'quantity-demand-update',
      group: '需求与物料',
      title: '更新生产需求明细',
      description: `按 ${changedLineCount} 条颜色尺码明细更新生产单需求，并保留原数量与变更后数量。`,
      affectedDocumentNo: draft.productionOrderId,
    }),
    createAutoItem({
      id: 'quantity-document-recalculation',
      group: '上下游单据',
      title: '重算未执行单据数量',
      description: '系统按当前执行事实调整未执行数量；已领、已裁、已加工和已完工事实保持不变。',
      affectedDocumentNo: draft.productionOrderId,
    }),
  ]

  if (requiresNewFormalVersion) {
    autoItems.push(
      createAutoItem({
        id: 'quantity-version-relation',
        group: '上下游单据',
        title: '调整正式版本绑定',
        description: '新增颜色尺码未被当前正式版本覆盖，系统生成正式版本绑定调整并同步生产单补丁。',
        affectedDocumentNo: draft.productionOrderId,
      }),
    )
  }

  return {
    result,
    resultReason: requiresNewFormalVersion
      ? '存在新增且当前正式版本未覆盖的颜色尺码明细，需要调整正式版本绑定并同步生产单补丁。'
      : '变更明细均被当前正式版本覆盖，只需更新当前生产单及其未执行数据。',
    autoItems,
    decisionItems: [],
  }
}

function buildMaterialPlan(draft: ProductionChangeDraft, replacement: MaterialReplacementDraft): {
  result: ProductionChangeResult
  resultReason: string
  autoItems: ProductionChangePlanItem[]
  decisionItems: ProductionChangePlanItem[]
} {
  const result = inferProductionChangeResult({
    changeType: 'MATERIAL_REPLACEMENT',
    replacementMode: replacement.replacementMode,
    scope: replacement.scope,
  })
  const modeText = replacement.replacementMode === 'REMAINING' ? '剩余数量' : '全部数量'
  const scopeText = replacement.scope === 'CURRENT_ONLY' ? '当前生产单' : '当前及后续生产单'
  const autoItems: ProductionChangePlanItem[] = [
    createAutoItem({
      id: 'material-demand-update',
      group: '需求与物料',
      title: '更新替代物料需求',
      description: `将 ${replacement.originalMaterialId} 的${modeText}替换为 ${replacement.replacementMaterialId}，确认替换生产数量 ${replacement.confirmedProductionQty} 件。`,
      affectedDocumentNo: draft.productionOrderId,
    }),
    createAutoItem({
      id: 'material-current-order-sync',
      group: '上下游单据',
      title: '同步当前生产单未执行单据',
      description: '系统按领料、裁剪、加工和完工事实调整未执行部分，已发生事实不覆盖。',
      affectedDocumentNo: draft.productionOrderId,
    }),
  ]
  const decisionItems: ProductionChangePlanItem[] = []

  if (replacement.scope === 'CURRENT_AND_FOLLOWING') {
    replacement.followingOrders.forEach((order) => {
      if (!order.started) {
        autoItems.push(
          createAutoItem({
            id: `following-order-auto-${order.productionOrderId}`,
            group: '上下游单据',
            title: `同步后续生产单 ${order.productionOrderId}`,
            description: `该生产单尚未开工，系统按${modeText}替换并重算备料与交期。`,
            affectedDocumentNo: order.productionOrderId,
          }),
        )
        return
      }

      decisionItems.push(
        createDecisionItem(draft, {
          id: `following-order-mode-${order.productionOrderId}`,
          group: '上下游单据',
          title: `确认已开工生产单 ${order.productionOrderId} 的替换方式`,
          description: `${order.progressText}，系统无法仅凭进度判断已发生部分是否继续使用旧料。`,
          affectedDocumentNo: order.productionOrderId,
          options: [
            { value: 'REMAINING', label: '只替换剩余数量' },
            { value: 'FULL', label: '全部数量改用新物料' },
          ],
          defaultValue: order.confirmedMode || order.suggestedMode,
          reasonRequired: true,
        }),
      )
    })
  }

  const oldMaterialFactQty = replacement.allocations.reduce((total, allocation) => total + allocation.oldMaterialFactQty, 0)
  if (oldMaterialFactQty > 0) {
    decisionItems.push(
      createDecisionItem(draft, {
        id: 'old-material-disposition',
        group: '实物去向',
        title: '确认旧面料实物去向',
        description: `已有 ${oldMaterialFactQty} 件对应的旧面料事实数量，系统无法自动判断现场实物应继续使用、退库还是转用。`,
        affectedDocumentNo: replacement.originalMaterialId,
        options: [
          { value: 'CONTINUE_USE', label: '已发生部分继续使用' },
          { value: 'RETURN_TO_STOCK', label: '退回库存' },
          { value: 'TRANSFER_USE', label: '转其他生产单使用' },
        ],
        reasonRequired: true,
      }),
    )
  }

  const resultReason =
    replacement.scope === 'CURRENT_ONLY'
      ? `${modeText}替换仅作用于当前生产单，系统生成生产单补丁。`
      : replacement.replacementMode === 'REMAINING'
        ? '剩余数量替换同时作用于当前及后续生产单，需要调整正式版本绑定并保留当前生产单补丁。'
        : '全部数量替换同时作用于当前及后续生产单，统一调整正式版本绑定关系。'

  return { result, resultReason, autoItems, decisionItems }
}

export function buildProductionChangePreview(draft: ProductionChangeDraft): ProductionChangePreview {
  if (draft.changeType === 'MATERIAL_REPLACEMENT' && !draft.materialReplacement) {
    throw new Error('替换物料变更缺少物料替换内容')
  }

  const plan =
    draft.changeType === 'QUANTITY_CHANGE'
      ? buildQuantityPlan(draft)
      : buildMaterialPlan(draft, draft.materialReplacement as MaterialReplacementDraft)
  const replacement = draft.materialReplacement
  const affectedOrderIds = Array.from(
    new Set([
      draft.productionOrderId,
      ...(draft.changeType === 'MATERIAL_REPLACEMENT' && replacement?.scope === 'CURRENT_AND_FOLLOWING'
        ? replacement.followingOrders.map((order) => order.productionOrderId)
        : []),
    ].filter((id) => id.trim().length > 0)),
  )
  const planItems = [...plan.autoItems, ...plan.decisionItems]
  const affectedDocumentIds = Array.from(
    new Set(planItems.map((item) => item.affectedDocumentNo).filter((id) => id.trim().length > 0)),
  )
  const quantityDelta = draft.quantityLines.reduce((total, line) => total + line.targetQty - line.currentQty, 0)
  const pendingStartedOrders = plan.decisionItems.filter((item) => item.id.startsWith('following-order-mode-')).length

  return {
    result: plan.result,
    resultReason: plan.resultReason,
    affectedOrderIds,
    autoItems: plan.autoItems,
    decisionItems: plan.decisionItems,
    summary: {
      affectedOrderCount: affectedOrderIds.length,
      affectedDocumentCount: affectedDocumentIds.length,
      materialDeltaText:
        draft.changeType === 'QUANTITY_CHANGE'
          ? `生产需求净变化 ${quantityDelta >= 0 ? '+' : ''}${quantityDelta} 件。`
          : `${replacement?.originalMaterialId ?? '原物料'} → ${replacement?.replacementMaterialId ?? '替代物料'}，确认替换 ${replacement?.confirmedProductionQty ?? 0} 件。`,
      costDeltaText:
        draft.changeType === 'QUANTITY_CHANGE'
          ? '系统按需求数量变化重算未发生的物料与加工成本。'
          : '系统按新旧物料价差及已发生事实核算成本差异。',
      deliveryImpactText:
        pendingStartedOrders > 0
          ? `${pendingStartedOrders} 张已开工后续生产单待跟单判断，完成后系统重算交期。`
          : '系统按确认后的生产数量重算关联单据交期。',
    },
    lockObjectIds: Array.from(new Set([...affectedOrderIds, ...affectedDocumentIds])).filter((id) => id.trim().length > 0),
  }
}

export function validateProductionChangeDecisions(preview: ProductionChangePreview): string[] {
  return preview.decisionItems
    .filter((item) => !item.selectedValue || (item.reasonRequired && item.reason.trim().length === 0))
    .map((item) => item.id)
}
